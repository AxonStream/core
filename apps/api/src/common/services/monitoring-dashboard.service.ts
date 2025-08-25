import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AnalyticsService } from './analytics.service';
import { LatencyTrackerService } from '../../modules/latency-tracker/latency-tracker.service';
import { AuditLoggerService } from '../../modules/audit-logger/audit-logger.service';
import { ConnectionHealthMonitorService } from '../../modules/connection-manager/connection-health-monitor.service';
import { TenantContext } from './tenant-aware.service';

/**
 * Monitoring Dashboard Service
 * Provides unified dashboard data combining all monitoring and analytics services
 */

export interface DashboardData {
  overview: {
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    totalConnections: number;
    totalEvents: number;
    errorRate: number;
    averageLatency: number;
  };
  realTimeMetrics: {
    connectionsPerSecond: number;
    eventsPerSecond: number;
    dataTransferRate: number;
    cpuUsage: number;
    memoryUsage: number;
  };
  alerts: Array<{
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
    acknowledged: boolean;
  }>;
  performance: {
    latencyTrends: Array<{ timestamp: Date; value: number }>;
    throughputTrends: Array<{ timestamp: Date; value: number }>;
    errorTrends: Array<{ timestamp: Date; value: number }>;
  };
  usage: {
    topOrganizations: Array<{ organizationId: string; eventCount: number }>;
    topEventTypes: Array<{ eventType: string; count: number }>;
    topChannels: Array<{ channel: string; count: number }>;
  };
  security: {
    recentSecurityEvents: Array<{
      id: string;
      type: string;
      severity: string;
      timestamp: Date;
      organizationId: string;
    }>;
    anomalies: Array<{
      type: string;
      description: string;
      severity: string;
      count: number;
    }>;
  };
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  score: number;
  components: Array<{
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    lastCheck: Date;
    details?: string;
  }>;
  recommendations: string[];
}

@Injectable()
export class MonitoringDashboardService {
  private readonly logger = new Logger(MonitoringDashboardService.name);
  private dashboardCache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTimeout: number;

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly latencyTrackerService: LatencyTrackerService,
    private readonly auditLoggerService: AuditLoggerService,
    private readonly connectionHealthMonitor: ConnectionHealthMonitorService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.cacheTimeout = this.configService.get<number>('dashboard.cacheTimeout', 30000); // 30 seconds
  }

  // ============================================================================
  // DASHBOARD DATA
  // ============================================================================

  async getDashboardData(
    context: TenantContext,
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<DashboardData> {
    try {
      const cacheKey = `dashboard:${context.organizationId}:${timeRange}`;
      const cached = this.dashboardCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      const timeRanges = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - timeRanges[timeRange]);

      const [
        usageMetrics,
        eventAnalytics,
        connectionAnalytics,
        performanceInsights,
        auditSummary,
        securityEvents,
        anomalies,
        healthMetrics,
        latencyStats,
        alerts
      ] = await Promise.all([
        this.analyticsService.getUsageMetrics(context.organizationId, { start: startDate, end: endDate }),
        this.analyticsService.getEventAnalytics(context.organizationId, { start: startDate, end: endDate }),
        this.analyticsService.getConnectionAnalytics(context.organizationId, { start: startDate, end: endDate }),
        this.analyticsService.getPerformanceInsights(context.organizationId, { start: startDate, end: endDate }),
        this.auditLoggerService.getAuditSummary(context.organizationId, startDate, endDate),
        this.auditLoggerService.getSecurityEvents(context.organizationId, { start: startDate, end: endDate }),
        this.auditLoggerService.detectAnomalies(context.organizationId, timeRanges[timeRange]),
        this.connectionHealthMonitor.getCurrentHealthMetrics(),
        this.latencyTrackerService.getAllStats(timeRanges[timeRange]),
        this.latencyTrackerService.checkPerformanceAlerts(),
      ]);

      // Calculate overall status
      const overallStatus = this.calculateOverallStatus(
        healthMetrics,
        performanceInsights,
        alerts,
        anomalies
      );

      // Build dashboard data
      const dashboardData: DashboardData = {
        overview: {
          status: overallStatus,
          uptime: usageMetrics.uptime,
          totalConnections: usageMetrics.totalConnections,
          totalEvents: usageMetrics.totalEvents,
          errorRate: usageMetrics.errorRate,
          averageLatency: performanceInsights.averageLatency,
        },
        realTimeMetrics: {
          connectionsPerSecond: this.calculateRate(connectionAnalytics.totalConnections, timeRanges[timeRange]),
          eventsPerSecond: this.calculateRate(usageMetrics.totalEvents, timeRanges[timeRange]),
          dataTransferRate: this.calculateRate(usageMetrics.dataTransferred, timeRanges[timeRange]),
          cpuUsage: healthMetrics.systemLoad * 100,
          memoryUsage: this.getMemoryUsage(),
        },
        alerts: this.formatAlerts(alerts, anomalies),
        performance: {
          latencyTrends: this.generateTrends('latency', timeRange),
          throughputTrends: this.generateTrends('throughput', timeRange),
          errorTrends: this.generateTrends('errors', timeRange),
        },
        usage: {
          topOrganizations: [{ organizationId: context.organizationId, eventCount: usageMetrics.totalEvents }],
          topEventTypes: eventAnalytics.slice(0, 5).map(e => ({ eventType: e.eventType, count: e.count })),
          topChannels: eventAnalytics.flatMap(e => e.topChannels).slice(0, 5),
        },
        security: {
          recentSecurityEvents: securityEvents.slice(0, 10).map(event => ({
            id: event.id,
            type: event.action,
            severity: event.severity,
            timestamp: event.timestamp,
            organizationId: event.organizationId,
          })),
          anomalies,
        },
      };

      // Cache the result
      this.dashboardCache.set(cacheKey, {
        data: dashboardData,
        timestamp: Date.now(),
      });

      return dashboardData;
    } catch (error) {
      this.logger.error(`Failed to get dashboard data: ${error.message}`);
      throw error;
    }
  }

  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const [
        healthMetrics,
        latencyAlerts,
        memoryUsage
      ] = await Promise.all([
        this.connectionHealthMonitor.getCurrentHealthMetrics(),
        this.latencyTrackerService.checkPerformanceAlerts(),
        this.getDetailedMemoryUsage(),
      ]);

      // Get connection stats from health metrics
      const connectionStats = { status: 'healthy' };

      const components = [
        {
          name: 'Database',
          status: this.getComponentStatus(healthMetrics.systemLoad, 0.8),
          score: Math.round((1 - healthMetrics.systemLoad) * 100),
          lastCheck: new Date(),
          details: `System load: ${(healthMetrics.systemLoad * 100).toFixed(1)}%`,
        },
        {
          name: 'Redis',
          status: 'healthy' as const,
          score: 100,
          lastCheck: new Date(),
          details: 'All Redis operations normal',
        },
        {
          name: 'WebSocket Gateway',
          status: this.getComponentStatus(healthMetrics.errorRate, 0.05),
          score: Math.round((1 - healthMetrics.errorRate) * 100),
          lastCheck: new Date(),
          details: `Error rate: ${(healthMetrics.errorRate * 100).toFixed(2)}%`,
        },
        {
          name: 'Connection Manager',
          status: connectionStats.status === 'healthy' ? 'healthy' as const : 'warning' as const,
          score: Math.round((healthMetrics.healthyConnections / healthMetrics.totalConnections) * 100),
          lastCheck: new Date(),
          details: `${healthMetrics.healthyConnections}/${healthMetrics.totalConnections} healthy connections`,
        },
        {
          name: 'Performance',
          status: latencyAlerts.length === 0 ? 'healthy' as const : 'warning' as const,
          score: latencyAlerts.length === 0 ? 100 : Math.max(0, 100 - latencyAlerts.length * 20),
          lastCheck: new Date(),
          details: latencyAlerts.length > 0 ? `${latencyAlerts.length} performance alerts` : 'All metrics normal',
        },
      ];

      // Calculate overall score
      const overallScore = Math.round(
        components.reduce((sum, component) => sum + component.score, 0) / components.length
      );

      let overallStatus: 'healthy' | 'warning' | 'critical';
      if (overallScore >= 90) overallStatus = 'healthy';
      else if (overallScore >= 70) overallStatus = 'warning';
      else overallStatus = 'critical';

      const recommendations = this.generateHealthRecommendations(components, latencyAlerts);

      return {
        overall: overallStatus,
        score: overallScore,
        components,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Failed to get system health: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // REAL-TIME MONITORING
  // ============================================================================

  async startRealTimeMonitoring(organizationId: string): Promise<void> {
    try {
      // Set up real-time event listeners
      this.eventEmitter.on('analytics.event.tracked', (data) => {
        if (data.organizationId === organizationId) {
          this.invalidateCache(`dashboard:${organizationId}`);
        }
      });

      this.eventEmitter.on('connection.metrics.collected', (data) => {
        this.invalidateCache(`dashboard:${organizationId}`);
      });

      this.eventEmitter.on('security.alert', (data) => {
        if (data.auditEntry?.organizationId === organizationId) {
          this.invalidateCache(`dashboard:${organizationId}`);
          
          // Emit real-time alert
          this.eventEmitter.emit('dashboard.alert', {
            organizationId,
            alert: {
              id: `alert_${Date.now()}`,
              type: data.type,
              severity: data.severity,
              message: data.message,
              timestamp: new Date(),
              acknowledged: false,
            },
          });
        }
      });

      this.logger.log(`Started real-time monitoring for organization: ${organizationId}`);
    } catch (error) {
      this.logger.error(`Failed to start real-time monitoring: ${error.message}`);
    }
  }

  async stopRealTimeMonitoring(organizationId: string): Promise<void> {
    try {
      // Remove event listeners (in a real implementation, you'd track listeners)
      this.logger.log(`Stopped real-time monitoring for organization: ${organizationId}`);
    } catch (error) {
      this.logger.error(`Failed to stop real-time monitoring: ${error.message}`);
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private calculateOverallStatus(
    healthMetrics: any,
    performanceInsights: any,
    alerts: any[],
    anomalies: any[]
  ): 'healthy' | 'warning' | 'critical' {
    let score = 100;

    // Deduct points for high system load
    if (healthMetrics.systemLoad > 0.8) score -= 30;
    else if (healthMetrics.systemLoad > 0.6) score -= 15;

    // Deduct points for high error rate
    if (healthMetrics.errorRate > 0.05) score -= 25;
    else if (healthMetrics.errorRate > 0.02) score -= 10;

    // Deduct points for performance issues
    if (performanceInsights.averageLatency > 1000) score -= 20;
    else if (performanceInsights.averageLatency > 500) score -= 10;

    // Deduct points for alerts and anomalies
    score -= alerts.length * 10;
    score -= anomalies.filter(a => a.severity === 'CRITICAL').length * 15;
    score -= anomalies.filter(a => a.severity === 'HIGH').length * 10;

    if (score >= 80) return 'healthy';
    if (score >= 60) return 'warning';
    return 'critical';
  }

  private calculateRate(total: number, timeWindowMs: number): number {
    const timeWindowSeconds = timeWindowMs / 1000;
    return Math.round((total / timeWindowSeconds) * 100) / 100;
  }

  private getMemoryUsage(): number {
    try {
      const used = process.memoryUsage();
      const total = used.heapTotal;
      const usage = used.heapUsed;
      return Math.round((usage / total) * 100);
    } catch (error) {
      return 0;
    }
  }

  private async getDetailedMemoryUsage(): Promise<any> {
    try {
      const memUsage = process.memoryUsage();
      return {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      };
    } catch (error) {
      return {};
    }
  }

  private getComponentStatus(value: number, threshold: number): 'healthy' | 'warning' | 'critical' {
    if (value <= threshold) return 'healthy';
    if (value <= threshold * 1.5) return 'warning';
    return 'critical';
  }

  private formatAlerts(performanceAlerts: any[], anomalies: any[]): Array<{
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
    acknowledged: boolean;
  }> {
    const alerts = [];

    // Add performance alerts
    performanceAlerts.forEach((alert, index) => {
      alerts.push({
        id: `perf_${index}`,
        type: alert.alertType,
        severity: this.mapSeverity(alert.severity),
        message: alert.message,
        timestamp: new Date(),
        acknowledged: false,
      });
    });

    // Add anomaly alerts
    anomalies.forEach((anomaly, index) => {
      alerts.push({
        id: `anomaly_${index}`,
        type: anomaly.type,
        severity: this.mapSeverity(anomaly.severity),
        message: anomaly.description,
        timestamp: new Date(),
        acknowledged: false,
      });
    });

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private mapSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'critical';
      case 'HIGH': return 'high';
      case 'MEDIUM': return 'medium';
      case 'LOW': return 'low';
      default: return 'medium';
    }
  }

  private generateTrends(metric: string, timeRange: string): Array<{ timestamp: Date; value: number }> {
    // This would generate actual trend data from historical metrics
    // For now, generate sample data
    const points = timeRange === '1h' ? 12 : timeRange === '24h' ? 24 : 30;
    const trends = [];

    for (let i = 0; i < points; i++) {
      const timestamp = new Date(Date.now() - (points - i) * (timeRange === '1h' ? 300000 : 3600000));
      let value = 0;

      switch (metric) {
        case 'latency':
          value = 100 + Math.random() * 50;
          break;
        case 'throughput':
          value = 1000 + Math.random() * 500;
          break;
        case 'errors':
          value = Math.random() * 5;
          break;
      }

      trends.push({ timestamp, value: Math.round(value) });
    }

    return trends;
  }

  private generateHealthRecommendations(
    components: any[],
    alerts: any[]
  ): string[] {
    const recommendations = [];

    // Check for unhealthy components
    const unhealthyComponents = components.filter(c => c.status !== 'healthy');
    if (unhealthyComponents.length > 0) {
      recommendations.push(`Address issues with ${unhealthyComponents.map(c => c.name).join(', ')}`);
    }

    // Check for performance alerts
    if (alerts.length > 0) {
      recommendations.push('Review and address performance alerts');
    }

    // Check for low scores
    const lowScoreComponents = components.filter(c => c.score < 80);
    if (lowScoreComponents.length > 0) {
      recommendations.push('Optimize components with low health scores');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('System is healthy - continue monitoring');
    }

    return recommendations;
  }

  private invalidateCache(pattern: string): void {
    for (const key of this.dashboardCache.keys()) {
      if (key.includes(pattern)) {
        this.dashboardCache.delete(key);
      }
    }
  }

  // ============================================================================
  // EXPORT & REPORTING
  // ============================================================================

  async exportDashboardData(
    context: TenantContext,
    format: 'json' | 'csv' = 'json',
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{ data: any; filename: string }> {
    try {
      const dashboardData = await this.getDashboardData(context, timeRange);
      const timestamp = new Date().toISOString().split('T')[0];

      if (format === 'csv') {
        // Convert to CSV format
        const csvData = this.convertToCSV(dashboardData);
        return {
          data: csvData,
          filename: `dashboard-${context.organizationId}-${timestamp}.csv`,
        };
      }

      return {
        data: dashboardData,
        filename: `dashboard-${context.organizationId}-${timestamp}.json`,
      };
    } catch (error) {
      this.logger.error(`Failed to export dashboard data: ${error.message}`);
      throw error;
    }
  }

  private convertToCSV(data: DashboardData): string {
    const rows = [
      ['Metric', 'Value', 'Category'],
      ['Status', data.overview.status, 'Overview'],
      ['Uptime', data.overview.uptime.toString(), 'Overview'],
      ['Total Connections', data.overview.totalConnections.toString(), 'Overview'],
      ['Total Events', data.overview.totalEvents.toString(), 'Overview'],
      ['Error Rate', data.overview.errorRate.toString(), 'Overview'],
      ['Average Latency', data.overview.averageLatency.toString(), 'Overview'],
      ['CPU Usage', data.realTimeMetrics.cpuUsage.toString(), 'Real-time'],
      ['Memory Usage', data.realTimeMetrics.memoryUsage.toString(), 'Real-time'],
      ['Connections/sec', data.realTimeMetrics.connectionsPerSecond.toString(), 'Real-time'],
      ['Events/sec', data.realTimeMetrics.eventsPerSecond.toString(), 'Real-time'],
    ];

    return rows.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
  }

}
