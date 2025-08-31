import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { TenantContext } from './tenant-aware.service';

export interface RoomOptions {
  includeFeatures?: boolean;
  includeRoles?: boolean;
  useSimpleRoles?: boolean; // Use single userRole instead of roles array
}

export interface TenantSocket extends Socket {
  tenantContext?: TenantContext;
  organizationId?: string;
  userId?: string;
  isAuthenticated?: boolean;
}

/**
 * Unified room management service
 * Consolidates room logic from guard and interceptor
 */
@Injectable()
export class TenantRoomService {
  private readonly logger = new Logger(TenantRoomService.name);

  /**
   * Join tenant-specific rooms based on context
   */
  async joinTenantRooms(
    socket: TenantSocket, 
    context: TenantContext, 
    options: RoomOptions = {}
  ): Promise<void> {
    try {
      // Always join organization room
      socket.join(`org:${context.organizationId}`);
      this.logger.debug(`Socket ${socket.id} joined org room: org:${context.organizationId}`);

      // Join user room if user is specified
      if (context.userId) {
        socket.join(`user:${context.userId}`);
        this.logger.debug(`Socket ${socket.id} joined user room: user:${context.userId}`);
      }

      // Handle role-based rooms
      if (options.useSimpleRoles && context.userRole) {
        // Simple single role (interceptor style)
        socket.join(`role:${context.organizationId}:${context.userRole}`);
        this.logger.debug(`Socket ${socket.id} joined role room: role:${context.organizationId}:${context.userRole}`);
      } else if (options.includeRoles !== false && context.roles && context.roles.length > 0) {
        // Multiple roles (guard style)
        for (const role of context.roles) {
          socket.join(`role:${context.organizationId}:${role}`);
          this.logger.debug(`Socket ${socket.id} joined role room: role:${context.organizationId}:${role}`);
        }
      }

      // Join feature-based rooms (guard style)
      if (options.includeFeatures && context.features && context.features.length > 0) {
        for (const feature of context.features) {
          socket.join(`feature:${context.organizationId}:${feature}`);
          this.logger.debug(`Socket ${socket.id} joined feature room: feature:${context.organizationId}:${feature}`);
        }
      }

    } catch (error) {
      this.logger.error(`Failed to join tenant rooms for socket ${socket.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Leave tenant-specific rooms
   */
  async leaveTenantRooms(
    socket: TenantSocket, 
    context: TenantContext, 
    options: RoomOptions = {}
  ): Promise<void> {
    try {
      // Leave organization room
      socket.leave(`org:${context.organizationId}`);
      this.logger.debug(`Socket ${socket.id} left org room: org:${context.organizationId}`);

      // Leave user room
      if (context.userId) {
        socket.leave(`user:${context.userId}`);
        this.logger.debug(`Socket ${socket.id} left user room: user:${context.userId}`);
      }

      // Handle role-based rooms
      if (options.useSimpleRoles && context.userRole) {
        // Simple single role (interceptor style)
        socket.leave(`role:${context.organizationId}:${context.userRole}`);
        this.logger.debug(`Socket ${socket.id} left role room: role:${context.organizationId}:${context.userRole}`);
      } else if (options.includeRoles !== false && context.roles && context.roles.length > 0) {
        // Multiple roles (guard style)
        for (const role of context.roles) {
          socket.leave(`role:${context.organizationId}:${role}`);
          this.logger.debug(`Socket ${socket.id} left role room: role:${context.organizationId}:${role}`);
        }
      }

      // Leave feature-based rooms (guard style)
      if (options.includeFeatures && context.features && context.features.length > 0) {
        for (const feature of context.features) {
          socket.leave(`feature:${context.organizationId}:${feature}`);
          this.logger.debug(`Socket ${socket.id} left feature room: feature:${context.organizationId}:${feature}`);
        }
      }

    } catch (error) {
      this.logger.error(`Failed to leave tenant rooms for socket ${socket.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all rooms for a tenant context
   */
  getTenantRooms(context: TenantContext, options: RoomOptions = {}): string[] {
    const rooms: string[] = [];

    // Organization room
    rooms.push(`org:${context.organizationId}`);

    // User room
    if (context.userId) {
      rooms.push(`user:${context.userId}`);
    }

    // Role rooms
    if (options.useSimpleRoles && context.userRole) {
      rooms.push(`role:${context.organizationId}:${context.userRole}`);
    } else if (options.includeRoles !== false && context.roles && context.roles.length > 0) {
      for (const role of context.roles) {
        rooms.push(`role:${context.organizationId}:${role}`);
      }
    }

    // Feature rooms
    if (options.includeFeatures && context.features && context.features.length > 0) {
      for (const feature of context.features) {
        rooms.push(`feature:${context.organizationId}:${feature}`);
      }
    }

    return rooms;
  }

  /**
   * Check if socket is in correct tenant rooms
   */
  validateSocketRooms(socket: TenantSocket, context: TenantContext, options: RoomOptions = {}): boolean {
    const expectedRooms = this.getTenantRooms(context, options);
    const socketRooms = Array.from(socket.rooms);

    for (const expectedRoom of expectedRooms) {
      if (!socketRooms.includes(expectedRoom)) {
        this.logger.warn(`Socket ${socket.id} missing expected room: ${expectedRoom}`);
        return false;
      }
    }

    return true;
  }
}
