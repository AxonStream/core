import { Injectable, Logger } from '@nestjs/common';
import { EventStreamService, AxonPulsEvent } from '../../common/services/event-stream.service';
import { PrismaService } from '../../common/services/prisma.service';
import { RedisService } from '../../common/services/redis.service';

export interface EventRoute {
  eventType: string;
  channels: string[];
  filters?: Record<string, any>;
  transformations?: Array<(event: AxonPulsEvent) => AxonPulsEvent>;
}

export interface SubscriptionFilter {
  organizationId?: string;
  userId?: string;
  eventTypes?: string[];
  channels?: string[];
  customFilters?: Record<string, any>;
}

@Injectable()
export class EventRouterService {
  private readonly logger = new Logger(EventRouterService.name);
  private eventRoutes = new Map<string, EventRoute>();
  private activeSubscriptions = new Map<string, SubscriptionFilter>();

  constructor(
    private eventStreamService: EventStreamService,
    private prismaService: PrismaService,
    private redisService: RedisService,
  ) {
    this.initializeDefaultRoutes();
  }

  // Event Routing
  async routeEvent(event: AxonPulsEvent): Promise<void> {
    try {
      const routes = this.getRoutesForEvent(event);

      for (const route of routes) {
        // Apply transformations if any
        let processedEvent = event;
        if (route.transformations) {
          for (const transform of route.transformations) {
            processedEvent = transform(processedEvent);
          }
        }

        // Route to each channel
        for (const channel of route.channels) {
          await this.routeToChannel(processedEvent, channel);
        }
      }

      this.logger.debug(`Routed event ${event.eventType} to ${routes.length} routes`);
    } catch (error) {
      this.logger.error(`Failed to route event ${event.eventType}:`, error);
      throw error;
    }
  }

  // Subscription Management
  async createSubscription(
    subscriptionId: string,
    filter: SubscriptionFilter,
    callback: (event: AxonPulsEvent) => void
  ): Promise<void> {
    try {
      this.activeSubscriptions.set(subscriptionId, filter);

      // Subscribe to relevant channels
      const channels = filter.channels || this.getDefaultChannelsForFilter(filter);

      for (const channel of channels) {
        await this.subscribeToChannel(subscriptionId, channel, filter, callback);
      }

      this.logger.log(`Created subscription ${subscriptionId} for channels: ${channels.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to create subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  async removeSubscription(subscriptionId: string): Promise<void> {
    try {
      const filter = this.activeSubscriptions.get(subscriptionId);
      if (!filter) {
        this.logger.warn(`Subscription ${subscriptionId} not found`);
        return;
      }

      // Unsubscribe from channels
      const channels = filter.channels || this.getDefaultChannelsForFilter(filter);

      for (const channel of channels) {
        await this.unsubscribeFromChannel(subscriptionId, channel);
      }

      this.activeSubscriptions.delete(subscriptionId);
      this.logger.log(`Removed subscription ${subscriptionId}`);
    } catch (error) {
      this.logger.error(`Failed to remove subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  // Channel Management
  async createChannel(
    name: string,
    organizationId: string,
    type: string,
    permissions?: Record<string, any>
  ): Promise<void> {
    try {
      await this.prismaService.axonPulsChannel.create({
        data: {
          name,
          type: type as any,
          organizationId,
          permissions,
          isActive: true,
        },
      });

      this.logger.log(`Created channel ${name} for organization ${organizationId}`);
    } catch (error) {
      this.logger.error(`Failed to create channel ${name}:`, error);
      throw error;
    }
  }

  async getChannelPermissions(
    channelName: string,
    organizationId: string
  ): Promise<Record<string, any> | null> {
    try {
      const channel = await this.prismaService.axonPulsChannel.findFirst({
        where: {
          name: channelName,
          organizationId,
          isActive: true,
        },
      });

      return (channel?.permissions as Record<string, any>) || null;
    } catch (error) {
      this.logger.error(`Failed to get permissions for channel ${channelName}:`, error);
      return null;
    }
  }

  async validateChannelAccess(
    channelName: string,
    organizationId: string,
    userId?: string
  ): Promise<boolean> {
    try {
      const permissions = await this.getChannelPermissions(channelName, organizationId);

      if (!permissions) {
        // Default: allow access if no specific permissions set
        return true;
      }

      // Implement permission validation logic
      // This is a simplified version - in production, you'd have more complex ACL
      if (permissions.public === true) {
        return true;
      }

      if (userId && permissions.allowedUsers?.includes(userId)) {
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to validate channel access for ${channelName}:`, error);
      return false;
    }
  }

  // Event Filtering
  private matchesFilter(event: AxonPulsEvent, filter: SubscriptionFilter): boolean {
    // Organization filter
    if (filter.organizationId && event.organizationId !== filter.organizationId) {
      return false;
    }

    // User filter
    if (filter.userId && event.userId !== filter.userId) {
      return false;
    }

    // Event type filter
    if (filter.eventTypes && !filter.eventTypes.includes(event.eventType)) {
      return false;
    }

    // Channel filter
    if (filter.channels && !filter.channels.includes(event.channel)) {
      return false;
    }

    // Custom filters
    if (filter.customFilters) {
      for (const [key, value] of Object.entries(filter.customFilters)) {
        if (event.payload[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  // Private helper methods
  private initializeDefaultRoutes(): void {
    // Agent events route
    this.eventRoutes.set('agent_events', {
      eventType: 'agent_events',
      channels: ['agent_status', 'agent_actions'],
    });

    // Tool events route
    this.eventRoutes.set('tool_events', {
      eventType: 'tool_events',
      channels: ['tool_calls', 'tool_results'],
    });

    // Workflow events route
    this.eventRoutes.set('workflow_events', {
      eventType: 'workflow_events',
      channels: ['workflow_state', 'workflow_progress'],
    });

    // System events route
    this.eventRoutes.set('system_events', {
      eventType: 'system_events',
      channels: ['system_notifications', 'system_alerts'],
    });

    this.logger.log('Initialized default event routes');
  }

  private getRoutesForEvent(event: AxonPulsEvent): EventRoute[] {
    const routes: EventRoute[] = [];

    // Get specific route for event type
    const specificRoute = this.eventRoutes.get(event.eventType);
    if (specificRoute) {
      routes.push(specificRoute);
    }

    // Get wildcard routes
    const wildcardRoute = this.eventRoutes.get('*');
    if (wildcardRoute) {
      routes.push(wildcardRoute);
    }

    return routes;
  }

  private async routeToChannel(event: AxonPulsEvent, channel: string): Promise<void> {
    // Publish to Redis stream for the specific channel
    const channelEvent = {
      ...event,
      channel,
    };

    await this.eventStreamService.publishEvent(channelEvent);
  }

  private async subscribeToChannel(
    subscriptionId: string,
    channel: string,
    filter: SubscriptionFilter,
    callback: (event: AxonPulsEvent) => void
  ): Promise<void> {
    // Subscribe to Redis pub/sub for real-time events
    const channelKey = `AxonPuls:channels:${filter.organizationId}:${channel}`;

    await this.redisService.subscribe(channelKey, (event: AxonPulsEvent) => {
      if (this.matchesFilter(event, filter)) {
        callback(event);
      }
    });
  }

  private async unsubscribeFromChannel(
    subscriptionId: string,
    channel: string
  ): Promise<void> {
    // Implementation for unsubscribing from Redis pub/sub
    // This would require tracking subscriptions and their Redis connections
    this.logger.debug(`Unsubscribed ${subscriptionId} from channel ${channel}`);
  }

  private getDefaultChannelsForFilter(filter: SubscriptionFilter): string[] {
    // Return default channels based on filter criteria
    const defaultChannels = ['system_notifications'];

    if (filter.eventTypes) {
      for (const eventType of filter.eventTypes) {
        const route = this.eventRoutes.get(eventType);
        if (route) {
          defaultChannels.push(...route.channels);
        }
      }
    }

    return [...new Set(defaultChannels)]; // Remove duplicates
  }

  // Public API methods
  async addEventRoute(eventType: string, route: EventRoute): Promise<void> {
    this.eventRoutes.set(eventType, route);
    this.logger.log(`Added event route for ${eventType}`);
  }

  async removeEventRoute(eventType: string): Promise<void> {
    this.eventRoutes.delete(eventType);
    this.logger.log(`Removed event route for ${eventType}`);
  }

  getActiveSubscriptions(): Map<string, SubscriptionFilter> {
    return new Map(this.activeSubscriptions);
  }

  getEventRoutes(): Map<string, EventRoute> {
    return new Map(this.eventRoutes);
  }
}
