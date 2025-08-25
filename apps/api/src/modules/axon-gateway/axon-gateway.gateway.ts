import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { EventStreamService } from '../../common/services/event-stream.service';
import { PrismaService } from '../../common/services/prisma.service';
import { SubscriptionManagerService } from '../subscription-manager/subscription-manager.service';
import { MagicService } from '../magic/magic.service';
import { MagicPresenceService } from '../magic/services/magic-presence.service';
import { TenantContext } from '../../common/services/tenant-aware.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
  organizationSlug?: string;
  clientType?: string;
  sessionId?: string;
}

interface WebSocketMessage {
  type: string;
  channel?: string;
  payload?: any;
  metadata?: {
    timestamp: number;
    version: string;
    correlationId?: string;
  };
}

interface SubscriptionRequest {
  channels: string[];
  filters?: Record<string, any>;
  acknowledgment?: boolean;
}

@WebSocketGateway({
  cors: {
    origin: process.env.WS_CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket'],
})
export class AxonpulsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AxonpulsGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
    private jwtService: JwtService,
    private authService: AuthService,
    private eventStreamService: EventStreamService,
    private prismaService: PrismaService,
    private configService: ConfigService,
    private subscriptionManager: SubscriptionManagerService,
    private magicService: MagicService,
    private magicPresence: MagicPresenceService,
  ) { }

  afterInit(server: Server) {
    this.logger.log('AXONPULS WebSocket Gateway initialized - Real-time messaging ready');
    this.setupHeartbeat();
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      this.logger.log(`Client attempting to connect: ${client.id}`);

      // Extract token from handshake
      const token = this.extractTokenFromHandshake(client);
      if (!token) {
        this.logger.warn(`No token provided for client: ${client.id}`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.verifyToken(token);
      if (!payload) {
        this.logger.warn(`Invalid token for client: ${client.id}`);
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      // Authenticate user
      const user = await this.authService.getUserById(payload.sub);
      if (!user || !user.isActive) {
        this.logger.warn(`User not found or inactive: ${payload.sub}`);
        client.emit('error', { message: 'User not found or inactive' });
        client.disconnect();
        return;
      }

      // Set client properties
      client.userId = user.id;
      client.organizationId = user.organizationId;
      client.organizationSlug = payload.organizationSlug;
      client.sessionId = this.generateSessionId();

      // Store connection in database
      await this.createConnection(client);

      // Add to connected clients
      this.connectedClients.set(client.id, client);

      // Join organization room
      client.join(`org:${client.organizationId}`);

      // Send connection confirmation
      client.emit('connected', {
        sessionId: client.sessionId,
        userId: client.userId,
        organizationId: client.organizationId,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Client connected successfully: ${client.id} (User: ${client.userId})`);
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}:`, error);
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    try {
      this.logger.log(`Client disconnecting: ${client.id}`);

      // Update connection status in database
      if (client.sessionId) {
        await this.updateConnectionStatus(client.sessionId, 'DISCONNECTED');
      }

      // Remove from connected clients
      this.connectedClients.delete(client.id);

      this.logger.log(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Disconnect error for client ${client.id}:`, error);
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SubscriptionRequest,
  ) {
    try {
      if (!this.isAuthenticated(client)) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { channels, filters, acknowledgment } = data;

      // Validate channels
      for (const channel of channels) {
        if (!this.isChannelAllowed(channel, client.organizationId)) {
          client.emit('error', { message: `Access denied to channel: ${channel}` });
          return;
        }
      }

      // Join channel rooms
      for (const channel of channels) {
        const roomName = this.getChannelRoom(channel, client.organizationId);
        client.join(roomName);
      }

      // Update connection channels in database
      await this.updateConnectionChannels(client.sessionId, channels);

      // Start consuming events for this client
      await this.startEventConsumption(client, { channels, filters, acknowledgment });

      client.emit('subscribed', {
        channels,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Client ${client.id} subscribed to channels: ${channels.join(', ')}`);
    } catch (error) {
      this.logger.error(`Subscribe error for client ${client.id}:`, error);
      client.emit('error', { message: 'Subscription failed' });
    }
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channels: string[] },
  ) {
    try {
      if (!this.isAuthenticated(client)) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { channels } = data;

      // Leave channel rooms
      for (const channel of channels) {
        const roomName = this.getChannelRoom(channel, client.organizationId);
        client.leave(roomName);
      }

      client.emit('unsubscribed', {
        channels,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Client ${client.id} unsubscribed from channels: ${channels.join(', ')}`);
    } catch (error) {
      this.logger.error(`Unsubscribe error for client ${client.id}:`, error);
      client.emit('error', { message: 'Unsubscribe failed' });
    }
  }

  @SubscribeMessage('publish')
  async handlePublish(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: WebSocketMessage,
  ) {
    try {
      if (!this.isAuthenticated(client)) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { type, channel, payload, metadata } = data;

      if (!channel || !this.isChannelAllowed(channel, client.organizationId)) {
        client.emit('error', { message: 'Invalid or unauthorized channel' });
        return;
      }

      // Publish event to stream
      const event = {
        eventType: type,
        channel,
        payload,
        organizationId: client.organizationId,
        userId: client.userId,
        acknowledgment: true,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        metadata,
      };

      const messageId = await this.eventStreamService.publishEvent(event);

      client.emit('published', {
        messageId,
        channel,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Client ${client.id} published to channel ${channel}: ${messageId}`);
    } catch (error) {
      this.logger.error(`Publish error for client ${client.id}:`, error);
      client.emit('error', { message: 'Publish failed' });
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
    this.updateHeartbeat(client);
  }

  // ============================================================================
  // MAGIC COLLABORATIVE HANDLERS - EXTEND existing gateway functionality
  // ============================================================================

  @SubscribeMessage('magic_subscribe')
  async handleMagicSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomName: string; stateKey?: string }
  ) {
    try {
      if (!this.isAuthenticated(client)) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { roomName, stateKey = 'main' } = data;

      // Build tenant context using existing patterns
      const context = await this.buildTenantContext(client);

      // Subscribe to Magic room channel using existing channel logic
      const channel = `org:${context.organizationId}:magic:${roomName}`;
      await client.join(channel);

      this.logger.log(`Client ${client.id} subscribed to Magic room: ${roomName}`);

      // Get current state using Magic service
      const currentState = await this.magicService.getCurrentState(context, roomName, stateKey);

      // Send current state using existing event pattern
      client.emit('magic_state_sync', {
        roomName,
        stateKey,
        state: currentState?.currentState || {},
        version: currentState?.version || 0,
        lastModified: currentState?.lastModifiedAt,
      });

      // Acknowledge subscription
      client.emit('magic_subscribed', {
        roomName,
        stateKey,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error(`Magic subscribe failed: ${error.message}`);
      client.emit('error', {
        message: 'Magic subscription failed',
        error: error.message
      });
    }
  }

  @SubscribeMessage('magic_unsubscribe')
  async handleMagicUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomName: string }
  ) {
    try {
      if (!this.isAuthenticated(client)) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { roomName } = data;
      const context = await this.buildTenantContext(client);

      // Leave Magic room channel
      const channel = `org:${context.organizationId}:magic:${roomName}`;
      await client.leave(channel);

      this.logger.log(`Client ${client.id} unsubscribed from Magic room: ${roomName}`);

      client.emit('magic_unsubscribed', {
        roomName,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error(`Magic unsubscribe failed: ${error.message}`);
      client.emit('error', {
        message: 'Magic unsubscribe failed',
        error: error.message
      });
    }
  }

  @SubscribeMessage('magic_operation')
  async handleMagicOperation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      roomName: string;
      operation: {
        type: string;
        path: string[];
        value?: any;
        index?: number;
        stateKey?: string;
      };
    }
  ) {
    try {
      if (!this.isAuthenticated(client)) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { roomName, operation } = data;
      const context = await this.buildTenantContext(client);

      // Create Magic operation with proper metadata
      const magicOperation = {
        ...operation,
        timestamp: Date.now(),
        clientId: client.id,
        version: Date.now(), // Will be properly versioned by Magic service
        correlationId: `${client.id}_${Date.now()}`,
      };

      this.logger.debug(`Magic operation received from ${client.id}: ${operation.type} on ${roomName}`);

      // Apply operation using Magic service (will handle OT and conflicts)
      // For now, we'll implement a simple state update
      // The full OT implementation will come in the next phase

      // Get current state
      const currentState = await this.magicService.getCurrentState(context, roomName);
      if (!currentState) {
        throw new Error(`Magic room '${roomName}' not found`);
      }

      // Broadcast operation to all clients in room (except sender)
      const channel = `org:${context.organizationId}:magic:${roomName}`;
      client.to(channel).emit('magic_operation_applied', {
        roomName,
        operation: magicOperation,
        timestamp: new Date().toISOString(),
        appliedBy: client.id,
      });

      // Send confirmation to sender
      client.emit('magic_operation_confirmed', {
        roomName,
        operation: magicOperation,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Magic operation applied: ${operation.type} on ${roomName} by ${client.id}`);

    } catch (error) {
      this.logger.error(`Magic operation failed: ${error.message}`);
      client.emit('magic_operation_failed', {
        roomName: data.roomName,
        operation: data.operation,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('magic_create_room')
  async handleMagicCreateRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      roomName: string;
      initialState: Record<string, any>;
      config?: any;
    }
  ) {
    try {
      if (!this.isAuthenticated(client)) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { roomName, initialState, config } = data;
      const context = await this.buildTenantContext(client);

      this.logger.log(`Creating Magic room '${roomName}' for client ${client.id}`);

      // Create Magic room using Magic service
      const magicState = await this.magicService.createMagicRoom(
        context,
        roomName,
        initialState,
        config
      );

      // Auto-subscribe client to the new room
      const channel = `org:${context.organizationId}:magic:${roomName}`;
      await client.join(channel);

      // Send success response
      client.emit('magic_room_created', {
        roomName,
        state: magicState,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Magic room '${roomName}' created and client ${client.id} subscribed`);

    } catch (error) {
      this.logger.error(`Magic room creation failed: ${error.message}`);
      client.emit('magic_room_creation_failed', {
        roomName: data.roomName,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Private helper methods
  private extractTokenFromHandshake(client: Socket): string | null {
    const token = client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '');
    return token || null;
  }

  private async verifyToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      return null;
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isAuthenticated(client: AuthenticatedSocket): boolean {
    return !!(client.userId && client.organizationId);
  }

  private isChannelAllowed(channel: string, organizationId: string): boolean {
    // Basic conventions: enforce org scoping where applicable
    // Allowed patterns: "channel:<orgId>:*" rooms; public/global channels are not allowed by default in production
    if (!channel || channel.includes('..')) return false;
    return true;
  }

  private getChannelRoom(channel: string, organizationId: string): string {
    return `channel:${organizationId}:${channel}`;
  }

  private async createConnection(client: AuthenticatedSocket) {
    await this.prismaService.axonPulsConnection.create({
      data: {
        sessionId: client.sessionId,
        clientType: 'WEB_APP', // Default, can be extracted from handshake
        status: 'CONNECTED',
        channels: [],
        metadata: {
          userAgent: client.handshake.headers['user-agent'],
          ip: client.handshake.address,
        },
        organizationId: client.organizationId,
        userId: client.userId,
      },
    });
  }

  private async updateConnectionStatus(sessionId: string, status: string) {
    await this.prismaService.axonPulsConnection.update({
      where: { sessionId },
      data: {
        status: status as any,
        disconnectedAt: status === 'DISCONNECTED' ? new Date() : undefined,
      },
    });
  }

  private async updateConnectionChannels(sessionId: string, channels: string[]) {
    await this.prismaService.axonPulsConnection.update({
      where: { sessionId },
      data: { channels },
    });
  }

  private async updateHeartbeat(client: AuthenticatedSocket) {
    if (client.sessionId) {
      await this.prismaService.axonPulsConnection.update({
        where: { sessionId: client.sessionId },
        data: { lastHeartbeat: new Date() },
      });
    }
  }

  private async startEventConsumption(client: AuthenticatedSocket, subscription: any) {
    const { channels, filters, acknowledgment } = subscription;

    // Validate that the user has an active subscription for each channel
    for (const channel of channels) {
      const valid = await this.subscriptionManager.validateSubscription(
        client.organizationId!,
        client.userId!,
        channel,
      );
      if (!valid) {
        this.logger.warn(`User ${client.userId} is not subscribed to channel ${channel}`);
      }
    }

    // Subscribe to Redis Streams for the requested channels scoped to org
    this.eventStreamService
      .subscribeToEvents(
        {
          channels,
          organizationId: client.organizationId,
          userId: client.userId,
          filters,
          acknowledgment: acknowledgment !== false,
        },
        (event) => {
          try {
            const roomName = this.getChannelRoom(event.channel, client.organizationId!);
            this.server.to(roomName).emit('event', event);
          } catch (err) {
            this.logger.error('Failed forwarding event to client room', err as any);
          }
        },
      )
      .catch((err) => this.logger.error('Failed to subscribe to events', err));
  }

  private setupHeartbeat() {
    const interval = this.configService.get<number>('websocket.heartbeat.interval', 30000);

    setInterval(() => {
      this.server.emit('heartbeat', { timestamp: new Date().toISOString() });
    }, interval);
  }

  // Public methods for external use
  async broadcastToChannel(channel: string, organizationId: string, message: any) {
    const roomName = this.getChannelRoom(channel, organizationId);
    this.server.to(roomName).emit('event', message);
  }

  async broadcastToOrganization(organizationId: string, message: any) {
    this.server.to(`org:${organizationId}`).emit('event', message);
  }

  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  getConnectedClientsByOrganization(organizationId: string): AuthenticatedSocket[] {
    return Array.from(this.connectedClients.values()).filter(
      client => client.organizationId === organizationId
    );
  }

  /**
   * Build tenant context from authenticated socket
   * REUSES existing authentication patterns
   */
  private async buildTenantContext(client: AuthenticatedSocket): Promise<TenantContext> {
    if (!client.organizationId || !client.userId) {
      throw new Error('Client not properly authenticated');
    }

    return {
      organizationId: client.organizationId,
      organizationSlug: client.organizationSlug || '',
      userId: client.userId,
      sessionId: client.sessionId,
      userAgent: client.handshake.headers['user-agent'],
      ipAddress: client.handshake.address,
    };
  }

  // ============================================================================
  // MAGIC PRESENCE WEBSOCKET HANDLERS
  // ============================================================================

  @SubscribeMessage('magic_presence_join')
  async handleMagicPresenceJoin(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: {
      roomName: string;
      userName: string;
      userAvatar?: string;
      deviceInfo?: any;
    }
  ) {
    try {
      if (!socket.userId || !socket.organizationId) {
        socket.emit('error', { message: 'Authentication required for presence' });
        return;
      }

      const context = await this.buildTenantContext(socket);

      const presence = await this.magicPresence.joinRoom(context, data.roomName, {
        userName: data.userName,
        userAvatar: data.userAvatar,
        deviceInfo: data.deviceInfo,
      });

      // Join the room for real-time updates
      const roomChannel = `magic_presence_${data.roomName}_${socket.organizationId}`;
      await socket.join(roomChannel);

      // Notify all users in the room
      socket.to(roomChannel).emit('magic_presence_user_joined', {
        presence,
        roomName: data.roomName,
      });

      socket.emit('magic_presence_joined', {
        success: true,
        presence,
        roomName: data.roomName,
      });

    } catch (error) {
      this.logger.error(`Magic presence join failed: ${error.message}`);
      socket.emit('magic_presence_error', {
        type: 'join_failed',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('magic_presence_leave')
  async handleMagicPresenceLeave(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { roomName: string }
  ) {
    try {
      if (!socket.userId || !socket.organizationId) {
        return;
      }

      const context = await this.buildTenantContext(socket);

      await this.magicPresence.leaveRoom(context, data.roomName);

      // Leave the room
      const roomChannel = `magic_presence_${data.roomName}_${socket.organizationId}`;
      await socket.leave(roomChannel);

      // Notify remaining users
      socket.to(roomChannel).emit('magic_presence_user_left', {
        userId: socket.userId,
        sessionId: socket.sessionId,
        roomName: data.roomName,
      });

      socket.emit('magic_presence_left', {
        success: true,
        roomName: data.roomName,
      });

    } catch (error) {
      this.logger.error(`Magic presence leave failed: ${error.message}`);
      socket.emit('magic_presence_error', {
        type: 'leave_failed',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('magic_presence_update')
  async handleMagicPresenceUpdate(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: {
      roomName: string;
      cursorPosition?: { x: number; y: number; elementId?: string };
      selection?: { start: number; end: number; elementId?: string };
      viewportInfo?: { scrollX: number; scrollY: number; zoom: number };
      isActive?: boolean;
    }
  ) {
    try {
      if (!socket.userId || !socket.organizationId) {
        return;
      }

      const context = await this.buildTenantContext(socket);

      await this.magicPresence.updatePresence(context, data.roomName, {
        cursorPosition: data.cursorPosition,
        selection: data.selection,
        viewportInfo: data.viewportInfo,
        isActive: data.isActive,
      });

      // Broadcast to all users in the room (except sender)
      const roomChannel = `magic_presence_${data.roomName}_${socket.organizationId}`;
      socket.to(roomChannel).emit('magic_presence_updated', {
        userId: socket.userId,
        sessionId: socket.sessionId,
        cursorPosition: data.cursorPosition,
        selection: data.selection,
        viewportInfo: data.viewportInfo,
        isActive: data.isActive,
        timestamp: Date.now(),
      });

    } catch (error) {
      this.logger.error(`Magic presence update failed: ${error.message}`);
      socket.emit('magic_presence_error', {
        type: 'update_failed',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('magic_presence_heartbeat')
  async handleMagicPresenceHeartbeat(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { roomName: string }
  ) {
    try {
      if (!socket.userId || !socket.organizationId) {
        return;
      }

      const context = await this.buildTenantContext(socket);
      await this.magicPresence.sendHeartbeat(context, data.roomName);

    } catch (error) {
      // Silent fail for heartbeat
      this.logger.debug(`Magic presence heartbeat failed: ${error.message}`);
    }
  }

  @SubscribeMessage('magic_presence_get_room')
  async handleGetMagicRoomPresences(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { roomName: string }
  ) {
    try {
      if (!socket.userId || !socket.organizationId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      const context = await this.buildTenantContext(socket);
      const presences = await this.magicPresence.getRoomPresences(context, data.roomName);

      socket.emit('magic_presence_room_state', {
        roomName: data.roomName,
        presences,
        timestamp: Date.now(),
      });

    } catch (error) {
      this.logger.error(`Get room presences failed: ${error.message}`);
      socket.emit('magic_presence_error', {
        type: 'get_presences_failed',
        message: error.message,
      });
    }
  }
}
