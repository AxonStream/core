import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Multi-Tenant Isolation Interfaces
 */
export interface TenantContext {
  organizationId: string;
  organizationSlug: string;
  userId?: string;
  userRole?: string;
  permissions?: string[];
  metadata?: Record<string, any>;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  encryptionKey?: string;
  features?: string[];
  quotas?: TenantLimits;
  isEncrypted?: boolean;
  roles?: string[];
}

export interface TenantResource {
  id: string;
  organizationId: string;
  resourceType: string;
  permissions?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface TenantLimits {
  maxUsers: number;
  maxConnections: number;
  maxEvents: number;
  maxChannels: number;
  maxStorage: number; // in bytes
  maxApiCalls: number; // per hour
  features: string[];
}

export interface TenantUsage {
  users: number;
  connections: number;
  events: number;
  channels: number;
  storage: number;
  apiCalls: number;
  lastUpdated: Date;
}

export interface TenantIsolationConfig {
  enableStrictIsolation: boolean;
  enableResourceLimits: boolean;
  enableAuditLogging: boolean;
  enableDataEncryption: boolean;
  enableRoleBasedAccess: boolean;
  enableSessionManagement: boolean;
  enableRealTimeMonitoring: boolean;
  defaultLimits: TenantLimits;
  encryptionConfig: EncryptionConfig;
  auditConfig: AuditConfig;
}

export interface EncryptionConfig {
  algorithm: string;
  keyRotationDays: number;
  enableFieldLevelEncryption: boolean;
  encryptedFields: string[];
}

export interface AuditConfig {
  enableRealTimeAuditing: boolean;
  retentionDays: number;
  enableComplianceReports: boolean;
  sensitiveOperations: string[];
  auditLevels: string[];
}

export interface TenantSecurityContext {
  tenantContext: TenantContext;
  securityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  encryptionRequired: boolean;
  auditRequired: boolean;
  accessRestrictions: string[];
  complianceRequirements: string[];
}

export interface RolePermission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
  scope?: 'ORGANIZATION' | 'USER' | 'RESOURCE';
}

export interface TenantAccessLog {
  id: string;
  organizationId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  success: boolean;
  error?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class TenantAwareService {
  private readonly logger = new Logger(TenantAwareService.name);
  private readonly config: TenantIsolationConfig;
  private tenantLimitsCache = new Map<string, TenantLimits>();
  private tenantUsageCache = new Map<string, TenantUsage>();

  constructor(
    private prismaService: PrismaService,
    private redisService: RedisService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private jwtService: JwtService,
  ) {
    this.config = {
      enableStrictIsolation: this.configService.get<boolean>('tenant.strictIsolation', true),
      enableResourceLimits: this.configService.get<boolean>('tenant.resourceLimits', true),
      enableAuditLogging: this.configService.get<boolean>('tenant.auditLogging', true),
      enableDataEncryption: this.configService.get<boolean>('tenant.dataEncryption', false),
      enableRoleBasedAccess: this.configService.get<boolean>('tenant.roleBasedAccess', true),
      enableSessionManagement: this.configService.get<boolean>('tenant.sessionManagement', true),
      enableRealTimeMonitoring: this.configService.get<boolean>('tenant.realTimeMonitoring', true),
      defaultLimits: {
        maxUsers: this.configService.get<number>('tenant.limits.maxUsers', 100),
        maxConnections: this.configService.get<number>('tenant.limits.maxConnections', 1000),
        maxEvents: this.configService.get<number>('tenant.limits.maxEvents', 10000),
        maxChannels: this.configService.get<number>('tenant.limits.maxChannels', 50),
        maxStorage: this.configService.get<number>('tenant.limits.maxStorage', 1073741824), // 1GB
        maxApiCalls: this.configService.get<number>('tenant.limits.maxApiCalls', 10000),
        features: this.configService.get<string[]>('tenant.limits.features', ['basic']),
      },
      encryptionConfig: {
        algorithm: this.configService.get<string>('tenant.encryption.algorithm', 'AES-256-GCM'),
        keyRotationDays: this.configService.get<number>('tenant.encryption.keyRotationDays', 90),
        enableFieldLevelEncryption: this.configService.get<boolean>('tenant.encryption.fieldLevel', false),
        encryptedFields: this.configService.get<string[]>('tenant.encryption.fields', []),
      },
      auditConfig: {
        enableRealTimeAuditing: this.configService.get<boolean>('tenant.audit.realTime', true),
        retentionDays: this.configService.get<number>('tenant.audit.retentionDays', 365),
        enableComplianceReports: this.configService.get<boolean>('tenant.audit.compliance', true),
        sensitiveOperations: this.configService.get<string[]>('tenant.audit.sensitiveOps', ['DELETE', 'UPDATE', 'CREATE']),
        auditLevels: this.configService.get<string[]>('tenant.audit.levels', ['HIGH', 'CRITICAL']),
      },
    };
  }

  // ============================================================================
  // TENANT CONTEXT MANAGEMENT
  // ============================================================================

  async validateTenantContext(context: TenantContext): Promise<boolean> {
    try {
      // Verify organization exists
      const organization = await this.prismaService.organization.findUnique({
        where: { id: context.organizationId },
        select: { id: true, slug: true },
      });

      if (!organization) {
        throw new ForbiddenException('Organization not found');
      }

      // Verify user belongs to organization if userId provided
      if (context.userId) {
        const user = await this.prismaService.user.findFirst({
          where: {
            id: context.userId,
            organizationId: context.organizationId,
          },
          select: { id: true },
        });

        if (!user) {
          throw new ForbiddenException('User not found in organization');
        }

        // Set default role since role field doesn't exist in schema
        context.userRole = 'user';
      }

      return true;
    } catch (error) {
      this.logger.error(`Tenant context validation failed: ${error.message}`);
      throw error;
    }
  }

  async createTenantContext(
    organizationId: string,
    userId?: string,
    additionalPermissions?: string[]
  ): Promise<TenantContext> {
    const organization = await this.prismaService.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, slug: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    let userRole: string | undefined;
    let permissions: string[] = [];

    if (userId) {
      const user = await this.prismaService.user.findFirst({
        where: { id: userId, organizationId },
        select: { id: true },
      });

      if (user) {
        userRole = 'user'; // Default role since role field doesn't exist
        permissions = this.getRolePermissions('user');
      }
    }

    if (additionalPermissions) {
      const combinedPermissions = permissions.concat(additionalPermissions);
      permissions = Array.from(new Set(combinedPermissions));
    }

    return {
      organizationId,
      organizationSlug: organization.slug,
      userId,
      userRole,
      permissions,
    };
  }

  // ============================================================================
  // ENHANCED TENANT-AWARE DATABASE OPERATIONS
  // ============================================================================

  async findManyWithTenant<T>(
    model: any,
    context: TenantContext,
    args?: any,
    auditAction?: string
  ): Promise<T[]> {
    try {
      await this.validateTenantAccess(context, 'read', model.name);

      const result = await model.findMany({
        ...args,
        where: {
          ...args?.where,
          organizationId: context.organizationId,
        },
      });

      if (this.config.enableAuditLogging && auditAction) {
        await this.logTenantAccess(context, auditAction, model.name, undefined, true);
      }

      return result;
    } catch (error) {
      if (this.config.enableAuditLogging && auditAction) {
        await this.logTenantAccess(context, auditAction, model.name, undefined, false, error.message);
      }
      throw error;
    }
  }

  async findUniqueWithTenant<T>(
    model: any,
    context: TenantContext,
    where: any,
    auditAction?: string
  ): Promise<T | null> {
    try {
      await this.validateTenantAccess(context, 'read', model.name);

      const result = await model.findFirst({
        where: {
          ...where,
          organizationId: context.organizationId,
        },
      });

      if (this.config.enableAuditLogging && auditAction) {
        await this.logTenantAccess(context, auditAction, model.name, where.id, true);
      }

      return result;
    } catch (error) {
      if (this.config.enableAuditLogging && auditAction) {
        await this.logTenantAccess(context, auditAction, model.name, where.id, false, error.message);
      }
      throw error;
    }
  }

  async createWithTenant<T>(
    model: any,
    context: TenantContext,
    data: any,
    auditAction?: string
  ): Promise<T> {
    try {
      await this.validateTenantAccess(context, 'create', model.name);
      await this.checkResourceLimits(context, model.name);

      const result = await model.create({
        data: {
          ...data,
          organizationId: context.organizationId,
        },
      });

      // Update usage tracking
      await this.updateTenantUsage(context.organizationId, model.name, 'create');

      if (this.config.enableAuditLogging && auditAction) {
        await this.logTenantAccess(context, auditAction, model.name, result.id, true);
      }

      return result;
    } catch (error) {
      if (this.config.enableAuditLogging && auditAction) {
        await this.logTenantAccess(context, auditAction, model.name, undefined, false, error.message);
      }
      throw error;
    }
  }

  async updateWithTenant<T>(
    model: any,
    context: TenantContext,
    where: any,
    data: any,
    auditAction?: string
  ): Promise<T> {
    try {
      await this.validateTenantAccess(context, 'update', model.name);

      const result = await model.update({
        where: {
          ...where,
          organizationId: context.organizationId,
        },
        data,
      });

      if (this.config.enableAuditLogging && auditAction) {
        await this.logTenantAccess(context, auditAction, model.name, where.id, true);
      }

      return result;
    } catch (error) {
      if (this.config.enableAuditLogging && auditAction) {
        await this.logTenantAccess(context, auditAction, model.name, where.id, false, error.message);
      }
      throw error;
    }
  }

  async deleteWithTenant<T>(
    model: any,
    context: TenantContext,
    where: any,
    auditAction?: string
  ): Promise<T> {
    try {
      await this.validateTenantAccess(context, 'delete', model.name);

      const result = await model.delete({
        where: {
          ...where,
          organizationId: context.organizationId,
        },
      });

      // Update usage tracking
      await this.updateTenantUsage(context.organizationId, model.name, 'delete');

      if (this.config.enableAuditLogging && auditAction) {
        await this.logTenantAccess(context, auditAction, model.name, where.id, true);
      }

      return result;
    } catch (error) {
      if (this.config.enableAuditLogging && auditAction) {
        await this.logTenantAccess(context, auditAction, model.name, where.id, false, error.message);
      }
      throw error;
    }
  }

  // ============================================================================
  // TENANT ACCESS CONTROL & PERMISSIONS
  // ============================================================================

  async validateTenantAccess(
    context: TenantContext,
    action: 'create' | 'read' | 'update' | 'delete',
    resourceType: string
  ): Promise<void> {
    if (!this.config.enableStrictIsolation) {
      return;
    }

    // Check if user has required permissions
    const requiredPermission = `${resourceType}:${action}`;
    const hasPermission = context.permissions?.includes(requiredPermission) ||
      context.permissions?.includes(`${resourceType}:*`) ||
      context.permissions?.includes('*:*');

    if (!hasPermission && context.userRole !== 'admin') {
      throw new ForbiddenException(`Insufficient permissions for ${action} on ${resourceType}`);
    }

    // Emit access validation event
    this.eventEmitter.emit('tenant.access.validated', {
      organizationId: context.organizationId,
      userId: context.userId,
      action,
      resourceType,
      timestamp: new Date(),
    });
  }

  private getRolePermissions(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      admin: ['*:*'],
      user: [
        'AxonPulsConnection:*',
        'AxonPulsEvent:read',
        'AxonPulsEvent:create',
        'AxonPulsChannel:read',
        'User:read',
      ],
      viewer: [
        'AxonPulsConnection:read',
        'AxonPulsEvent:read',
        'AxonPulsChannel:read',
        'User:read',
      ],
    };

    return rolePermissions[role] || [];
  }

  // ============================================================================
  // RESOURCE LIMITS & USAGE TRACKING
  // ============================================================================

  async checkResourceLimits(context: TenantContext, resourceType: string): Promise<void> {
    if (!this.config.enableResourceLimits) {
      return;
    }

    const limits = await this.getTenantLimits(context.organizationId);
    const usage = await this.getTenantUsage(context.organizationId);

    const limitChecks: Record<string, () => boolean> = {
      User: () => usage.users >= limits.maxUsers,
      AxonPulsConnection: () => usage.connections >= limits.maxConnections,
      AxonPulsEvent: () => usage.events >= limits.maxEvents,
      AxonPulsChannel: () => usage.channels >= limits.maxChannels,
    };

    const checkFunction = limitChecks[resourceType];
    if (checkFunction && checkFunction()) {
      const limitType = resourceType.toLowerCase().replace('AxonPuls', '');
      throw new ForbiddenException(`Resource limit exceeded for ${limitType}`);
    }

    // Emit resource limit check event
    this.eventEmitter.emit('tenant.resource.checked', {
      organizationId: context.organizationId,
      resourceType,
      usage,
      limits,
      timestamp: new Date(),
    });
  }

  async getTenantLimits(organizationId: string): Promise<TenantLimits> {
    // Check cache first
    if (this.tenantLimitsCache.has(organizationId)) {
      return this.tenantLimitsCache.get(organizationId)!;
    }

    try {
      // Try to get custom limits from database (using settings field)
      const organization = await this.prismaService.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          settings: true,
        },
      });

      let limits = this.config.defaultLimits;

      if (organization?.settings && typeof organization.settings === 'object') {
        const customLimits = (organization.settings as any).limits;
        if (customLimits) {
          limits = { ...this.config.defaultLimits, ...customLimits };
        }
      }

      // Cache the limits
      this.tenantLimitsCache.set(organizationId, limits);

      return limits;
    } catch (error) {
      this.logger.error(`Failed to get tenant limits for ${organizationId}: ${error.message}`);
      return this.config.defaultLimits;
    }
  }

  async getTenantUsage(organizationId: string): Promise<TenantUsage> {
    // Check cache first (with 5-minute TTL)
    const cached = this.tenantUsageCache.get(organizationId);
    if (cached && Date.now() - cached.lastUpdated.getTime() < 300000) {
      return cached;
    }

    try {
      const [users, connections, events, channels] = await Promise.all([
        this.prismaService.user.count({
          where: { organizationId },
        }),
        this.prismaService.axonPulsConnection.count({
          where: { organizationId },
        }),
        this.prismaService.axonPulsEvent.count({
          where: { organizationId },
        }),
        this.prismaService.axonPulsChannel.count({
          where: { organizationId },
        }),
      ]);

      // Get storage usage from Redis (approximate)
      const storageUsage = await this.calculateStorageUsage(organizationId);

      // Get API calls from Redis (last hour)
      const apiCalls = await this.getApiCallCount(organizationId);

      const usage: TenantUsage = {
        users,
        connections,
        events,
        channels,
        storage: storageUsage,
        apiCalls,
        lastUpdated: new Date(),
      };

      // Cache the usage
      this.tenantUsageCache.set(organizationId, usage);

      return usage;
    } catch (error) {
      this.logger.error(`Failed to get tenant usage for ${organizationId}: ${error.message}`);
      return {
        users: 0,
        connections: 0,
        events: 0,
        channels: 0,
        storage: 0,
        apiCalls: 0,
        lastUpdated: new Date(),
      };
    }
  }

  async updateTenantUsage(
    organizationId: string,
    resourceType: string,
    operation: 'create' | 'delete'
  ): Promise<void> {
    try {
      const cached = this.tenantUsageCache.get(organizationId);
      if (cached) {
        const delta = operation === 'create' ? 1 : -1;

        switch (resourceType) {
          case 'User':
            cached.users = Math.max(0, cached.users + delta);
            break;
          case 'AxonPulsConnection':
            cached.connections = Math.max(0, cached.connections + delta);
            break;
          case 'AxonPulsEvent':
            cached.events = Math.max(0, cached.events + delta);
            break;
          case 'AxonPulsChannel':
            cached.channels = Math.max(0, cached.channels + delta);
            break;
        }

        cached.lastUpdated = new Date();
        this.tenantUsageCache.set(organizationId, cached);
      }

      // Emit usage update event
      this.eventEmitter.emit('tenant.usage.updated', {
        organizationId,
        resourceType,
        operation,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to update tenant usage: ${error.message}`);
    }
  }

  private async calculateStorageUsage(organizationId: string): Promise<number> {
    try {
      // Estimate storage usage based on events and metadata
      const redis = this.redisService.getRedisInstance();
      const pattern = `tenant:${organizationId}:*`;
      const keys = await redis.keys(pattern);

      let totalSize = 0;
      for (const key of keys) {
        try {
          const size = await redis.sendCommand(['MEMORY', 'USAGE', key]) as number;
          totalSize += size || 0;
        } catch (error) {
          // Fallback: estimate size based on key length
          totalSize += key.length * 2; // Rough estimate
        }
      }

      return totalSize;
    } catch (error) {
      this.logger.error(`Failed to calculate storage usage: ${error.message}`);
      return 0;
    }
  }

  private async getApiCallCount(organizationId: string): Promise<number> {
    try {
      const redis = this.redisService.getRedisInstance();
      const key = `tenant:${organizationId}:api_calls:${Math.floor(Date.now() / 3600000)}`; // Current hour
      const count = await redis.get(key);
      return parseInt((typeof count === 'string' ? count : '0'), 10);
    } catch (error) {
      this.logger.error(`Failed to get API call count: ${error.message}`);
      return 0;
    }
  }

  async incrementApiCallCount(organizationId: string): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      const key = `tenant:${organizationId}:api_calls:${Math.floor(Date.now() / 3600000)}`;
      await redis.incr(key);
      await redis.expire(key, 7200); // Expire after 2 hours
    } catch (error) {
      this.logger.error(`Failed to increment API call count: ${error.message}`);
    }
  }

  // ============================================================================
  // AUDIT LOGGING
  // ============================================================================

  async logTenantAccess(
    context: TenantContext,
    action: string,
    resourceType: string,
    resourceId?: string,
    success: boolean = true,
    error?: string
  ): Promise<void> {
    if (!this.config.enableAuditLogging) {
      return;
    }

    try {
      const logEntry: Omit<TenantAccessLog, 'id'> = {
        organizationId: context.organizationId,
        userId: context.userId,
        action,
        resourceType,
        resourceId,
        success,
        error,
        timestamp: new Date(),
        metadata: {
          userRole: context.userRole,
          permissions: context.permissions,
        },
      };

      // Store in Redis for fast access (with TTL)
      const redis = this.redisService.getRedisInstance();
      const logKey = `tenant:${context.organizationId}:audit:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      await redis.setEx(logKey, 2592000, JSON.stringify(logEntry)); // 30 days TTL

      // Emit audit event
      this.eventEmitter.emit('tenant.audit.logged', {
        ...logEntry,
        id: logKey,
      });

      // Log critical actions to database for long-term storage
      if (['delete', 'create'].includes(action) || !success) {
        // Store critical audit logs in database (implement as needed)
        this.logger.log(`Audit: ${context.organizationId} - ${action} ${resourceType} - ${success ? 'SUCCESS' : 'FAILED'}`);
      }
    } catch (error) {
      this.logger.error(`Failed to log tenant access: ${error.message}`);
    }
  }

  async getTenantAuditLogs(
    organizationId: string,
    filters?: {
      userId?: string;
      action?: string;
      resourceType?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<TenantAccessLog[]> {
    try {
      const redis = this.redisService.getRedisInstance();
      const pattern = `tenant:${organizationId}:audit:*`;
      const keys = await redis.keys(pattern);

      const logs: TenantAccessLog[] = [];

      for (const key of keys) {
        const logData = await redis.get(key);
        if (logData && typeof logData === 'string') {
          const log = JSON.parse(logData) as TenantAccessLog;
          log.id = key;

          // Apply filters
          if (filters) {
            if (filters.userId && log.userId !== filters.userId) continue;
            if (filters.action && log.action !== filters.action) continue;
            if (filters.resourceType && log.resourceType !== filters.resourceType) continue;
            if (filters.startDate && log.timestamp < filters.startDate) continue;
            if (filters.endDate && log.timestamp > filters.endDate) continue;
          }

          logs.push(log);
        }
      }

      // Sort by timestamp (newest first) and apply limit
      logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      if (filters?.limit) {
        return logs.slice(0, filters.limit);
      }

      return logs;
    } catch (error) {
      this.logger.error(`Failed to get tenant audit logs: ${error.message}`);
      return [];
    }
  }

  // ============================================================================
  // ENHANCED TENANT-AWARE REDIS OPERATIONS
  // ============================================================================

  getTenantKey(organizationId: string, key: string): string {
    return `tenant:${organizationId}:${key}`;
  }

  async setTenantData(
    organizationId: string,
    key: string,
    value: any,
    ttl?: number,
    context?: TenantContext
  ): Promise<void> {
    try {
      if (context) {
        await this.validateTenantAccess(context, 'create', 'TenantData');
      }

      const tenantKey = this.getTenantKey(organizationId, key);
      const redis = this.redisService.getRedisInstance();

      // Encrypt data if enabled
      const dataToStore = this.config.enableDataEncryption
        ? await this.encryptData(context.organizationId, JSON.stringify(value))
        : JSON.stringify(value);

      if (ttl) {
        await redis.setEx(tenantKey, ttl, dataToStore);
      } else {
        await redis.set(tenantKey, dataToStore);
      }

      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'set_data', 'TenantData', key, true);
      }
    } catch (error) {
      this.logger.error(`Failed to set tenant data for ${organizationId}:${key}:`, error);
      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'set_data', 'TenantData', key, false, error.message);
      }
      throw error;
    }
  }

  async getTenantData<T>(
    organizationId: string,
    key: string,
    context?: TenantContext
  ): Promise<T | null> {
    try {
      if (context) {
        await this.validateTenantAccess(context, 'read', 'TenantData');
      }

      const tenantKey = this.getTenantKey(organizationId, key);
      const redis = this.redisService.getRedisInstance();
      const value = await redis.get(tenantKey);

      if (!value || typeof value !== 'string') {
        return null;
      }

      // Decrypt data if enabled
      const parsedValue = this.config.enableDataEncryption
        ? JSON.parse(await this.decryptData(context.organizationId, value))
        : JSON.parse(value);

      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'get_data', 'TenantData', key, true);
      }

      return parsedValue;
    } catch (error) {
      this.logger.error(`Failed to get tenant data for ${organizationId}:${key}:`, error);
      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'get_data', 'TenantData', key, false, error.message);
      }
      return null;
    }
  }

  async deleteTenantData(
    organizationId: string,
    key: string,
    context?: TenantContext
  ): Promise<void> {
    try {
      if (context) {
        await this.validateTenantAccess(context, 'delete', 'TenantData');
      }

      const tenantKey = this.getTenantKey(organizationId, key);
      const redis = this.redisService.getRedisInstance();
      await redis.del(tenantKey);

      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'delete_data', 'TenantData', key, true);
      }
    } catch (error) {
      this.logger.error(`Failed to delete tenant data for ${organizationId}:${key}:`, error);
      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'delete_data', 'TenantData', key, false, error.message);
      }
      throw error;
    }
  }

  // ============================================================================
  // ENHANCED TENANT-AWARE STREAM OPERATIONS
  // ============================================================================

  getTenantStreamKey(organizationId: string, streamName: string): string {
    return `tenant:${organizationId}:stream:${streamName}`;
  }

  async addToTenantStream(
    organizationId: string,
    streamName: string,
    data: any,
    context?: TenantContext
  ): Promise<string> {
    try {
      if (context) {
        await this.validateTenantAccess(context, 'create', 'TenantStream');
      }

      const streamKey = this.getTenantStreamKey(organizationId, streamName);
      const result = await this.redisService.addToStream(streamKey, data);

      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'stream_add', 'TenantStream', streamName, true);
      }

      return result;
    } catch (error) {
      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'stream_add', 'TenantStream', streamName, false, error.message);
      }
      throw error;
    }
  }

  async readFromTenantStream(
    organizationId: string,
    streamName: string,
    lastId: string = '0',
    count: number = 10,
    context?: TenantContext
  ): Promise<any[]> {
    try {
      if (context) {
        await this.validateTenantAccess(context, 'read', 'TenantStream');
      }

      const streamKey = this.getTenantStreamKey(organizationId, streamName);
      const result = await this.redisService.readFromStream(streamKey, lastId, count);

      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'stream_read', 'TenantStream', streamName, true);
      }

      return result;
    } catch (error) {
      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'stream_read', 'TenantStream', streamName, false, error.message);
      }
      throw error;
    }
  }

  // ============================================================================
  // ENHANCED TENANT-AWARE PUB/SUB OPERATIONS
  // ============================================================================

  getTenantChannelKey(organizationId: string, channel: string): string {
    return `tenant:${organizationId}:channel:${channel}`;
  }

  async publishToTenantChannel(
    organizationId: string,
    channel: string,
    message: any,
    context?: TenantContext
  ): Promise<number> {
    try {
      if (context) {
        await this.validateTenantAccess(context, 'create', 'TenantChannel');
      }

      const channelKey = this.getTenantChannelKey(organizationId, channel);
      const result = await this.redisService.publish(channelKey, message);

      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'channel_publish', 'TenantChannel', channel, true);
      }

      return result;
    } catch (error) {
      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'channel_publish', 'TenantChannel', channel, false, error.message);
      }
      throw error;
    }
  }

  async subscribeToTenantChannel(
    organizationId: string,
    channel: string,
    callback: (message: any) => void,
    context?: TenantContext
  ): Promise<void> {
    try {
      if (context) {
        await this.validateTenantAccess(context, 'read', 'TenantChannel');
      }

      const channelKey = this.getTenantChannelKey(organizationId, channel);
      await this.redisService.subscribe(channelKey, callback);

      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'channel_subscribe', 'TenantChannel', channel, true);
      }
    } catch (error) {
      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'channel_subscribe', 'TenantChannel', channel, false, error.message);
      }
      throw error;
    }
  }



  // Tenant statistics
  async getTenantStats(organizationId: string): Promise<{
    users: number;
    connections: number;
    events: number;
    channels: number;
  }> {
    try {
      const [users, connections, events, channels] = await Promise.all([
        this.prismaService.user.count({
          where: { organizationId },
        }),
        this.prismaService.axonPulsConnection.count({
          where: { organizationId },
        }),
        this.prismaService.axonPulsEvent.count({
          where: { organizationId },
        }),
        this.prismaService.axonPulsChannel.count({
          where: { organizationId },
        }),
      ]);

      return { users, connections, events, channels };
    } catch (error) {
      this.logger.error(`Failed to get tenant stats for ${organizationId}:`, error);
      throw error;
    }
  }

  // Tenant resource limits
  async checkTenantLimits(
    organizationId: string,
    resourceType: string
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    try {
      // Default limits (in production, these would come from a subscription/plan)
      const limits = {
        users: 100,
        connections: 1000,
        events: 10000,
        channels: 50,
      };

      const stats = await this.getTenantStats(organizationId);
      const current = stats[resourceType as keyof typeof stats] || 0;
      const limit = limits[resourceType as keyof typeof limits] || 0;

      return {
        allowed: current < limit,
        current,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to check tenant limits for ${organizationId}:`, error);
      return { allowed: false, current: 0, limit: 0 };
    }
  }

  // ============================================================================
  // TENANT DATA ISOLATION & CLEANUP
  // ============================================================================

  async cleanupTenantData(organizationId: string, context?: TenantContext): Promise<void> {
    try {
      if (context) {
        await this.validateTenantAccess(context, 'delete', 'TenantData');
      }

      const redis = this.redisService.getRedisInstance();
      const pattern = `tenant:${organizationId}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(keys);
      }

      // Clear caches
      this.tenantLimitsCache.delete(organizationId);
      this.tenantUsageCache.delete(organizationId);

      this.logger.log(`Cleaned up tenant data for organization: ${organizationId}`);

      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'cleanup_data', 'TenantData', organizationId, true);
      }

      // Emit cleanup event
      this.eventEmitter.emit('tenant.data.cleaned', {
        organizationId,
        keysDeleted: keys.length,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to cleanup tenant data for ${organizationId}: ${error.message}`);
      if (context && this.config.enableAuditLogging) {
        await this.logTenantAccess(context, 'cleanup_data', 'TenantData', organizationId, false, error.message);
      }
      throw error;
    }
  }

  async getTenantDataKeys(organizationId: string): Promise<string[]> {
    try {
      const redis = this.redisService.getRedisInstance();
      const pattern = `tenant:${organizationId}:*`;
      const keys = await redis.keys(pattern);

      // Remove tenant prefix for cleaner output
      return keys.map(key => key.replace(`tenant:${organizationId}:`, ''));
    } catch (error) {
      this.logger.error(`Failed to get tenant data keys for ${organizationId}: ${error.message}`);
      return [];
    }
  }



  // ============================================================================
  // TENANT HEALTH & MONITORING
  // ============================================================================

  async getTenantHealth(organizationId: string): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    usage: TenantUsage;
    limits: TenantLimits;
    utilizationPercentages: Record<string, number>;
    issues: string[];
  }> {
    try {
      const usage = await this.getTenantUsage(organizationId);
      const limits = await this.getTenantLimits(organizationId);

      const utilizationPercentages = {
        users: (usage.users / limits.maxUsers) * 100,
        connections: (usage.connections / limits.maxConnections) * 100,
        events: (usage.events / limits.maxEvents) * 100,
        channels: (usage.channels / limits.maxChannels) * 100,
        storage: (usage.storage / limits.maxStorage) * 100,
        apiCalls: (usage.apiCalls / limits.maxApiCalls) * 100,
      };

      const issues: string[] = [];
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      // Check for issues
      Object.entries(utilizationPercentages).forEach(([resource, percentage]) => {
        if (percentage >= 95) {
          issues.push(`${resource} usage is at ${percentage.toFixed(1)}% of limit`);
          status = 'critical';
        } else if (percentage >= 80) {
          issues.push(`${resource} usage is at ${percentage.toFixed(1)}% of limit`);
          if (status !== 'critical') {
            status = 'warning';
          }
        }
      });

      return {
        status,
        usage,
        limits,
        utilizationPercentages,
        issues,
      };
    } catch (error) {
      this.logger.error(`Failed to get tenant health for ${organizationId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Increment usage counter for a resource type
   */
  async incrementUsage(organizationId: string, resourceType: string, amount: number = 1): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      const key = `tenant:${organizationId}:usage:${resourceType}`;
      await redis.incrBy(key, amount);
      await redis.expire(key, 86400); // Expire after 24 hours

      // Clear usage cache
      this.tenantUsageCache.delete(organizationId);
    } catch (error) {
      this.logger.error(`Failed to increment usage for ${resourceType}: ${error.message}`);
    }
  }

  /**
   * Decrement usage counter for a resource type
   */
  async decrementUsage(organizationId: string, resourceType: string, amount: number = 1): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      const key = `tenant:${organizationId}:usage:${resourceType}`;
      const current = await redis.get(key);
      const currentValue = parseInt((typeof current === 'string' ? current : '0'), 10);

      if (currentValue >= amount) {
        await redis.decrBy(key, amount);
      } else {
        await redis.set(key, '0');
      }

      // Clear usage cache
      this.tenantUsageCache.delete(organizationId);
    } catch (error) {
      this.logger.error(`Failed to decrement usage for ${resourceType}: ${error.message}`);
    }
  }

  // ============================================================================
  // ROLE-BASED ACCESS CONTROL
  // ============================================================================

  /**
   * Create or update a role for an organization
   */
  async createRole(
    context: TenantContext,
    roleData: {
      name: string;
      description?: string;
      permissions: string[];
      isSystem?: boolean;
    }
  ): Promise<any> {
    if (!this.config.enableRoleBasedAccess) {
      throw new ForbiddenException('Role-based access control is disabled');
    }

    await this.validateTenantAccess(context, 'create', 'Role');

    try {
      const role = await this.prismaService.role.create({
        data: {
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions,
          isSystem: roleData.isSystem || false,
          organizationId: context.organizationId,
        },
      });

      await this.logAuditEvent(context, 'CREATE', 'Role', role.id, null, role);

      this.eventEmitter.emit('tenant.role.created', {
        organizationId: context.organizationId,
        roleId: role.id,
        roleName: role.name,
      });

      return role;
    } catch (error) {
      this.logger.error(`Failed to create role: ${error.message}`);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignUserRole(
    context: TenantContext,
    userId: string,
    roleId: string,
    expiresAt?: Date
  ): Promise<any> {
    await this.validateTenantAccess(context, 'update', 'User');

    try {
      // Verify user belongs to same organization
      const user = await this.prismaService.user.findFirst({
        where: {
          id: userId,
          organizationId: context.organizationId,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found in organization');
      }

      // Verify role belongs to same organization
      const role = await this.prismaService.role.findFirst({
        where: {
          id: roleId,
          organizationId: context.organizationId,
        },
      });

      if (!role) {
        throw new NotFoundException('Role not found in organization');
      }

      const userRole = await this.prismaService.userRole.create({
        data: {
          userId,
          roleId,
          assignedBy: context.userId,
          expiresAt,
        },
        include: {
          role: true,
          user: true,
        },
      });

      await this.logAuditEvent(context, 'CREATE', 'UserRole', userRole.id, null, userRole);

      // Invalidate user permissions cache
      await this.invalidateUserPermissionsCache(userId);

      return userRole;
    } catch (error) {
      this.logger.error(`Failed to assign user role: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user permissions with role inheritance
   */
  async getUserPermissions(context: TenantContext, userId: string): Promise<string[]> {
    const cacheKey = `user_permissions:${userId}`;

    try {
      // Try cache first
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get user roles
      const userRoles = await this.prismaService.userRole.findMany({
        where: {
          userId,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        include: {
          role: true,
        },
      });

      // Aggregate permissions
      const permissions = new Set<string>();

      for (const userRole of userRoles) {
        for (const permission of userRole.role.permissions) {
          permissions.add(permission);
        }
      }

      const permissionArray = Array.from(permissions);

      // Cache for 5 minutes
      await this.redisService.setex(cacheKey, 300, JSON.stringify(permissionArray));

      return permissionArray;
    } catch (error) {
      this.logger.error(`Failed to get user permissions: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(
    context: TenantContext,
    permission: string,
    resourceId?: string
  ): Promise<boolean> {
    if (!context.userId) {
      return false;
    }

    try {
      const permissions = await this.getUserPermissions(context, context.userId);

      // Check for exact permission
      if (permissions.includes(permission)) {
        return true;
      }

      // Check for wildcard permissions
      const [resource, action] = permission.split(':');
      if (permissions.includes(`${resource}:*`) || permissions.includes('*:*')) {
        return true;
      }

      // Check for admin role
      if (context.userRole === 'admin' || permissions.includes('admin:*')) {
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Permission check failed: ${error.message}`);
      return false;
    }
  }

  // ============================================================================
  // DATA ENCRYPTION
  // ============================================================================

  /**
   * Get or create encryption key for tenant
   */
  async getTenantEncryptionKey(organizationId: string): Promise<string> {
    if (!this.config.enableDataEncryption) {
      return null;
    }

    try {
      let encryption = await this.prismaService.tenantEncryption.findUnique({
        where: { organizationId },
      });

      if (!encryption || !encryption.isActive) {
        // Create new encryption key
        const keyId = crypto.randomUUID();
        const encryptionKey = crypto.randomBytes(32).toString('hex');
        const masterKey = this.configService.get<string>('encryption.masterKey');

        if (!masterKey) {
          throw new Error('Master encryption key not configured');
        }

        // Encrypt the tenant key with master key
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(masterKey.padEnd(32, '0').slice(0, 32)), iv);
        let encryptedKey = cipher.update(encryptionKey, 'utf8', 'hex');
        encryptedKey += cipher.final('hex');
        encryptedKey = iv.toString('hex') + ':' + encryptedKey;

        encryption = await this.prismaService.tenantEncryption.create({
          data: {
            organizationId,
            keyId,
            encryptedKey,
            algorithm: this.config.encryptionConfig.algorithm,
            keyVersion: 1,
            isActive: true,
          },
        });
      }

      // Decrypt the key for use
      const masterKey = this.configService.get<string>('encryption.masterKey');
      const [ivHex, encryptedHex] = encryption.encryptedKey.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(masterKey.padEnd(32, '0').slice(0, 32)), iv);
      let decryptedKey = decipher.update(encryptedHex, 'hex', 'utf8');
      decryptedKey += decipher.final('utf8');

      return decryptedKey;
    } catch (error) {
      this.logger.error(`Failed to get encryption key: ${error.message}`);
      throw error;
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encryptData(organizationId: string, data: string): Promise<string> {
    if (!this.config.enableDataEncryption) {
      return data;
    }

    try {
      const encryptionKey = await this.getTenantEncryptionKey(organizationId);
      if (!encryptionKey) {
        return data;
      }

      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32)), iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      encrypted = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;

      return encrypted;
    } catch (error) {
      this.logger.error(`Data encryption failed: ${error.message}`);
      return data;
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decryptData(organizationId: string, encryptedData: string): Promise<string> {
    if (!this.config.enableDataEncryption) {
      return encryptedData;
    }

    try {
      const encryptionKey = await this.getTenantEncryptionKey(organizationId);
      if (!encryptionKey) {
        return encryptedData;
      }

      const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32)), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error(`Data decryption failed: ${error.message}`);
      return encryptedData;
    }
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  clearTenantCaches(organizationId?: string): void {
    if (organizationId) {
      this.tenantLimitsCache.delete(organizationId);
      this.tenantUsageCache.delete(organizationId);
    } else {
      this.tenantLimitsCache.clear();
      this.tenantUsageCache.clear();
    }
  }

  getCacheStats(): {
    limitsCache: { size: number; keys: string[] };
    usageCache: { size: number; keys: string[] };
  } {
    return {
      limitsCache: {
        size: this.tenantLimitsCache.size,
        keys: Array.from(this.tenantLimitsCache.keys()),
      },
      usageCache: {
        size: this.tenantUsageCache.size,
        keys: Array.from(this.tenantUsageCache.keys()),
      },
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  isMultiTenantEnabled(): boolean {
    return this.config.enableStrictIsolation;
  }

  getConfig(): TenantIsolationConfig {
    return { ...this.config };
  }

  async validateOrganizationExists(organizationId: string): Promise<boolean> {
    try {
      const organization = await this.prismaService.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });

      return organization !== null;
    } catch (error) {
      this.logger.error(`Failed to validate organization ${organizationId}: ${error.message}`);
      return false;
    }
  }

  // ============================================================================
  // COMPREHENSIVE AUDIT LOGGING
  // ============================================================================

  /**
   * Log audit event with comprehensive details
   */
  async logAuditEvent(
    context: TenantContext,
    action: string,
    resourceType: string,
    resourceId?: string,
    oldValues?: any,
    newValues?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enableAuditLogging) {
      return;
    }

    try {
      const severity = this.determineAuditSeverity(action, resourceType);
      const category = this.determineAuditCategory(action, resourceType);

      const auditLog = await this.prismaService.auditLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action,
          resourceType,
          resourceId,
          oldValues: oldValues ? JSON.stringify(oldValues) : null,
          newValues: newValues ? JSON.stringify(newValues) : null,
          success: true,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          severity,
          category,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      // Real-time audit event emission
      if (this.config.auditConfig.enableRealTimeAuditing) {
        this.eventEmitter.emit('audit.event', {
          auditLogId: auditLog.id,
          organizationId: context.organizationId,
          action,
          resourceType,
          severity,
          category,
          timestamp: auditLog.timestamp,
        });
      }

      // Check for security alerts
      await this.checkSecurityAlerts(context, action, resourceType, severity);

    } catch (error) {
      this.logger.error(`Audit logging failed: ${error.message}`);
      // Don't throw - audit logging should not break business logic
    }
  }

  /**
   * Log failed audit event
   */
  async logAuditFailure(
    context: TenantContext,
    action: string,
    resourceType: string,
    error: string,
    resourceId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enableAuditLogging) {
      return;
    }

    try {
      const severity = 'HIGH'; // Failed operations are always high severity
      const category = 'SECURITY_EVENT';

      await this.prismaService.auditLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action,
          resourceType,
          resourceId,
          success: false,
          error,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId,
          severity,
          category,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      // Emit security alert for failed operations
      this.eventEmitter.emit('security.alert', {
        organizationId: context.organizationId,
        userId: context.userId,
        action,
        resourceType,
        error,
        severity: 'HIGH',
        timestamp: new Date(),
      });

    } catch (auditError) {
      this.logger.error(`Audit failure logging failed: ${auditError.message}`);
    }
  }

  /**
   * Get audit trail for resource
   */
  async getAuditTrail(
    context: TenantContext,
    resourceType?: string,
    resourceId?: string,
    limit: number = 100
  ): Promise<any[]> {
    await this.validateTenantAccess(context, 'read', 'AuditLog');

    try {
      const where: any = {
        organizationId: context.organizationId,
      };

      if (resourceType) {
        where.resourceType = resourceType;
      }

      if (resourceId) {
        where.resourceId = resourceId;
      }

      const auditLogs = await this.prismaService.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return auditLogs;
    } catch (error) {
      this.logger.error(`Failed to get audit trail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    context: TenantContext,
    startDate: Date,
    endDate: Date,
    complianceType: 'GDPR' | 'SOX' | 'HIPAA' | 'PCI_DSS' = 'GDPR'
  ): Promise<any> {
    await this.validateTenantAccess(context, 'read', 'AuditLog');

    try {
      const auditLogs = await this.prismaService.auditLog.findMany({
        where: {
          organizationId: context.organizationId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
          category: {
            in: ['DATA_ACCESS', 'DATA_MODIFICATION', 'SECURITY_EVENT', 'COMPLIANCE'],
          },
        },
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const report = {
        complianceType,
        organizationId: context.organizationId,
        reportPeriod: {
          startDate,
          endDate,
        },
        summary: {
          totalEvents: auditLogs.length,
          dataAccessEvents: auditLogs.filter(log => log.category === 'DATA_ACCESS').length,
          dataModificationEvents: auditLogs.filter(log => log.category === 'DATA_MODIFICATION').length,
          securityEvents: auditLogs.filter(log => log.category === 'SECURITY_EVENT').length,
          failedOperations: auditLogs.filter(log => !log.success).length,
        },
        events: auditLogs,
        generatedAt: new Date(),
        generatedBy: context.userId,
      };

      // Log report generation
      await this.logAuditEvent(context, 'GENERATE', 'ComplianceReport', null, null, {
        complianceType,
        reportPeriod: { startDate, endDate },
        eventCount: auditLogs.length,
      });

      return report;
    } catch (error) {
      this.logger.error(`Failed to generate compliance report: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private determineAuditSeverity(action: string, resourceType: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (['DELETE', 'PURGE'].includes(action)) {
      return 'CRITICAL';
    }

    if (['UPDATE', 'MODIFY', 'GRANT', 'REVOKE'].includes(action)) {
      return 'HIGH';
    }

    if (['CREATE', 'LOGIN', 'LOGOUT'].includes(action)) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  private determineAuditCategory(action: string, resourceType: string): 'AUTHENTICATION' | 'AUTHORIZATION' | 'DATA_ACCESS' | 'DATA_MODIFICATION' | 'SYSTEM_ACCESS' | 'SECURITY_EVENT' | 'COMPLIANCE' | 'PERFORMANCE' {
    if (['LOGIN', 'LOGOUT', 'AUTHENTICATE'].includes(action)) {
      return 'AUTHENTICATION';
    }

    if (['GRANT', 'REVOKE', 'PERMISSION'].includes(action)) {
      return 'AUTHORIZATION';
    }

    if (['DELETE', 'PURGE', 'UPDATE', 'MODIFY'].includes(action)) {
      return 'DATA_MODIFICATION';
    }

    if (['READ', 'VIEW', 'ACCESS'].includes(action)) {
      return 'DATA_ACCESS';
    }

    return 'SYSTEM_ACCESS';
  }

  private async checkSecurityAlerts(
    context: TenantContext,
    action: string,
    resourceType: string,
    severity: string
  ): Promise<void> {
    // Check for suspicious patterns
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      const recentEvents = await this.prismaService.auditLog.count({
        where: {
          organizationId: context.organizationId,
          userId: context.userId,
          severity: {
            in: ['HIGH', 'CRITICAL'],
          },
          timestamp: {
            gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
          },
        },
      });

      if (recentEvents > 10) {
        this.eventEmitter.emit('security.alert', {
          type: 'SUSPICIOUS_ACTIVITY',
          organizationId: context.organizationId,
          userId: context.userId,
          description: 'High frequency of high-severity operations detected',
          eventCount: recentEvents,
          timeWindow: '5 minutes',
        });
      }
    }
  }

  private async invalidateUserPermissionsCache(userId: string): Promise<void> {
    try {
      await this.redisService.del(`user_permissions:${userId}`);
    } catch (error) {
      this.logger.warn(`Failed to invalidate permissions cache: ${error.message}`);
    }
  }
}
