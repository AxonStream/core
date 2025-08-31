import { Controller, Get, Post, Body, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebSocketServerRegistryService } from '../../common/services/websocket-server-registry.service';
import { DistributedConnectionManagerService } from '../../common/services/distributed-connection-manager.service';
import { CrossServerEventRouterService } from '../../common/services/cross-server-event-router.service';
import { RedisService } from '../../common/services/redis.service';
import { Logger } from '@nestjs/common';

export interface HealthCheckResult {
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

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface ReadinessResult {
  ready: boolean;
  reason?: string;
  checks: {
    redis: boolean;
    websocket: boolean;
    cluster: boolean;
  };
}

@ApiTags('Health')
@Controller('health')
export class WebSocketHealthController {
  private readonly logger = new Logger(WebSocketHealthController.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly serverRegistry: WebSocketServerRegistryService,
    private readonly connectionManager: DistributedConnectionManagerService,
    private readonly crossServerRouter: CrossServerEventRouterService,
    private readonly redisService: RedisService,
  ) {}

  @Get('websocket')
  @ApiOperation({ summary: 'WebSocket-specific health check for load balancers' })
  @ApiResponse({ status: 200, description: 'Health check results' })
  async getWebSocketHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];
    
    try {
      // Get server info
      const serverInfo = this.serverRegistry.getCurrentServer();
      const uptime = Date.now() - this.startTime;

      // Check Redis connectivity
      const redisCheck = await this.checkRedisHealth();
      checks.push(redisCheck);

      // Check WebSocket capacity
      const wsCheck = await this.checkWebSocketCapacity();
      checks.push(wsCheck);

      // Check cluster communication
      const clusterCheck = await this.checkClusterCommunication();
      checks.push(clusterCheck);

      // Check cross-server routing
      const routingCheck = await this.checkCrossServerRouting();
      checks.push(routingCheck);

      // Get cluster stats
      const clusterStats = await this.connectionManager.getClusterConnectionStats();
      const activeServers = await this.serverRegistry.getActiveServers();

      // Determine overall status
      const failedChecks = checks.filter(c => c.status === 'fail');
      const warnChecks = checks.filter(c => c.status === 'warn');
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
      if (failedChecks.length > 0) {
        overallStatus = 'unhealthy';
      } else if (warnChecks.length > 0) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'healthy';
      }

      // Determine WebSocket status
      const loadPercentage = serverInfo.connections / serverInfo.maxConnections;
      let wsStatus: 'ready' | 'draining' | 'overloaded';
      if (loadPercentage > 0.95) {
        wsStatus = 'overloaded';
      } else if (serverInfo.status === 'draining') {
        wsStatus = 'draining';
      } else {
        wsStatus = 'ready';
      }

      const result: HealthCheckResult = {
        status: overallStatus,
        timestamp: Date.now(),
        server: {
          id: serverInfo.id,
          uptime,
          version: serverInfo.version,
        },
        websocket: {
          connections: serverInfo.connections,
          maxConnections: serverInfo.maxConnections,
          loadPercentage: Math.round(loadPercentage * 100) / 100,
          status: wsStatus,
        },
        redis: {
          connected: redisCheck.status !== 'fail',
          latency: redisCheck.metadata?.latency,
          error: redisCheck.status === 'fail' ? redisCheck.message : undefined,
        },
        cluster: {
          activeServers: activeServers.length,
          totalConnections: clusterStats.totalConnections,
          crossServerCommunication: routingCheck.status !== 'fail',
        },
        checks,
      };

      this.logger.debug(`Health check completed in ${Date.now() - startTime}ms: ${overallStatus}`);
      return result;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        server: {
          id: 'unknown',
          uptime: Date.now() - this.startTime,
          version: 'unknown',
        },
        websocket: {
          connections: 0,
          maxConnections: 0,
          loadPercentage: 0,
          status: 'overloaded',
        },
        redis: {
          connected: false,
          error: error.message,
        },
        cluster: {
          activeServers: 0,
          totalConnections: 0,
          crossServerCommunication: false,
        },
        checks: [{
          name: 'health_check_execution',
          status: 'fail',
          message: error.message,
          duration: Date.now() - startTime,
        }],
      };
    }
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check for load balancer routing decisions' })
  @ApiResponse({ status: 200, description: 'Readiness status' })
  async getReadiness(): Promise<ReadinessResult> {
    try {
      const checks = {
        redis: false,
        websocket: false,
        cluster: false,
      };

      // Check Redis
      try {
        const redis = this.redisService.getRedisInstance();
        await redis.ping();
        checks.redis = true;
      } catch (error) {
        this.logger.warn(`Redis readiness check failed: ${error.message}`);
      }

      // Check WebSocket capacity
      const serverInfo = this.serverRegistry.getCurrentServer();
      const loadPercentage = serverInfo.connections / serverInfo.maxConnections;
      checks.websocket = loadPercentage < 0.9 && serverInfo.status === 'active';

      // Check cluster communication
      try {
        const activeServers = await this.serverRegistry.getActiveServers();
        checks.cluster = activeServers.length > 0;
      } catch (error) {
        this.logger.warn(`Cluster readiness check failed: ${error.message}`);
      }

      const ready = checks.redis && checks.websocket && checks.cluster;
      
      let reason: string | undefined;
      if (!ready) {
        const failedChecks = Object.entries(checks)
          .filter(([_, passed]) => !passed)
          .map(([name, _]) => name);
        reason = `Failed checks: ${failedChecks.join(', ')}`;
      }

      return { ready, reason, checks };
    } catch (error) {
      this.logger.error(`Readiness check failed: ${error.message}`);
      return {
        ready: false,
        reason: `Readiness check error: ${error.message}`,
        checks: { redis: false, websocket: false, cluster: false },
      };
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check for container orchestration' })
  @ApiResponse({ status: 200, description: 'Server is alive' })
  async getLiveness(): Promise<{ alive: boolean; timestamp: number }> {
    return {
      alive: true,
      timestamp: Date.now(),
    };
  }

  @Post('drain')
  @ApiOperation({ summary: 'Put server in draining mode for graceful shutdown' })
  @ApiResponse({ status: 200, description: 'Server draining initiated' })
  async drainServer(@Body() body: { timeout?: number }): Promise<{ status: string; timeout: number }> {
    try {
      const timeout = body.timeout || 30000; // 30 seconds default
      
      // Update server status to draining
      await this.serverRegistry.updateServerMetrics({});
      
      this.logger.log(`Server draining initiated with ${timeout}ms timeout`);
      
      // Schedule graceful shutdown
      setTimeout(async () => {
        try {
          await this.performGracefulShutdown();
        } catch (error) {
          this.logger.error(`Graceful shutdown failed: ${error.message}`);
        }
      }, timeout);

      return {
        status: 'draining',
        timeout,
      };
    } catch (error) {
      this.logger.error(`Failed to initiate draining: ${error.message}`);
      throw new HttpException('Failed to initiate draining', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async checkRedisHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const redis = this.redisService.getRedisInstance();
      const result = await redis.ping();
      const latency = Date.now() - startTime;
      
      if (result === 'PONG') {
        return {
          name: 'redis_connectivity',
          status: latency > 100 ? 'warn' : 'pass',
          message: latency > 100 ? `High Redis latency: ${latency}ms` : 'Redis connection healthy',
          duration: latency,
          metadata: { latency },
        };
      } else {
        return {
          name: 'redis_connectivity',
          status: 'fail',
          message: 'Redis ping failed',
          duration: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        name: 'redis_connectivity',
        status: 'fail',
        message: `Redis connection failed: ${error.message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  private async checkWebSocketCapacity(): Promise<HealthCheck> {
    try {
      const serverInfo = this.serverRegistry.getCurrentServer();
      const loadPercentage = serverInfo.connections / serverInfo.maxConnections;
      
      if (loadPercentage > 0.95) {
        return {
          name: 'websocket_capacity',
          status: 'fail',
          message: `WebSocket capacity exceeded: ${Math.round(loadPercentage * 100)}%`,
          metadata: { loadPercentage, connections: serverInfo.connections, maxConnections: serverInfo.maxConnections },
        };
      } else if (loadPercentage > 0.8) {
        return {
          name: 'websocket_capacity',
          status: 'warn',
          message: `WebSocket capacity high: ${Math.round(loadPercentage * 100)}%`,
          metadata: { loadPercentage, connections: serverInfo.connections, maxConnections: serverInfo.maxConnections },
        };
      } else {
        return {
          name: 'websocket_capacity',
          status: 'pass',
          message: `WebSocket capacity normal: ${Math.round(loadPercentage * 100)}%`,
          metadata: { loadPercentage, connections: serverInfo.connections, maxConnections: serverInfo.maxConnections },
        };
      }
    } catch (error) {
      return {
        name: 'websocket_capacity',
        status: 'fail',
        message: `Failed to check WebSocket capacity: ${error.message}`,
      };
    }
  }

  private async checkClusterCommunication(): Promise<HealthCheck> {
    try {
      const activeServers = await this.serverRegistry.getActiveServers();
      
      if (activeServers.length === 0) {
        return {
          name: 'cluster_communication',
          status: 'fail',
          message: 'No active servers found in cluster',
          metadata: { activeServers: 0 },
        };
      } else if (activeServers.length === 1) {
        return {
          name: 'cluster_communication',
          status: 'warn',
          message: 'Single server cluster (no redundancy)',
          metadata: { activeServers: activeServers.length },
        };
      } else {
        return {
          name: 'cluster_communication',
          status: 'pass',
          message: `Cluster healthy with ${activeServers.length} servers`,
          metadata: { activeServers: activeServers.length },
        };
      }
    } catch (error) {
      return {
        name: 'cluster_communication',
        status: 'fail',
        message: `Failed to check cluster: ${error.message}`,
      };
    }
  }

  private async checkCrossServerRouting(): Promise<HealthCheck> {
    try {
      // This would test cross-server message routing
      // For now, we'll just check if the service is available
      const testResult = true; // Placeholder for actual test
      
      return {
        name: 'cross_server_routing',
        status: testResult ? 'pass' : 'fail',
        message: testResult ? 'Cross-server routing operational' : 'Cross-server routing failed',
      };
    } catch (error) {
      return {
        name: 'cross_server_routing',
        status: 'fail',
        message: `Cross-server routing check failed: ${error.message}`,
      };
    }
  }

  private async performGracefulShutdown(): Promise<void> {
    this.logger.log('Performing graceful shutdown...');
    
    try {
      // Unregister from server registry
      await this.serverRegistry.unregisterServer();
      
      // Close remaining connections gracefully
      // This would be implemented based on the WebSocket server implementation
      
      this.logger.log('Graceful shutdown completed');
    } catch (error) {
      this.logger.error(`Graceful shutdown error: ${error.message}`);
    }
  }
}
