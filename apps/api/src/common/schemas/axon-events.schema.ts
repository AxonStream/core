import { z } from 'zod';

/**
 * AxonPuls Event Types & Schemas
 * Comprehensive Zod schemas for all AxonPuls event types with strict validation
 * Production-grade type safety and runtime validation
 */

// ============================================================================
// BASE ENUMS & PRIMITIVES
// ============================================================================

export const ClientTypeSchema = z.enum([
  'WEB_APP',
  'MOBILE_APP',
  'SDK_WIDGET',
  'API_CLIENT',
  'INTERNAL_SERVICE',
  'DESKTOP_APP',
  'CLI_TOOL',
  'BROWSER_EXTENSION',
]);

export const ConnectionStatusSchema = z.enum([
  'CONNECTED',
  'DISCONNECTED',
  'RECONNECTING',
  'SUSPENDED',
  'FAILED',
]);

export const ConnectionQualitySchema = z.enum([
  'EXCELLENT',
  'GOOD',
  'POOR',
  'CRITICAL',
]);

export const ChannelTypeSchema = z.enum([
  'AGENT_EVENTS',
  'TOOL_EVENTS',
  'WORKFLOW_EVENTS',
  'PROVIDER_EVENTS',
  'SYSTEM_EVENTS',
  'CONNECTION_EVENTS',
  'PRIVATE_USER',
  'ORGANIZATION',
  'BROADCAST',
]);

export const EventPrioritySchema = z.enum([
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL',
  'URGENT',
]);

export const EventStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'RETRYING',
]);

// Common field schemas
export const TimestampSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: "Invalid datetime string",
});
export const UUIDSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, {
  message: "Invalid UUID format",
});
export const SessionIdSchema = z.string().min(1).max(255);
export const OrganizationIdSchema = z.string().min(1).max(255);
export const UserIdSchema = z.string().min(1).max(255);
export const ChannelNameSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const EventTypeSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/);

// Metadata schemas
export const BaseMetadataSchema = z.object({
  version: z.string().optional(),
  source: z.string().optional(),
  correlationId: z.string().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  environment: z.enum(['development', 'staging', 'production']).optional(),
}).strict();

// ============================================================================
// CORE AxonPuls SCHEMAS
// ============================================================================

// Core AxonPuls Event Schema
export const AxonPulsEventSchema = z.object({
  id: z.string().optional(),
  eventType: EventTypeSchema,
  channel: ChannelNameSchema,
  payload: z.record(z.string(), z.any()),
  sessionId: SessionIdSchema.optional(),
  organizationId: OrganizationIdSchema.optional(),
  userId: UserIdSchema.optional(),
  acknowledgment: z.boolean().default(false),
  retryCount: z.number().int().min(0).default(0),
  priority: EventPrioritySchema.default('NORMAL'),
  status: EventStatusSchema.default('PENDING'),
  createdAt: TimestampSchema,
  processedAt: TimestampSchema.optional(),
  expiresAt: TimestampSchema.optional(),
  metadata: BaseMetadataSchema.optional(),
}).strict();

// Connection Schema
export const AxonPulsConnectionSchema = z.object({
  id: UUIDSchema,
  sessionId: SessionIdSchema,
  clientType: ClientTypeSchema,
  status: ConnectionStatusSchema,
  quality: ConnectionQualitySchema.default('GOOD'),
  channels: z.array(ChannelNameSchema),
  latency: z.number().min(0).default(0),
  metadata: z.record(z.string(), z.any()).optional(),
  connectedAt: TimestampSchema,
  lastHeartbeat: TimestampSchema,
  disconnectedAt: TimestampSchema.optional(),
  organizationId: OrganizationIdSchema,
  userId: UserIdSchema.optional(),
}).strict();

// Channel Schema
export const AxonPulsChannelSchema = z.object({
  id: UUIDSchema,
  name: ChannelNameSchema,
  type: ChannelTypeSchema,
  description: z.string().max(500).optional(),
  permissions: z.record(z.string(), z.any()).optional(),
  settings: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().default(true),
  subscribers: z.number().int().min(0).default(0),
  maxSubscribers: z.number().int().min(1).optional(),
  organizationId: OrganizationIdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict();

// ============================================================================
// AUTHENTICATION & USER SCHEMAS
// ============================================================================

// Email validation schema
export const EmailSchema = z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
  message: "Invalid email format",
});

// Password validation schema
export const PasswordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one lowercase letter, one uppercase letter, and one number");

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
  organizationSlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  rememberMe: z.boolean().default(false),
}).strict();

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  organizationName: z.string().min(1).max(100),
  organizationSlug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: "Must accept terms and conditions",
  }),
}).strict();

export const JwtPayloadSchema = z.object({
  sub: UserIdSchema,
  email: EmailSchema,
  organizationId: OrganizationIdSchema,
  organizationSlug: z.string(),
  role: z.enum(['admin', 'user', 'viewer']).optional(),
  permissions: z.array(z.string()).optional(),
  iat: z.number().int().positive().optional(),
  exp: z.number().int().positive().optional(),
}).strict();

// ============================================================================
// SPECIFIC EVENT TYPE SCHEMAS
// ============================================================================

// Agent Event Schemas
export const AgentActionSchema = z.enum([
  'start',
  'stop',
  'pause',
  'resume',
  'error',
  'restart',
  'configure',
  'status_update',
]);

export const AgentStatusSchema = z.enum([
  'idle',
  'running',
  'paused',
  'error',
  'stopped',
  'starting',
  'stopping',
]);

export const AgentEventSchema = AxonPulsEventSchema.extend({
  eventType: z.literal('agent_events'),
  payload: z.object({
    agentId: UUIDSchema,
    agentName: z.string().min(1).max(100),
    action: AgentActionSchema,
    status: AgentStatusSchema,
    previousStatus: AgentStatusSchema.optional(),
    data: z.record(z.string(), z.any()).optional(),
    error: z.string().optional(),
    timestamp: TimestampSchema,
    duration: z.number().min(0).optional(),
    resourceUsage: z.object({
      cpu: z.number().min(0).max(100).optional(),
      memory: z.number().min(0).optional(),
      network: z.number().min(0).optional(),
    }).optional(),
  }).strict(),
}).strict();

// Tool Event Schemas
export const ToolActionSchema = z.enum([
  'call_start',
  'call_result',
  'call_error',
  'call_timeout',
  'call_cancelled',
  'validation_error',
  'rate_limited',
]);

export const ToolEventSchema = AxonPulsEventSchema.extend({
  eventType: z.literal('tool_events'),
  payload: z.object({
    toolId: UUIDSchema,
    toolName: z.string().min(1).max(100),
    toolVersion: z.string().optional(),
    action: ToolActionSchema,
    input: z.record(z.string(), z.any()).optional(),
    output: z.record(z.string(), z.any()).optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.any()).optional(),
    }).optional(),
    duration: z.number().min(0).optional(),
    retryAttempt: z.number().int().min(0).default(0),
    timestamp: TimestampSchema,
    performance: z.object({
      executionTime: z.number().min(0),
      memoryUsed: z.number().min(0).optional(),
      apiCalls: z.number().int().min(0).optional(),
    }).optional(),
  }).strict(),
}).strict();

// Workflow Event Schemas
export const WorkflowActionSchema = z.enum([
  'start',
  'step_start',
  'step_complete',
  'step_error',
  'step_skip',
  'complete',
  'error',
  'pause',
  'resume',
  'cancel',
  'timeout',
]);

export const WorkflowStatusSchema = z.enum([
  'pending',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'timeout',
]);

export const WorkflowEventSchema = AxonPulsEventSchema.extend({
  eventType: z.literal('workflow_events'),
  payload: z.object({
    workflowId: UUIDSchema,
    workflowName: z.string().min(1).max(100),
    workflowVersion: z.string().optional(),
    stepId: UUIDSchema.optional(),
    stepName: z.string().optional(),
    action: WorkflowActionSchema,
    status: WorkflowStatusSchema,
    previousStatus: WorkflowStatusSchema.optional(),
    state: z.record(z.string(), z.any()).optional(),
    progress: z.object({
      current: z.number().int().min(0),
      total: z.number().int().min(1),
      percentage: z.number().min(0).max(100),
    }).optional(),
    result: z.record(z.string(), z.any()).optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      step: z.string().optional(),
      details: z.record(z.string(), z.any()).optional(),
    }).optional(),
    timestamp: TimestampSchema,
    duration: z.number().min(0).optional(),
    estimatedTimeRemaining: z.number().min(0).optional(),
  }).strict(),
}).strict();

// System Event Schemas
export const SystemEventLevelSchema = z.enum([
  'debug',
  'info',
  'warning',
  'error',
  'critical',
  'fatal',
]);

export const SystemComponentSchema = z.enum([
  'api_gateway',
  'websocket_gateway',
  'event_router',
  'message_queue',
  'connection_manager',
  'retry_manager',
  'health_monitor',
  'database',
  'redis',
  'auth_service',
  'unknown',
]);

export const SystemEventSchema = AxonPulsEventSchema.extend({
  eventType: z.literal('system_events'),
  payload: z.object({
    level: SystemEventLevelSchema,
    message: z.string().min(1).max(1000),
    component: SystemComponentSchema,
    category: z.string().optional(),
    details: z.record(z.string(), z.any()).optional(),
    error: z.object({
      name: z.string(),
      message: z.string(),
      stack: z.string().optional(),
      code: z.string().optional(),
    }).optional(),
    timestamp: TimestampSchema,
    environment: z.enum(['development', 'staging', 'production']).optional(),
    version: z.string().optional(),
    requestId: z.string().optional(),
    userId: UserIdSchema.optional(),
    sessionId: SessionIdSchema.optional(),
    metrics: z.object({
      cpu: z.number().min(0).max(100).optional(),
      memory: z.number().min(0).optional(),
      disk: z.number().min(0).max(100).optional(),
      network: z.number().min(0).optional(),
    }).optional(),
  }).strict(),
}).strict();

// Connection Event Schemas
export const ConnectionActionSchema = z.enum([
  'connect',
  'disconnect',
  'heartbeat',
  'reconnect',
  'error',
  'timeout',
  'quality_change',
  'subscription_change',
]);

export const ConnectionEventSchema = AxonPulsEventSchema.extend({
  eventType: z.literal('connection_events'),
  payload: z.object({
    connectionId: UUIDSchema,
    sessionId: SessionIdSchema,
    action: ConnectionActionSchema,
    status: ConnectionStatusSchema,
    quality: ConnectionQualitySchema.optional(),
    previousQuality: ConnectionQualitySchema.optional(),
    latency: z.number().min(0).optional(),
    clientInfo: z.object({
      userAgent: z.string().optional(),
      ip: z.string().optional(),
      clientType: ClientTypeSchema,
      version: z.string().optional(),
      platform: z.string().optional(),
    }).optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.any()).optional(),
    }).optional(),
    timestamp: TimestampSchema,
    duration: z.number().min(0).optional(),
    reconnectAttempts: z.number().int().min(0).optional(),
    subscriptions: z.array(ChannelNameSchema).optional(),
  }).strict(),
}).strict();

// Provider Event Schemas
export const ProviderActionSchema = z.enum([
  'request',
  'response',
  'error',
  'timeout',
  'rate_limited',
  'quota_exceeded',
  'authentication_failed',
]);

// Magic Event Schemas
export const MagicOperationTypeSchema = z.enum([
  'magic_set',
  'magic_array_insert',
  'magic_array_delete',
  'magic_array_move',
  'magic_object_merge',
]);

// Magic presence event types
export const MagicPresenceEventTypeSchema = z.enum([
  'presence_join',       // User joined room
  'presence_leave',      // User left room
  'presence_update',     // User updated cursor/selection
  'presence_heartbeat',  // Keep-alive signal
]);

export const ProviderEventSchema = AxonPulsEventSchema.extend({
  eventType: z.literal('provider_events'),
  payload: z.object({
    providerId: z.string(),
    providerName: z.string(),
    action: ProviderActionSchema,
    endpoint: z.string().optional(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(),
    statusCode: z.number().int().min(100).max(599).optional(),
    requestId: z.string().optional(),
    duration: z.number().min(0).optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.any()).optional(),
    }).optional(),
    timestamp: TimestampSchema,
    rateLimitInfo: z.object({
      limit: z.number().int().min(0),
      remaining: z.number().int().min(0),
      resetTime: TimestampSchema,
    }).optional(),
  }).strict(),
}).strict();

// Magic Event Schema - EXTENDS existing AxonPulsEventSchema
export const MagicEventSchema = AxonPulsEventSchema.extend({
  eventType: z.literal('magic_events'),
  payload: z.object({
    magicRoomId: UUIDSchema,
    stateKey: z.string().min(1).max(100),
    operation: z.object({
      type: MagicOperationTypeSchema,
      path: z.array(z.string()),
      value: z.any().optional(),
      index: z.number().int().min(0).optional(),
      timestamp: z.number().int().positive(),
      clientId: UUIDSchema,
      version: z.number().int().min(0),
      correlationId: z.string().optional(),
    }).strict(),
    currentState: z.record(z.string(), z.any()).optional(),
    previousState: z.record(z.string(), z.any()).optional(),
    conflictResolution: z.enum(['operational_transform', 'last_write_wins', 'first_write_wins', 'merge_strategy', 'user_choice', 'ai_resolution']).default('operational_transform'),
    metadata: z.object({
      userId: UserIdSchema.optional(),
      sessionId: SessionIdSchema.optional(),
      branchName: z.string().default('main'),
      snapshotId: UUIDSchema.optional(),
    }).optional(),
  }).strict(),
}).strict();

// Magic presence event schema
export const MagicPresenceEventSchema = AxonPulsEventSchema.extend({
  eventType: z.literal('magic_presence_events'),
  payload: z.object({
    magicRoomId: UUIDSchema,
    presenceType: MagicPresenceEventTypeSchema,
    userId: UserIdSchema,
    sessionId: SessionIdSchema,
    userName: z.string().min(1).max(100),
    userAvatar: z.string().url().optional(),
    cursorPosition: z.object({
      x: z.number(),
      y: z.number(),
      elementId: z.string().optional(),
    }).optional(),
    selection: z.object({
      start: z.number().int().min(0),
      end: z.number().int().min(0),
      elementId: z.string().optional(),
    }).optional(),
    viewportInfo: z.object({
      scrollX: z.number(),
      scrollY: z.number(),
      zoom: z.number().min(0.1).max(5),
    }).optional(),
    deviceInfo: z.object({
      userAgent: z.string().optional(),
      platform: z.string().optional(),
      screenWidth: z.number().int().positive().optional(),
      screenHeight: z.number().int().positive().optional(),
    }).optional(),
    isActive: z.boolean().default(true),
    lastSeen: TimestampSchema,
  }).strict(),
}).strict();

// ============================================================================
// API RESPONSE SCHEMAS
// ============================================================================

export const HealthResponseSchema = z.object({
  message: z.string(),
  timestamp: TimestampSchema,
  version: z.string(),
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  checks: z.record(z.string(), z.object({
    status: z.enum(['pass', 'fail', 'warn']),
    message: z.string().optional(),
    duration: z.number().min(0).optional(),
  })).optional(),
}).strict();

export const StatusResponseSchema = z.object({
  service: z.string(),
  version: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  timestamp: TimestampSchema,
  uptime: z.number().min(0),
  memory: z.object({
    rss: z.number().min(0),
    heapTotal: z.number().min(0),
    heapUsed: z.number().min(0),
    external: z.number().min(0),
    arrayBuffers: z.number().min(0),
  }),
  components: z.record(z.string(), z.enum(['healthy', 'degraded', 'unhealthy'])),
  metrics: z.object({
    activeConnections: z.number().int().min(0),
    totalEvents: z.number().int().min(0),
    averageLatency: z.number().min(0),
    errorRate: z.number().min(0).max(1),
  }).optional(),
}).strict();

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number().int().min(100).max(599),
  timestamp: TimestampSchema,
  path: z.string().optional(),
  requestId: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
}).strict();

// ============================================================================
// WEBSOCKET MESSAGE SCHEMAS
// ============================================================================

export const WebSocketMessageTypeSchema = z.enum([
  'subscribe',
  'unsubscribe',
  'publish',
  'ping',
  'pong',
  'ack',
  'error',
  'event',
  'heartbeat',
  'status',
]);

export const WebSocketMessageSchema = z.object({
  type: WebSocketMessageTypeSchema,
  id: z.string().optional(),
  channel: ChannelNameSchema.optional(),
  payload: z.record(z.string(), z.any()).optional(),
  metadata: z.object({
    timestamp: z.number().int().positive(),
    version: z.string().default('1.0'),
    correlationId: z.string().optional(),
    requestId: z.string().optional(),
    clientId: z.string().optional(),
  }).optional(),
  acknowledgment: z.boolean().default(false),
}).strict();

export const SubscriptionRequestSchema = z.object({
  channels: z.array(ChannelNameSchema).min(1).max(50),
  filters: z.record(z.string(), z.any()).optional(),
  acknowledgment: z.boolean().default(false),
  priority: EventPrioritySchema.default('NORMAL'),
  maxEvents: z.number().int().min(1).max(1000).optional(),
  batchSize: z.number().int().min(1).max(100).default(10),
}).strict();

export const UnsubscriptionRequestSchema = z.object({
  channels: z.array(ChannelNameSchema).min(1),
  immediate: z.boolean().default(false),
}).strict();

export const PublishRequestSchema = z.object({
  channel: ChannelNameSchema,
  eventType: EventTypeSchema,
  payload: z.record(z.string(), z.any()),
  priority: EventPrioritySchema.default('NORMAL'),
  acknowledgment: z.boolean().default(false),
  expiresIn: z.number().int().min(1).optional(), // seconds
  metadata: BaseMetadataSchema.optional(),
}).strict();

// ============================================================================
// BATCH OPERATION SCHEMAS
// ============================================================================

export const BatchEventSchema = z.object({
  events: z.array(AxonPulsEventSchema).min(1).max(100),
  batchId: UUIDSchema.optional(),
  ordered: z.boolean().default(false),
  failOnError: z.boolean().default(false),
}).strict();

export const BatchResultSchema = z.object({
  batchId: UUIDSchema,
  totalEvents: z.number().int().min(0),
  successCount: z.number().int().min(0),
  failureCount: z.number().int().min(0),
  results: z.array(z.object({
    eventId: z.string().optional(),
    success: z.boolean(),
    error: z.string().optional(),
  })),
  timestamp: TimestampSchema,
}).strict();

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

export const validateAxonPulsEvent = (data: unknown) => {
  try {
    return { success: true, data: AxonPulsEventSchema.parse(data), error: null };
  } catch (error) {
    return { success: false, data: null, error: error.message };
  }
};

export const validateWebSocketMessage = (data: unknown) => {
  try {
    return { success: true, data: WebSocketMessageSchema.parse(data), error: null };
  } catch (error) {
    return { success: false, data: null, error: error.message };
  }
};

export const validateSubscriptionRequest = (data: unknown) => {
  try {
    return { success: true, data: SubscriptionRequestSchema.parse(data), error: null };
  } catch (error) {
    return { success: false, data: null, error: error.message };
  }
};

export const validateLoginRequest = (data: unknown) => {
  try {
    return { success: true, data: LoginRequestSchema.parse(data), error: null };
  } catch (error) {
    return { success: false, data: null, error: error.message };
  }
};

export const validateRegisterRequest = (data: unknown) => {
  try {
    return { success: true, data: RegisterRequestSchema.parse(data), error: null };
  } catch (error) {
    return { success: false, data: null, error: error.message };
  }
};

export const validateEventByType = (eventType: string, data: unknown) => {
  try {
    switch (eventType) {
      case 'agent_events':
        return { success: true, data: AgentEventSchema.parse(data), error: null };
      case 'tool_events':
        return { success: true, data: ToolEventSchema.parse(data), error: null };
      case 'workflow_events':
        return { success: true, data: WorkflowEventSchema.parse(data), error: null };
      case 'system_events':
        return { success: true, data: SystemEventSchema.parse(data), error: null };
      case 'connection_events':
        return { success: true, data: ConnectionEventSchema.parse(data), error: null };
      case 'provider_events':
        return { success: true, data: ProviderEventSchema.parse(data), error: null };
      case 'magic_events':
        return { success: true, data: MagicEventSchema.parse(data), error: null };
      case 'magic_presence_events':
        return { success: true, data: MagicPresenceEventSchema.parse(data), error: null };
      default:
        return { success: true, data: AxonPulsEventSchema.parse(data), error: null };
    }
  } catch (error) {
    return { success: false, data: null, error: error.message };
  }
};

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Base types
export type ClientType = z.infer<typeof ClientTypeSchema>;
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;
export type ConnectionQuality = z.infer<typeof ConnectionQualitySchema>;
export type ChannelType = z.infer<typeof ChannelTypeSchema>;
export type EventPriority = z.infer<typeof EventPrioritySchema>;
export type EventStatus = z.infer<typeof EventStatusSchema>;

// Core types
export type AxonPulsEvent = z.infer<typeof AxonPulsEventSchema>;
export type AxonPulsConnection = z.infer<typeof AxonPulsConnectionSchema>;
export type AxonPulsChannel = z.infer<typeof AxonPulsChannelSchema>;
export type BaseMetadata = z.infer<typeof BaseMetadataSchema>;

// Authentication types
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

// Event-specific types
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type ToolEvent = z.infer<typeof ToolEventSchema>;
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;
export type SystemEvent = z.infer<typeof SystemEventSchema>;
export type ConnectionEvent = z.infer<typeof ConnectionEventSchema>;
export type ProviderEvent = z.infer<typeof ProviderEventSchema>;
export type MagicEvent = z.infer<typeof MagicEventSchema>;
export type MagicPresenceEvent = z.infer<typeof MagicPresenceEventSchema>;
export type MagicOperationType = z.infer<typeof MagicOperationTypeSchema>;
export type MagicPresenceEventType = z.infer<typeof MagicPresenceEventTypeSchema>;

// WebSocket types
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
export type SubscriptionRequest = z.infer<typeof SubscriptionRequestSchema>;
export type UnsubscriptionRequest = z.infer<typeof UnsubscriptionRequestSchema>;
export type PublishRequest = z.infer<typeof PublishRequestSchema>;

// Batch operation types
export type BatchEvent = z.infer<typeof BatchEventSchema>;
export type BatchResult = z.infer<typeof BatchResultSchema>;

// API response types
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type StatusResponse = z.infer<typeof StatusResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Union types for all events
export const AnyEventSchema = z.union([
  AgentEventSchema,
  ToolEventSchema,
  WorkflowEventSchema,
  SystemEventSchema,
  ConnectionEventSchema,
  ProviderEventSchema,
  MagicEventSchema,
]);

export type AnyEvent = z.infer<typeof AnyEventSchema>;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const createEventId = (): string => {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const createSessionId = (): string => {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const isValidEventType = (eventType: string): boolean => {
  const validTypes = [
    'agent_events',
    'tool_events',
    'workflow_events',
    'system_events',
    'connection_events',
    'provider_events',
    'magic_events',
    'magic_presence_events',
  ];
  return validTypes.includes(eventType);
};

export const getEventSchema = (eventType: string) => {
  switch (eventType) {
    case 'agent_events':
      return AgentEventSchema;
    case 'tool_events':
      return ToolEventSchema;
    case 'workflow_events':
      return WorkflowEventSchema;
    case 'system_events':
      return SystemEventSchema;
    case 'connection_events':
      return ConnectionEventSchema;
    case 'provider_events':
      return ProviderEventSchema;
    case 'magic_events':
      return MagicEventSchema;
    case 'magic_presence_events':
      return MagicPresenceEventSchema;
    default:
      return AxonPulsEventSchema;
  }
};

export const validateAndTransformEvent = (data: unknown): {
  success: boolean;
  event?: AxonPulsEvent;
  error?: string;
} => {
  try {
    const event = AxonPulsEventSchema.parse(data);

    // Additional business logic validation
    if (!event.createdAt) {
      event.createdAt = new Date().toISOString();
    }

    if (!event.id) {
      event.id = createEventId();
    }

    return { success: true, event };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const sanitizeEventPayload = (payload: Record<string, any>): Record<string, any> => {
  const sanitized = { ...payload };

  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey'];
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
};

// ============================================================================
// SCHEMA REGISTRY
// ============================================================================

export const SCHEMA_REGISTRY = {
  // Base schemas
  AxonPulsEvent: AxonPulsEventSchema,
  AxonPulsConnection: AxonPulsConnectionSchema,
  AxonPulsChannel: AxonPulsChannelSchema,

  // Event type schemas
  AgentEvent: AgentEventSchema,
  ToolEvent: ToolEventSchema,
  WorkflowEvent: WorkflowEventSchema,
  SystemEvent: SystemEventSchema,
  ConnectionEvent: ConnectionEventSchema,
  ProviderEvent: ProviderEventSchema,
  MagicEvent: MagicEventSchema,
  MagicPresenceEvent: MagicPresenceEventSchema,

  // WebSocket schemas
  WebSocketMessage: WebSocketMessageSchema,
  SubscriptionRequest: SubscriptionRequestSchema,
  UnsubscriptionRequest: UnsubscriptionRequestSchema,
  PublishRequest: PublishRequestSchema,

  // Auth schemas
  LoginRequest: LoginRequestSchema,
  RegisterRequest: RegisterRequestSchema,
  JwtPayload: JwtPayloadSchema,

  // API response schemas
  HealthResponse: HealthResponseSchema,
  StatusResponse: StatusResponseSchema,
  ErrorResponse: ErrorResponseSchema,

  // Batch schemas
  BatchEvent: BatchEventSchema,
  BatchResult: BatchResultSchema,
} as const;

export type SchemaName = keyof typeof SCHEMA_REGISTRY;

export const getSchemaByName = (name: SchemaName) => {
  return SCHEMA_REGISTRY[name];
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const EVENT_TYPES = {
  AGENT: 'agent_events',
  TOOL: 'tool_events',
  WORKFLOW: 'workflow_events',
  SYSTEM: 'system_events',
  CONNECTION: 'connection_events',
  PROVIDER: 'provider_events',
  MAGIC: 'magic_events',
  MAGIC_PRESENCE: 'magic_presence_events',
} as const;

export const CHANNEL_TYPES = {
  AGENT_EVENTS: 'AGENT_EVENTS',
  TOOL_EVENTS: 'TOOL_EVENTS',
  WORKFLOW_EVENTS: 'WORKFLOW_EVENTS',
  PROVIDER_EVENTS: 'PROVIDER_EVENTS',
  SYSTEM_EVENTS: 'SYSTEM_EVENTS',
  CONNECTION_EVENTS: 'CONNECTION_EVENTS',
  PRIVATE_USER: 'PRIVATE_USER',
  ORGANIZATION: 'ORGANIZATION',
  BROADCAST: 'BROADCAST',
} as const;

export const CLIENT_TYPES = {
  WEB_APP: 'WEB_APP',
  MOBILE_APP: 'MOBILE_APP',
  SDK_WIDGET: 'SDK_WIDGET',
  API_CLIENT: 'API_CLIENT',
  INTERNAL_SERVICE: 'INTERNAL_SERVICE',
  DESKTOP_APP: 'DESKTOP_APP',
  CLI_TOOL: 'CLI_TOOL',
  BROWSER_EXTENSION: 'BROWSER_EXTENSION',
} as const;

export const CONNECTION_STATUSES = {
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  RECONNECTING: 'RECONNECTING',
  SUSPENDED: 'SUSPENDED',
  FAILED: 'FAILED',
} as const;

export const EVENT_PRIORITIES = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
  URGENT: 'URGENT',
} as const;
