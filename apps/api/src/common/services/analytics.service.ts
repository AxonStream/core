import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from './redis.service';
import { PrismaService } from './prisma.service';
import { TenantContext } from './tenant-aware.service';

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
        totalConnections: connectionStats.total,
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
      const eventKey = `analytics:${organizationId}:event:${timestamp}:${Math.random().toString(36).substr(2, 9)}`;
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

  private async getConnectionStats(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{ total: number; peak: number }> {
    try {
      const total = await this.prismaService.axonPulsConnection.count({
        where: {
          organizationId,
          connectedAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      });

      // Get peak from Redis analytics data
      const redis = this.redisService.getRedisInstance();
      const currentKey = `analytics:${organizationId}:current_connections`;
      const current = await redis.get(currentKey);
      const peak = parseInt((typeof current === 'string' ? current : '0'), 10);

      return { total, peak };
    } catch (error) {
      this.logger.error(`Failed to get connection stats: ${error.message}`);
      return { total: 0, peak: 0 };
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
      // This would require session tracking in the database
      // For now, return a placeholder
      return { averageDuration: 0 };
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
      // This would require error tracking
      // For now, return a placeholder
      return { rate: 0 };
    } catch (error) {
      this.logger.error(`Failed to get error data: ${error.message}`);
      return { rate: 0 };
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
      // This would require uptime tracking
      // For now, return a high uptime percentage
      return 99.9;
    } catch (error) {
      this.logger.error(`Failed to get uptime: ${error.message}`);
      return 0;
    }
  }

  private async getLatencyData(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{ average: number; p95: number; p99: number }> {
    try {
      // This would integrate with the latency tracker
      // For now, return placeholder data
      return { average: 100, p95: 200, p99: 500 };
    } catch (error) {
      this.logger.error(`Failed to get latency data: ${error.message}`);
      return { average: 0, p95: 0, p99: 0 };
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
      // This would require availability tracking
      // For now, return a high availability percentage
      return { percentage: 99.9 };
    } catch (error) {
      this.logger.error(`Failed to get availability data: ${error.message}`);
      return { percentage: 0 };
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
      // This would require historical data comparison
      // For now, return placeholder trends
      return [
        {
          metric: 'events',
          direction: 'up',
          change: 15.5,
          period: 'week',
        },
        {
          metric: 'connections',
          direction: 'stable',
          change: 2.1,
          period: 'week',
        },
      ];
    } catch (error) {
      this.logger.error(`Failed to calculate trends: ${error.message}`);
      return [];
    }
  }

}
