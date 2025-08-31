import { registerAs } from '@nestjs/config';
import {
  validateProductionSecrets,
  safeParseInt,
  safeParseBool,
  validateSecureString,
  isProduction,
  logConfigurationSummary,
} from './config.utils';

export const tenantConfig = registerAs('tenant', () => {
  // Validate required production secrets - CRITICAL for encryption
  validateProductionSecrets({
    ENCRYPTION_MASTER_KEY: process.env.ENCRYPTION_MASTER_KEY,
  });

  const config = {
    // Core isolation settings
    strictIsolation: safeParseBool(process.env.TENANT_STRICT_ISOLATION, true, { required: false }),
    resourceLimits: safeParseBool(process.env.TENANT_RESOURCE_LIMITS, true, { required: false }),
    auditLogging: safeParseBool(process.env.TENANT_AUDIT_LOGGING, true, { required: false }),
    dataEncryption: safeParseBool(process.env.TENANT_DATA_ENCRYPTION, false, { required: false }),
    roleBasedAccess: safeParseBool(process.env.TENANT_RBAC, true, { required: false }),
    sessionManagement: safeParseBool(process.env.TENANT_SESSION_MGMT, true, { required: false }),
    realTimeMonitoring: safeParseBool(process.env.TENANT_REALTIME_MONITORING, true, { required: false }),

    // Default resource limits
    limits: {
      maxUsers: safeParseInt(process.env.TENANT_MAX_USERS, 100, { required: false }),
      maxConnections: safeParseInt(process.env.TENANT_MAX_CONNECTIONS, 1000, { required: false }),
      maxEvents: safeParseInt(process.env.TENANT_MAX_EVENTS, 10000, { required: false }),
      maxChannels: safeParseInt(process.env.TENANT_MAX_CHANNELS, 50, { required: false }),
      maxStorage: safeParseInt(process.env.TENANT_MAX_STORAGE, 1073741824, { required: false }), // 1GB
      maxApiCalls: safeParseInt(process.env.TENANT_MAX_API_CALLS, 10000, { required: false }), // per hour
      features: process.env.TENANT_DEFAULT_FEATURES?.split(',') || ['basic'],
    },

    // Encryption configuration
    encryption: {
      algorithm: process.env.TENANT_ENCRYPTION_ALGORITHM || 'AES-256-GCM',
      keyRotationDays: safeParseInt(process.env.TENANT_KEY_ROTATION_DAYS, 90, { required: false }),
      fieldLevel: safeParseBool(process.env.TENANT_FIELD_ENCRYPTION, false, { required: false }),
      fields: process.env.TENANT_ENCRYPTED_FIELDS?.split(',') || [],
      // NO FALLBACK ENCRYPTION KEY - CRITICAL SECURITY
      masterKey: validateSecureString(process.env.ENCRYPTION_MASTER_KEY, 'ENCRYPTION_MASTER_KEY', {
        required: true,
        environment: ['production', 'staging']
      }),
    },

    // Audit configuration
    audit: {
      realTime: safeParseBool(process.env.TENANT_AUDIT_REALTIME, true, { required: false }),
      retentionDays: safeParseInt(process.env.TENANT_AUDIT_RETENTION_DAYS, 365, { required: false }),
      compliance: safeParseBool(process.env.TENANT_AUDIT_COMPLIANCE, true, { required: false }),
      sensitiveOps: process.env.TENANT_AUDIT_SENSITIVE_OPS?.split(',') || ['DELETE', 'UPDATE', 'CREATE'],
      levels: process.env.TENANT_AUDIT_LEVELS?.split(',') || ['HIGH', 'CRITICAL'],
      enabledCategories: process.env.TENANT_AUDIT_CATEGORIES?.split(',') || [
        'AUTHENTICATION',
        'AUTHORIZATION',
        'DATA_ACCESS',
        'DATA_MODIFICATION',
        'SECURITY_EVENT',
        'COMPLIANCE'
      ],
    },

    // Security settings
    security: {
      enableCrossTenantValidation: safeParseBool(process.env.TENANT_CROSS_VALIDATION, true, { required: false }),
      enableResourceOwnershipCheck: safeParseBool(process.env.TENANT_OWNERSHIP_CHECK, true, { required: false }),
      enablePermissionCaching: safeParseBool(process.env.TENANT_PERMISSION_CACHE, true, { required: false }),
      permissionCacheTtl: safeParseInt(process.env.TENANT_PERMISSION_CACHE_TTL, 300, { required: false }), // 5 minutes
      enableSecurityAlerts: safeParseBool(process.env.TENANT_SECURITY_ALERTS, true, { required: false }),
      maxFailedAttempts: safeParseInt(process.env.TENANT_MAX_FAILED_ATTEMPTS, 5, { required: false }),
      lockoutDuration: safeParseInt(process.env.TENANT_LOCKOUT_DURATION, 900, { required: false }), // 15 minutes
    },

    // Rate limiting
    rateLimit: {
      enabled: safeParseBool(process.env.TENANT_RATE_LIMIT, true, { required: false }),
      windowMs: safeParseInt(process.env.TENANT_RATE_WINDOW, 60000, { required: false }), // 1 minute
      maxRequests: safeParseInt(process.env.TENANT_RATE_MAX_REQUESTS, 100, { required: false }),
      skipSuccessfulRequests: safeParseBool(process.env.TENANT_RATE_SKIP_SUCCESS, false, { required: false }),
      enablePerUserLimits: safeParseBool(process.env.TENANT_RATE_PER_USER, true, { required: false }),
      enablePerEndpointLimits: safeParseBool(process.env.TENANT_RATE_PER_ENDPOINT, true, { required: false }),
    },

    // WebSocket isolation
    websocket: {
      enableIsolation: safeParseBool(process.env.TENANT_WS_ISOLATION, true, { required: false }),
      enableRoomValidation: safeParseBool(process.env.TENANT_WS_ROOM_VALIDATION, true, { required: false }),
      enableMessageFiltering: safeParseBool(process.env.TENANT_WS_MESSAGE_FILTER, true, { required: false }),
      maxConnectionsPerTenant: safeParseInt(process.env.TENANT_WS_MAX_CONNECTIONS, 100, { required: false }),
      maxMessagesPerMinute: safeParseInt(process.env.TENANT_WS_MAX_MESSAGES, 100, { required: false }),
      enableHeartbeat: safeParseBool(process.env.TENANT_WS_HEARTBEAT, true, { required: false }),
      heartbeatInterval: safeParseInt(process.env.TENANT_WS_HEARTBEAT_INTERVAL, 30000, { required: false }), // 30 seconds
    },

    // Session management
    session: {
      enableTracking: safeParseBool(process.env.TENANT_SESSION_TRACKING, true, { required: false }),
      maxSessionsPerUser: safeParseInt(process.env.TENANT_MAX_SESSIONS_PER_USER, 5, { required: false }),
      sessionTimeout: safeParseInt(process.env.TENANT_SESSION_TIMEOUT, 3600, { required: false }), // 1 hour
      enableConcurrentSessionLimit: safeParseBool(process.env.TENANT_CONCURRENT_SESSIONS, true, { required: false }),
      enableSessionValidation: safeParseBool(process.env.TENANT_SESSION_VALIDATION, true, { required: false }),
      cleanupInterval: safeParseInt(process.env.TENANT_SESSION_CLEANUP_INTERVAL, 300, { required: false }), // 5 minutes
    },

    // Performance optimization
    performance: {
      enableCaching: safeParseBool(process.env.TENANT_CACHING, true, { required: false }),
      cachePrefix: process.env.TENANT_CACHE_PREFIX || 'tenant',
      cacheTtl: safeParseInt(process.env.TENANT_CACHE_TTL, 300, { required: false }), // 5 minutes
      enableQueryOptimization: safeParseBool(process.env.TENANT_QUERY_OPTIMIZATION, true, { required: false }),
      enableConnectionPooling: safeParseBool(process.env.TENANT_CONNECTION_POOLING, true, { required: false }),
      maxPoolSize: safeParseInt(process.env.TENANT_MAX_POOL_SIZE, 20, { required: false }),
    },

    // Monitoring and alerting
    monitoring: {
      enableRealTimeMetrics: safeParseBool(process.env.TENANT_REALTIME_METRICS, true, { required: false }),
      enableUsageTracking: safeParseBool(process.env.TENANT_USAGE_TRACKING, true, { required: false }),
      enablePerformanceMonitoring: safeParseBool(process.env.TENANT_PERFORMANCE_MONITORING, true, { required: false }),
      enableHealthChecks: safeParseBool(process.env.TENANT_HEALTH_CHECKS, true, { required: false }),
      healthCheckInterval: safeParseInt(process.env.TENANT_HEALTH_CHECK_INTERVAL, 60, { required: false }), // 1 minute
      alertThresholds: {
        cpuUsage: safeParseInt(process.env.TENANT_ALERT_CPU_THRESHOLD, 80, { required: false }),
        memoryUsage: safeParseInt(process.env.TENANT_ALERT_MEMORY_THRESHOLD, 80, { required: false }),
        connectionUsage: safeParseInt(process.env.TENANT_ALERT_CONNECTION_THRESHOLD, 90, { required: false }),
        storageUsage: safeParseInt(process.env.TENANT_ALERT_STORAGE_THRESHOLD, 90, { required: false }),
        errorRate: safeParseInt(process.env.TENANT_ALERT_ERROR_RATE_THRESHOLD, 5, { required: false }),
      },
    },

    // Compliance settings
    compliance: {
      enableGDPR: safeParseBool(process.env.TENANT_GDPR, true, { required: false }),
      enableSOX: safeParseBool(process.env.TENANT_SOX, false, { required: false }),
      enableHIPAA: safeParseBool(process.env.TENANT_HIPAA, false, { required: false }),
      enablePCIDSS: safeParseBool(process.env.TENANT_PCI_DSS, false, { required: false }),
      dataRetentionDays: safeParseInt(process.env.TENANT_DATA_RETENTION_DAYS, 2555, { required: false }), // 7 years
      enableDataPortability: safeParseBool(process.env.TENANT_DATA_PORTABILITY, true, { required: false }),
      enableRightToErasure: safeParseBool(process.env.TENANT_RIGHT_TO_ERASURE, true, { required: false }),
      enableConsentManagement: safeParseBool(process.env.TENANT_CONSENT_MANAGEMENT, true, { required: false }),
    },

    // Feature flags
    features: {
      enableAdvancedAnalytics: safeParseBool(process.env.TENANT_FEATURE_ANALYTICS, false, { required: false }),
      enableAIIntegration: safeParseBool(process.env.TENANT_FEATURE_AI, false, { required: false }),
      enableCustomDashboards: safeParseBool(process.env.TENANT_FEATURE_DASHBOARDS, false, { required: false }),
      enableAPIAccess: safeParseBool(process.env.TENANT_FEATURE_API, true, { required: false }),
      enableWebhooks: safeParseBool(process.env.TENANT_FEATURE_WEBHOOKS, false, { required: false }),
      enableSSO: safeParseBool(process.env.TENANT_FEATURE_SSO, false, { required: false }),
      enableCustomBranding: safeParseBool(process.env.TENANT_FEATURE_BRANDING, false, { required: false }),
      enableAdvancedSecurity: safeParseBool(process.env.TENANT_FEATURE_ADVANCED_SECURITY, false, { required: false }),
    },

    // Development and testing
    development: {
      enableDebugLogging: safeParseBool(process.env.TENANT_DEBUG_LOGGING, false, { required: false }),
      enableTestMode: safeParseBool(process.env.TENANT_TEST_MODE, false, { required: false }),
      enableMockData: safeParseBool(process.env.TENANT_MOCK_DATA, false, { required: false }), // Explicitly disabled by default
      bypassLimits: safeParseBool(process.env.TENANT_BYPASS_LIMITS, false, { required: false }), // Explicitly disabled by default
      enableVerboseAudit: safeParseBool(process.env.TENANT_VERBOSE_AUDIT, false, { required: false }),
    },

    // Integration settings
    integrations: {
      enableExternalAuth: safeParseBool(process.env.TENANT_EXTERNAL_AUTH, false, { required: false }),
      enableThirdPartyAPI: safeParseBool(process.env.TENANT_THIRD_PARTY_API, false, { required: false }),
      enableDataSync: safeParseBool(process.env.TENANT_DATA_SYNC, false, { required: false }),
      enableEventStreaming: safeParseBool(process.env.TENANT_EVENT_STREAMING, true, { required: false }),
      enableWebhookDelivery: safeParseBool(process.env.TENANT_WEBHOOK_DELIVERY, false, { required: false }),
    },

    // Backup and recovery
    backup: {
      enableAutomaticBackup: safeParseBool(process.env.TENANT_AUTO_BACKUP, true, { required: false }),
      backupInterval: safeParseInt(process.env.TENANT_BACKUP_INTERVAL, 86400, { required: false }), // 24 hours
      backupRetentionDays: safeParseInt(process.env.TENANT_BACKUP_RETENTION, 30, { required: false }),
      enablePointInTimeRecovery: safeParseBool(process.env.TENANT_POINT_IN_TIME_RECOVERY, false, { required: false }),
      enableCrossRegionBackup: safeParseBool(process.env.TENANT_CROSS_REGION_BACKUP, false, { required: false }),
    },

    // Scaling and load balancing
    scaling: {
      enableAutoScaling: safeParseBool(process.env.TENANT_AUTO_SCALING, false, { required: false }),
      enableLoadBalancing: safeParseBool(process.env.TENANT_LOAD_BALANCING, true, { required: false }),
      maxInstancesPerTenant: safeParseInt(process.env.TENANT_MAX_INSTANCES, 5, { required: false }),
      scaleUpThreshold: safeParseInt(process.env.TENANT_SCALE_UP_THRESHOLD, 80, { required: false }),
      scaleDownThreshold: safeParseInt(process.env.TENANT_SCALE_DOWN_THRESHOLD, 30, { required: false }),
      cooldownPeriod: safeParseInt(process.env.TENANT_SCALING_COOLDOWN, 300, { required: false }), // 5 minutes
    },

    // Notification settings
    notifications: {
      enableEmailNotifications: safeParseBool(process.env.TENANT_EMAIL_NOTIFICATIONS, true, { required: false }),
      enableSMSNotifications: safeParseBool(process.env.TENANT_SMS_NOTIFICATIONS, false, { required: false }),
      enablePushNotifications: safeParseBool(process.env.TENANT_PUSH_NOTIFICATIONS, false, { required: false }),
      enableWebhookNotifications: safeParseBool(process.env.TENANT_WEBHOOK_NOTIFICATIONS, true, { required: false }),
      enableSlackIntegration: safeParseBool(process.env.TENANT_SLACK_INTEGRATION, false, { required: false }),
      enableTeamsIntegration: safeParseBool(process.env.TENANT_TEAMS_INTEGRATION, false, { required: false }),
    },
  };

  // Log configuration summary (with sensitive data redacted)
  logConfigurationSummary('Tenant', config);

  return config;
});
