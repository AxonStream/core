import { SetMetadata, createParamDecorator, ExecutionContext, applyDecorators, UseGuards } from '@nestjs/common';
import { TenantIsolationGuard } from '../guards/tenant-isolation.guard';
import { TenantWebSocketGuard } from '../guards/tenant-websocket.guard';

// Metadata keys
export const TENANT_RESOURCE_KEY = 'tenantResource';
export const TENANT_PERMISSION_KEY = 'tenantPermission';
export const TENANT_FEATURE_KEY = 'tenantFeature';
export const TENANT_ENCRYPTION_KEY = 'tenantEncryption';
export const TENANT_AUDIT_KEY = 'tenantAudit';

/**
 * Mark a resource as tenant-isolated
 */
export const TenantResource = (resource: string) => SetMetadata(TENANT_RESOURCE_KEY, resource);

/**
 * Require specific permission for tenant access
 */
export const RequirePermission = (permission: string) => SetMetadata(TENANT_PERMISSION_KEY, permission);

/**
 * Require specific feature to be enabled for tenant
 */
export const RequireFeature = (feature: string) => SetMetadata(TENANT_FEATURE_KEY, feature);

/**
 * Mark data as requiring encryption
 */
export const RequireEncryption = (fields?: string[]) => SetMetadata(TENANT_ENCRYPTION_KEY, fields || true);

/**
 * Configure audit logging for endpoint
 */
export const AuditLog = (options: {
  action?: string;
  resourceType?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category?: string;
}) => SetMetadata(TENANT_AUDIT_KEY, options);

/**
 * Complete tenant isolation decorator
 */
export function TenantIsolated(options: {
  resource?: string;
  permission?: string;
  feature?: string;
  encryption?: boolean | string[];
  audit?: {
    action?: string;
    resourceType?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    category?: string;
  };
}) {
  const decorators = [UseGuards(TenantIsolationGuard)];

  if (options.resource) {
    decorators.push(TenantResource(options.resource));
  }

  if (options.permission) {
    decorators.push(RequirePermission(options.permission));
  }

  if (options.feature) {
    decorators.push(RequireFeature(options.feature));
  }

  if (options.encryption) {
    decorators.push(RequireEncryption(Array.isArray(options.encryption) ? options.encryption : undefined));
  }

  if (options.audit) {
    decorators.push(AuditLog(options.audit));
  }

  return applyDecorators(...decorators);
}

/**
 * WebSocket tenant isolation decorator
 */
export function TenantWebSocketIsolated(options: {
  permission?: string;
  feature?: string;
  audit?: {
    action?: string;
    resourceType?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
}) {
  const decorators = [UseGuards(TenantWebSocketGuard)];

  if (options.permission) {
    decorators.push(RequirePermission(options.permission));
  }

  if (options.feature) {
    decorators.push(RequireFeature(options.feature));
  }

  if (options.audit) {
    decorators.push(AuditLog(options.audit));
  }

  return applyDecorators(...decorators);
}

/**
 * Extract tenant context from request
 */
export const TenantContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext;
  },
);

/**
 * Extract organization ID from request
 */
export const OrganizationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.organizationId || request.tenantContext?.organizationId;
  },
);

/**
 * Extract user ID from request
 */
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.userId || request.tenantContext?.userId;
  },
);

/**
 * Extract user permissions from request
 */
export const UserPermissions = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext?.permissions || [];
  },
);

/**
 * Extract user roles from request
 */
export const UserRoles = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext?.roles || [];
  },
);

/**
 * Extract tenant features from request
 */
export const TenantFeatures = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext?.features || [];
  },
);

/**
 * Extract tenant quotas from request
 */
export const TenantQuotas = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext?.quotas;
  },
);

/**
 * WebSocket tenant context decorator
 */
export const WebSocketTenantContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const socket = ctx.switchToWs().getClient();
    return socket.tenantContext;
  },
);

/**
 * Validate tenant ownership of resource
 */
export function ValidateTenantOwnership(resourceType: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const request = args[0];
      const tenantContext = request.tenantContext;

      if (!tenantContext) {
        throw new Error('No tenant context available');
      }

      // Extract resource ID from request parameters
      const resourceId = request.params?.id || request.body?.id || request.query?.id;

      if (resourceId) {
        // Validate resource belongs to tenant
        const isValid = await this.tenantAwareService?.validateTenantResource(
          tenantContext.organizationId,
          resourceType,
          resourceId
        );

        if (!isValid) {
          throw new Error(`Resource ${resourceId} not found or access denied`);
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Auto-inject organization ID into queries
 */
export function InjectOrganizationId() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const request = args[0];
      const tenantContext = request.tenantContext;

      if (!tenantContext) {
        throw new Error('No tenant context available');
      }

      // Inject organizationId into request body and query
      if (request.body && typeof request.body === 'object') {
        request.body.organizationId = tenantContext.organizationId;
      }

      if (request.query && typeof request.query === 'object') {
        request.query.organizationId = tenantContext.organizationId;
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Encrypt sensitive fields in response
 */
export function EncryptSensitiveFields(fields: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      const request = args[0];
      const tenantContext = request.tenantContext;

      if (!tenantContext || !tenantContext.isEncrypted) {
        return result;
      }

      // Encrypt specified fields in the result
      if (result && typeof result === 'object') {
        for (const field of fields) {
          if (result[field]) {
            result[field] = await this.tenantAwareService?.encryptData(
              tenantContext.organizationId,
              result[field]
            );
          }
        }
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Rate limiting decorator for tenant operations
 */
export function TenantRateLimit(options: {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const request = args[0];
      const tenantContext = request.tenantContext;

      if (!tenantContext) {
        throw new Error('No tenant context available');
      }

      // Check rate limit for this tenant
      const rateLimitKey = `rate_limit:${tenantContext.organizationId}:${propertyKey}`;
      const current = await this.redisService?.incr(rateLimitKey);

      if (current === 1) {
        await this.redisService?.expire(rateLimitKey, Math.ceil(options.windowMs / 1000));
      }

      if (current > options.maxRequests) {
        throw new Error('Rate limit exceeded for this operation');
      }

      const result = await originalMethod.apply(this, args);

      // Optionally skip counting successful requests
      if (options.skipSuccessfulRequests && result) {
        await this.redisService?.decr(rateLimitKey);
      }

      return result;
    };

    return descriptor;
  };
}
