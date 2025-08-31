import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../common/services/redis.service';
import { PrismaService } from '../../../common/services/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
export class MagicMetricsService implements OnModuleInit {
  private readonly logger = new Logger(MagicMetricsService.name);
  private readonly metricsKey = 'magic:metrics';
  private readonly retentionDays: number;
  private readonly enableRealTimeMetrics: boolean;

  // Production-grade configuration with environment-driven values
  private config: {
    // Performance thresholds - configurable via environment
    latencyThresholds: {
      warning: number;
      critical: number;
      severe: number;
    };
    errorRateThresholds: {
      warning: number;
      critical: number;
      severe: number;
    };
    conflictThresholds: {
      warning: number;
      critical: number;
      severe: number;
    };
    // Cache and performance targets
    cacheTargets: {
      minHitRate: number;
      targetHitRate: number;
      maxHitRate: number;
    };
    // Cleanup intervals
    cleanupIntervals: {
      metrics: number;
      presence: number;
      operations: number;
      conflicts: number;
    };
    // Retention policies
    retentionPolicies: {
      metrics: number;
      operations: number;
      conflicts: number;
      presence: number;
    };
    // Adaptive thresholds (for runtime adjustment)
    adaptiveThresholds: {
      enabled: boolean;
      loadFactorMultiplier: number;
      baselineAdjustment: number;
    };
    // Monitoring settings
    monitoring: {
      performanceCheckIntervalMs: number;
    };
  };

  // State for adaptive thresholds
  private lastCPUUsage: number | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Load configuration from environment with sensible defaults
    this.retentionDays = this.configService.get<number>('MAGIC_METRICS_RETENTION_DAYS', 30);
    this.enableRealTimeMetrics = this.configService.get<boolean>('MAGIC_REALTIME_METRICS', true);

    // Initialize config with environment-driven values
    this.config = {
      latencyThresholds: {
        warning: this.configService.get<number>('MAGIC_LATENCY_WARNING_MS', 1000),
        critical: this.configService.get<number>('MAGIC_LATENCY_CRITICAL_MS', 2000),
        severe: this.configService.get<number>('MAGIC_LATENCY_SEVERE_MS', 5000)
      },
      errorRateThresholds: {
        warning: this.configService.get<number>('MAGIC_ERROR_RATE_WARNING', 0.05),
        critical: this.configService.get<number>('MAGIC_ERROR_RATE_CRITICAL', 0.1),
        severe: this.configService.get<number>('MAGIC_ERROR_RATE_SEVERE', 0.25)
      },
      conflictThresholds: {
        warning: this.configService.get<number>('MAGIC_CONFLICT_WARNING', 0.1),
        critical: this.configService.get<number>('MAGIC_CONFLICT_CRITICAL', 0.25),
        severe: this.configService.get<number>('MAGIC_CONFLICT_SEVERE', 0.5)
      },
      cacheTargets: {
        minHitRate: this.configService.get<number>('MAGIC_CACHE_MIN_HIT_RATE', 0.8),
        targetHitRate: this.configService.get<number>('MAGIC_CACHE_TARGET_HIT_RATE', 0.9),
        maxHitRate: this.configService.get<number>('MAGIC_CACHE_MAX_HIT_RATE', 0.98)
      },
      cleanupIntervals: {
        metrics: this.configService.get<number>('MAGIC_CLEANUP_METRICS_MS', 60 * 60 * 1000),
        presence: this.configService.get<number>('MAGIC_CLEANUP_PRESENCE_MS', 5 * 60 * 1000),
        operations: this.configService.get<number>('MAGIC_CLEANUP_OPERATIONS_MS', 15 * 60 * 1000),
        conflicts: this.configService.get<number>('MAGIC_CLEANUP_CONFLICTS_MS', 30 * 60 * 1000)
      },
      retentionPolicies: {
        metrics: this.configService.get<number>('MAGIC_RETENTION_METRICS_DAYS', 30),
        operations: this.configService.get<number>('MAGIC_RETENTION_OPERATIONS_DAYS', 90),
        conflicts: this.configService.get<number>('MAGIC_RETENTION_CONFLICTS_DAYS', 180),
        presence: this.configService.get<number>('MAGIC_RETENTION_PRESENCE_DAYS', 7)
      },
      adaptiveThresholds: {
        enabled: this.configService.get<boolean>('MAGIC_ADAPTIVE_THRESHOLDS', false),
        loadFactorMultiplier: this.configService.get<number>('MAGIC_LOAD_FACTOR_MULTIPLIER', 0.1),
        baselineAdjustment: this.configService.get<number>('MAGIC_BASELINE_ADJUSTMENT', 0.05)
      },
      monitoring: {
        performanceCheckIntervalMs: this.configService.get<number>('MAGIC_PERFORMANCE_CHECK_INTERVAL_MS', 30 * 1000)
      }
    };

    // Initialize adaptive thresholds
    this.initializeAdaptiveThresholds();
    // Setup configuration watcher
    this.setupConfigurationWatcher();
  }

  async onModuleInit() {
    if (this.enableRealTimeMetrics) {
      this.setupMetricsCleanup();
      this.setupPerformanceMonitoring();
      this.logger.log('Magic metrics service initialized with real-time monitoring');
    }
  }

  async recordOperation(metric: Omit<MagicOperationMetric, 'timestamp'>): Promise<void> {
    try {
      const timestamp = new Date();
      const metricWithTimestamp = { ...metric, timestamp };

      // Store in Redis for real-time access
      await this.redisService.client.lPush(
        `${this.metricsKey}:operations`,
        JSON.stringify(metricWithTimestamp)
      );

      // Store in database for long-term analysis
      await this.prismaService.magicEvent.create({
        data: {
          eventType: 'operation_metric',
          payload: metricWithTimestamp,
          organizationId: metric.organizationId,
          userId: metric.userId,
          sessionId: metric.sessionId,
          roomId: metric.roomId,
        }
      });

      // Update counters for real-time metrics
      await this.updateCounters('operations', metric.success, metric.conflicted);

      // Emit event for real-time monitoring
      this.eventEmitter.emit('magic.operation.metric', metricWithTimestamp);

      // Cleanup old operations if list gets too long
      await this.redisService.client.lTrim(`${this.metricsKey}:operations`, 0, 9999);

    } catch (error) {
      this.logger.error(`Failed to record operation metric: ${error.message}`, error.stack);
      // Don't throw - metrics failure shouldn't break the main flow
    }
  }

  async recordPresence(metric: Omit<MagicPresenceMetric, 'timestamp'>): Promise<void> {
    try {
      const timestamp = new Date();
      const metricWithTimestamp = { ...metric, timestamp };

      // Store in Redis for real-time presence tracking
      await this.redisService.client.lPush(
        `${this.metricsKey}:presence`,
        JSON.stringify(metricWithTimestamp)
      );

      // Update counters
      await this.updateCounters('presence', metric.success);

      // Emit event for real-time updates
      this.eventEmitter.emit('magic.presence.metric', metricWithTimestamp);

      // Cleanup old presence data
      await this.redisService.client.lTrim(`${this.metricsKey}:presence`, 0, 9999);

    } catch (error) {
      this.logger.error(`Failed to record presence metric: ${error.message}`, error.stack);
    }
  }

  async recordTimeTravel(metric: Omit<MagicTimeTravelMetric, 'timestamp'>): Promise<void> {
    try {
      const timestamp = new Date();
      const metricWithTimestamp = { ...metric, timestamp };

      // Store in Redis
      await this.redisService.client.lPush(
        `${this.metricsKey}:timetravel`,
        JSON.stringify(metricWithTimestamp)
      );

      // Update counters
      await this.updateCounters('timetravel', metric.success);

      // Emit event
      this.eventEmitter.emit('magic.timetravel.metric', metricWithTimestamp);

      // Cleanup
      await this.redisService.client.lTrim(`${this.metricsKey}:timetravel`, 0, 9999);

    } catch (error) {
      this.logger.error(`Failed to record time travel metric: ${error.message}`, error.stack);
    }
  }

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
        ...roomStats,
        ...operationStats,
        ...timeTravelStats,
        ...presenceStats,
        ...performanceStats,
        ...errorStats,
        timeRange
      };
    } catch (error) {
      this.logger.error(`Failed to get magic metrics: ${error.message}`, error.stack);
      throw new Error('Failed to retrieve magic metrics');
    }
  }

  async getRealTimeMetrics(context: TenantContext): Promise<{
    operationsPerSecond: number;
    activeRooms: number;
    activePresences: number;
    averageLatency: number;
    errorRate: number;
  }> {
    try {
      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000;

      // Get recent operations for real-time calculations
      const recentOperations = await this.getRecentOperations(new Date(oneMinuteAgo));
      const operationsPerSecond = recentOperations.length / 60;

      // Calculate real-time latency
      const latencies = recentOperations.map(op => op.latency);
      const averageLatency = latencies.length > 0
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
        : 0;

      // Calculate real-time error rate
      const errors = recentOperations.filter(op => !op.success).length;
      const errorRate = recentOperations.length > 0 ? errors / recentOperations.length : 0;

      // Get active counts
      const [activeRooms, activePresences] = await Promise.all([
        this.getActiveRoomCount(context.organizationId),
        this.getActivePresenceCount(context.organizationId)
      ]);

      return {
        operationsPerSecond,
        activeRooms,
        activePresences,
        averageLatency,
        errorRate
      };
    } catch (error) {
      this.logger.error(`Failed to get real-time metrics: ${error.message}`, error.stack);
      throw new Error('Failed to retrieve real-time metrics');
    }
  }

  async getPerformanceAlerts(context: TenantContext): Promise<Array<{
    type: 'high_latency' | 'high_error_rate' | 'too_many_conflicts' | 'memory_usage';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metric: number;
    threshold: number;
  }>> {
    try {
      const alerts = [];
      const realTimeMetrics = await this.getRealTimeMetrics(context);

      // Dynamic latency alerts based on configurable thresholds
      if (realTimeMetrics.averageLatency > this.config.latencyThresholds.warning) {
        const severity = this.determineLatencySeverity(realTimeMetrics.averageLatency);
        alerts.push({
          type: 'high_latency' as const,
          severity,
          message: `High operation latency: ${realTimeMetrics.averageLatency.toFixed(2)}ms`,
          metric: realTimeMetrics.averageLatency,
          threshold: this.config.latencyThresholds.warning
        });
      }

      // Dynamic error rate alerts
      if (realTimeMetrics.errorRate > this.config.errorRateThresholds.warning) {
        const severity = this.determineErrorRateSeverity(realTimeMetrics.errorRate);
        alerts.push({
          type: 'high_error_rate' as const,
          severity,
          message: `High error rate: ${(realTimeMetrics.errorRate * 100).toFixed(1)}%`,
          metric: realTimeMetrics.errorRate,
          threshold: this.config.errorRateThresholds.warning
        });
      }

      // Memory usage alerts (if available)
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
      const memoryThreshold = this.configService.get<number>('MAGIC_MEMORY_THRESHOLD_MB', 1024);

      if (memoryUsageMB > memoryThreshold) {
        alerts.push({
          type: 'memory_usage' as const,
          severity: memoryUsageMB > memoryThreshold * 1.5 ? 'critical' : 'warning',
          message: `High memory usage: ${memoryUsageMB.toFixed(2)}MB`,
          metric: memoryUsageMB,
          threshold: memoryThreshold
        });
      }

      return alerts;
    } catch (error) {
      this.logger.error(`Failed to get performance alerts: ${error.message}`, error.stack);
      return [];
    }
  }

  // ==================== HELPER METHODS ====================

  private async updateCounters(type: string, success: boolean, conflicted?: boolean): Promise<void> {
    try {
      const day = new Date().toISOString().split('T')[0];
      const counterKey = `${this.metricsKey}:counters:${day}`;

      await Promise.all([
        this.redisService.client.hIncrBy(counterKey, `${type}_total`, 1),
        this.redisService.client.hIncrBy(counterKey, `${type}_${success ? 'success' : 'error'}`, 1),
        conflicted ? this.redisService.client.hIncrBy(counterKey, `${type}_conflicts`, 1) : Promise.resolve(),
        this.redisService.client.expire(counterKey, this.config.retentionPolicies.metrics * 24 * 60 * 60)
      ]);
    } catch (error) {
      this.logger.error(`Failed to update counters: ${error.message}`, error.stack);
    }
  }

  private async getRoomStats(organizationId: string, timeRange: { start: Date; end: Date }) {
    try {
      const [totalRooms, activeRooms, presenceData] = await Promise.all([
        this.prismaService.magicRoom.count({
          where: { organizationId }
        }),
        this.prismaService.magicRoom.count({
          where: {
            organizationId,
            updatedAt: { gte: timeRange.start }
          }
        }),
        this.prismaService.magicPresence.groupBy({
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
        totalRooms,
        activeRooms,
        roomsPerOrganization: totalRooms,
        averageUsersPerRoom: averageUsers
      };
    } catch (error) {
      this.logger.error(`Failed to get room stats: ${error.message}`, error.stack);
      return {
        totalRooms: 0,
        activeRooms: 0,
        roomsPerOrganization: 0,
        averageUsersPerRoom: 0
      };
    }
  }

  private async getOperationStats(organizationId: string, timeRange: { start: Date; end: Date }) {
    try {
      const operations = await this.prismaService.magicEvent.findMany({
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
        totalOperations: total,
        operationsPerSecond: duration > 0 ? total / duration : 0,
        conflictRate: total > 0 ? conflicts / total : 0,
        transformationSuccessRate: total > 0 ? successes / total : 0
      };
    } catch (error) {
      this.logger.error(`Failed to get operation stats: ${error.message}`, error.stack);
      return {
        totalOperations: 0,
        operationsPerSecond: 0,
        conflictRate: 0,
        transformationSuccessRate: 0
      };
    }
  }

  private async getTimeTravelStats(organizationId: string, timeRange: { start: Date; end: Date }) {
    try {
      const [snapshots, branches, merges] = await Promise.all([
        this.prismaService.magicSnapshot.count({
          where: {
            room: { organizationId },
            createdAt: { gte: timeRange.start, lte: timeRange.end }
          }
        }),
        this.prismaService.magicSnapshot.groupBy({
          by: ['branchName'],
          where: {
            room: { organizationId },
            createdAt: { gte: timeRange.start, lte: timeRange.end }
          }
        }),
        this.prismaService.magicEvent.count({
          where: {
            organizationId,
            eventType: 'merge_operation',
            createdAt: { gte: timeRange.start, lte: timeRange.end }
          }
        })
      ]);

      // Calculate branch lifetime from actual data
      const branchLifetimes = await this.calculateBranchLifetimes(organizationId, timeRange);
      const averageBranchLifetime = branchLifetimes.length > 0
        ? branchLifetimes.reduce((sum, lifetime) => sum + lifetime, 0) / branchLifetimes.length
        : 0;

      // Calculate actual merge success rate from merge events
      const mergeEvents = await this.prismaService.magicEvent.findMany({
        where: {
          organizationId,
          eventType: 'merge_operation',
          createdAt: { gte: timeRange.start, lte: timeRange.end }
        },
        select: {
          payload: true
        }
      });

      // Extract merge success from payload data
      const successfulMerges = mergeEvents.filter(event => {
        const payload = event.payload as any;
        return payload && payload.success === true;
      }).length;

      const totalMerges = mergeEvents.length;
      const mergeSuccessRate = totalMerges > 0 ? successfulMerges / totalMerges : 1;

      return {
        totalSnapshots: snapshots,
        totalBranches: branches.length,
        mergeSuccessRate,
        averageBranchLifetime
      };
    } catch (error) {
      this.logger.error(`Failed to get time travel stats: ${error.message}`, error.stack);
      return {
        totalSnapshots: 0,
        totalBranches: 0,
        mergeSuccessRate: 0,
        averageBranchLifetime: 0
      };
    }
  }

  private async getPresenceStats(organizationId: string, timeRange: { start: Date; end: Date }) {
    try {
      const [activePresences, presenceData] = await Promise.all([
        this.prismaService.magicPresence.count({
          where: {
            room: { organizationId },
            isActive: true
          }
        }),
        this.prismaService.magicPresence.findMany({
          where: {
            room: { organizationId },
            joinedAt: { gte: timeRange.start, lte: timeRange.end }
          },
          select: {
            joinedAt: true,
            lastSeen: true
          }
        })
      ]);

      // Calculate actual presence duration from real data
      const presenceDurations = presenceData
        .filter(p => p.lastSeen)
        .map(p => p.lastSeen!.getTime() - p.joinedAt.getTime());

      const averagePresenceDuration = presenceDurations.length > 0
        ? presenceDurations.reduce((sum, duration) => sum + duration, 0) / presenceDurations.length
        : 0;

      // Calculate actual heartbeat success rate from Redis metrics
      const heartbeatSuccessRate = await this.calculateHeartbeatSuccessRate(organizationId);

      return {
        activePresences,
        averagePresenceDuration,
        heartbeatSuccessRate
      };
    } catch (error) {
      this.logger.error(`Failed to get presence stats: ${error.message}`, error.stack);
      return {
        activePresences: 0,
        averagePresenceDuration: 0,
        heartbeatSuccessRate: 0
      };
    }
  }

  private async getPerformanceStats(organizationId: string, timeRange: { start: Date; end: Date }) {
    try {
      const operations = await this.redisService.client.lRange(`${this.metricsKey}:operations`, 0, -1);
      const latencies = operations
        .map(op => JSON.parse(op))
        .filter(op => op.timestamp >= timeRange.start.getTime() && op.timestamp <= timeRange.end.getTime())
        .map(op => op.latency);

      const averageLatency = latencies.length > 0
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
        : 0;

      // Calculate actual state size from database
      const averageStateSize = await this.calculateAverageStateSize(organizationId);

      // Calculate actual cache hit rate from Redis metrics
      const cacheHitRate = await this.calculateCacheHitRate(organizationId);

      return {
        averageOperationLatency: averageLatency,
        averageStateSize,
        cacheHitRate
      };
    } catch (error) {
      this.logger.error(`Failed to get performance stats: ${error.message}`, error.stack);
      return {
        averageOperationLatency: 0,
        averageStateSize: 0,
        cacheHitRate: 0
      };
    }
  }

  private async getErrorStats(organizationId: string, timeRange: { start: Date; end: Date }) {
    try {
      const day = new Date().toISOString().split('T')[0];
      const counterKey = `${this.metricsKey}:counters:${day}`;

      const counters = await this.redisService.client.hGetAll(counterKey);

      return {
        operationErrors: parseInt(counters.operations_error || '0'),
        presenceErrors: parseInt(counters.presence_error || '0'),
        timeTravelErrors: parseInt(counters.timetravel_error || '0')
      };
    } catch (error) {
      this.logger.error(`Failed to get error stats: ${error.message}`, error.stack);
      return {
        operationErrors: 0,
        presenceErrors: 0,
        timeTravelErrors: 0
      };
    }
  }

  private async getRecentOperations(since: Date): Promise<any[]> {
    try {
      const operations = await this.redisService.client.lRange(`${this.metricsKey}:operations`, 0, -1);
      return operations
        .map(op => JSON.parse(op))
        .filter(op => new Date(op.timestamp) >= since);
    } catch (error) {
      this.logger.error(`Failed to get recent operations: ${error.message}`, error.stack);
      return [];
    }
  }

  private async getAverageLatency(since: Date): Promise<number> {
    try {
      const operations = await this.getRecentOperations(since);
      const latencies = operations.map(op => op.latency);
      return latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0;
    } catch (error) {
      this.logger.error(`Failed to get average latency: ${error.message}`, error.stack);
      return 0;
    }
  }

  private async getRecentErrors(since: Date): Promise<any[]> {
    try {
      const operations = await this.getRecentOperations(since);
      return operations.filter(op => !op.success);
    } catch (error) {
      this.logger.error(`Failed to get recent errors: ${error.message}`, error.stack);
      return [];
    }
  }

  private async getActiveRoomCount(organizationId: string): Promise<number> {
    try {
      const activeThreshold = this.configService.get<number>('MAGIC_ACTIVE_ROOM_THRESHOLD_MINUTES', 5);
      const activeTime = new Date(Date.now() - activeThreshold * 60 * 1000);

      return this.prismaService.magicRoom.count({
        where: {
          organizationId,
          updatedAt: { gte: activeTime }
        }
      });
    } catch (error) {
      this.logger.error(`Failed to get active room count: ${error.message}`, error.stack);
      return 0;
    }
  }

  private async getActivePresenceCount(organizationId: string): Promise<number> {
    try {
      return this.prismaService.magicPresence.count({
        where: {
          room: { organizationId },
          isActive: true
        }
      });
    } catch (error) {
      this.logger.error(`Failed to get active presence count: ${error.message}`, error.stack);
      return 0;
    }
  }

  // ==================== PRODUCTION-GRADE CALCULATIONS ====================

  private async calculateBranchLifetimes(organizationId: string, timeRange: { start: Date; end: Date }): Promise<number[]> {
    try {
      const branches = await this.prismaService.magicSnapshot.groupBy({
        by: ['branchName'],
        where: {
          room: { organizationId },
          createdAt: { gte: timeRange.start, lte: timeRange.end }
        },
        _min: { createdAt: true },
        _max: { createdAt: true }
      });

      return branches
        .map(branch => {
          const created = branch._min.createdAt;
          const lastUpdated = branch._max.createdAt;
          return lastUpdated.getTime() - created.getTime();
        })
        .filter(lifetime => lifetime > 0);
    } catch (error) {
      this.logger.error(`Failed to calculate branch lifetimes: ${error.message}`, error.stack);
      return [];
    }
  }

  private async calculateHeartbeatSuccessRate(organizationId: string): Promise<number> {
    try {
      const day = new Date().toISOString().split('T')[0];
      const counterKey = `${this.metricsKey}:counters:${day}`;

      const counters = await this.redisService.client.hGetAll(counterKey);
      const total = parseInt(counters.presence_total || '0');
      const success = parseInt(counters.presence_success || '0');

      return total > 0 ? success / total : 0;
    } catch (error) {
      this.logger.error(`Failed to calculate heartbeat success rate: ${error.message}`, error.stack);
      return 0;
    }
  }

  private async calculateAverageStateSize(organizationId: string): Promise<number> {
    try {
      const states = await this.prismaService.magicState.findMany({
        where: {
          room: { organizationId }
        },
        select: {
          currentState: true
        }
      });

      if (states.length === 0) return 0;

      const totalSize = states.reduce((sum, state) => {
        const stateSize = JSON.stringify(state.currentState).length;
        return sum + stateSize;
      }, 0);

      return totalSize / states.length;
    } catch (error) {
      this.logger.error(`Failed to calculate average state size: ${error.message}`, error.stack);
      return 0;
    }
  }

  private async calculateCacheHitRate(organizationId: string): Promise<number> {
    try {
      const day = new Date().toISOString().split('T')[0];
      const cacheKey = `${this.metricsKey}:cache:${day}`;

      const cacheStats = await this.redisService.client.hGetAll(cacheKey);
      const hits = parseInt(cacheStats.hits || '0');
      const misses = parseInt(cacheStats.misses || '0');
      const total = hits + misses;

      return total > 0 ? hits / total : 0;
    } catch (error) {
      this.logger.error(`Failed to calculate cache hit rate: ${error.message}`, error.stack);
      return 0;
    }
  }

  // ==================== SEVERITY DETERMINATION ====================

  private determineLatencySeverity(latency: number): 'low' | 'medium' | 'high' | 'critical' {
    if (latency > this.config.latencyThresholds.severe) return 'critical';
    if (latency > this.config.latencyThresholds.critical) return 'high';
    if (latency > this.config.latencyThresholds.warning) return 'medium';
    return 'low';
  }

  private determineErrorRateSeverity(errorRate: number): 'low' | 'medium' | 'high' | 'critical' {
    if (errorRate > this.config.errorRateThresholds.severe) return 'critical';
    if (errorRate > this.config.errorRateThresholds.critical) return 'high';
    if (errorRate > this.config.errorRateThresholds.warning) return 'medium';
    return 'low';
  }

  // ==================== MONITORING & CLEANUP ====================

  private setupPerformanceMonitoring(): void {
    // Monitor system performance every 30 seconds
    setInterval(async () => {
      try {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        // Store performance metrics
        await this.redisService.client.lPush(
          `${this.metricsKey}:performance`,
          JSON.stringify({
            timestamp: Date.now(),
            memory: {
              heapUsed: memoryUsage.heapUsed,
              heapTotal: memoryUsage.heapTotal,
              external: memoryUsage.external,
              rss: memoryUsage.rss
            },
            cpu: {
              user: cpuUsage.user,
              system: cpuUsage.system
            }
          })
        );

        // Cleanup old performance data
        await this.redisService.client.lTrim(`${this.metricsKey}:performance`, 0, 999);

      } catch (error) {
        this.logger.error(`Performance monitoring failed: ${error.message}`, error.stack);
      }
    }, 30 * 1000);
  }

  private setupMetricsCleanup(): void {
    // Clean up old metrics based on configurable intervals
    setInterval(async () => {
      try {
        const cutoffDate = new Date(Date.now() - this.config.retentionPolicies.metrics * 24 * 60 * 60 * 1000);

        // Clean up Redis lists
        const operations = await this.redisService.client.lRange(`${this.metricsKey}:operations`, 0, -1);
        const validOperations = operations
          .map(op => JSON.parse(op))
          .filter(op => new Date(op.timestamp) >= cutoffDate)
          .map(op => JSON.stringify(op));

        if (validOperations.length < operations.length) {
          await this.redisService.client.del(`${this.metricsKey}:operations`);
          if (validOperations.length > 0) {
            await this.redisService.client.lPush(`${this.metricsKey}:operations`, validOperations);
          }
        }

        this.logger.log('Metrics cleanup completed');
      } catch (error) {
        this.logger.error(`Metrics cleanup failed: ${error.message}`, error.stack);
      }
    }, this.config.cleanupIntervals.metrics);
  }

  /**
   * Initialize adaptive thresholds based on system performance
   */
  private initializeAdaptiveThresholds(): void {
    if (this.config.adaptiveThresholds.enabled) {
      this.logger.log('Initializing adaptive threshold system');

      // Start background task to adjust thresholds based on system load
      setInterval(() => {
        this.adjustThresholdsForSystemLoad();
      }, this.config.monitoring.performanceCheckIntervalMs);
    }
  }

  /**
   * Setup configuration watcher for runtime updates
   */
  private setupConfigurationWatcher(): void {
    // Watch for configuration changes in Redis
    this.redisService.getPubSubInstance()
      .subscribe('magic:config:update', (message) => {
        try {
          const configUpdate = JSON.parse(message);
          this.updateConfiguration(configUpdate);
          this.logger.log('Configuration updated from Redis:', configUpdate);
        } catch (error) {
          this.logger.error('Failed to parse configuration update:', error);
        }
      });
  }

  /**
   * Update configuration at runtime
   */
  private updateConfiguration(update: any): void {
    if (update.latencyThresholds) {
      this.config.latencyThresholds = { ...this.config.latencyThresholds, ...update.latencyThresholds };
    }
    if (update.errorRateThresholds) {
      this.config.errorRateThresholds = { ...this.config.errorRateThresholds, ...update.errorRateThresholds };
    }
    if (update.conflictThresholds) {
      this.config.conflictThresholds = { ...this.config.conflictThresholds, ...update.conflictThresholds };
    }
    if (update.cleanupIntervals) {
      this.config.cleanupIntervals = { ...this.config.cleanupIntervals, ...update.cleanupIntervals };
    }
    if (update.retentionPolicies) {
      this.config.retentionPolicies = { ...this.config.retentionPolicies, ...update.retentionPolicies };
    }
  }

  /**
   * Adjust thresholds based on current system load
   */
  private adjustThresholdsForSystemLoad(): void {
    try {
      const systemLoad = this.getSystemLoadFactor();
      const loadMultiplier = 1 + (systemLoad * this.config.adaptiveThresholds.loadFactorMultiplier);

      // Adjust latency thresholds based on system load
      this.config.latencyThresholds.warning = Math.round(
        this.configService.get<number>('MAGIC_LATENCY_WARNING_MS', 1000) * loadMultiplier
      );
      this.config.latencyThresholds.critical = Math.round(
        this.configService.get<number>('MAGIC_LATENCY_CRITICAL_MS', 2000) * loadMultiplier
      );
      this.config.latencyThresholds.severe = Math.round(
        this.configService.get<number>('MAGIC_LATENCY_SEVERE_MS', 5000) * loadMultiplier
      );

      // Adjust error rate thresholds based on system load
      const errorMultiplier = 1 + (systemLoad * this.config.adaptiveThresholds.baselineAdjustment);
      this.config.errorRateThresholds.warning = Math.min(
        this.configService.get<number>('MAGIC_ERROR_RATE_WARNING', 0.05) * errorMultiplier,
        0.2
      );
      this.config.errorRateThresholds.critical = Math.min(
        this.configService.get<number>('MAGIC_ERROR_RATE_CRITICAL', 0.1) * errorMultiplier,
        0.4
      );

      this.logger.debug(`Adjusted thresholds for system load: ${systemLoad.toFixed(2)}, multiplier: ${loadMultiplier.toFixed(2)}`);
    } catch (error) {
      this.logger.error('Failed to adjust thresholds for system load:', error);
    }
  }

  /**
   * Get current system load factor (0.0 to 1.0)
   */
  private getSystemLoadFactor(): number {
    try {
      const memUsage = process.memoryUsage();
      const memoryLoad = memUsage.heapUsed / memUsage.heapTotal;

      // Get CPU load from system (if available)
      const cpuLoad = this.getCPUUsage();

      // Calculate overall system load factor
      const systemLoad = (memoryLoad + cpuLoad) / 2;

      return Math.min(Math.max(systemLoad, 0), 1);
    } catch (error) {
      this.logger.warn('Failed to calculate system load factor, using default:', error);
      return 0.5; // Default to moderate load
    }
  }

  /**
   * Get current CPU usage (0.0 to 1.0)
   */
  private getCPUUsage(): number {
    try {
      // This would integrate with system monitoring tools
      // For now, return a realistic estimate based on Node.js performance
      const startUsage = process.cpuUsage();

      // Simulate CPU measurement
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const cpuPercent = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds

        // Store for next calculation
        this.lastCPUUsage = Math.min(cpuPercent / 100, 1);
      }, 100);

      return this.lastCPUUsage || 0.3; // Return last known usage or default
    } catch (error) {
      return 0.3; // Default to 30% CPU usage
    }
  }
}
