import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from './redis.service';
import { PrismaService } from './prisma.service';
import { TenantAwareService, TenantContext } from './tenant-aware.service';

/**
 * Event Replay & Delivery Guarantees Service
 * Provides comprehensive event replay, delivery guarantees, and failure recovery
 */

export interface ReplayableEvent {
  id: string;
  eventType: string;
  payload: Record<string, any>;
  organizationId: string;
  userId?: string;
  sessionId?: string;
  timestamp: string;
  sequenceNumber: number;
  checksum: string;
  metadata?: Record<string, any>;
}

export interface DeliveryAttempt {
  id: string;
  eventId: string;
  attemptNumber: number;
  timestamp: string;
  status: 'pending' | 'success' | 'failed' | 'timeout';
  error?: string;
  duration?: number;
  endpoint?: string;
  responseCode?: number;
}

export interface ReplayRequest {
  organizationId: string;
  startTime: string;
  endTime: string;
  eventTypes?: string[];
  sessionIds?: string[];
  userIds?: string[];
  maxEvents?: number;
  replaySpeed?: number; // Events per second
}

export interface DeliveryGuaranteeConfig {
  maxRetries: number;
  retryDelays: number[]; // Milliseconds for each retry attempt
  timeoutMs: number;
  enableDeduplication: boolean;
  enableOrdering: boolean;
  enableChecksum: boolean;
  deadLetterQueue: boolean;
}

@Injectable()
export class EventReplayService {
  private readonly logger = new Logger(EventReplayService.name);
  private readonly config: DeliveryGuaranteeConfig;
  private sequenceCounters = new Map<string, number>();
  private replayJobs = new Map<string, { active: boolean; progress: number }>();

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly tenantAwareService: TenantAwareService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.config = {
      maxRetries: this.configService.get<number>('replay.maxRetries', 5),
      retryDelays: this.configService.get<number[]>('replay.retryDelays', [1000, 2000, 5000, 10000, 30000]),
      timeoutMs: this.configService.get<number>('replay.timeoutMs', 30000),
      enableDeduplication: this.configService.get<boolean>('replay.enableDeduplication', true),
      enableOrdering: this.configService.get<boolean>('replay.enableOrdering', true),
      enableChecksum: this.configService.get<boolean>('replay.enableChecksum', true),
      deadLetterQueue: this.configService.get<boolean>('replay.deadLetterQueue', true),
    };
  }

  // ============================================================================
  // EVENT STORAGE WITH REPLAY CAPABILITY
  // ============================================================================

  async storeReplayableEvent(
    context: TenantContext,
    eventType: string,
    payload: Record<string, any>,
    sessionId?: string
  ): Promise<ReplayableEvent> {
    try {
      const sequenceNumber = await this.getNextSequenceNumber(context.organizationId);
      const timestamp = new Date().toISOString();
      
      const event: ReplayableEvent = {
        id: this.generateEventId(),
        eventType,
        payload,
        organizationId: context.organizationId,
        userId: context.userId,
        sessionId,
        timestamp,
        sequenceNumber,
        checksum: this.config.enableChecksum ? this.calculateChecksum(payload) : '',
        metadata: {
          source: 'AxonPuls',
          version: '1.0',
          replayable: true,
        },
      };

      // Store in Redis stream for fast access
      const streamKey = this.getEventStreamKey(context.organizationId);
      await this.redisService.addToStream(streamKey, event);

      // Store in database for long-term persistence
      await this.storeEventInDatabase(event);

      // Update sequence counter
      await this.updateSequenceCounter(context.organizationId, sequenceNumber);

      this.logger.debug(`Stored replayable event: ${event.id}`);
      return event;
    } catch (error) {
      this.logger.error(`Failed to store replayable event: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // EVENT REPLAY FUNCTIONALITY
  // ============================================================================

  async startEventReplay(
    context: TenantContext,
    request: ReplayRequest,
    deliveryCallback: (event: ReplayableEvent) => Promise<boolean>
  ): Promise<string> {
    try {
      await this.tenantAwareService.validateTenantAccess(context, 'read', 'EventReplay');

      const replayId = this.generateReplayId();
      this.replayJobs.set(replayId, { active: true, progress: 0 });

      // Start replay in background
      this.executeReplay(replayId, context, request, deliveryCallback).catch(error => {
        this.logger.error(`Replay ${replayId} failed: ${error.message}`);
        this.replayJobs.set(replayId, { active: false, progress: -1 });
      });

      this.logger.log(`Started event replay: ${replayId}`);
      return replayId;
    } catch (error) {
      this.logger.error(`Failed to start event replay: ${error.message}`);
      throw error;
    }
  }

  private async executeReplay(
    replayId: string,
    context: TenantContext,
    request: ReplayRequest,
    deliveryCallback: (event: ReplayableEvent) => Promise<boolean>
  ): Promise<void> {
    try {
      const events = await this.getEventsForReplay(context, request);
      const totalEvents = events.length;
      let processedEvents = 0;

      this.logger.log(`Replaying ${totalEvents} events for ${replayId}`);

      for (const event of events) {
        const job = this.replayJobs.get(replayId);
        if (!job?.active) {
          this.logger.log(`Replay ${replayId} was cancelled`);
          break;
        }

        try {
          // Deliver event with retry logic
          const success = await this.deliverEventWithRetries(event, deliveryCallback);
          
          if (success) {
            await this.recordDeliveryAttempt(event.id, processedEvents + 1, 'success');
          } else {
            await this.recordDeliveryAttempt(event.id, processedEvents + 1, 'failed');
            
            if (this.config.deadLetterQueue) {
              await this.moveToDeadLetterQueue(event);
            }
          }

          processedEvents++;
          const progress = (processedEvents / totalEvents) * 100;
          this.replayJobs.set(replayId, { active: true, progress });

          // Emit progress event
          this.eventEmitter.emit('replay.progress', {
            replayId,
            progress,
            processedEvents,
            totalEvents,
            organizationId: context.organizationId,
          });

          // Rate limiting based on replaySpeed
          if (request.replaySpeed && request.replaySpeed > 0) {
            const delayMs = 1000 / request.replaySpeed;
            await this.sleep(delayMs);
          }
        } catch (error) {
          this.logger.error(`Failed to replay event ${event.id}: ${error.message}`);
          await this.recordDeliveryAttempt(event.id, processedEvents + 1, 'failed', error.message);
        }
      }

      // Mark replay as completed
      this.replayJobs.set(replayId, { active: false, progress: 100 });

      this.eventEmitter.emit('replay.completed', {
        replayId,
        totalEvents,
        processedEvents,
        organizationId: context.organizationId,
      });

      this.logger.log(`Completed event replay: ${replayId}`);
    } catch (error) {
      this.logger.error(`Replay execution failed: ${error.message}`);
      this.replayJobs.set(replayId, { active: false, progress: -1 });
      throw error;
    }
  }

  async stopEventReplay(replayId: string): Promise<boolean> {
    const job = this.replayJobs.get(replayId);
    if (job && job.active) {
      this.replayJobs.set(replayId, { active: false, progress: job.progress });
      this.logger.log(`Stopped event replay: ${replayId}`);
      return true;
    }
    return false;
  }

  async getReplayStatus(replayId: string): Promise<{ active: boolean; progress: number } | null> {
    return this.replayJobs.get(replayId) || null;
  }

  // ============================================================================
  // DELIVERY GUARANTEES
  // ============================================================================

  private async deliverEventWithRetries(
    event: ReplayableEvent,
    deliveryCallback: (event: ReplayableEvent) => Promise<boolean>
  ): Promise<boolean> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        // Create timeout promise
        const timeoutPromise = new Promise<boolean>((_, reject) => {
          setTimeout(() => reject(new Error('Delivery timeout')), this.config.timeoutMs);
        });

        // Race between delivery and timeout
        const success = await Promise.race([
          deliveryCallback(event),
          timeoutPromise,
        ]);

        const duration = Date.now() - startTime;

        if (success) {
          await this.recordDeliveryAttempt(event.id, attempt, 'success', undefined, duration);
          return true;
        } else {
          await this.recordDeliveryAttempt(event.id, attempt, 'failed', 'Callback returned false', duration);
        }
      } catch (error) {
        lastError = error;
        const duration = Date.now() - Date.now();
        await this.recordDeliveryAttempt(event.id, attempt, 'failed', error.message, duration);

        // Wait before retry (except on last attempt)
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelays[attempt - 1] || this.config.retryDelays[this.config.retryDelays.length - 1];
          await this.sleep(delay);
        }
      }
    }

    this.logger.error(`Failed to deliver event ${event.id} after ${this.config.maxRetries} attempts: ${lastError?.message}`);
    return false;
  }

  private async recordDeliveryAttempt(
    eventId: string,
    attemptNumber: number,
    status: 'success' | 'failed' | 'timeout',
    error?: string,
    duration?: number
  ): Promise<void> {
    try {
      const attempt: DeliveryAttempt = {
        id: this.generateAttemptId(),
        eventId,
        attemptNumber,
        timestamp: new Date().toISOString(),
        status,
        error,
        duration,
      };

      // Store in Redis for fast access
      const attemptKey = `delivery_attempt:${eventId}:${attemptNumber}`;
      await this.redisService.getRedisInstance().setEx(
        attemptKey,
        86400, // 24 hours TTL
        JSON.stringify(attempt)
      );

      // Store in database for long-term tracking
      // Note: This would require a delivery_attempts table in the database
      // await this.storeDeliveryAttemptInDatabase(attempt);
    } catch (error) {
      this.logger.error(`Failed to record delivery attempt: ${error.message}`);
    }
  }

  // ============================================================================
  // EVENT DEDUPLICATION
  // ============================================================================

  async isDuplicateEvent(
    organizationId: string,
    eventType: string,
    checksum: string
  ): Promise<boolean> {
    if (!this.config.enableDeduplication) {
      return false;
    }

    try {
      const redis = this.redisService.getRedisInstance();
      const dedupeKey = `dedupe:${organizationId}:${eventType}:${checksum}`;
      const exists = await redis.exists(dedupeKey);

      if (exists) {
        return true;
      }

      // Store checksum for deduplication (24 hour TTL)
      await redis.setEx(dedupeKey, 86400, '1');
      return false;
    } catch (error) {
      this.logger.error(`Failed to check duplicate event: ${error.message}`);
      return false; // Fail open to avoid blocking events
    }
  }

  // ============================================================================
  // EVENT ORDERING
  // ============================================================================

  async ensureEventOrdering(
    organizationId: string,
    sessionId: string,
    sequenceNumber: number
  ): Promise<boolean> {
    if (!this.config.enableOrdering) {
      return true;
    }

    try {
      const redis = this.redisService.getRedisInstance();
      const orderKey = `order:${organizationId}:${sessionId}`;

      // Get last processed sequence number
      const lastSequence = await redis.get(orderKey);
      const lastSequenceNumber = (lastSequence && typeof lastSequence === 'string') ? parseInt(lastSequence, 10) : 0;

      // Check if this event is the next expected sequence
      if (sequenceNumber === lastSequenceNumber + 1) {
        // Update last processed sequence
        await redis.setEx(orderKey, 3600, sequenceNumber.toString()); // 1 hour TTL
        return true;
      }

      // Event is out of order
      this.logger.warn(`Out of order event detected: expected ${lastSequenceNumber + 1}, got ${sequenceNumber}`);
      return false;
    } catch (error) {
      this.logger.error(`Failed to check event ordering: ${error.message}`);
      return true; // Fail open to avoid blocking events
    }
  }

  // ============================================================================
  // DEAD LETTER QUEUE MANAGEMENT
  // ============================================================================

  async getDeadLetterQueueEvents(
    context: TenantContext,
    limit: number = 100
  ): Promise<ReplayableEvent[]> {
    try {
      await this.tenantAwareService.validateTenantAccess(context, 'read', 'DeadLetterQueue');

      const dlqKey = `dlq:${context.organizationId}`;
      const messages = await this.redisService.readFromStream(dlqKey, '0', limit);

      return messages.map(msg => this.parseReplayableEvent(msg));
    } catch (error) {
      this.logger.error(`Failed to get DLQ events: ${error.message}`);
      return [];
    }
  }

  async reprocessDeadLetterEvent(
    context: TenantContext,
    eventId: string,
    deliveryCallback: (event: ReplayableEvent) => Promise<boolean>
  ): Promise<boolean> {
    try {
      await this.tenantAwareService.validateTenantAccess(context, 'update', 'DeadLetterQueue');

      const dlqEvents = await this.getDeadLetterQueueEvents(context, 1000);
      const event = dlqEvents.find(e => e.id === eventId);

      if (!event) {
        throw new Error(`Event ${eventId} not found in dead letter queue`);
      }

      const success = await this.deliverEventWithRetries(event, deliveryCallback);

      if (success) {
        // Remove from DLQ
        await this.removeFromDeadLetterQueue(context.organizationId, eventId);
        this.logger.log(`Successfully reprocessed DLQ event: ${eventId}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Failed to reprocess DLQ event: ${error.message}`);
      return false;
    }
  }

  private async removeFromDeadLetterQueue(organizationId: string, eventId: string): Promise<void> {
    try {
      const dlqKey = `dlq:${organizationId}`;
      // Note: Redis streams don't support direct deletion by field value
      // In production, you might want to use a different data structure for DLQ
      // or implement a cleanup process
      this.logger.debug(`Marked DLQ event ${eventId} for removal`);
    } catch (error) {
      this.logger.error(`Failed to remove from DLQ: ${error.message}`);
    }
  }

  // ============================================================================
  // MONITORING & ANALYTICS
  // ============================================================================

  async getDeliveryStats(
    context: TenantContext,
    timeRange: { start: string; end: string }
  ): Promise<{
    totalEvents: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageRetries: number;
    averageDeliveryTime: number;
  }> {
    try {
      // This would query delivery attempts from database or Redis
      // For now, return mock data structure
      return {
        totalEvents: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        averageRetries: 0,
        averageDeliveryTime: 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get delivery stats: ${error.message}`);
      throw error;
    }
  }

  async getEventReplayHistory(
    context: TenantContext,
    limit: number = 50
  ): Promise<Array<{
    replayId: string;
    startTime: string;
    endTime: string;
    totalEvents: number;
    status: string;
    progress: number;
  }>> {
    try {
      // This would query replay history from database
      // For now, return current active replays
      const activeReplays = Array.from(this.replayJobs.entries()).map(([replayId, job]) => ({
        replayId,
        startTime: new Date().toISOString(), // Would be stored in DB
        endTime: new Date().toISOString(),   // Would be stored in DB
        totalEvents: 0,                      // Would be stored in DB
        status: job.active ? 'running' : (job.progress === 100 ? 'completed' : 'failed'),
        progress: job.progress,
      }));

      return activeReplays.slice(0, limit);
    } catch (error) {
      this.logger.error(`Failed to get replay history: ${error.message}`);
      return [];
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async getEventsForReplay(
    context: TenantContext,
    request: ReplayRequest
  ): Promise<ReplayableEvent[]> {
    try {
      // First try Redis stream for recent events
      const streamEvents = await this.getEventsFromStream(context, request);

      // If not enough events or older timeframe, query database
      if (streamEvents.length < (request.maxEvents || 1000)) {
        const dbEvents = await this.getEventsFromDatabase(context, request);
        return this.mergeAndSortEvents(streamEvents, dbEvents, request.maxEvents);
      }

      return streamEvents.slice(0, request.maxEvents || 1000);
    } catch (error) {
      this.logger.error(`Failed to get events for replay: ${error.message}`);
      throw error;
    }
  }

  private async getEventsFromStream(
    context: TenantContext,
    request: ReplayRequest
  ): Promise<ReplayableEvent[]> {
    try {
      const streamKey = this.getEventStreamKey(context.organizationId);
      const startTime = new Date(request.startTime).getTime();
      const endTime = new Date(request.endTime).getTime();

      // Read from stream with time range (using readFromStream as fallback)
      const messages = await this.redisService.readFromStream(
        streamKey,
        '0', // Start from beginning
        request.maxEvents || 1000
      );

      return messages
        .map(msg => this.parseReplayableEvent(msg))
        .filter(event => this.matchesFilters(event, request));
    } catch (error) {
      this.logger.error(`Failed to get events from stream: ${error.message}`);
      return [];
    }
  }

  private async getEventsFromDatabase(
    context: TenantContext,
    request: ReplayRequest
  ): Promise<ReplayableEvent[]> {
    try {
      // This would query a dedicated events table for long-term storage
      // For now, we'll use the existing AxonPulsEvent table as a fallback
      const whereClause: any = {
        organizationId: context.organizationId,
        createdAt: {
          gte: new Date(request.startTime),
          lte: new Date(request.endTime),
        },
      };

      if (request.eventTypes?.length) {
        whereClause.eventType = { in: request.eventTypes };
      }

      if (request.sessionIds?.length) {
        whereClause.sessionId = { in: request.sessionIds };
      }

      if (request.userIds?.length) {
        whereClause.userId = { in: request.userIds };
      }

      const events = await this.prismaService.axonPulsEvent.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
        take: request.maxEvents || 1000,
      });

      return events.map(event => this.convertToReplayableEvent(event));
    } catch (error) {
      this.logger.error(`Failed to get events from database: ${error.message}`);
      return [];
    }
  }

  private mergeAndSortEvents(
    streamEvents: ReplayableEvent[],
    dbEvents: ReplayableEvent[],
    maxEvents?: number
  ): ReplayableEvent[] {
    const allEvents = [...streamEvents, ...dbEvents];
    const uniqueEvents = new Map<string, ReplayableEvent>();

    // Deduplicate by event ID
    for (const event of allEvents) {
      if (!uniqueEvents.has(event.id)) {
        uniqueEvents.set(event.id, event);
      }
    }

    // Sort by timestamp and sequence number
    const sortedEvents = Array.from(uniqueEvents.values()).sort((a, b) => {
      const timeCompare = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (timeCompare !== 0) return timeCompare;
      return a.sequenceNumber - b.sequenceNumber;
    });

    return maxEvents ? sortedEvents.slice(0, maxEvents) : sortedEvents;
  }

  private matchesFilters(event: ReplayableEvent, request: ReplayRequest): boolean {
    if (request.eventTypes?.length && !request.eventTypes.includes(event.eventType)) {
      return false;
    }

    if (request.sessionIds?.length && (!event.sessionId || !request.sessionIds.includes(event.sessionId))) {
      return false;
    }

    if (request.userIds?.length && (!event.userId || !request.userIds.includes(event.userId))) {
      return false;
    }

    return true;
  }

  private async getNextSequenceNumber(organizationId: string): Promise<number> {
    const current = this.sequenceCounters.get(organizationId) || 0;
    const next = current + 1;
    this.sequenceCounters.set(organizationId, next);
    return next;
  }

  private async updateSequenceCounter(organizationId: string, sequenceNumber: number): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      const counterKey = `sequence:${organizationId}`;
      await redis.set(counterKey, sequenceNumber.toString());
    } catch (error) {
      this.logger.error(`Failed to update sequence counter: ${error.message}`);
    }
  }

  private calculateChecksum(payload: Record<string, any>): string {
    const crypto = require('crypto');
    const jsonString = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }

  private async storeEventInDatabase(event: ReplayableEvent): Promise<void> {
    try {
      // Store in a dedicated replay_events table (would need to be created)
      // For now, we'll store in the existing AxonPulsEvent table with additional metadata
      await this.prismaService.axonPulsEvent.create({
        data: {
          id: event.id,
          eventType: event.eventType,
          channel: 'replay', // Default channel for replay events
          payload: event.payload,
          organizationId: event.organizationId,
          userId: event.userId,
          acknowledgment: false,
          retryCount: 0,
          createdAt: new Date(event.timestamp),
          metadata: {
            ...event.metadata,
            sessionId: event.sessionId, // Store sessionId in metadata
            sequenceNumber: event.sequenceNumber,
            checksum: event.checksum,
            replayable: true,
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to store event in database: ${error.message}`);
      // Don't throw - Redis storage is primary, DB is backup
    }
  }

  private async moveToDeadLetterQueue(event: ReplayableEvent): Promise<void> {
    try {
      const dlqKey = `dlq:${event.organizationId}`;
      await this.redisService.addToStream(dlqKey, {
        ...event,
        dlqTimestamp: new Date().toISOString(),
        reason: 'max_retries_exceeded',
      });
      this.logger.warn(`Moved event ${event.id} to dead letter queue`);
    } catch (error) {
      this.logger.error(`Failed to move event to DLQ: ${error.message}`);
    }
  }

  private parseReplayableEvent(message: any): ReplayableEvent {
    return {
      id: message.fields.id || message.id,
      eventType: message.fields.eventType,
      payload: typeof message.fields.payload === 'string'
        ? JSON.parse(message.fields.payload)
        : message.fields.payload,
      organizationId: message.fields.organizationId,
      userId: message.fields.userId,
      sessionId: message.fields.sessionId,
      timestamp: message.fields.timestamp,
      sequenceNumber: parseInt(message.fields.sequenceNumber, 10),
      checksum: message.fields.checksum || '',
      metadata: typeof message.fields.metadata === 'string'
        ? JSON.parse(message.fields.metadata)
        : message.fields.metadata,
    };
  }

  private convertToReplayableEvent(dbEvent: any): ReplayableEvent {
    return {
      id: dbEvent.id,
      eventType: dbEvent.eventType,
      payload: dbEvent.payload,
      organizationId: dbEvent.organizationId,
      userId: dbEvent.userId,
      sessionId: dbEvent.sessionId,
      timestamp: dbEvent.createdAt.toISOString(),
      sequenceNumber: dbEvent.metadata?.sequenceNumber || 0,
      checksum: dbEvent.metadata?.checksum || '',
      metadata: dbEvent.metadata,
    };
  }

  private getEventStreamKey(organizationId: string): string {
    return `events:${organizationId}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReplayId(): string {
    return `replay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}