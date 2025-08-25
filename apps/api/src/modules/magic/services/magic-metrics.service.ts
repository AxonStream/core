import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../../../common/services/redis.service';
import { PrismaService } from '../../../common/services/prisma.service';
import { TenantContext } from '../../../common/services/tenant-aware.service';

export interface MagicMetrics {
  // Room Metrics
  totalRooms: number;
  activeRooms: number;
  roomsPerOrganization: number;
  averageUsersPerRoom: number;

  // Operation Metrics
  totalOperations: number;
  operationsPerSecond: number;
  conflictRate: number;
  transformationSuccessRate: number;

  // Time Travel Metrics
  totalSnapshots: number;
  totalBranches: number;
  mergeSuccessRate: number;
  averageBranchLifetime: number;

  // Presence Metrics
  activePresences: number;
  averagePresenceDuration: number;
  heartbeatSuccessRate: number;

  // Performance Metrics
  averageOperationLatency: number;
  averageStateSize: number;
  cacheHitRate: number;

  // Error Metrics
  operationErrors: number;
  presenceErrors: number;
  timeTravelErrors: number;

  timeRange: { start: Date; end: Date };
}

export interface MagicOperationMetric {
  type: 'set' | 'array_insert' | 'array_delete' | 'array_move' | 'object_merge';
  latency: number;
  success: boolean;
  conflicted: boolean;
  roomId: string;
  userId: string;
  organizationId: string;
  sessionId: string;
  timestamp: Date;
}

export interface MagicPresenceMetric {
  type: 'join' | 'leave' | 'update' | 'heartbeat';
  latency: number;
  success: boolean;
  roomId: string;
  userId: string;
  organizationId: string;
  sessionId: string;
  timestamp: Date;
}

export interface MagicTimeTravelMetric {
  type: 'snapshot' | 'branch' | 'merge' | 'revert';
  latency: number;
  success: boolean;
  conflictCount?: number;
  roomId: string;
  userId: string;
  organizationId: string;
  sessionId: string;
  timestamp: Date;
}

@Injectable()
export class MagicMetricsService {
  private readonly logger = new Logger(MagicMetricsService.name);
  private readonly metricsKey = 'magic:metrics';
  private readonly retentionDays: number;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.retentionDays = 7; // Keep metrics for 7 days
    this.setupMetricsCleanup();
  }

  // ==================== METRIC COLLECTION ====================

  /**
   * Record operation metrics
   */
  async recordOperation(metric: Omit<MagicOperationMetric, 'timestamp'>): Promise<void> {
    const fullMetric: MagicOperationMetric = {
      ...metric,
      timestamp: new Date()
    };

    try {
      // Store in Redis for real-time metrics
      await this.redis.client.lPush(
        `${this.metricsKey}:operations`,
        JSON.stringify(fullMetric)
      );

      // Store key metrics in database for long-term analysis
      await this.prisma.magicEvent.create({
        data: {
          roomId: metric.roomId,
          eventType: 'operation_metric',
          payload: JSON.parse(JSON.stringify(fullMetric)),
          organizationId: metric.organizationId,
          userId: metric.userId,
          sessionId: metric.sessionId,
          createdAt: fullMetric.timestamp,
        }
      });

      // Emit real-time metric event
      this.eventEmitter.emit('magic.operation.metric', fullMetric);

      // Update counters
      await this.updateCounters('operations', metric.success, metric.conflicted);
    } catch (error) {
      this.logger.error(`Failed to record operation metric: ${error.message}`);
    }
  }

  /**
   * Record presence metrics
   */
  async recordPresence(metric: Omit<MagicPresenceMetric, 'timestamp'>): Promise<void> {
    const fullMetric: MagicPresenceMetric = {
      ...metric,
      timestamp: new Date()
    };

    try {
      await this.redis.client.lPush(
        `${this.metricsKey}:presence`,
        JSON.stringify(fullMetric)
      );

      this.eventEmitter.emit('magic.presence.metric', fullMetric);
      await this.updateCounters('presence', metric.success);
    } catch (error) {
      this.logger.error(`Failed to record presence metric: ${error.message}`);
    }
  }

  /**
   * Record time travel metrics
   */
  async recordTimeTravel(metric: Omit<MagicTimeTravelMetric, 'timestamp'>): Promise<void> {
    const fullMetric: MagicTimeTravelMetric = {
      ...metric,
      timestamp: new Date()
    };

    try {
      await this.redis.client.lPush(
        `${this.metricsKey}:timetravel`,
        JSON.stringify(fullMetric)
      );

      await this.prisma.magicEvent.create({
        data: {
          roomId: metric.roomId,
          eventType: 'timetravel_metric',
          payload: JSON.parse(JSON.stringify(fullMetric)),
          organizationId: metric.organizationId,
          userId: metric.userId,
          sessionId: metric.sessionId,
          createdAt: fullMetric.timestamp,
        }
      });

      this.eventEmitter.emit('magic.timetravel.metric', fullMetric);
      await this.updateCounters('timetravel', metric.success);
    } catch (error) {
      this.logger.error(`Failed to record time travel metric: ${error.message}`);
    }
  }

  // ==================== METRIC RETRIEVAL ====================

  /**
   * Get comprehensive Magic metrics for dashboard
   */
  async getMagicMetrics(
    context: TenantContext,
    timeRange: { start: Date; end: Date }
  ): Promise<MagicMetrics> {
    try {
      const [
        roomStats,
        operationStats,
        timeTravelStats,
        presenceStats,
        performanceStats,
        errorStats
      ] = await Promise.all([
        this.getRoomStats(context.organizationId, timeRange),
        this.getOperationStats(context.organizationId, timeRange),
        this.getTimeTravelStats(context.organizationId, timeRange),
        this.getPresenceStats(context.organizationId, timeRange),
        this.getPerformanceStats(context.organizationId, timeRange),
        this.getErrorStats(context.organizationId, timeRange)
      ]);

      return {
        // Room Metrics
        totalRooms: roomStats.total,
        activeRooms: roomStats.active,
        roomsPerOrganization: roomStats.total,
        averageUsersPerRoom: roomStats.averageUsers,

        // Operation Metrics
        totalOperations: operationStats.total,
        operationsPerSecond: operationStats.rate,
        conflictRate: operationStats.conflictRate,
        transformationSuccessRate: operationStats.successRate,

        // Time Travel Metrics
        totalSnapshots: timeTravelStats.snapshots,
        totalBranches: timeTravelStats.branches,
        mergeSuccessRate: timeTravelStats.mergeSuccessRate,
        averageBranchLifetime: timeTravelStats.averageBranchLifetime,

        // Presence Metrics
        activePresences: presenceStats.active,
        averagePresenceDuration: presenceStats.averageDuration,
        heartbeatSuccessRate: presenceStats.heartbeatSuccessRate,

        // Performance Metrics
        averageOperationLatency: performanceStats.operationLatency,
        averageStateSize: performanceStats.averageStateSize,
        cacheHitRate: performanceStats.cacheHitRate,

        // Error Metrics
        operationErrors: errorStats.operations,
        presenceErrors: errorStats.presence,
        timeTravelErrors: errorStats.timetravel,

        timeRange
      };
    } catch (error) {
      this.logger.error(`Failed to get Magic metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get real-time Magic metrics (last 5 minutes)
   */
  async getRealTimeMetrics(context: TenantContext): Promise<{
    operationsPerSecond: number;
    activeRooms: number;
    activePresences: number;
    averageLatency: number;
    errorRate: number;
  }> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    try {
      const [operations, latency, errors] = await Promise.all([
        this.getRecentOperations(fiveMinutesAgo),
        this.getAverageLatency(fiveMinutesAgo),
        this.getRecentErrors(fiveMinutesAgo)
      ]);

      const activeRooms = await this.getActiveRoomCount(context.organizationId);
      const activePresences = await this.getActivePresenceCount(context.organizationId);

      return {
        operationsPerSecond: operations.length / 300, // 5 minutes = 300 seconds
        activeRooms,
        activePresences,
        averageLatency: latency,
        errorRate: errors.length / Math.max(operations.length, 1)
      };
    } catch (error) {
      this.logger.error(`Failed to get real-time metrics: ${error.message}`);
      return {
        operationsPerSecond: 0,
        activeRooms: 0,
        activePresences: 0,
        averageLatency: 0,
        errorRate: 0
      };
    }
  }

  /**
   * Get Magic performance alerts
   */
  async getPerformanceAlerts(context: TenantContext): Promise<Array<{
    type: 'high_latency' | 'high_error_rate' | 'too_many_conflicts' | 'memory_usage';
    severity: 'warning' | 'critical';
    message: string;
    metric: number;
    threshold: number;
  }>> {
    const alerts = [];
    const realTimeMetrics = await this.getRealTimeMetrics(context);

    // High latency alert
    if (realTimeMetrics.averageLatency > 1000) {
      alerts.push({
        type: 'high_latency' as const,
        severity: realTimeMetrics.averageLatency > 2000 ? 'critical' as const : 'warning' as const,
        message: `High operation latency: ${realTimeMetrics.averageLatency}ms`,
        metric: realTimeMetrics.averageLatency,
        threshold: 1000
      });
    }

    // High error rate alert
    if (realTimeMetrics.errorRate > 0.05) {
      alerts.push({
        type: 'high_error_rate' as const,
        severity: realTimeMetrics.errorRate > 0.1 ? 'critical' as const : 'warning' as const,
        message: `High error rate: ${(realTimeMetrics.errorRate * 100).toFixed(1)}%`,
        metric: realTimeMetrics.errorRate,
        threshold: 0.05
      });
    }

    return alerts;
  }

  // ==================== HELPER METHODS ====================

  private async updateCounters(type: string, success: boolean, conflicted?: boolean): Promise<void> {
    const day = new Date().toISOString().split('T')[0];
    const counterKey = `${this.metricsKey}:counters:${day}`;

    await Promise.all([
      this.redis.client.hIncrBy(counterKey, `${type}_total`, 1),
      this.redis.client.hIncrBy(counterKey, `${type}_${success ? 'success' : 'error'}`, 1),
      conflicted ? this.redis.client.hIncrBy(counterKey, `${type}_conflicts`, 1) : Promise.resolve(),
      this.redis.client.expire(counterKey, 7 * 24 * 60 * 60) // 7 days
    ]);
  }

  private async getRoomStats(organizationId: string, timeRange: { start: Date; end: Date }) {
    const [totalRooms, activeRooms, presenceData] = await Promise.all([
      this.prisma.magicRoom.count({
        where: { organizationId }
      }),
      this.prisma.magicRoom.count({
        where: {
          organizationId,
          updatedAt: { gte: timeRange.start }
        }
      }),
      this.prisma.magicPresence.groupBy({
        by: ['roomId'],
        where: {
          room: { organizationId },
          joinedAt: { gte: timeRange.start, lte: timeRange.end }
        },
        _count: { userId: true }
      })
    ]);

    const averageUsers = presenceData.length > 0
      ? presenceData.reduce((sum, room) => sum + room._count.userId, 0) / presenceData.length
      : 0;

    return {
      total: totalRooms,
      active: activeRooms,
      averageUsers
    };
  }

  private async getOperationStats(organizationId: string, timeRange: { start: Date; end: Date }) {
    const operations = await this.prisma.magicEvent.findMany({
      where: {
        organizationId,
        eventType: 'operation_metric',
        createdAt: { gte: timeRange.start, lte: timeRange.end }
      }
    });

    const total = operations.length;
    const successes = operations.filter(op => (op.payload as any)?.success).length;
    const conflicts = operations.filter(op => (op.payload as any)?.conflicted).length;
    const duration = (timeRange.end.getTime() - timeRange.start.getTime()) / 1000;

    return {
      total,
      rate: total / duration,
      successRate: total > 0 ? successes / total : 1,
      conflictRate: total > 0 ? conflicts / total : 0
    };
  }

  private async getTimeTravelStats(organizationId: string, timeRange: { start: Date; end: Date }) {
    const [snapshots, branches] = await Promise.all([
      this.prisma.magicSnapshot.count({
        where: {
          room: { organizationId },
          createdAt: { gte: timeRange.start, lte: timeRange.end }
        }
      }),
      this.prisma.magicSnapshot.groupBy({
        by: ['branchName'],
        where: {
          room: { organizationId },
          createdAt: { gte: timeRange.start, lte: timeRange.end }
        }
      })
    ]);

    const timeTravelEvents = await this.prisma.magicEvent.findMany({
      where: {
        organizationId,
        eventType: 'timetravel_metric',
        createdAt: { gte: timeRange.start, lte: timeRange.end }
      }
    });

    const mergeEvents = timeTravelEvents.filter(e => (e.payload as any)?.type === 'merge');
    const successfulMerges = mergeEvents.filter(e => (e.payload as any)?.success);

    return {
      snapshots,
      branches: branches.length,
      mergeSuccessRate: mergeEvents.length > 0 ? successfulMerges.length / mergeEvents.length : 1,
      averageBranchLifetime: 0 // TODO: Calculate based on branch creation/merge times
    };
  }

  private async getPresenceStats(organizationId: string, timeRange: { start: Date; end: Date }) {
    const presences = await this.prisma.magicPresence.findMany({
      where: {
        room: { organizationId },
        lastSeen: { gte: timeRange.start, lte: timeRange.end }
      }
    });

    const active = presences.filter(p => p.isActive).length;
    const durations = presences
      .filter(p => p.lastSeen)
      .map(p => p.lastSeen.getTime() - p.joinedAt.getTime());

    const averageDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    return {
      active,
      averageDuration,
      heartbeatSuccessRate: 0.95 // TODO: Calculate from actual heartbeat metrics
    };
  }

  private async getPerformanceStats(organizationId: string, timeRange: { start: Date; end: Date }) {
    const operations = await this.redis.client.lRange(`${this.metricsKey}:operations`, 0, -1);
    const latencies = operations
      .map(op => JSON.parse(op))
      .filter(op => op.timestamp >= timeRange.start.getTime() && op.timestamp <= timeRange.end.getTime())
      .map(op => op.latency);

    const averageLatency = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;

    // TODO: Implement state size and cache hit rate metrics
    return {
      operationLatency: averageLatency,
      averageStateSize: 0,
      cacheHitRate: 0.85
    };
  }

  private async getErrorStats(organizationId: string, timeRange: { start: Date; end: Date }) {
    const day = new Date().toISOString().split('T')[0];
    const counterKey = `${this.metricsKey}:counters:${day}`;

    const counters = await this.redis.client.hGetAll(counterKey);

    return {
      operations: parseInt(counters.operations_error || '0'),
      presence: parseInt(counters.presence_error || '0'),
      timetravel: parseInt(counters.timetravel_error || '0')
    };
  }

  private async getRecentOperations(since: Date): Promise<any[]> {
    const operations = await this.redis.client.lRange(`${this.metricsKey}:operations`, 0, -1);
    return operations
      .map(op => JSON.parse(op))
      .filter(op => new Date(op.timestamp) >= since);
  }

  private async getAverageLatency(since: Date): Promise<number> {
    const operations = await this.getRecentOperations(since);
    const latencies = operations.map(op => op.latency);
    return latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0;
  }

  private async getRecentErrors(since: Date): Promise<any[]> {
    const operations = await this.getRecentOperations(since);
    return operations.filter(op => !op.success);
  }

  private async getActiveRoomCount(organizationId: string): Promise<number> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.prisma.magicRoom.count({
      where: {
        organizationId,
        updatedAt: { gte: fiveMinutesAgo }
      }
    });
  }

  private async getActivePresenceCount(organizationId: string): Promise<number> {
    return this.prisma.magicPresence.count({
      where: {
        room: { organizationId },
        isActive: true
      }
    });
  }

  private setupMetricsCleanup(): void {
    // Clean up old metrics every hour
    setInterval(async () => {
      try {
        const cutoffDate = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);

        // Clean up Redis lists
        const operations = await this.redis.client.lRange(`${this.metricsKey}:operations`, 0, -1);
        const validOperations = operations
          .map(op => JSON.parse(op))
          .filter(op => new Date(op.timestamp) >= cutoffDate)
          .map(op => JSON.stringify(op));

        if (validOperations.length < operations.length) {
          await this.redis.client.del(`${this.metricsKey}:operations`);
          if (validOperations.length > 0) {
            await this.redis.client.lPush(`${this.metricsKey}:operations`, validOperations);
          }
        }

        this.logger.log('Metrics cleanup completed');
      } catch (error) {
        this.logger.error(`Metrics cleanup failed: ${error.message}`);
      }
    }, 60 * 60 * 1000); // Every hour
  }
}
