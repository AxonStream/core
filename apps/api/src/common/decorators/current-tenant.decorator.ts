import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '../services/tenant-aware.service';

/**
 * Decorator to extract TenantContext from request
 * Used by TenantIsolationGuard to provide tenant context to controllers
 */
export const CurrentTenant = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): TenantContext => {
        const request = ctx.switchToHttp().getRequest();
        return request.tenantContext;
    },
);
