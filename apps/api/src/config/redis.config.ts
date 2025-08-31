import { registerAs } from '@nestjs/config';
import {
  safeParseInt,
  safeParseBool,
  isDevelopment,
  logConfigurationSummary,
} from './config.utils';

export const redisConfig = registerAs('redis', () => {
  const config = {
    host: process.env.REDIS_HOST || (isDevelopment() ? 'localhost' : undefined),
    port: safeParseInt(process.env.REDIS_PORT, 6379, { required: false }),
    password: process.env.REDIS_PASSWORD,
    db: safeParseInt(process.env.REDIS_DB, 0, { required: false }),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'AxonPuls:',
    retryDelayOnFailover: safeParseInt(process.env.REDIS_RETRY_DELAY, 100, { required: false }),
    maxRetriesPerRequest: safeParseInt(process.env.REDIS_MAX_RETRIES, 3, { required: false }),
    lazyConnect: true,
    keepAlive: 30000,
    family: 4,
    connectTimeout: 10000,
    commandTimeout: 5000,
    // Cluster configuration
    cluster: {
      enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
      nodes: process.env.REDIS_CLUSTER_NODES ? process.env.REDIS_CLUSTER_NODES.split(',') : [],
      options: {
        enableReadyCheck: true,
        redisOptions: {
          password: process.env.REDIS_PASSWORD,
        },
      },
    },
    // Multi-server coordination
    coordination: {
      serverRegistryKey: process.env.REDIS_SERVER_REGISTRY_KEY || 'axonpuls:servers:registry',
      crossServerChannel: process.env.REDIS_CROSS_SERVER_CHANNEL || 'axonpuls:cross-server:events',
      connectionTrackingPrefix: process.env.REDIS_CONNECTION_PREFIX || 'axonpuls:connections:',
      userServerMappingPrefix: process.env.REDIS_USER_SERVER_PREFIX || 'axonpuls:user-server:',
      messageTrackingPrefix: process.env.REDIS_MESSAGE_PREFIX || 'axonpuls:cross-server:messages:',
      migrationPrefix: process.env.REDIS_MIGRATION_PREFIX || 'axonpuls:migrations:',
    },
    nodes: process.env.REDIS_CLUSTER_NODES?.split(',') || [],
  },
    // Streams configuration
    streams: {
      maxLength: safeParseInt(process.env.REDIS_STREAM_MAX_LENGTH, 10000, { required: false }),
      consumerGroup: process.env.REDIS_CONSUMER_GROUP || 'AxonPuls-consumers',
        consumerName: process.env.REDIS_CONSUMER_NAME || 'AxonPuls-consumer-1',
          blockTime: safeParseInt(process.env.REDIS_STREAM_BLOCK_TIME, 5000, { required: false }),
            count: safeParseInt(process.env.REDIS_STREAM_COUNT, 10, { required: false }),
    },
  };

// Log configuration summary (with sensitive data redacted)
logConfigurationSummary('Redis', config);

return config;
});
