import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DemoService } from '../../modules/demo/demo.service';

/**
 * Demo Tracking Middleware
 * 
 * Automatically tracks demo user activity and provides seamless upgrade prompts
 * when users approach limits or expiration.
 */
@Injectable()
export class DemoTrackingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(DemoTrackingMiddleware.name);

  constructor(private readonly demoService: DemoService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Only process requests with demo users
    const user = (req as any).user;
    if (!user?.isDemo) {
      return next();
    }

    try {
      // Track API usage for demo session
      await this.trackDemoUsage(user, req);

      // Add upgrade prompt headers if needed
      this.addUpgradeHeaders(user, res);

      // Intercept response to add usage metadata
      this.interceptResponse(user, res);

    } catch (error) {
      this.logger.error(`Demo tracking failed: ${error.message}`);
      // Don't block the request if tracking fails
    }

    next();
  }

  /**
   * Track demo user activity
   */
  private async trackDemoUsage(user: any, req: Request): Promise<void> {
    const sessionId = user.userId;
    const endpoint = req.url;
    const method = req.method;

    // Determine feature category based on endpoint
    const featureCategory = this.categorizeEndpoint(endpoint);
    const featureName = this.extractFeatureName(endpoint);

    if (featureName && featureCategory) {
      // Track feature usage
      await this.demoService.trackFeatureUsage(sessionId, featureName, featureCategory, 0);

      // Check if limits are approaching
      const limits = await this.demoService.checkDemoLimits(sessionId, featureName);
      
      // Store limits in user object for response headers
      user.currentLimits = limits;
    }
  }

  /**
   * Add upgrade prompt headers to response
   */
  private addUpgradeHeaders(user: any, res: Response): void {
    // Add demo session metadata
    res.setHeader('X-Demo-Session', user.userId);
    res.setHeader('X-Demo-Expires-At', user.demoExpiresAt);
    res.setHeader('X-Demo-Time-Remaining', user.timeRemaining || 0);

    // Add upgrade prompt if expiring soon
    if (user.isExpiringSoon && user.upgradePrompt) {
      res.setHeader('X-Upgrade-Prompt', JSON.stringify(user.upgradePrompt));
    }

    // Add usage limits if available
    if (user.currentLimits) {
      res.setHeader('X-Usage-Limits', JSON.stringify({
        withinLimits: user.currentLimits.withinLimits,
        currentUsage: user.currentLimits.currentUsage,
        limit: user.currentLimits.limit,
        upgradePrompted: user.currentLimits.upgradePrompted,
      }));
    }

    // Add permissions count for debugging
    res.setHeader('X-Demo-Permissions', user.permissions?.length || 0);
  }

  /**
   * Intercept response to add usage metadata
   */
  private interceptResponse(user: any, res: Response): void {
    const originalJson = res.json;

    res.json = function(body: any) {
      // Add demo metadata to response body if it's an object
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        body._demo = {
          sessionId: user.userId,
          timeRemaining: user.timeRemaining,
          isExpiringSoon: user.isExpiringSoon,
          upgradePrompt: user.upgradePrompt,
          permissions: user.permissions?.length || 0,
          limits: user.currentLimits,
        };
      }

      return originalJson.call(this, body);
    };
  }

  /**
   * Categorize API endpoint into feature categories
   */
  private categorizeEndpoint(endpoint: string): string {
    if (endpoint.includes('/events')) return 'events';
    if (endpoint.includes('/channels')) return 'channels';
    if (endpoint.includes('/magic')) return 'collaboration';
    if (endpoint.includes('/webhooks')) return 'integrations';
    if (endpoint.includes('/monitoring')) return 'analytics';
    if (endpoint.includes('/audit')) return 'security';
    if (endpoint.includes('/connections')) return 'connections';
    if (endpoint.includes('/organizations')) return 'organizations';
    return 'general';
  }

  /**
   * Extract feature name from endpoint
   */
  private extractFeatureName(endpoint: string): string | null {
    // Extract feature from REST endpoints
    const patterns = [
      { pattern: /\/events/, feature: 'events' },
      { pattern: /\/channels/, feature: 'channels' },
      { pattern: /\/magic\/rooms/, feature: 'magicRooms' },
      { pattern: /\/magic/, feature: 'magic' },
      { pattern: /\/webhooks/, feature: 'webhooks' },
      { pattern: /\/connections/, feature: 'connections' },
      { pattern: /\/monitoring/, feature: 'monitoring' },
      { pattern: /\/audit/, feature: 'audit' },
    ];

    for (const { pattern, feature } of patterns) {
      if (pattern.test(endpoint)) {
        return feature;
      }
    }

    return null;
  }
}

/**
 * Demo Response Interceptor
 * 
 * Adds upgrade prompts and usage information to API responses
 * for seamless user experience.
 */
export class DemoResponseInterceptor {
  static addUpgradePrompt(response: any, user: any): any {
    if (!user?.isDemo) {
      return response;
    }

    // Add upgrade prompt for limit-approaching scenarios
    if (user.currentLimits && !user.currentLimits.withinLimits) {
      return {
        ...response,
        _upgradePrompt: {
          type: 'limit_reached',
          title: 'Demo Limit Reached',
          message: `You've reached the demo limit for this feature. Upgrade to continue with unlimited access.`,
          ctaText: 'Upgrade Now',
          ctaUrl: '/upgrade',
          currentUsage: user.currentLimits.currentUsage,
          limit: user.currentLimits.limit,
        },
      };
    }

    // Add time-based upgrade prompt
    if (user.isExpiringSoon) {
      return {
        ...response,
        _upgradePrompt: {
          type: 'time_expiring',
          title: 'Demo Expiring Soon',
          message: `Your demo expires in ${user.timeRemaining} minutes. Upgrade now to continue.`,
          ctaText: 'Upgrade Now',
          ctaUrl: '/upgrade',
          timeRemaining: user.timeRemaining,
          urgency: user.timeRemaining <= 10 ? 'critical' : 'high',
        },
      };
    }

    return response;
  }

  static addUsageMetadata(response: any, user: any): any {
    if (!user?.isDemo) {
      return response;
    }

    return {
      ...response,
      _demoMetadata: {
        sessionId: user.userId,
        timeRemaining: user.timeRemaining,
        permissions: user.permissions?.length || 0,
        expiresAt: user.demoExpiresAt,
        isExpiringSoon: user.isExpiringSoon,
      },
    };
  }
}

/**
 * Demo Usage Decorator
 * 
 * Decorator to automatically track feature usage for demo endpoints
 */
export function TrackDemoUsage(featureName: string, featureCategory: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);
      
      // Extract user from request context (assuming first arg is request or has user)
      const req = args.find(arg => arg?.user);
      const user = req?.user;

      if (user?.isDemo) {
        try {
          // Track usage asynchronously
          const demoService = this.demoService || this.moduleRef?.get(DemoService);
          if (demoService) {
            await demoService.trackFeatureUsage(user.userId, featureName, featureCategory);
          }
        } catch (error) {
          // Don't fail the request if tracking fails
          console.warn(`Demo usage tracking failed: ${error.message}`);
        }
      }

      return result;
    };

    return descriptor;
  };
}
