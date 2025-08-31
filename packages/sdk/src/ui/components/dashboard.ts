/**
 * Real-Time Dashboard Component
 * 
 * Connects to actual backend monitoring APIs and displays real data
 * Based on the actual DashboardData interface from monitoring-dashboard.service.ts
 */

import { AxonUIComponent, type ComponentConfig } from '../base';
import type { AxonPulsClient } from '../../core/client';
import { globalPerformanceMonitor, globalCache, globalHealthChecker } from '../../utils/production-features';

export interface DashboardConfig extends ComponentConfig {
  client: AxonPulsClient;
  timeRange?: '1h' | '24h' | '7d' | '30d';
  refreshInterval?: number;
  showAlerts?: boolean;
  showPerformance?: boolean;
  showUsage?: boolean;
  showSecurity?: boolean;
  autoRefresh?: boolean;
}

// Real DashboardData interface matching the backend
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

export class AxonDashboard extends AxonUIComponent {
  public config: DashboardConfig;
  private dashboardData: DashboardData | null = null;
  private refreshTimer: number | null = null;
  private retryCount = 0;
  private maxRetries = 3;

  constructor(config: DashboardConfig) {
    super(config);
    this.config = {
      timeRange: '24h',
      refreshInterval: 30000,
      showAlerts: true,
      showPerformance: true,
      showUsage: true,
      showSecurity: true,
      autoRefresh: true,
      ...config
    };
  }

  public mount(container: string | HTMLElement): this {
    this.container = typeof container === 'string'
      ? document.querySelector(container) as HTMLElement
      : container;

    if (!this.container) {
      throw new Error('Dashboard container not found');
    }

    this.container.className = `axon-dashboard axon-dashboard--${this.config.theme || 'auto'}`;

    // Initial load
    this.loadDashboardData();
    this.render();

    // Start auto-refresh if enabled
    if (this.config.autoRefresh) {
      this.startAutoRefresh();
    }

    // Start real-time monitoring
    this.startRealTimeMonitoring();

    return this;
  }

  public unmount(): void {
    this.stopAutoRefresh();
    this.stopRealTimeMonitoring();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  private async loadDashboardData(): Promise<void> {
    try {
      // Use production cache for API responses
      const cacheKey = `dashboard_${this.config.timeRange}`;
      const cachedData = globalCache.get(cacheKey) as DashboardData | null;

      if (cachedData) {
        this.dashboardData = cachedData;
        this.render();
        return;
      }

      // Track performance metrics
      const startTime = performance.now();

      const response = await fetch(`/api/monitoring/dashboard?timeRange=${this.config.timeRange}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Dashboard API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // Cache the result for 30 seconds
      globalCache.set(cacheKey, result.data, 30000);

      // Add real performance metrics from production features
      const loadTime = performance.now() - startTime;
      const performanceMetrics = globalPerformanceMonitor.getAverageMetrics();
      const healthStatus = globalHealthChecker.getLastResult();

      // Enhance dashboard data with real production metrics
      this.dashboardData = {
        ...result.data,
        realTimeMetrics: {
          ...result.data.realTimeMetrics,
          // Add real metrics from production features
          apiLatency: loadTime,
          cacheHitRate: globalCache.getHitRate(),
          systemHealth: healthStatus?.status || 'unknown'
        },
        performance: {
          ...result.data.performance,
          // Add real performance data
          currentMetrics: performanceMetrics
        }
      };

      this.retryCount = 0; // Reset on success
      this.render();

    } catch (error) {
      console.error('Failed to load dashboard data:', error);

      // Retry logic with exponential backoff
      this.retryCount++;
      if (this.retryCount <= this.maxRetries) {
        const delay = Math.pow(2, this.retryCount) * 1000;
        setTimeout(() => this.loadDashboardData(), delay);
      } else {
        this.renderErrorState();
      }
    }
  }

  private async startRealTimeMonitoring(): Promise<void> {
    try {
      await fetch('/api/monitoring/realtime/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      // Subscribe to real-time updates
      this.config.client.subscribe(['dashboard:metrics', 'dashboard:alerts']);

      this.config.client.on('event', (event: any) => {
        if (event.type === 'dashboard_metrics_update') {
          this.updateRealTimeMetrics(event.payload);
        } else if (event.type === 'dashboard_alert') {
          this.addAlert(event.payload);
        }
      });

    } catch (error) {
      console.warn('Failed to start real-time monitoring:', error);
    }
  }

  private async stopRealTimeMonitoring(): Promise<void> {
    try {
      await fetch('/api/monitoring/realtime/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.warn('Failed to stop real-time monitoring:', error);
    }
  }

  private startAutoRefresh(): void {
    this.refreshTimer = window.setInterval(() => {
      this.loadDashboardData();
    }, this.config.refreshInterval || 30000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  public render(): HTMLElement {
    if (!this.container) {
      throw new Error('Dashboard not mounted');
    }

    if (!this.dashboardData) {
      this.renderLoadingState();
      return this.container;
    }

    this.container.innerHTML = `
      <div class="axon-dashboard__header">
        <h1 class="axon-dashboard__title">AxonStream Dashboard</h1>
        <div class="axon-dashboard__controls">
          <select class="axon-dashboard__time-range" data-time-range>
            <option value="1h" ${this.config.timeRange === '1h' ? 'selected' : ''}>Last Hour</option>
            <option value="24h" ${this.config.timeRange === '24h' ? 'selected' : ''}>Last 24 Hours</option>
            <option value="7d" ${this.config.timeRange === '7d' ? 'selected' : ''}>Last 7 Days</option>
            <option value="30d" ${this.config.timeRange === '30d' ? 'selected' : ''}>Last 30 Days</option>
          </select>
          <button class="axon-dashboard__refresh" data-refresh>Refresh</button>
        </div>
      </div>
      
      <div class="axon-dashboard__content">
        ${this.renderOverviewSection()}
        ${this.config.showAlerts ? this.renderAlertsSection() : ''}
        ${this.renderRealTimeSection()}
        ${this.config.showPerformance ? this.renderPerformanceSection() : ''}
        ${this.config.showUsage ? this.renderUsageSection() : ''}
        ${this.config.showSecurity ? this.renderSecuritySection() : ''}
      </div>
    `;

    this.attachEventListeners();
    return this.container;
  }

  private renderLoadingState(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="axon-dashboard__loading">
        <div class="axon-dashboard__spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    `;
  }

  private renderErrorState(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="axon-dashboard__error">
        <h2>Dashboard Unavailable</h2>
        <p>Unable to load dashboard data. Please check your connection and try again.</p>
        <button class="axon-dashboard__retry" data-retry>Retry</button>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderOverviewSection(): string {
    const { overview } = this.dashboardData!;
    const statusClass = `axon-dashboard__status--${overview.status}`;

    return `
      <div class="axon-dashboard__section axon-dashboard__overview">
        <h2>System Overview</h2>
        <div class="axon-dashboard__metrics">
          <div class="axon-dashboard__metric">
            <div class="axon-dashboard__metric-label">Status</div>
            <div class="axon-dashboard__metric-value ${statusClass}">
              ${overview.status.toUpperCase()}
            </div>
          </div>
          <div class="axon-dashboard__metric">
            <div class="axon-dashboard__metric-label">Uptime</div>
            <div class="axon-dashboard__metric-value">
              ${this.formatUptime(overview.uptime)}
            </div>
          </div>
          <div class="axon-dashboard__metric">
            <div class="axon-dashboard__metric-label">Connections</div>
            <div class="axon-dashboard__metric-value">
              ${overview.totalConnections.toLocaleString()}
            </div>
          </div>
          <div class="axon-dashboard__metric">
            <div class="axon-dashboard__metric-label">Events</div>
            <div class="axon-dashboard__metric-value">
              ${overview.totalEvents.toLocaleString()}
            </div>
          </div>
          <div class="axon-dashboard__metric">
            <div class="axon-dashboard__metric-label">Error Rate</div>
            <div class="axon-dashboard__metric-value">
              ${(overview.errorRate * 100).toFixed(2)}%
            </div>
          </div>
          <div class="axon-dashboard__metric">
            <div class="axon-dashboard__metric-label">Avg Latency</div>
            <div class="axon-dashboard__metric-value">
              ${overview.averageLatency.toFixed(0)}ms
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private getAuthToken(): string {
    // Get token from client - this needs to be implemented in the client
    return (this.config.client as any).token || '';
  }

  private formatUptime(uptime: number): string {
    const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
    const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  private updateRealTimeMetrics(metrics: any): void {
    if (this.dashboardData) {
      this.dashboardData.realTimeMetrics = { ...this.dashboardData.realTimeMetrics, ...metrics };
      this.render();
    }
  }

  private addAlert(alert: any): void {
    if (this.dashboardData) {
      this.dashboardData.alerts.unshift(alert);
      this.dashboardData.alerts = this.dashboardData.alerts.slice(0, 50); // Keep only 50 alerts
      this.render();
    }
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    // Time range selector
    const timeRangeSelect = this.container.querySelector('[data-time-range]') as HTMLSelectElement;
    if (timeRangeSelect) {
      timeRangeSelect.addEventListener('change', (e) => {
        this.config.timeRange = (e.target as HTMLSelectElement).value as any;
        this.loadDashboardData();
      });
    }

    // Refresh button
    const refreshButton = this.container.querySelector('[data-refresh]');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        this.loadDashboardData();
      });
    }

    // Retry button
    const retryButton = this.container.querySelector('[data-retry]');
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        this.retryCount = 0;
        this.loadDashboardData();
      });
    }
  }

  // Placeholder methods for additional sections - to be implemented
  private renderAlertsSection(): string { return '<div class="axon-dashboard__section">Alerts section - to be implemented</div>'; }
  private renderRealTimeSection(): string { return '<div class="axon-dashboard__section">Real-time metrics section - to be implemented</div>'; }
  private renderPerformanceSection(): string { return '<div class="axon-dashboard__section">Performance section - to be implemented</div>'; }
  private renderUsageSection(): string { return '<div class="axon-dashboard__section">Usage section - to be implemented</div>'; }
  private renderSecuritySection(): string { return '<div class="axon-dashboard__section">Security section - to be implemented</div>'; }
}
