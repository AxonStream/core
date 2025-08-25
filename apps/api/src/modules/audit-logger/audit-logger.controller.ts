import { Controller, Get, Post, Query, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantIsolationGuard } from '../../common/guards/tenant-isolation.guard';
import { AuditLoggerService, AuditQuery } from './audit-logger.service';
import { TenantContext } from '../../common/services/tenant-aware.service';

/**
 * Audit Logger Controller
 * Provides REST API endpoints for audit log management and compliance reporting
 */

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantIsolationGuard)
@Controller('audit')
export class AuditLoggerController {
  constructor(private readonly auditLoggerService: AuditLoggerService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Get audit logs with filtering' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async getAuditLogs(
    @Req() req: any,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('category') category?: string,
    @Query('severity') severity?: string,
    @Query('success') success?: boolean,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const context: TenantContext = req.tenantContext;
    
    const query: AuditQuery = {
      organizationId: context.organizationId,
      userId,
      action,
      resourceType,
      category,
      severity,
      success,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit || 100,
      offset: offset || 0,
    };

    const logs = await this.auditLoggerService.getAuditLogs(query);
    
    return {
      success: true,
      data: logs,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: logs.length,
      },
    };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get audit summary for a time period' })
  @ApiResponse({ status: 200, description: 'Audit summary retrieved successfully' })
  async getAuditSummary(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const context: TenantContext = req.tenantContext;
    
    const summary = await this.auditLoggerService.getAuditSummary(
      context.organizationId,
      new Date(startDate),
      new Date(endDate)
    );

    return {
      success: true,
      data: summary,
    };
  }

  @Get('security-events')
  @ApiOperation({ summary: 'Get security-related audit events' })
  @ApiResponse({ status: 200, description: 'Security events retrieved successfully' })
  async getSecurityEvents(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('severity') severity?: string,
  ) {
    const context: TenantContext = req.tenantContext;
    
    const severityFilter = severity ? severity.split(',') as any[] : undefined;
    
    const events = await this.auditLoggerService.getSecurityEvents(
      context.organizationId,
      {
        start: new Date(startDate),
        end: new Date(endDate),
      },
      severityFilter
    );

    return {
      success: true,
      data: events,
    };
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'Detect security anomalies' })
  @ApiResponse({ status: 200, description: 'Anomalies detected successfully' })
  async detectAnomalies(
    @Req() req: any,
    @Query('timeWindow') timeWindow?: number,
  ) {
    const context: TenantContext = req.tenantContext;
    
    const anomalies = await this.auditLoggerService.detectAnomalies(
      context.organizationId,
      timeWindow || 3600000 // Default 1 hour
    );

    return {
      success: true,
      data: anomalies,
    };
  }

  @Get('compliance-report')
  @ApiOperation({ summary: 'Generate compliance report' })
  @ApiResponse({ status: 200, description: 'Compliance report generated successfully' })
  async generateComplianceReport(
    @Req() req: any,
    @Query('reportType') reportType: 'GDPR' | 'SOX' | 'HIPAA' | 'PCI_DSS',
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const context: TenantContext = req.tenantContext;
    
    const report = await this.auditLoggerService.generateComplianceReport(
      context.organizationId,
      reportType,
      {
        start: new Date(startDate),
        end: new Date(endDate),
      }
    );

    return {
      success: true,
      data: report,
    };
  }

  @Post('log-event')
  @ApiOperation({ summary: 'Manually log an audit event' })
  @ApiResponse({ status: 201, description: 'Audit event logged successfully' })
  async logEvent(
    @Req() req: any,
    @Body() body: {
      action: string;
      resourceType: string;
      resourceId?: string;
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      success?: boolean;
      error?: string;
      metadata?: Record<string, any>;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      category?: 'AUTHENTICATION' | 'AUTHORIZATION' | 'DATA_ACCESS' | 'DATA_MODIFICATION' | 'SYSTEM' | 'SECURITY';
    },
  ) {
    const context: TenantContext = req.tenantContext;
    
    const auditId = await this.auditLoggerService.logEvent(
      context,
      body.action,
      body.resourceType,
      {
        resourceId: body.resourceId,
        oldValues: body.oldValues,
        newValues: body.newValues,
        success: body.success,
        error: body.error,
        metadata: body.metadata,
        severity: body.severity,
        category: body.category,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      }
    );

    return {
      success: true,
      data: { auditId },
    };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export audit logs for external analysis' })
  @ApiResponse({ status: 200, description: 'Audit logs exported successfully' })
  async exportAuditLogs(
    @Req() req: any,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('category') category?: string,
    @Query('severity') severity?: string,
  ) {
    const context: TenantContext = req.tenantContext;
    
    const query: AuditQuery = {
      organizationId: context.organizationId,
      category,
      severity,
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default 30 days
      endDate: endDate ? new Date(endDate) : new Date(),
      limit: 10000, // Large limit for export
    };

    const logs = await this.auditLoggerService.getAuditLogs(query);

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'ID', 'Timestamp', 'Organization', 'User', 'Action', 'Resource Type', 
        'Resource ID', 'Success', 'Severity', 'Category', 'Error'
      ];
      
      const csvRows = logs.map(log => [
        log.id,
        log.timestamp.toISOString(),
        log.organizationId,
        log.userId || '',
        log.action,
        log.resourceType,
        log.resourceId || '',
        log.success.toString(),
        log.severity,
        log.category,
        log.error || ''
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      return {
        success: true,
        data: csvContent,
        format: 'csv',
        filename: `audit-logs-${context.organizationId}-${new Date().toISOString().split('T')[0]}.csv`,
      };
    }

    return {
      success: true,
      data: logs,
      format: 'json',
      filename: `audit-logs-${context.organizationId}-${new Date().toISOString().split('T')[0]}.json`,
    };
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get audit dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboardData(
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

    const [summary, securityEvents, anomalies] = await Promise.all([
      this.auditLoggerService.getAuditSummary(context.organizationId, startDate, endDate),
      this.auditLoggerService.getSecurityEvents(context.organizationId, { start: startDate, end: endDate }),
      this.auditLoggerService.detectAnomalies(context.organizationId, timeRanges[timeRange]),
    ]);

    return {
      success: true,
      data: {
        summary,
        securityEvents: securityEvents.slice(0, 10), // Latest 10 security events
        anomalies,
        timeRange: {
          start: startDate,
          end: endDate,
          range: timeRange,
        },
      },
    };
  }
}
