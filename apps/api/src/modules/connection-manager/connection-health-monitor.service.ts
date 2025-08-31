import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConnectionManagerService, ConnectionState } from './connection-manager.service';
import os from 'os';
import { randomUUID } from 'crypto';

export interface HealthMetrics {
  timestamp: Date;
  totalConnections: number;
  healthyConnections: number;
  unhealthyConnections: number;
  averageLatency: number;            // ms (not rounded internally)
  connectionQualityDistribution: Record<string, number>;
  reconnectionRate: number;          // 0..1
  errorRate: number;                 // 0..1
  systemLoad: number;                // 0..1
}

export enum HealthAlertType {
  HIGH_LATENCY = 'HIGH_LATENCY',
  HIGH_ERROR_RATE = 'HIGH_ERROR_RATE',
  LOW_CONNECTION_QUALITY = 'LOW_CONNECTION_QUALITY',
  SYSTEM_OVERLOAD = 'SYSTEM_OVERLOAD',
}

export enum HealthAlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface HealthAlert {
  id: string;
  type: HealthAlertType;
  severity: HealthAlertSeverity;
  message: string;
  metrics: Partial<HealthMetrics>;
  timestamp: Date;
  acknowledged: boolean;
  lastNotifiedAt: Date;
}

export interface HealthThresholds {
  maxAverageLatency: number;          // ms
  maxErrorRate: number;               // 0..1
  minHealthyConnectionRatio: number;  // 0..1
  maxSystemLoad: number;              // 0..1
  maxReconnectionRate: number;        // 0..1
}

type Trend = 'IMPROVING' | 'STABLE' | 'DEGRADING';
type ErrorTrend = 'IMPROVING' | 'STABLE' | 'WORSENING';

const EVENTS = {
  METRICS_COLLECTED: 'health.metrics.collected',
  ALERT_CREATED: 'health.alert.created',
  ALERT_ACK: 'health.alert.acknowledged',
} as const;

@Injectable()
export class ConnectionHealthMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConnectionHealthMonitorService.name);

  // timers
  private monitoringTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  // state
  private healthHistory: HealthMetrics[] = [];
  private activeAlerts = new Map<HealthAlertType, HealthAlert>(); // de-duped by type

  // config
  private readonly thresholds: HealthThresholds;
  private readonly monitoringIntervalMs: number;
  private readonly historyRetentionMs: number;
  private readonly alertCooldownMs: number;
  private readonly emaAlpha: number; // smoothing factor 0..1

  // EMA state
  private emaLatency?: number;
  private emaErrorRate?: number;
  private emaReconnRate?: number;

  constructor(
    private readonly connectionManager: ConnectionManagerService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {
    // Coerce numbers safely; defaults are production-sane
    const num = (path: string, def: number) => {
      const v = this.config.get(path);
      const n = typeof v === 'string' ? Number(v) : (v as number | undefined);
      return Number.isFinite(n!) ? (n as number) : def;
    };

    this.thresholds = {
      maxAverageLatency: num('health.thresholds.maxAverageLatency', 1000),
      maxErrorRate: num('health.thresholds.maxErrorRate', 0.1),
      minHealthyConnectionRatio: num('health.thresholds.minHealthyConnectionRatio', 0.8),
      maxSystemLoad: num('health.thresholds.maxSystemLoad', 0.8),
      maxReconnectionRate: num('health.thresholds.maxReconnectionRate', 0.2),
    };

    this.monitoringIntervalMs = num('health.monitoring.interval', 30_000);
    this.historyRetentionMs = num('health.monitoring.historyRetention', 3_600_000);
    this.alertCooldownMs = num('health.alerts.cooldown', 300_000); // 5m
    this.emaAlpha = Math.min(Math.max(num('health.monitoring.emaAlpha', 0.3), 0.05), 0.95);
  }

  async onModuleInit(): Promise<void> {
    this.schedule();
    this.scheduleCleanup();
    // immediate first run (no wait for first interval)
    void this.performHealthCheck();
    this.logger.log('Connection Health Monitor started');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.monitoringTimer) clearTimeout(this.monitoringTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.logger.log('Connection Health Monitor stopped');
  }

  // Public APIs
  getCurrentHealthMetrics(): HealthMetrics {
    const stats = this.connectionManager.getConnectionStats(); // expect: { total:number, byQuality:Record<string,number> }
    const connections = this.connectionManager.getAllConnections();

    const total = stats.total ?? 0;

    const healthyConnections = connections.filter(c => {
      return c &&
        typeof c.connectionQuality === 'string' &&
        (c.connectionQuality === 'EXCELLENT' || c.connectionQuality === 'GOOD');
    }).length;

    const unhealthyConnections = Math.max(total - healthyConnections, 0);

    const totalLatency = connections.reduce((sum: number, c: ConnectionState) => sum + (c.latency ?? 0), 0);
    const avgLatency = total > 0 ? totalLatency / total : 0;

    const reconnectingConnections = connections.filter((c: ConnectionState) => (c.reconnectAttempts ?? 0) > 0).length;
    const reconnectionRateRaw = total > 0 ? reconnectingConnections / total : 0;

    // FIX: proper precedence; treat FAILED or SUSPENDED as failures (recent)
    const recentFailures = connections.filter((c: ConnectionState) => {
      const hasDisc = (c.totalDisconnections ?? 0) > 0;
      const failed = c.status === 'FAILED' || c.status === 'SUSPENDED';
      return hasDisc && failed;
    }).length;
    const errorRateRaw = total > 0 ? recentFailures / total : 0;

    // EMA smoothing (no early rounding)
    this.emaLatency = this.ema(this.emaLatency, avgLatency);
    this.emaErrorRate = this.ema(this.emaErrorRate, errorRateRaw);
    this.emaReconnRate = this.ema(this.emaReconnRate, reconnectionRateRaw);

    const systemLoad = this.calculateSystemLoad({
      reconnectionRate: this.emaReconnRate ?? reconnectionRateRaw,
    });

    return {
      timestamp: new Date(),
      totalConnections: total,
      healthyConnections,
      unhealthyConnections,
      averageLatency: this.emaLatency ?? avgLatency,
      connectionQualityDistribution: stats.byQuality ?? {},
      reconnectionRate: this.emaReconnRate ?? reconnectionRateRaw,
      errorRate: this.emaErrorRate ?? errorRateRaw,
      systemLoad,
    };
  }

  getHealthHistory(durationMs: number = 3_600_000): HealthMetrics[] {
    const cutoff = Date.now() - durationMs;
    return this.healthHistory.filter(m => m.timestamp.getTime() >= cutoff);
  }

  getActiveAlerts(): HealthAlert[] {
    return Array.from(this.activeAlerts.values()).filter(a => !a.acknowledged);
  }

  acknowledgeAlert(typeOrId: string): boolean {
    // support id or type keys
    for (const [type, alert] of this.activeAlerts.entries()) {
      if (alert.id === typeOrId || type === (typeOrId as HealthAlertType)) {
        alert.acknowledged = true;
        alert.lastNotifiedAt = new Date();
        this.events.emit(EVENTS.ALERT_ACK, { alertId: alert.id, alert });
        return true;
      }
    }
    return false;
  }

  getHealthSummary(): {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    metrics: HealthMetrics;
    activeAlerts: number;
    trends: {
      latencyTrend: Trend;
      connectionTrend: 'GROWING' | 'STABLE' | 'DECLINING';
      errorTrend: ErrorTrend;
    };
  } {
    const metrics = this.getCurrentHealthMetrics();
    const alerts = this.getActiveAlerts();

    let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (alerts.some(a => a.severity === HealthAlertSeverity.CRITICAL)) status = 'CRITICAL';
    else if (alerts.some(a => a.severity === HealthAlertSeverity.HIGH || a.severity === HealthAlertSeverity.MEDIUM)) status = 'WARNING';

    const trends = this.calculateTrends();

    return {
      status,
      metrics,
      activeAlerts: alerts.length,
      trends,
    };
  }

  // Scheduling with drift correction
  private schedule(): void {
    const interval = this.monitoringIntervalMs;
    const tick = async (planned: number) => {
      try {
        await this.performHealthCheck();
      } catch (e) {
        this.logger.error('Health check error', e as any);
      } finally {
        const now = Date.now();
        const nextPlanned = planned + interval;
        const delay = Math.max(0, nextPlanned - now);
        this.monitoringTimer = setTimeout(() => tick(nextPlanned), delay);
        this.monitoringTimer.unref?.();
      }
    };
    this.monitoringTimer = setTimeout(() => tick(Date.now()), 0);
    this.monitoringTimer.unref?.();
  }

  private scheduleCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
      this.cleanupOldAlerts();
    }, 300_000); // 5m
    this.cleanupTimer.unref?.();
  }

  private async performHealthCheck(): Promise<void> {
    const metrics = this.getCurrentHealthMetrics();

    // store history with hard cap (prevents unbounded growth even if retention misconfigured)
    this.healthHistory.push(metrics);
    if (this.healthHistory.length > 10_000) this.healthHistory.splice(0, this.healthHistory.length - 10_000);
    this.cleanupOldMetrics();

    await this.checkThresholdsAndAlert(metrics);

    this.events.emit(EVENTS.METRICS_COLLECTED, { metrics });

    // concise debug (round only for logs)
    this.logger.debug(
      `Health: total=${metrics.totalConnections} avgLatency=${Math.round(metrics.averageLatency)}ms ` +
      `err=${(metrics.errorRate * 100).toFixed(1)}% reconn=${(metrics.reconnectionRate * 100).toFixed(1)}% ` +
      `load=${(metrics.systemLoad * 100).toFixed(1)}%`
    );
  }

  private async checkThresholdsAndAlert(m: HealthMetrics): Promise<void> {
    // HIGH_LATENCY
    if (m.averageLatency > this.thresholds.maxAverageLatency) {
      this.createOrUpdateAlert(
        HealthAlertType.HIGH_LATENCY,
        this.severityForOver(m.averageLatency, this.thresholds.maxAverageLatency, [1.2, 1.5, 2.0]),
        `Average latency ${Math.round(m.averageLatency)}ms > ${this.thresholds.maxAverageLatency}ms`,
        { averageLatency: m.averageLatency },
      );
    }

    // HIGH_ERROR_RATE
    if (m.errorRate > this.thresholds.maxErrorRate) {
      this.createOrUpdateAlert(
        HealthAlertType.HIGH_ERROR_RATE,
        this.severityForOver(m.errorRate, this.thresholds.maxErrorRate, [1.25, 1.5, 2.0]),
        `Error rate ${(m.errorRate * 100).toFixed(2)}% > ${(this.thresholds.maxErrorRate * 100).toFixed(2)}%`,
        { errorRate: m.errorRate },
      );
    }

    // LOW_CONNECTION_QUALITY
    const healthyRatio = m.totalConnections > 0 ? m.healthyConnections / m.totalConnections : 1;
    if (healthyRatio < this.thresholds.minHealthyConnectionRatio) {
      this.createOrUpdateAlert(
        HealthAlertType.LOW_CONNECTION_QUALITY,
        this.severityForUnder(healthyRatio, this.thresholds.minHealthyConnectionRatio, [0.9, 0.8, 0.6]),
        `Healthy ratio ${(healthyRatio * 100).toFixed(1)}% < ${(this.thresholds.minHealthyConnectionRatio * 100).toFixed(1)}%`,
        { healthyConnections: m.healthyConnections, totalConnections: m.totalConnections },
      );
    }

    // SYSTEM_OVERLOAD
    if (m.systemLoad > this.thresholds.maxSystemLoad) {
      this.createOrUpdateAlert(
        HealthAlertType.SYSTEM_OVERLOAD,
        this.severityForOver(m.systemLoad, this.thresholds.maxSystemLoad, [1.1, 1.25, 1.5]),
        `System load ${(m.systemLoad * 100).toFixed(1)}% > ${(this.thresholds.maxSystemLoad * 100).toFixed(1)}%`,
        { systemLoad: m.systemLoad },
      );
    }

    // Reconnection rate uses HIGH_ERROR_RATE type or its own? Keep distinct signal; we keep as HIGH_ERROR_RATE escalation text only if above threshold but not duplicating type.
    if (m.reconnectionRate > this.thresholds.maxReconnectionRate) {
      this.createOrUpdateAlert(
        HealthAlertType.HIGH_ERROR_RATE,
        HealthAlertSeverity.MEDIUM,
        `Reconnection ${(m.reconnectionRate * 100).toFixed(1)}% > ${(this.thresholds.maxReconnectionRate * 100).toFixed(1)}%`,
        { reconnectionRate: m.reconnectionRate },
      );
    }
  }

  private createOrUpdateAlert(
    type: HealthAlertType,
    severity: HealthAlertSeverity,
    message: string,
    metrics: Partial<HealthMetrics>,
  ): void {
    const now = new Date();
    const existing = this.activeAlerts.get(type);
    if (!existing) {
      const alert: HealthAlert = {
        id: randomUUID(),
        type,
        severity,
        message,
        metrics,
        timestamp: now,
        acknowledged: false,
        lastNotifiedAt: new Date(0),
      };
      this.activeAlerts.set(type, alert);
      this.events.emit(EVENTS.ALERT_CREATED, { alert });
      this.logger.warn(`${type}: ${message}`);
      return;
    }

    // escalate severity, refresh message/metrics, respect cooldown for re-notify
    const worsened = this.severityRank(severity) > this.severityRank(existing.severity);
    const cooldownPassed = now.getTime() - existing.lastNotifiedAt.getTime() >= this.alertCooldownMs;

    existing.severity = worsened ? severity : existing.severity;
    existing.message = message;
    existing.metrics = { ...existing.metrics, ...metrics };
    existing.timestamp = now;

    if (worsened || cooldownPassed) {
      existing.lastNotifiedAt = now;
      this.events.emit(EVENTS.ALERT_CREATED, { alert: existing });
      this.logger.warn(`${type}: ${message} (updated)`);
    }
  }

  private calculateSystemLoad(input: { reconnectionRate: number }): number {
    // CPU: normalize 1-min load avg by core count with fallback
    let cores = 1;
    try {
      cores = Math.max(os.cpus()?.length ?? 1, 1);
    } catch (error) {
      this.logger.warn('Failed to get CPU count, using fallback value of 1');
      cores = 1;
    }

    let cpuLoad = 0;
    try {
      cpuLoad = Math.min(os.loadavg()[0] / cores, 1);
    } catch (error) {
      this.logger.warn('Failed to get CPU load, using fallback value of 0');
      cpuLoad = 0;
    }

    // Memory: RSS vs total system memory (more realistic than heapUsed/heapTotal)
    let memLoad = 0;
    try {
      const rss = process.memoryUsage().rss;
      memLoad = Math.min(rss / os.totalmem(), 1);
    } catch (error) {
      this.logger.warn('Failed to get memory info, using fallback value of 0');
      memLoad = 0;
    }

    // Network/connection pressure proxy: reconnection rate
    const reconn = Math.min(Math.max(input.reconnectionRate, 0), 1);

    // Weighted blend; tune via config later if needed
    const load = 0.45 * cpuLoad + 0.35 * memLoad + 0.20 * reconn;
    return Math.min(Math.max(load, 0), 1);
  }

  private calculateTrends(): {
    latencyTrend: Trend;
    connectionTrend: 'GROWING' | 'STABLE' | 'DECLINING';
    errorTrend: ErrorTrend;
  } {
    const recent = this.healthHistory.slice(-10); // last 10 points
    if (recent.length < 4) {
      return { latencyTrend: 'STABLE', connectionTrend: 'STABLE', errorTrend: 'STABLE' };
    }
    const lat = this.relativeTrend(recent.map(m => m.averageLatency));
    const con = this.relativeTrend(recent.map(m => m.totalConnections));
    const err = this.relativeTrend(recent.map(m => m.errorRate));

    return {
      latencyTrend: lat > 0.1 ? 'DEGRADING' : lat < -0.1 ? 'IMPROVING' : 'STABLE',
      connectionTrend: con > 0.1 ? 'GROWING' : con < -0.1 ? 'DECLINING' : 'STABLE',
      errorTrend: err > 0.1 ? 'WORSENING' : err < -0.1 ? 'IMPROVING' : 'STABLE',
    };
  }

  private relativeTrend(values: number[]): number {
    if (values.length < 2) return 0;
    const mid = Math.floor(values.length / 2);
    const a = this.avg(values.slice(0, mid));
    const b = this.avg(values.slice(mid));
    return a > 0 ? (b - a) / a : 0;
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.historyRetentionMs;
    // fast path if already small
    if (this.healthHistory.length <= 1_000) {
      this.healthHistory = this.healthHistory.filter(m => m.timestamp.getTime() >= cutoff);
      return;
    }
    // slice-based to avoid many allocations on very large arrays
    const idx = this.healthHistory.findIndex(m => m.timestamp.getTime() >= cutoff);
    if (idx > 0) this.healthHistory = this.healthHistory.slice(Math.max(0, idx));
  }

  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - 3_600_000; // drop acknowledged >1h old
    for (const [type, alert] of this.activeAlerts.entries()) {
      if (alert.acknowledged && alert.timestamp.getTime() < cutoff) {
        this.activeAlerts.delete(type);
      }
    }
  }

  // helpers
  private ema(prev: number | undefined, value: number): number {
    if (!Number.isFinite(value)) return prev ?? 0;
    if (prev === undefined) return value;
    return this.emaAlpha * value + (1 - this.emaAlpha) * prev;
  }
  private avg(arr: number[]): number {
    if (arr.length === 0) return 0;
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }
  private severityRank(s: HealthAlertSeverity): number {
    switch (s) {
      case HealthAlertSeverity.LOW: return 1;
      case HealthAlertSeverity.MEDIUM: return 2;
      case HealthAlertSeverity.HIGH: return 3;
      case HealthAlertSeverity.CRITICAL: return 4;
      default: return 0;
    }
  }
  private severityForOver(value: number, limit: number, multipliers: [number, number, number]): HealthAlertSeverity {
    if (value >= limit * multipliers[2]) return HealthAlertSeverity.CRITICAL;
    if (value >= limit * multipliers[1]) return HealthAlertSeverity.HIGH;
    if (value >= limit * multipliers[0]) return HealthAlertSeverity.MEDIUM;
    return HealthAlertSeverity.LOW;
  }
  private severityForUnder(value: number, limit: number, cutoffs: [number, number, number]): HealthAlertSeverity {
    // value/limit fraction
    const r = value / limit;
    if (r <= cutoffs[2]) return HealthAlertSeverity.CRITICAL;
    if (r <= cutoffs[1]) return HealthAlertSeverity.HIGH;
    if (r <= cutoffs[0]) return HealthAlertSeverity.MEDIUM;
    return HealthAlertSeverity.LOW;
  }
}
