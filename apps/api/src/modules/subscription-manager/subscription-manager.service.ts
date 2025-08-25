import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/services/redis.service';
import { PrismaService } from '../../common/services/prisma.service';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { TenantAwareService, TenantContext } from '../../common/services/tenant-aware.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface Subscription {
  id: string;
  organizationId: string;
  userId: string;
  channel: string;
  filters?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface SubscriptionFilter {
  eventTypes?: string[];
  metadata?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high';
}

@Injectable()
export class SubscriptionManagerService {
  private readonly logger = new Logger(SubscriptionManagerService.name);
  private readonly subscriptions = new Map<string, Subscription>();

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly tenantDatabaseService: TenantDatabaseService,
    private readonly tenantAwareService: TenantAwareService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  async createSubscription(
    organizationId: string,
    userId: string,
    channel: string,
    filters?: SubscriptionFilter,
  ): Promise<Subscription> {
    try {
      // Create tenant context for audit logging
      const context = await this.tenantAwareService.createTenantContext(organizationId, userId);

      // Use tenant-aware database service
      const dbResult = await this.tenantDatabaseService.create(
        context,
        'AxonPulsSubscription',
        {
          userId,
          channel,
          filters: filters || {},
          isActive: true,
        },
        {
          audit: true,
        }
      );

      // Type the database result properly
      const subscription = dbResult as {
        id: string;
        organizationId: string;
        userId: string;
        channel: string;
        filters: any;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
      };

      const subscriptionData: Subscription = {
        id: subscription.id,
        organizationId: subscription.organizationId,
        userId: subscription.userId,
        channel: subscription.channel,
        filters: subscription.filters as Record<string, any>,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        isActive: subscription.isActive,
      };

      // Cache in Redis
      const redis = this.redisService.getRedisInstance();
      await redis.setEx(
        `subscription:${subscription.id}`,
        3600,
        JSON.stringify(subscriptionData),
      );

      // Add to organization set
      await redis.sAdd(
        `org:${organizationId}:subscriptions`,
        subscription.id,
      );

      // Add to channel set
      await redis.sAdd(
        `channel:${organizationId}:${channel}:subscribers`,
        userId,
      );

      this.eventEmitter.emit('subscription.created', subscriptionData);
      this.logger.log(`Created subscription: ${subscription.id}`);

      return subscriptionData;
    } catch (error) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
      throw error;
    }
  }

  async getSubscription(id: string): Promise<Subscription | null> {
    try {
      // Check Redis cache first
      const redis = this.redisService.getRedisInstance();
      const cached = await redis.get(`subscription:${id}`);

      if (cached && typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Fallback to database
      const subscription = await this.prismaService.axonPulsSubscription.findUnique({
        where: { id },
      });

      if (!subscription) {
        return null;
      }

      const subscriptionData: Subscription = {
        id: subscription.id,
        organizationId: subscription.organizationId,
        userId: subscription.userId,
        channel: subscription.channel,
        filters: subscription.filters as Record<string, any>,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        isActive: subscription.isActive,
      };

      // Cache for future use
      await redis.setEx(
        `subscription:${id}`,
        3600,
        JSON.stringify(subscriptionData),
      );

      return subscriptionData;
    } catch (error) {
      this.logger.error(`Failed to get subscription: ${error.message}`);
      return null;
    }
  }

  async getSubscriptionsByOrganization(
    organizationId: string,
  ): Promise<Subscription[]> {
    try {
      const subscriptions = await this.prismaService.axonPulsSubscription.findMany({
        where: { organizationId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      return subscriptions.map(subscription => ({
        id: subscription.id,
        organizationId: subscription.organizationId,
        userId: subscription.userId,
        channel: subscription.channel,
        filters: subscription.filters as Record<string, any>,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        isActive: subscription.isActive,
      }));
    } catch (error) {
      this.logger.error(`Failed to get organization subscriptions: ${error.message}`);
      return [];
    }
  }

  async getSubscriptionsByUser(
    organizationId: string,
    userId: string,
  ): Promise<Subscription[]> {
    try {
      const subscriptions = await this.prismaService.axonPulsSubscription.findMany({
        where: { organizationId, userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      return subscriptions.map(subscription => ({
        id: subscription.id,
        organizationId: subscription.organizationId,
        userId: subscription.userId,
        channel: subscription.channel,
        filters: subscription.filters as Record<string, any>,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        isActive: subscription.isActive,
      }));
    } catch (error) {
      this.logger.error(`Failed to get user subscriptions: ${error.message}`);
      return [];
    }
  }

  async getSubscribersForChannel(
    organizationId: string,
    channel: string,
  ): Promise<string[]> {
    try {
      const redis = this.redisService.getRedisInstance();
      const subscribers = await redis.sMembers(
        `channel:${organizationId}:${channel}:subscribers`,
      );

      return subscribers;
    } catch (error) {
      this.logger.error(`Failed to get channel subscribers: ${error.message}`);
      return [];
    }
  }

  async updateSubscription(
    id: string,
    updates: Partial<Subscription>,
  ): Promise<Subscription | null> {
    try {
      const subscription = await this.prismaService.axonPulsSubscription.update({
        where: { id },
        data: {
          filters: updates.filters,
          isActive: updates.isActive,
          updatedAt: new Date(),
        },
      });

      const subscriptionData: Subscription = {
        id: subscription.id,
        organizationId: subscription.organizationId,
        userId: subscription.userId,
        channel: subscription.channel,
        filters: subscription.filters as Record<string, any>,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        isActive: subscription.isActive,
      };

      // Update Redis cache
      const redis = this.redisService.getRedisInstance();
      await redis.setEx(
        `subscription:${id}`,
        3600,
        JSON.stringify(subscriptionData),
      );

      this.eventEmitter.emit('subscription.updated', subscriptionData);
      this.logger.log(`Updated subscription: ${id}`);

      return subscriptionData;
    } catch (error) {
      this.logger.error(`Failed to update subscription: ${error.message}`);
      return null;
    }
  }

  async deleteSubscription(id: string): Promise<boolean> {
    try {
      const subscription = await this.prismaService.axonPulsSubscription.update({
        where: { id },
        data: { isActive: false, updatedAt: new Date() },
      });

      // Remove from Redis
      const redis = this.redisService.getRedisInstance();
      await redis.del(`subscription:${id}`);
      await redis.sRem(
        `org:${subscription.organizationId}:subscriptions`,
        id,
      );
      await redis.sRem(
        `channel:${subscription.organizationId}:${subscription.channel}:subscribers`,
        subscription.userId,
      );

      this.eventEmitter.emit('subscription.deleted', { id });
      this.logger.log(`Deleted subscription: ${id}`);

      return true;
    } catch (error) {
      this.logger.error(`Failed to delete subscription: ${error.message}`);
      return false;
    }
  }

  async validateSubscription(
    organizationId: string,
    userId: string,
    channel: string,
  ): Promise<boolean> {
    try {
      const subscription = await this.prismaService.axonPulsSubscription.findFirst({
        where: {
          organizationId,
          userId,
          channel,
          isActive: true,
        },
      });

      return !!subscription;
    } catch (error) {
      this.logger.error(`Failed to validate subscription: ${error.message}`);
      return false;
    }
  }

  async applyFilters(
    subscription: Subscription,
    event: any,
  ): Promise<boolean> {
    if (!subscription.filters || Object.keys(subscription.filters).length === 0) {
      return true;
    }

    const filters = subscription.filters as SubscriptionFilter;

    // Check event types
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      if (!filters.eventTypes.includes(event.eventType)) {
        return false;
      }
    }

    // Check metadata filters
    if (filters.metadata && Object.keys(filters.metadata).length > 0) {
      for (const [key, value] of Object.entries(filters.metadata)) {
        if (event.metadata?.[key] !== value) {
          return false;
        }
      }
    }

    // Check priority
    if (filters.priority && event.priority) {
      const priorityOrder = { low: 1, medium: 2, high: 3 };
      if (priorityOrder[event.priority] < priorityOrder[filters.priority]) {
        return false;
      }
    }

    return true;
  }
}
