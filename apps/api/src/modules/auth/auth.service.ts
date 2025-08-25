import { Injectable, UnauthorizedException, Logger, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/services/prisma.service';
import { User, Organization } from '@prisma/client';

import { LoginDto, RegisterDto } from './dto';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  organizationId: string;
  organizationSlug: string;
  roles?: string[];
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  user: Omit<User, 'passwordHash' | 'passwordResetToken' | 'emailVerificationToken'>;
  organization: Organization;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  async validateUser(email: string, password: string, organizationSlug?: string): Promise<any> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          organization: true,
        },
      });

      if (!user) {
        return null;
      }

      // Check if user is locked due to failed attempts
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new UnauthorizedException('Account is temporarily locked due to too many failed login attempts');
      }

      // If organization slug is provided, validate it matches
      if (organizationSlug && user.organization.slug !== organizationSlug) {
        return null;
      }

      // Validate password against stored hash
      const isPasswordValid = await this.validatePassword(password, user.passwordHash);

      if (!isPasswordValid) {
        // Increment failed login attempts
        await this.handleFailedLogin(user.id);
        return null;
      }

      // Reset failed login attempts on successful login
      if (user.failedLoginAttempts > 0) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });
      }

      const { passwordHash, ...result } = user;
      return result;
    } catch (error) {
      this.logger.error('Error validating user:', error);
      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResult> {
    const { email, password, organizationSlug } = loginDto;

    const user = await this.validateUser(email, password, organizationSlug);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Get user roles and permissions for JWT
    const userRolesData = await this.getUserRolesAndPermissions(user.id, user.organizationId);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      organizationSlug: user.organization.slug,
      roles: userRolesData.roles,
      permissions: userRolesData.permissions,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('auth.refresh.secret'),
      expiresIn: this.configService.get<string>('auth.refresh.expiresIn'),
    });

    return {
      user: this.excludePassword(user),
      organization: user.organization,
      accessToken,
      refreshToken,
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthResult> {
    const { email, password, firstName, lastName, organizationName, organizationSlug } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Check if organization slug is available
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (existingOrg) {
      throw new ConflictException('Organization slug is already taken');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    try {
      // Create organization and user in a transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create organization
        const organization = await prisma.organization.create({
          data: {
            name: organizationName,
            slug: organizationSlug,
            description: `${organizationName} organization`,
          },
        });

        // Create user with hashed password
        const user = await prisma.user.create({
          data: {
            email,
            firstName,
            lastName,
            passwordHash: hashedPassword,
            organizationId: organization.id,
            isEmailVerified: false, // In production, implement email verification
          },
          include: {
            organization: true,
          },
        });

        return { user, organization };
      });

      // Initialize system roles for new organization
      await this.initializeSystemRoles(result.organization.id, result.user.id);

      // Assign default role to the user (organization admin for first user)
      await this.assignDefaultRole(result.user.id, result.organization.id);

      // Get user roles and permissions for JWT
      const userRolesData = await this.getUserRolesAndPermissions(result.user.id, result.organization.id);

      const payload: JwtPayload = {
        sub: result.user.id,
        email: result.user.email,
        organizationId: result.user.organizationId,
        organizationSlug: result.organization.slug,
        roles: userRolesData.roles,
        permissions: userRolesData.permissions,
      };

      const accessToken = this.generateAccessToken(payload);
      const refreshToken = this.jwtService.sign(payload, {
        secret: this.configService.get<string>('auth.refresh.secret'),
        expiresIn: this.configService.get<string>('auth.refresh.expiresIn'),
      });

      return {
        user: this.excludePassword(result.user),
        organization: result.organization,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      this.logger.error('Error during registration:', error);
      // Re-throw with more specific error message for debugging
      if (error.code === 'P2002') {
        throw new ConflictException(`Unique constraint failed: ${error.meta?.target || 'unknown field'}`);
      }
      throw new ConflictException(`Registration failed: ${error.message || error}`);
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('auth.refresh.secret'),
      });

      // Verify user still exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { organization: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get updated user roles and permissions for JWT
      const userRolesData = await this.getUserRolesAndPermissions(user.id, user.organizationId);

      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        organizationId: user.organizationId,
        organizationSlug: user.organization.slug,
        roles: userRolesData.roles,
        permissions: userRolesData.permissions,
      };

      const accessToken = this.jwtService.sign(newPayload, {
        privateKey: this.configService.get<string>('auth.jwt.privateKey'),
        algorithm: 'RS256',
      });

      return { accessToken };
    } catch (error) {
      this.logger.error('Error refreshing token:', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { organization: true },
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });
  }

  // JWT Token Generation
  private generateAccessToken(payload: JwtPayload): string {
    const algorithm = this.configService.get<string>('auth.jwt.algorithm');
    const privateKey = this.configService.get<string>('auth.jwt.privateKey');
    const secret = this.configService.get<string>('auth.jwt.secret');
    const expiresIn = this.configService.get<string>('auth.jwt.expiresIn');

    if (algorithm === 'RS256') {
      if (!privateKey) {
        throw new Error('JWT private key is required for RS256 algorithm');
      }

      return this.jwtService.sign(payload, {
        privateKey,
        algorithm: 'RS256',
        expiresIn,
        issuer: this.configService.get<string>('auth.jwt.issuer'),
        audience: this.configService.get<string>('auth.jwt.audience'),
      });
    } else {
      // Fallback to HS256 for development
      if (!secret) {
        throw new Error('JWT secret is required for HS256 algorithm');
      }

      return this.jwtService.sign(payload, {
        secret,
        algorithm: 'HS256',
        expiresIn,
        issuer: this.configService.get<string>('auth.jwt.issuer'),
        audience: this.configService.get<string>('auth.jwt.audience'),
      });
    }
  }

  // Helper methods
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = this.configService.get<number>('auth.bcrypt.saltRounds');
    return bcrypt.hash(password, saltRounds);
  }

  private async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    if (!hashedPassword) {
      return false;
    }
    return bcrypt.compare(password, hashedPassword);
  }

  private excludePassword(user: any): Omit<User, 'passwordHash' | 'passwordResetToken' | 'emailVerificationToken'> {
    const { passwordHash, passwordResetToken, emailVerificationToken, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  private async handleFailedLogin(userId: string): Promise<void> {
    const maxAttempts = 5;
    const lockoutDuration = 15 * 60 * 1000; // 15 minutes

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginAttempts: true },
    });

    const newAttempts = (user?.failedLoginAttempts || 0) + 1;
    const updateData: any = { failedLoginAttempts: newAttempts };

    if (newAttempts >= maxAttempts) {
      updateData.lockedUntil = new Date(Date.now() + lockoutDuration);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  // Multi-tenant helper
  async validateUserInOrganization(userId: string, organizationId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
        isActive: true,
      },
    });

    return !!user;
  }

  private async getUserRolesAndPermissions(userId: string, organizationId: string): Promise<{ roles: string[], permissions: string[] }> {
    const userRoles = await this.prisma.userRole.findMany({
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

    const roles = userRoles.map(ur => ur.role.name);
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

  private async initializeSystemRoles(organizationId: string, createdBy: string): Promise<void> {
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
        await this.prisma.role.create({
          data: {
            ...roleData,
            organizationId,
            createdBy,
          },
        });
      } catch (error) {
        // Role might already exist, continue with next role
        this.logger.debug(`System role '${roleData.name}' already exists for organization ${organizationId}`);
      }
    }
  }

  private async assignDefaultRole(userId: string, organizationId: string): Promise<void> {
    try {
      // Find the Organization Admin role
      const orgAdminRole = await this.prisma.role.findFirst({
        where: {
          name: 'Organization Admin',
          organizationId,
          isSystem: true,
        },
      });

      if (orgAdminRole) {
        await this.prisma.userRole.create({
          data: {
            userId,
            roleId: orgAdminRole.id,
            assignedBy: userId, // Self-assigned for first user
          },
        });
        this.logger.log(`Default Organization Admin role assigned to user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to assign default role: ${error.message}`);
    }
  }
}
