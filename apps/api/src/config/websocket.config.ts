import { registerAs } from '@nestjs/config';

export const websocketConfig = registerAs('websocket', () => ({
  port: parseInt(process.env.WS_PORT || '3001'),
  path: process.env.WS_PATH || '/ws',
  cors: {
    origin: process.env.WS_CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  compression: process.env.WS_COMPRESSION === 'true',
  maxPayloadLength: parseInt(process.env.WS_MAX_PAYLOAD_LENGTH || '16777216'), // 16MB
  idleTimeout: parseInt(process.env.WS_IDLE_TIMEOUT || '120'), // 2 minutes
  maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '10000'),
  heartbeat: {
    interval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000'), // 30 seconds
    timeout: parseInt(process.env.WS_HEARTBEAT_TIMEOUT || '60000'), // 1 minute
  },
  rateLimit: {
    windowMs: parseInt(process.env.WS_RATE_LIMIT_WINDOW || '60000'), // 1 minute
    max: parseInt(process.env.WS_RATE_LIMIT_MAX || '100'), // 100 messages per minute
  },
  channels: {
    maxSubscriptions: parseInt(process.env.WS_MAX_SUBSCRIPTIONS || '50'),
    defaultTtl: parseInt(process.env.WS_CHANNEL_TTL || '3600000'), // 1 hour
  },
  retry: {
    maxAttempts: parseInt(process.env.WS_RETRY_MAX_ATTEMPTS || '3'),
    backoffMultiplier: parseFloat(process.env.WS_RETRY_BACKOFF_MULTIPLIER || '2'),
    initialDelay: parseInt(process.env.WS_RETRY_INITIAL_DELAY || '1000'),
    maxDelay: parseInt(process.env.WS_RETRY_MAX_DELAY || '30000'),
  },
}));
