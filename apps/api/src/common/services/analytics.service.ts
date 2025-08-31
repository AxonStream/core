import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from './redis.service';
import { PrismaService } from './prisma.service';


/**
 * Comprehensive Analytics Service
 * Provides business intelligence, usage analytics, and performance insights
 */

export interface UsageMetrics {
  organizationId: string;
  timeRange: { start: Date; end: Date };
  totalEvents: number;
  totalConnections: number;
  totalChannels: number;
  totalUsers: number;
  averageSessionDuration: number;
  peakConcurrentConnections: number;
  dataTransferred: number; // bytes
  apiCalls: number;
  errorRate: number;
  uptime: number; // percentage
}

export interface EventAnalytics {
  eventType: string;
  count: number;
  averageSize: number;
  successRate: number;
  averageProcessingTime: number;
  peakHour: number;
  topChannels: Array<{ channel: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

export interface ConnectionAnalytics {
  totalConnections: number;
  activeConnections: number;
  averageConnectionDuration: number;
  connectionsByQuality: Record<string, number>;
  connectionsByRegion: Record<string, number>;
  reconnectionRate: number;
  topUserAgents: Array<{ userAgent: string; count: number }>;
  peakConcurrency: { timestamp: Date; count: number };
}

export interface BusinessMetrics {
  organizationId: string;
  timeRange: { start: Date; end: Date };
  revenue: number;
  costs: number;
  profit: number;
  customerCount: number;
  churnRate: number;
  growthRate: number;
  averageRevenuePerUser: number;
  customerLifetimeValue: number;
  conversionRate: number;
}

export interface PerformanceInsights {
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  availability: number;
  bottlenecks: Array<{
    component: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
  }>;
  trends: Array<{
    metric: string;
    direction: 'up' | 'down' | 'stable';
    change: number;
    period: string;
  }>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly enableRealTimeAnalytics: boolean;
  private readonly retentionDays: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.enableRealTimeAnalytics = this.configService.get<boolean>('analytics.enableRealTime', true);
    this.retentionDays = this.configService.get<number>('analytics.retentionDays', 365);
  }

  // ============================================================================
  // USAGE ANALYTICS
  // ============================================================================

  async getUsageMetrics(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<UsageMetrics> {
    try {
      const [
        eventCount,
        connectionStats,
        channelCount,
        userCount,
        sessionData,
        apiCallCount,
        errorData
      ] = await Promise.all([
        this.getEventCount(organizationId, timeRange),
        this.getConnectionStats(organizationId, timeRange),
        this.getChannelCount(organizationId, timeRange),
        this.getUserCount(organizationId, timeRange),
        this.getSessionData(organizationId, timeRange),
        this.getApiCallCount(organizationId, timeRange),
        this.getErrorData(organizationId, timeRange),
      ]);

      return {
        organizationId,
        timeRange,
        totalEvents: eventCount,
        totalConnections: connectionStats.current,
        totalChannels: channelCount,
        totalUsers: userCount,
        averageSessionDuration: sessionData.averageDuration,
        peakConcurrentConnections: connectionStats.peak,
        dataTransferred: await this.getDataTransferred(organizationId, timeRange),
        apiCalls: apiCallCount,
        errorRate: errorData.rate,
        uptime: await this.getUptime(organizationId, timeRange),
      };
    } catch (error) {
      this.logger.error(`Failed to get usage metrics: ${error.message}`);
      throw error;
    }
  }

  async getEventAnalytics(
    organizationId: string,
    timeRange: { start: Date; end: Date },
    eventType?: string
  ): Promise<EventAnalytics[]> {
    try {
      // Get events from database
      const whereClause: any = {
        organizationId,
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      };

      if (eventType) {
        whereClause.eventType = eventType;
      }

      const events = await this.prismaService.axonPulsEvent.findMany({
        where: whereClause,
        select: {
          eventType: true,
          payload: true,
          channel: true,
          userId: true,
          createdAt: true,
          acknowledgment: true,
        },
      });

      // Define the type for selected event fields
      type SelectedEvent = {
        eventType: string;
        payload: any;
        channel: string;
        userId: string | null;
        createdAt: Date;
        acknowledgment: boolean;
      };

      // Group by event type
      const eventGroups = events.reduce((acc, event) => {
        if (!acc[event.eventType]) {
          acc[event.eventType] = [];
        }
        acc[event.eventType].push(event);
        return acc;
      }, {} as Record<string, SelectedEvent[]>);

      // Calculate analytics for each event type
      const analytics: EventAnalytics[] = [];

      for (const [type, typeEventsUnknown] of Object.entries(eventGroups)) {
        const typeEvents = typeEventsUnknown as SelectedEvent[];
        const count = typeEvents.length;
        const averageSize = typeEvents.reduce((sum: number, event: SelectedEvent) =>
          sum + JSON.stringify(event.payload).length, 0) / count;
        const successRate = typeEvents.filter((event: SelectedEvent) => event.acknowledgment).length / count;

        // Calculate peak hour
        const hourCounts = new Array(24).fill(0);
        typeEvents.forEach((event: SelectedEvent) => {
          const hour = new Date(event.createdAt).getHours();
          hourCounts[hour]++;
        });
        const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

        // Top channels
        const channelCounts = typeEvents.reduce((acc, event: SelectedEvent) => {
          acc[event.channel] = (acc[event.channel] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const topChannels = Object.entries(channelCounts)
          .map(([channel, count]) => ({ channel, count: count as number }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Top users
        const userCounts = typeEvents.reduce((acc, event: SelectedEvent) => {
          if (event.userId) {
            acc[event.userId] = (acc[event.userId] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        const topUsers = Object.entries(userCounts)
          .map(([userId, count]) => ({ userId, count: count as number }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        analytics.push({
          eventType: type,
          count,
          averageSize: Math.round(averageSize),
          successRate: Math.round(successRate * 100) / 100,
          averageProcessingTime: 0, // Would need to track processing times
          peakHour,
          topChannels,
          topUsers,
        });
      }

      return analytics.sort((a, b) => b.count - a.count);
    } catch (error) {
      this.logger.error(`Failed to get event analytics: ${error.message}`);
      return [];
    }
  }

  async getConnectionAnalytics(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<ConnectionAnalytics> {
    try {
      // Get connection data from database
      const connections = await this.prismaService.axonPulsConnection.findMany({
        where: {
          organizationId,
          connectedAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
        select: {
          id: true,
          status: true,
          connectedAt: true,
          lastHeartbeat: true,
          metadata: true,
        },
      });

      const totalConnections = connections.length;
      const activeConnections = connections.filter(conn => conn.status === 'CONNECTED').length;

      // Calculate average connection duration
      const durations = connections
        .filter(conn => conn.lastHeartbeat)
        .map(conn => {
          const start = new Date(conn.connectedAt).getTime();
          const end = new Date(conn.lastHeartbeat!).getTime();
          return end - start;
        });

      const averageConnectionDuration = durations.length > 0
        ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
        : 0;

      // Connections by quality (simplified - using status as proxy)
      const connectionsByQuality = connections.reduce((acc, conn) => {
        const quality = conn.status === 'CONNECTED' ? 'excellent' : 'poor';
        acc[quality] = (acc[quality] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Connections by region (from metadata)
      const connectionsByRegion = connections.reduce((acc, conn) => {
        const metadata = conn.metadata as any;
        const region = metadata?.region || 'unknown';
        acc[region] = (acc[region] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Top user agents
      const userAgentCounts = connections.reduce((acc, conn) => {
        const metadata = conn.metadata as any;
        const userAgent = metadata?.userAgent || 'unknown';
        acc[userAgent] = (acc[userAgent] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topUserAgents = Object.entries(userAgentCounts)
        .map(([userAgent, count]) => ({ userAgent, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalConnections,
        activeConnections,
        averageConnectionDuration: Math.round(averageConnectionDuration / 1000), // Convert to seconds
        connectionsByQuality,
        connectionsByRegion,
        reconnectionRate: 0, // Would need to track reconnections
        topUserAgents,
        peakConcurrency: { timestamp: new Date(), count: activeConnections }, // Simplified
      };
    } catch (error) {
      this.logger.error(`Failed to get connection analytics: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // PERFORMANCE INSIGHTS
  // ============================================================================

  async getPerformanceInsights(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<PerformanceInsights> {
    try {
      // Get performance data from Redis and other sources
      const [latencyData, throughputData, errorData, availabilityData] = await Promise.all([
        this.getLatencyData(organizationId, timeRange),
        this.getThroughputData(organizationId, timeRange),
        this.getErrorData(organizationId, timeRange),
        this.getAvailabilityData(organizationId, timeRange),
      ]);

      // Identify bottlenecks
      const bottlenecks = await this.identifyBottlenecks(organizationId, timeRange);

      // Calculate trends
      const trends = await this.calculateTrends(organizationId, timeRange);

      return {
        averageLatency: latencyData.average,
        p95Latency: latencyData.p95,
        p99Latency: latencyData.p99,
        throughput: throughputData.average,
        errorRate: errorData.rate,
        availability: availabilityData.percentage,
        bottlenecks,
        trends,
      };
    } catch (error) {
      this.logger.error(`Failed to get performance insights: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // REAL-TIME ANALYTICS
  // ============================================================================

  async collectEventMetrics(
    organizationId: string,
    eventType: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    if (!this.enableRealTimeAnalytics) return;

    try {
      const redis = this.redisService.getRedisInstance();
      const timestamp = Date.now();

      // Increment counters
      const hourKey = `analytics:${organizationId}:events:${Math.floor(timestamp / 3600000)}`;
      await redis.hIncrBy(hourKey, eventType, 1);
      await redis.expire(hourKey, this.retentionDays * 24 * 60 * 60);

      // Store event details for real-time processing
      const eventKey = `analytics:${organizationId}:event:${timestamp}:${Math.random().toString(36).substring(2, 11)}`;
      await redis.setEx(eventKey, 3600, JSON.stringify({
        eventType,
        timestamp,
        metadata,
      }));

      // Emit real-time event
      this.eventEmitter.emit('event.metrics.collected', {
        organizationId,
        eventType,
        timestamp,
        metadata,
      });
    } catch (error) {
      this.logger.error(`Failed to collect event metrics: ${error.message}`);
    }
  }

  async collectConnectionMetrics(
    organizationId: string,
    action: 'connect' | 'disconnect',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    if (!this.enableRealTimeAnalytics) return;

    try {
      const redis = this.redisService.getRedisInstance();
      const timestamp = Date.now();

      // Update connection counters
      const hourKey = `analytics:${organizationId}:connections:${Math.floor(timestamp / 3600000)}`;
      await redis.hIncrBy(hourKey, action, 1);
      await redis.expire(hourKey, this.retentionDays * 24 * 60 * 60);

      // Update current connection count
      const currentKey = `analytics:${organizationId}:current_connections`;
      if (action === 'connect') {
        await redis.incr(currentKey);
      } else {
        await redis.decr(currentKey);
      }

      // Emit real-time event
      this.eventEmitter.emit('connection.metrics.collected', {
        organizationId,
        action,
        timestamp,
        metadata,
      });
    } catch (error) {
      this.logger.error(`Failed to track connection: ${error.message}`);
    }
  }

  /**
   * Track errors for analytics
   */
  async trackError(
    organizationId: string,
    errorType: string,
    errorMessage: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    if (!this.enableRealTimeAnalytics) return;

    try {
      const redis = this.redisService.getRedisInstance();
      const timestamp = Date.now();
      const hour = Math.floor(timestamp / 3600000);

      // Increment error counter
      const errorKey = `tenant:${organizationId}:errors:${hour}`;
      await redis.incr(errorKey);
      await redis.expire(errorKey, this.retentionDays * 24 * 60 * 60);

      // Store error details
      const errorDetailKey = `tenant:${organizationId}:error_details:${timestamp}:${Math.random().toString(36).substring(2, 9)}`;
      await redis.setEx(errorDetailKey, 86400, JSON.stringify({
        type: errorType,
        message: errorMessage,
        timestamp,
        metadata,
      }));

      // Emit error event
      this.eventEmitter.emit('error.tracked', {
        organizationId,
        errorType,
        errorMessage,
        timestamp,
        metadata,
      });
    } catch (error) {
      this.logger.error(`Failed to track error: ${error.message}`);
    }
  }

  /**
   * Track operations for analytics
   */
  async trackOperation(
    organizationId: string,
    operationType: string,
    success: boolean,
    duration?: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    if (!this.enableRealTimeAnalytics) return;

    try {
      const redis = this.redisService.getRedisInstance();
      const timestamp = Date.now();
      const hour = Math.floor(timestamp / 3600000);

      // Increment operation counter
      const opsKey = `tenant:${organizationId}:operations:${hour}`;
      await redis.incr(opsKey);
      await redis.expire(opsKey, this.retentionDays * 24 * 60 * 60);

      // Track latency if provided
      if (duration !== undefined) {
        await this.trackLatency(organizationId, operationType, duration);
      }

      // Track errors if operation failed
      if (!success) {
        await this.trackError(organizationId, `${operationType}_failed`, 'Operation failed', metadata);
      }

      // Emit operation event
      this.eventEmitter.emit('operation.tracked', {
        organizationId,
        operationType,
        success,
        duration,
        timestamp,
        metadata,
      });
    } catch (error) {
      this.logger.error(`Failed to track operation: ${error.message}`);
    }
  }

  /**
   * Track latency metrics
   */
  async trackLatency(
    organizationId: string,
    operation: string,
    latency: number
  ): Promise<void> {
    if (!this.enableRealTimeAnalytics) return;

    try {
      const redis = this.redisService.getRedisInstance();
      const timestamp = Date.now();
      const hour = Math.floor(timestamp / 3600000);

      // Store latency in Redis for aggregation
      const latencyKey = `metrics:${organizationId}:latency:${hour}`;
      const existingData = await redis.get(latencyKey);

      let latencyData: { latencies: number[]; operations: Record<string, number[]> } = {
        latencies: [],
        operations: {},
      };

      if (existingData && typeof existingData === 'string') {
        try {
          latencyData = JSON.parse(existingData);
        } catch (parseError) {
          this.logger.warn(`Failed to parse existing latency data: ${parseError.message}`);
        }
      }

      // Add new latency
      latencyData.latencies.push(latency);

      // Track per-operation latencies
      if (!latencyData.operations[operation]) {
        latencyData.operations[operation] = [];
      }
      latencyData.operations[operation].push(latency);

      // Limit array size to prevent memory issues
      if (latencyData.latencies.length > 10000) {
        latencyData.latencies = latencyData.latencies.slice(-5000);
      }

      if (latencyData.operations[operation].length > 1000) {
        latencyData.operations[operation] = latencyData.operations[operation].slice(-500);
      }

      await redis.setEx(latencyKey, this.retentionDays * 24 * 60 * 60, JSON.stringify(latencyData));
    } catch (error) {
      this.logger.error(`Failed to track latency: ${error.message}`);
    }
  }

  /**
   * Track health check for uptime calculation
   */
  async trackHealthCheck(
    organizationId: string,
    status: 'healthy' | 'unhealthy' | 'degraded',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      // Store health check event in database for uptime calculation
      await this.prismaService.axonPulsEvent.create({
        data: {
          id: `health_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          organizationId,
          eventType: 'health_check',
          channel: 'system',
          payload: {
            status,
            timestamp: new Date().toISOString(),
            ...metadata,
          },
          acknowledgment: status === 'healthy',
          createdAt: new Date(),
        },
      });

      // Also track in Redis for real-time monitoring
      if (this.enableRealTimeAnalytics) {
        const redis = this.redisService.getRedisInstance();
        const timestamp = Date.now();
        const hour = Math.floor(timestamp / 3600000);

        const healthKey = `tenant:${organizationId}:health:${hour}`;
        await redis.hIncrBy(healthKey, status, 1);
        await redis.expire(healthKey, this.retentionDays * 24 * 60 * 60);
      }

      this.eventEmitter.emit('health.check.tracked', {
        organizationId,
        status,
        timestamp: Date.now(),
        metadata,
      });
    } catch (error) {
      this.logger.error(`Failed to track health check: ${error.message}`);
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async getEventCount(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<number> {
    try {
      const count = await this.prismaService.axonPulsEvent.count({
        where: {
          organizationId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      });
      return count;
    } catch (error) {
      this.logger.error(`Failed to get event count: ${error.message}`);
      return 0;
    }
  }

  private async getChannelCount(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<number> {
    try {
      const channels = await this.prismaService.axonPulsChannel.count({
        where: {
          organizationId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      });
      return channels;
    } catch (error) {
      this.logger.error(`Failed to get channel count: ${error.message}`);
      return 0;
    }
  }

  private async getUserCount(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<number> {
    try {
      const users = await this.prismaService.axonPulsEvent.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
          userId: { not: null },
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      return users.length;
    } catch (error) {
      this.logger.error(`Failed to get user count: ${error.message}`);
      return 0;
    }
  }

  private async getSessionData(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{ averageDuration: number }> {
    try {
      // Calculate session duration from connection events
      const connectionEvents = await this.prismaService.axonPulsEvent.findMany({
        where: {
          organizationId,
          eventType: { in: ['connection_established', 'connection_closed'] },
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
        select: {
          eventType: true,
          createdAt: true,
          userId: true,
          payload: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      // Group events by user session
      const sessionMap = new Map<string, { start?: Date; end?: Date }>();

      for (const event of connectionEvents) {
        const sessionKey = `${event.userId || 'anonymous'}_${Math.floor(new Date(event.createdAt).getTime() / (30 * 60 * 1000))}`; // 30-minute session windows

        if (!sessionMap.has(sessionKey)) {
          sessionMap.set(sessionKey, {});
        }

        const session = sessionMap.get(sessionKey)!;

        if (event.eventType === 'connection_established') {
          if (!session.start || new Date(event.createdAt) < session.start) {
            session.start = new Date(event.createdAt);
          }
        } else if (event.eventType === 'connection_closed') {
          if (!session.end || new Date(event.createdAt) > session.end) {
            session.end = new Date(event.createdAt);
          }
        }
      }

      // Calculate average session duration
      const sessionDurations: number[] = [];
      for (const session of sessionMap.values()) {
        if (session.start && session.end) {
          const duration = session.end.getTime() - session.start.getTime();
          sessionDurations.push(duration);
        } else if (session.start) {
          // For ongoing sessions, calculate duration until now or end of time range
          const endTime = timeRange.end.getTime() < Date.now() ? timeRange.end : new Date();
          const duration = endTime.getTime() - session.start.getTime();
          sessionDurations.push(duration);
        }
      }

      const averageDuration = sessionDurations.length > 0
        ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
        : 0;

      // Convert to seconds and round
      return { averageDuration: Math.round(averageDuration / 1000) };
    } catch (error) {
      this.logger.error(`Failed to get session data: ${error.message}`);
      return { averageDuration: 0 };
    }
  }

  private async getApiCallCount(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<number> {
    try {
      const redis = this.redisService.getRedisInstance();
      const startHour = Math.floor(timeRange.start.getTime() / 3600000);
      const endHour = Math.floor(timeRange.end.getTime() / 3600000);

      let totalCalls = 0;
      for (let hour = startHour; hour <= endHour; hour++) {
        const key = `tenant:${organizationId}:api_calls:${hour}`;
        const calls = await redis.get(key);
        totalCalls += parseInt((typeof calls === 'string' ? calls : '0'), 10);
      }

      return totalCalls;
    } catch (error) {
      this.logger.error(`Failed to get API call count: ${error.message}`);
      return 0;
    }
  }

  private async getErrorData(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{ rate: number }> {
    try {
      // Get total events and error events from database and Redis
      const [totalEvents, errorEvents, redisErrors] = await Promise.all([
        // Total events from database
        this.prismaService.axonPulsEvent.count({
          where: {
            organizationId,
            createdAt: {
              gte: timeRange.start,
              lte: timeRange.end,
            },
          },
        }),
        // Error events from database (failed acknowledgments, error event types)
        this.prismaService.axonPulsEvent.count({
          where: {
            organizationId,
            createdAt: {
              gte: timeRange.start,
              lte: timeRange.end,
            },
            OR: [
              { acknowledgment: false },
              { eventType: { contains: 'error' } },
              { eventType: { contains: 'failed' } },
              { eventType: { contains: 'exception' } },
            ],
          },
        }),
        // Error tracking from Redis
        this.getRedisErrorCount(organizationId, timeRange),
      ]);

      // Calculate error rate
      const totalOperations = totalEvents + redisErrors.totalOperations;
      const totalErrors = errorEvents + redisErrors.errorCount;

      const errorRate = totalOperations > 0 ? totalErrors / totalOperations : 0;

      // Cap error rate at 1.0 (100%)
      return { rate: Math.min(errorRate, 1.0) };
    } catch (error) {
      this.logger.error(`Failed to get error data: ${error.message}`);
      return { rate: 0 };
    }
  }

  private async getRedisErrorCount(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{ errorCount: number; totalOperations: number }> {
    try {
      const redis = this.redisService.getRedisInstance();
      const startHour = Math.floor(timeRange.start.getTime() / 3600000);
      const endHour = Math.floor(timeRange.end.getTime() / 3600000);

      let totalErrors = 0;
      let totalOps = 0;

      for (let hour = startHour; hour <= endHour; hour++) {
        const errorKey = `tenant:${organizationId}:errors:${hour}`;
        const opsKey = `tenant:${organizationId}:operations:${hour}`;

        const [errors, operations] = await Promise.all([
          redis.get(errorKey),
          redis.get(opsKey),
        ]);

        totalErrors += parseInt((typeof errors === 'string' ? errors : '0'), 10);
        totalOps += parseInt((typeof operations === 'string' ? operations : '0'), 10);
      }

      return { errorCount: totalErrors, totalOperations: totalOps };
    } catch (error) {
      this.logger.error(`Failed to get Redis error count: ${error.message}`);
      return { errorCount: 0, totalOperations: 0 };
    }
  }

  private async getDataTransferred(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<number> {
    try {
      // Calculate data transferred based on events
      const events = await this.prismaService.axonPulsEvent.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
        select: { payload: true },
      });

      const totalBytes = events.reduce((sum, event) => {
        return sum + JSON.stringify(event.payload).length;
      }, 0);

      return totalBytes;
    } catch (error) {
      this.logger.error(`Failed to get data transferred: ${error.message}`);
      return 0;
    }
  }

  private async getUptime(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<number> {
    try {
      // Calculate uptime based on health check events and service availability
      const [healthCheckEvents, serviceDowntimeEvents] = await Promise.all([
        // Get health check events
        this.prismaService.axonPulsEvent.findMany({
          where: {
            organizationId,
            eventType: 'health_check',
            createdAt: {
              gte: timeRange.start,
              lte: timeRange.end,
            },
          },
          select: {
            createdAt: true,
            payload: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        // Get service downtime/error events
        this.prismaService.axonPulsEvent.findMany({
          where: {
            organizationId,
            eventType: { in: ['service_down', 'service_error', 'connection_failed', 'timeout'] },
            createdAt: {
              gte: timeRange.start,
              lte: timeRange.end,
            },
          },
          select: {
            createdAt: true,
            eventType: true,
          },
        }),
      ]);

      // If no health checks, calculate based on successful operations
      if (healthCheckEvents.length === 0) {
        return await this.calculateUptimeFromOperations(organizationId, timeRange);
      }

      // Calculate uptime from health checks
      const totalHealthChecks = healthCheckEvents.length;
      const successfulHealthChecks = healthCheckEvents.filter(event => {
        const payload = event.payload as any;
        return payload?.status === 'healthy' || payload?.status === 'ok' || payload?.success === true;
      }).length;

      // Factor in downtime events
      const downtimeWeight = Math.min(serviceDowntimeEvents.length * 0.1, 0.5); // Max 50% impact
      const healthCheckUptime = totalHealthChecks > 0 ? (successfulHealthChecks / totalHealthChecks) : 1.0;

      const finalUptime = Math.max(0, healthCheckUptime - downtimeWeight);

      return Math.round(finalUptime * 10000) / 100; // Convert to percentage with 2 decimal places
    } catch (error) {
      this.logger.error(`Failed to get uptime: ${error.message}`);
      return 99.0; // Default to high uptime on error
    }
  }

  private async calculateUptimeFromOperations(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<number> {
    try {
      // Calculate uptime based on successful vs failed operations
      const [totalEvents, failedEvents] = await Promise.all([
        this.prismaService.axonPulsEvent.count({
          where: {
            organizationId,
            createdAt: {
              gte: timeRange.start,
              lte: timeRange.end,
            },
          },
        }),
        this.prismaService.axonPulsEvent.count({
          where: {
            organizationId,
            createdAt: {
              gte: timeRange.start,
              lte: timeRange.end,
            },
            OR: [
              { acknowledgment: false },
              { eventType: { contains: 'error' } },
              { eventType: { contains: 'failed' } },
            ],
          },
        }),
      ]);

      if (totalEvents === 0) {
        return 100.0; // No events means no downtime
      }

      const successRate = (totalEvents - failedEvents) / totalEvents;
      return Math.round(successRate * 10000) / 100; // Convert to percentage
    } catch (error) {
      this.logger.error(`Failed to calculate uptime from operations: ${error.message}`);
      return 99.0;
    }
  }

  private async getLatencyData(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{ average: number; p95: number; p99: number }> {
    try {
      // Get latency data from Redis (stored by latency tracker) and calculate from events
      const [redisLatencies, eventLatencies] = await Promise.all([
        this.getRedisLatencyMetrics(organizationId, timeRange),
        this.calculateEventProcessingLatencies(organizationId, timeRange),
      ]);

      // Combine latency data from both sources
      const allLatencies = [...redisLatencies, ...eventLatencies];

      if (allLatencies.length === 0) {
        return { average: 0, p95: 0, p99: 0 };
      }

      // Sort latencies for percentile calculation
      allLatencies.sort((a, b) => a - b);

      const average = allLatencies.reduce((sum, latency) => sum + latency, 0) / allLatencies.length;
      const p95Index = Math.floor(allLatencies.length * 0.95);
      const p99Index = Math.floor(allLatencies.length * 0.99);

      return {
        average: Math.round(average),
        p95: allLatencies[p95Index] || 0,
        p99: allLatencies[p99Index] || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get latency data: ${error.message}`);
      return { average: 0, p95: 0, p99: 0 };
    }
  }

  private async getRedisLatencyMetrics(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<number[]> {
    try {
      const redis = this.redisService.getRedisInstance();
      const startHour = Math.floor(timeRange.start.getTime() / 3600000);
      const endHour = Math.floor(timeRange.end.getTime() / 3600000);

      const latencies: number[] = [];

      for (let hour = startHour; hour <= endHour; hour++) {
        const metricsKey = `metrics:${organizationId}:latency:${hour}`;
        const metricsData = await redis.get(metricsKey);

        if (metricsData && typeof metricsData === 'string') {
          try {
            const metrics = JSON.parse(metricsData);
            if (Array.isArray(metrics.latencies)) {
              latencies.push(...metrics.latencies);
            }
          } catch (parseError) {
            this.logger.warn(`Failed to parse latency metrics for hour ${hour}: ${parseError.message}`);
          }
        }
      }

      return latencies;
    } catch (error) {
      this.logger.error(`Failed to get Redis latency metrics: ${error.message}`);
      return [];
    }
  }

  private async calculateEventProcessingLatencies(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<number[]> {
    try {
      // Calculate latencies from event processing times
      const events = await this.prismaService.axonPulsEvent.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
          acknowledgment: true, // Only successful events
        },
        select: {
          createdAt: true,
          payload: true,
        },
        take: 10000, // Limit to prevent memory issues
      });

      const latencies: number[] = [];

      for (const event of events) {
        const payload = event.payload as any;

        // Extract processing time from payload if available
        if (payload?.processingTime && typeof payload.processingTime === 'number') {
          latencies.push(payload.processingTime);
        } else if (payload?.startTime && payload?.endTime) {
          const latency = new Date(payload.endTime).getTime() - new Date(payload.startTime).getTime();
          if (latency > 0 && latency < 60000) { // Reasonable latency (< 60 seconds)
            latencies.push(latency);
          }
        } else if (payload?.timestamp) {
          // Estimate latency from event creation to acknowledgment
          const eventTime = new Date(payload.timestamp).getTime();
          const ackTime = new Date(event.createdAt).getTime();
          const latency = ackTime - eventTime;

          if (latency > 0 && latency < 30000) { // Reasonable latency (< 30 seconds)
            latencies.push(latency);
          }
        }
      }

      return latencies;
    } catch (error) {
      this.logger.error(`Failed to calculate event processing latencies: ${error.message}`);
      return [];
    }
  }

  private async getThroughputData(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{ average: number }> {
    try {
      const eventCount = await this.getEventCount(organizationId, timeRange);
      const durationHours = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60);
      const throughput = durationHours > 0 ? eventCount / durationHours : 0;

      return { average: Math.round(throughput) };
    } catch (error) {
      this.logger.error(`Failed to get throughput data: ${error.message}`);
      return { average: 0 };
    }
  }

  private async getAvailabilityData(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{ percentage: number }> {
    try {
      // Calculate real availability based on service health and uptime
      const [uptime, healthChecks] = await Promise.all([
        this.getUptime(organizationId, timeRange),
        this.prismaService.axonPulsEvent.count({
          where: {
            organizationId,
            eventType: 'health_check',
            createdAt: {
              gte: timeRange.start,
              lte: timeRange.end,
            },
          },
        }),
      ]);

      // If we have health checks, use them for more accurate availability
      if (healthChecks > 0) {
        const successfulHealthChecks = await this.prismaService.axonPulsEvent.count({
          where: {
            organizationId,
            eventType: 'health_check',
            createdAt: {
              gte: timeRange.start,
              lte: timeRange.end,
            },
            payload: {
              path: ['status'],
              equals: 'healthy',
            },
          },
        });

        const availabilityPercentage = (successfulHealthChecks / healthChecks) * 100;
        return { percentage: Math.round(availabilityPercentage * 100) / 100 };
      }

      // Fallback to uptime-based availability
      return { percentage: uptime };
    } catch (error) {
      this.logger.error(`Failed to get availability data: ${error.message}`);
      return { percentage: 99.9 }; // Default high availability on error
    }
  }

  private async identifyBottlenecks(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<Array<{
    component: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
  }>> {
    try {
      const bottlenecks = [];

      // Check database performance
      const eventCount = await this.getEventCount(organizationId, timeRange);
      if (eventCount > 100000) {
        bottlenecks.push({
          component: 'database',
          severity: 'medium' as const,
          description: 'High event volume may impact database performance',
          recommendation: 'Consider implementing event archiving or database optimization',
        });
      }

      // Check connection load
      const connectionStats = await this.getConnectionStats(organizationId, timeRange);
      if (connectionStats.peak > 1000) {
        bottlenecks.push({
          component: 'websocket',
          severity: 'high' as const,
          description: 'High concurrent connection count detected',
          recommendation: 'Consider implementing connection pooling or load balancing',
        });
      }

      // Check latency bottlenecks
      const latencyData = await this.getLatencyData(organizationId, timeRange);
      if (latencyData.p95 > 1000) {
        bottlenecks.push({
          component: 'api',
          severity: 'high' as const,
          description: 'High latency detected (P95 > 1s)',
          recommendation: 'Investigate slow database queries or external service calls',
        });
      }

      // Check error rate bottlenecks
      const errorData = await this.getErrorData(organizationId, timeRange);
      if (errorData.rate > 0.05) {
        bottlenecks.push({
          component: 'system',
          severity: 'critical' as const,
          description: `High error rate detected: ${(errorData.rate * 100).toFixed(1)}%`,
          recommendation: 'Immediate investigation required for error sources',
        });
      }

      // Check memory usage bottlenecks
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = memoryUsage.heapUsed / (1024 * 1024);
      if (memoryUsageMB > 1024) {
        bottlenecks.push({
          component: 'memory',
          severity: 'medium' as const,
          description: `High memory usage: ${Math.round(memoryUsageMB)}MB`,
          recommendation: 'Consider implementing memory optimization or scaling',
        });
      }

      // Check Redis performance bottlenecks
      try {
        const redisStart = Date.now();
        await this.redisService.ping();
        const redisLatency = Date.now() - redisStart;

        if (redisLatency > 100) {
          bottlenecks.push({
            component: 'redis',
            severity: 'medium' as const,
            description: `High Redis latency: ${redisLatency}ms`,
            recommendation: 'Investigate Redis performance and network connectivity',
          });
        }
      } catch (error) {
        bottlenecks.push({
          component: 'redis',
          severity: 'critical' as const,
          description: 'Redis connectivity issues detected',
          recommendation: 'Immediate Redis health check and recovery required',
        });
      }

      return bottlenecks;
    } catch (error) {
      this.logger.error(`Failed to identify bottlenecks: ${error.message}`);
      return [];
    }
  }

  private async calculateTrends(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<Array<{
    metric: string;
    direction: 'up' | 'down' | 'stable';
    change: number;
    period: string;
  }>> {
    try {
      // Calculate trends by comparing current period with previous period
      const periodDuration = timeRange.end.getTime() - timeRange.start.getTime();
      const previousTimeRange = {
        start: new Date(timeRange.start.getTime() - periodDuration),
        end: timeRange.start,
      };

      // Get metrics for both periods
      const [currentMetrics, previousMetrics] = await Promise.all([
        this.getBasicMetricsForTrends(organizationId, timeRange),
        this.getBasicMetricsForTrends(organizationId, previousTimeRange),
      ]);

      const trends: Array<{
        metric: string;
        direction: 'up' | 'down' | 'stable';
        change: number;
        period: string;
      }> = [];

      // Calculate period label
      const periodHours = periodDuration / (1000 * 60 * 60);
      const periodLabel = periodHours <= 24 ? 'day' :
        periodHours <= 168 ? 'week' :
          periodHours <= 720 ? 'month' : 'period';

      // Calculate trends for each metric
      const metrics = ['events', 'connections', 'errors', 'latency', 'throughput'];

      for (const metric of metrics) {
        const currentValue = currentMetrics[metric] || 0;
        const previousValue = previousMetrics[metric] || 0;

        let change = 0;
        let direction: 'up' | 'down' | 'stable' = 'stable';

        if (previousValue > 0) {
          change = ((currentValue - previousValue) / previousValue) * 100;

          if (Math.abs(change) < 5) {
            direction = 'stable';
          } else if (change > 0) {
            direction = 'up';
          } else {
            direction = 'down';
          }
        } else if (currentValue > 0) {
          change = 100; // 100% increase from 0
          direction = 'up';
        }

        trends.push({
          metric,
          direction,
          change: Math.round(Math.abs(change) * 100) / 100,
          period: periodLabel,
        });
      }

      return trends;
    } catch (error) {
      this.logger.error(`Failed to calculate trends: ${error.message}`);
      return [];
    }
  }

  private async getBasicMetricsForTrends(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<Record<string, number>> {
    try {
      const [eventCount, connectionStats, errorData, latencyData] = await Promise.all([
        this.getEventCount(organizationId, timeRange),
        this.getConnectionStats(organizationId, timeRange),
        this.getErrorData(organizationId, timeRange),
        this.getLatencyData(organizationId, timeRange),
      ]);

      return {
        events: eventCount,
        connections: connectionStats.peak,
        errors: Math.round(errorData.rate * 100), // Convert to percentage
        latency: latencyData.average,
        throughput: eventCount / Math.max(1, (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60)), // events per hour
      };
    } catch (error) {
      this.logger.error(`Failed to get basic metrics for trends: ${error.message}`);
      return {};
    }
  }

  private async getConnectionStats(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{ peak: number; average: number; current: number }> {
    try {
      // Get connection statistics from connection events
      const connectionEvents = await this.prismaService.axonPulsEvent.findMany({
        where: {
          organizationId,
          eventType: { in: ['connection_established', 'connection_closed'] },
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
        select: {
          eventType: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      let currentConnections = 0;
      let peakConnections = 0;
      const connectionCounts: number[] = [];

      for (const event of connectionEvents) {
        if (event.eventType === 'connection_established') {
          currentConnections++;
        } else if (event.eventType === 'connection_closed') {
          currentConnections = Math.max(0, currentConnections - 1);
        }

        peakConnections = Math.max(peakConnections, currentConnections);
        connectionCounts.push(currentConnections);
      }

      const averageConnections = connectionCounts.length > 0
        ? connectionCounts.reduce((sum, count) => sum + count, 0) / connectionCounts.length
        : 0;

      return {
        peak: peakConnections,
        average: Math.round(averageConnections),
        current: currentConnections,
      };
    } catch (error) {
      this.logger.error(`Failed to get connection stats: ${error.message}`);
      return { peak: 0, average: 0, current: 0 };
    }
  }

}
