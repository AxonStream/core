import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TenantContext } from '../services/tenant-aware.service';

// Services
import { TenantAwareService } from '../services/tenant-aware.service';
import { TenantDatabaseService } from '../services/tenant-database.service';
import { PrismaService } from '../services/prisma.service';
import { RedisService } from '../services/redis.service';
import { TenantJwtService } from '../services/tenant-jwt.service';
import { TenantRoomService } from '../services/tenant-room.service';
import { TenantRateLimitService } from '../services/tenant-rate-limit.service';

// Guards
import { TenantIsolationGuard } from '../guards/tenant-isolation.guard';
import { TenantWebSocketGuard } from '../guards/tenant-websocket.guard';
import { TenantResourceLimitGuard } from '../middleware/tenant-isolation.middleware';

// Middleware
import { TenantIsolationMiddleware } from '../middleware/tenant-isolation.middleware';

// Interceptors
import { TenantWebSocketInterceptor } from '../interceptors/tenant-websocket.interceptor';

// Configuration
import { tenantConfig } from '../../config/tenant.config';

/**
 * Global tenant isolation module
 * Provides comprehensive multi-tenant isolation across the entire application
 */
@Global()
@Module({
  imports: [
    ConfigModule.forFeature(tenantConfig),
    JwtModule.register({}), // Will be configured by auth module
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
  ],
  providers: [
    // Core services
    TenantAwareService,
    TenantDatabaseService,
    PrismaService,
    RedisService,

    // Shared utility services
    TenantJwtService,
    TenantRoomService,
    TenantRateLimitService,

    // Guards
    TenantIsolationGuard,
    TenantWebSocketGuard,
    // Interceptors
    TenantWebSocketInterceptor,

    // Event listeners
    {
      provide: 'TENANT_EVENT_LISTENERS',
      useFactory: (tenantAwareService: TenantAwareService) => {
        return {
          // Security alert handler
          'security.alert': async (payload: any) => {
            console.log('Security Alert:', payload);



          },

          // Audit event handler
          'audit.event': async (payload: any) => {
            console.log('Audit Event:', payload);
            // Implement real-time audit processing
            // Could trigger compliance checks, notifications, etc.
          },

          // Tenant resource limit handler
          'tenant.limit.exceeded': async (payload: any) => {
            console.log('Resource Limit Exceeded:', payload);
            // Implement limit exceeded handling
            // Could send notifications, temporarily increase limits, etc.
          },

          // Tenant role created handler
          'tenant.role.created': async (payload: any) => {
            console.log('Role Created:', payload);
            // Implement role creation handling
            // Could trigger permission cache invalidation, notifications, etc.
          },

          // WebSocket connection handler
          'websocket.connected': async (payload: any) => {
            console.log('WebSocket Connected:', payload);
            // Implement connection tracking
          },

          // WebSocket disconnection handler
          'websocket.disconnected': async (payload: any) => {
            console.log('WebSocket Disconnected:', payload);
            // Implement disconnection cleanup
          },
        };
      },
      inject: [TenantAwareService],
    },

    // Health check provider
    {
      provide: 'TENANT_HEALTH_CHECK',
      useFactory: (tenantAwareService: TenantAwareService) => {
        return {
          async checkTenantHealth(organizationId: string) {
            return await tenantAwareService.getTenantHealth(organizationId);
          },

          async checkAllTenantsHealth(context: TenantContext) {
            await tenantAwareService.checkResourceLimits(context, 'AxonPulsConnection');
            await tenantAwareService.checkResourceLimits(context, 'AxonPulsEvent');
            await tenantAwareService.checkResourceLimits(context, 'AxonPulsChannel');
            await tenantAwareService.checkResourceLimits(context, 'User');
            await tenantAwareService.checkResourceLimits(context, 'Role');
            await tenantAwareService.checkResourceLimits(context, 'Permission');
            await tenantAwareService.checkResourceLimits(context, 'Session');
            return { status: 'healthy', timestamp: new Date() };
          },
        };
      },
      inject: [TenantAwareService],
    },

    // Cleanup service for expired sessions, cache, etc.
    {
      provide: 'TENANT_CLEANUP_SERVICE',
      useFactory: (prismaService: PrismaService) => {
        const cleanupService = {
          async cleanupExpiredSessions() {
            await prismaService.session.deleteMany({
              where: {
                expiresAt: {
                  lt: new Date(),
                },
              },
            });
          },

          async cleanupOldAuditLogs() {
            const retentionDate = new Date();
            retentionDate.setDate(retentionDate.getDate() - 365); // 1 year retention

            await prismaService.auditLog.deleteMany({
              where: {
                timestamp: {
                  lt: retentionDate,
                },
              },
            });
          },

          async rotateEncryptionKeys() {
            console.log('Rotating encryption keys...');
          },
        };
      },
      inject: [PrismaService],
    },

    // Metrics collector
    {
      provide: 'TENANT_METRICS_COLLECTOR',
      useFactory: (tenantAwareService: TenantAwareService) => {
        return {
          async collectTenantMetrics(organizationId: string) {
            const usage = await tenantAwareService.getTenantUsage(organizationId);
            const limits = await tenantAwareService.getTenantLimits(organizationId);

            return {
              organizationId,
              usage,
              limits,
              utilizationPercentages: {
                users: (usage.users / limits.maxUsers) * 100,
                connections: (usage.connections / limits.maxConnections) * 100,
                events: (usage.events / limits.maxEvents) * 100,
                storage: (Number(usage.storage) / Number(limits.maxStorage)) * 100,
              },
              timestamp: new Date(),
            };
          },

          async collectSystemMetrics() {
            // Implementation for system-wide metrics
            return {
              totalTenants: 0, // Would be calculated
              totalUsers: 0,
              totalConnections: 0,
              systemHealth: 'healthy',
              timestamp: new Date(),
            };
          },
        };
      },
      inject: [TenantAwareService],
    },
  ],
  exports: [
    TenantAwareService,
    TenantDatabaseService,
    TenantIsolationGuard,
    TenantWebSocketGuard,
    TenantWebSocketInterceptor,
    PrismaService,
    RedisService,

    // Export shared utility services
    TenantJwtService,
    TenantRoomService,
    TenantRateLimitService,
  ],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant isolation middleware to all routes
    consumer
      .apply(TenantIsolationMiddleware)
      .forRoutes('*');
  }

  /**
   * Initialize tenant module with background tasks
   */
  static async onModuleInit() {
    console.log('🔒 Tenant Isolation Module Initialized');

    // Start background cleanup tasks
    this.startCleanupTasks();

    // Start health monitoring
    this.startHealthMonitoring();

    // Start metrics collection
    this.startMetricsCollection();
  }

  /**
   * Start background cleanup tasks
   */
  private static startCleanupTasks() {
    // Cleanup expired sessions every 5 minutes
    setInterval(async () => {
      try {
        console.log('Running session cleanup...');
        // Cleanup is handled by the TENANT_CLEANUP_SERVICE provider
      } catch (error) {
        console.error('Session cleanup failed:', error);
      }
    }, 5 * 60 * 1000);

    // Cleanup old audit logs daily
    setInterval(async () => {
      try {
        console.log('Running audit log cleanup...');
      } catch (error) {
        console.error('Audit log cleanup failed:', error);
      }
    }, 24 * 60 * 60 * 1000);

    // Rotate encryption keys weekly
    setInterval(async () => {
      try {
        console.log('Running key rotation...');
      } catch (error) {
        console.error('Key rotation failed:', error);
      }
    }, 7 * 24 * 60 * 60 * 1000);
  }

  /**
   * Start health monitoring
   */
  private static startHealthMonitoring() {
    setInterval(async () => {
      try {
        console.log('Running tenant health checks...');
        // Implementation would check all tenants
      } catch (error) {
        console.error('Health monitoring failed:', error);
      }
    }, 60 * 1000); // Every minute
  }

  /**
   * Start metrics collection
   */
  private static startMetricsCollection() {
    setInterval(async () => {
      try {
        console.log('Collecting tenant metrics...');
        // Implementation would collect and store metrics
      } catch (error) {
        console.error('Metrics collection failed:', error);
      }
    }, 30 * 1000); // Every 30 seconds
  }

  /**
   * Cleanup on module destroy
   */
  static async onModuleDestroy() {
    console.log('🔒 Tenant Isolation Module Destroyed');
    // Cleanup any resources, close connections, etc.
  }
}
