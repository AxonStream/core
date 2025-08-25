import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { TenantAwareService, TenantContext } from '../services/tenant-aware.service';

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
  ) {}

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

      // Join tenant-specific rooms
      await this.joinTenantRooms(socket, tenantContext);

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

      // Check rate limits
      await this.checkMessageRateLimits(socket.tenantContext);

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
    // Method 1: Extract from auth token in handshake
    const tokenContext = await this.extractFromToken(socket);
    if (tokenContext) {
      return tokenContext;
    }

    // Method 2: Extract from query parameters
    const queryContext = await this.extractFromQuery(socket);
    if (queryContext) {
      return queryContext;
    }

    return null;
  }

  private async extractFromToken(socket: TenantSocket): Promise<TenantContext | null> {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return null;
      }

      const payload = this.jwtService.verify(token as string);
      
      if (payload.organizationId && payload.sub) {
        return await this.tenantAwareService.createTenantContext(
          payload.organizationId,
          payload.sub,
          payload.permissions
        );
      }

      return null;
    } catch (error) {
      this.logger.debug(`Token extraction failed: ${error.message}`);
      return null;
    }
  }

  private async extractFromQuery(socket: TenantSocket): Promise<TenantContext | null> {
    try {
      const organizationId = socket.handshake.query?.organizationId as string;
      const userId = socket.handshake.query?.userId as string;

      if (organizationId) {
        return await this.tenantAwareService.createTenantContext(organizationId, userId);
      }

      return null;
    } catch (error) {
      this.logger.debug(`Query extraction failed: ${error.message}`);
      return null;
    }
  }

  private async checkConnectionLimits(context: TenantContext): Promise<void> {
    try {
      await this.tenantAwareService.checkResourceLimits(context, 'AxonPulsConnection');
    } catch (error) {
      throw new WsException('Connection limit exceeded');
    }
  }

  private async joinTenantRooms(socket: TenantSocket, context: TenantContext): Promise<void> {
    // Join organization room
    socket.join(`org:${context.organizationId}`);

    // Join user room if user is specified
    if (context.userId) {
      socket.join(`user:${context.userId}`);
    }

    // Join role-based room
    if (context.userRole) {
      socket.join(`role:${context.organizationId}:${context.userRole}`);
    }
  }

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

  private async checkMessageRateLimits(context: TenantContext): Promise<void> {
    // Implement message rate limiting per tenant
    // This is a simplified version - in production, use more sophisticated rate limiting
    const redis = this.tenantAwareService['redisService'].getRedisInstance();
    const key = `tenant:${context.organizationId}:ws_messages:${Math.floor(Date.now() / 60000)}`; // Per minute
    
    const count = await redis.incr(key);
    await redis.expire(key, 120); // 2 minutes TTL

    const limits = await this.tenantAwareService.getTenantLimits(context.organizationId);
    const maxMessagesPerMinute = limits.maxApiCalls / 60; // Approximate

    if (count > maxMessagesPerMinute) {
      throw new WsException('Message rate limit exceeded');
    }
  }

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
