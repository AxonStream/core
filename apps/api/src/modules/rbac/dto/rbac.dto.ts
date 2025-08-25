import { IsString, IsArray, IsOptional, IsEnum, IsBoolean, IsDateString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RoleLevel {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  DEVELOPER = 'DEVELOPER',
  VIEWER = 'VIEWER',
}

export class CreateRoleDto {
  @ApiProperty({ description: 'Role name', example: 'Content Manager' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Role description', example: 'Manages content and publications' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ 
    description: 'Array of permission strings', 
    example: ['content:create', 'content:read', 'content:update'] 
  })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  @ApiProperty({ 
    description: 'Role hierarchy level', 
    enum: RoleLevel,
    example: RoleLevel.DEVELOPER 
  })
  @IsEnum(RoleLevel)
  level: RoleLevel;

  @ApiPropertyOptional({ 
    description: 'Whether this is a system role (cannot be deleted)', 
    example: false 
  })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: 'Role name', example: 'Content Manager' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Role description', example: 'Manages content and publications' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Array of permission strings', 
    example: ['content:create', 'content:read', 'content:update'] 
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ 
    description: 'Role hierarchy level', 
    enum: RoleLevel,
    example: RoleLevel.DEVELOPER 
  })
  @IsOptional()
  @IsEnum(RoleLevel)
  level?: RoleLevel;
}

export class AssignRoleDto {
  @ApiProperty({ description: 'Role ID to assign', example: 'role_123' })
  @IsString()
  roleId: string;

  @ApiPropertyOptional({
    description: 'Role assignment expiration date (ISO string)',
    example: '2024-12-31T23:59:59.999Z'
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;

  @ApiPropertyOptional({ 
    description: 'Optional scope for role assignment (e.g., specific projects)', 
    example: { projects: ['project1', 'project2'] } 
  })
  @IsOptional()
  @IsObject()
  scope?: Record<string, any>;
}

export class RoleResponseDto {
  @ApiProperty({ description: 'Role ID', example: 'role_123' })
  id: string;

  @ApiProperty({ description: 'Role name', example: 'Content Manager' })
  name: string;

  @ApiPropertyOptional({ description: 'Role description', example: 'Manages content and publications' })
  description?: string;

  @ApiProperty({ 
    description: 'Array of permission strings', 
    example: ['content:create', 'content:read', 'content:update'] 
  })
  permissions: string[];

  @ApiProperty({ 
    description: 'Role hierarchy level', 
    enum: RoleLevel,
    example: RoleLevel.DEVELOPER 
  })
  level: RoleLevel;

  @ApiProperty({ description: 'Whether this is a system role', example: false })
  isSystem: boolean;

  @ApiProperty({ description: 'Whether this role is active', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Role creation date', example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Role last update date', example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ description: 'Organization ID', example: 'org_123' })
  organizationId: string;

  @ApiPropertyOptional({ description: 'Number of users with this role', example: 5 })
  userCount?: number;
}

export class UserRolesResponseDto {
  @ApiProperty({ 
    description: 'Array of role names assigned to user', 
    example: ['Developer', 'Content Manager'] 
  })
  roles: string[];

  @ApiProperty({ 
    description: 'Array of permissions granted to user', 
    example: ['content:create', 'content:read', 'api:read'] 
  })
  permissions: string[];
}

export class SystemPermissionsResponseDto {
  @ApiProperty({ 
    description: 'Array of available system permissions', 
    example: ['user:create', 'user:read', 'role:create', 'content:*'] 
  })
  permissions: string[];
}
