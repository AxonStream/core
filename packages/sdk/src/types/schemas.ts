/**
 * 📋 SDK TYPE SCHEMAS
 * 
 * Re-exports of all the type definitions from the existing API schemas
 * This ensures consistency between client and server
 */

// 🛡️ SELF-CONTAINED TYPES - No workspace boundary violations

// Define core event interfaces locally
export interface AxonPulsEvent {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  metadata?: EventMetadata;
}

export interface EventMetadata {
  correlation_id?: string;
  org_id: string;
  channel?: string;
  stream_entry_id?: string;
  timestamp?: number;
}

export interface ChannelSubscription {
  channel: string;
  subscribed_at: string;
  options?: {
    replay_from?: string;
    replay_count?: number;
    filter?: string;
  };
}

export interface WebSocketMessage {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

export interface ErrorResponse {
  id: string;
  type: 'error';
  payload: {
    type: string;
    error: {
      code: string;
      message: string;
    };
  };
  timestamp: number;
}

// Define missing types locally
export type ClientType = 'web' | 'mobile' | 'server' | 'webhook';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export type ChannelType = 'magic_room' | 'presence' | 'events' | 'system';
export type EventPriority = 'low' | 'normal' | 'high' | 'critical';

export interface ConnectionQuality {
  latency: number;
  stability: 'poor' | 'fair' | 'good' | 'excellent';
  packetLoss: number;
}

export interface EventStatus {
  delivered: boolean;
  acknowledged: boolean;
  timestamp: number;
}

// Magic operation types
export type MagicOperationType = 'magic_set' | 'magic_array_insert' | 'magic_array_delete' | 'magic_array_move' | 'magic_object_merge';
export type MagicPresenceEventType = 'user_joined' | 'user_left' | 'presence_updated' | 'cursor_moved' | 'selection_changed';

// Additional SDK-specific types
export interface SDKEventMap {
  connect: void;
  connecting: void;
  connected: void;
  disconnect: { reason: string };
  disconnected: { reason?: string };
  reconnecting: { attempt: number; delay: number };
  error: Error;
  event: any;
  subscribed: { channels: string[] };
  unsubscribed: { channels: string[] };
  published: { channel: string; event: any };
  ack: any;
  rate_limit: any;
  token_refreshed: void;
  magic_operation_received: any;
  magic_state_synced: any;
  presence_user_joined: any;
  presence_user_left: any;
  presence_updated: any;
  [eventType: string]: any;
}

export interface SDKConfig {
  url: string;
  token?: string;
  apiKey?: string;
  organization?: string;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  maxPayloadSize?: number;
  debug?: boolean;
}

export interface SDKConnectionOptions {
  forceReconnect?: boolean;
  timeout?: number;
  retryAttempts?: number;
}

export interface SDKSubscriptionOptions {
  filters?: Record<string, any>;
  acknowledgment?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'critical' | 'urgent';
  maxEvents?: number;
  batchSize?: number;
}

export interface SDKPublishOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical' | 'urgent';
  acknowledgment?: boolean;
  expiresIn?: number;
  metadata?: Record<string, any>;
}

export interface SDKReplayOptions {
  startTime?: string | Date;
  endTime?: string | Date;
  count?: number;
  filters?: Record<string, any>;
}

export interface SDKMetrics {
  connectionLatency: number;
  messageLatency: number;
  reconnectCount: number;
  errorCount: number;
  messageCount: number;
  activeChannels: number;
  uptime: number;
}

export interface SDKHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: Date;
  metrics: SDKMetrics;
  lastError?: Error;
}

export interface SDKError extends Error {
  code: string;
  details?: any;
  retryable?: boolean;
  timestamp: Date;
}
