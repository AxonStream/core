import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/services/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface ConnectionState {
  sessionId: string;
  userId?: string;
  organizationId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'SUSPENDED' | 'FAILED';
  clientType: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  disconnectedAt?: Date;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  lastReconnectAttempt?: Date;
  nextReconnectAt?: Date;
  connectionQuality: 'EXCELLENT' | 'GOOD' | 'POOR' | 'CRITICAL';
  latency: number;
  missedHeartbeats: number;
  totalDisconnections: number;
  metadata?: Record<string, any>;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  resetAfter: number; // Reset retry count after successful connection duration
}

export interface ConnectionQualityMetrics {
  averageLatency: number;
  packetLoss: number;
  jitter: number;
  throughput: number;
  errorRate: number;
}

export interface ReconnectionStrategy {
  type: 'EXPONENTIAL' | 'LINEAR' | 'FIXED' | 'ADAPTIVE';
  parameters: Record<string, any>;
}

export interface HeartbeatConfig {
  interval: number;
  timeout: number;
  maxMissed: number;
}

@Injectable()
export class ConnectionManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConnectionManagerService.name);
  private connections = new Map<string, ConnectionState>();
  private heartbeatIntervals = new Map<string, NodeJS.Timeout>();
  private retryTimeouts = new Map<string, NodeJS.Timeout>();
  private qualityMonitors = new Map<string, NodeJS.Timeout>();
  private connectionMetrics = new Map<string, ConnectionQualityMetrics>();

  private readonly defaultRetryConfig: RetryConfig;
  private readonly defaultHeartbeatConfig: HeartbeatConfig;
  private readonly cleanupInterval: NodeJS.Timeout;
  private readonly metricsInterval: NodeJS.Timeout;

  constructor(
    private prismaService: PrismaService,
    private redisService: RedisService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.defaultRetryConfig = {
      maxAttempts: this.configService.get<number>('connection.retry.maxAttempts', 5),
      baseDelay: this.configService.get<number>('connection.retry.baseDelay', 1000),
      maxDelay: this.configService.get<number>('connection.retry.maxDelay', 30000),
      backoffMultiplier: this.configService.get<number>('connection.retry.backoffMultiplier', 2),
      jitter: this.configService.get<boolean>('connection.retry.jitter', true),
      resetAfter: this.configService.get<number>('connection.retry.resetAfter', 300000), // 5 minutes
    };

    this.defaultHeartbeatConfig = {
      interval: this.configService.get<number>('connection.heartbeat.interval', 30000),
      timeout: this.configService.get<number>('connection.heartbeat.timeout', 5000),
      maxMissed: this.configService.get<number>('connection.heartbeat.maxMissed', 3),
    };

    // Start periodic cleanup and metrics collection
    this.cleanupInterval = setInterval(() => this.performCleanup(), 300000); // 5 minutes
    this.metricsInterval = setInterval(() => this.collectMetrics(), 60000); // 1 minute
  }

  async onModuleInit() {
    await this.initializeConnectionManager();
  }

  async onModuleDestroy() {
    // Clean up all intervals
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);

    // Stop all heartbeat monitoring
    for (const interval of this.heartbeatIntervals.values()) {
      clearInterval(interval);
    }

    // Cancel all retry timeouts
    for (const timeout of this.retryTimeouts.values()) {
      clearTimeout(timeout);
    }

    // Stop all quality monitors
    for (const monitor of this.qualityMonitors.values()) {
      clearInterval(monitor);
    }

    this.logger.log('Connection Manager destroyed');
  }

  private async initializeConnectionManager() {
    try {
      // Load existing connections from database
      await this.loadExistingConnections();

      // Start cleanup task
      this.startCleanupTask();

      this.logger.log('Connection Manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Connection Manager:', error);
      throw error;
    }
  }

  // Connection Lifecycle Management
  async registerConnection(
    sessionId: string,
    userId: string | undefined,
    organizationId: string,
    clientType: string,
    metadata?: Record<string, any>
  ): Promise<ConnectionState> {
    try {
      const connectionState: ConnectionState = {
        sessionId,
        userId,
        organizationId,
        status: 'CONNECTED',
        clientType,
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
        reconnectAttempts: 0,
        maxReconnectAttempts: this.defaultRetryConfig.maxAttempts,
        connectionQuality: 'EXCELLENT',
        latency: 0,
        missedHeartbeats: 0,
        totalDisconnections: 0,
        metadata,
      };

      // Store in memory
      this.connections.set(sessionId, connectionState);

      // Persist to database
      await this.prismaService.axonPulsConnection.upsert({
        where: { sessionId },
        create: {
          sessionId,
          clientType: clientType as any,
          status: 'CONNECTED',
          channels: [],
          metadata: metadata || {},
          organizationId,
          userId,
        },
        update: {
          status: 'CONNECTED',
          lastHeartbeat: new Date(),
          disconnectedAt: null,
        },
      });

      // Start heartbeat monitoring
      this.startHeartbeatMonitoring(sessionId);

      // Start connection quality monitoring
      this.startQualityMonitoring(sessionId);

      // Initialize connection metrics
      this.connectionMetrics.set(sessionId, {
        averageLatency: 0,
        packetLoss: 0,
        jitter: 0,
        throughput: 0,
        errorRate: 0,
      });

      // Publish connection event
      await this.publishConnectionEvent(sessionId, 'CONNECTED');

      // Emit connection event
      this.eventEmitter.emit('connection.registered', {
        sessionId,
        userId,
        organizationId,
        clientType,
        timestamp: new Date(),
      });

      this.logger.log(`Connection registered: ${sessionId} (${clientType})`);
      return connectionState;
    } catch (error) {
      this.logger.error(`Failed to register connection ${sessionId}:`, error);
      throw error;
    }
  }

  async updateConnectionStatus(
    sessionId: string,
    status: ConnectionState['status']
  ): Promise<void> {
    try {
      const connection = this.connections.get(sessionId);
      if (!connection) {
        this.logger.warn(`Connection ${sessionId} not found for status update`);
        return;
      }

      connection.status = status;

      if (status === 'DISCONNECTED') {
        connection.disconnectedAt = new Date();
        this.stopHeartbeatMonitoring(sessionId);
      }

      // Update database
      await this.prismaService.axonPulsConnection.update({
        where: { sessionId },
        data: {
          status: status as any,
          disconnectedAt: status === 'DISCONNECTED' ? new Date() : undefined,
        },
      });

      // Publish status change event
      await this.publishConnectionEvent(sessionId, status);

      this.logger.debug(`Connection ${sessionId} status updated to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update connection status for ${sessionId}:`, error);
      throw error;
    }
  }

  async removeConnection(sessionId: string): Promise<void> {
    try {
      const connection = this.connections.get(sessionId);
      if (!connection) {
        this.logger.warn(`Connection ${sessionId} not found for removal`);
        return;
      }

      // Stop monitoring
      this.stopHeartbeatMonitoring(sessionId);
      this.stopRetryAttempts(sessionId);

      // Remove from memory
      this.connections.delete(sessionId);

      // Update database
      await this.prismaService.axonPulsConnection.update({
        where: { sessionId },
        data: {
          status: 'DISCONNECTED',
          disconnectedAt: new Date(),
        },
      });

      // Publish disconnection event
      await this.publishConnectionEvent(sessionId, 'DISCONNECTED');

      this.logger.log(`Connection removed: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to remove connection ${sessionId}:`, error);
      throw error;
    }
  }

  // Heartbeat Management
  async updateHeartbeat(sessionId: string, clientTimestamp?: number): Promise<{ latency: number; quality: string }> {
    try {
      const connection = this.connections.get(sessionId);
      if (!connection) {
        this.logger.warn(`Connection ${sessionId} not found for heartbeat update`);
        return { latency: -1, quality: 'UNKNOWN' };
      }

      const now = new Date();
      const latency = clientTimestamp ? Date.now() - clientTimestamp : 0;

      // Update connection state
      connection.lastHeartbeat = now;
      connection.latency = latency;
      connection.missedHeartbeats = 0; // Reset missed heartbeats

      // Update connection quality based on latency
      connection.connectionQuality = this.calculateConnectionQuality(latency, connection);

      // Update metrics
      this.updateConnectionMetrics(sessionId, latency);

      // Update database periodically (not on every heartbeat for performance)
      if (Math.random() < 0.1) { // 10% chance to update DB
        await this.prismaService.axonPulsConnection.update({
          where: { sessionId },
          data: {
            lastHeartbeat: now,
            metadata: {
              ...connection.metadata,
              latency,
              quality: connection.connectionQuality,
              missedHeartbeats: connection.missedHeartbeats,
            },
          },
        });
      }

      this.logger.debug(`Heartbeat updated for ${sessionId}: ${latency}ms (${connection.connectionQuality})`);

      return {
        latency,
        quality: connection.connectionQuality,
      };
    } catch (error) {
      this.logger.error(`Failed to update heartbeat for ${sessionId}:`, error);
      return { latency: -1, quality: 'ERROR' };
    }
  }



  private stopHeartbeatMonitoring(sessionId: string): void {
    const interval = this.heartbeatIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(sessionId);
    }
  }

  private async checkConnectionHealth(sessionId: string): Promise<void> {
    try {
      const connection = this.connections.get(sessionId);
      if (!connection) {
        this.stopHeartbeatMonitoring(sessionId);
        return;
      }

      const timeSinceLastHeartbeat = Date.now() - connection.lastHeartbeat.getTime();
      const heartbeatInterval = this.defaultHeartbeatConfig.interval;
      const maxMissedTime = this.defaultHeartbeatConfig.maxMissed * heartbeatInterval;

      // Check for missed heartbeats
      if (timeSinceLastHeartbeat > heartbeatInterval) {
        connection.missedHeartbeats++;

        // Emit warning for missed heartbeat
        this.eventEmitter.emit('connection.heartbeat.missed', {
          sessionId,
          missedCount: connection.missedHeartbeats,
          timeSinceLastHeartbeat,
        });

        // Update connection quality based on missed heartbeats
        if (connection.missedHeartbeats >= 2) {
          connection.connectionQuality = 'POOR';
        } else if (connection.missedHeartbeats >= 1) {
          connection.connectionQuality = 'CRITICAL';
        }
      }

      // Handle connection timeout
      if (timeSinceLastHeartbeat > maxMissedTime) {
        this.logger.warn(`Connection ${sessionId} timed out after ${connection.missedHeartbeats} missed heartbeats`);
        await this.handleConnectionTimeout(sessionId);
      }

      // Adaptive monitoring: adjust heartbeat frequency based on connection quality
      this.adjustHeartbeatFrequency(sessionId, connection);

    } catch (error) {
      this.logger.error(`Error checking connection health for ${sessionId}:`, error);
    }
  }

  // Retry Management
  async scheduleReconnection(
    sessionId: string,
    retryConfig: Partial<RetryConfig> = {},
    strategy: ReconnectionStrategy = { type: 'EXPONENTIAL', parameters: {} }
  ): Promise<void> {
    try {
      const connection = this.connections.get(sessionId);
      if (!connection) {
        this.logger.warn(`Connection ${sessionId} not found for reconnection scheduling`);
        return;
      }

      const config = { ...this.defaultRetryConfig, ...retryConfig };

      // Check if we've exceeded max attempts
      if (connection.reconnectAttempts >= config.maxAttempts) {
        this.logger.warn(`Max reconnection attempts (${config.maxAttempts}) reached for ${sessionId}`);
        await this.updateConnectionStatus(sessionId, 'FAILED');

        // Emit failure event
        this.eventEmitter.emit('connection.reconnection.failed', {
          sessionId,
          attempts: connection.reconnectAttempts,
          totalDisconnections: connection.totalDisconnections,
        });

        return;
      }

      connection.reconnectAttempts += 1;
      connection.lastReconnectAttempt = new Date();
      await this.updateConnectionStatus(sessionId, 'RECONNECTING');

      // Calculate delay based on strategy
      const delay = this.calculateRetryDelay(connection.reconnectAttempts, config, strategy);
      connection.nextReconnectAt = new Date(Date.now() + delay);

      // Emit reconnection scheduled event
      this.eventEmitter.emit('connection.reconnection.scheduled', {
        sessionId,
        attempt: connection.reconnectAttempts,
        delay,
        nextAttemptAt: connection.nextReconnectAt,
        strategy: strategy.type,
      });

      const timeout = setTimeout(async () => {
        await this.attemptReconnection(sessionId, strategy);
      }, delay);

      this.retryTimeouts.set(sessionId, timeout);

      this.logger.log(`Scheduled ${strategy.type} reconnection for ${sessionId} in ${delay}ms (attempt ${connection.reconnectAttempts}/${config.maxAttempts})`);
    } catch (error) {
      this.logger.error(`Failed to schedule reconnection for ${sessionId}:`, error);
    }
  }

  private calculateRetryDelay(
    attempt: number,
    config: RetryConfig,
    strategy: ReconnectionStrategy = { type: 'EXPONENTIAL', parameters: {} }
  ): number {
    let delay: number;

    switch (strategy.type) {
      case 'EXPONENTIAL':
        delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );
        break;

      case 'LINEAR':
        const increment = strategy.parameters.increment || config.baseDelay;
        delay = Math.min(config.baseDelay + (increment * (attempt - 1)), config.maxDelay);
        break;

      case 'FIXED':
        delay = strategy.parameters.fixedDelay || config.baseDelay;
        break;

      case 'ADAPTIVE':
        // Adaptive strategy based on connection history and current network conditions
        const baseMultiplier = this.getAdaptiveMultiplier(attempt);
        delay = Math.min(config.baseDelay * baseMultiplier, config.maxDelay);
        break;

      default:
        delay = config.baseDelay;
    }

    // Apply jitter if enabled
    if (config.jitter) {
      const jitterRange = strategy.parameters.jitterRange || 0.5;
      delay = delay * (1 - jitterRange + Math.random() * jitterRange * 2);
    }

    return Math.floor(Math.max(delay, 100)); // Minimum 100ms delay
  }

  private getAdaptiveMultiplier(attempt: number): number {
    // Adaptive multiplier based on attempt number and system load
    const baseMultiplier = Math.pow(1.5, attempt - 1);
    const systemLoadFactor = this.getSystemLoadFactor();
    const networkQualityFactor = this.getNetworkQualityFactor();

    return baseMultiplier * systemLoadFactor * networkQualityFactor;
  }

  private getSystemLoadFactor(): number {
    // Simple system load estimation based on active connections
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.status === 'CONNECTED').length;

    if (activeConnections > 1000) return 2.0;
    if (activeConnections > 500) return 1.5;
    if (activeConnections > 100) return 1.2;
    return 1.0;
  }

  private getNetworkQualityFactor(): number {
    // Network quality estimation based on average connection quality
    const connections = Array.from(this.connections.values());
    if (connections.length === 0) return 1.0;

    const qualityScores = connections.map(conn => {
      switch (conn.connectionQuality) {
        case 'EXCELLENT': return 1.0;
        case 'GOOD': return 1.2;
        case 'POOR': return 1.5;
        case 'CRITICAL': return 2.0;
        default: return 1.0;
      }
    });

    const averageScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
    return Math.min(averageScore, 3.0); // Cap at 3x multiplier
  }

  private async attemptReconnection(sessionId: string, strategy?: ReconnectionStrategy): Promise<void> {
    try {
      const connection = this.connections.get(sessionId);
      if (!connection) {
        this.logger.warn(`Connection ${sessionId} not found during reconnection attempt`);
        return;
      }

      this.logger.log(`Attempting reconnection ${connection.reconnectAttempts} for ${sessionId} using ${strategy?.type || 'EXPONENTIAL'} strategy`);

      // Emit reconnection attempt event
      this.eventEmitter.emit('connection.reconnection.attempt', {
        sessionId,
        attempt: connection.reconnectAttempts,
        strategy: strategy?.type || 'EXPONENTIAL',
        timestamp: new Date(),
      });

      // Simulate reconnection logic
      // In a real implementation, this would:
      // 1. Attempt to re-establish WebSocket connection
      // 2. Verify authentication
      // 3. Restore subscriptions
      // 4. Sync any missed events

      const reconnectionSuccess = await this.performReconnectionLogic(sessionId);

      if (reconnectionSuccess) {
        // Successful reconnection
        const successfulConnectionDuration = Date.now() - connection.connectedAt.getTime();

        // Reset retry count if connection was stable for configured duration
        if (successfulConnectionDuration > this.defaultRetryConfig.resetAfter) {
          connection.reconnectAttempts = 0;
          this.logger.log(`Reset retry count for ${sessionId} after stable connection`);
        }

        connection.connectionQuality = 'GOOD'; // Start with good quality after reconnection
        connection.missedHeartbeats = 0;
        connection.nextReconnectAt = undefined;

        await this.updateConnectionStatus(sessionId, 'CONNECTED');
        this.startHeartbeatMonitoring(sessionId);
        this.startQualityMonitoring(sessionId);

        // Emit successful reconnection event
        this.eventEmitter.emit('connection.reconnection.success', {
          sessionId,
          attempts: connection.reconnectAttempts,
          totalDisconnections: connection.totalDisconnections,
          timestamp: new Date(),
        });

        this.logger.log(`Reconnection successful for ${sessionId} after ${connection.reconnectAttempts} attempts`);
      } else {
        // Reconnection failed, schedule next attempt
        this.logger.warn(`Reconnection attempt ${connection.reconnectAttempts} failed for ${sessionId}`);
        await this.scheduleReconnection(sessionId, {}, strategy);
      }
    } catch (error) {
      this.logger.error(`Reconnection attempt failed for ${sessionId}:`, error);
      await this.scheduleReconnection(sessionId, {}, strategy);
    }
  }

  private async performReconnectionLogic(sessionId: string): Promise<boolean> {
    try {
      // Simulate network conditions and reconnection success rate
      const connection = this.connections.get(sessionId);
      if (!connection) return false;

      // Success rate decreases with more attempts but improves with better network conditions
      const baseSuccessRate = 0.7;
      const attemptPenalty = Math.min(connection.reconnectAttempts * 0.1, 0.5);
      const networkBonus = this.getNetworkQualityBonus();

      const successRate = Math.max(baseSuccessRate - attemptPenalty + networkBonus, 0.1);
      const success = Math.random() < successRate;

      // Simulate connection establishment delay
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));

      return success;
    } catch (error) {
      this.logger.error(`Error in reconnection logic for ${sessionId}:`, error);
      return false;
    }
  }

  private getNetworkQualityBonus(): number {
    // Calculate network quality bonus based on overall system health
    const totalConnections = this.connections.size;
    const healthyConnections = Array.from(this.connections.values())
      .filter(conn => conn.connectionQuality === 'EXCELLENT' || conn.connectionQuality === 'GOOD').length;

    if (totalConnections === 0) return 0;

    const healthRatio = healthyConnections / totalConnections;
    return healthRatio * 0.2; // Up to 20% bonus for good network conditions
  }

  private stopRetryAttempts(sessionId: string): void {
    const timeout = this.retryTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(sessionId);
    }
  }

  // Event Handling
  private async handleConnectionTimeout(sessionId: string): Promise<void> {
    try {
      await this.updateConnectionStatus(sessionId, 'DISCONNECTED');
      await this.scheduleReconnection(sessionId);
    } catch (error) {
      this.logger.error(`Failed to handle connection timeout for ${sessionId}:`, error);
    }
  }

  private async publishConnectionEvent(
    sessionId: string,
    eventType: string
  ): Promise<void> {
    try {
      const connection = this.connections.get(sessionId);
      if (!connection) return;

      const event = {
        type: 'connection_event',
        sessionId,
        eventType,
        organizationId: connection.organizationId,
        userId: connection.userId,
        timestamp: new Date().toISOString(),
        metadata: {
          clientType: connection.clientType,
          reconnectAttempts: connection.reconnectAttempts,
        },
      };

      const channelKey = `AxonPuls:events:${connection.organizationId}:connection_events`;
      await this.redisService.publish(channelKey, event);
    } catch (error) {
      this.logger.error(`Failed to publish connection event for ${sessionId}:`, error);
    }
  }

  // Utility Methods
  private async loadExistingConnections(): Promise<void> {
    try {
      const existingConnections = await this.prismaService.axonPulsConnection.findMany({
        where: {
          status: { in: ['CONNECTED', 'RECONNECTING'] },
        },
      });

      for (const conn of existingConnections) {
        const connectionState: ConnectionState = {
          sessionId: conn.sessionId,
          userId: conn.userId || undefined,
          organizationId: conn.organizationId,
          status: conn.status as any,
          clientType: conn.clientType,
          connectedAt: conn.connectedAt,
          lastHeartbeat: conn.lastHeartbeat,
          disconnectedAt: conn.disconnectedAt || undefined,
          reconnectAttempts: 0,
          maxReconnectAttempts: this.defaultRetryConfig.maxAttempts,
          connectionQuality: 'GOOD',
          latency: 0,
          missedHeartbeats: 0,
          totalDisconnections: 0,
          metadata: conn.metadata as Record<string, any>,
        };

        this.connections.set(conn.sessionId, connectionState);

        if (conn.status === 'CONNECTED') {
          this.startHeartbeatMonitoring(conn.sessionId);
        }
      }

      this.logger.log(`Loaded ${existingConnections.length} existing connections`);
    } catch (error) {
      this.logger.error('Failed to load existing connections:', error);
    }
  }

  private startCleanupTask(): void {
    const cleanupInterval = this.configService.get<number>('connection.cleanup.interval', 300000); // 5 minutes

    setInterval(async () => {
      await this.cleanupStaleConnections();
    }, cleanupInterval);
  }

  private async cleanupStaleConnections(): Promise<void> {
    try {
      const staleThreshold = this.configService.get<number>('connection.cleanup.staleThreshold', 3600000); // 1 hour
      const cutoffTime = new Date(Date.now() - staleThreshold);

      // Clean up from database
      const result = await this.prismaService.axonPulsConnection.updateMany({
        where: {
          lastHeartbeat: { lt: cutoffTime },
          status: { in: ['CONNECTED', 'RECONNECTING'] },
        },
        data: {
          status: 'DISCONNECTED',
          disconnectedAt: new Date(),
        },
      });

      // Clean up from memory
      for (const [sessionId, connection] of this.connections.entries()) {
        if (connection.lastHeartbeat < cutoffTime) {
          this.stopHeartbeatMonitoring(sessionId);
          this.stopRetryAttempts(sessionId);
          this.connections.delete(sessionId);
        }
      }

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} stale connections`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup stale connections:', error);
    }
  }

  // Public API Methods
  getConnection(sessionId: string): ConnectionState | undefined {
    return this.connections.get(sessionId);
  }

  getAllConnections(): ConnectionState[] {
    return Array.from(this.connections.values());
  }

  getConnectionsByOrganization(organizationId: string): ConnectionState[] {
    return Array.from(this.connections.values()).filter(
      conn => conn.organizationId === organizationId
    );
  }

  getConnectionsByUser(userId: string): ConnectionState[] {
    return Array.from(this.connections.values()).filter(
      conn => conn.userId === userId
    );
  }

  getConnectionStats(): {
    total: number;
    connected: number;
    disconnected: number;
    reconnecting: number;
    suspended: number;
    failed: number;
    byQuality: Record<string, number>;
    averageLatency: number;
    totalReconnectionAttempts: number;
  } {
    const connections = Array.from(this.connections.values());

    const qualityStats = connections.reduce((acc, conn) => {
      acc[conn.connectionQuality] = (acc[conn.connectionQuality] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalLatency = connections.reduce((sum, conn) => sum + conn.latency, 0);
    const averageLatency = connections.length > 0 ? totalLatency / connections.length : 0;

    const totalReconnectionAttempts = connections.reduce((sum, conn) => sum + conn.reconnectAttempts, 0);

    return {
      total: connections.length,
      connected: connections.filter(c => c.status === 'CONNECTED').length,
      disconnected: connections.filter(c => c.status === 'DISCONNECTED').length,
      reconnecting: connections.filter(c => c.status === 'RECONNECTING').length,
      suspended: connections.filter(c => c.status === 'SUSPENDED').length,
      failed: connections.filter(c => c.status === 'FAILED').length,
      byQuality: qualityStats,
      averageLatency: Math.round(averageLatency),
      totalReconnectionAttempts,
    };
  }

  // New helper methods for enhanced connection management
  private calculateConnectionQuality(latency: number, connection: ConnectionState): 'EXCELLENT' | 'GOOD' | 'POOR' | 'CRITICAL' {
    if (connection.missedHeartbeats > 2) return 'CRITICAL';
    if (connection.missedHeartbeats > 1) return 'POOR';
    if (latency > 1000) return 'POOR';
    if (latency > 500) return 'GOOD';
    return 'EXCELLENT';
  }

  private startQualityMonitoring(sessionId: string): void {
    const monitor = setInterval(() => {
      this.monitorConnectionQuality(sessionId);
    }, 30000); // Monitor every 30 seconds

    this.qualityMonitors.set(sessionId, monitor);
  }

  private stopQualityMonitoring(sessionId: string): void {
    const monitor = this.qualityMonitors.get(sessionId);
    if (monitor) {
      clearInterval(monitor);
      this.qualityMonitors.delete(sessionId);
    }
  }

  private async monitorConnectionQuality(sessionId: string): Promise<void> {
    try {
      const connection = this.connections.get(sessionId);
      if (!connection || connection.status !== 'CONNECTED') {
        this.stopQualityMonitoring(sessionId);
        return;
      }

      const metrics = this.connectionMetrics.get(sessionId);
      if (!metrics) return;

      // Update connection quality based on metrics
      const previousQuality = connection.connectionQuality;
      connection.connectionQuality = this.calculateConnectionQuality(connection.latency, connection);

      // Emit quality change event if quality degraded significantly
      if (previousQuality !== connection.connectionQuality) {
        this.eventEmitter.emit('connection.quality.changed', {
          sessionId,
          previousQuality,
          currentQuality: connection.connectionQuality,
          metrics,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      this.logger.error(`Error monitoring connection quality for ${sessionId}:`, error);
    }
  }

  private updateConnectionMetrics(sessionId: string, latency: number): void {
    const metrics = this.connectionMetrics.get(sessionId);
    if (!metrics) return;

    // Update average latency with exponential moving average
    const alpha = 0.1; // Smoothing factor
    metrics.averageLatency = metrics.averageLatency * (1 - alpha) + latency * alpha;

    // Calculate jitter (variation in latency)
    const jitter = Math.abs(latency - metrics.averageLatency);
    metrics.jitter = metrics.jitter * (1 - alpha) + jitter * alpha;
  }

  private adjustHeartbeatFrequency(sessionId: string, connection: ConnectionState): void {
    // Adjust heartbeat frequency based on connection quality
    const currentInterval = this.heartbeatIntervals.get(sessionId);
    if (!currentInterval) return;

    let newInterval = this.defaultHeartbeatConfig.interval;

    switch (connection.connectionQuality) {
      case 'CRITICAL':
        newInterval = this.defaultHeartbeatConfig.interval / 2; // More frequent
        break;
      case 'POOR':
        newInterval = this.defaultHeartbeatConfig.interval * 0.75;
        break;
      case 'EXCELLENT':
        newInterval = this.defaultHeartbeatConfig.interval * 1.5; // Less frequent
        break;
    }

    // Only restart if interval changed significantly
    if (Math.abs(newInterval - this.defaultHeartbeatConfig.interval) > 5000) {
      this.stopHeartbeatMonitoring(sessionId);
      this.startHeartbeatMonitoring(sessionId, newInterval);
    }
  }

  private startHeartbeatMonitoring(sessionId: string, customInterval?: number): void {
    const interval = customInterval || this.defaultHeartbeatConfig.interval;

    const heartbeatInterval = setInterval(() => {
      this.checkConnectionHealth(sessionId);
    }, interval);

    this.heartbeatIntervals.set(sessionId, heartbeatInterval);
  }

  private async performCleanup(): Promise<void> {
    try {
      const staleThreshold = this.configService.get<number>('connection.cleanup.staleThreshold', 3600000); // 1 hour
      const cutoffTime = new Date(Date.now() - staleThreshold);
      let cleanedCount = 0;

      // Clean up stale connections
      for (const [sessionId, connection] of this.connections.entries()) {
        if (connection.lastHeartbeat < cutoffTime && connection.status !== 'CONNECTED') {
          await this.removeConnection(sessionId);
          cleanedCount++;
        }
      }

      // Clean up old metrics
      for (const sessionId of this.connectionMetrics.keys()) {
        if (!this.connections.has(sessionId)) {
          this.connectionMetrics.delete(sessionId);
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} stale connections`);
      }
    } catch (error) {
      this.logger.error('Error during connection cleanup:', error);
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const stats = this.getConnectionStats();

      // Emit metrics for external monitoring
      this.eventEmitter.emit('connection.metrics.collected', {
        stats,
        timestamp: new Date(),
        memoryUsage: process.memoryUsage(),
      });

      // Log summary metrics
      this.logger.debug(`Connection metrics: ${stats.connected} connected, ${stats.reconnecting} reconnecting, avg latency: ${stats.averageLatency}ms`);
    } catch (error) {
      this.logger.error('Error collecting connection metrics:', error);
    }
  }
}
