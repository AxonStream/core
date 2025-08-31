/**
 * Interactive Terminal Dashboard for AxonStream CLI
 * 
 * Real-time monitoring dashboard using blessed for terminal UI
 * Connects to backend monitoring endpoints for live data
 */

// import blessed from 'blessed'; // TODO: Add blessed dependency for full dashboard
import { formatBytes, formatDuration } from '../utils/format';

export interface DashboardOptions {
  client: any;
  refreshInterval?: number;
  title?: string;
}

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
  }>;
}

export class TerminalDashboard {
  // private screen: blessed.Widgets.Screen; // TODO: Add blessed dependency
  private client: any;
  private refreshInterval: number;
  private refreshTimer: NodeJS.Timeout | null = null;
  private dashboardData: DashboardData | null = null;

  // UI Components - TODO: Add blessed dependency
  // private overviewBox: blessed.Widgets.BoxElement;
  // private metricsBox: blessed.Widgets.BoxElement;
  // private alertsBox: blessed.Widgets.BoxElement;
  // private logsBox: blessed.Widgets.BoxElement;
  // private statusBar: blessed.Widgets.BoxElement;

  constructor(options: DashboardOptions) {
    this.client = options.client;
    this.refreshInterval = options.refreshInterval || 5000;

    // TODO: Add blessed dependency for full dashboard
    // Create blessed screen
    // this.screen = blessed.screen({
    //   smartCSR: true,
    //   title: options.title || 'AxonStream Dashboard'
    // });

    // this.setupUI();
    // this.setupEventHandlers();

    console.log('Dashboard requires blessed dependency. Install with: npm install blessed');
  }

  private setupUI(): void {
    // TODO: Add blessed dependency for full dashboard
    // Header
    // const header = blessed.box({
    //   top: 0,
    //   left: 0,
    //   width: '100%',
    //   height: 3,
    //   content: '{center}{bold}🚀 AxonStream Real-Time Dashboard{/bold}{/center}',
    //   tags: true,
    //   border: {
    //     type: 'line'
    //   },
    //   style: {
    //     fg: 'white',
    //     bg: 'blue',
    //     border: {
    //       fg: 'blue'
    //     }
    //   }
    // });

    // TODO: Add blessed dependency for full dashboard
    // Overview section (top-left)
    // this.overviewBox = blessed.box({
    //   label: ' System Overview ',
    //   top: 3,
    //   left: 0,
    //   width: '50%',
    //   height: '40%',
    //   content: 'Loading...',
    //   tags: true,
    //   border: {
    //     type: 'line'
    //   },
    //   style: {
    //     fg: 'white',
    //     border: {
    //       fg: 'cyan'
    //     }
    //   }
    // });

    // TODO: Add blessed dependency for full dashboard
    // Real-time metrics (top-right)
    // this.metricsBox = blessed.box({
    //   label: ' Real-Time Metrics ',
    //   top: 3,
    //   left: '50%',
    //   width: '50%',
    //   height: '40%',
    //   content: 'Loading...',
    //   tags: true,
    //   border: {
    //     type: 'line'
    //   },
    //   style: {
    //     fg: 'white',
    //     border: {
    //       fg: 'green'
    //     }
    //   }
    // });

    // TODO: Add blessed dependency for full dashboard
    // Alerts section (bottom-left)
    // this.alertsBox = blessed.box({
    //   label: ' Recent Alerts ',
    //   top: '43%',
    //   left: 0,
    //   width: '50%',
    //   height: '40%',
    //   content: 'No alerts',
    //   tags: true,
    //   scrollable: true,
    //   alwaysScroll: true,
    //   border: {
    //     type: 'line'
    //   },
    //   style: {
    //     fg: 'white',
    //     border: {
    //       fg: 'yellow'
    //     }
    //   }
    // });

    // TODO: Add blessed dependency for full dashboard
    // Logs section (bottom-right)
    // this.logsBox = blessed.box({
    //   label: ' System Logs ',
    //   top: '43%',
    //   left: '50%',
    //   width: '50%',
    //   height: '40%',
    //   content: 'Connecting...',
    //   tags: true,
    //   scrollable: true,
    //   alwaysScroll: true,
    //   border: {
    //     type: 'line'
    //   },
    //   style: {
    //     fg: 'white',
    //     border: {
    //       fg: 'magenta'
    //     }
    //   }
    // });

    // TODO: Add blessed dependency for full dashboard
    // Status bar (bottom)
    // this.statusBar = blessed.box({
    //   bottom: 0,
    //   left: 0,
    //   width: '100%',
    //   height: 3,
    //   content: '{center}Press {bold}q{/bold} to quit | {bold}r{/bold} to refresh | {bold}c{/bold} to clear logs{/center}',
    //   tags: true,
    //   border: {
    //     type: 'line'
    //   },
    //   style: {
    //     fg: 'white',
    //     bg: 'black',
    //     border: {
    //       fg: 'white'
    //     }
    //   }
    // });

    // TODO: Add blessed dependency for full dashboard
    // Add all components to screen
    // this.screen.append(header);
    // this.screen.append(this.overviewBox);
    // this.screen.append(this.metricsBox);
    // this.screen.append(this.alertsBox);
    // this.screen.append(this.logsBox);
    // this.screen.append(this.statusBar);
  }

  private setupEventHandlers(): void {
    // TODO: Add blessed dependency for full dashboard
    // Quit on q, C-c
    // this.screen.key(['q', 'C-c'], () => {
    //   this.stop();
    //   process.exit(0);
    // });

    // Refresh on r
    // this.screen.key(['r'], () => {
    //   this.refreshData();
    // });

    // Clear logs on c
    // this.screen.key(['c'], () => {
    //   this.logsBox.setContent('Logs cleared...');
    //   this.screen.render();
    // });

    // Handle resize
    // this.screen.on('resize', () => {
    //   this.screen.render();
    // });
  }

  public async start(): Promise<void> {
    this.log('Dashboard starting...');

    try {
      // Initial data load
      await this.refreshData();

      // Start auto-refresh
      this.refreshTimer = setInterval(() => {
        this.refreshData().catch(error => {
          this.log(`Refresh error: ${error.message}`, 'error');
        });
      }, this.refreshInterval);

      // TODO: Add blessed dependency for full dashboard
      // Render screen
      // this.screen.render();

      this.log('Dashboard started successfully');

    } catch (error) {
      this.log(`Failed to start dashboard: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  public stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.log('Dashboard stopped');
  }

  private async refreshData(): Promise<void> {
    try {
      this.updateStatusBar('Refreshing...');

      // Fetch dashboard data from backend
      const response = await fetch('/monitoring/dashboard?timeRange=1h', {
        headers: {
          'Authorization': `Bearer ${this.client.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      this.dashboardData = result.data;

      // TODO: Add blessed dependency for full dashboard
      // Update UI components
      // this.updateOverview();
      // this.updateMetrics();
      // this.updateAlerts();

      this.updateStatusBar(`Last updated: ${new Date().toLocaleTimeString()}`);
      // TODO: Add blessed dependency for full dashboard
      // this.screen.render();

    } catch (error) {
      this.log(`Data refresh failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      this.updateStatusBar(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private updateOverview(): void {
    // TODO: Add blessed dependency for full dashboard
    if (!this.dashboardData) return;

    const { overview } = this.dashboardData;
    const statusColor = overview.status === 'healthy' ? 'green' :
      overview.status === 'warning' ? 'yellow' : 'red';

    const content = `
{bold}Status:{/bold} {${statusColor}-fg}${overview.status.toUpperCase()}{/}
{bold}Uptime:{/bold} ${formatDuration(overview.uptime * 1000)}
{bold}Connections:{/bold} ${overview.totalConnections.toLocaleString()}
{bold}Events:{/bold} ${overview.totalEvents.toLocaleString()}
{bold}Error Rate:{/bold} ${(overview.errorRate * 100).toFixed(2)}%
{bold}Avg Latency:{/bold} ${overview.averageLatency.toFixed(0)}ms
    `.trim();

    // this.overviewBox.setContent(content);
  }

  private updateMetrics(): void {
    // TODO: Add blessed dependency for full dashboard
    if (!this.dashboardData) return;

    const { realTimeMetrics } = this.dashboardData;

    const content = `
{bold}Connections/sec:{/bold} ${realTimeMetrics.connectionsPerSecond.toFixed(1)}
{bold}Events/sec:{/bold} ${realTimeMetrics.eventsPerSecond.toFixed(1)}
{bold}Data Rate:{/bold} ${formatBytes(realTimeMetrics.dataTransferRate)}/s
{bold}CPU Usage:{/bold} ${realTimeMetrics.cpuUsage.toFixed(1)}%
{bold}Memory Usage:{/bold} ${realTimeMetrics.memoryUsage.toFixed(1)}%

{bold}Performance Indicators:{/bold}
${'█'.repeat(Math.floor(realTimeMetrics.cpuUsage / 5))} CPU
${'█'.repeat(Math.floor(realTimeMetrics.memoryUsage / 5))} Memory
    `.trim();

    // this.metricsBox.setContent(content);
  }

  private updateAlerts(): void {
    // TODO: Add blessed dependency for full dashboard
    if (!this.dashboardData || !this.dashboardData.alerts.length) {
      // this.alertsBox.setContent('No recent alerts');
      return;
    }

    const alertLines = this.dashboardData.alerts.slice(0, 10).map(alert => {
      const severityColor = alert.severity === 'critical' ? 'red' :
        alert.severity === 'high' ? 'yellow' :
          alert.severity === 'medium' ? 'cyan' : 'white';

      const time = new Date(alert.timestamp).toLocaleTimeString();
      return `{${severityColor}-fg}[${alert.severity.toUpperCase()}]{/} ${time} - ${alert.message}`;
    });

    // this.alertsBox.setContent(alertLines.join('\n'));
  }

  private updateStatusBar(message: string): void {
    // TODO: Add blessed dependency for full dashboard
    const content = `{center}${message} | Press {bold}q{/bold} to quit | {bold}r{/bold} to refresh | {bold}c{/bold} to clear logs{/center}`;
    // this.statusBar.setContent(content);
  }

  private log(message: string, level: 'info' | 'error' | 'warn' = 'info'): void {
    // TODO: Add blessed dependency for full dashboard
    const timestamp = new Date().toLocaleTimeString();
    const levelColor = level === 'error' ? 'red' : level === 'warn' ? 'yellow' : 'white';
    const logLine = `{${levelColor}-fg}[${timestamp}] ${level.toUpperCase()}: ${message}{/}`;

    // const currentContent = this.logsBox.getContent();
    // const lines = currentContent.split('\n');
    // lines.push(logLine);

    // Keep only last 50 lines
    // if (lines.length > 50) {
    //   lines.splice(0, lines.length - 50);
    // }

    // this.logsBox.setContent(lines.join('\n'));
    // this.logsBox.scrollTo(lines.length);

    // if (this.screen) {
    //   this.screen.render();
    // }

    // For now, just console.log
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
  }
}

// Factory function for easy creation
export function createTerminalDashboard(options: DashboardOptions): TerminalDashboard {
  return new TerminalDashboard(options);
}
