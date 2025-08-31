/**
 * 🎯 Demo Service - Zero Friction Onboarding
 * 
 * Provides demo functionality without authentication
 * Following market standards from Stripe, Firebase, Pusher
 */

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantAwareService } from '../../common/services/tenant-aware.service';
import { PrismaService } from '../../common/services/prisma.service';

export interface DemoEvent {
  id: string;
  channel: string;
  eventType: string;
  payload: any;
  timestamp: Date;
  source: 'demo';
}

export interface DemoChannel {
  name: string;
  description: string;
  eventCount: number;
  lastActivity: Date;
  sampleEvents: string[];
}

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  private readonly demoEvents: Map<string, DemoEvent[]> = new Map();
  private readonly rateLimitMap: Map<string, number[]> = new Map();
  private readonly RATE_LIMIT = 10; // 10 events per minute
  private readonly RATE_WINDOW = 60000; // 1 minute

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tenantAwareService: TenantAwareService,
    private readonly prismaService: PrismaService,
  ) {
    this.initializeDemoData();
  }

  /**
   * Generate demo access token
   */
  async generateDemoToken(): Promise<{
    success: boolean;
    token: string;
    org: string;
    expiresIn: string;
    expiresAt: string;
    limitations: any;
    nextSteps: any;
  }> {
    try {
      // Get or create demo organization
      const demoOrg = await this.getOrCreateDemoOrganization();

      // Generate demo token (2 hour expiry)
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const payload = {
        sub: `demo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        organizationId: demoOrg.id,
        organizationSlug: demoOrg.slug,
        roles: ['demo', 'developer'],
        permissions: [
          // Core Event System
          'events:read', 'events:write', 'events:publish', 'events:subscribe',

          // Channel Management
          'channels:read', 'channels:write', 'channels:subscribe', 'channels:create',
          'channels:replay', 'channels:history',

          // Magic Collaboration (Full Access)
          'magic:read', 'magic:write', 'magic:create', 'magic:join', 'magic:leave',
          'magic:presence', 'magic:timetravel', 'magic:branch', 'magic:merge',
          'magic:snapshot', 'magic:admin',

          // Monitoring & Analytics (Read Access)
          'monitoring:read', 'monitoring:dashboard', 'monitoring:export',
          'monitoring:alerts', 'monitoring:metrics', 'monitoring:health',

          // Performance & Latency Tracking
          'latency:read', 'latency:stats', 'latency:alerts', 'latency:export',
          'latency:dashboard', 'latency:health',

          // Audit & Compliance (Read Access)
          'audit:read', 'audit:logs', 'audit:summary', 'audit:security',
          'audit:export', 'audit:dashboard',

          // Subscription Management
          'subscriptions:read', 'subscriptions:write', 'subscriptions:create',
          'subscriptions:update', 'subscriptions:delete', 'subscriptions:validate',

          // Webhook Management
          'webhooks:read', 'webhooks:write', 'webhooks:create', 'webhooks:update',
          'webhooks:delete', 'webhooks:templates', 'webhooks:deliveries',

          // Token Management
          'tokens:read', 'tokens:widget', 'tokens:create',

          // Demo Features
          'demo:read', 'demo:write', 'demo:publish', 'demo:channels',
          'demo:events', 'demo:status', 'demo:upgrade',

          // Real-time Features
          'realtime:read', 'realtime:write', 'realtime:connect',
          'realtime:presence', 'realtime:broadcast',

          // Analytics & Usage
          'analytics:read', 'analytics:events', 'analytics:connections',
          'analytics:performance', 'analytics:insights', 'analytics:usage',

          // Health & Status
          'health:read', 'status:read', 'metrics:read',

          // Organization Features (Limited)
          'org:read', 'org:channels', 'org:events', 'org:subscriptions',

          // User Profile
          'profile:read', 'profile:update'
        ],
        isDemo: true,
        expiresAt: expiresAt.toISOString(),
      };

      const token = this.jwtService.sign(payload, { expiresIn: '2h' });

      return {
        success: true,
        token,
        org: demoOrg.slug,
        expiresIn: '2h',
        expiresAt: expiresAt.toISOString(),
        limitations: {
          maxChannels: 20,           // Increased for full exploration
          maxEvents: 1000,           // Increased for real testing
          maxMagicRooms: 5,          // Magic collaboration rooms
          maxWebhooks: 3,            // Webhook endpoints
          rateLimit: '50/minute',    // Higher rate limit for demos
          duration: '2 hours',
          features: 'Full platform access except admin functions'
        },
        accessGranted: {
          coreFeatures: ['Events', 'Channels', 'Subscriptions', 'Real-time'],
          magicCollaboration: ['Rooms', 'Presence', 'Time Travel', 'Branching'],
          monitoring: ['Dashboard', 'Metrics', 'Health Checks', 'Analytics'],
          webhooks: ['Create', 'Templates', 'Delivery Tracking'],
          audit: ['Logs', 'Security Events', 'Compliance Reports'],
          performance: ['Latency Tracking', 'Alerts', 'Trends']
        },
        nextSteps: {
          signup: '/auth/register',
          docs: 'https://docs.axonstream.ai',
          examples: 'https://github.com/axonstream/examples',
          upgrade: '/demo/upgrade',
          monitoring: '/api/v1/monitoring/dashboard',
          magic: '/api/v1/magic/rooms',
          webhooks: '/api/v1/webhooks'
        },
      };
    } catch (error) {
      this.logger.error(`Failed to generate demo token: ${error.message}`);
      throw new HttpException('Failed to generate demo token', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get available demo channels
   */
  async getDemoChannels(): Promise<{
    success: boolean;
    channels: DemoChannel[];
    totalChannels: number;
  }> {
    const channels: DemoChannel[] = [
      {
        name: 'demo-chat',
        description: 'Real-time chat demonstration',
        eventCount: this.demoEvents.get('demo-chat')?.length || 0,
        lastActivity: new Date(),
        sampleEvents: ['message', 'user_joined', 'user_left'],
      },
      {
        name: 'demo-notifications',
        description: 'System notifications and alerts',
        eventCount: this.demoEvents.get('demo-notifications')?.length || 0,
        lastActivity: new Date(),
        sampleEvents: ['alert', 'warning', 'info'],
      },
      {
        name: 'demo-analytics',
        description: 'Real-time analytics data',
        eventCount: this.demoEvents.get('demo-analytics')?.length || 0,
        lastActivity: new Date(),
        sampleEvents: ['page_view', 'user_action', 'conversion'],
      },
      {
        name: 'demo-collaboration',
        description: 'Collaborative editing and presence',
        eventCount: this.demoEvents.get('demo-collaboration')?.length || 0,
        lastActivity: new Date(),
        sampleEvents: ['cursor_move', 'text_edit', 'user_presence'],
      },
      {
        name: 'demo-iot',
        description: 'IoT sensor data simulation',
        eventCount: this.demoEvents.get('demo-iot')?.length || 0,
        lastActivity: new Date(),
        sampleEvents: ['sensor_reading', 'device_status', 'alert'],
      },
    ];

    return {
      success: true,
      channels,
      totalChannels: channels.length,
    };
  }

  /**
   * Publish demo event with rate limiting
   */
  async publishDemoEvent(eventData: {
    channel: string;
    eventType: string;
    payload: any;
  }): Promise<{
    success: boolean;
    eventId: string;
    message: string;
  }> {
    // Check rate limit
    const clientId = 'demo'; // In real implementation, use IP or session
    if (!this.checkRateLimit(clientId)) {
      throw new HttpException('Rate limit exceeded. Please wait before sending more events.', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Validate channel
    const validChannels = ['demo-chat', 'demo-notifications', 'demo-analytics', 'demo-collaboration', 'demo-iot'];
    if (!validChannels.includes(eventData.channel)) {
      throw new HttpException(`Invalid channel. Valid channels: ${validChannels.join(', ')}`, HttpStatus.BAD_REQUEST);
    }

    // Create demo event
    const event: DemoEvent = {
      id: `demo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      channel: eventData.channel,
      eventType: eventData.eventType,
      payload: eventData.payload,
      timestamp: new Date(),
      source: 'demo',
    };

    // Store event
    if (!this.demoEvents.has(eventData.channel)) {
      this.demoEvents.set(eventData.channel, []);
    }

    const channelEvents = this.demoEvents.get(eventData.channel)!;
    channelEvents.push(event);

    // Keep only last 100 events per channel
    if (channelEvents.length > 100) {
      channelEvents.splice(0, channelEvents.length - 100);
    }

    this.logger.log(`Demo event published: ${event.id} to ${eventData.channel}`);

    return {
      success: true,
      eventId: event.id,
      message: `Event published to ${eventData.channel}`,
    };
  }

  /**
   * Get demo events from channels
   */
  async getDemoEvents(channel?: string, limit: number = 20): Promise<{
    success: boolean;
    events: DemoEvent[];
    totalEvents: number;
    channel?: string;
  }> {
    let events: DemoEvent[] = [];

    if (channel) {
      events = this.demoEvents.get(channel) || [];
    } else {
      // Get events from all channels
      for (const channelEvents of this.demoEvents.values()) {
        events.push(...channelEvents);
      }
      // Sort by timestamp
      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    // Apply limit
    const limitedEvents = events.slice(0, limit);

    return {
      success: true,
      events: limitedEvents,
      totalEvents: events.length,
      channel,
    };
  }

  /**
   * Get demo environment status
   */
  async getDemoStatus(): Promise<{
    success: boolean;
    status: string;
    uptime: string;
    activeChannels: number;
    totalEvents: number;
    rateLimits: any;
    nextReset: string;
  }> {
    const totalEvents = Array.from(this.demoEvents.values())
      .reduce((sum, events) => sum + events.length, 0);

    const nextReset = new Date(Date.now() + this.RATE_WINDOW);

    return {
      success: true,
      status: 'healthy',
      uptime: process.uptime().toString(),
      activeChannels: this.demoEvents.size,
      totalEvents,
      rateLimits: {
        maxEventsPerMinute: this.RATE_LIMIT,
        windowMs: this.RATE_WINDOW,
      },
      nextReset: nextReset.toISOString(),
    };
  }

  /**
   * Get upgrade information
   */
  async getUpgradeInfo(data: { email?: string; useCase?: string }): Promise<{
    success: boolean;
    message: string;
    benefits: string[];
    pricing: any;
    nextSteps: any;
  }> {
    return {
      success: true,
      message: 'Ready to upgrade from demo to full AxonStream access?',
      benefits: [
        'Unlimited channels and events',
        'Custom organization setup',
        'Advanced security features',
        'Priority support',
        'Custom integrations',
        'Analytics and monitoring',
        'Team collaboration features',
      ],
      pricing: {
        starter: { price: '$29/month', events: '100K/month', channels: 'Unlimited' },
        professional: { price: '$99/month', events: '1M/month', channels: 'Unlimited' },
        enterprise: { price: 'Custom', events: 'Unlimited', channels: 'Unlimited' },
      },
      nextSteps: {
        signup: '/auth/register',
        contact: '/contact',
        pricing: '/pricing',
        demo: '/demo/enterprise',
      },
    };
  }

  /**
   * Initialize demo data
   */
  private initializeDemoData(): void {
    // Initialize demo channels with sample events
    const sampleEvents = [
      {
        channel: 'demo-chat',
        eventType: 'message',
        payload: { user: 'Demo User', message: 'Welcome to AxonStream demo!', timestamp: new Date() },
      },
      {
        channel: 'demo-notifications',
        eventType: 'info',
        payload: { title: 'Demo Started', message: 'Your demo session is now active', level: 'info' },
      },
      {
        channel: 'demo-analytics',
        eventType: 'page_view',
        payload: { page: '/demo', user: 'anonymous', timestamp: new Date() },
      },
    ];

    sampleEvents.forEach(event => {
      const demoEvent: DemoEvent = {
        id: `demo_init_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        channel: event.channel,
        eventType: event.eventType,
        payload: event.payload,
        timestamp: new Date(),
        source: 'demo',
      };

      if (!this.demoEvents.has(event.channel)) {
        this.demoEvents.set(event.channel, []);
      }
      this.demoEvents.get(event.channel)!.push(demoEvent);
    });

    this.logger.log('Demo data initialized');
  }

  /**
   * Get or create demo organization
   */
  private async getOrCreateDemoOrganization() {
    try {
      let demoOrg = await this.prismaService.organization.findUnique({
        where: { slug: 'demo-org' },
      });

      if (!demoOrg) {
        demoOrg = await this.prismaService.organization.create({
          data: {
            name: 'Demo Organization',
            slug: 'demo-org',
            description: 'Demonstration organization for AxonStream',
            settings: {
              isDemo: true,
              maxChannels: 5,
              maxEvents: 100,
              rateLimitPerMinute: 10,
            },
          },
        });
        this.logger.log('Demo organization created');
      }

      return demoOrg;
    } catch (error) {
      this.logger.error(`Failed to get/create demo organization: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check rate limit for demo events
   */
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const clientRequests = this.rateLimitMap.get(clientId) || [];

    // Remove old requests outside the window
    const validRequests = clientRequests.filter(timestamp => now - timestamp < this.RATE_WINDOW);

    if (validRequests.length >= this.RATE_LIMIT) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.rateLimitMap.set(clientId, validRequests);

    return true;
  }
}
