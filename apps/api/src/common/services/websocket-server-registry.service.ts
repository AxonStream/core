import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { v4 as uuidv4 } from 'uuid';

export interface ServerNode {
  id: string;
  host: string;
  port: number;
  wsPort: number;
  status: 'active' | 'draining' | 'inactive';
  capabilities: string[];
  connections: number;
  maxConnections: number;
  lastHeartbeat: number;
  startedAt: number;
  version: string;
  region?: string;
  zone?: string;
}

export interface ServerMetrics {
  connections: number;
  messagesPerSecond: number;
  cpuUsage: number;
  memoryUsage: number;
  latency: number;
}

@Injectable()
export class WebSocketServerRegistryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebSocketServerRegistryService.name);
  private readonly serverId: string;
  private readonly serverInfo: ServerNode;
  private heartbeatInterval: NodeJS.Timeout;
  private readonly REGISTRY_KEY = 'axonpuls:servers:registry';
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly SERVER_TTL = 90; // 90 seconds
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.serverId = this.generateServerId();
    this.serverInfo = this.createServerInfo();
  }

  async onModuleInit() {
    await this.registerServer();
    this.startHeartbeat();
    this.startCleanupTask();
    this.logger.log(`WebSocket server registered: ${this.serverId}`);
  }

  async onModuleDestroy() {
    await this.unregisterServer();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.logger.log(`WebSocket server unregistered: ${this.serverId}`);
  }

  /**
   * Register this server instance in the distributed registry
   */
  async registerServer(): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      const serverData = JSON.stringify(this.serverInfo);
      
      // Add to server registry with TTL
      await redis.hSet(this.REGISTRY_KEY, this.serverId, serverData);
      await redis.expire(`${this.REGISTRY_KEY}:${this.serverId}`, this.SERVER_TTL);
      
      // Add to active servers set
      await redis.sAdd('axonpuls:servers:active', this.serverId);
      
      // Publish server registration event
      await redis.publish('axonpuls:server:events', JSON.stringify({
        type: 'server_registered',
        serverId: this.serverId,
        serverInfo: this.serverInfo,
        timestamp: Date.now()
      }));

      this.logger.log(`Server registered successfully: ${this.serverId}`);
    } catch (error) {
      this.logger.error(`Failed to register server: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unregister this server instance from the distributed registry
   */
  async unregisterServer(): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      
      // Remove from registry
      await redis.hDel(this.REGISTRY_KEY, this.serverId);
      await redis.sRem('axonpuls:servers:active', this.serverId);
      
      // Publish server unregistration event
      await redis.publish('axonpuls:server:events', JSON.stringify({
        type: 'server_unregistered',
        serverId: this.serverId,
        timestamp: Date.now()
      }));

      this.logger.log(`Server unregistered successfully: ${this.serverId}`);
    } catch (error) {
      this.logger.error(`Failed to unregister server: ${error.message}`);
    }
  }

  /**
   * Update server metrics and heartbeat
   */
  async updateServerMetrics(metrics: Partial<ServerMetrics>): Promise<void> {
    try {
      const updatedInfo = {
        ...this.serverInfo,
        connections: metrics.connections ?? this.serverInfo.connections,
        lastHeartbeat: Date.now()
      };

      const redis = this.redisService.getRedisInstance();
      await redis.hSet(this.REGISTRY_KEY, this.serverId, JSON.stringify(updatedInfo));
      await redis.expire(`${this.REGISTRY_KEY}:${this.serverId}`, this.SERVER_TTL);

      // Update local server info
      Object.assign(this.serverInfo, updatedInfo);
    } catch (error) {
      this.logger.error(`Failed to update server metrics: ${error.message}`);
    }
  }

  /**
   * Get all active servers in the registry
   */
  async getActiveServers(): Promise<ServerNode[]> {
    try {
      const redis = this.redisService.getRedisInstance();
      const serverData = await redis.hGetAll(this.REGISTRY_KEY);
      
      const servers: ServerNode[] = [];
      for (const [serverId, data] of Object.entries(serverData)) {
        try {
          const server = JSON.parse(data) as ServerNode;
          // Check if server is still alive (heartbeat within TTL)
          if (Date.now() - server.lastHeartbeat < this.SERVER_TTL * 1000) {
            servers.push(server);
          }
        } catch (parseError) {
          this.logger.warn(`Failed to parse server data for ${serverId}: ${parseError.message}`);
        }
      }

      return servers.sort((a, b) => a.connections - b.connections); // Sort by load
    } catch (error) {
      this.logger.error(`Failed to get active servers: ${error.message}`);
      return [];
    }
  }

  /**
   * Find the best server for new connections (load balancing)
   */
  async getBestServerForConnection(organizationId?: string): Promise<ServerNode | null> {
    try {
      const servers = await this.getActiveServers();
      
      if (servers.length === 0) {
        return null;
      }

      // Filter servers that are not draining and have capacity
      const availableServers = servers.filter(server => 
        server.status === 'active' && 
        server.connections < server.maxConnections * 0.9 // 90% capacity threshold
      );

      if (availableServers.length === 0) {
        // All servers are at capacity, return least loaded
        return servers[0];
      }

      // Simple round-robin with load consideration
      return availableServers[0];
    } catch (error) {
      this.logger.error(`Failed to get best server: ${error.message}`);
      return null;
    }
  }

  /**
   * Get server by ID
   */
  async getServerById(serverId: string): Promise<ServerNode | null> {
    try {
      const redis = this.redisService.getRedisInstance();
      const serverData = await redis.hGet(this.REGISTRY_KEY, serverId);
      
      if (!serverData) {
        return null;
      }

      return JSON.parse(serverData) as ServerNode;
    } catch (error) {
      this.logger.error(`Failed to get server ${serverId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get current server info
   */
  getCurrentServer(): ServerNode {
    return { ...this.serverInfo };
  }

  /**
   * Get current server ID
   */
  getServerId(): string {
    return this.serverId;
  }

  private generateServerId(): string {
    const hostname = process.env.HOSTNAME || 'unknown';
    const pid = process.pid;
    const uuid = uuidv4().split('-')[0];
    return `${hostname}-${pid}-${uuid}`;
  }

  private createServerInfo(): ServerNode {
    return {
      id: this.serverId,
      host: this.configService.get<string>('server.host', 'localhost'),
      port: this.configService.get<number>('server.port', 3000),
      wsPort: this.configService.get<number>('websocket.port', 3001),
      status: 'active',
      capabilities: ['websocket', 'events', 'magic', 'realtime'],
      connections: 0,
      maxConnections: this.configService.get<number>('websocket.maxConnections', 10000),
      lastHeartbeat: Date.now(),
      startedAt: Date.now(),
      version: process.env.npm_package_version || '1.0.0',
      region: process.env.AWS_REGION || process.env.REGION,
      zone: process.env.AWS_AVAILABILITY_ZONE || process.env.ZONE,
    };
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.updateServerMetrics({});
      } catch (error) {
        this.logger.error(`Heartbeat failed: ${error.message}`);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private startCleanupTask(): void {
    setInterval(async () => {
      try {
        await this.cleanupDeadServers();
      } catch (error) {
        this.logger.error(`Cleanup task failed: ${error.message}`);
      }
    }, this.CLEANUP_INTERVAL);
  }

  private async cleanupDeadServers(): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      const serverData = await redis.hGetAll(this.REGISTRY_KEY);
      const now = Date.now();
      
      for (const [serverId, data] of Object.entries(serverData)) {
        try {
          const server = JSON.parse(data) as ServerNode;
          if (now - server.lastHeartbeat > this.SERVER_TTL * 1000) {
            // Server is dead, remove it
            await redis.hDel(this.REGISTRY_KEY, serverId);
            await redis.sRem('axonpuls:servers:active', serverId);
            
            this.logger.warn(`Removed dead server: ${serverId}`);
            
            // Publish server death event
            await redis.publish('axonpuls:server:events', JSON.stringify({
              type: 'server_died',
              serverId,
              timestamp: now
            }));
          }
        } catch (parseError) {
          // Invalid server data, remove it
          await redis.hDel(this.REGISTRY_KEY, serverId);
          this.logger.warn(`Removed invalid server data: ${serverId}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup dead servers: ${error.message}`);
    }
  }
}
