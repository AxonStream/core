import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SessionService } from '../services/session.service';
import type { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private sessionService: SessionService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Try session-based authentication first (for browser clients)
    const sessionAuth = await this.trySessionAuthentication(request);
    if (sessionAuth.success) {
      request.user = sessionAuth.user;
      return true;
    }

    // Fallback to JWT authentication (for API clients)
    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch (error) {
      this.logger.debug(`JWT authentication failed: ${error.message}`);
      throw error;
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      // Enhanced error handling for demo and trial users
      if (err?.response?.code) {
        // Pass through structured errors from JWT strategy
        throw err;
      }

      // Check if this is a token expiration issue
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          message: 'Token expired',
          code: 'TOKEN_EXPIRED',
          action: 'refresh',
          upgradeUrl: '/upgrade',
        });
      }

      // Check if this is a malformed token
      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException({
          message: 'Invalid token format',
          code: 'INVALID_TOKEN_FORMAT',
          action: 'regenerate',
        });
      }

      // Default error
      throw err || new UnauthorizedException({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
        action: 'login',
      });
    }

    // Add request metadata for demo users
    if (user.isDemo) {
      const request = context.switchToHttp().getRequest();
      user.requestMetadata = {
        endpoint: request.url,
        method: request.method,
        userAgent: request.headers['user-agent'],
        ip: request.ip || request.connection?.remoteAddress,
        timestamp: new Date().toISOString(),
      };
    }

    return user;
  }

  /**
   * Try session-based authentication for browser clients
   */
  private async trySessionAuthentication(request: Request): Promise<{
    success: boolean;
    user?: any;
    reason?: string;
  }> {
    try {
      // Check for session cookie
      const sessionId = this.sessionService.parseSessionCookie(request.headers.cookie || '');

      if (!sessionId) {
        return { success: false, reason: 'NO_SESSION_COOKIE' };
      }

      // Validate session
      const sessionValidation = await this.sessionService.validateSession(sessionId);

      if (!sessionValidation.valid || !sessionValidation.session) {
        return { success: false, reason: sessionValidation.reason || 'INVALID_SESSION' };
      }

      const session = sessionValidation.session;

      // Build user object compatible with JWT strategy
      const sessionUser: any = {
        userId: session.userId,
        organizationId: session.orgId,
        organizationSlug: session.orgSlug,
        roles: session.roleIds,
        permissions: session.permissions,
        isDemo: session.isDemo,
        demoExpiresAt: session.demoExpiresAt,
        sessionId: session.sid,
        sessionType: session.sessionType,
        requestMetadata: {
          usage: 0,
        },
      };

      // Add demo-specific metadata if applicable
      if (session.isDemo && session.demoExpiresAt) {
        const timeRemaining = Math.max(0, session.demoExpiresAt.getTime() - Date.now());
        const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));
        const isExpiringSoon = minutesRemaining <= 30;

        if (isExpiringSoon) {
          sessionUser.upgradePrompt = {
            title: 'Demo Expiring Soon',
            message: `Your demo expires in ${minutesRemaining} minutes. Upgrade now to continue with unlimited access.`,
            ctaText: 'Upgrade Now',
            ctaUrl: '/upgrade',
            urgency: 'high',
          };
        }
      }

      this.logger.debug(`Session authentication successful for user ${session.userId}`);
      return { success: true, user: sessionUser };
    } catch (error) {
      this.logger.debug(`Session authentication failed: ${error.message}`);
      return { success: false, reason: 'SESSION_ERROR' };
    }
  }
}
