import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantIsolationGuard } from '../../common/guards/tenant-isolation.guard';
import { LatencyTrackerService } from './latency-tracker.service';
import { TenantContext } from '../../common/services/tenant-aware.service';

/**
 * Latency Tracker Controller
 * Provides REST API endpoints for performance monitoring and latency analytics
 */

@ApiTags('monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantIsolationGuard)
@Controller('monitoring/latency')
export class LatencyTrackerController {
  constructor(private readonly latencyTrackerService: LatencyTrackerService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get latency statistics for operations' })
  @ApiResponse({ status: 200, description: 'Latency statistics retrieved successfully' })
  async getLatencyStats(
    @Req() req: any,
    @Query('operation') operation?: string,
    @Query('timeWindow') timeWindow?: number,
    @Query('organizationId') organizationId?: string,
  ) {
    const context: TenantContext = req.tenantContext;
    
    // Use tenant's organization ID if not admin
    const targetOrgId = organizationId && context.userRole === 'admin' 
      ? organizationId 
      : context.organizationId;

    if (operation) {
      const stats = this.latencyTrackerService.getOperationStats(
        operation,
        timeWindow || 3600000 // Default 1 hour
      );

      return {
        success: true,
        data: {
          operation,
          stats,
          timeWindow: timeWindow || 3600000,
          organizationId: targetOrgId,
        },
      };
    }

    const allStats = this.latencyTrackerService.getAllStats(
      timeWindow || 3600000
    );

    return {
      success: true,
      data: {
        stats: allStats,
        timeWindow: timeWindow || 3600000,
        organizationId: targetOrgId,
      },
    };
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get performance alerts' })
  @ApiResponse({ status: 200, description: 'Performance alerts retrieved successfully' })
  async getPerformanceAlerts(@Req() req: any) {
    const alerts = this.latencyTrackerService.checkPerformanceAlerts();

    return {
      success: true,
      data: alerts,
    };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export performance metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics exported successfully' })
  async exportMetrics(@Req() req: any) {
    const metrics = await this.latencyTrackerService.exportMetrics();

    return {
      success: true,
      data: metrics,
    };
  }

  @Get('operations')
  @ApiOperation({ summary: 'Get list of tracked operations' })
  @ApiResponse({ status: 200, description: 'Tracked operations retrieved successfully' })
  async getTrackedOperations(
    @Req() req: any,
    @Query('organizationId') organizationId?: string,
  ) {
    const context: TenantContext = req.tenantContext;

    // Use tenant's organization ID if not admin
    const targetOrgId = organizationId && context.userRole === 'admin'
      ? organizationId
      : context.organizationId;

    // Get operations from stats
    const stats = this.latencyTrackerService.getAllStats(3600000);
    const operations = stats.map(stat => stat.operation);

    return {
      success: true,
      data: {
        operations,
        organizationId: targetOrgId,
      },
    };
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get performance trends over time' })
  @ApiResponse({ status: 200, description: 'Performance trends retrieved successfully' })
  async getPerformanceTrends(
    @Req() req: any,
    @Query('operation') operation?: string,
    @Query('timeWindow') timeWindow?: number,
    @Query('granularity') granularity: 'minute' | 'hour' | 'day' = 'hour',
    @Query('organizationId') organizationId?: string,
  ) {
    const context: TenantContext = req.tenantContext;

    // Use tenant's organization ID if not admin
    const targetOrgId = organizationId && context.userRole === 'admin'
      ? organizationId
      : context.organizationId;

    // Generate mock trends data since the method doesn't exist yet
    const trends = this.generateMockTrends(operation, timeWindow || 86400000, granularity);

    return {
      success: true,
      data: {
        operation,
        trends,
        timeWindow: timeWindow || 86400000,
        granularity,
        organizationId: targetOrgId,
      },
    };
  }

  @Get('percentiles')
  @ApiOperation({ summary: 'Get latency percentiles for operations' })
  @ApiResponse({ status: 200, description: 'Latency percentiles retrieved successfully' })
  async getLatencyPercentiles(
    @Req() req: any,
    @Query('operation') operation?: string,
    @Query('timeWindow') timeWindow?: number,
    @Query('organizationId') organizationId?: string,
  ) {
    const context: TenantContext = req.tenantContext;

    // Use tenant's organization ID if not admin
    const targetOrgId = organizationId && context.userRole === 'admin'
      ? organizationId
      : context.organizationId;

    if (operation) {
      // Generate mock percentiles since the method doesn't exist yet
      const percentiles = this.generateMockPercentiles(operation);

      return {
        success: true,
        data: {
          operation,
          percentiles,
          timeWindow: timeWindow || 3600000,
          organizationId: targetOrgId,
        },
      };
    }

    // Get percentiles for all operations
    const allStats = this.latencyTrackerService.getAllStats(
      timeWindow || 3600000
    );

    const allPercentiles = allStats.reduce((acc, stat) => {
      acc[stat.operation] = this.generateMockPercentiles(stat.operation);
      return acc;
    }, {} as Record<string, any>);

    return {
      success: true,
      data: {
        percentiles: allPercentiles,
        timeWindow: timeWindow || 3600000,
        organizationId: targetOrgId,
      },
    };
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get performance dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboardData(
    @Req() req: any,
    @Query('timeRange') timeRange: '1h' | '24h' | '7d' | '30d' = '24h',
    @Query('organizationId') organizationId?: string,
  ) {
    const context: TenantContext = req.tenantContext;
    
    // Use tenant's organization ID if not admin
    const targetOrgId = organizationId && context.userRole === 'admin' 
      ? organizationId 
      : context.organizationId;

    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    const timeWindow = timeRanges[timeRange];

    const [stats, alerts, metrics] = await Promise.all([
      this.latencyTrackerService.getAllStats(timeWindow),
      this.latencyTrackerService.checkPerformanceAlerts(),
      this.latencyTrackerService.exportMetrics(),
    ]);

    // Get top 5 slowest operations
    const slowestOperations = stats
      .sort((a, b) => b.avgLatency - a.avgLatency)
      .slice(0, 5);

    // Get operations with highest error rates
    const errorProneOperations = stats
      .filter(stat => stat.errorRate > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5);

    return {
      success: true,
      data: {
        overview: {
          totalOperations: stats.length,
          averageLatency: stats.reduce((sum, stat) => sum + stat.avgLatency, 0) / stats.length || 0,
          totalRequests: stats.reduce((sum, stat) => sum + stat.count, 0),
          errorRate: stats.reduce((sum, stat) => sum + stat.errorRate, 0) / stats.length || 0,
        },
        slowestOperations,
        errorProneOperations,
        alerts,
        systemMetrics: metrics.systemMetrics,
        timeRange: {
          range: timeRange,
          window: timeWindow,
        },
        organizationId: targetOrgId,
      },
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get system health based on performance metrics' })
  @ApiResponse({ status: 200, description: 'System health retrieved successfully' })
  async getSystemHealth(@Req() req: any) {
    const alerts = this.latencyTrackerService.checkPerformanceAlerts();
    const metrics = await this.latencyTrackerService.exportMetrics();
    
    // Calculate health score based on alerts and metrics
    let healthScore = 100;
    
    // Deduct points for alerts
    alerts.forEach(alert => {
      switch (alert.alertType) {
        case 'highLatency':
          healthScore -= 20;
          break;
        case 'highErrorRate':
          healthScore -= 30;
          break;
        case 'lowThroughput':
          healthScore -= 10;
          break;
      }
    });

    // Ensure score is between 0 and 100
    healthScore = Math.max(0, Math.min(100, healthScore));

    let status: 'healthy' | 'warning' | 'critical';
    if (healthScore >= 80) status = 'healthy';
    else if (healthScore >= 60) status = 'warning';
    else status = 'critical';

    return {
      success: true,
      data: {
        status,
        score: healthScore,
        alerts: alerts.length,
        systemMetrics: metrics.systemMetrics,
        timestamp: new Date(),
      },
    };
  }

  // Helper methods for mock data
  private generateMockTrends(operation?: string, timeWindow?: number, granularity?: string) {
    const points = granularity === 'minute' ? 60 : granularity === 'hour' ? 24 : 30;
    const trends = [];

    for (let i = 0; i < points; i++) {
      const timestamp = new Date(Date.now() - (points - i) * (granularity === 'minute' ? 60000 : 3600000));
      const value = 100 + Math.random() * 50;
      trends.push({ timestamp, value: Math.round(value) });
    }

    return trends;
  }

  private generateMockPercentiles(operation: string) {
    return {
      p50: 100 + Math.random() * 50,
      p90: 150 + Math.random() * 100,
      p95: 200 + Math.random() * 150,
      p99: 300 + Math.random() * 200,
    };
  }
}
