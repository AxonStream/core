import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';
export const ROLE_LEVEL_KEY = 'roleLevel';

/**
 * Decorator to specify required roles for a route
 * @param roles Array of role names required to access the route
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorator to specify required permissions for a route
 * @param permissions Array of permission strings required to access the route
 */
export const RequirePermissions = (...permissions: string[]) => 
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator to specify minimum role level required for a route
 * @param level Minimum role level required (VIEWER, DEVELOPER, ORG_ADMIN, SUPER_ADMIN)
 */
export const RequireRoleLevel = (level: 'VIEWER' | 'DEVELOPER' | 'ORG_ADMIN' | 'SUPER_ADMIN') => 
  SetMetadata(ROLE_LEVEL_KEY, level);

/**
 * Combined decorator for role and permission requirements
 * @param config Configuration object with roles, permissions, and/or roleLevel
 */
export const RequireAccess = (config: {
  roles?: string[];
  permissions?: string[];
  roleLevel?: 'VIEWER' | 'DEVELOPER' | 'ORG_ADMIN' | 'SUPER_ADMIN';
}) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (config.roles) {
      SetMetadata(ROLES_KEY, config.roles)(target, propertyKey, descriptor);
    }
    if (config.permissions) {
      SetMetadata(PERMISSIONS_KEY, config.permissions)(target, propertyKey, descriptor);
    }
    if (config.roleLevel) {
      SetMetadata(ROLE_LEVEL_KEY, config.roleLevel)(target, propertyKey, descriptor);
    }
  };
};
