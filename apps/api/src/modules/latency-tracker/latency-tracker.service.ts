import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/services/redis.service';
import * as os from 'os';

export interface LatencyMetric {
  operation: string;
  duration: number;
  timestamp: number;
  organizationId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceStats {
  operation: string;
  count: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
}

@Injectable()
export class LatencyTrackerService {
  private readonly logger = new Logger(LatencyTrackerService.name);
  private metrics = new Map<string, LatencyMetric[]>();
  private maxMetricsPerOperation: number;
  private flushInterval: number;
  private config: {
    // Performance monitoring configuration
    monitoring: {
      maxMetricsPerOperation: number;
      flushInterval: number;
      timeWindow: number;
      maxAge: number;
      ttl: number;
    };
    // Alert thresholds - fully configurable via environment
    alerts: {
      latency: {
        warning: number;
        critical: number;
        severe: number;
      };
      errorRate: {
        warning: number;
        critical: number;
        severe: number;
      };
      throughput: {
        warning: number;
        critical: number;
        severe: number;
      };
    };
    // Adaptive thresholds based on system load
    adaptive: {
      enabled: boolean;
      loadFactorThreshold: number;
      adjustmentFactor: number;
    };
  };

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    this.loadConfiguration();
    this.startPeriodicFlush();
    this.setupConfigurationWatcher();
  }

  private loadConfiguration(): void {
    this.config = {
      monitoring: {
        maxMetricsPerOperation: this.configService.get<number>('monitoring.maxMetricsPerOperation', 1000),
        flushInterval: this.configService.get<number>('monitoring.flushInterval', 60000), // 1 minute
        timeWindow: this.configService.get<number>('monitoring.timeWindow', 5 * 60 * 1000), // 5 minutes
        maxAge: this.configService.get<number>('monitoring.maxAge', 3600000), // 1 hour
        ttl: this.configService.get<number>('monitoring.ttl', 3600), // 1 hour
      },
      alerts: {
        latency: {
          warning: this.configService.get<number>('monitoring.alerts.latency.warning', 2000), // 2 seconds
          critical: this.configService.get<number>('monitoring.alerts.latency.critical', 5000), // 5 seconds
          severe: this.configService.get<number>('monitoring.alerts.latency.severe', 10000), // 10 seconds
        },
        errorRate: {
          warning: this.configService.get<number>('monitoring.alerts.errorRate.warning', 0.05), // 5%
          critical: this.configService.get<number>('monitoring.alerts.errorRate.critical', 0.1), // 10%
          severe: this.configService.get<number>('monitoring.alerts.errorRate.severe', 0.25), // 25%
        },
        throughput: {
          warning: this.configService.get<number>('monitoring.alerts.throughput.warning', 20), // 20 ops/min
          critical: this.configService.get<number>('monitoring.alerts.throughput.critical', 10), // 10 ops/min
          severe: this.configService.get<number>('monitoring.alerts.throughput.severe', 5), // 5 ops/min
        },
      },
      adaptive: {
        enabled: this.configService.get<boolean>('monitoring.adaptive.enabled', true),
        loadFactorThreshold: this.configService.get<number>('monitoring.adaptive.loadFactorThreshold', 0.7),
        adjustmentFactor: this.configService.get<number>('monitoring.adaptive.adjustmentFactor', 1.5),
      },
    };

    this.maxMetricsPerOperation = this.config.monitoring.maxMetricsPerOperation;
    this.flushInterval = this.config.monitoring.flushInterval;
  }

  private setupConfigurationWatcher(): void {
    // Watch for configuration changes via Redis pub/sub
    this.redisService.subscribe('config:latency-tracker', (message) => {
      try {
        const configUpdate = JSON.parse(message);
        this.updateConfiguration(configUpdate);
      } catch (error) {
        this.logger.error('Failed to parse configuration update:', error);
      }
    });
  }

  private updateConfiguration(configUpdate: any): void {
    if (configUpdate.alerts) {
      this.config.alerts = { ...this.config.alerts, ...configUpdate.alerts };
    }
    if (configUpdate.monitoring) {
      this.config.monitoring = { ...this.config.monitoring, ...configUpdate.monitoring };
    }
    if (configUpdate.adaptive) {
      this.config.adaptive = { ...this.config.adaptive, ...configUpdate.adaptive };
    }

    this.logger.log('Latency tracker configuration updated');
  }

  private getAdaptiveThresholds(): typeof this.config.alerts {
    if (!this.config.adaptive.enabled) {
      return this.config.alerts;
    }

    const loadFactor = this.getSystemLoadFactor();
    if (loadFactor > this.config.adaptive.loadFactorThreshold) {
      const adjustment = this.config.adaptive.adjustmentFactor;
      return {
        latency: {
          warning: this.config.alerts.latency.warning * adjustment,
          critical: this.config.alerts.latency.critical * adjustment,
          severe: this.config.alerts.latency.severe * adjustment,
        },
        errorRate: {
          warning: this.config.alerts.errorRate.warning * adjustment,
          critical: this.config.alerts.errorRate.critical * adjustment,
          severe: this.config.alerts.errorRate.severe * adjustment,
        },
        throughput: {
          warning: this.config.alerts.throughput.warning / adjustment,
          critical: this.config.alerts.throughput.critical / adjustment,
          severe: this.config.alerts.throughput.severe / adjustment,
        },
      };
    }

    return this.config.alerts;
  }

  private getSystemLoadFactor(): number {
    const memUsage = process.memoryUsage();
    const cpuUsage = this.getCPUUsage();
    const loadAvg = this.getLoadAverage();

    // Normalize factors (0-1 range)
    const memoryFactor = memUsage.heapUsed / memUsage.heapTotal;
    const cpuFactor = Math.min(cpuUsage, 1); // CPU usage is already 0-1
    const loadFactor = Math.min(loadAvg / 10, 1); // Assuming 10 is high load

    // Weighted average
    return (memoryFactor * 0.4 + cpuFactor * 0.4 + loadFactor * 0.2);
  }

  private getCPUUsage(): number {
    try {
      // Production-grade CPU monitoring using system metrics
      const cpus = os.cpus();

      if (cpus.length === 0) {
        return 0.3; // Fallback if CPU info unavailable
      }

      // Calculate CPU usage from all cores
      let totalIdle = 0;
      let totalTick = 0;

      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });

      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      const cpuUsage = 1 - (idle / total);

      return Math.min(Math.max(cpuUsage, 0), 1);
    } catch (error) {
      this.logger.warn('Failed to get CPU usage, using fallback:', error);
      return 0.3; // Conservative fallback
    }
  }

  private getLoadAverage(): number {
    try {
      // Production-grade load average monitoring
      const loadAvg = os.loadavg();

      // Return 1-minute load average (most relevant for real-time monitoring)
      return loadAvg[0] || 1.0; // Fallback to 1.0 if unavailable
    } catch (error) {
      this.logger.warn('Failed to get load average, using fallback:', error);
      return 1.0; // Conservative fallback
    }
  }

  // Track latency for operations
  trackLatency(
    operation: string,
    duration: number,
    organizationId?: string,
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    const metric: LatencyMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      organizationId,
      userId,
      metadata,
    };

    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const operationMetrics = this.metrics.get(operation)!;
    operationMetrics.push(metric);

    // Keep only recent metrics to prevent memory issues
    if (operationMetrics.length > this.maxMetricsPerOperation) {
      operationMetrics.splice(0, operationMetrics.length - this.maxMetricsPerOperation);
    }

    this.logger.debug(`Tracked latency for ${operation}: ${duration}ms`);
  }

  // Measure and track operation execution time
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    organizationId?: string,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    let error: any = null;

    try {
      const result = await fn();
      return result;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const duration = Date.now() - startTime;

      this.trackLatency(operation, duration, organizationId, userId, {
        ...metadata,
        error: error ? error.message : undefined,
        success: !error,
      });
    }
  }

  // Get performance statistics for an operation
  getOperationStats(operation: string, timeWindow?: number): PerformanceStats | null {
    const operationMetrics = this.metrics.get(operation);
    if (!operationMetrics || operationMetrics.length === 0) {
      return null;
    }

    const now = Date.now();
    const windowStart = timeWindow ? now - timeWindow : 0;

    const relevantMetrics = operationMetrics.filter(
      metric => metric.timestamp >= windowStart
    );

    if (relevantMetrics.length === 0) {
      return null;
    }

    const durations = relevantMetrics.map(m => m.duration).sort((a, b) => a - b);
    const errorCount = relevantMetrics.filter(m => m.metadata?.error).length;

    return {
      operation,
      count: relevantMetrics.length,
      avgLatency: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minLatency: durations[0],
      maxLatency: durations[durations.length - 1],
      p50: this.getPercentile(durations, 0.5),
      p95: this.getPercentile(durations, 0.95),
      p99: this.getPercentile(durations, 0.99),
      errorRate: errorCount / relevantMetrics.length,
    };
  }

  // Get all operation statistics
  getAllStats(timeWindow?: number): PerformanceStats[] {
    const stats: PerformanceStats[] = [];

    for (const operation of this.metrics.keys()) {
      const operationStats = this.getOperationStats(operation, timeWindow);
      if (operationStats) {
        stats.push(operationStats);
      }
    }

    return stats.sort((a, b) => b.count - a.count);
  }

  // Get organization-specific statistics
  getOrganizationStats(organizationId: string, timeWindow?: number): PerformanceStats[] {
    const stats: PerformanceStats[] = [];

    for (const [operation, metrics] of this.metrics.entries()) {
      const now = Date.now();
      const windowStart = timeWindow ? now - timeWindow : 0;

      const relevantMetrics = metrics.filter(
        metric => metric.organizationId === organizationId && metric.timestamp >= windowStart
      );

      if (relevantMetrics.length === 0) {
        continue;
      }

      const durations = relevantMetrics.map(m => m.duration).sort((a, b) => a - b);
      const errorCount = relevantMetrics.filter(m => m.metadata?.error).length;

      stats.push({
        operation,
        count: relevantMetrics.length,
        avgLatency: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minLatency: durations[0],
        maxLatency: durations[durations.length - 1],
        p50: this.getPercentile(durations, 0.5),
        p95: this.getPercentile(durations, 0.95),
        p99: this.getPercentile(durations, 0.99),
        errorRate: errorCount / relevantMetrics.length,
      });
    }

    return stats.sort((a, b) => b.count - a.count);
  }

  // Real-time monitoring alerts with adaptive thresholds
  checkPerformanceAlerts(): Array<{
    operation: string;
    alertType: string;
    severity: 'WARNING' | 'CRITICAL' | 'SEVERE';
    value: number;
    threshold: number;
    loadFactor: number;
  }> {
    const alerts: Array<{
      operation: string;
      alertType: string;
      severity: 'WARNING' | 'CRITICAL' | 'SEVERE';
      value: number;
      threshold: number;
      loadFactor: number;
    }> = [];

    const adaptiveThresholds = this.getAdaptiveThresholds();
    const loadFactor = this.getSystemLoadFactor();
    const timeWindow = this.config.monitoring.timeWindow;
    const stats = this.getAllStats(timeWindow);

    for (const stat of stats) {
      // Latency alerts with severity levels
      if (stat.p95 > adaptiveThresholds.latency.severe) {
        alerts.push({
          operation: stat.operation,
          alertType: 'HIGH_LATENCY',
          severity: 'SEVERE',
          value: stat.p95,
          threshold: adaptiveThresholds.latency.severe,
          loadFactor,
        });
      } else if (stat.p95 > adaptiveThresholds.latency.critical) {
        alerts.push({
          operation: stat.operation,
          alertType: 'HIGH_LATENCY',
          severity: 'CRITICAL',
          value: stat.p95,
          threshold: adaptiveThresholds.latency.critical,
          loadFactor,
        });
      } else if (stat.p95 > adaptiveThresholds.latency.warning) {
        alerts.push({
          operation: stat.operation,
          alertType: 'HIGH_LATENCY',
          severity: 'WARNING',
          value: stat.p95,
          threshold: adaptiveThresholds.latency.warning,
          loadFactor,
        });
      }

      // Error rate alerts with severity levels
      if (stat.errorRate > adaptiveThresholds.errorRate.severe) {
        alerts.push({
          operation: stat.operation,
          alertType: 'HIGH_ERROR_RATE',
          severity: 'SEVERE',
          value: stat.errorRate,
          threshold: adaptiveThresholds.errorRate.severe,
          loadFactor,
        });
      } else if (stat.errorRate > adaptiveThresholds.errorRate.critical) {
        alerts.push({
          operation: stat.operation,
          alertType: 'HIGH_ERROR_RATE',
          severity: 'CRITICAL',
          value: stat.errorRate,
          threshold: adaptiveThresholds.errorRate.critical,
          loadFactor,
        });
      } else if (stat.errorRate > adaptiveThresholds.errorRate.warning) {
        alerts.push({
          operation: stat.operation,
          alertType: 'HIGH_ERROR_RATE',
          severity: 'WARNING',
          value: stat.errorRate,
          threshold: adaptiveThresholds.errorRate.warning,
          loadFactor,
        });
      }

      // Throughput alerts with severity levels
      const opsPerMinute = (stat.count / timeWindow) * 60 * 1000;
      if (opsPerMinute < adaptiveThresholds.throughput.severe) {
        alerts.push({
          operation: stat.operation,
          alertType: 'LOW_THROUGHPUT',
          severity: 'SEVERE',
          value: opsPerMinute,
          threshold: adaptiveThresholds.throughput.severe,
          loadFactor,
        });
      } else if (opsPerMinute < adaptiveThresholds.throughput.critical) {
        alerts.push({
          operation: stat.operation,
          alertType: 'LOW_THROUGHPUT',
          severity: 'CRITICAL',
          value: opsPerMinute,
          threshold: adaptiveThresholds.throughput.critical,
          loadFactor,
        });
      } else if (opsPerMinute < adaptiveThresholds.throughput.warning) {
        alerts.push({
          operation: stat.operation,
          alertType: 'LOW_THROUGHPUT',
          severity: 'WARNING',
          value: opsPerMinute,
          threshold: adaptiveThresholds.throughput.warning,
          loadFactor,
        });
      }
    }

    return alerts;
  }

  // Export metrics for external monitoring systems
  async exportMetrics(): Promise<{
    timestamp: number;
    metrics: PerformanceStats[];
    systemMetrics: {
      memoryUsage: ReturnType<typeof process.memoryUsage>;
      uptime: number;
      activeConnections: number;
    };
  }> {
    const stats = this.getAllStats();
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Get active connections count (would need to be injected from connection manager)
    const activeConnections = 0; // Placeholder

    return {
      timestamp: Date.now(),
      metrics: stats,
      systemMetrics: {
        memoryUsage,
        uptime,
        activeConnections,
      },
    };
  }

  // Flush metrics to Redis for persistence
  private async flushMetricsToRedis(): Promise<void> {
    try {
      const stats = this.getAllStats();
      const timestamp = Date.now();

      for (const stat of stats) {
        const key = `metrics:${stat.operation}:${Math.floor(timestamp / 60000)}`; // Per minute
        await this.redisService.setex(
          key,
          this.config.monitoring.ttl, // Configurable TTL
          JSON.stringify(stat)
        );
      }

      this.logger.debug(`Flushed ${stats.length} metric stats to Redis`);
    } catch (error) {
      this.logger.error('Failed to flush metrics to Redis:', error);
    }
  }

  // Start periodic flush to Redis
  private startPeriodicFlush(): void {
    setInterval(async () => {
      await this.flushMetricsToRedis();
    }, this.flushInterval);
  }

  // Helper method to calculate percentiles
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  // Clear old metrics to prevent memory leaks
  clearOldMetrics(maxAge?: number): void {
    const cutoff = Date.now() - (maxAge || this.config.monitoring.maxAge);

    for (const [operation, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(metric => metric.timestamp >= cutoff);
      this.metrics.set(operation, filteredMetrics);
    }
  }

  // Get current memory usage of metrics
  getMetricsMemoryUsage(): {
    totalMetrics: number;
    operationCount: number;
    estimatedMemoryMB: number;
  } {
    let totalMetrics = 0;

    for (const metrics of this.metrics.values()) {
      totalMetrics += metrics.length;
    }

    // Rough estimation: each metric ~200 bytes
    const estimatedMemoryMB = (totalMetrics * 200) / (1024 * 1024);

    return {
      totalMetrics,
      operationCount: this.metrics.size,
      estimatedMemoryMB: Math.round(estimatedMemoryMB * 100) / 100,
    };
  }
}
