import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { TenantAwareService, TenantContext } from '../services/tenant-aware.service';
import { TenantJwtService } from '../services/tenant-jwt.service';
import { TenantRoomService } from '../services/tenant-room.service';
import { TenantRateLimitService } from '../services/tenant-rate-limit.service';

export interface TenantSocket extends Socket {
  tenantContext?: TenantContext;
  organizationId?: string;
  userId?: string;
  isAuthenticated?: boolean;
}

@Injectable()
export class TenantWebSocketInterceptor {
  private readonly logger = new Logger(TenantWebSocketInterceptor.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly tenantAwareService: TenantAwareService,
    private readonly tenantJwtService: TenantJwtService,
    private readonly tenantRoomService: TenantRoomService,
    private readonly tenantRateLimitService: TenantRateLimitService,
  ) { }

  /**
   * Authenticate and establish tenant context for WebSocket connection
   */
  async authenticateConnection(socket: TenantSocket): Promise<void> {
    try {
      const tenantContext = await this.extractTenantContext(socket);

      if (!tenantContext) {
        throw new WsException('Authentication required');
      }

      // Validate tenant context
      await this.tenantAwareService.validateTenantContext(tenantContext);

      // Check connection limits
      await this.checkConnectionLimits(tenantContext);

      // Attach to socket
      socket.tenantContext = tenantContext;
      socket.organizationId = tenantContext.organizationId;
      socket.userId = tenantContext.userId;
      socket.isAuthenticated = true;

      // Join tenant-specific rooms (using shared service)
      await this.tenantRoomService.joinTenantRooms(socket, tenantContext, {
        useSimpleRoles: true
      });

      this.logger.log(`WebSocket authenticated for org: ${tenantContext.organizationId}, user: ${tenantContext.userId}`);
    } catch (error) {
      this.logger.error(`WebSocket authentication failed: ${error.message}`);
      socket.emit('error', { message: 'Authentication failed', code: 'AUTH_FAILED' });
      socket.disconnect(true);
      throw error;
    }
  }

  /**
   * Validate message against tenant isolation rules
   */
  async validateMessage(socket: TenantSocket, event: string, data: any): Promise<boolean> {
    if (!socket.isAuthenticated || !socket.tenantContext) {
      throw new WsException('Not authenticated');
    }

    try {
      // Check if user has permission for this event type
      await this.validateEventPermission(socket.tenantContext, event);

      // Validate channel access if channel is specified
      if (data.channel) {
        await this.validateChannelAccess(socket.tenantContext, data.channel);
      }

      // Check rate limits (using shared service)
      await this.tenantRateLimitService.checkRedisRateLimit(socket.tenantContext, {
        enableBurstProtection: true,
        logWarnings: true
      });

      return true;
    } catch (error) {
      this.logger.error(`Message validation failed: ${error.message}`);
      socket.emit('error', {
        message: 'Message validation failed',
        code: 'VALIDATION_FAILED',
        details: error.message
      });
      return false;
    }
  }

  /**
   * Filter outgoing messages based on tenant isolation
   */
  filterOutgoingMessage(socket: TenantSocket, event: string, data: any): any {
    if (!socket.tenantContext) {
      return null;
    }

    // Ensure message is for the correct organization
    if (data.organizationId && data.organizationId !== socket.organizationId) {
      return null;
    }

    // Filter sensitive data based on user role
    return this.filterSensitiveData(data, socket.tenantContext);
  }

  /**
   * Handle connection cleanup
   */
  async handleDisconnection(socket: TenantSocket): Promise<void> {
    if (socket.tenantContext) {
      try {
        // Leave tenant rooms
        await this.leaveTenantRooms(socket, socket.tenantContext);

        // Log disconnection
        await this.tenantAwareService.logTenantAccess(
          socket.tenantContext,
          'websocket_disconnect',
          'WebSocketConnection',
          socket.id,
          true
        );

        this.logger.log(`WebSocket disconnected for org: ${socket.organizationId}, user: ${socket.userId}`);
      } catch (error) {
        this.logger.error(`WebSocket disconnection cleanup failed: ${error.message}`);
      }
    }
  }

  private async extractTenantContext(socket: TenantSocket): Promise<TenantContext | null> {
    // Method 1: Extract from auth token in handshake (using shared service)
    const tokenContext = await this.tenantJwtService.extractFromHandshake(socket);
    if (tokenContext) {
      return tokenContext;
    }

    // Method 2: Extract from query parameters (using shared service)
    const queryContext = await this.tenantJwtService.extractFromQuery(socket.handshake.query);
    if (queryContext) {
      return queryContext;
    }

    return null;
  }

  // JWT token extraction now handled by TenantJwtService

  // Query extraction now handled by TenantJwtService

  private async checkConnectionLimits(context: TenantContext): Promise<void> {
    try {
      await this.tenantAwareService.checkResourceLimits(context, 'AxonPulsConnection');
    } catch (error) {
      throw new WsException('Connection limit exceeded');
    }
  }

  // Room management now handled by TenantRoomService

  private async leaveTenantRooms(socket: TenantSocket, context: TenantContext): Promise<void> {
    socket.leave(`org:${context.organizationId}`);

    if (context.userId) {
      socket.leave(`user:${context.userId}`);
    }

    if (context.userRole) {
      socket.leave(`role:${context.organizationId}:${context.userRole}`);
    }
  }

  private async validateEventPermission(context: TenantContext, event: string): Promise<void> {
    const eventPermissionMap: Record<string, string> = {
      'subscribe': 'AxonPulsChannel:read',
      'unsubscribe': 'AxonPulsChannel:read',
      'publish': 'AxonPulsEvent:create',
      'get_events': 'AxonPulsEvent:read',
      'get_connections': 'AxonPulsConnection:read',
    };

    const requiredPermission = eventPermissionMap[event];
    if (!requiredPermission) {
      return; // Allow unknown events by default
    }

    const hasPermission = context.permissions?.includes(requiredPermission) ||
      context.permissions?.includes('*:*') ||
      context.userRole === 'admin';

    if (!hasPermission) {
      throw new WsException(`Insufficient permissions for event: ${event}`);
    }
  }

  private async validateChannelAccess(context: TenantContext, channel: string): Promise<void> {
    // Check if channel belongs to the organization
    const tenantChannelPrefix = `org:${context.organizationId}:`;
    if (!channel.startsWith(tenantChannelPrefix)) {
      throw new WsException('Invalid channel access');
    }

    // Additional channel-specific validation can be added here
  }

  // Rate limiting now handled by TenantRateLimitService

  private filterSensitiveData(data: any, context: TenantContext): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const filtered = { ...data };

    // Remove sensitive fields based on user role
    if (context.userRole !== 'admin') {
      delete filtered.internalMetadata;
      delete filtered.systemData;
      delete filtered.debugInfo;
    }

    // Ensure organization ID matches
    if (filtered.organizationId && filtered.organizationId !== context.organizationId) {
      return null;
    }

    return filtered;
  }
}

/**
 * WebSocket Tenant Guard Decorator
 */
export function TenantWebSocketGuard() {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const socket = args[0] as TenantSocket;

      if (!socket.isAuthenticated || !socket.tenantContext) {
        socket.emit('error', { message: 'Authentication required', code: 'AUTH_REQUIRED' });
        return;
      }

      return method.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * WebSocket Message Validator Decorator
 */
export function ValidateWebSocketMessage() {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const socket = args[0] as TenantSocket;
      const data = args[1];
      const interceptor = this.tenantWebSocketInterceptor as TenantWebSocketInterceptor;

      if (interceptor) {
        const isValid = await interceptor.validateMessage(socket, propertyName, data);
        if (!isValid) {
          return;
        }
      }

      return method.apply(this, args);
    };

    return descriptor;
  };
}
