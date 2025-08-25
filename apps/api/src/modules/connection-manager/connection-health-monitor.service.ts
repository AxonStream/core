import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConnectionManagerService } from './connection-manager.service';

export interface HealthMetrics {
  timestamp: Date;
  totalConnections: number;
  healthyConnections: number;
  unhealthyConnections: number;
  averageLatency: number;
  connectionQualityDistribution: Record<string, number>;
  reconnectionRate: number;
  errorRate: number;
  systemLoad: number;
}

export interface HealthAlert {
  id: string;
  type: 'HIGH_LATENCY' | 'HIGH_ERROR_RATE' | 'LOW_CONNECTION_QUALITY' | 'SYSTEM_OVERLOAD';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  metrics: Partial<HealthMetrics>;
  timestamp: Date;
  acknowledged: boolean;
}

export interface HealthThresholds {
  maxAverageLatency: number;
  maxErrorRate: number;
  minHealthyConnectionRatio: number;
  maxSystemLoad: number;
  maxReconnectionRate: number;
}

@Injectable()
export class ConnectionHealthMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConnectionHealthMonitorService.name);
  private monitoringInterval: NodeJS.Timeout;
  private alertsCleanupInterval: NodeJS.Timeout;
  private healthHistory: HealthMetrics[] = [];
  private activeAlerts = new Map<string, HealthAlert>();
  private alertCounter = 0;

  private readonly thresholds: HealthThresholds;
  private readonly monitoringIntervalMs: number;
  private readonly historyRetentionMs: number;

  constructor(
    private connectionManager: ConnectionManagerService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.thresholds = {
      maxAverageLatency: this.configService.get<number>('health.thresholds.maxAverageLatency', 1000),
      maxErrorRate: this.configService.get<number>('health.thresholds.maxErrorRate', 0.1),
      minHealthyConnectionRatio: this.configService.get<number>('health.thresholds.minHealthyConnectionRatio', 0.8),
      maxSystemLoad: this.configService.get<number>('health.thresholds.maxSystemLoad', 0.8),
      maxReconnectionRate: this.configService.get<number>('health.thresholds.maxReconnectionRate', 0.2),
    };

    this.monitoringIntervalMs = this.configService.get<number>('health.monitoring.interval', 30000); // 30 seconds
    this.historyRetentionMs = this.configService.get<number>('health.monitoring.historyRetention', 3600000); // 1 hour
  }

  async onModuleInit() {
    this.startMonitoring();
    this.startAlertsCleanup();
    this.logger.log('Connection Health Monitor started');
  }

  async onModuleDestroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.alertsCleanupInterval) {
      clearInterval(this.alertsCleanupInterval);
    }
    this.logger.log('Connection Health Monitor stopped');
  }

  // Get current health metrics
  getCurrentHealthMetrics(): HealthMetrics {
    const stats = this.connectionManager.getConnectionStats();
    const connections = this.connectionManager.getAllConnections();
    
    const healthyConnections = connections.filter(conn => 
      conn.connectionQuality === 'EXCELLENT' || conn.connectionQuality === 'GOOD'
    ).length;
    
    const unhealthyConnections = stats.total - healthyConnections;
    
    const totalLatency = connections.reduce((sum, conn) => sum + conn.latency, 0);
    const averageLatency = stats.total > 0 ? totalLatency / stats.total : 0;
    
    const reconnectingConnections = connections.filter(conn => conn.reconnectAttempts > 0).length;
    const reconnectionRate = stats.total > 0 ? reconnectingConnections / stats.total : 0;
    
    // Calculate error rate based on recent connection failures
    const recentFailures = connections.filter(conn => 
      conn.totalDisconnections > 0 && 
      conn.status === 'FAILED' || conn.status === 'SUSPENDED'
    ).length;
    const errorRate = stats.total > 0 ? recentFailures / stats.total : 0;
    
    // System load estimation
    const systemLoad = this.calculateSystemLoad(stats);

    return {
      timestamp: new Date(),
      totalConnections: stats.total,
      healthyConnections,
      unhealthyConnections,
      averageLatency: Math.round(averageLatency),
      connectionQualityDistribution: stats.byQuality,
      reconnectionRate: Math.round(reconnectionRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      systemLoad: Math.round(systemLoad * 100) / 100,
    };
  }

  // Get health history
  getHealthHistory(durationMs: number = 3600000): HealthMetrics[] {
    const cutoff = new Date(Date.now() - durationMs);
    return this.healthHistory.filter(metric => metric.timestamp >= cutoff);
  }

  // Get active alerts
  getActiveAlerts(): HealthAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.acknowledged);
  }

  // Acknowledge alert
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.eventEmitter.emit('health.alert.acknowledged', { alertId, alert });
      return true;
    }
    return false;
  }

  // Get health summary
  getHealthSummary(): {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    metrics: HealthMetrics;
    activeAlerts: number;
    trends: {
      latencyTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
      connectionTrend: 'GROWING' | 'STABLE' | 'DECLINING';
      errorTrend: 'IMPROVING' | 'STABLE' | 'WORSENING';
    };
  } {
    const currentMetrics = this.getCurrentHealthMetrics();
    const activeAlerts = this.getActiveAlerts();
    
    // Determine overall health status
    let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    
    if (activeAlerts.some(alert => alert.severity === 'CRITICAL')) {
      status = 'CRITICAL';
    } else if (activeAlerts.some(alert => alert.severity === 'HIGH' || alert.severity === 'MEDIUM')) {
      status = 'WARNING';
    }

    // Calculate trends
    const trends = this.calculateTrends();

    return {
      status,
      metrics: currentMetrics,
      activeAlerts: activeAlerts.length,
      trends,
    };
  }

  // Private methods
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.monitoringIntervalMs);
  }

  private startAlertsCleanup(): void {
    this.alertsCleanupInterval = setInterval(() => {
      this.cleanupOldAlerts();
    }, 300000); // 5 minutes
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const metrics = this.getCurrentHealthMetrics();
      
      // Store metrics in history
      this.healthHistory.push(metrics);
      this.cleanupOldMetrics();
      
      // Check for health issues and generate alerts
      await this.checkHealthThresholds(metrics);
      
      // Emit health metrics event
      this.eventEmitter.emit('health.metrics.collected', { metrics });
      
      this.logger.debug(`Health check completed: ${metrics.totalConnections} connections, ${metrics.averageLatency}ms avg latency`);
    } catch (error) {
      this.logger.error('Error during health check:', error);
    }
  }

  private async checkHealthThresholds(metrics: HealthMetrics): Promise<void> {
    // Check average latency
    if (metrics.averageLatency > this.thresholds.maxAverageLatency) {
      await this.createAlert('HIGH_LATENCY', 'HIGH', 
        `Average latency (${metrics.averageLatency}ms) exceeds threshold (${this.thresholds.maxAverageLatency}ms)`,
        { averageLatency: metrics.averageLatency }
      );
    }

    // Check error rate
    if (metrics.errorRate > this.thresholds.maxErrorRate) {
      await this.createAlert('HIGH_ERROR_RATE', 'HIGH',
        `Error rate (${(metrics.errorRate * 100).toFixed(1)}%) exceeds threshold (${(this.thresholds.maxErrorRate * 100).toFixed(1)}%)`,
        { errorRate: metrics.errorRate }
      );
    }

    // Check healthy connection ratio
    const healthyRatio = metrics.totalConnections > 0 ? metrics.healthyConnections / metrics.totalConnections : 1;
    if (healthyRatio < this.thresholds.minHealthyConnectionRatio) {
      await this.createAlert('LOW_CONNECTION_QUALITY', 'MEDIUM',
        `Healthy connection ratio (${(healthyRatio * 100).toFixed(1)}%) below threshold (${(this.thresholds.minHealthyConnectionRatio * 100).toFixed(1)}%)`,
        { healthyConnections: metrics.healthyConnections, totalConnections: metrics.totalConnections }
      );
    }

    // Check system load
    if (metrics.systemLoad > this.thresholds.maxSystemLoad) {
      await this.createAlert('SYSTEM_OVERLOAD', 'CRITICAL',
        `System load (${(metrics.systemLoad * 100).toFixed(1)}%) exceeds threshold (${(this.thresholds.maxSystemLoad * 100).toFixed(1)}%)`,
        { systemLoad: metrics.systemLoad }
      );
    }

    // Check reconnection rate
    if (metrics.reconnectionRate > this.thresholds.maxReconnectionRate) {
      await this.createAlert('HIGH_ERROR_RATE', 'MEDIUM',
        `Reconnection rate (${(metrics.reconnectionRate * 100).toFixed(1)}%) exceeds threshold (${(this.thresholds.maxReconnectionRate * 100).toFixed(1)}%)`,
        { reconnectionRate: metrics.reconnectionRate }
      );
    }
  }

  private async createAlert(
    type: HealthAlert['type'],
    severity: HealthAlert['severity'],
    message: string,
    metrics: Partial<HealthMetrics>
  ): Promise<void> {
    const alertId = `alert_${++this.alertCounter}_${Date.now()}`;
    
    const alert: HealthAlert = {
      id: alertId,
      type,
      severity,
      message,
      metrics,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.activeAlerts.set(alertId, alert);
    
    // Emit alert event
    this.eventEmitter.emit('health.alert.created', { alert });
    
    this.logger.warn(`Health alert created: ${type} - ${message}`);
  }

  private calculateSystemLoad(stats: any): number {
    // Simple system load calculation based on various factors
    const memoryUsage = process.memoryUsage();
    const memoryLoadFactor = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    const connectionLoadFactor = Math.min(stats.total / 1000, 1); // Normalize to 1000 connections
    const reconnectionLoadFactor = stats.reconnecting / Math.max(stats.total, 1);
    
    return Math.min((memoryLoadFactor + connectionLoadFactor + reconnectionLoadFactor) / 3, 1);
  }

  private calculateTrends(): {
    latencyTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
    connectionTrend: 'GROWING' | 'STABLE' | 'DECLINING';
    errorTrend: 'IMPROVING' | 'STABLE' | 'WORSENING';
  } {
    const recentMetrics = this.healthHistory.slice(-10); // Last 10 measurements
    
    if (recentMetrics.length < 3) {
      return {
        latencyTrend: 'STABLE',
        connectionTrend: 'STABLE',
        errorTrend: 'STABLE',
      };
    }

    const latencyTrend = this.calculateTrend(recentMetrics.map(m => m.averageLatency));
    const connectionTrend = this.calculateTrend(recentMetrics.map(m => m.totalConnections));
    const errorTrend = this.calculateTrend(recentMetrics.map(m => m.errorRate));

    return {
      latencyTrend: latencyTrend > 0.1 ? 'DEGRADING' : latencyTrend < -0.1 ? 'IMPROVING' : 'STABLE',
      connectionTrend: connectionTrend > 0.1 ? 'GROWING' : connectionTrend < -0.1 ? 'DECLINING' : 'STABLE',
      errorTrend: errorTrend > 0.1 ? 'WORSENING' : errorTrend < -0.1 ? 'IMPROVING' : 'STABLE',
    };
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    return firstAvg > 0 ? (secondAvg - firstAvg) / firstAvg : 0;
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.historyRetentionMs);
    this.healthHistory = this.healthHistory.filter(metric => metric.timestamp >= cutoff);
  }

  private cleanupOldAlerts(): void {
    const cutoff = new Date(Date.now() - 3600000); // 1 hour
    
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.acknowledged && alert.timestamp < cutoff) {
        this.activeAlerts.delete(alertId);
      }
    }
  }
}
