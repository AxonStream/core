import { Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ForbiddenException } from '@nestjs/common';
import { Socket } from 'socket.io';
import { TenantAwareService, TenantContext } from './tenant-aware.service';

export interface TenantSocket extends Socket {
  tenantContext?: TenantContext;
  organizationId?: string;
  userId?: string;
  rateLimitCounter?: number;
  lastMessageTime?: number;
}

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  burstWindowMs?: number;
  enableBurstProtection?: boolean;
  logWarnings?: boolean;
}

/**
 * Unified rate limiting service
 * Consolidates rate limiting logic from guard and interceptor
 */
@Injectable()
export class TenantRateLimitService {
  private readonly logger = new Logger(TenantRateLimitService.name);

  constructor(
    private readonly tenantAwareService: TenantAwareService,
  ) { }

  /**
   * Socket-based rate limiting (guard style)
   * Uses in-memory counters attached to socket
   */
  async checkSocketRateLimit(
    socket: TenantSocket,
    context: TenantContext,
    options: RateLimitOptions = {}
  ): Promise<void> {
    const now = Date.now();
    const windowMs = options.windowMs || 60000; // 1 minute default
    const maxMessages = options.maxRequests || 100; // 100 messages per minute default

    if (!socket.rateLimitCounter) {
      socket.rateLimitCounter = 0;
      socket.lastMessageTime = now;
    }

    // Reset counter if window has passed
    if (now - socket.lastMessageTime > windowMs) {
      socket.rateLimitCounter = 0;
      socket.lastMessageTime = now;
    }

    socket.rateLimitCounter++;

    if (socket.rateLimitCounter > maxMessages) {
      // Log audit event
      await this.tenantAwareService.logAuditEvent(
        context,
        'RATE_LIMIT_EXCEEDED',
        'Connection',
        socket.id,
        null,
        {
          messageCount: socket.rateLimitCounter,
          windowMs,
          maxMessages,
          type: 'socket'
        }
      );

      throw new WsException('Rate limit exceeded');
    }

    // Log warning at 80% threshold
    if (options.logWarnings && socket.rateLimitCounter > maxMessages * 0.8) {
      this.logger.warn(
        `Socket rate limit warning for tenant ${context.organizationId}: ${socket.rateLimitCounter}/${maxMessages} (80% threshold)`
      );
    }
  }

  /**
   * Redis-based distributed rate limiting (interceptor style)
   * Uses Redis for distributed rate limiting with burst protection
   */
  async checkRedisRateLimit(
    context: TenantContext,
    options: RateLimitOptions = {}
  ): Promise<void> {
    try {
      const redis = this.tenantAwareService['redisService'].getRedisInstance();
      const now = Date.now();
      const windowMs = options.windowMs || 60000; // 1 minute default
      const burstWindowMs = options.burstWindowMs || 10000; // 10 second burst window

      // Get tenant limits
      const limits = await this.tenantAwareService.getTenantLimits(context.organizationId);
      const maxMessagesPerMinute = limits.maxApiCalls || options.maxRequests || 100;
      const maxBurstMessages = Math.ceil(maxMessagesPerMinute / 6); // Allow 1/6 of minute limit in 10 seconds

      // Sliding window rate limiting
      const windowKey = `tenant:${context.organizationId}:ws_messages:${Math.floor(now / windowMs)}`;
      const burstKey = `tenant:${context.organizationId}:ws_burst:${Math.floor(now / burstWindowMs)}`;

      // Use Redis pipeline for atomic operations
      const pipeline = redis.multi();
      pipeline.incr(windowKey);
      pipeline.expire(windowKey, Math.ceil(windowMs / 1000) * 2); // 2x window for overlap

      if (options.enableBurstProtection !== false) {
        pipeline.incr(burstKey);
        pipeline.expire(burstKey, Math.ceil(burstWindowMs / 1000) * 2);
      }

      const results = await pipeline.exec();
      const windowCount = results[0][1] as number;
      const burstCount = options.enableBurstProtection !== false ? results[2][1] as number : 0;

      // Check burst limit first (more restrictive)
      if (options.enableBurstProtection !== false && burstCount > maxBurstMessages) {
        this.logger.warn(`Burst rate limit exceeded for tenant ${context.organizationId}: ${burstCount}/${maxBurstMessages}`);
        throw new WsException('Message burst rate limit exceeded. Please slow down.');
      }

      // Check window limit
      if (windowCount > maxMessagesPerMinute) {
        this.logger.warn(`Rate limit exceeded for tenant ${context.organizationId}: ${windowCount}/${maxMessagesPerMinute}`);
        throw new WsException('Message rate limit exceeded. Please try again later.');
      }

      // Log rate limiting metrics for monitoring
      if (options.logWarnings && windowCount > maxMessagesPerMinute * 0.8) {
        this.logger.warn(
          `Redis rate limit warning for tenant ${context.organizationId}: ${windowCount}/${maxMessagesPerMinute} (80% threshold)`
        );
      }

    } catch (error) {
      if (error instanceof WsException) {
        throw error;
      }
      this.logger.error(`Redis rate limiting failed: ${error.message}`);
      // Fall back to allowing the request if Redis fails
    }
  }

  /**
   * HTTP API rate limiting (middleware style)
   */
  async checkHttpRateLimit(
    context: TenantContext,
    options: RateLimitOptions = {}
  ): Promise<void> {
    try {
      // Use the tenant-aware service's built-in rate limiting
      await this.tenantAwareService.incrementApiCallCount(context.organizationId);

      // Additional custom rate limiting can be added here if needed
      const limits = await this.tenantAwareService.getTenantLimits(context.organizationId);
      const maxApiCalls = limits.maxApiCalls || options.maxRequests || 1000; // Higher default for HTTP

      // This is a simplified check - the tenantAwareService.incrementApiCallCount 
      // should handle the actual rate limiting logic

    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`HTTP rate limiting failed: ${error.message}`);
      throw new ForbiddenException('API rate limit exceeded');
    }
  }

  /**
   * Get current rate limit status for a tenant
   */
  async getRateLimitStatus(context: TenantContext): Promise<{
    windowCount: number;
    burstCount: number;
    limits: any;
    remaining: number;
  }> {
    try {
      const redis = this.tenantAwareService['redisService'].getRedisInstance();
      const now = Date.now();
      const windowMs = 60000;
      const burstWindowMs = 10000;

      const windowKey = `tenant:${context.organizationId}:ws_messages:${Math.floor(now / windowMs)}`;
      const burstKey = `tenant:${context.organizationId}:ws_burst:${Math.floor(now / burstWindowMs)}`;

      const [windowCount, burstCount] = await Promise.all([
        redis.get(windowKey).then((val: string | null) => parseInt(val || '0')),
        redis.get(burstKey).then((val: string | null) => parseInt(val || '0'))
      ]);

      const limits = await this.tenantAwareService.getTenantLimits(context.organizationId);
      const maxRequests = limits.maxApiCalls || 100;

      return {
        windowCount,
        burstCount,
        limits,
        remaining: Math.max(0, maxRequests - windowCount)
      };

    } catch (error) {
      this.logger.error(`Failed to get rate limit status: ${error.message}`);
      return {
        windowCount: 0,
        burstCount: 0,
        limits: {},
        remaining: 100
      };
    }
  }
}
