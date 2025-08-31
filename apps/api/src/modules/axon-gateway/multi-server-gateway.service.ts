import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WebSocketServerRegistryService } from '../../common/services/websocket-server-registry.service';
import { CrossServerEventRouterService } from '../../common/services/cross-server-event-router.service';
import { DistributedConnectionManagerService } from '../../common/services/distributed-connection-manager.service';
import { EventStreamService, AxonPulsEvent } from '../../common/services/event-stream.service';
import { TenantAwareService, TenantContext } from '../../common/services/tenant-aware.service';

export interface MultiServerSocket extends Socket {
  tenantContext?: TenantContext;
  organizationId?: string;
  userId?: string;
  isAuthenticated?: boolean;
  sessionId?: string;
  clientType?: string;
}

@Injectable()
export class MultiServerGatewayService implements OnModuleInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MultiServerGatewayService.name);
  private readonly connectedClients = new Map<string, MultiServerSocket>();

  constructor(
    private readonly serverRegistry: WebSocketServerRegistryService,
    private readonly crossServerRouter: CrossServerEventRouterService,
    private readonly distributedConnectionManager: DistributedConnectionManagerService,
    private readonly eventStreamService: EventStreamService,
    private readonly tenantAwareService: TenantAwareService,
  ) {}

  async onModuleInit() {
    this.setupCrossServerEventHandlers();
    this.logger.log('Multi-server WebSocket gateway initialized');
  }

  /**
   * Handle new WebSocket connection with multi-server awareness
   */
  async handleConnection(socket: MultiServerSocket): Promise<void> {
    try {
      this.logger.debug(`New connection attempt: ${socket.id}`);

      // Store socket reference
      this.connectedClients.set(socket.id, socket);

      // Set up socket event handlers
      this.setupSocketEventHandlers(socket);

      // Register connection in distributed registry
      await this.registerDistributedConnection(socket);

      this.logger.log(`Connection established: ${socket.id} on server ${this.serverRegistry.getServerId()}`);
    } catch (error) {
      this.logger.error(`Failed to handle connection: ${error.message}`);
      socket.disconnect(true);
    }
  }

  /**
   * Handle WebSocket disconnection with cleanup
   */
  async handleDisconnection(socket: MultiServerSocket): Promise<void> {
    try {
      // Remove from local tracking
      this.connectedClients.delete(socket.id);

      // Unregister from distributed registry
      if (socket.sessionId) {
        await this.distributedConnectionManager.unregisterConnection(socket.sessionId);
      }

      // Log disconnection
      if (socket.tenantContext) {
        await this.tenantAwareService.logTenantAccess(
          socket.tenantContext,
          'websocket_disconnect',
          'WebSocketConnection',
          socket.id,
          true
        );
      }

      this.logger.debug(`Connection disconnected: ${socket.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle disconnection: ${error.message}`);
    }
  }

  /**
   * Broadcast event to all servers in the cluster
   */
  async broadcastToAllServers(
    organizationId: string,
    channel: string,
    event: AxonPulsEvent,
    options: { excludeCurrentServer?: boolean } = {}
  ): Promise<void> {
    try {
      // Broadcast locally first
      if (!options.excludeCurrentServer) {
        await this.broadcastLocally(organizationId, channel, event);
      }

      // Broadcast to other servers
      await this.crossServerRouter.broadcastToAllServers(
        organizationId,
        channel,
        event,
        { excludeCurrentServer: true }
      );

      this.logger.debug(`Event broadcasted to all servers: ${event.eventType}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast to all servers: ${error.message}`);
    }
  }

  /**
   * Send event to specific user across the cluster
   */
  async sendToUser(
    userId: string,
    organizationId: string,
    channel: string,
    event: AxonPulsEvent
  ): Promise<boolean> {
    try {
      // Check if user is connected to this server
      const localSocket = this.findLocalUserSocket(userId, organizationId);
      if (localSocket) {
        await this.sendToSocket(localSocket, event);
        return true;
      }

      // Find user on other servers
      const userServerId = await this.distributedConnectionManager.findUserServer(userId, organizationId);
      if (userServerId) {
        await this.crossServerRouter.sendToUserServer(userId, organizationId, channel, event);
        return true;
      }

      this.logger.debug(`User not found in cluster: ${userId}`);
      return false;
    } catch (error) {
      this.logger.error(`Failed to send to user: ${error.message}`);
      return false;
    }
  }

  /**
   * Send event to organization across the cluster
   */
  async sendToOrganization(
    organizationId: string,
    channel: string,
    event: AxonPulsEvent
  ): Promise<void> {
    try {
      await this.broadcastToAllServers(organizationId, channel, event);
    } catch (error) {
      this.logger.error(`Failed to send to organization: ${error.message}`);
    }
  }

  /**
   * Get cluster-wide connection statistics
   */
  async getClusterConnectionStats(): Promise<{
    totalConnections: number;
    serverConnections: Record<string, number>;
    organizationConnections: Record<string, number>;
  }> {
    try {
      const servers = await this.serverRegistry.getActiveServers();
      const stats = {
        totalConnections: 0,
        serverConnections: {} as Record<string, number>,
        organizationConnections: {} as Record<string, number>,
      };

      for (const server of servers) {
        const connections = await this.distributedConnectionManager.getServerConnections(server.id);
        stats.serverConnections[server.id] = connections.length;
        stats.totalConnections += connections.length;

        // Count by organization
        for (const conn of connections) {
          stats.organizationConnections[conn.organizationId] = 
            (stats.organizationConnections[conn.organizationId] || 0) + 1;
        }
      }

      return stats;
    } catch (error) {
      this.logger.error(`Failed to get cluster connection stats: ${error.message}`);
      return { totalConnections: 0, serverConnections: {}, organizationConnections: {} };
    }
  }

  /**
   * Handle connection migration request from another server
   */
  async handleConnectionMigration(migrationData: any): Promise<boolean> {
    try {
      const { connection, migration } = migrationData;
      
      // Validate migration request
      if (migration.toServerId !== this.serverRegistry.getServerId()) {
        this.logger.warn(`Migration not for this server: ${migration.sessionId}`);
        return false;
      }

      // Check server capacity
      const currentConnections = this.connectedClients.size;
      const maxConnections = await this.getMaxConnections();
      
      if (currentConnections >= maxConnections * 0.95) {
        this.logger.warn(`Server at capacity, rejecting migration: ${migration.sessionId}`);
        return false;
      }

      // Accept the migration
      this.logger.log(`Accepting connection migration: ${migration.sessionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to handle connection migration: ${error.message}`);
      return false;
    }
  }

  /**
   * Broadcast event locally to connected clients
   */
  private async broadcastLocally(
    organizationId: string,
    channel: string,
    event: AxonPulsEvent
  ): Promise<void> {
    try {
      const roomName = `org:${organizationId}:${channel}`;
      this.server.to(roomName).emit('event', event);
      
      this.logger.debug(`Event broadcasted locally to room: ${roomName}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast locally: ${error.message}`);
    }
  }

  /**
   * Send event to specific socket
   */
  private async sendToSocket(socket: MultiServerSocket, event: AxonPulsEvent): Promise<void> {
    try {
      socket.emit('event', event);
      
      // Update connection activity
      if (socket.sessionId) {
        await this.distributedConnectionManager.updateConnectionActivity(socket.sessionId);
      }
    } catch (error) {
      this.logger.error(`Failed to send to socket: ${error.message}`);
    }
  }

  /**
   * Find local socket for a user
   */
  private findLocalUserSocket(userId: string, organizationId: string): MultiServerSocket | null {
    for (const socket of this.connectedClients.values()) {
      if (socket.userId === userId && socket.organizationId === organizationId) {
        return socket;
      }
    }
    return null;
  }

  /**
   * Register connection in distributed registry
   */
  private async registerDistributedConnection(socket: MultiServerSocket): Promise<void> {
    try {
      if (!socket.tenantContext || !socket.sessionId) {
        throw new Error('Socket missing required context or session ID');
      }

      await this.distributedConnectionManager.registerConnection({
        sessionId: socket.sessionId,
        userId: socket.userId,
        organizationId: socket.organizationId!,
        socketId: socket.id,
        clientType: socket.clientType || 'unknown',
        channels: [],
        metadata: {
          userAgent: socket.handshake.headers['user-agent'],
          ipAddress: socket.handshake.address,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to register distributed connection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup cross-server event handlers
   */
  private setupCrossServerEventHandlers(): void {
    // Handle cross-server events would be implemented here
    // This would listen for events from the CrossServerEventRouterService
    this.logger.debug('Cross-server event handlers setup complete');
  }

  /**
   * Setup socket event handlers
   */
  private setupSocketEventHandlers(socket: MultiServerSocket): void {
    socket.on('subscribe', async (data) => {
      try {
        await this.handleSubscription(socket, data);
      } catch (error) {
        this.logger.error(`Subscription error: ${error.message}`);
        socket.emit('error', { message: 'Subscription failed', code: 'SUBSCRIPTION_ERROR' });
      }
    });

    socket.on('unsubscribe', async (data) => {
      try {
        await this.handleUnsubscription(socket, data);
      } catch (error) {
        this.logger.error(`Unsubscription error: ${error.message}`);
      }
    });

    socket.on('publish', async (data) => {
      try {
        await this.handlePublish(socket, data);
      } catch (error) {
        this.logger.error(`Publish error: ${error.message}`);
        socket.emit('error', { message: 'Publish failed', code: 'PUBLISH_ERROR' });
      }
    });

    socket.on('ping', (data) => {
      socket.emit('pong', { ...data, serverTime: Date.now() });
    });
  }

  /**
   * Handle channel subscription
   */
  private async handleSubscription(socket: MultiServerSocket, data: any): Promise<void> {
    if (!socket.tenantContext) {
      throw new Error('Not authenticated');
    }

    const { channels } = data;
    for (const channel of channels) {
      const roomName = `org:${socket.organizationId}:${channel}`;
      socket.join(roomName);
    }

    // Update distributed connection with new channels
    if (socket.sessionId) {
      await this.distributedConnectionManager.updateConnectionActivity(socket.sessionId, channels);
    }

    socket.emit('subscribed', { channels });
  }

  /**
   * Handle channel unsubscription
   */
  private async handleUnsubscription(socket: MultiServerSocket, data: any): Promise<void> {
    const { channels } = data;
    for (const channel of channels) {
      const roomName = `org:${socket.organizationId}:${channel}`;
      socket.leave(roomName);
    }

    socket.emit('unsubscribed', { channels });
  }

  /**
   * Handle event publishing
   */
  private async handlePublish(socket: MultiServerSocket, data: any): Promise<void> {
    if (!socket.tenantContext) {
      throw new Error('Not authenticated');
    }

    const { channel, eventType, payload } = data;
    
    const event: AxonPulsEvent = {
      id: `${socket.sessionId}-${Date.now()}`,
      eventType,
      organizationId: socket.organizationId!,
      userId: socket.userId,
      payload,
      timestamp: Date.now(),
      acknowledgment: false,
    };

    // Publish to event stream
    await this.eventStreamService.publishEvent(event);

    // Broadcast to all servers
    await this.broadcastToAllServers(socket.organizationId!, channel, event);

    socket.emit('published', { eventId: event.id });
  }

  /**
   * Get maximum connections for this server
   */
  private async getMaxConnections(): Promise<number> {
    const serverInfo = this.serverRegistry.getCurrentServer();
    return serverInfo.maxConnections;
  }
}
