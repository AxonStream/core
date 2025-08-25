import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { RequirePermissions, RequireRoleLevel } from '../../common/decorators/roles.decorator';
import { RBACService } from './rbac.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
  RoleResponseDto,
  UserRolesResponseDto,
  SystemPermissionsResponseDto
} from './dto/rbac.dto';
import { TenantIsolationMiddleware } from '../../common/middleware/tenant-isolation.middleware';

@ApiTags('rbac')
@Controller('rbac')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RBACController {
  constructor(private rbacService: RBACService) {}

  @Post('roles')
  @RequirePermissions('role:create')
  @RequireRoleLevel('ORG_ADMIN')
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Role name already exists' })
  async createRole(@Request() req: any, @Body() createRoleDto: CreateRoleDto) {
    const context = req.tenantContext;
    return await this.rbacService.createRole(context, createRoleDto);
  }

  @Get('roles')
  @ApiOperation({ summary: 'Get all roles for the organization' })
  @ApiQuery({ name: 'includeUserCount', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Roles retrieved successfully' })
  async getRoles(
    @Request() req: any,
    @Query('includeUserCount') includeUserCount?: boolean
  ) {
    const context = req.tenantContext;
    return await this.rbacService.getRoles(context, includeUserCount === true);
  }

  @Get('roles/:roleId')
  @ApiOperation({ summary: 'Get a specific role by ID' })
  @ApiResponse({ status: 200, description: 'Role retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async getRole(@Request() req: any, @Param('roleId') roleId: string) {
    const context = req.tenantContext;
    return await this.rbacService.getRole(context, roleId);
  }

  @Put('roles/:roleId')
  @RequirePermissions('role:update')
  @RequireRoleLevel('ORG_ADMIN')
  @ApiOperation({ summary: 'Update a role' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 403, description: 'Cannot modify system roles' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async updateRole(
    @Request() req: any,
    @Param('roleId') roleId: string,
    @Body() updateData: UpdateRoleDto
  ) {
    const context = req.tenantContext;
    return await this.rbacService.updateRole(context, roleId, updateData);
  }

  @Delete('roles/:roleId')
  @RequirePermissions('role:delete')
  @RequireRoleLevel('ORG_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role' })
  @ApiResponse({ status: 204, description: 'Role deleted successfully' })
  @ApiResponse({ status: 403, description: 'Cannot delete system roles or roles in use' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async deleteRole(@Request() req: any, @Param('roleId') roleId: string) {
    const context = req.tenantContext;
    await this.rbacService.deleteRole(context, roleId);
  }

  @Post('users/:userId/roles')
  @RequirePermissions('role:assign')
  @RequireRoleLevel('ORG_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a role to a user' })
  @ApiResponse({ status: 201, description: 'Role assigned successfully' })
  @ApiResponse({ status: 404, description: 'User or role not found' })
  @ApiResponse({ status: 409, description: 'Role already assigned to user' })
  async assignRole(
    @Request() req: any,
    @Param('userId') userId: string,
    @Body() assignRoleDto: Omit<AssignRoleDto, 'userId'>
  ) {
    const context = req.tenantContext;
    const assignData = {
      ...assignRoleDto,
      userId,
      expiresAt: assignRoleDto.expiresAt ? new Date(assignRoleDto.expiresAt) : undefined,
    };
    await this.rbacService.assignRole(context, assignData);
  }

  @Delete('users/:userId/roles/:roleId')
  @RequirePermissions('role:assign')
  @RequireRoleLevel('ORG_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a role from a user' })
  @ApiResponse({ status: 204, description: 'Role removed successfully' })
  @ApiResponse({ status: 404, description: 'Role assignment not found' })
  async removeRole(
    @Request() req: any,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string
  ) {
    const context = req.tenantContext;
    await this.rbacService.removeRole(context, userId, roleId);
  }

  @Get('users/:userId/roles')
  @ApiOperation({ summary: 'Get user roles and permissions' })
  @ApiResponse({ status: 200, description: 'User roles and permissions retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserRolesAndPermissions(
    @Request() req: any,
    @Param('userId') userId: string
  ) {
    const context = req.tenantContext;
    return await this.rbacService.getUserRolesAndPermissions(context, userId);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Get available system permissions' })
  @ApiResponse({ status: 200, description: 'System permissions retrieved successfully' })
  async getSystemPermissions() {
    return {
      permissions: this.rbacService.getSystemPermissions(),
    };
  }

  @Post('initialize-system-roles')
  @RequireRoleLevel('SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initialize default system roles for organization' })
  @ApiResponse({ status: 201, description: 'System roles initialized successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async initializeSystemRoles(@Request() req: any) {
    const context = req.tenantContext;
    await this.rbacService.initializeSystemRoles(context.organizationId, context.userId);
    return { message: 'System roles initialized successfully' };
  }
}
