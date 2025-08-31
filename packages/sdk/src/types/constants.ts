/**
 * 🎯 SDK CONSTANTS
 * 
 * Re-exports of all constants from the existing API schemas
 * This ensures consistency between client and server
 */

// 🛡️ SELF-CONTAINED CONSTANTS - No workspace boundary violations
export const EVENT_TYPES = {
    MAGIC_OPERATION: 'magic_operation',
    MAGIC_STATE_SYNC: 'magic_state_sync',
    MAGIC_PRESENCE_UPDATE: 'magic_presence_update',
    MAGIC_PRESENCE_JOIN: 'magic_presence_join',
    MAGIC_PRESENCE_LEAVE: 'magic_presence_leave',
    MAGIC_SNAPSHOT_CREATED: 'magic_snapshot_created',
    MAGIC_BRANCH_CREATED: 'magic_branch_created',
    MAGIC_MERGE_COMPLETED: 'magic_merge_completed',
    WEBSOCKET_SUBSCRIBE: 'subscribe',
    WEBSOCKET_UNSUBSCRIBE: 'unsubscribe',
    WEBSOCKET_PUBLISH: 'publish',
    WEBSOCKET_ACK: 'ack',
    WEBSOCKET_ERROR: 'error'
} as const;

export const CHANNEL_TYPES = {
    MAGIC_ROOM: 'magic_room',
    PRESENCE: 'presence',
    EVENTS: 'events',
    SYSTEM: 'system'
} as const;

export const CLIENT_TYPES = {
    WEB: 'web',
    MOBILE: 'mobile',
    SERVER: 'server',
    WEBHOOK: 'webhook'
} as const;

export const CONNECTION_STATUSES = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    ERROR: 'error'
} as const;

export const EVENT_PRIORITIES = {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    CRITICAL: 'critical'
} as const;

export const SCHEMA_REGISTRY = {
    AXON_PULS_EVENT: 'axon_puls_event',
    CHANNEL_SUBSCRIPTION: 'channel_subscription',
    WEBSOCKET_MESSAGE: 'websocket_message',
    ERROR_RESPONSE: 'error_response'
} as const;

// SDK-specific constants
export const SDK_CONSTANTS = {
    // Version information
    VERSION: '2.0.0',
    SDK_NAME: '@axonstream/core',

    // Default values
    DEFAULTS: {
        RECONNECT_ATTEMPTS: 5,
        RECONNECT_DELAY: 1000,
        HEARTBEAT_INTERVAL: 30000,
        CONNECTION_TIMEOUT: 10000,
        MAX_PAYLOAD_SIZE: 1024 * 1024, // 1MB
        SNAPSHOT_INTERVAL: 5 * 60 * 1000, // 5 minutes
        MAX_SNAPSHOTS: 100,
        METRICS_INTERVAL: 60000, // 1 minute
        MAX_METRICS_HISTORY: 1000,
        TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes
        MAX_RETRY_ATTEMPTS: 3,
        WEBHOOK_TIMEOUT: 10000,
        WEBHOOK_MAX_RETRIES: 3,
        WEBHOOK_RETRY_DELAY: 1000,
    },

    // Event types
    EVENTS: {
        // Core events
        CONNECT: 'connect',
        CONNECTING: 'connecting',
        CONNECTED: 'connected',
        DISCONNECT: 'disconnect',
        DISCONNECTED: 'disconnected',
        RECONNECTING: 'reconnecting',
        ERROR: 'error',
        EVENT: 'event',
        SUBSCRIBED: 'subscribed',
        UNSUBSCRIBED: 'unsubscribed',
        PUBLISHED: 'published',
        ACK: 'ack',
        RATE_LIMIT: 'rate_limit',
        TOKEN_REFRESHED: 'token_refreshed',

        // Magic events
        MAGIC_OPERATION_RECEIVED: 'magic_operation_received',
        MAGIC_STATE_SYNCED: 'magic_state_synced',
        MAGIC_OPERATION_APPLIED: 'magic_operation_applied',
        MAGIC_STATE_SYNC: 'magic_state_sync',

        // Presence events
        PRESENCE_USER_JOINED: 'presence_user_joined',
        PRESENCE_USER_LEFT: 'presence_user_left',
        PRESENCE_UPDATED: 'presence_updated',
        PRESENCE_JOINED: 'presence_joined',
        PRESENCE_LEFT: 'presence_left',
    },

    // Error codes
    ERROR_CODES: {
        CONNECTION_FAILED: 'CONNECTION_FAILED',
        AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
        SUBSCRIPTION_FAILED: 'SUBSCRIPTION_FAILED',
        PUBLISH_FAILED: 'PUBLISH_FAILED',
        RATE_LIMITED: 'RATE_LIMITED',
        INVALID_TOKEN: 'INVALID_TOKEN',
        TOKEN_EXPIRED: 'TOKEN_EXPIRED',
        CHANNEL_ACCESS_DENIED: 'CHANNEL_ACCESS_DENIED',
        MAGIC_ROOM_NOT_FOUND: 'MAGIC_ROOM_NOT_FOUND',
        MAGIC_OPERATION_FAILED: 'MAGIC_OPERATION_FAILED',
        PRESENCE_JOIN_FAILED: 'PRESENCE_JOIN_FAILED',
        TIMEOUT: 'TIMEOUT',
        NETWORK_ERROR: 'NETWORK_ERROR',
        UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    },

    // Status codes
    STATUS: {
        CONNECTING: 'connecting',
        CONNECTED: 'connected',
        DISCONNECTED: 'disconnected',
        RECONNECTING: 'reconnecting',
        ERROR: 'error',
        HEALTHY: 'healthy',
        DEGRADED: 'degraded',
        UNHEALTHY: 'unhealthy',
    },

    // Priority levels
    PRIORITY: {
        LOW: 'low',
        NORMAL: 'normal',
        HIGH: 'high',
        CRITICAL: 'critical',
        URGENT: 'urgent',
    },

    // Conflict resolution strategies
    CONFLICT_RESOLUTION: {
        OPERATIONAL_TRANSFORM: 'operational_transform',
        LAST_WRITE_WINS: 'last_write_wins',
        FIRST_WRITE_WINS: 'first_write_wins',
        MERGE_STRATEGY: 'merge_strategy',
        USER_CHOICE: 'user_choice',
        AI_RESOLUTION: 'ai_resolution',
    },

    // Framework types
    FRAMEWORKS: {
        REACT: 'react',
        VUE: 'vue',
        ANGULAR: 'angular',
        SVELTE: 'svelte',
        VANILLA: 'vanilla',
        UNKNOWN: 'unknown',
    },

    // Log levels
    LOG_LEVELS: {
        ERROR: 'error',
        WARN: 'warn',
        INFO: 'info',
        DEBUG: 'debug',
    },

    // Time intervals (in milliseconds)
    INTERVALS: {
        SECOND: 1000,
        MINUTE: 60 * 1000,
        HOUR: 60 * 60 * 1000,
        DAY: 24 * 60 * 60 * 1000,
    },

    // Retry strategies
    RETRY_STRATEGIES: {
        FIXED: 'fixed',
        LINEAR: 'linear',
        EXPONENTIAL: 'exponential',
        ADAPTIVE: 'adaptive',
    },

    // Webhook methods
    WEBHOOK_METHODS: {
        POST: 'POST',
        PUT: 'PUT',
        PATCH: 'PATCH',
    },

    // Delivery semantics
    DELIVERY_SEMANTICS: {
        AT_LEAST_ONCE: 'at-least-once',
        AT_MOST_ONCE: 'at-most-once',
        EXACTLY_ONCE: 'exactly-once',
    },
} as const;

// Type-safe access to constants
export type SDKEventType = typeof SDK_CONSTANTS.EVENTS[keyof typeof SDK_CONSTANTS.EVENTS];
export type SDKErrorCode = typeof SDK_CONSTANTS.ERROR_CODES[keyof typeof SDK_CONSTANTS.ERROR_CODES];
export type SDKStatus = typeof SDK_CONSTANTS.STATUS[keyof typeof SDK_CONSTANTS.STATUS];
export type SDKPriority = typeof SDK_CONSTANTS.PRIORITY[keyof typeof SDK_CONSTANTS.PRIORITY];
export type SDKConflictResolution = typeof SDK_CONSTANTS.CONFLICT_RESOLUTION[keyof typeof SDK_CONSTANTS.CONFLICT_RESOLUTION];
export type SDKFramework = typeof SDK_CONSTANTS.FRAMEWORKS[keyof typeof SDK_CONSTANTS.FRAMEWORKS];
export type SDKLogLevel = typeof SDK_CONSTANTS.LOG_LEVELS[keyof typeof SDK_CONSTANTS.LOG_LEVELS];
export type SDKRetryStrategy = typeof SDK_CONSTANTS.RETRY_STRATEGIES[keyof typeof SDK_CONSTANTS.RETRY_STRATEGIES];
export type SDKWebhookMethod = typeof SDK_CONSTANTS.WEBHOOK_METHODS[keyof typeof SDK_CONSTANTS.WEBHOOK_METHODS];
export type SDKDeliverySemantics = typeof SDK_CONSTANTS.DELIVERY_SEMANTICS[keyof typeof SDK_CONSTANTS.DELIVERY_SEMANTICS];
