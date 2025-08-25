import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'AxonPuls:',
  retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  connectTimeout: 10000,
  commandTimeout: 5000,
  // Cluster configuration
  cluster: {
    enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
    nodes: process.env.REDIS_CLUSTER_NODES?.split(',') || [],
  },
  // Streams configuration
  streams: {
    maxLength: parseInt(process.env.REDIS_STREAM_MAX_LENGTH || '10000'),
    consumerGroup: process.env.REDIS_CONSUMER_GROUP || 'AxonPuls-consumers',
    consumerName: process.env.REDIS_CONSUMER_NAME || 'AxonPuls-consumer-1',
    blockTime: parseInt(process.env.REDIS_STREAM_BLOCK_TIME || '5000'),
    count: parseInt(process.env.REDIS_STREAM_COUNT || '10'),
  },
}));
