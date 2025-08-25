import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { TenantAwareService, TenantContext } from './tenant-aware.service';

/**
 * Enhanced Tenant Messaging Service
 * Provides clear separation between persistent streams and real-time pub/sub
 */

export interface StreamEventData {
  eventType: string;
  payload: Record<string, any>;
  timestamp: string;
  organizationId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface RealtimeMessage {
  type: string;
  data: any;
  timestamp: string;
  organizationId: string;
  userId?: string;
}

@Injectable()
export class TenantMessagingService {
  private readonly logger = new Logger(TenantMessagingService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly tenantAwareService: TenantAwareService,
  ) {}

  // ============================================================================
  // PERSISTENT STREAMS (for reliable, ordered messaging)
  // ============================================================================

  /**
   * Add event to persistent stream with consumer group support
   * Use for: Events that need persistence, processing, and guaranteed delivery
   */
  async addEventToStream(
    context: TenantContext,
    streamName: string,
    eventData: StreamEventData
  ): Promise<string> {
    try {
      await this.tenantAwareService.validateTenantAccess(context, 'create', 'TenantStream');

      const streamKey = this.getStreamKey(context.organizationId, streamName);
      
      // Ensure consumer group exists
      await this.ensureConsumerGroup(streamKey, 'processors');

      const messageId = await this.redisService.addToStream(streamKey, {
        ...eventData,
        organizationId: context.organizationId,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`Added event to stream ${streamKey}: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error(`Failed to add event to stream: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process events from stream using consumer group
   * Use for: Background processing, workflows, integrations
   */
  async processEventsFromStream(
    context: TenantContext,
    streamName: string,
    consumerName: string,
    batchSize: number = 10
  ): Promise<StreamEventData[]> {
    try {
      await this.tenantAwareService.validateTenantAccess(context, 'read', 'TenantStream');

      const streamKey = this.getStreamKey(context.organizationId, streamName);
      const messages = await this.redisService.readFromConsumerGroup(
        streamKey,
        'processors',
        consumerName,
        batchSize,
        1000 // 1 second block
      );

      return messages.map(msg => {
        const fields = msg.fields as any;
        return {
          eventType: fields.eventType,
          payload: typeof fields.payload === 'string' ? JSON.parse(fields.payload) : fields.payload,
          timestamp: fields.timestamp,
          organizationId: fields.organizationId,
          userId: fields.userId,
          messageId: msg.id,
        } as StreamEventData & { messageId: string };
      });
    } catch (error) {
      this.logger.error(`Failed to process events from stream: ${error.message}`);
      throw error;
    }
  }

  /**
   * Acknowledge processed event
   */
  async acknowledgeEvent(
    context: TenantContext,
    streamName: string,
    messageId: string
  ): Promise<void> {
    try {
      const streamKey = this.getStreamKey(context.organizationId, streamName);
      await this.redisService.acknowledgeMessage(streamKey, 'processors', messageId);
      this.logger.debug(`Acknowledged message ${messageId}`);
    } catch (error) {
      this.logger.error(`Failed to acknowledge message: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // REAL-TIME PUB/SUB (for immediate notifications)
  // ============================================================================

  /**
   * Publish real-time message to all subscribers
   * Use for: Live updates, notifications, status changes
   */
  async publishRealtimeMessage(
    context: TenantContext,
    channel: string,
    message: RealtimeMessage
  ): Promise<number> {
    try {
      await this.tenantAwareService.validateTenantAccess(context, 'create', 'TenantChannel');

      const channelKey = this.getChannelKey(context.organizationId, channel);
      
      const enrichedMessage = {
        ...message,
        organizationId: context.organizationId,
        timestamp: new Date().toISOString(),
      };

      const subscriberCount = await this.redisService.publish(channelKey, enrichedMessage);
      this.logger.debug(`Published realtime message to ${subscriberCount} subscribers`);
      return subscriberCount;
    } catch (error) {
      this.logger.error(`Failed to publish realtime message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Subscribe to real-time messages
   * Use for: WebSocket connections, live dashboards, notifications
   */
  async subscribeToRealtimeMessages(
    context: TenantContext,
    channel: string,
    callback: (message: RealtimeMessage) => void
  ): Promise<void> {
    try {
      await this.tenantAwareService.validateTenantAccess(context, 'read', 'TenantChannel');

      const channelKey = this.getChannelKey(context.organizationId, channel);
      
      await this.redisService.subscribe(channelKey, (message: RealtimeMessage) => {
        // Additional tenant validation
        if (message.organizationId === context.organizationId) {
          callback(message);
        }
      });

      this.logger.debug(`Subscribed to realtime channel: ${channelKey}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to realtime messages: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // HYBRID PATTERNS (combining both approaches)
  // ============================================================================

  /**
   * Publish event to both stream (persistence) and pub/sub (real-time)
   * Use for: Critical events that need both persistence and immediate notification
   */
  async publishHybridEvent(
    context: TenantContext,
    eventType: string,
    payload: Record<string, any>,
    options: {
      persistToStream?: boolean;
      notifyRealtime?: boolean;
      streamName?: string;
      realtimeChannel?: string;
    } = {}
  ): Promise<{ streamMessageId?: string; subscriberCount?: number }> {
    const {
      persistToStream = true,
      notifyRealtime = true,
      streamName = 'events',
      realtimeChannel = 'notifications',
    } = options;

    const results: { streamMessageId?: string; subscriberCount?: number } = {};

    // Persist to stream for processing
    if (persistToStream) {
      results.streamMessageId = await this.addEventToStream(context, streamName, {
        eventType,
        payload,
        timestamp: new Date().toISOString(),
        organizationId: context.organizationId,
        userId: context.userId,
      });
    }

    // Notify real-time subscribers
    if (notifyRealtime) {
      results.subscriberCount = await this.publishRealtimeMessage(context, realtimeChannel, {
        type: eventType,
        data: payload,
        timestamp: new Date().toISOString(),
        organizationId: context.organizationId,
        userId: context.userId,
      });
    }

    return results;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getStreamKey(organizationId: string, streamName: string): string {
    return `tenant:${organizationId}:stream:${streamName}`;
  }

  private getChannelKey(organizationId: string, channel: string): string {
    return `tenant:${organizationId}:channel:${channel}`;
  }

  private async ensureConsumerGroup(streamKey: string, groupName: string): Promise<void> {
    try {
      await this.redisService.createConsumerGroup(streamKey, groupName, '0');
    } catch (error) {
      // Group already exists, which is fine
      if (!error.message?.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  /**
   * Get stream statistics for monitoring
   */
  async getStreamStats(context: TenantContext, streamName: string) {
    try {
      const streamKey = this.getStreamKey(context.organizationId, streamName);
      const groupInfo = await this.redisService.getConsumerGroupInfo(streamKey);
      
      return {
        streamKey,
        consumerGroups: groupInfo,
        totalMessages: await this.getStreamLength(streamKey),
      };
    } catch (error) {
      this.logger.error(`Failed to get stream stats: ${error.message}`);
      return null;
    }
  }

  private async getStreamLength(streamKey: string): Promise<number> {
    try {
      const result = await this.redisService.getRedisInstance().xLen(streamKey);
      return result;
    } catch (error) {
      return 0;
    }
  }
}

/**
 * USAGE PATTERNS:
 * 
 * 1. PERSISTENT EVENTS (Streams + Consumer Groups):
 *    - User actions that need processing
 *    - Workflow state changes
 *    - Audit logs
 *    - Integration webhooks
 * 
 * 2. REAL-TIME NOTIFICATIONS (Pub/Sub):
 *    - Live status updates
 *    - WebSocket broadcasts
 *    - User presence
 *    - System alerts
 * 
 * 3. HYBRID EVENTS:
 *    - Critical system events
 *    - User-generated content
 *    - State changes that need both persistence and real-time updates
 */
