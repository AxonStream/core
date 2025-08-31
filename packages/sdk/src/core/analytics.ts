/**
 * 📊 Analytics Client
 * 
 * Production-grade analytics and usage tracking with comprehensive
 * metrics collection, performance insights, and business intelligence.
 */

import { BaseClient } from './base-client';
import { AxonPulsError } from './errors';
import type { AxonPulsEvent } from '../types/schemas';

export interface UsageMetrics {
  organizationId: string;
  timeRange: { start: Date; end: Date };
  totalEvents: number;
  totalConnections: number;
  totalChannels: number;
  totalUsers: number;
  averageSessionDuration: number;
  peakConcurrentConnections: number;
  dataTransferred: number;
  apiCalls: number;
  errorRate: number;
  uptime: number;
}

export interface EventAnalytics {
  eventType: string;
  count: number;
  averageSize: number;
  successRate: number;
  averageProcessingTime: number;
  peakHour: number;
  topChannels: Array<{ channel: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

export interface ConnectionAnalytics {
  totalConnections: number;
  activeConnections: number;
  averageConnectionDuration: number;
  connectionsByQuality: Record<string, number>;
  connectionsByRegion: Record<string, number>;
  reconnectionRate: number;
  topUserAgents: Array<{ userAgent: string; count: number }>;
  peakConcurrency: { timestamp: Date; count: number };
}

export interface PerformanceInsights {
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  availability: number;
  bottlenecks: Array<{
    component: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
  }>;
  trends: Array<{
    metric: string;
    direction: 'up' | 'down' | 'stable';
    change: number;
    period: string;
  }>;
}

export interface BusinessMetrics {
  organizationId: string;
  timeRange: { start: Date; end: Date };
  revenue: number;
  costs: number;
  profit: number;
  customerCount: number;
  churnRate: number;
  growthRate: number;
  averageRevenuePerUser: number;
  customerLifetimeValue: number;
  conversionRate: number;
}

export interface CustomEventData {
  eventType: string;
  metadata?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp?: Date;
}

export interface AnalyticsQuery {
  organizationId?: string;
  timeRange: { start: Date; end: Date };
  granularity?: 'hour' | 'day' | 'week' | 'month';
  filters?: {
    eventTypes?: string[];
    channels?: string[];
    userIds?: string[];
    regions?: string[];
  };
  aggregations?: Array<'count' | 'sum' | 'avg' | 'min' | 'max' | 'percentile'>;
}

export interface DashboardData {
  overview: {
    totalEvents: number;
    activeUsers: number;
    errorRate: number;
    averageLatency: number;
  };
  charts: {
    eventsOverTime: Array<{ timestamp: Date; count: number }>;
    connectionsOverTime: Array<{ timestamp: Date; count: number }>;
    errorRateOverTime: Array<{ timestamp: Date; rate: number }>;
    latencyOverTime: Array<{ timestamp: Date; latency: number }>;
  };
  topChannels: Array<{ channel: string; events: number; users: number }>;
  topUsers: Array<{ userId: string; events: number; sessions: number }>;
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
    severity: number;
  }>;
}

/**
 * Analytics Client
 * Provides comprehensive analytics, usage tracking, and business intelligence
 */
export class AnalyticsClient extends BaseClient {
  /**
   * Get usage metrics for organization
   */
  async getUsage(query: AnalyticsQuery): Promise<UsageMetrics> {
    try {
      this.validateTimeRange(query.timeRange);

      const response = await this.apiClient.get('/api/v1/analytics/usage', {
        params: {
          organizationId: query.organizationId,
          startTime: query.timeRange.start.toISOString(),
          endTime: query.timeRange.end.toISOString(),
          granularity: query.granularity || 'day',
          ...query.filters
        }
      });

      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get usage metrics',
        'USAGE_METRICS_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'usage_metrics_fetch',
          timeRange: query.timeRange,
          organizationId: query.organizationId
        }
      );
    }
  }

  /**
   * Get event analytics
   */
  async getEventAnalytics(query: AnalyticsQuery): Promise<EventAnalytics[]> {
    try {
      this.validateTimeRange(query.timeRange);

      const response = await this.apiClient.get('/api/v1/analytics/events', {
        params: {
          organizationId: query.organizationId,
          startTime: query.timeRange.start.toISOString(),
          endTime: query.timeRange.end.toISOString(),
          granularity: query.granularity || 'day',
          eventTypes: query.filters?.eventTypes?.join(','),
          channels: query.filters?.channels?.join(',')
        }
      });

      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get event analytics',
        'EVENT_ANALYTICS_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'event_analytics_fetch',
          timeRange: query.timeRange
        }
      );
    }
  }

  /**
   * Get connection analytics
   */
  async getConnectionAnalytics(query: AnalyticsQuery): Promise<ConnectionAnalytics> {
    try {
      this.validateTimeRange(query.timeRange);

      const response = await this.apiClient.get('/api/v1/analytics/connections', {
        params: {
          organizationId: query.organizationId,
          startTime: query.timeRange.start.toISOString(),
          endTime: query.timeRange.end.toISOString(),
          granularity: query.granularity || 'day'
        }
      });

      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get connection analytics',
        'CONNECTION_ANALYTICS_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'connection_analytics_fetch',
          timeRange: query.timeRange
        }
      );
    }
  }

  /**
   * Get performance insights
   */
  async getPerformanceInsights(query: AnalyticsQuery): Promise<PerformanceInsights> {
    try {
      this.validateTimeRange(query.timeRange);

      const response = await this.apiClient.get('/api/v1/analytics/performance', {
        params: {
          organizationId: query.organizationId,
          startTime: query.timeRange.start.toISOString(),
          endTime: query.timeRange.end.toISOString(),
          granularity: query.granularity || 'hour'
        }
      });

      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get performance insights',
        'PERFORMANCE_INSIGHTS_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'performance_insights_fetch',
          timeRange: query.timeRange
        }
      );
    }
  }

  /**
   * Get business metrics
   */
  async getBusinessMetrics(query: AnalyticsQuery): Promise<BusinessMetrics> {
    try {
      this.validateTimeRange(query.timeRange);

      const response = await this.apiClient.get('/api/v1/analytics/business', {
        params: {
          organizationId: query.organizationId,
          startTime: query.timeRange.start.toISOString(),
          endTime: query.timeRange.end.toISOString(),
          granularity: query.granularity || 'month'
        }
      });

      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get business metrics',
        'BUSINESS_METRICS_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'business_metrics_fetch',
          timeRange: query.timeRange
        }
      );
    }
  }

  /**
   * Get dashboard data
   */
  async getDashboard(organizationId?: string, timeRange?: { start: Date; end: Date }): Promise<DashboardData> {
    try {
      const defaultTimeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        end: new Date()
      };

      const range = timeRange || defaultTimeRange;
      this.validateTimeRange(range);

      const response = await this.apiClient.get('/api/v1/analytics/dashboard', {
        params: {
          organizationId,
          startTime: range.start.toISOString(),
          endTime: range.end.toISOString()
        }
      });

      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get dashboard data',
        'DASHBOARD_DATA_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'dashboard_data_fetch',
          organizationId
        }
      );
    }
  }

  /**
   * Track custom event
   */
  async trackEvent(eventData: CustomEventData): Promise<void> {
    try {
      await this.apiClient.post('/api/v1/monitoring/events/track', {
        eventType: eventData.eventType,
        metadata: {
          ...eventData.metadata,
          userId: eventData.userId,
          sessionId: eventData.sessionId,
          timestamp: eventData.timestamp?.toISOString() || new Date().toISOString()
        }
      });
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to track custom event',
        'EVENT_TRACKING_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'custom_event_tracking',
          eventType: eventData.eventType
        }
      );
    }
  }

  /**
   * Export analytics data
   */
  async exportData(query: AnalyticsQuery, format: 'csv' | 'json' | 'xlsx' = 'json'): Promise<Blob | string> {
    try {
      this.validateTimeRange(query.timeRange);

      const response = await this.apiClient.get('/api/v1/analytics/export', {
        params: {
          organizationId: query.organizationId,
          startTime: query.timeRange.start.toISOString(),
          endTime: query.timeRange.end.toISOString(),
          format,
          granularity: query.granularity || 'day',
          ...query.filters
        },
        responseType: format === 'json' ? 'json' : 'blob'
      });

      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to export analytics data',
        'ANALYTICS_EXPORT_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'analytics_export',
          format,
          timeRange: query.timeRange
        }
      );
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(organizationId?: string): Promise<{
    activeConnections: number;
    eventsPerSecond: number;
    errorRate: number;
    averageLatency: number;
    timestamp: Date;
  }> {
    try {
      const response = await this.apiClient.get('/api/v1/analytics/realtime', {
        params: { organizationId }
      });

      return {
        ...response.data,
        timestamp: new Date(response.data.timestamp)
      };
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get real-time metrics',
        'REALTIME_METRICS_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'realtime_metrics_fetch',
          organizationId
        }
      );
    }
  }

  /**
   * Validate time range
   */
  private validateTimeRange(timeRange: { start: Date; end: Date }): void {
    if (timeRange.start >= timeRange.end) {
      throw new AxonPulsError(
        'Start time must be before end time',
        'INVALID_TIME_RANGE',
        400,
        { start: timeRange.start, end: timeRange.end },
        { operation: 'time_range_validation' }
      );
    }

    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year
    if (timeRange.end.getTime() - timeRange.start.getTime() > maxRange) {
      throw new AxonPulsError(
        'Time range cannot exceed 1 year',
        'TIME_RANGE_TOO_LARGE',
        400,
        { maxRangeDays: 365 },
        { operation: 'time_range_validation' }
      );
    }

    const futureLimit = Date.now() + 24 * 60 * 60 * 1000; // 1 day in future
    if (timeRange.end.getTime() > futureLimit) {
      throw new AxonPulsError(
        'End time cannot be more than 1 day in the future',
        'FUTURE_TIME_NOT_ALLOWED',
        400,
        null,
        { operation: 'time_range_validation' }
      );
    }
  }
}
