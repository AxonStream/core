import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../services/prisma.service';

export const TENANT_RESOURCE_KEY = 'tenantResource';
export const TenantResource = (resource: string) =>
  (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(TENANT_RESOURCE_KEY, resource, descriptor?.value || target);
  };

@Injectable()
export class TenantIsolationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prismaService: PrismaService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.get<string>(TENANT_RESOURCE_KEY, context.getHandler());

    if (!resource) {
      return true; // No tenant isolation required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.organizationId) {
      throw new ForbiddenException('User organization context required');
    }

    // Extract resource ID from request
    const resourceId = this.extractResourceId(request, resource);

    if (!resourceId) {
      return true; // No specific resource to check
    }

    // Validate tenant access
    const hasAccess = await this.validateTenantAccess(
      resource,
      resourceId,
      user.organizationId
    );

    if (!hasAccess) {
      throw new ForbiddenException('Access denied to resource in different organization');
    }

    return true;
  }

  private extractResourceId(request: any, resource: string): string | null {
    // Try to get ID from params, query, or body
    return request.params?.id ||
      request.params?.[`${resource}Id`] ||
      request.query?.id ||
      request.body?.id ||
      null;
  }

  private async validateTenantAccess(
    resource: string,
    resourceId: string,
    organizationId: string
  ): Promise<boolean> {
    try {
      switch (resource) {
        case 'connection':
          const connection = await this.prismaService.axonPulsConnection.findUnique({
            where: { id: resourceId },
            select: { organizationId: true },
          });
          return connection?.organizationId === organizationId;

        case 'event':
          const event = await this.prismaService.axonPulsEvent.findUnique({
            where: { id: resourceId },
            select: { organizationId: true },
          });
          return event?.organizationId === organizationId;

        case 'channel':
          const channel = await this.prismaService.axonPulsChannel.findUnique({
            where: { id: resourceId },
            select: { organizationId: true },
          });
          return channel?.organizationId === organizationId;

        case 'user':
          const user = await this.prismaService.user.findUnique({
            where: { id: resourceId },
            select: { organizationId: true },
          });
          return user?.organizationId === organizationId;

        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }
}
