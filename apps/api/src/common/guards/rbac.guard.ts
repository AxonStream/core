import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, PERMISSIONS_KEY, ROLE_LEVEL_KEY } from '../decorators/roles.decorator';
import { TenantAwareService } from '../services/tenant-aware.service';
import { PrismaService } from '../services/prisma.service';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  organizationId: string;
  organizationSlug: string;
  user: any;
}

@Injectable()
export class RBACGuard implements CanActivate {
  private readonly logger = new Logger(RBACGuard.name);

  constructor(
    private reflector: Reflector,
    private tenantAwareService: TenantAwareService,
    private prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get required access from decorators
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredRoleLevel = this.reflector.getAllAndOverride<string>(ROLE_LEVEL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no requirements specified, allow access
    if (!requiredRoles && !requiredPermissions && !requiredRoleLevel) {
      return true;
    }

    try {
      // Get user roles and permissions
      const userRoles = await this.getUserRoles(user.userId, user.organizationId);
      const userPermissions = await this.getUserPermissions(user.userId, user.organizationId);

      // Check role requirements
      if (requiredRoles && requiredRoles.length > 0) {
        const hasRequiredRole = requiredRoles.some(role =>
          userRoles.some(userRole => userRole.role.name === role)
        );
        if (!hasRequiredRole) {
          this.logger.warn(`User ${user.userId} lacks required roles: ${requiredRoles.join(', ')}`);
          throw new ForbiddenException('Insufficient role privileges');
        }
      }

      // Check permission requirements
      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasRequiredPermissions = requiredPermissions.every(permission => 
          userPermissions.includes(permission) ||
          userPermissions.includes('*:*') ||
          this.checkWildcardPermission(permission, userPermissions)
        );
        if (!hasRequiredPermissions) {
          this.logger.warn(`User ${user.userId} lacks required permissions: ${requiredPermissions.join(', ')}`);
          throw new ForbiddenException('Insufficient permissions');
        }
      }

      // Check role level requirements
      if (requiredRoleLevel) {
        const hasRequiredLevel = this.checkRoleLevel(userRoles, requiredRoleLevel);
        if (!hasRequiredLevel) {
          this.logger.warn(`User ${user.userId} lacks required role level: ${requiredRoleLevel}`);
          throw new ForbiddenException('Insufficient role level');
        }
      }

      // Log successful authorization
      this.logger.debug(`User ${user.userId} authorized for ${context.getClass().name}.${context.getHandler().name}`);
      return true;

    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`RBAC check failed for user ${user.userId}:`, error);
      throw new ForbiddenException('Authorization check failed');
    }
  }

  private async getUserRoles(userId: string, organizationId: string) {
    return await this.prismaService.userRole.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ],
        role: {
          organizationId,
          isActive: true,
        }
      },
      include: {
        role: true,
      },
    });
  }

  private async getUserPermissions(userId: string, organizationId: string): Promise<string[]> {
    const userRoles = await this.getUserRoles(userId, organizationId);
    const permissions = new Set<string>();

    for (const userRole of userRoles) {
      for (const permission of userRole.role.permissions) {
        permissions.add(permission);
      }
    }

    return Array.from(permissions);
  }

  private checkWildcardPermission(requiredPermission: string, userPermissions: string[]): boolean {
    const [resource, action] = requiredPermission.split(':');
    
    // Check for resource-level wildcard (e.g., "user:*")
    if (userPermissions.includes(`${resource}:*`)) {
      return true;
    }

    // Check for action-level wildcard (e.g., "*:read")
    if (userPermissions.includes(`*:${action}`)) {
      return true;
    }

    return false;
  }

  private checkRoleLevel(userRoles: any[], requiredLevel: string): boolean {
    const levelHierarchy = {
      'VIEWER': 1,
      'DEVELOPER': 2,
      'ORG_ADMIN': 3,
      'SUPER_ADMIN': 4,
    };

    const requiredLevelValue = levelHierarchy[requiredLevel];
    if (!requiredLevelValue) {
      return false;
    }

    return userRoles.some(userRole => {
      const userLevelValue = levelHierarchy[userRole.role.level];
      return userLevelValue >= requiredLevelValue;
    });
  }
}
