import { registerAs } from '@nestjs/config';

export const tenantConfig = registerAs('tenant', () => ({
  // Core isolation settings
  strictIsolation: process.env.TENANT_STRICT_ISOLATION === 'true' || true,
  resourceLimits: process.env.TENANT_RESOURCE_LIMITS === 'true' || true,
  auditLogging: process.env.TENANT_AUDIT_LOGGING === 'true' || true,
  dataEncryption: process.env.TENANT_DATA_ENCRYPTION === 'true' || false,
  roleBasedAccess: process.env.TENANT_RBAC === 'true' || true,
  sessionManagement: process.env.TENANT_SESSION_MGMT === 'true' || true,
  realTimeMonitoring: process.env.TENANT_REALTIME_MONITORING === 'true' || true,

  // Default resource limits
  limits: {
    maxUsers: parseInt(process.env.TENANT_MAX_USERS || '100'),
    maxConnections: parseInt(process.env.TENANT_MAX_CONNECTIONS || '1000'),
    maxEvents: parseInt(process.env.TENANT_MAX_EVENTS || '10000'),
    maxChannels: parseInt(process.env.TENANT_MAX_CHANNELS || '50'),
    maxStorage: parseInt(process.env.TENANT_MAX_STORAGE || '1073741824'), // 1GB
    maxApiCalls: parseInt(process.env.TENANT_MAX_API_CALLS || '10000'), // per hour
    features: process.env.TENANT_DEFAULT_FEATURES?.split(',') || ['basic'],
  },

  // Encryption configuration
  encryption: {
    algorithm: process.env.TENANT_ENCRYPTION_ALGORITHM || 'AES-256-GCM',
    keyRotationDays: parseInt(process.env.TENANT_KEY_ROTATION_DAYS || '90'),
    fieldLevel: process.env.TENANT_FIELD_ENCRYPTION === 'true' || false,
    fields: process.env.TENANT_ENCRYPTED_FIELDS?.split(',') || [],
    masterKey: process.env.ENCRYPTION_MASTER_KEY || 'default-master-key-change-in-production',
  },

  // Audit configuration
  audit: {
    realTime: process.env.TENANT_AUDIT_REALTIME === 'true' || true,
    retentionDays: parseInt(process.env.TENANT_AUDIT_RETENTION_DAYS || '365'),
    compliance: process.env.TENANT_AUDIT_COMPLIANCE === 'true' || true,
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
    enableCrossTenantValidation: process.env.TENANT_CROSS_VALIDATION === 'true' || true,
    enableResourceOwnershipCheck: process.env.TENANT_OWNERSHIP_CHECK === 'true' || true,
    enablePermissionCaching: process.env.TENANT_PERMISSION_CACHE === 'true' || true,
    permissionCacheTtl: parseInt(process.env.TENANT_PERMISSION_CACHE_TTL || '300'), // 5 minutes
    enableSecurityAlerts: process.env.TENANT_SECURITY_ALERTS === 'true' || true,
    maxFailedAttempts: parseInt(process.env.TENANT_MAX_FAILED_ATTEMPTS || '5'),
    lockoutDuration: parseInt(process.env.TENANT_LOCKOUT_DURATION || '900'), // 15 minutes
  },

  // Rate limiting
  rateLimit: {
    enabled: process.env.TENANT_RATE_LIMIT === 'true' || true,
    windowMs: parseInt(process.env.TENANT_RATE_WINDOW || '60000'), // 1 minute
    maxRequests: parseInt(process.env.TENANT_RATE_MAX_REQUESTS || '100'),
    skipSuccessfulRequests: process.env.TENANT_RATE_SKIP_SUCCESS === 'true' || false,
    enablePerUserLimits: process.env.TENANT_RATE_PER_USER === 'true' || true,
    enablePerEndpointLimits: process.env.TENANT_RATE_PER_ENDPOINT === 'true' || true,
  },

  // WebSocket isolation
  websocket: {
    enableIsolation: process.env.TENANT_WS_ISOLATION === 'true' || true,
    enableRoomValidation: process.env.TENANT_WS_ROOM_VALIDATION === 'true' || true,
    enableMessageFiltering: process.env.TENANT_WS_MESSAGE_FILTER === 'true' || true,
    maxConnectionsPerTenant: parseInt(process.env.TENANT_WS_MAX_CONNECTIONS || '100'),
    maxMessagesPerMinute: parseInt(process.env.TENANT_WS_MAX_MESSAGES || '100'),
    enableHeartbeat: process.env.TENANT_WS_HEARTBEAT === 'true' || true,
    heartbeatInterval: parseInt(process.env.TENANT_WS_HEARTBEAT_INTERVAL || '30000'), // 30 seconds
  },

  // Session management
  session: {
    enableTracking: process.env.TENANT_SESSION_TRACKING === 'true' || true,
    maxSessionsPerUser: parseInt(process.env.TENANT_MAX_SESSIONS_PER_USER || '5'),
    sessionTimeout: parseInt(process.env.TENANT_SESSION_TIMEOUT || '3600'), // 1 hour
    enableConcurrentSessionLimit: process.env.TENANT_CONCURRENT_SESSIONS === 'true' || true,
    enableSessionValidation: process.env.TENANT_SESSION_VALIDATION === 'true' || true,
    cleanupInterval: parseInt(process.env.TENANT_SESSION_CLEANUP_INTERVAL || '300'), // 5 minutes
  },

  // Performance optimization
  performance: {
    enableCaching: process.env.TENANT_CACHING === 'true' || true,
    cachePrefix: process.env.TENANT_CACHE_PREFIX || 'tenant',
    cacheTtl: parseInt(process.env.TENANT_CACHE_TTL || '300'), // 5 minutes
    enableQueryOptimization: process.env.TENANT_QUERY_OPTIMIZATION === 'true' || true,
    enableConnectionPooling: process.env.TENANT_CONNECTION_POOLING === 'true' || true,
    maxPoolSize: parseInt(process.env.TENANT_MAX_POOL_SIZE || '20'),
  },

  // Monitoring and alerting
  monitoring: {
    enableRealTimeMetrics: process.env.TENANT_REALTIME_METRICS === 'true' || true,
    enableUsageTracking: process.env.TENANT_USAGE_TRACKING === 'true' || true,
    enablePerformanceMonitoring: process.env.TENANT_PERFORMANCE_MONITORING === 'true' || true,
    enableHealthChecks: process.env.TENANT_HEALTH_CHECKS === 'true' || true,
    healthCheckInterval: parseInt(process.env.TENANT_HEALTH_CHECK_INTERVAL || '60'), // 1 minute
    alertThresholds: {
      cpuUsage: parseInt(process.env.TENANT_ALERT_CPU_THRESHOLD || '80'),
      memoryUsage: parseInt(process.env.TENANT_ALERT_MEMORY_THRESHOLD || '80'),
      connectionUsage: parseInt(process.env.TENANT_ALERT_CONNECTION_THRESHOLD || '90'),
      storageUsage: parseInt(process.env.TENANT_ALERT_STORAGE_THRESHOLD || '90'),
      errorRate: parseInt(process.env.TENANT_ALERT_ERROR_RATE_THRESHOLD || '5'),
    },
  },

  // Compliance settings
  compliance: {
    enableGDPR: process.env.TENANT_GDPR === 'true' || true,
    enableSOX: process.env.TENANT_SOX === 'true' || false,
    enableHIPAA: process.env.TENANT_HIPAA === 'true' || false,
    enablePCIDSS: process.env.TENANT_PCI_DSS === 'true' || false,
    dataRetentionDays: parseInt(process.env.TENANT_DATA_RETENTION_DAYS || '2555'), // 7 years
    enableDataPortability: process.env.TENANT_DATA_PORTABILITY === 'true' || true,
    enableRightToErasure: process.env.TENANT_RIGHT_TO_ERASURE === 'true' || true,
    enableConsentManagement: process.env.TENANT_CONSENT_MANAGEMENT === 'true' || true,
  },

  // Feature flags
  features: {
    enableAdvancedAnalytics: process.env.TENANT_FEATURE_ANALYTICS === 'true' || false,
    enableAIIntegration: process.env.TENANT_FEATURE_AI === 'true' || false,
    enableCustomDashboards: process.env.TENANT_FEATURE_DASHBOARDS === 'true' || false,
    enableAPIAccess: process.env.TENANT_FEATURE_API === 'true' || true,
    enableWebhooks: process.env.TENANT_FEATURE_WEBHOOKS === 'true' || false,
    enableSSO: process.env.TENANT_FEATURE_SSO === 'true' || false,
    enableCustomBranding: process.env.TENANT_FEATURE_BRANDING === 'true' || false,
    enableAdvancedSecurity: process.env.TENANT_FEATURE_ADVANCED_SECURITY === 'true' || false,
  },

  // Development and testing
  development: {
    enableDebugLogging: process.env.TENANT_DEBUG_LOGGING === 'true' || false,
    enableTestMode: process.env.TENANT_TEST_MODE === 'true' || false,
    enableMockData: process.env.TENANT_MOCK_DATA === 'true' || false,
    bypassLimits: process.env.TENANT_BYPASS_LIMITS === 'true' || false,
    enableVerboseAudit: process.env.TENANT_VERBOSE_AUDIT === 'true' || false,
  },

  // Integration settings
  integrations: {
    enableExternalAuth: process.env.TENANT_EXTERNAL_AUTH === 'true' || false,
    enableThirdPartyAPI: process.env.TENANT_THIRD_PARTY_API === 'true' || false,
    enableDataSync: process.env.TENANT_DATA_SYNC === 'true' || false,
    enableEventStreaming: process.env.TENANT_EVENT_STREAMING === 'true' || true,
    enableWebhookDelivery: process.env.TENANT_WEBHOOK_DELIVERY === 'true' || false,
  },

  // Backup and recovery
  backup: {
    enableAutomaticBackup: process.env.TENANT_AUTO_BACKUP === 'true' || true,
    backupInterval: parseInt(process.env.TENANT_BACKUP_INTERVAL || '86400'), // 24 hours
    backupRetentionDays: parseInt(process.env.TENANT_BACKUP_RETENTION || '30'),
    enablePointInTimeRecovery: process.env.TENANT_POINT_IN_TIME_RECOVERY === 'true' || false,
    enableCrossRegionBackup: process.env.TENANT_CROSS_REGION_BACKUP === 'true' || false,
  },

  // Scaling and load balancing
  scaling: {
    enableAutoScaling: process.env.TENANT_AUTO_SCALING === 'true' || false,
    enableLoadBalancing: process.env.TENANT_LOAD_BALANCING === 'true' || true,
    maxInstancesPerTenant: parseInt(process.env.TENANT_MAX_INSTANCES || '5'),
    scaleUpThreshold: parseInt(process.env.TENANT_SCALE_UP_THRESHOLD || '80'),
    scaleDownThreshold: parseInt(process.env.TENANT_SCALE_DOWN_THRESHOLD || '30'),
    cooldownPeriod: parseInt(process.env.TENANT_SCALING_COOLDOWN || '300'), // 5 minutes
  },

  // Notification settings
  notifications: {
    enableEmailNotifications: process.env.TENANT_EMAIL_NOTIFICATIONS === 'true' || true,
    enableSMSNotifications: process.env.TENANT_SMS_NOTIFICATIONS === 'true' || false,
    enablePushNotifications: process.env.TENANT_PUSH_NOTIFICATIONS === 'true' || false,
    enableWebhookNotifications: process.env.TENANT_WEBHOOK_NOTIFICATIONS === 'true' || true,
    enableSlackIntegration: process.env.TENANT_SLACK_INTEGRATION === 'true' || false,
    enableTeamsIntegration: process.env.TENANT_TEAMS_INTEGRATION === 'true' || false,
  },
}));
