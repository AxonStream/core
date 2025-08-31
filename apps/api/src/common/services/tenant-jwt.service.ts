import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { TenantAwareService, TenantContext } from './tenant-aware.service';

export interface JwtExtractionSource {
  type: 'header' | 'handshake' | 'query';
  authHeader?: string;
  socket?: Socket;
  query?: any;
}

/**
 * Unified JWT extraction and validation service
 * Consolidates JWT logic from middleware, guard, and interceptor
 */
@Injectable()
export class TenantJwtService {
  private readonly logger = new Logger(TenantJwtService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly tenantAwareService: TenantAwareService,
  ) {}

  /**
   * Extract tenant context from Authorization header (HTTP requests)
   */
  async extractFromAuthHeader(authHeader: string): Promise<TenantContext | null> {
    try {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.substring(7);
      return await this.verifyAndCreateContext(token);
    } catch (error) {
      this.logger.debug(`Auth header extraction failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract tenant context from WebSocket handshake
   */
  async extractFromHandshake(socket: Socket): Promise<TenantContext | null> {
    try {
      // Try authorization header first
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        return await this.verifyAndCreateContext(token);
      }

      // Try token from query parameters
      const tokenQuery = socket.handshake.query?.token as string;
      if (tokenQuery) {
        return await this.verifyAndCreateContext(tokenQuery);
      }

      // Try token from auth object
      const authToken = socket.handshake.auth?.token;
      if (authToken) {
        return await this.verifyAndCreateContext(authToken as string);
      }

      return null;
    } catch (error) {
      this.logger.debug(`Handshake extraction failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract tenant context from query parameters
   */
  async extractFromQuery(query: any): Promise<TenantContext | null> {
    try {
      const organizationId = query?.organizationId as string;
      const userId = query?.userId as string;

      if (organizationId) {
        return await this.tenantAwareService.createTenantContext(organizationId, userId);
      }

      return null;
    } catch (error) {
      this.logger.debug(`Query extraction failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Verify JWT token and create tenant context
   */
  async verifyAndCreateContext(token: string): Promise<TenantContext | null> {
    try {
      const payload = this.jwtService.verify(token);

      if (payload.organizationId && payload.sub) {
        return await this.tenantAwareService.createTenantContext(
          payload.organizationId,
          payload.sub,
          payload.permissions
        );
      }

      return null;
    } catch (error) {
      this.logger.debug(`JWT verification failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Async version of JWT verification (for compatibility)
   */
  async verifyAndCreateContextAsync(token: string): Promise<TenantContext | null> {
    try {
      const payload = await this.jwtService.verifyAsync(token);

      if (payload.organizationId && payload.sub) {
        return await this.tenantAwareService.createTenantContext(
          payload.organizationId,
          payload.sub,
          payload.permissions
        );
      }

      return null;
    } catch (error) {
      this.logger.debug(`JWT async verification failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract tenant context from multiple sources (unified method)
   */
  async extractTenantContext(source: JwtExtractionSource): Promise<TenantContext | null> {
    switch (source.type) {
      case 'header':
        return source.authHeader ? await this.extractFromAuthHeader(source.authHeader) : null;
      
      case 'handshake':
        return source.socket ? await this.extractFromHandshake(source.socket) : null;
      
      case 'query':
        return source.query ? await this.extractFromQuery(source.query) : null;
      
      default:
        return null;
    }
  }
}
