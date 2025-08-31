import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/services/redis.service';
import { PrismaService } from '../../common/services/prisma.service';

export interface QueueMessage {
  id?: string;
  type: string;
  payload: any;
  priority: number;
  delay?: number;
  attempts: number;
  maxAttempts: number;
  organizationId?: string;
  userId?: string;
  createdAt: string;
  processedAt?: string;
  failedAt?: string;
  error?: string;
}

export interface QueueOptions {
  priority?: number;
  delay?: number;
  maxAttempts?: number;
  backoffStrategy?: 'fixed' | 'exponential';
  backoffDelay?: number;
}

export interface ConsumerOptions {
  concurrency?: number;
  blockTime?: number;
  batchSize?: number;
  autoAck?: boolean;
}

@Injectable()
export class MessageQueueService implements OnModuleInit {
  private readonly logger = new Logger(MessageQueueService.name);
  private readonly queuePrefix = 'AxonPuls:queue:';
  private readonly dlqPrefix = 'AxonPuls:dlq:';
  private readonly consumerGroup: string;
  private readonly consumerName: string;
  private activeConsumers = new Map<string, boolean>();

  constructor(
    private redisService: RedisService,
    private prismaService: PrismaService,
    private configService: ConfigService,
  ) {
    this.consumerGroup = this.configService.get<string>('queue.consumerGroup', 'AxonPuls-consumers');
    this.consumerName = this.configService.get<string>('queue.consumerName', `consumer-${process.pid}`);
  }

  async onModuleInit() {
    await this.initializeQueues();
  }

  private async initializeQueues() {
    try {
      const queueTypes = [
        'high-priority',
        'normal-priority',
        'low-priority',
        'delayed',
        'retry',
        'dead-letter',
      ];

      for (const queueType of queueTypes) {
        const queueKey = this.getQueueKey(queueType);
        await this.redisService.createConsumerGroup(queueKey, this.consumerGroup, '0');
      }

      this.logger.log('Message queues initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize message queues:', error);
      throw error;
    }
  }

  // Queue Operations
  async enqueue(
    queueName: string,
    message: Omit<QueueMessage, 'id' | 'attempts' | 'createdAt'>,
    options: QueueOptions = {}
  ): Promise<string> {
    try {
      const queueMessage: QueueMessage = {
        ...message,
        priority: options.priority || 0,
        attempts: 0,
        maxAttempts: options.maxAttempts || 3,
        createdAt: new Date().toISOString(),
      };

      // Determine target queue based on priority and delay
      const targetQueue = this.determineTargetQueue(queueMessage, options);
      const queueKey = this.getQueueKey(targetQueue);

      // Add delay if specified
      if (options.delay && options.delay > 0) {
        return await this.scheduleDelayedMessage(queueMessage, options.delay);
      }

      // Add to queue
      const messageId = await this.redisService.addToStream(queueKey, queueMessage);

      this.logger.debug(`Enqueued message to ${targetQueue}: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error(`Failed to enqueue message to ${queueName}:`, error);
      throw error;
    }
  }

  async dequeue(
    queueName: string,
    options: ConsumerOptions = {}
  ): Promise<QueueMessage[]> {
    try {
      const queueKey = this.getQueueKey(queueName);
      const blockTime = options.blockTime || this.configService.get<number>('queue.consumer.blockTime', 5000);
      const batchSize = options.batchSize || this.configService.get<number>('queue.consumer.batchSize', 10);

      const messages = await this.redisService.readFromConsumerGroup(
        queueKey,
        this.consumerGroup,
        this.consumerName,
        batchSize,
        blockTime
      );

      const queueMessages = messages.map(msg => this.parseQueueMessage(msg));

      if (queueMessages.length > 0) {
        this.logger.debug(`Dequeued ${queueMessages.length} messages from ${queueName}`);
      }

      return queueMessages;
    } catch (error) {
      this.logger.error(`Failed to dequeue from ${queueName}:`, error);
      throw error;
    }
  }

  // Message Processing
  async processMessage(
    queueName: string,
    messageId: string,
    processor: (message: QueueMessage) => Promise<void>
  ): Promise<void> {
    try {
      const queueKey = this.getQueueKey(queueName);

      // Get message details
      const messages = await this.redisService.readFromStream(queueKey, messageId, 1);
      if (messages.length === 0) {
        throw new Error(`Message ${messageId} not found`);
      }

      const message = this.parseQueueMessage(messages[0]);

      try {
        // Process the message
        await processor(message);

        // Acknowledge successful processing
        await this.acknowledgeMessage(queueKey, messageId);

        this.logger.debug(`Successfully processed message ${messageId}`);
      } catch (processingError) {
        // Handle processing failure
        await this.handleProcessingFailure(message, processingError);
      }
    } catch (error) {
      this.logger.error(`Failed to process message ${messageId}:`, error);
      throw error;
    }
  }

  async acknowledgeMessage(queueKey: string, messageId: string): Promise<void> {
    try {
      await this.redisService.acknowledgeMessage(queueKey, this.consumerGroup, messageId);
    } catch (error) {
      this.logger.error(`Failed to acknowledge message ${messageId}:`, error);
      throw error;
    }
  }

  // Consumer Management
  async startConsumer(
    queueName: string,
    processor: (message: QueueMessage) => Promise<void>,
    options: ConsumerOptions = {}
  ): Promise<void> {
    const consumerKey = `${queueName}-${this.consumerName}`;

    if (this.activeConsumers.get(consumerKey)) {
      this.logger.warn(`Consumer for ${queueName} is already running`);
      return;
    }

    this.activeConsumers.set(consumerKey, true);
    this.logger.log(`Starting consumer for queue: ${queueName}`);

    // Start consuming in background
    this.consumeMessages(queueName, processor, options).catch(error => {
      this.logger.error(`Consumer error for ${queueName}:`, error);
      this.activeConsumers.set(consumerKey, false);
    });
  }

  async stopConsumer(queueName: string): Promise<void> {
    const consumerKey = `${queueName}-${this.consumerName}`;
    this.activeConsumers.set(consumerKey, false);
    this.logger.log(`Stopped consumer for queue: ${queueName}`);
  }

  private async consumeMessages(
    queueName: string,
    processor: (message: QueueMessage) => Promise<void>,
    options: ConsumerOptions
  ): Promise<void> {
    const consumerKey = `${queueName}-${this.consumerName}`;
    const concurrency = options.concurrency || 1;
    const autoAck = options.autoAck !== false;

    while (this.activeConsumers.get(consumerKey)) {
      try {
        const messages = await this.dequeue(queueName, options);

        if (messages.length === 0) {
          continue;
        }

        // Process messages with concurrency control
        const processingPromises = messages.slice(0, concurrency).map(async (message) => {
          try {
            await processor(message);

            if (autoAck && message.id) {
              const queueKey = this.getQueueKey(queueName);
              await this.acknowledgeMessage(queueKey, message.id);
            }
          } catch (error) {
            await this.handleProcessingFailure(message, error);
          }
        });

        await Promise.allSettled(processingPromises);
      } catch (error) {
        this.logger.error(`Error in consumer loop for ${queueName}:`, error);
        const errorPauseMs = this.configService.get<number>('queue.consumer.errorPauseMs', 1000);
        await new Promise(resolve => setTimeout(resolve, errorPauseMs)); // Configurable pause on error
      }
    }
  }

  // Retry and Dead Letter Queue Management
  private async handleProcessingFailure(
    message: QueueMessage,
    error: any
  ): Promise<void> {
    try {
      message.attempts += 1;
      message.error = error.message || String(error);
      message.failedAt = new Date().toISOString();

      if (message.attempts >= message.maxAttempts) {
        // Move to dead letter queue
        await this.moveToDeadLetterQueue(message);
        this.logger.warn(`Message ${message.id} moved to dead letter queue after ${message.attempts} attempts`);
      } else {
        // Retry with backoff
        const delay = this.calculateBackoffDelay(message.attempts);
        await this.scheduleRetry(message, delay);
        this.logger.debug(`Message ${message.id} scheduled for retry in ${delay}ms`);
      }
    } catch (retryError) {
      this.logger.error(`Failed to handle processing failure for message ${message.id}:`, retryError);
    }
  }

  private async scheduleRetry(message: QueueMessage, delay: number): Promise<void> {
    const retryQueue = this.getQueueKey('retry');

    // Schedule for future processing
    setTimeout(async () => {
      try {
        await this.redisService.addToStream(retryQueue, message);
      } catch (error) {
        this.logger.error(`Failed to schedule retry for message ${message.id}:`, error);
      }
    }, delay);
  }

  private async moveToDeadLetterQueue(message: QueueMessage): Promise<void> {
    const dlqKey = this.getDLQKey('failed');
    await this.redisService.addToStream(dlqKey, message);
  }

  private async scheduleDelayedMessage(message: QueueMessage, delay: number): Promise<string> {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const queueKey = this.getQueueKey('normal-priority');
          const messageId = await this.redisService.addToStream(queueKey, message);
          resolve(messageId);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }

  // Queue Statistics
  async getQueueStats(queueName: string): Promise<any> {
    try {
      const queueKey = this.getQueueKey(queueName);
      return await this.redisService.getConsumerGroupInfo(queueKey);
    } catch (error) {
      this.logger.error(`Failed to get stats for queue ${queueName}:`, error);
      throw error;
    }
  }

  async getQueueLength(queueName: string): Promise<number> {
    try {
      const queueKey = this.getQueueKey(queueName);
      const redis = this.redisService.getRedisInstance();
      const result = await redis.sendCommand(['XLEN', queueKey]) as number;
      return result;
    } catch (error) {
      this.logger.error(`Failed to get length for queue ${queueName}:`, error);
      return 0;
    }
  }

  // Helper Methods
  private determineTargetQueue(message: QueueMessage, options: QueueOptions): string {
    if (options.delay && options.delay > 0) {
      return 'delayed';
    }

    if (message.priority > 5) {
      return 'high-priority';
    } else if (message.priority < 0) {
      return 'low-priority';
    }

    return 'normal-priority';
  }

  private calculateBackoffDelay(attempts: number): number {
    const baseDelay = this.configService.get<number>('queue.backoffDelay', 1000);
    const maxDelay = this.configService.get<number>('queue.maxBackoffDelay', 30000);
    return Math.min(baseDelay * Math.pow(2, attempts - 1), maxDelay);
  }

  private getQueueKey(queueName: string): string {
    return `${this.queuePrefix}${queueName}`;
  }

  private getDLQKey(queueName: string): string {
    return `${this.dlqPrefix}${queueName}`;
  }

  private parseQueueMessage(streamMessage: any): QueueMessage {
    const fields = streamMessage.fields;
    return {
      id: streamMessage.id,
      type: fields.type,
      payload: fields.payload,
      priority: parseInt(fields.priority) || 0,
      attempts: parseInt(fields.attempts) || 0,
      maxAttempts: parseInt(fields.maxAttempts) || 3,
      organizationId: fields.organizationId,
      userId: fields.userId,
      createdAt: fields.createdAt,
      processedAt: fields.processedAt,
      failedAt: fields.failedAt,
      error: fields.error,
    };
  }

  // Public API Methods
  async purgeQueue(queueName: string): Promise<void> {
    try {
      const queueKey = this.getQueueKey(queueName);
      const redis = this.redisService.getRedisInstance();
      await redis.sendCommand(['DEL', queueKey]);
      this.logger.log(`Purged queue: ${queueName}`);
    } catch (error) {
      this.logger.error(`Failed to purge queue ${queueName}:`, error);
      throw error;
    }
  }

  async reprocessDeadLetterQueue(queueName: string): Promise<number> {
    try {
      const dlqKey = this.getDLQKey(queueName);
      const targetQueueKey = this.getQueueKey(queueName);

      const messages = await this.redisService.readFromStream(dlqKey, '0', 100);

      for (const message of messages) {
        const queueMessage = this.parseQueueMessage(message);
        queueMessage.attempts = 0; // Reset attempts
        queueMessage.error = undefined;
        queueMessage.failedAt = undefined;

        await this.redisService.addToStream(targetQueueKey, queueMessage);
      }

      this.logger.log(`Reprocessed ${messages.length} messages from DLQ to ${queueName}`);
      return messages.length;
    } catch (error) {
      this.logger.error(`Failed to reprocess DLQ for ${queueName}:`, error);
      throw error;
    }
  }
}
