import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from './redis.service';
import { WebSocketServerRegistryService, ServerNode } from './websocket-server-registry.service';
import { EventStreamService, AxonPulsEvent } from './event-stream.service';
import { v4 as uuidv4 } from 'uuid';

export interface CrossServerMessage {
  id: string;
  type: 'broadcast' | 'unicast' | 'multicast';
  sourceServerId: string;
  targetServerIds?: string[];
  organizationId: string;
  userId?: string;
  channel: string;
  event: AxonPulsEvent;
  timestamp: number;
  ttl?: number;
  acknowledgment?: boolean;
}

export interface MessageDeliveryStatus {
  messageId: string;
  serverId: string;
  status: 'pending' | 'delivered' | 'failed';
  timestamp: number;
  error?: string;
}

@Injectable()
export class CrossServerEventRouterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrossServerEventRouterService.name);
  private readonly CROSS_SERVER_CHANNEL = 'axonpuls:cross-server:events';
  private readonly MESSAGE_TTL = 300; // 5 minutes
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly messageCache = new Map<string, CrossServerMessage>();
  private readonly deliveryStatus = new Map<string, MessageDeliveryStatus[]>();
  private isSubscribed = false;

  constructor(
    private readonly redisService: RedisService,
    private readonly serverRegistry: WebSocketServerRegistryService,
    private readonly eventStreamService: EventStreamService,
  ) {}

  async onModuleInit() {
    await this.subscribeToCrossServerEvents();
    this.startMessageCleanup();
    this.logger.log('Cross-server event router initialized');
  }

  async onModuleDestroy() {
    await this.unsubscribeFromCrossServerEvents();
    this.logger.log('Cross-server event router destroyed');
  }

  /**
   * Broadcast event to all servers in the cluster
   */
  async broadcastToAllServers(
    organizationId: string,
    channel: string,
    event: AxonPulsEvent,
    options: { excludeCurrentServer?: boolean; acknowledgment?: boolean } = {}
  ): Promise<string> {
    try {
      const servers = await this.serverRegistry.getActiveServers();
      const currentServerId = this.serverRegistry.getServerId();
      
      let targetServers = servers;
      if (options.excludeCurrentServer) {
        targetServers = servers.filter(server => server.id !== currentServerId);
      }

      if (targetServers.length === 0) {
        this.logger.debug('No target servers for broadcast');
        return null;
      }

      const message: CrossServerMessage = {
        id: uuidv4(),
        type: 'broadcast',
        sourceServerId: currentServerId,
        targetServerIds: targetServers.map(s => s.id),
        organizationId,
        channel,
        event,
        timestamp: Date.now(),
        ttl: this.MESSAGE_TTL,
        acknowledgment: options.acknowledgment || false,
      };

      await this.sendCrossServerMessage(message);
      this.logger.debug(`Broadcast message sent to ${targetServers.length} servers: ${message.id}`);
      
      return message.id;
    } catch (error) {
      this.logger.error(`Failed to broadcast to all servers: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send event to specific servers
   */
  async sendToSpecificServers(
    targetServerIds: string[],
    organizationId: string,
    channel: string,
    event: AxonPulsEvent,
    options: { acknowledgment?: boolean } = {}
  ): Promise<string> {
    try {
      const message: CrossServerMessage = {
        id: uuidv4(),
        type: 'multicast',
        sourceServerId: this.serverRegistry.getServerId(),
        targetServerIds,
        organizationId,
        channel,
        event,
        timestamp: Date.now(),
        ttl: this.MESSAGE_TTL,
        acknowledgment: options.acknowledgment || false,
      };

      await this.sendCrossServerMessage(message);
      this.logger.debug(`Multicast message sent to ${targetServerIds.length} servers: ${message.id}`);
      
      return message.id;
    } catch (error) {
      this.logger.error(`Failed to send to specific servers: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send event to server hosting specific user
   */
  async sendToUserServer(
    userId: string,
    organizationId: string,
    channel: string,
    event: AxonPulsEvent,
    options: { acknowledgment?: boolean } = {}
  ): Promise<string | null> {
    try {
      const userServerId = await this.findUserServer(userId, organizationId);
      if (!userServerId) {
        this.logger.debug(`User ${userId} not found on any server`);
        return null;
      }

      const message: CrossServerMessage = {
        id: uuidv4(),
        type: 'unicast',
        sourceServerId: this.serverRegistry.getServerId(),
        targetServerIds: [userServerId],
        organizationId,
        userId,
        channel,
        event,
        timestamp: Date.now(),
        ttl: this.MESSAGE_TTL,
        acknowledgment: options.acknowledgment || false,
      };

      await this.sendCrossServerMessage(message);
      this.logger.debug(`Unicast message sent to user ${userId} on server ${userServerId}: ${message.id}`);
      
      return message.id;
    } catch (error) {
      this.logger.error(`Failed to send to user server: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get delivery status for a message
   */
  async getMessageDeliveryStatus(messageId: string): Promise<MessageDeliveryStatus[]> {
    return this.deliveryStatus.get(messageId) || [];
  }

  /**
   * Handle incoming cross-server message
   */
  private async handleCrossServerMessage(message: CrossServerMessage): Promise<void> {
    try {
      const currentServerId = this.serverRegistry.getServerId();
      
      // Check if this message is for this server
      if (!this.isMessageForThisServer(message, currentServerId)) {
        return;
      }

      // Check for duplicate message
      if (this.messageCache.has(message.id)) {
        this.logger.debug(`Duplicate message ignored: ${message.id}`);
        return;
      }

      // Cache message to prevent duplicates
      this.messageCache.set(message.id, message);

      // Process the event locally
      await this.processEventLocally(message);

      // Send acknowledgment if requested
      if (message.acknowledgment) {
        await this.sendAcknowledgment(message, 'delivered');
      }

      this.logger.debug(`Cross-server message processed: ${message.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle cross-server message ${message.id}: ${error.message}`);
      
      // Send failure acknowledgment if requested
      if (message.acknowledgment) {
        await this.sendAcknowledgment(message, 'failed', error.message);
      }
    }
  }

  /**
   * Process event on local server
   */
  private async processEventLocally(message: CrossServerMessage): Promise<void> {
    try {
      // Route the event through the local event stream service
      await this.eventStreamService.publishEvent({
        ...message.event,
        metadata: {
          ...message.event.metadata,
          crossServer: true,
          sourceServerId: message.sourceServerId,
          routedAt: Date.now(),
        }
      });

      this.logger.debug(`Event processed locally for channel ${message.channel}`);
    } catch (error) {
      this.logger.error(`Failed to process event locally: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send cross-server message via Redis
   */
  private async sendCrossServerMessage(message: CrossServerMessage): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      
      // Store message for tracking
      await redis.setEx(
        `axonpuls:cross-server:messages:${message.id}`,
        this.MESSAGE_TTL,
        JSON.stringify(message)
      );

      // Publish to cross-server channel
      await redis.publish(this.CROSS_SERVER_CHANNEL, JSON.stringify(message));

      // Initialize delivery status tracking if acknowledgment requested
      if (message.acknowledgment) {
        const initialStatus = message.targetServerIds.map(serverId => ({
          messageId: message.id,
          serverId,
          status: 'pending' as const,
          timestamp: Date.now(),
        }));
        this.deliveryStatus.set(message.id, initialStatus);
      }
    } catch (error) {
      this.logger.error(`Failed to send cross-server message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Subscribe to cross-server events
   */
  private async subscribeToCrossServerEvents(): Promise<void> {
    try {
      const pubSubClient = this.redisService.getPubSubClient();
      
      await pubSubClient.subscribe(this.CROSS_SERVER_CHANNEL, (message) => {
        try {
          const crossServerMessage = JSON.parse(message) as CrossServerMessage;
          this.handleCrossServerMessage(crossServerMessage).catch(error => {
            this.logger.error(`Error handling cross-server message: ${error.message}`);
          });
        } catch (parseError) {
          this.logger.error(`Failed to parse cross-server message: ${parseError.message}`);
        }
      });

      this.isSubscribed = true;
      this.logger.log('Subscribed to cross-server events');
    } catch (error) {
      this.logger.error(`Failed to subscribe to cross-server events: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unsubscribe from cross-server events
   */
  private async unsubscribeFromCrossServerEvents(): Promise<void> {
    if (this.isSubscribed) {
      try {
        const pubSubClient = this.redisService.getPubSubClient();
        await pubSubClient.unsubscribe(this.CROSS_SERVER_CHANNEL);
        this.isSubscribed = false;
        this.logger.log('Unsubscribed from cross-server events');
      } catch (error) {
        this.logger.error(`Failed to unsubscribe from cross-server events: ${error.message}`);
      }
    }
  }

  /**
   * Check if message is intended for this server
   */
  private isMessageForThisServer(message: CrossServerMessage, currentServerId: string): boolean {
    // Don't process messages from this server (avoid loops)
    if (message.sourceServerId === currentServerId) {
      return false;
    }

    // Check if this server is in the target list
    if (message.targetServerIds && message.targetServerIds.length > 0) {
      return message.targetServerIds.includes(currentServerId);
    }

    // For broadcast messages without specific targets, process on all servers
    return message.type === 'broadcast';
  }

  /**
   * Find which server is hosting a specific user
   */
  private async findUserServer(userId: string, organizationId: string): Promise<string | null> {
    try {
      const redis = this.redisService.getRedisInstance();
      const userServerKey = `axonpuls:user-server:${organizationId}:${userId}`;
      const serverId = await redis.get(userServerKey);
      
      if (serverId) {
        // Verify server is still active
        const server = await this.serverRegistry.getServerById(serverId);
        if (server && server.status === 'active') {
          return serverId;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to find user server: ${error.message}`);
      return null;
    }
  }

  /**
   * Send acknowledgment for message delivery
   */
  private async sendAcknowledgment(
    message: CrossServerMessage,
    status: 'delivered' | 'failed',
    error?: string
  ): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      const ackMessage = {
        messageId: message.id,
        serverId: this.serverRegistry.getServerId(),
        status,
        timestamp: Date.now(),
        error,
      };

      await redis.publish(
        `axonpuls:cross-server:ack:${message.sourceServerId}`,
        JSON.stringify(ackMessage)
      );
    } catch (error) {
      this.logger.error(`Failed to send acknowledgment: ${error.message}`);
    }
  }

  /**
   * Start message cleanup task
   */
  private startMessageCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      
      // Clean up expired messages from cache
      for (const [messageId, message] of this.messageCache.entries()) {
        if (now - message.timestamp > this.MESSAGE_TTL * 1000) {
          this.messageCache.delete(messageId);
          this.deliveryStatus.delete(messageId);
        }
      }
    }, 60000); // Clean up every minute
  }
}
