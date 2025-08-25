import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

export interface AxonPulsEvent {
  id?: string;
  eventType: string;
  channel: string;
  payload: any;
  sessionId?: string;
  organizationId?: string;
  userId?: string;
  acknowledgment: boolean;
  retryCount: number;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface EventSubscription {
  channels: string[];
  organizationId?: string;
  userId?: string;
  filters?: Record<string, any>;
  acknowledgment?: boolean;
}

@Injectable()
export class EventStreamService implements OnModuleInit {
  private readonly logger = new Logger(EventStreamService.name);
  private readonly streamPrefix = 'AxonPuls:events:';
  private readonly consumerGroup: string;
  private readonly consumerName: string;
  private readonly maxStreamLength: number;

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    this.consumerGroup = this.configService.get<string>('redis.streams.consumerGroup');
    this.consumerName = this.configService.get<string>('redis.streams.consumerName');
    this.maxStreamLength = this.configService.get<number>('redis.streams.maxLength');
  }

  async onModuleInit() {
    await this.initializeStreams();
  }

  private async initializeStreams() {
    try {
      // Initialize main event streams
      const eventTypes = [
        'agent_events',
        'tool_events',
        'workflow_events',
        'provider_events',
        'system_events',
        'connection_events',
      ];

      const promises = eventTypes.map(async (eventType) => {
        try {
          const streamKey = this.getStreamKey(eventType);
          await this.redisService.createConsumerGroup(
            streamKey,
            this.consumerGroup,
            '0'
          );
          this.logger.debug(`Initialized stream for ${eventType}`);
        } catch (error) {
          this.logger.warn(`Failed to initialize stream for ${eventType}:`, error);
          // Don't throw for individual stream failures
        }
      });

      await Promise.allSettled(promises);
      this.logger.log('Event streams initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize event streams:', error);
      // Don't throw the error to prevent application startup failure
      // The streams will be created on-demand when needed
      this.logger.warn('Continuing startup without Redis streams - they will be created on-demand');
    }
  }

  // Publish Events
  async publishEvent(event: AxonPulsEvent): Promise<string> {
    try {
      const streamKey = this.getStreamKey(event.eventType, event.organizationId);

      const eventData = {
        ...event,
        id: undefined, // Let Redis generate the ID
        createdAt: event.createdAt || new Date().toISOString(),
      };

      const messageId = await this.redisService.addToStream(
        streamKey,
        eventData,
        this.maxStreamLength
      );

      this.logger.debug(`Published event ${event.eventType} to stream ${streamKey}: ${messageId}`);

      // Also publish to pub/sub for real-time notifications
      await this.publishToChannel(event);

      return messageId;
    } catch (error) {
      this.logger.error(`Failed to publish event ${event.eventType}:`, error);
      throw error;
    }
  }

  // Subscribe to Events
  async subscribeToEvents(
    subscription: EventSubscription,
    callback: (event: AxonPulsEvent) => void
  ): Promise<void> {
    try {
      for (const channel of subscription.channels) {
        const streamKey = this.getStreamKey(channel, subscription.organizationId);

        // Start consuming from the stream
        this.consumeFromStream(streamKey, callback, subscription);
      }

      this.logger.log(`Subscribed to channels: ${subscription.channels.join(', ')}`);
    } catch (error) {
      this.logger.error('Failed to subscribe to events:', error);
      throw error;
    }
  }

  private async consumeFromStream(
    streamKey: string,
    callback: (event: AxonPulsEvent) => void,
    subscription: EventSubscription
  ): Promise<void> {
    const blockTime = this.configService.get<number>('redis.streams.blockTime');
    const count = this.configService.get<number>('redis.streams.count');

    try {
      while (true) {
        const messages = await this.redisService.readFromConsumerGroup(
          streamKey,
          this.consumerGroup,
          this.consumerName,
          count,
          blockTime
        );

        for (const message of messages) {
          try {
            const event = this.parseEventFromMessage(message);

            // Apply filters
            if (this.shouldProcessEvent(event, subscription)) {
              callback(event);

              // Acknowledge message if required
              if (subscription.acknowledgment !== false) {
                await this.acknowledgeEvent(streamKey, message.id);
              }
            }
          } catch (error) {
            this.logger.error(`Failed to process message ${message.id}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error consuming from stream ${streamKey}:`, error);
    }
  }

  // Event Replay
  async replayEvents(
    channel: string,
    organizationId?: string,
    startTime?: string,
    endTime?: string,
    count: number = 100
  ): Promise<AxonPulsEvent[]> {
    try {
      const streamKey = this.getStreamKey(channel, organizationId);
      const startId = startTime ? this.timestampToStreamId(startTime) : '0';
      const endId = endTime ? this.timestampToStreamId(endTime) : '+';

      // Use XRANGE to get events in a time range
      const redis = this.redisService.getRedisInstance();
      const result = await redis.sendCommand(['XRANGE', streamKey, startId, endId, 'COUNT', count.toString()]) as any[];

      const events = result.map(([id, fields]) => {
        const message = { id, fields: this.parseStreamFields(fields) };
        return this.parseEventFromMessage(message);
      });

      this.logger.debug(`Replayed ${events.length} events from ${channel}`);
      return events;
    } catch (error) {
      this.logger.error(`Failed to replay events from ${channel}:`, error);
      throw error;
    }
  }

  // Acknowledge Event
  async acknowledgeEvent(streamKey: string, messageId: string): Promise<void> {
    try {
      await this.redisService.acknowledgeMessage(
        streamKey,
        this.consumerGroup,
        messageId
      );
    } catch (error) {
      this.logger.error(`Failed to acknowledge event ${messageId}:`, error);
      throw error;
    }
  }

  // Get Stream Statistics
  async getStreamStats(channel: string, organizationId?: string): Promise<any> {
    try {
      const streamKey = this.getStreamKey(channel, organizationId);
      const redis = this.redisService.getRedisInstance();

      const [streamInfo, groupInfo] = await Promise.all([
        redis.sendCommand(['XINFO', 'STREAM', streamKey]),
        this.redisService.getConsumerGroupInfo(streamKey),
      ]);

      return {
        streamKey,
        length: streamInfo[1],
        firstEntry: streamInfo[5],
        lastEntry: streamInfo[7],
        consumerGroups: groupInfo,
      };
    } catch (error) {
      this.logger.error(`Failed to get stream stats for ${channel}:`, error);
      throw error;
    }
  }

  // Private Helper Methods
  private getStreamKey(eventType: string, organizationId?: string): string {
    if (organizationId) {
      return `${this.streamPrefix}${organizationId}:${eventType}`;
    }
    return `${this.streamPrefix}global:${eventType}`;
  }

  private async publishToChannel(event: AxonPulsEvent): Promise<void> {
    const channelKey = this.getChannelKey(event.channel, event.organizationId);
    await this.redisService.publish(channelKey, event);
  }

  private getChannelKey(channel: string, organizationId?: string): string {
    if (organizationId) {
      return `AxonPuls:channels:${organizationId}:${channel}`;
    }
    return `AxonPuls:channels:global:${channel}`;
  }

  private parseEventFromMessage(message: any): AxonPulsEvent {
    const fields = message.fields;
    return {
      id: message.id,
      eventType: fields.eventType,
      channel: fields.channel,
      payload: fields.payload,
      sessionId: fields.sessionId,
      organizationId: fields.organizationId,
      userId: fields.userId,
      acknowledgment: fields.acknowledgment === 'true',
      retryCount: parseInt(fields.retryCount) || 0,
      createdAt: fields.createdAt,
      metadata: fields.metadata,
    };
  }

  private shouldProcessEvent(event: AxonPulsEvent, subscription: EventSubscription): boolean {
    // Organization filter
    if (subscription.organizationId && event.organizationId !== subscription.organizationId) {
      return false;
    }

    // User filter
    if (subscription.userId && event.userId !== subscription.userId) {
      return false;
    }

    // Custom filters
    if (subscription.filters) {
      for (const [key, value] of Object.entries(subscription.filters)) {
        if (event.payload[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  private timestampToStreamId(timestamp: string): string {
    const date = new Date(timestamp);
    return `${date.getTime()}-0`;
  }

  private parseStreamFields(fields: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    }
    return result;
  }
}
