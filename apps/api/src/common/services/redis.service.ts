import { Injectable, Logger } from '@nestjs/common';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private static client: RedisClientType;
  private static pubSubClient: RedisClientType;
  private static isConnected = false;
  private static isPubSubConnected = false;
  private static connectionPromise: Promise<void> | null = null;
  private static pubSubConnectionPromise: Promise<void> | null = null;

  constructor() {
    if (!RedisService.client) {
      RedisService.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });

      RedisService.client.on('error', (err) => {
        this.logger.error('Redis Client Error', err);
      });

      RedisService.client.on('connect', () => {
        this.logger.log('Redis Client Connected');
        RedisService.isConnected = true;
      });

      RedisService.client.on('disconnect', () => {
        this.logger.warn('Redis Client Disconnected');
        RedisService.isConnected = false;
      });
    }

    if (!RedisService.pubSubClient) {
      RedisService.pubSubClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });

      RedisService.pubSubClient.on('error', (err) => {
        this.logger.error('Redis PubSub Client Error', err);
      });

      RedisService.pubSubClient.on('connect', () => {
        this.logger.log('Redis PubSub Client Connected');
        RedisService.isPubSubConnected = true;
      });

      RedisService.pubSubClient.on('disconnect', () => {
        this.logger.warn('Redis PubSub Client Disconnected');
        RedisService.isPubSubConnected = false;
      });
    }
  }

  get client(): RedisClientType {
    return RedisService.client;
  }

  get pubSubClient(): RedisClientType {
    return RedisService.pubSubClient;
  }

  get isConnected(): boolean {
    return RedisService.isConnected;
  }

  get isPubSubConnected(): boolean {
    return RedisService.isPubSubConnected;
  }

  async onModuleInit() {
    // Connect both clients
    await Promise.all([
      this.connectToRedis(),
      this.connectToPubSubRedis()
    ]);
  }

  private async connectToRedis(): Promise<void> {
    if (RedisService.connectionPromise) {
      await RedisService.connectionPromise;
      return;
    }

    if (RedisService.isConnected) {
      return;
    }

    RedisService.connectionPromise = this._connectToRedis();

    try {
      await RedisService.connectionPromise;
    } finally {
      RedisService.connectionPromise = null;
    }
  }

  private async connectToPubSubRedis(): Promise<void> {
    if (RedisService.pubSubConnectionPromise) {
      await RedisService.pubSubConnectionPromise;
      return;
    }

    if (RedisService.isPubSubConnected) {
      return;
    }

    RedisService.pubSubConnectionPromise = this._connectToPubSubRedis();

    try {
      await RedisService.pubSubConnectionPromise;
    } finally {
      RedisService.pubSubConnectionPromise = null;
    }
  }

  private async _connectToRedis(): Promise<void> {
    try {
      await RedisService.client.connect();
    } catch (error: any) {
      if (error.message && error.message.includes('Socket already opened')) {
        this.logger.debug('Redis client already connected');
        RedisService.isConnected = true;
      } else {
        this.logger.error('Failed to connect to Redis:', error);
        throw error;
      }
    }
  }

  private async _connectToPubSubRedis(): Promise<void> {
    try {
      await RedisService.pubSubClient.connect();
    } catch (error: any) {
      if (error.message && error.message.includes('Socket already opened')) {
        this.logger.debug('Redis pubsub client already connected');
        RedisService.isPubSubConnected = true;
      } else {
        this.logger.error('Failed to connect to Redis PubSub:', error);
        throw error;
      }
    }
  }

  async onModuleDestroy() {
    if (RedisService.isConnected) {
      await RedisService.client.disconnect();
      RedisService.isConnected = false;
    }
    if (RedisService.isPubSubConnected) {
      await RedisService.pubSubClient.disconnect();
      RedisService.isPubSubConnected = false;
    }
  }

  getRedisInstance(): RedisClientType {
    return RedisService.client;
  }

  getPubSubInstance(): RedisClientType {
    return RedisService.pubSubClient;
  }

  // Pub/Sub methods using dedicated pubsub client
  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    await RedisService.pubSubClient.subscribe(channel, callback);
  }

  async unsubscribe(channel: string): Promise<void> {
    await RedisService.pubSubClient.unsubscribe(channel);
  }

  async publish(channel: string, message: any): Promise<number> {
    return await RedisService.pubSubClient.publish(channel, JSON.stringify(message));
  }

  // Regular Redis operations using main client
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await RedisService.client.setEx(key, ttl, value);
    } else {
      await RedisService.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    const result = await RedisService.client.get(key);
    return result as string | null;
  }

  async del(key: string): Promise<number> {
    return await RedisService.client.del(key);
  }

  async exists(key: string): Promise<number> {
    return await RedisService.client.exists(key);
  }

  async expire(key: string, ttl: number): Promise<number> {
    return await RedisService.client.expire(key, ttl);
  }

  async sadd(key: string, members: string[]): Promise<number> {
    return await this.client.sAdd(key, members);
  }

  async srem(key: string, members: string[]): Promise<number> {
    return await this.client.sRem(key, members);
  }

  async smembers(key: string): Promise<string[]> {
    const result = await this.client.sMembers(key);
    return result as string[];
  }

  async sismember(key: string, member: string): Promise<number> {
    return await this.client.sIsMember(key, member);
  }

  async lpush(key: string, elements: string[]): Promise<number> {
    return await this.client.lPush(key, elements);
  }

  async rpush(key: string, elements: string[]): Promise<number> {
    return await this.client.rPush(key, elements);
  }

  async lpop(key: string): Promise<string | null> {
    const result = await this.client.lPop(key);
    return result as string | null;
  }

  async rpop(key: string): Promise<string | null> {
    const result = await this.client.rPop(key);
    return result as string | null;
  }

  async llen(key: string): Promise<number> {
    return await this.client.lLen(key);
  }

  async readFromStream(streamKey: string, startId?: string, count?: number): Promise<any[]> {
    try {
      const result = await this.client.xRead(
        { key: streamKey, id: startId || '0' },
        {
          COUNT: count || 10,
          BLOCK: 0,
        }
      );

      if (!result) return [];

      return result[0].messages.map(msg => ({
        id: msg.id,
        fields: msg.message
      }));
    } catch (error) {
      return [];
    }
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.client.setEx(key, ttl, value);
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    return await this.client.hIncrBy(key, field, increment);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return await this.client.zAdd(key, { score, value: member });
  }

  async zrangebyscore(key: string, min: number, max: number, options?: {
    limit?: { offset: number; count: number };
  }): Promise<string[]> {
    if (options?.limit) {
      return await this.client.zRangeByScore(key, min, max, {
        LIMIT: {
          offset: options.limit.offset,
          count: options.limit.count,
        },
      });
    }
    return await this.client.zRangeByScore(key, min, max);
  }

  async xlen(key: string): Promise<number> {
    return await this.client.xLen(key);
  }

  async call(command: string, ...args: any[]): Promise<any> {
    return await this.client.sendCommand([command, ...args]);
  }

  async sendCommand(command: string[]): Promise<any> {
    return await this.client.sendCommand(command);
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async incrBy(key: string, increment: number): Promise<number> {
    return await this.client.incrBy(key, increment);
  }

  async decrBy(key: string, decrement: number): Promise<number> {
    return await this.client.decrBy(key, decrement);
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  async createConsumerGroup(streamKey: string, groupName: string, startId: string): Promise<void> {
    try {
      // Ensure we're connected before creating consumer group
      if (!this.isConnected) {
        await this.client.connect();
      }

      await this.client.xGroupCreate(streamKey, groupName, startId, { MKSTREAM: true });
    } catch (error: any) {
      // Ignore if group already exists
      if (error.message && error.message.includes('BUSYGROUP')) {
        this.logger.debug(`Consumer group ${groupName} already exists for stream ${streamKey}`);
        return;
      }

      // Handle client closed error gracefully
      if (error.message && error.message.includes('client is closed')) {
        this.logger.warn(`Redis client closed, attempting to reconnect for stream ${streamKey}`);
        try {
          await this.client.connect();
          await this.client.xGroupCreate(streamKey, groupName, startId, { MKSTREAM: true });
        } catch (retryError: any) {
          if (retryError.message && retryError.message.includes('BUSYGROUP')) {
            this.logger.debug(`Consumer group ${groupName} already exists after reconnect`);
            return;
          }
          throw retryError;
        }
        return;
      }

      // Handle socket already opened error
      if (error.message && error.message.includes('Socket already opened')) {
        this.logger.debug(`Redis socket already open for stream ${streamKey}, proceeding with group creation`);
        try {
          await this.client.xGroupCreate(streamKey, groupName, startId, { MKSTREAM: true });
        } catch (retryError: any) {
          if (retryError.message && retryError.message.includes('BUSYGROUP')) {
            this.logger.debug(`Consumer group ${groupName} already exists`);
            return;
          }
          // If still failing, just continue - the consumer group will be created on-demand
          this.logger.warn(`Could not create consumer group ${groupName} for ${streamKey}:`, retryError.message);
        }
        return;
      }

      throw error;
    }
  }

  async addToStream(streamKey: string, data: any, maxLength?: number): Promise<string> {
    const fields = this.flattenObject(data);
    return await this.client.xAdd(streamKey, '*', fields, { TRIM: { strategy: 'MAXLEN', threshold: maxLength || 1000 } });
  }

  async readFromConsumerGroup(streamKey: string, groupName: string, consumerName: string, count?: number, block?: number): Promise<any[]> {
    const result = await this.client.xReadGroup(groupName, consumerName, { key: streamKey, id: '>' }, { COUNT: count, BLOCK: block });
    if (!result) return [];

    return result[0].messages.map(msg => ({
      id: msg.id,
      fields: msg.message
    }));
  }

  async acknowledgeMessage(streamKey: string, groupName: string, messageId: string): Promise<void> {
    await this.client.xAck(streamKey, groupName, messageId);
  }

  async ping(): Promise<string> {
    return await this.client.ping();
  }

  async getStreamLength(streamKey: string): Promise<number> {
    return await this.client.xLen(streamKey);
  }

  async getConsumerGroupInfo(streamKey: string): Promise<any> {
    try {
      const info = await this.client.xInfoGroups(streamKey);
      return info;
    } catch (error) {
      return [];
    }
  }

  private flattenObject(obj: any, prefix = ''): Record<string, string> {
    const flattened: Record<string, string> = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(flattened, this.flattenObject(value, newKey));
        } else {
          flattened[newKey] = typeof value === 'string' ? value : JSON.stringify(value);
        }
      }
    }

    return flattened;
  }
}
