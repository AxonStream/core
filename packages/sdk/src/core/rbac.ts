/**
 * 🔐 RBAC Client
 * 
 * Production-grade Role-Based Access Control with comprehensive
 * role management, permission systems, and access control.
 */

import { BaseClient } from './base-client';
import { AxonPulsError } from './errors';
import type { AxonPulsEvent } from '../types/schemas';

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  level: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'DEVELOPER' | 'VIEWER';
  isSystem: boolean;
  isActive: boolean;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissions: string[];
  level: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'DEVELOPER' | 'VIEWER';
  isSystem?: boolean;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: string[];
  level?: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'DEVELOPER' | 'VIEWER';
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  role: Role;
  assignedAt: Date;
  assignedBy: string;
  expiresAt?: Date;
  isActive: boolean;
  scope?: Record<string, any>;
}

export interface AssignRoleRequest {
  userId: string;
  roleId: string;
  expiresAt?: Date;
  scope?: Record<string, any>;
}

export interface UserPermissions {
  userId: string;
  roles: Role[];
  permissions: string[];
  effectivePermissions: string[];
  roleLevel: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'DEVELOPER' | 'VIEWER';
}

export interface SystemPermissions {
  permissions: string[];
  categories: {
    [category: string]: string[];
  };
  descriptions: {
    [permission: string]: string;
  };
}

export interface AccessCheck {
  hasAccess: boolean;
  reason?: string;
  requiredPermissions?: string[];
  userPermissions?: string[];
  missingPermissions?: string[];
}

export interface RoleQuery {
  organizationId?: string;
  includeSystem?: boolean;
  includeInactive?: boolean;
  level?: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'DEVELOPER' | 'VIEWER';
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * RBAC Client
 * Handles role-based access control, permissions, and user role management
 */
export class RBACClient extends BaseClient {
  /**
   * Get all roles
   */
  async getRoles(query?: RoleQuery): Promise<Role[]> {
    try {
      const response = await this.apiClient.get('/api/v1/rbac/roles', {
        params: {
          includeSystem: query?.includeSystem || false,
          includeInactive: query?.includeInactive || false,
          level: query?.level,
          search: query?.search,
          limit: query?.limit || 100,
          offset: query?.offset || 0
        }
      });

      return response.data.map(this.mapRoleResponse);
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get roles',
        'ROLES_FETCH_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { operation: 'roles_fetch' }
      );
    }
  }

  /**
   * Get role by ID
   */
  async getRole(roleId: string): Promise<Role> {
    try {
      const response = await this.apiClient.get(`/api/v1/rbac/roles/${roleId}`);
      return this.mapRoleResponse(response.data);
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get role',
        'ROLE_FETCH_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { operation: 'role_fetch', roleId }
      );
    }
  }

  /**
   * Create new role
   */
  async createRole(request: CreateRoleRequest): Promise<Role> {
    try {
      this.validateRoleRequest(request);

      const response = await this.apiClient.post('/api/v1/rbac/roles', request);
      return this.mapRoleResponse(response.data);
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to create role',
        'ROLE_CREATE_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'role_creation',
          roleName: request.name,
          permissionCount: request.permissions.length
        }
      );
    }
  }

  /**
   * Update role
   */
  async updateRole(roleId: string, request: UpdateRoleRequest): Promise<Role> {
    try {
      if (request.permissions) {
        this.validatePermissions(request.permissions);
      }

      const response = await this.apiClient.put(`/api/v1/rbac/roles/${roleId}`, request);
      return this.mapRoleResponse(response.data);
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to update role',
        'ROLE_UPDATE_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { operation: 'role_update', roleId }
      );
    }
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/api/v1/rbac/roles/${roleId}`);
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to delete role',
        'ROLE_DELETE_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { operation: 'role_deletion', roleId }
      );
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(request: AssignRoleRequest): Promise<UserRole> {
    try {
      const response = await this.apiClient.post('/api/v1/rbac/assign', request);
      return this.mapUserRoleResponse(response.data);
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to assign role',
        'ROLE_ASSIGN_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'role_assignment',
          userId: request.userId,
          roleId: request.roleId
        }
      );
    }
  }

  /**
   * Revoke role from user
   */
  async revokeRole(userId: string, roleId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/api/v1/rbac/revoke/${userId}/${roleId}`);
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to revoke role',
        'ROLE_REVOKE_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'role_revocation',
          userId,
          roleId
        }
      );
    }
  }

  /**
   * Get user roles and permissions
   */
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    try {
      const response = await this.apiClient.get(`/api/v1/rbac/users/${userId}/roles`);
      
      return {
        userId,
        roles: response.data.roles.map(this.mapRoleResponse),
        permissions: response.data.permissions,
        effectivePermissions: this.calculateEffectivePermissions(response.data.permissions),
        roleLevel: this.calculateRoleLevel(response.data.roles)
      };
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get user permissions',
        'USER_PERMISSIONS_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { operation: 'user_permissions_fetch', userId }
      );
    }
  }

  /**
   * Get system permissions
   */
  async getSystemPermissions(): Promise<SystemPermissions> {
    try {
      const response = await this.apiClient.get('/api/v1/rbac/permissions');
      
      return {
        permissions: response.data.permissions,
        categories: this.categorizePermissions(response.data.permissions),
        descriptions: this.getPermissionDescriptions(response.data.permissions)
      };
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get system permissions',
        'SYSTEM_PERMISSIONS_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { operation: 'system_permissions_fetch' }
      );
    }
  }

  /**
   * Check if user has specific permissions
   */
  async checkAccess(userId: string, requiredPermissions: string[]): Promise<AccessCheck> {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      const hasAccess = this.hasPermissions(userPermissions.effectivePermissions, requiredPermissions);
      
      if (hasAccess) {
        return { hasAccess: true };
      }

      const missingPermissions = requiredPermissions.filter(
        permission => !this.hasPermission(userPermissions.effectivePermissions, permission)
      );

      return {
        hasAccess: false,
        reason: `Missing required permissions: ${missingPermissions.join(', ')}`,
        requiredPermissions,
        userPermissions: userPermissions.effectivePermissions,
        missingPermissions
      };
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to check access',
        'ACCESS_CHECK_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'access_check',
          userId,
          requiredPermissions
        }
      );
    }
  }

  /**
   * Initialize system roles for organization
   */
  async initializeSystemRoles(): Promise<void> {
    try {
      await this.apiClient.post('/api/v1/rbac/initialize-system-roles');
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to initialize system roles',
        'SYSTEM_ROLES_INIT_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { operation: 'system_roles_initialization' }
      );
    }
  }

  /**
   * Map role response from API
   */
  private mapRoleResponse(data: any): Role {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      permissions: data.permissions || [],
      level: data.level,
      isSystem: data.isSystem || false,
      isActive: data.isActive !== false,
      organizationId: data.organizationId,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    };
  }

  /**
   * Map user role response from API
   */
  private mapUserRoleResponse(data: any): UserRole {
    return {
      id: data.id,
      userId: data.userId,
      roleId: data.roleId,
      role: this.mapRoleResponse(data.role),
      assignedAt: new Date(data.assignedAt || data.createdAt),
      assignedBy: data.assignedBy,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      isActive: data.isActive !== false,
      scope: data.scope
    };
  }

  /**
   * Validate role creation request
   */
  private validateRoleRequest(request: CreateRoleRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new AxonPulsError(
        'Role name is required',
        'ROLE_NAME_REQUIRED',
        400,
        null,
        { operation: 'role_validation' }
      );
    }

    if (request.name.length > 100) {
      throw new AxonPulsError(
        'Role name cannot exceed 100 characters',
        'ROLE_NAME_TOO_LONG',
        400,
        { maxLength: 100 },
        { operation: 'role_validation' }
      );
    }

    this.validatePermissions(request.permissions);
  }

  /**
   * Validate permissions array
   */
  private validatePermissions(permissions: string[]): void {
    if (!Array.isArray(permissions)) {
      throw new AxonPulsError(
        'Permissions must be an array',
        'INVALID_PERMISSIONS_FORMAT',
        400,
        null,
        { operation: 'permission_validation' }
      );
    }

    if (permissions.length === 0) {
      throw new AxonPulsError(
        'At least one permission is required',
        'PERMISSIONS_REQUIRED',
        400,
        null,
        { operation: 'permission_validation' }
      );
    }

    // Validate permission format
    const invalidPermissions = permissions.filter(permission => 
      !this.isValidPermissionFormat(permission)
    );

    if (invalidPermissions.length > 0) {
      throw new AxonPulsError(
        'Invalid permission format',
        'INVALID_PERMISSION_FORMAT',
        400,
        { invalidPermissions },
        { operation: 'permission_validation' }
      );
    }
  }

  /**
   * Check if permission format is valid
   */
  private isValidPermissionFormat(permission: string): boolean {
    // Permission format: resource:action or *:* for wildcards
    const permissionRegex = /^[a-zA-Z_*]+:[a-zA-Z_*]+$/;
    return permissionRegex.test(permission);
  }

  /**
   * Check if user has specific permission
   */
  private hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    // Check exact match
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // Check wildcard permissions
    if (userPermissions.includes('*:*')) {
      return true;
    }

    // Check resource wildcard
    const [resource, action] = requiredPermission.split(':');
    if (userPermissions.includes(`${resource}:*`)) {
      return true;
    }

    // Check action wildcard
    if (userPermissions.includes(`*:${action}`)) {
      return true;
    }

    return false;
  }

  /**
   * Check if user has all required permissions
   */
  private hasPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
    return requiredPermissions.every(permission => 
      this.hasPermission(userPermissions, permission)
    );
  }

  /**
   * Calculate effective permissions including wildcards
   */
  private calculateEffectivePermissions(permissions: string[]): string[] {
    const effective = new Set(permissions);

    // If user has *:*, they have all permissions
    if (permissions.includes('*:*')) {
      effective.add('*:*');
    }

    return Array.from(effective);
  }

  /**
   * Calculate highest role level
   */
  private calculateRoleLevel(roles: any[]): 'SUPER_ADMIN' | 'ORG_ADMIN' | 'DEVELOPER' | 'VIEWER' {
    const levels = ['VIEWER', 'DEVELOPER', 'ORG_ADMIN', 'SUPER_ADMIN'];
    let highestLevel = 'VIEWER';

    for (const role of roles) {
      const roleLevel = role.level || 'VIEWER';
      if (levels.indexOf(roleLevel) > levels.indexOf(highestLevel)) {
        highestLevel = roleLevel;
      }
    }

    return highestLevel as any;
  }

  /**
   * Categorize permissions by resource
   */
  private categorizePermissions(permissions: string[]): { [category: string]: string[] } {
    const categories: { [category: string]: string[] } = {};

    for (const permission of permissions) {
      const [resource] = permission.split(':');
      if (!categories[resource]) {
        categories[resource] = [];
      }
      categories[resource].push(permission);
    }

    return categories;
  }

  /**
   * Get permission descriptions
   */
  private getPermissionDescriptions(permissions: string[]): { [permission: string]: string } {
    const descriptions: { [permission: string]: string } = {};

    for (const permission of permissions) {
      const [resource, action] = permission.split(':');
      descriptions[permission] = `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource} resources`;
    }

    return descriptions;
  }
}
