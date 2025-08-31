import { registerAs } from '@nestjs/config';
import {
  safeParseInt,
  safeParseFloat,
  safeParseBool,
  isDevelopment,
  logConfigurationSummary,
} from './config.utils';

export const websocketConfig = registerAs('websocket', () => {
  const config = {
    port: safeParseInt(process.env.WS_PORT, 3001, { required: false }),
    path: process.env.WS_PATH || '/ws',
    cors: {
      origin: process.env.WS_CORS_ORIGIN || (isDevelopment() ? 'http://localhost:3000' : undefined),
      credentials: true,
    },
    compression: safeParseBool(process.env.WS_COMPRESSION, false, { required: false }),
    maxPayloadLength: safeParseInt(process.env.WS_MAX_PAYLOAD_LENGTH, 16777216, { required: false }), // 16MB
    idleTimeout: safeParseInt(process.env.WS_IDLE_TIMEOUT, 120, { required: false }), // 2 minutes
    maxConnections: safeParseInt(process.env.WS_MAX_CONNECTIONS, 10000, { required: false }),
    heartbeat: {
      interval: safeParseInt(process.env.WS_HEARTBEAT_INTERVAL, 30000, { required: false }), // 30 seconds
      timeout: safeParseInt(process.env.WS_HEARTBEAT_TIMEOUT, 60000, { required: false }), // 1 minute
    },
    rateLimit: {
      windowMs: safeParseInt(process.env.WS_RATE_LIMIT_WINDOW, 60000, { required: false }), // 1 minute
      max: safeParseInt(process.env.WS_RATE_LIMIT_MAX, 100, { required: false }), // 100 messages per minute
    },
    channels: {
      maxSubscriptions: safeParseInt(process.env.WS_MAX_SUBSCRIPTIONS, 50, { required: false }),
      defaultTtl: safeParseInt(process.env.WS_CHANNEL_TTL, 3600000, { required: false }), // 1 hour
    },
    retry: {
      maxAttempts: safeParseInt(process.env.WS_RETRY_MAX_ATTEMPTS, 3, { required: false }),
      backoffMultiplier: safeParseFloat(process.env.WS_RETRY_BACKOFF_MULTIPLIER, 2, { required: false }),
      initialDelay: safeParseInt(process.env.WS_RETRY_INITIAL_DELAY, 1000, { required: false }),
      maxDelay: safeParseInt(process.env.WS_RETRY_MAX_DELAY, 30000, { required: false }),
    },
  };

  // Log configuration summary (with sensitive data redacted)
  logConfigurationSummary('WebSocket', config);

  return config;
});
