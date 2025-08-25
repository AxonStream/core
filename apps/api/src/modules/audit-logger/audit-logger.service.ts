import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../../common/services/redis.service';
import { PrismaService } from '../../common/services/prisma.service';
import { TenantContext } from '../../common/services/tenant-aware.service';

/**
 * Comprehensive Audit Logging Service
 * Provides detailed audit trails, compliance logging, and security monitoring
 */

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  userId?: string;
  sessionId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  success: boolean;
  error?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'AUTHENTICATION' | 'AUTHORIZATION' | 'DATA_ACCESS' | 'DATA_MODIFICATION' | 'SYSTEM' | 'SECURITY';
}

export interface AuditQuery {
  organizationId: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  category?: string;
  severity?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  categoryCounts: Record<string, number>;
  severityCounts: Record<string, number>;
  topActions: Array<{ action: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  timeRange: { start: Date; end: Date };
}

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);
  private readonly retentionDays: number;
  private readonly enableDatabaseStorage: boolean;
  private readonly enableRealTimeAlerts: boolean;

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.retentionDays = this.configService.get<number>('audit.retentionDays', 90);
    this.enableDatabaseStorage = this.configService.get<boolean>('audit.enableDatabaseStorage', true);
    this.enableRealTimeAlerts = this.configService.get<boolean>('audit.enableRealTimeAlerts', true);
  }

  // ============================================================================
  // AUDIT LOGGING
  // ============================================================================

  async logEvent(
    context: TenantContext,
    action: string,
    resourceType: string,
    options: {
      resourceId?: string;
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      success?: boolean;
      error?: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
      severity?: AuditLogEntry['severity'];
      category?: AuditLogEntry['category'];
    } = {}
  ): Promise<string> {
    try {
      const auditEntry: AuditLogEntry = {
        id: this.generateAuditId(),
        organizationId: context.organizationId,
        userId: context.userId,
        sessionId: (context as any).sessionId,
        action,
        resourceType,
        resourceId: options.resourceId,
        oldValues: options.oldValues,
        newValues: options.newValues,
        success: options.success ?? true,
        error: options.error,
        timestamp: new Date(),
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        metadata: options.metadata,
        severity: options.severity ?? this.determineSeverity(action, options.success ?? true),
        category: options.category ?? this.determineCategory(action, resourceType),
      };

      // Store in Redis for fast access
      await this.storeInRedis(auditEntry);

      // Store in database for long-term persistence
      if (this.enableDatabaseStorage) {
        await this.storeInDatabase(auditEntry);
      }

      // Emit real-time event
      this.eventEmitter.emit('audit.event.logged', auditEntry);

      // Check for security alerts
      if (this.enableRealTimeAlerts) {
        await this.checkSecurityAlerts(auditEntry);
      }

      this.logger.debug(`Audit event logged: ${auditEntry.id} - ${action} ${resourceType}`);
      return auditEntry.id;
    } catch (error) {
      this.logger.error(`Failed to log audit event: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // AUDIT QUERIES
  // ============================================================================

  async getAuditLogs(query: AuditQuery): Promise<AuditLogEntry[]> {
    try {
      // Try Redis first for recent logs
      const redisLogs = await this.getLogsFromRedis(query);
      
      // If we need more logs or older data, query database
      if (redisLogs.length < (query.limit || 100) && this.enableDatabaseStorage) {
        const dbLogs = await this.getLogsFromDatabase(query);
        return this.mergeAndDeduplicateLogs(redisLogs, dbLogs, query.limit);
      }

      return redisLogs.slice(0, query.limit || 100);
    } catch (error) {
      this.logger.error(`Failed to get audit logs: ${error.message}`);
      return [];
    }
  }

  async getAuditSummary(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AuditSummary> {
    try {
      const logs = await this.getAuditLogs({
        organizationId,
        startDate,
        endDate,
        limit: 10000, // Large limit for summary
      });

      const totalEvents = logs.length;
      const successfulEvents = logs.filter(log => log.success).length;
      const failedEvents = totalEvents - successfulEvents;

      const categoryCounts = this.countByField(logs, 'category');
      const severityCounts = this.countByField(logs, 'severity');
      const actionCounts = this.countByField(logs, 'action');
      const userCounts = this.countByField(logs, 'userId');

      const topActions = Object.entries(actionCounts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const topUsers = Object.entries(userCounts)
        .map(([userId, count]) => ({ userId, count }))
        .filter(item => item.userId) // Filter out null/undefined userIds
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalEvents,
        successfulEvents,
        failedEvents,
        categoryCounts,
        severityCounts,
        topActions,
        topUsers,
        timeRange: { start: startDate, end: endDate },
      };
    } catch (error) {
      this.logger.error(`Failed to get audit summary: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // SECURITY MONITORING
  // ============================================================================

  async getSecurityEvents(
    organizationId: string,
    timeRange: { start: Date; end: Date },
    severityFilter?: AuditLogEntry['severity'][]
  ): Promise<AuditLogEntry[]> {
    try {
      const query: AuditQuery = {
        organizationId,
        startDate: timeRange.start,
        endDate: timeRange.end,
        category: 'SECURITY',
        limit: 1000,
      };

      const logs = await this.getAuditLogs(query);
      
      if (severityFilter) {
        return logs.filter(log => severityFilter.includes(log.severity));
      }

      return logs;
    } catch (error) {
      this.logger.error(`Failed to get security events: ${error.message}`);
      return [];
    }
  }

  async detectAnomalies(
    organizationId: string,
    timeWindow: number = 3600000 // 1 hour
  ): Promise<Array<{
    type: string;
    description: string;
    severity: string;
    count: number;
    threshold: number;
  }>> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeWindow);
      
      const logs = await this.getAuditLogs({
        organizationId,
        startDate: startTime,
        endDate: endTime,
        limit: 10000,
      });

      const anomalies: Array<{
        type: string;
        description: string;
        severity: string;
        count: number;
        threshold: number;
      }> = [];

      // Check for high failure rate
      const failedLogins = logs.filter(log => 
        log.action === 'login' && !log.success
      ).length;
      const failureThreshold = 10;
      
      if (failedLogins > failureThreshold) {
        anomalies.push({
          type: 'HIGH_FAILURE_RATE',
          description: `High number of failed login attempts: ${failedLogins}`,
          severity: 'HIGH',
          count: failedLogins,
          threshold: failureThreshold,
        });
      }

      // Check for unusual access patterns
      const uniqueUsers = new Set(logs.map(log => log.userId)).size;
      const avgActionsPerUser = logs.length / (uniqueUsers || 1);
      const actionThreshold = 100;

      if (avgActionsPerUser > actionThreshold) {
        anomalies.push({
          type: 'HIGH_ACTIVITY',
          description: `Unusually high activity: ${avgActionsPerUser.toFixed(1)} actions per user`,
          severity: 'MEDIUM',
          count: Math.round(avgActionsPerUser),
          threshold: actionThreshold,
        });
      }

      // Check for privilege escalation attempts
      const privilegeEscalations = logs.filter(log =>
        log.action.includes('permission') || log.action.includes('role')
      ).length;
      const escalationThreshold = 5;

      if (privilegeEscalations > escalationThreshold) {
        anomalies.push({
          type: 'PRIVILEGE_ESCALATION',
          description: `Multiple privilege escalation attempts: ${privilegeEscalations}`,
          severity: 'CRITICAL',
          count: privilegeEscalations,
          threshold: escalationThreshold,
        });
      }

      return anomalies;
    } catch (error) {
      this.logger.error(`Failed to detect anomalies: ${error.message}`);
      return [];
    }
  }

  // ============================================================================
  // COMPLIANCE REPORTING
  // ============================================================================

  async generateComplianceReport(
    organizationId: string,
    reportType: 'GDPR' | 'SOX' | 'HIPAA' | 'PCI_DSS',
    timeRange: { start: Date; end: Date }
  ): Promise<{
    reportType: string;
    organizationId: string;
    timeRange: { start: Date; end: Date };
    summary: AuditSummary;
    criticalEvents: AuditLogEntry[];
    dataAccessEvents: AuditLogEntry[];
    securityEvents: AuditLogEntry[];
    complianceScore: number;
    recommendations: string[];
  }> {
    try {
      const summary = await this.getAuditSummary(organizationId, timeRange.start, timeRange.end);
      
      const criticalEvents = await this.getAuditLogs({
        organizationId,
        startDate: timeRange.start,
        endDate: timeRange.end,
        severity: 'CRITICAL',
        limit: 100,
      });

      const dataAccessEvents = await this.getAuditLogs({
        organizationId,
        startDate: timeRange.start,
        endDate: timeRange.end,
        category: 'DATA_ACCESS',
        limit: 1000,
      });

      const securityEvents = await this.getSecurityEvents(organizationId, timeRange);

      // Calculate compliance score (simplified)
      const complianceScore = this.calculateComplianceScore(
        summary,
        criticalEvents,
        securityEvents,
        reportType
      );

      const recommendations = this.generateComplianceRecommendations(
        reportType,
        complianceScore,
        criticalEvents,
        securityEvents
      );

      return {
        reportType,
        organizationId,
        timeRange,
        summary,
        criticalEvents,
        dataAccessEvents,
        securityEvents,
        complianceScore,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Failed to generate compliance report: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async storeInRedis(auditEntry: AuditLogEntry): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      const key = `audit:${auditEntry.organizationId}:${auditEntry.id}`;
      const ttl = this.retentionDays * 24 * 60 * 60; // Convert days to seconds

      await redis.setEx(key, ttl, JSON.stringify(auditEntry));

      // Also add to a sorted set for time-based queries
      const sortedSetKey = `audit:${auditEntry.organizationId}:timeline`;
      await redis.zAdd(sortedSetKey, { score: auditEntry.timestamp.getTime(), value: auditEntry.id });
      await redis.expire(sortedSetKey, ttl);
    } catch (error) {
      this.logger.error(`Failed to store audit entry in Redis: ${error.message}`);
    }
  }

  private async storeInDatabase(auditEntry: AuditLogEntry): Promise<void> {
    try {
      // Store in a dedicated audit_logs table (would need to be created in schema)
      // For now, we'll use the existing structure or create a simple log
      this.logger.log(`DB Audit: ${auditEntry.organizationId} - ${auditEntry.action} ${auditEntry.resourceType} - ${auditEntry.success ? 'SUCCESS' : 'FAILED'}`);

      // In a real implementation, this would be:
      // await this.prismaService.auditLog.create({ data: auditEntry });
    } catch (error) {
      this.logger.error(`Failed to store audit entry in database: ${error.message}`);
    }
  }

  private async getLogsFromRedis(query: AuditQuery): Promise<AuditLogEntry[]> {
    try {
      const redis = this.redisService.getRedisInstance();
      const sortedSetKey = `audit:${query.organizationId}:timeline`;

      // Get IDs within time range
      const startScore = query.startDate ? query.startDate.getTime() : 0;
      const endScore = query.endDate ? query.endDate.getTime() : Date.now();

      const ids = await redis.zRangeByScore(
        sortedSetKey,
        startScore,
        endScore,
        {
          LIMIT: {
            offset: query.offset || 0,
            count: query.limit || 100,
          },
        }
      );

      const logs: AuditLogEntry[] = [];

      for (const id of ids) {
        const key = `audit:${query.organizationId}:${id}`;
        const data = await redis.get(key);

        if (data && typeof data === 'string') {
          const log = JSON.parse(data) as AuditLogEntry;
          log.timestamp = new Date(log.timestamp); // Convert back to Date

          // Apply filters
          if (this.matchesFilters(log, query)) {
            logs.push(log);
          }
        }
      }

      return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      this.logger.error(`Failed to get logs from Redis: ${error.message}`);
      return [];
    }
  }

  private async getLogsFromDatabase(query: AuditQuery): Promise<AuditLogEntry[]> {
    try {
      // This would query the audit_logs table
      // For now, return empty array as the table doesn't exist yet
      return [];
    } catch (error) {
      this.logger.error(`Failed to get logs from database: ${error.message}`);
      return [];
    }
  }

  private mergeAndDeduplicateLogs(
    redisLogs: AuditLogEntry[],
    dbLogs: AuditLogEntry[],
    limit?: number
  ): AuditLogEntry[] {
    const allLogs = [...redisLogs, ...dbLogs];
    const uniqueLogs = new Map<string, AuditLogEntry>();

    // Deduplicate by ID
    for (const log of allLogs) {
      if (!uniqueLogs.has(log.id)) {
        uniqueLogs.set(log.id, log);
      }
    }

    // Sort by timestamp (newest first)
    const sortedLogs = Array.from(uniqueLogs.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    return limit ? sortedLogs.slice(0, limit) : sortedLogs;
  }

  private matchesFilters(log: AuditLogEntry, query: AuditQuery): boolean {
    if (query.userId && log.userId !== query.userId) return false;
    if (query.action && log.action !== query.action) return false;
    if (query.resourceType && log.resourceType !== query.resourceType) return false;
    if (query.category && log.category !== query.category) return false;
    if (query.severity && log.severity !== query.severity) return false;
    if (query.success !== undefined && log.success !== query.success) return false;

    return true;
  }

  private countByField(logs: AuditLogEntry[], field: keyof AuditLogEntry): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const log of logs) {
      const value = log[field] as string;
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    }

    return counts;
  }

  private determineSeverity(action: string, success: boolean): AuditLogEntry['severity'] {
    if (!success) return 'HIGH';

    const criticalActions = ['delete', 'drop', 'truncate', 'grant', 'revoke'];
    const highActions = ['create', 'update', 'modify', 'change'];
    const mediumActions = ['login', 'logout', 'access'];

    if (criticalActions.some(a => action.toLowerCase().includes(a))) return 'CRITICAL';
    if (highActions.some(a => action.toLowerCase().includes(a))) return 'HIGH';
    if (mediumActions.some(a => action.toLowerCase().includes(a))) return 'MEDIUM';

    return 'LOW';
  }

  private determineCategory(action: string, resourceType: string): AuditLogEntry['category'] {
    const authActions = ['login', 'logout', 'authenticate', 'token'];
    const authzActions = ['authorize', 'permission', 'role', 'grant', 'revoke'];
    const dataActions = ['read', 'select', 'view', 'access'];
    const modifyActions = ['create', 'update', 'delete', 'modify', 'insert'];
    const systemActions = ['start', 'stop', 'restart', 'configure'];

    if (authActions.some(a => action.toLowerCase().includes(a))) return 'AUTHENTICATION';
    if (authzActions.some(a => action.toLowerCase().includes(a))) return 'AUTHORIZATION';
    if (modifyActions.some(a => action.toLowerCase().includes(a))) return 'DATA_MODIFICATION';
    if (dataActions.some(a => action.toLowerCase().includes(a))) return 'DATA_ACCESS';
    if (systemActions.some(a => action.toLowerCase().includes(a))) return 'SYSTEM';

    return 'SYSTEM';
  }

  private async checkSecurityAlerts(auditEntry: AuditLogEntry): Promise<void> {
    try {
      // Check for suspicious patterns
      if (auditEntry.severity === 'CRITICAL' || !auditEntry.success) {
        this.eventEmitter.emit('security.alert', {
          type: 'AUDIT_ALERT',
          severity: auditEntry.severity,
          message: `${auditEntry.action} ${auditEntry.resourceType} - ${auditEntry.success ? 'SUCCESS' : 'FAILED'}`,
          auditEntry,
        });
      }

      // Check for rapid successive failures
      if (!auditEntry.success && auditEntry.userId) {
        const recentFailures = await this.getRecentFailures(
          auditEntry.organizationId,
          auditEntry.userId,
          300000 // 5 minutes
        );

        if (recentFailures >= 5) {
          this.eventEmitter.emit('security.alert', {
            type: 'BRUTE_FORCE_ATTEMPT',
            severity: 'CRITICAL',
            message: `Multiple failed attempts detected for user ${auditEntry.userId}`,
            auditEntry,
            metadata: { failureCount: recentFailures },
          });
        }
      }
    } catch (error) {
      this.logger.error(`Failed to check security alerts: ${error.message}`);
    }
  }

  private async getRecentFailures(
    organizationId: string,
    userId: string,
    timeWindow: number
  ): Promise<number> {
    try {
      const startTime = new Date(Date.now() - timeWindow);
      const logs = await this.getAuditLogs({
        organizationId,
        userId,
        success: false,
        startDate: startTime,
        limit: 100,
      });

      return logs.length;
    } catch (error) {
      this.logger.error(`Failed to get recent failures: ${error.message}`);
      return 0;
    }
  }

  private calculateComplianceScore(
    summary: AuditSummary,
    criticalEvents: AuditLogEntry[],
    securityEvents: AuditLogEntry[],
    reportType: string
  ): number {
    let score = 100;

    // Deduct points for critical events
    score -= criticalEvents.length * 5;

    // Deduct points for failed events
    const failureRate = summary.failedEvents / summary.totalEvents;
    score -= failureRate * 20;

    // Deduct points for security incidents
    score -= securityEvents.filter(e => !e.success).length * 10;

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  private generateComplianceRecommendations(
    reportType: string,
    score: number,
    criticalEvents: AuditLogEntry[],
    securityEvents: AuditLogEntry[]
  ): string[] {
    const recommendations: string[] = [];

    if (score < 80) {
      recommendations.push('Improve overall system security and reduce critical events');
    }

    if (criticalEvents.length > 10) {
      recommendations.push('Review and reduce critical security events');
    }

    if (securityEvents.filter(e => !e.success).length > 5) {
      recommendations.push('Investigate and address security failures');
    }

    switch (reportType) {
      case 'GDPR':
        recommendations.push('Ensure data access is properly logged and monitored');
        recommendations.push('Implement data retention policies');
        break;
      case 'SOX':
        recommendations.push('Maintain detailed financial data access logs');
        recommendations.push('Implement segregation of duties');
        break;
      case 'HIPAA':
        recommendations.push('Ensure PHI access is properly audited');
        recommendations.push('Implement minimum necessary access controls');
        break;
      case 'PCI_DSS':
        recommendations.push('Monitor all payment card data access');
        recommendations.push('Implement strong access controls');
        break;
    }

    return recommendations;
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

}
