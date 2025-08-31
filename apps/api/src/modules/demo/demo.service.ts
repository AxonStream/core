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
import { SessionService } from '../auth/services/session.service';

export interface DemoEvent {
  id: string;
  channel: string;
  eventType: string;
  payload: any;
  timestamp: Date;
  source: 'demo';
}

export interface FeatureGateResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  currentUsage?: number;
  limit?: number;
  upgradePrompt?: {
    urgency: string;
    title: string;
    message: string;
    ctaText: string;
    ctaUrl: string;
  };
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
    private readonly sessionService: SessionService,
  ) {
    this.initializeDemoData();
  }

  /**
   * Generate demo access token
   */
  async generateDemoToken(req?: any): Promise<{
    success: boolean;
    token: string;
    org: string;
    expiresIn: string;
    expiresAt: string;
    sessionId: string;
    limitations: any;
    accessGranted: any;
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

      // Extract request metadata for analytics
      const ipAddress = req?.ip || req?.connection?.remoteAddress || 'unknown';
      const userAgent = req?.get('User-Agent') || 'unknown';

      // Create session-based demo authentication
      const session = await this.sessionService.createSession({
        userId: payload.sub,
        orgId: demoOrg.id,
        orgSlug: demoOrg.slug,
        roleIds: payload.roles,
        permissions: payload.permissions,
        pv: 1,
        ua: userAgent,
        ip: ipAddress,
        isDemo: true,
        demoExpiresAt: expiresAt,
        sessionType: 'demo',
      }, 1); // 1 day TTL for demo sessions

      // Generate a demo token for backward compatibility (if needed)
      const token = this.jwtService.sign(payload, { expiresIn: '2h' });

      // Create demo session record for analytics
      const sessionId = session.sid;
      const tokenHash = this.createTokenHash(token);

      await this.createDemoSession({
        sessionId,
        tokenHash,
        organizationId: demoOrg.id,
        ipAddress,
        userAgent,
        expiresAt,
      });

      return {
        success: true,
        token,
        org: demoOrg.slug,
        sessionId,
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
  async getUpgradeInfo(_data: { email?: string; useCase?: string }): Promise<{
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

  /**
   * Create token hash for session tracking
   */
  private createTokenHash(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create demo session record in database
   */
  private async createDemoSession(sessionData: {
    sessionId: string;
    tokenHash: string;
    organizationId: string;
    ipAddress: string;
    userAgent: string;
    expiresAt: Date;
  }): Promise<void> {
    try {
      await this.prismaService.demoSession.create({
        data: {
          sessionId: sessionData.sessionId,
          tokenHash: sessionData.tokenHash,
          organizationId: sessionData.organizationId,
          ipAddress: sessionData.ipAddress,
          userAgent: sessionData.userAgent,
          expiresAt: sessionData.expiresAt,
          usageStats: {
            eventsPublished: 0,
            channelsCreated: 0,
            magicRoomsJoined: 0,
            webhooksCreated: 0,
            apiCallsCount: 0,
          },
          currentLimits: {
            maxChannels: 20,
            maxEvents: 1000,
            maxMagicRooms: 5,
            maxWebhooks: 3,
            maxApiCalls: 10000,
            rateLimit: 50,
          },
          metadata: {
            createdVia: 'demo-token-generation',
            platform: 'web',
          },
        },
      });

      this.logger.log(`Demo session created: ${sessionData.sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to create demo session: ${error.message}`);
      // Don't throw error - session tracking is optional
    }
  }

  /**
   * Validate demo token and get session
   */
  async validateDemoSession(token: string): Promise<any> {
    try {
      // Verify JWT token
      const payload = this.jwtService.verify(token);

      if (!payload.isDemo) {
        return null;
      }

      // Get session from database
      const tokenHash = this.createTokenHash(token);
      const session = await this.prismaService.demoSession.findFirst({
        where: {
          sessionId: payload.sub,
          tokenHash,
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!session) {
        return null;
      }

      // Update last active time
      await this.prismaService.demoSession.update({
        where: { id: session.id },
        data: { lastActiveAt: new Date() },
      });

      return {
        sessionId: session.sessionId,
        organizationId: session.organizationId,
        expiresAt: session.expiresAt,
        usageStats: session.usageStats,
        currentLimits: session.currentLimits,
        isActive: session.isActive,
      };
    } catch (error) {
      this.logger.error(`Failed to validate demo session: ${error.message}`);
      return null;
    }
  }

  /**
   * Track feature usage for demo session
   */
  async trackFeatureUsage(sessionId: string, featureName: string, featureCategory: string, _currentUsage: number): Promise<void> {
    try {
      // Find existing feature usage record
      const existingUsage = await this.prismaService.featureUsage.findFirst({
        where: {
          sessionId,
          featureName,
        },
      });

      if (existingUsage) {
        // Update existing record
        await this.prismaService.featureUsage.update({
          where: { id: existingUsage.id },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        });
      } else {
        // Create new record
        await this.prismaService.featureUsage.create({
          data: {
            sessionId,
            featureName,
            featureCategory,
            usageCount: 1,
            usageContext: {
              userAgent: 'demo',
              ipAddress: 'demo',
            },
          },
        });
      }

      this.logger.debug(`Feature usage tracked: ${featureName} for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to track feature usage: ${error.message}`);
    }
  }

  /**
   * Check if demo session has reached limits
   */
  async checkDemoLimits(sessionId: string, featureName: string): Promise<{
    withinLimits: boolean;
    currentUsage: number;
    limit: number;
    upgradePrompted?: boolean;
  }> {
    try {
      const session = await this.prismaService.demoSession.findUnique({
        where: { sessionId },
        include: {
          featureUsage: {
            where: { featureName },
          },
        },
      });

      if (!session) {
        return { withinLimits: false, currentUsage: 0, limit: 0 };
      }

      const limits = session.currentLimits as any;
      const usage = session.featureUsage[0]?.usageCount || 0;
      const limit = limits[`max${featureName.charAt(0).toUpperCase() + featureName.slice(1)}`] || 0;

      const withinLimits = usage < limit;

      // Check if we should show upgrade prompt (at 80% of limit)
      const shouldPrompt = usage >= (limit * 0.8) && !session.featureUsage[0]?.upgradePrompted;

      if (shouldPrompt) {
        await this.prismaService.featureUsage.update({
          where: { id: session.featureUsage[0].id },
          data: {
            upgradePrompted: true,
            upgradePromptedAt: new Date(),
          },
        });
      }

      return {
        withinLimits,
        currentUsage: usage,
        limit,
        upgradePrompted: shouldPrompt,
      };
    } catch (error) {
      this.logger.error(`Failed to check demo limits: ${error.message}`);
      return { withinLimits: true, currentUsage: 0, limit: 0 };
    }
  }

  /**
   * Check feature gate access for demo users
   */
  async checkFeatureGateAccess(
    sessionId: string,
    featureName: string,
    _featureCategory: string
  ): Promise<FeatureGateResult> {
    try {
      // For now, allow all access for demo users with soft limits
      // This can be enhanced later with actual database checks

      const limits = await this.checkDemoLimits(sessionId, featureName);

      if (!limits.withinLimits) {
        return {
          allowed: true, // Soft limit - still allow access
          reason: 'Demo limit reached',
          upgradeRequired: false,
          currentUsage: limits.currentUsage,
          limit: limits.limit,
          upgradePrompt: {
            title: 'Demo Limit Reached',
            message: `You've reached the demo limit for ${featureName}. Upgrade to continue with unlimited access.`,
            ctaText: 'Upgrade Now',
            ctaUrl: '/upgrade',
            urgency: 'high',
          },
        };
      }

      return {
        allowed: true,
        reason: 'Demo access granted',
        currentUsage: limits.currentUsage,
        limit: limits.limit,
      };
    } catch (error) {
      this.logger.error(`Failed to check feature gate access: ${error.message}`);
      // Default to allowing access for demo users
      return {
        allowed: true,
        reason: 'Demo access granted (fallback)',
      };
    }
  }
}
