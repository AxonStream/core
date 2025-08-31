import { Injectable, CanActivate, ExecutionContext, Logger, ForbiddenException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { TenantAwareService, TenantContext } from '../services/tenant-aware.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantJwtService } from '../services/tenant-jwt.service';
import { TenantRoomService, RoomOptions } from '../services/tenant-room.service';
import { TenantRateLimitService } from '../services/tenant-rate-limit.service';

export interface TenantSocket extends Socket {
  tenantContext?: TenantContext;
  organizationId?: string;
  userId?: string;
  isAuthenticated?: boolean;
  rateLimitCounter?: number;
  lastMessageTime?: number;
}

@Injectable()
export class TenantWebSocketGuard implements CanActivate {
  private readonly logger = new Logger(TenantWebSocketGuard.name);

  constructor(
    private readonly tenantAwareService: TenantAwareService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tenantJwtService: TenantJwtService,
    private readonly tenantRoomService: TenantRoomService,
    private readonly tenantRateLimitService: TenantRateLimitService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const socket = context.switchToWs().getClient<TenantSocket>();

    try {
      // Check if already authenticated
      if (socket.isAuthenticated && socket.tenantContext) {
        return await this.validateExistingContext(socket);
      }

      // Authenticate and establish tenant context
      const tenantContext = await this.authenticateSocket(socket);
      if (!tenantContext) {
        throw new WsException('Authentication failed');
      }

      // Validate tenant context
      await this.tenantAwareService.validateTenantContext(tenantContext);

      // Check connection limits
      await this.checkConnectionLimits(tenantContext);

      // Check rate limits
      await this.checkRateLimits(socket, tenantContext);

      // Attach context to socket
      socket.tenantContext = tenantContext;
      socket.organizationId = tenantContext.organizationId;
      socket.userId = tenantContext.userId;
      socket.isAuthenticated = true;

      // Join tenant-specific rooms (using shared service)
      await this.tenantRoomService.joinTenantRooms(socket, tenantContext, {
        includeFeatures: true,
        includeRoles: true
      });

      // Log successful authentication
      await this.tenantAwareService.logAuditEvent(
        tenantContext,
        'WEBSOCKET_CONNECT',
        'Connection',
        socket.id,
        null,
        {
          socketId: socket.id,
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
        }
      );

      this.logger.log(`WebSocket authenticated for org: ${tenantContext.organizationId}, user: ${tenantContext.userId}`);
      return true;

    } catch (error) {
      this.logger.error(`WebSocket authentication failed: ${error.message}`);

      // Log failed authentication attempt
      if (socket.tenantContext) {
        await this.tenantAwareService.logAuditFailure(
          socket.tenantContext,
          'WEBSOCKET_CONNECT',
          'Connection',
          error.message,
          socket.id
        );
      }

      socket.emit('error', {
        message: 'Authentication failed',
        code: 'AUTH_FAILED',
        timestamp: new Date().toISOString()
      });

      socket.disconnect(true);
      return false;
    }
  }

  private async authenticateSocket(socket: TenantSocket): Promise<TenantContext | null> {
    // Try JWT token from handshake
    const token = this.extractTokenFromHandshake(socket);
    if (token) {
      return await this.authenticateWithJWT(token);
    }

    // Try query parameters
    const organizationId = socket.handshake.query?.organizationId as string;
    const userId = socket.handshake.query?.userId as string;

    if (organizationId) {
      return await this.tenantAwareService.createTenantContext(organizationId, userId);
    }

    return null;
  }

  private async authenticateWithJWT(token: string): Promise<TenantContext | null> {
    try {
      const payload = await this.jwtService.verifyAsync(token);

      return await this.tenantAwareService.createTenantContext(
        payload.organizationId,
        payload.sub,
        payload.permissions
      );
    } catch (error) {
      this.logger.debug(`JWT verification failed: ${error.message}`);
      return null;
    }
  }

  private extractTokenFromHandshake(socket: TenantSocket): string | null {
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const tokenQuery = socket.handshake.query?.token as string;
    if (tokenQuery) {
      return tokenQuery;
    }

    return null;
  }

  private async validateExistingContext(socket: TenantSocket): Promise<boolean> {
    try {
      await this.tenantAwareService.validateTenantContext(socket.tenantContext);
      await this.tenantRateLimitService.checkSocketRateLimit(socket, socket.tenantContext);
      return true;
    } catch (error) {
      this.logger.warn(`Existing context validation failed: ${error.message}`);
      return false;
    }
  }

  private async checkConnectionLimits(context: TenantContext): Promise<void> {
    try {
      await this.tenantAwareService.checkResourceLimits(context, 'AxonPulsConnection');
    } catch (error) {
      throw new WsException('Connection limit exceeded');
    }
  }

  private async checkRateLimits(socket: TenantSocket, context: TenantContext): Promise<void> {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxMessages = 100; // Max messages per minute

    if (!socket.rateLimitCounter) {
      socket.rateLimitCounter = 0;
      socket.lastMessageTime = now;
    }

    // Reset counter if window has passed
    if (now - socket.lastMessageTime > windowMs) {
      socket.rateLimitCounter = 0;
      socket.lastMessageTime = now;
    }

    socket.rateLimitCounter++;

    if (socket.rateLimitCounter > maxMessages) {
      await this.tenantAwareService.logAuditEvent(
        context,
        'RATE_LIMIT_EXCEEDED',
        'Connection',
        socket.id,
        null,
        {
          messageCount: socket.rateLimitCounter,
          windowMs,
          maxMessages,
        }
      );

      throw new WsException('Rate limit exceeded');
    }
  }

  // Room management now handled by TenantRoomService
}

/**
 * Decorator for WebSocket message validation
 */
export function ValidateWebSocketMessage() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const socket = args[0] as TenantSocket;
      const messageData = args[1];

      // Validate tenant context
      if (!socket.tenantContext || !socket.isAuthenticated) {
        socket.emit('error', { message: 'Not authenticated', code: 'AUTH_REQUIRED' });
        return;
      }

      // Validate message structure
      if (!messageData || typeof messageData !== 'object') {
        socket.emit('error', { message: 'Invalid message format', code: 'INVALID_MESSAGE' });
        return;
      }

      // Check rate limits
      try {
        await this.tenantRateLimitService.checkWebSocketRateLimit(socket, socket.tenantContext);
      } catch (error) {
        socket.emit('error', { message: 'Rate limit exceeded', code: 'RATE_LIMIT' });
        return;
      }

      // Validate message belongs to tenant
      if (messageData.organizationId && messageData.organizationId !== socket.organizationId) {
        socket.emit('error', { message: 'Access denied', code: 'ACCESS_DENIED' });
        return;
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Decorator for tenant-specific WebSocket rooms
 */
export function TenantWebSocketRoom(roomType: 'org' | 'user' | 'role' | 'feature') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const socket = args[0] as TenantSocket;

      if (!socket.tenantContext) {
        socket.emit('error', { message: 'No tenant context', code: 'NO_CONTEXT' });
        return;
      }

      // Ensure socket is in correct room
      let roomName: string;
      switch (roomType) {
        case 'org':
          roomName = `org:${socket.organizationId}`;
          break;
        case 'user':
          roomName = `user:${socket.userId}`;
          break;
        case 'role':
          roomName = `role:${socket.organizationId}:${socket.tenantContext.userRole}`;
          break;
        case 'feature':
          // This would need additional logic to determine which feature room
          roomName = `feature:${socket.organizationId}`;
          break;
        default:
          roomName = `org:${socket.organizationId}`;
      }

      if (!socket.rooms.has(roomName)) {
        socket.join(roomName);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
