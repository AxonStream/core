import { Injectable, NestMiddleware, ForbiddenException, UnauthorizedException, ExecutionContext, CanActivate } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { TenantAwareService, TenantContext } from '../services/tenant-aware.service';
import { Logger } from '@nestjs/common';

export interface TenantRequest extends Request {
  tenantContext?: TenantContext;
  organizationId?: string;
  userId?: string;
}

@Injectable()
export class TenantIsolationMiddleware implements NestMiddleware {
  protected readonly logger = new Logger(TenantIsolationMiddleware.name);

  constructor(
    protected readonly jwtService: JwtService,
    protected readonly tenantAwareService: TenantAwareService,
  ) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      // Extract tenant context from request
      const tenantContext = await this.extractTenantContext(req);
      
      if (tenantContext) {
        // Validate tenant context
        await this.tenantAwareService.validateTenantContext(tenantContext);
        
        // Attach to request
        req.tenantContext = tenantContext;
        req.organizationId = tenantContext.organizationId;
        req.userId = tenantContext.userId;

        // Increment API call count for rate limiting
        await this.tenantAwareService.incrementApiCallCount(tenantContext.organizationId);

        // Check resource limits
        await this.checkApiRateLimits(tenantContext);

        this.logger.debug(`Tenant context established for org: ${tenantContext.organizationId}`);
      }

      next();
    } catch (error) {
      this.logger.error(`Tenant isolation middleware error: ${error.message}`);
      
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new ForbiddenException('Tenant access denied');
    }
  }

  private async extractTenantContext(req: TenantRequest): Promise<TenantContext | null> {
    // Method 1: Extract from JWT token
    const tokenContext = await this.extractFromJWT(req);
    if (tokenContext) {
      return tokenContext;
    }

    // Method 2: Extract from headers
    const headerContext = this.extractFromHeaders(req);
    if (headerContext) {
      return headerContext;
    }

    // Method 3: Extract from subdomain
    const subdomainContext = await this.extractFromSubdomain(req);
    if (subdomainContext) {
      return subdomainContext;
    }

    return null;
  }

  private async extractFromJWT(req: TenantRequest): Promise<TenantContext | null> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.substring(7);
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
      this.logger.debug(`JWT extraction failed: ${error.message}`);
      return null;
    }
  }

  private extractFromHeaders(req: TenantRequest): TenantContext | null {
    const organizationId = req.headers['x-organization-id'] as string;
    const userId = req.headers['x-user-id'] as string;

    if (organizationId) {
      return {
        organizationId,
        organizationSlug: '', // Will be populated by validation
        userId,
      };
    }

    return null;
  }

  private async extractFromSubdomain(req: TenantRequest): Promise<TenantContext | null> {
    try {
      const host = req.headers.host;
      if (!host) {
        return null;
      }

      // Extract subdomain (e.g., tenant.example.com -> tenant)
      const subdomain = host.split('.')[0];
      if (!subdomain || subdomain === 'www' || subdomain === 'api') {
        return null;
      }

      // Look up organization by slug
      const organization = await this.tenantAwareService['prismaService'].organization.findUnique({
        where: { slug: subdomain },
        select: { id: true, slug: true },
      });

      if (organization) {
        return {
          organizationId: organization.id,
          organizationSlug: organization.slug,
        };
      }

      return null;
    } catch (error) {
      this.logger.debug(`Subdomain extraction failed: ${error.message}`);
      return null;
    }
  }

  private async checkApiRateLimits(context: TenantContext): Promise<void> {
    try {
      const usage = await this.tenantAwareService.getTenantUsage(context.organizationId);
      const limits = await this.tenantAwareService.getTenantLimits(context.organizationId);

      if (usage.apiCalls >= limits.maxApiCalls) {
        throw new ForbiddenException('API rate limit exceeded for this organization');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Rate limit check failed: ${error.message}`);
    }
  }
}

/**
 * Tenant Isolation Guard
 * Can be used as a guard for specific routes that require tenant isolation
 */

@Injectable()
export class TenantIsolationGuard implements CanActivate {
  protected readonly logger = new Logger(TenantIsolationGuard.name);

  constructor(protected readonly tenantAwareService: TenantAwareService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    
    if (!request.tenantContext) {
      this.logger.warn('No tenant context found in request');
      return false;
    }

    try {
      // Additional validation can be added here
      await this.tenantAwareService.validateTenantContext(request.tenantContext);
      return true;
    } catch (error) {
      this.logger.error(`Tenant isolation guard failed: ${error.message}`);
      return false;
    }
  }
}

/**
 * Tenant Context Decorator
 * Extracts tenant context from request for use in controllers
 */
import { createParamDecorator } from '@nestjs/common';

export const TenantCtx = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantContext | undefined => {
    const request = ctx.switchToHttp().getRequest<TenantRequest>();
    return request.tenantContext;
  },
);

export const OrganizationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<TenantRequest>();
    return request.organizationId;
  },
);

export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<TenantRequest>();
    return request.userId;
  },
);

/**
 * Tenant Feature Guard
 * Checks if tenant has access to specific features
 */
@Injectable()
export class TenantFeatureGuard implements CanActivate {
  protected readonly logger = new Logger(TenantFeatureGuard.name);

  constructor(
    protected readonly tenantAwareService: TenantAwareService,
    protected readonly requiredFeature: string,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();

    if (!request.tenantContext) {
      return false;
    }

    try {
      const limits = await this.tenantAwareService.getTenantLimits(request.tenantContext.organizationId);
      return limits.features.includes(this.requiredFeature) || limits.features.includes('*');
    } catch (error) {
      this.logger.error(`Feature guard check failed: ${error.message}`);
      return false;
    }
  }
}

/**
 * Create feature guard factory
 */
export function RequireFeature(feature: string) {
  @Injectable()
  class DynamicFeatureGuard implements CanActivate {
    public readonly logger = new Logger('DynamicFeatureGuard');

    constructor(public readonly tenantAwareService: TenantAwareService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<TenantRequest>();

      if (!request.tenantContext) {
        return false;
      }

      try {
        const limits = await this.tenantAwareService.getTenantLimits(request.tenantContext.organizationId);
        return limits.features.includes(feature) || limits.features.includes('*');
      } catch (error) {
        this.logger.error(`Feature guard check failed: ${error.message}`);
        return false;
      }
    }
  }
  return DynamicFeatureGuard;
}

/**
 * Tenant Resource Limit Guard
 * Checks if tenant can create more resources of a specific type
 */
@Injectable()
export class TenantResourceLimitGuard implements CanActivate {
  protected readonly logger = new Logger(TenantResourceLimitGuard.name);

  constructor(
    protected readonly tenantAwareService: TenantAwareService,
    protected readonly resourceType: string,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();

    if (!request.tenantContext) {
      return false;
    }

    try {
      await this.tenantAwareService.checkResourceLimits(request.tenantContext, this.resourceType);
      return true;
    } catch (error) {
      this.logger.error(`Resource limit guard failed: ${error.message}`);
      return false;
    }
  }
}

/**
 * Create resource limit guard factory
 */
export function RequireResourceLimit(resourceType: string) {
  @Injectable()
  class DynamicResourceLimitGuard implements CanActivate {
    public readonly logger = new Logger('DynamicResourceLimitGuard');

    constructor(public readonly tenantAwareService: TenantAwareService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<TenantRequest>();

      if (!request.tenantContext) {
        return false;
      }

      try {
        await this.tenantAwareService.checkResourceLimits(request.tenantContext, resourceType);
        return true;
      } catch (error) {
        this.logger.error(`Resource limit guard failed: ${error.message}`);
        return false;
      }
    }
  }
  return DynamicResourceLimitGuard;
}
