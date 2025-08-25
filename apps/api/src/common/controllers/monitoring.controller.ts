import { Controller, Get, Post, Query, Body, UseGuards, Req, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { TenantIsolationGuard } from '../guards/tenant-isolation.guard';
import { MonitoringDashboardService } from '../services/monitoring-dashboard.service';
import { AnalyticsService } from '../services/analytics.service';
import { TenantContext } from '../services/tenant-aware.service';

/**
 * Monitoring Controller
 * Provides comprehensive monitoring and analytics REST API endpoints
 */

@ApiTags('monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantIsolationGuard)
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly monitoringDashboardService: MonitoringDashboardService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get comprehensive dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboard(
    @Req() req: any,
    @Query('timeRange') timeRange: '1h' | '24h' | '7d' | '30d' = '24h',
  ) {
    const context: TenantContext = req.tenantContext;
    
    const dashboardData = await this.monitoringDashboardService.getDashboardData(context, timeRange);

    return {
      success: true,
      data: dashboardData,
      timeRange,
      timestamp: new Date(),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({ status: 200, description: 'System health retrieved successfully' })
  async getSystemHealth(@Req() req: any) {
    const health = await this.monitoringDashboardService.getSystemHealth();

    return {
      success: true,
      data: health,
      timestamp: new Date(),
    };
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get usage metrics' })
  @ApiResponse({ status: 200, description: 'Usage metrics retrieved successfully' })
  async getUsageMetrics(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const context: TenantContext = req.tenantContext;
    
    const timeRange = {
      start: startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate) : new Date(),
    };

    const metrics = await this.analyticsService.getUsageMetrics(context.organizationId, timeRange);

    return {
      success: true,
      data: metrics,
    };
  }

  @Get('events/analytics')
  @ApiOperation({ summary: 'Get event analytics' })
  @ApiResponse({ status: 200, description: 'Event analytics retrieved successfully' })
  async getEventAnalytics(
    @Req() req: any,
    @Query('eventType') eventType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const context: TenantContext = req.tenantContext;
    
    const timeRange = {
      start: startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate) : new Date(),
    };

    const analytics = await this.analyticsService.getEventAnalytics(
      context.organizationId,
      timeRange,
      eventType
    );

    return {
      success: true,
      data: analytics,
    };
  }

  @Get('connections/analytics')
  @ApiOperation({ summary: 'Get connection analytics' })
  @ApiResponse({ status: 200, description: 'Connection analytics retrieved successfully' })
  async getConnectionAnalytics(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const context: TenantContext = req.tenantContext;
    
    const timeRange = {
      start: startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate) : new Date(),
    };

    const analytics = await this.analyticsService.getConnectionAnalytics(
      context.organizationId,
      timeRange
    );

    return {
      success: true,
      data: analytics,
    };
  }

  @Get('performance/insights')
  @ApiOperation({ summary: 'Get performance insights' })
  @ApiResponse({ status: 200, description: 'Performance insights retrieved successfully' })
  async getPerformanceInsights(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const context: TenantContext = req.tenantContext;
    
    const timeRange = {
      start: startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate) : new Date(),
    };

    const insights = await this.analyticsService.getPerformanceInsights(
      context.organizationId,
      timeRange
    );

    return {
      success: true,
      data: insights,
    };
  }

  @Post('events/track')
  @ApiOperation({ summary: 'Track a custom event for analytics' })
  @ApiResponse({ status: 201, description: 'Event tracked successfully' })
  async trackEvent(
    @Req() req: any,
    @Body() body: {
      eventType: string;
      metadata?: Record<string, any>;
    },
  ) {
    const context: TenantContext = req.tenantContext;
    
    await this.analyticsService.collectEventMetrics(
      context.organizationId,
      body.eventType,
      body.metadata || {}
    );

    return {
      success: true,
      message: 'Event tracked successfully',
    };
  }

  @Post('connections/track')
  @ApiOperation({ summary: 'Track a connection event for analytics' })
  @ApiResponse({ status: 201, description: 'Connection event tracked successfully' })
  async trackConnection(
    @Req() req: any,
    @Body() body: {
      action: 'connect' | 'disconnect';
      metadata?: Record<string, any>;
    },
  ) {
    const context: TenantContext = req.tenantContext;
    
    await this.analyticsService.collectConnectionMetrics(
      context.organizationId,
      body.action,
      body.metadata || {}
    );

    return {
      success: true,
      message: 'Connection event tracked successfully',
    };
  }

  @Post('realtime/start')
  @ApiOperation({ summary: 'Start real-time monitoring' })
  @ApiResponse({ status: 200, description: 'Real-time monitoring started successfully' })
  async startRealTimeMonitoring(@Req() req: any) {
    const context: TenantContext = req.tenantContext;
    
    await this.monitoringDashboardService.startRealTimeMonitoring(context.organizationId);

    return {
      success: true,
      message: 'Real-time monitoring started',
    };
  }

  @Post('realtime/stop')
  @ApiOperation({ summary: 'Stop real-time monitoring' })
  @ApiResponse({ status: 200, description: 'Real-time monitoring stopped successfully' })
  async stopRealTimeMonitoring(@Req() req: any) {
    const context: TenantContext = req.tenantContext;
    
    await this.monitoringDashboardService.stopRealTimeMonitoring(context.organizationId);

    return {
      success: true,
      message: 'Real-time monitoring stopped',
    };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export monitoring data' })
  @ApiResponse({ status: 200, description: 'Monitoring data exported successfully' })
  async exportData(
    @Req() req: any,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query('timeRange') timeRange: '1h' | '24h' | '7d' | '30d' = '24h',
  ) {
    const context: TenantContext = req.tenantContext;
    
    const exportData = await this.monitoringDashboardService.exportDashboardData(
      context,
      format,
      timeRange
    );

    return {
      success: true,
      data: exportData.data,
      filename: exportData.filename,
      format,
    };
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get current alerts' })
  @ApiResponse({ status: 200, description: 'Alerts retrieved successfully' })
  async getAlerts(
    @Req() req: any,
    @Query('severity') severity?: string,
    @Query('acknowledged') acknowledged?: boolean,
  ) {
    const context: TenantContext = req.tenantContext;
    
    const dashboardData = await this.monitoringDashboardService.getDashboardData(context, '24h');
    
    let alerts = dashboardData.alerts;
    
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    if (acknowledged !== undefined) {
      alerts = alerts.filter(alert => alert.acknowledged === acknowledged);
    }

    return {
      success: true,
      data: alerts,
    };
  }

  @Get('metrics/summary')
  @ApiOperation({ summary: 'Get metrics summary' })
  @ApiResponse({ status: 200, description: 'Metrics summary retrieved successfully' })
  async getMetricsSummary(
    @Req() req: any,
    @Query('timeRange') timeRange: '1h' | '24h' | '7d' | '30d' = '24h',
  ) {
    const context: TenantContext = req.tenantContext;
    
    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - timeRanges[timeRange]);

    const [usageMetrics, eventAnalytics, connectionAnalytics] = await Promise.all([
      this.analyticsService.getUsageMetrics(context.organizationId, { start: startDate, end: endDate }),
      this.analyticsService.getEventAnalytics(context.organizationId, { start: startDate, end: endDate }),
      this.analyticsService.getConnectionAnalytics(context.organizationId, { start: startDate, end: endDate }),
    ]);

    return {
      success: true,
      data: {
        usage: usageMetrics,
        events: {
          totalTypes: eventAnalytics.length,
          totalEvents: eventAnalytics.reduce((sum, e) => sum + e.count, 0),
          averageSuccessRate: eventAnalytics.reduce((sum, e) => sum + e.successRate, 0) / eventAnalytics.length || 0,
        },
        connections: {
          total: connectionAnalytics.totalConnections,
          active: connectionAnalytics.activeConnections,
          averageDuration: connectionAnalytics.averageConnectionDuration,
        },
        timeRange: {
          start: startDate,
          end: endDate,
          range: timeRange,
        },
      },
    };
  }
}
