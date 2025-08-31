/**
 * 🏥 Health Check Client
 * 
 * Provides comprehensive health monitoring and system status
 * functionality for production deployments and monitoring.
 */

import { BaseClient } from './base-client';
import { AxonPulsError } from './errors';
import type { AxonPulsEvent } from '../types/schemas';

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: HealthCheck[];
  services: ServiceHealth[];
  performance: PerformanceMetrics;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface ServiceHealth {
  name: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheck: string;
  error?: string;
}

export interface PerformanceMetrics {
  cpu: {
    usage: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  connections: {
    active: number;
    total: number;
    peak: number;
  };
  throughput: {
    requestsPerSecond: number;
    messagesPerSecond: number;
    eventsPerSecond: number;
  };
}

export interface WebSocketHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  server: {
    id: string;
    uptime: number;
    version: string;
  };
  websocket: {
    connections: number;
    maxConnections: number;
    loadPercentage: number;
    status: 'ready' | 'draining' | 'overloaded';
  };
  redis: {
    connected: boolean;
    latency?: number;
    error?: string;
  };
  cluster: {
    activeServers: number;
    totalConnections: number;
    crossServerCommunication: boolean;
  };
  checks: HealthCheck[];
}

export interface ReadinessResponse {
  ready: boolean;
  reason?: string;
  checks: {
    redis: boolean;
    websocket: boolean;
    cluster: boolean;
    database: boolean;
  };
}

export interface LivenessResponse {
  alive: boolean;
  timestamp: number;
  pid: number;
  uptime: number;
}

export interface SystemMetrics {
  timestamp: string;
  server: {
    hostname: string;
    platform: string;
    arch: string;
    nodeVersion: string;
  };
  process: {
    pid: number;
    uptime: number;
    memoryUsage: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    cpuUsage: {
      user: number;
      system: number;
    };
  };
  system: {
    loadAverage: number[];
    totalMemory: number;
    freeMemory: number;
    cpuCount: number;
  };
  application: {
    activeConnections: number;
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
  };
}

export class HealthClient extends BaseClient {
  /**
   * Get overall system health status
   */
  async check(): Promise<HealthResponse> {
    try {
      const response = await this.apiClient.get('/api/v1/health');
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get health status',
        'HEALTH_CHECK_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Get WebSocket-specific health status
   */
  async checkWebSocket(): Promise<WebSocketHealthResponse> {
    try {
      const response = await this.apiClient.get('/api/v1/health/websocket');
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get WebSocket health status',
        'WEBSOCKET_HEALTH_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Get readiness status (for load balancer routing)
   */
  async checkReadiness(): Promise<ReadinessResponse> {
    try {
      const response = await this.apiClient.get('/api/v1/health/ready');
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get readiness status',
        'READINESS_CHECK_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Get liveness status (for container orchestration)
   */
  async checkLiveness(): Promise<LivenessResponse> {
    try {
      const response = await this.apiClient.get('/api/v1/health/live');
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get liveness status',
        'LIVENESS_CHECK_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Get detailed system metrics
   */
  async getMetrics(): Promise<SystemMetrics> {
    try {
      const response = await this.apiClient.get('/api/v1/health/metrics');
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get system metrics',
        'METRICS_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Get service dependencies health
   */
  async checkDependencies(): Promise<ServiceHealth[]> {
    try {
      const response = await this.apiClient.get('/api/v1/health/dependencies');
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get dependencies health',
        'DEPENDENCIES_CHECK_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Trigger server drain mode for graceful shutdown
   */
  async drainServer(timeout?: number): Promise<{ status: string; timeout: number }> {
    try {
      const response = await this.apiClient.post('/api/v1/health/drain', { timeout });
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to drain server',
        'DRAIN_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Get cluster-wide health status
   */
  async checkCluster(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    servers: Array<{
      id: string;
      status: string;
      connections: number;
      lastSeen: string;
    }>;
    totalConnections: number;
    averageLoad: number;
  }> {
    try {
      const response = await this.apiClient.get('/api/v1/health/cluster');
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get cluster health',
        'CLUSTER_HEALTH_FAILED',
        error.response?.status || 500,
        error.response?.data
      );
    }
  }

  /**
   * Monitor health status with real-time updates
   */
  async monitor(
    callback: (health: HealthResponse) => void,
    interval: number = 30000
  ): Promise<() => void> {
    let isMonitoring = true;

    const checkHealth = async () => {
      if (!isMonitoring) return;

      try {
        const health = await this.check();
        callback(health);
      } catch (error: any) {
        callback({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          version: 'unknown',
          uptime: 0,
          checks: [{
            name: 'health_monitor',
            status: 'fail',
            message: error.message
          }],
          services: [],
          performance: {
            cpu: { usage: 0, load: [] },
            memory: { used: 0, total: 0, percentage: 0 },
            connections: { active: 0, total: 0, peak: 0 },
            throughput: { requestsPerSecond: 0, messagesPerSecond: 0, eventsPerSecond: 0 }
          }
        });
      }

      if (isMonitoring) {
        setTimeout(checkHealth, interval);
      }
    };

    // Start monitoring
    checkHealth();

    // Return stop function
    return () => {
      isMonitoring = false;
    };
  }

  /**
   * Ping server for basic connectivity test
   */
  async ping(): Promise<{ pong: boolean; latency: number; timestamp: string }> {
    const startTime = Date.now();

    try {
      const response = await this.apiClient.get('/api/v1/health/ping');
      const latency = Date.now() - startTime;

      return {
        pong: true,
        latency,
        timestamp: response.data.timestamp || new Date().toISOString()
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;

      throw new AxonPulsError(
        'Ping failed',
        'PING_FAILED',
        error.response?.status || 500,
        { latency, error: error.message }
      );
    }
  }
}
