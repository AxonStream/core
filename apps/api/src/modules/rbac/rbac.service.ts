import { Injectable, Logger, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { TenantAwareService, TenantContext } from '../../common/services/tenant-aware.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface CreateRoleDto {
  name: string;
  description?: string;
  permissions: string[];
  level: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'DEVELOPER' | 'VIEWER';
  isSystem?: boolean;
}

export interface AssignRoleDto {
  userId: string;
  roleId: string;
  expiresAt?: Date;
  scope?: Record<string, any>;
}

export interface RoleWithPermissions {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  level: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
  userCount?: number;
}

@Injectable()
export class RBACService {
  private readonly logger = new Logger(RBACService.name);

  // Default system permissions for each module
  private readonly systemPermissions = [
    // User management
    'user:create', 'user:read', 'user:update', 'user:delete',
    // Role management
    'role:create', 'role:read', 'role:update', 'role:delete',
    // Organization management
    'organization:read', 'organization:update', 'organization:delete',
    // API connections
    'connection:create', 'connection:read', 'connection:update', 'connection:delete',
    // Events
    'event:create', 'event:read', 'event:update', 'event:delete',
    // Channels
    'channel:create', 'channel:read', 'channel:update', 'channel:delete',
    // Subscriptions
    'subscription:create', 'subscription:read', 'subscription:update', 'subscription:delete',
    // Audit logs
    'audit:read',
    // Analytics
    'analytics:read',
    // Billing
    'billing:read', 'billing:update',
    // Magic collaborative features
    'magic:create', 'magic:read', 'magic:update', 'magic:delete',
    'magic:timetravel', 'magic:branch', 'magic:merge',
    'magic:admin', 'magic:presence',
    // System administration
    'system:admin',
    // Wildcard permissions
    '*:*', '*:read', '*:write',
  ];

  constructor(
    private prismaService: PrismaService,
    private tenantAwareService: TenantAwareService,
    private eventEmitter: EventEmitter2,
  ) { }

  /**
   * Create a new role within an organization
   */
  async createRole(context: TenantContext, createRoleDto: CreateRoleDto): Promise<RoleWithPermissions> {
    // Validate permissions
    await this.validatePermissions(createRoleDto.permissions);

    // Check if role name already exists in organization
    const existingRole = await this.prismaService.role.findFirst({
      where: {
        name: createRoleDto.name,
        organizationId: context.organizationId,
      },
    });

    if (existingRole) {
      throw new ConflictException(`Role '${createRoleDto.name}' already exists in this organization`);
    }

    try {
      const role = await this.prismaService.role.create({
        data: {
          name: createRoleDto.name,
          description: createRoleDto.description,
          permissions: createRoleDto.permissions,
          level: createRoleDto.level,
          isSystem: createRoleDto.isSystem || false,
          organizationId: context.organizationId,
          createdBy: context.userId,
        },
      });

      // Log audit event
      await this.tenantAwareService.logAuditEvent(
        context,
        'CREATE',
        'Role',
        role.id,
        null,
        role
      );

      // Emit event
      this.eventEmitter.emit('role.created', {
        organizationId: context.organizationId,
        roleId: role.id,
        roleName: role.name,
        createdBy: context.userId,
      });

      this.logger.log(`Role '${role.name}' created in organization ${context.organizationId}`);

      return this.mapRoleToDto(role);
    } catch (error) {
      this.logger.error(`Failed to create role: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all roles for an organization
   */
  async getRoles(context: TenantContext, includeUserCount = false): Promise<RoleWithPermissions[]> {
    const roles = await this.prismaService.role.findMany({
      where: {
        organizationId: context.organizationId,
        isActive: true,
      },
      include: includeUserCount ? {
        _count: {
          select: {
            userRoles: {
              where: {
                isActive: true,
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } }
                ]
              }
            }
          }
        }
      } : undefined,
      orderBy: [
        { level: 'desc' },
        { name: 'asc' }
      ],
    });

    return roles.map(role => ({
      ...this.mapRoleToDto(role),
      userCount: includeUserCount ? role._count?.userRoles : undefined,
    }));
  }

  /**
   * Get a specific role by ID
   */
  async getRole(context: TenantContext, roleId: string): Promise<RoleWithPermissions> {
    const role = await this.prismaService.role.findFirst({
      where: {
        id: roleId,
        organizationId: context.organizationId,
        isActive: true,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return this.mapRoleToDto(role);
  }

  /**
   * Update a role
   */
  async updateRole(
    context: TenantContext,
    roleId: string,
    updateData: Partial<CreateRoleDto>
  ): Promise<RoleWithPermissions> {
    const existingRole = await this.getRole(context, roleId);

    if (existingRole.isSystem) {
      throw new ForbiddenException('Cannot modify system roles');
    }

    if (updateData.permissions) {
      await this.validatePermissions(updateData.permissions);
    }

    // Check for name conflicts if name is being updated
    if (updateData.name && updateData.name !== existingRole.name) {
      const nameConflict = await this.prismaService.role.findFirst({
        where: {
          name: updateData.name,
          organizationId: context.organizationId,
          id: { not: roleId },
        },
      });

      if (nameConflict) {
        throw new ConflictException(`Role '${updateData.name}' already exists in this organization`);
      }
    }

    try {
      const updatedRole = await this.prismaService.role.update({
        where: { id: roleId },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });

      // Log audit event
      await this.tenantAwareService.logAuditEvent(
        context,
        'UPDATE',
        'Role',
        roleId,
        existingRole,
        updatedRole
      );

      // Emit event
      this.eventEmitter.emit('role.updated', {
        organizationId: context.organizationId,
        roleId,
        roleName: updatedRole.name,
        updatedBy: context.userId,
      });

      this.logger.log(`Role '${updatedRole.name}' updated in organization ${context.organizationId}`);

      return this.mapRoleToDto(updatedRole);
    } catch (error) {
      this.logger.error(`Failed to update role: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a role (soft delete)
   */
  async deleteRole(context: TenantContext, roleId: string): Promise<void> {
    const role = await this.getRole(context, roleId);

    if (role.isSystem) {
      throw new ForbiddenException('Cannot delete system roles');
    }

    // Check if role is assigned to any users
    const assignedUsers = await this.prismaService.userRole.count({
      where: {
        roleId,
        isActive: true,
      },
    });

    if (assignedUsers > 0) {
      throw new ForbiddenException(`Cannot delete role '${role.name}' as it is assigned to ${assignedUsers} user(s)`);
    }

    try {
      await this.prismaService.role.update({
        where: { id: roleId },
        data: { isActive: false },
      });

      // Log audit event
      await this.tenantAwareService.logAuditEvent(
        context,
        'DELETE',
        'Role',
        roleId,
        role,
        null
      );

      // Emit event
      this.eventEmitter.emit('role.deleted', {
        organizationId: context.organizationId,
        roleId,
        roleName: role.name,
        deletedBy: context.userId,
      });

      this.logger.log(`Role '${role.name}' deleted in organization ${context.organizationId}`);
    } catch (error) {
      this.logger.error(`Failed to delete role: ${error.message}`);
      throw error;
    }
  }

  /**
   * Assign a role to a user
   */
  async assignRole(context: TenantContext, assignRoleDto: AssignRoleDto): Promise<void> {
    const { userId, roleId, expiresAt, scope } = assignRoleDto;

    // Validate role exists and belongs to organization
    const role = await this.getRole(context, roleId);

    // Validate user exists and belongs to organization
    const user = await this.prismaService.user.findFirst({
      where: {
        id: userId,
        organizationId: context.organizationId,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this organization');
    }

    // Check if assignment already exists
    const existingAssignment = await this.prismaService.userRole.findFirst({
      where: {
        userId,
        roleId,
        isActive: true,
      },
    });

    if (existingAssignment) {
      throw new ConflictException('User already has this role assigned');
    }

    try {
      await this.prismaService.userRole.create({
        data: {
          userId,
          roleId,
          assignedBy: context.userId,
          expiresAt,
          scope,
        },
      });

      // Log audit event
      await this.tenantAwareService.logAuditEvent(
        context,
        'ASSIGN_ROLE',
        'UserRole',
        `${userId}:${roleId}`,
        null,
        { userId, roleId, roleName: role.name, expiresAt, scope }
      );

      // Emit event
      this.eventEmitter.emit('role.assigned', {
        organizationId: context.organizationId,
        userId,
        roleId,
        roleName: role.name,
        assignedBy: context.userId,
      });

      this.logger.log(`Role '${role.name}' assigned to user ${userId} in organization ${context.organizationId}`);
    } catch (error) {
      this.logger.error(`Failed to assign role: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a role from a user
   */
  async removeRole(context: TenantContext, userId: string, roleId: string): Promise<void> {
    const assignment = await this.prismaService.userRole.findFirst({
      where: {
        userId,
        roleId,
        isActive: true,
      },
      include: {
        role: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Role assignment not found');
    }

    try {
      await this.prismaService.userRole.update({
        where: { id: assignment.id },
        data: { isActive: false },
      });

      // Log audit event
      await this.tenantAwareService.logAuditEvent(
        context,
        'REMOVE_ROLE',
        'UserRole',
        assignment.id,
        assignment,
        null
      );

      // Emit event
      this.eventEmitter.emit('role.removed', {
        organizationId: context.organizationId,
        userId,
        roleId,
        roleName: assignment.role.name,
        removedBy: context.userId,
      });

      this.logger.log(`Role '${assignment.role.name}' removed from user ${userId} in organization ${context.organizationId}`);
    } catch (error) {
      this.logger.error(`Failed to remove role: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's roles and permissions
   */
  async getUserRolesAndPermissions(context: TenantContext, userId: string) {
    const userRoles = await this.prismaService.userRole.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ],
        role: {
          organizationId: context.organizationId,
          isActive: true,
        }
      },
      include: {
        role: true,
      },
    });

    const roles = userRoles.map(ur => this.mapRoleToDto(ur.role));
    const permissions = new Set<string>();

    for (const userRole of userRoles) {
      for (const permission of userRole.role.permissions) {
        permissions.add(permission);
      }
    }

    return {
      roles,
      permissions: Array.from(permissions),
    };
  }

  /**
   * Initialize default system roles for an organization
   */
  async initializeSystemRoles(organizationId: string, createdBy?: string): Promise<void> {
    const defaultRoles = [
      {
        name: 'Super Admin',
        description: 'Full system access with all permissions',
        permissions: ['*:*'],
        level: 'SUPER_ADMIN' as const,
        isSystem: true,
      },
      {
        name: 'Organization Admin',
        description: 'Full organization management access',
        permissions: [
          'user:*', 'role:*', 'organization:*', 'connection:*',
          'event:*', 'channel:*', 'subscription:*', 'audit:read',
          'analytics:read', 'billing:*'
        ],
        level: 'ORG_ADMIN' as const,
        isSystem: true,
      },
      {
        name: 'Developer',
        description: 'Development and integration access',
        permissions: [
          'connection:*', 'event:*', 'channel:*', 'subscription:*',
          'user:read', 'analytics:read'
        ],
        level: 'DEVELOPER' as const,
        isSystem: true,
      },
      {
        name: 'Viewer',
        description: 'Read-only access to basic resources',
        permissions: [
          'connection:read', 'event:read', 'channel:read',
          'subscription:read', 'user:read'
        ],
        level: 'VIEWER' as const,
        isSystem: true,
      },
    ];

    for (const roleData of defaultRoles) {
      try {
        await this.prismaService.role.create({
          data: {
            ...roleData,
            organizationId,
            createdBy,
          },
        });
        this.logger.log(`System role '${roleData.name}' created for organization ${organizationId}`);
      } catch (error) {
        // Role might already exist, continue with next role
        this.logger.debug(`System role '${roleData.name}' already exists for organization ${organizationId}`);
      }
    }
  }

  /**
   * Get available system permissions
   */
  getSystemPermissions(): string[] {
    return [...this.systemPermissions];
  }

  private async validatePermissions(permissions: string[]): Promise<void> {
    const invalidPermissions = permissions.filter(
      permission => !this.systemPermissions.includes(permission) && !this.isValidPermissionFormat(permission)
    );

    if (invalidPermissions.length > 0) {
      throw new ForbiddenException(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }
  }

  private isValidPermissionFormat(permission: string): boolean {
    // Allow custom permissions in format "resource:action"
    const permissionRegex = /^[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z_*][a-zA-Z0-9_*]*$/;
    return permissionRegex.test(permission);
  }

  private mapRoleToDto(role: any): RoleWithPermissions {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      level: role.level,
      isSystem: role.isSystem,
      isActive: role.isActive,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      organizationId: role.organizationId,
    };
  }
}
