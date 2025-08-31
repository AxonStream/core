import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from './redis.service';
import { WebSocketServerRegistryService } from './websocket-server-registry.service';
import { CrossServerEventRouterService } from './cross-server-event-router.service';

export interface DistributedConnection {
  sessionId: string;
  userId?: string;
  organizationId: string;
  serverId: string;
  socketId: string;
  clientType: string;
  connectedAt: number;
  lastActivity: number;
  channels: string[];
  metadata: Record<string, any>;
  status: 'connected' | 'disconnected' | 'migrating';
}

export interface ConnectionMigration {
  sessionId: string;
  fromServerId: string;
  toServerId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export interface ServerLoadMetrics {
  serverId: string;
  connections: number;
  maxConnections: number;
  loadPercentage: number;
  averageLatency: number;
  messagesPerSecond: number;
}

@Injectable()
export class DistributedConnectionManagerService implements OnModuleInit {
  private readonly logger = new Logger(DistributedConnectionManagerService.name);
  private readonly CONNECTION_TTL = 300; // 5 minutes
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute
  private readonly LOAD_BALANCE_THRESHOLD = 0.8; // 80% capacity

  constructor(
    private readonly redisService: RedisService,
    private readonly serverRegistry: WebSocketServerRegistryService,
    private readonly crossServerRouter: CrossServerEventRouterService,
  ) {}

  async onModuleInit() {
    this.startConnectionCleanup();
    this.startLoadBalancing();
    this.logger.log('Distributed connection manager initialized');
  }

  /**
   * Register a new connection in the distributed registry
   */
  async registerConnection(connection: Omit<DistributedConnection, 'serverId' | 'connectedAt' | 'lastActivity' | 'status'>): Promise<void> {
    try {
      const distributedConnection: DistributedConnection = {
        ...connection,
        serverId: this.serverRegistry.getServerId(),
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        status: 'connected',
      };

      const redis = this.redisService.getRedisInstance();
      
      // Store connection data
      await redis.setEx(
        `axonpuls:connections:${connection.sessionId}`,
        this.CONNECTION_TTL,
        JSON.stringify(distributedConnection)
      );

      // Add to server's connection list
      await redis.sAdd(
        `axonpuls:server-connections:${distributedConnection.serverId}`,
        connection.sessionId
      );

      // Add to organization's connection list
      await redis.sAdd(
        `axonpuls:org-connections:${connection.organizationId}`,
        connection.sessionId
      );

      // Map user to server if userId exists
      if (connection.userId) {
        await redis.setEx(
          `axonpuls:user-server:${connection.organizationId}:${connection.userId}`,
          this.CONNECTION_TTL,
          distributedConnection.serverId
        );
      }

      // Update server metrics
      await this.updateServerConnectionCount(distributedConnection.serverId);

      this.logger.debug(`Connection registered: ${connection.sessionId} on server ${distributedConnection.serverId}`);
    } catch (error) {
      this.logger.error(`Failed to register connection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unregister a connection from the distributed registry
   */
  async unregisterConnection(sessionId: string): Promise<void> {
    try {
      const connection = await this.getConnection(sessionId);
      if (!connection) {
        this.logger.debug(`Connection not found for unregistration: ${sessionId}`);
        return;
      }

      const redis = this.redisService.getRedisInstance();
      
      // Remove connection data
      await redis.del(`axonpuls:connections:${sessionId}`);

      // Remove from server's connection list
      await redis.sRem(`axonpuls:server-connections:${connection.serverId}`, sessionId);

      // Remove from organization's connection list
      await redis.sRem(`axonpuls:org-connections:${connection.organizationId}`, sessionId);

      // Remove user-server mapping if exists
      if (connection.userId) {
        await redis.del(`axonpuls:user-server:${connection.organizationId}:${connection.userId}`);
      }

      // Update server metrics
      await this.updateServerConnectionCount(connection.serverId);

      this.logger.debug(`Connection unregistered: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to unregister connection: ${error.message}`);
    }
  }

  /**
   * Update connection activity timestamp
   */
  async updateConnectionActivity(sessionId: string, channels?: string[]): Promise<void> {
    try {
      const connection = await this.getConnection(sessionId);
      if (!connection) {
        return;
      }

      connection.lastActivity = Date.now();
      if (channels) {
        connection.channels = channels;
      }

      const redis = this.redisService.getRedisInstance();
      await redis.setEx(
        `axonpuls:connections:${sessionId}`,
        this.CONNECTION_TTL,
        JSON.stringify(connection)
      );
    } catch (error) {
      this.logger.error(`Failed to update connection activity: ${error.message}`);
    }
  }

  /**
   * Get connection information
   */
  async getConnection(sessionId: string): Promise<DistributedConnection | null> {
    try {
      const redis = this.redisService.getRedisInstance();
      const connectionData = await redis.get(`axonpuls:connections:${sessionId}`);
      
      if (!connectionData) {
        return null;
      }

      return JSON.parse(connectionData) as DistributedConnection;
    } catch (error) {
      this.logger.error(`Failed to get connection: ${error.message}`);
      return null;
    }
  }

  /**
   * Get all connections for a server
   */
  async getServerConnections(serverId: string): Promise<DistributedConnection[]> {
    try {
      const redis = this.redisService.getRedisInstance();
      const sessionIds = await redis.sMembers(`axonpuls:server-connections:${serverId}`);
      
      const connections: DistributedConnection[] = [];
      for (const sessionId of sessionIds) {
        const connection = await this.getConnection(sessionId);
        if (connection) {
          connections.push(connection);
        }
      }

      return connections;
    } catch (error) {
      this.logger.error(`Failed to get server connections: ${error.message}`);
      return [];
    }
  }

  /**
   * Get all connections for an organization
   */
  async getOrganizationConnections(organizationId: string): Promise<DistributedConnection[]> {
    try {
      const redis = this.redisService.getRedisInstance();
      const sessionIds = await redis.sMembers(`axonpuls:org-connections:${organizationId}`);
      
      const connections: DistributedConnection[] = [];
      for (const sessionId of sessionIds) {
        const connection = await this.getConnection(sessionId);
        if (connection) {
          connections.push(connection);
        }
      }

      return connections;
    } catch (error) {
      this.logger.error(`Failed to get organization connections: ${error.message}`);
      return [];
    }
  }

  /**
   * Find which server a user is connected to
   */
  async findUserServer(userId: string, organizationId: string): Promise<string | null> {
    try {
      const redis = this.redisService.getRedisInstance();
      const serverId = await redis.get(`axonpuls:user-server:${organizationId}:${userId}`);
      
      if (serverId) {
        // Verify server is still active
        const server = await this.serverRegistry.getServerById(serverId);
        if (server && server.status === 'active') {
          return serverId;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to find user server: ${error.message}`);
      return null;
    }
  }

  /**
   * Get load metrics for all servers
   */
  async getServerLoadMetrics(): Promise<ServerLoadMetrics[]> {
    try {
      const servers = await this.serverRegistry.getActiveServers();
      const metrics: ServerLoadMetrics[] = [];

      for (const server of servers) {
        const connections = await this.getServerConnections(server.id);
        const loadPercentage = connections.length / server.maxConnections;

        metrics.push({
          serverId: server.id,
          connections: connections.length,
          maxConnections: server.maxConnections,
          loadPercentage,
          averageLatency: 0, // Would be calculated from actual metrics
          messagesPerSecond: 0, // Would be calculated from actual metrics
        });
      }

      return metrics.sort((a, b) => a.loadPercentage - b.loadPercentage);
    } catch (error) {
      this.logger.error(`Failed to get server load metrics: ${error.message}`);
      return [];
    }
  }

  /**
   * Migrate connection to another server (for load balancing)
   */
  async migrateConnection(sessionId: string, targetServerId: string): Promise<boolean> {
    try {
      const connection = await this.getConnection(sessionId);
      if (!connection) {
        this.logger.warn(`Connection not found for migration: ${sessionId}`);
        return false;
      }

      const migration: ConnectionMigration = {
        sessionId,
        fromServerId: connection.serverId,
        toServerId: targetServerId,
        status: 'pending',
        startedAt: Date.now(),
      };

      // Store migration record
      const redis = this.redisService.getRedisInstance();
      await redis.setEx(
        `axonpuls:migrations:${sessionId}`,
        300, // 5 minutes
        JSON.stringify(migration)
      );

      // Notify target server about incoming migration
      await this.crossServerRouter.sendToSpecificServers(
        [targetServerId],
        connection.organizationId,
        'system',
        {
          id: `migration-${sessionId}`,
          eventType: 'connection_migration_request',
          organizationId: connection.organizationId,
          userId: connection.userId,
          payload: { connection, migration },
          timestamp: Date.now(),
          acknowledgment: true,
        }
      );

      this.logger.log(`Connection migration initiated: ${sessionId} -> ${targetServerId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to migrate connection: ${error.message}`);
      return false;
    }
  }

  /**
   * Update server connection count
   */
  private async updateServerConnectionCount(serverId: string): Promise<void> {
    try {
      const connections = await this.getServerConnections(serverId);
      await this.serverRegistry.updateServerMetrics({
        connections: connections.length,
      });
    } catch (error) {
      this.logger.error(`Failed to update server connection count: ${error.message}`);
    }
  }

  /**
   * Start connection cleanup task
   */
  private startConnectionCleanup(): void {
    setInterval(async () => {
      try {
        await this.cleanupStaleConnections();
      } catch (error) {
        this.logger.error(`Connection cleanup failed: ${error.message}`);
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Clean up stale connections
   */
  private async cleanupStaleConnections(): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      const servers = await this.serverRegistry.getActiveServers();
      
      for (const server of servers) {
        const connections = await this.getServerConnections(server.id);
        const now = Date.now();
        
        for (const connection of connections) {
          // Remove connections that haven't been active for too long
          if (now - connection.lastActivity > this.CONNECTION_TTL * 1000) {
            await this.unregisterConnection(connection.sessionId);
            this.logger.debug(`Cleaned up stale connection: ${connection.sessionId}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup stale connections: ${error.message}`);
    }
  }

  /**
   * Start load balancing task
   */
  private startLoadBalancing(): void {
    setInterval(async () => {
      try {
        await this.performLoadBalancing();
      } catch (error) {
        this.logger.error(`Load balancing failed: ${error.message}`);
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Perform load balancing across servers
   */
  private async performLoadBalancing(): Promise<void> {
    try {
      const metrics = await this.getServerLoadMetrics();
      
      // Find overloaded servers
      const overloadedServers = metrics.filter(m => m.loadPercentage > this.LOAD_BALANCE_THRESHOLD);
      const underloadedServers = metrics.filter(m => m.loadPercentage < this.LOAD_BALANCE_THRESHOLD * 0.5);
      
      if (overloadedServers.length === 0 || underloadedServers.length === 0) {
        return; // No load balancing needed
      }

      // Migrate some connections from overloaded to underloaded servers
      for (const overloaded of overloadedServers) {
        const target = underloadedServers[0]; // Simple selection
        const connectionsToMigrate = Math.min(
          Math.floor(overloaded.connections * 0.1), // Migrate 10% of connections
          target.maxConnections - target.connections
        );

        if (connectionsToMigrate > 0) {
          const connections = await this.getServerConnections(overloaded.serverId);
          for (let i = 0; i < connectionsToMigrate && i < connections.length; i++) {
            await this.migrateConnection(connections[i].sessionId, target.serverId);
          }
          
          this.logger.log(`Load balancing: migrated ${connectionsToMigrate} connections from ${overloaded.serverId} to ${target.serverId}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to perform load balancing: ${error.message}`);
    }
  }
}
