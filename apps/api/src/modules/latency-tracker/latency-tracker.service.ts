import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/services/redis.service';

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
  private readonly maxMetricsPerOperation: number;
  private readonly flushInterval: number;

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    this.maxMetricsPerOperation = this.configService.get<number>('monitoring.maxMetricsPerOperation', 1000);
    this.flushInterval = this.configService.get<number>('monitoring.flushInterval', 60000); // 1 minute
    
    this.startPeriodicFlush();
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

  // Real-time monitoring alerts
  checkPerformanceAlerts(): Array<{
    operation: string;
    alertType: string;
    value: number;
    threshold: number;
  }> {
    const alerts: Array<{
      operation: string;
      alertType: string;
      value: number;
      threshold: number;
    }> = [];

    const thresholds = {
      highLatency: this.configService.get<number>('monitoring.alerts.highLatency', 5000), // 5 seconds
      highErrorRate: this.configService.get<number>('monitoring.alerts.highErrorRate', 0.1), // 10%
      lowThroughput: this.configService.get<number>('monitoring.alerts.lowThroughput', 10), // 10 ops/min
    };

    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const stats = this.getAllStats(timeWindow);

    for (const stat of stats) {
      // High latency alert
      if (stat.p95 > thresholds.highLatency) {
        alerts.push({
          operation: stat.operation,
          alertType: 'HIGH_LATENCY',
          value: stat.p95,
          threshold: thresholds.highLatency,
        });
      }

      // High error rate alert
      if (stat.errorRate > thresholds.highErrorRate) {
        alerts.push({
          operation: stat.operation,
          alertType: 'HIGH_ERROR_RATE',
          value: stat.errorRate,
          threshold: thresholds.highErrorRate,
        });
      }

      // Low throughput alert (operations per minute)
      const opsPerMinute = (stat.count / timeWindow) * 60 * 1000;
      if (opsPerMinute < thresholds.lowThroughput) {
        alerts.push({
          operation: stat.operation,
          alertType: 'LOW_THROUGHPUT',
          value: opsPerMinute,
          threshold: thresholds.lowThroughput,
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
      memoryUsage: NodeJS.MemoryUsage;
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
        await this.redisService.getRedisInstance().setEx(
          key,
          3600, // 1 hour TTL
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
  clearOldMetrics(maxAge: number = 3600000): void { // Default 1 hour
    const cutoff = Date.now() - maxAge;
    
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
