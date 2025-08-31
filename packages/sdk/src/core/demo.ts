/**
 * 🎯 Demo Client
 * 
 * Production-grade demo management with upgrade functionality,
 * usage tracking, and seamless demo-to-production conversion.
 */

import { BaseClient } from './base-client';
import { AxonPulsError } from './errors';
import type { AxonPulsEvent } from '../types/schemas';

export interface DemoSession {
  sessionId: string;
  token: string;
  organizationSlug: string;
  expiresIn: string;
  expiresAt: string;
  limitations: {
    maxChannels: number;
    maxEvents: number;
    maxMagicRooms: number;
    maxWebhooks: number;
    rateLimit: string;
    duration: string;
    features: string;
  };
}

export interface DemoStatus {
  active: boolean;
  sessionsCount: number;
  eventsCount: number;
  uptime: number;
  version: string;
  environment: 'demo';
}

export interface UpgradeOptions {
  success: boolean;
  message: string;
  benefits: string[];
  pricing: {
    starter: { price: string; events: string; channels: string };
    professional: { price: string; events: string; channels: string };
    enterprise: { price: string; events: string; channels: string };
  };
  nextSteps: {
    contact: string;
    documentation: string;
    migration: string;
  };
}

export interface UpgradeRequest {
  email?: string;
  useCase?: string;
  planType: 'starter' | 'professional' | 'enterprise';
  paymentMethod?: PaymentMethod;
  sessionId?: string;
  organizationName?: string;
  estimatedUsers?: number;
  estimatedEvents?: number;
}

export interface PaymentMethod {
  type: 'card' | 'bank_transfer' | 'invoice';
  cardToken?: string;
  billingAddress?: {
    name: string;
    email: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export interface UpgradeResult {
  success: boolean;
  organizationId?: string;
  accessToken?: string;
  refreshToken?: string;
  redirectUrl?: string;
  message: string;
  nextSteps: string[];
  migrationStatus?: {
    dataTransferred: boolean;
    channelsPreserved: boolean;
    webhooksTransferred: boolean;
    settingsApplied: boolean;
  };
}

export interface DemoLimits {
  withinLimits: boolean;
  currentUsage: number;
  limit: number;
  upgradePrompted?: boolean;
  feature: string;
  percentage: number;
}

export interface FeatureUsage {
  sessionId: string;
  featureName: string;
  featureCategory: string;
  usageCount?: number;
}

/**
 * Demo Client
 * Handles demo session management, upgrade functionality, and usage tracking
 */
export class DemoClient extends BaseClient {
  private currentSession?: DemoSession;

  /**
   * Create demo session
   */
  async createSession(email?: string): Promise<DemoSession> {
    try {
      const response = await this.apiClient.post('/api/v1/demo/token', {
        email: email || `demo-${Date.now()}@example.com`,
        source: 'sdk',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SDK',
      });

      this.currentSession = response.data;
      return this.currentSession!;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to create demo session',
        'DEMO_SESSION_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { operation: 'demo_session_creation' }
      );
    }
  }

  /**
   * Get demo environment status
   */
  async getStatus(): Promise<DemoStatus> {
    try {
      const response = await this.apiClient.get('/api/v1/demo/status');
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get demo status',
        'DEMO_STATUS_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { operation: 'demo_status_check' }
      );
    }
  }

  /**
   * Get upgrade options and pricing information
   */
  async getUpgradeOptions(data?: { email?: string; useCase?: string }): Promise<UpgradeOptions> {
    try {
      const response = await this.apiClient.post('/api/v1/demo/upgrade', data || {});
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get upgrade options',
        'UPGRADE_OPTIONS_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { operation: 'upgrade_options_fetch' }
      );
    }
  }

  /**
   * Initiate upgrade process from demo to production
   */
  async upgrade(request: UpgradeRequest): Promise<UpgradeResult> {
    try {
      this.validateUpgradeRequest(request);

      const response = await this.apiClient.post('/api/v1/demo/upgrade/process', {
        ...request,
        sessionId: request.sessionId || this.currentSession?.sessionId,
      });

      const result: UpgradeResult = response.data;

      // If upgrade successful, clear demo session
      if (result.success && result.accessToken) {
        this.currentSession = undefined;
      }

      return result;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to process upgrade',
        'UPGRADE_PROCESS_FAILED',
        error.response?.status || 500,
        error.response?.data,
        {
          operation: 'upgrade_process',
          planType: request.planType,
          hasPaymentMethod: !!request.paymentMethod
        }
      );
    }
  }

  /**
   * Validate demo session
   */
  async validateSession(token?: string): Promise<DemoSession | null> {
    try {
      const tokenToValidate = token || this.currentSession?.token;

      if (!tokenToValidate) {
        return null;
      }

      const response = await this.apiClient.post('/api/v1/demo/session/validate', {
        token: tokenToValidate
      });

      return response.data.valid ? response.data.session : null;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to validate demo session',
        'DEMO_VALIDATION_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { operation: 'demo_session_validation' }
      );
    }
  }

  /**
   * Track feature usage in demo
   */
  async trackFeatureUsage(usage: FeatureUsage): Promise<DemoLimits> {
    try {
      const sessionId = usage.sessionId || this.currentSession?.sessionId;

      if (!sessionId) {
        throw new AxonPulsError(
          'No demo session available for tracking',
          'DEMO_SESSION_MISSING',
          400,
          null,
          { operation: 'feature_usage_tracking' }
        );
      }

      const response = await this.apiClient.post('/api/v1/demo/usage/track', {
        sessionId,
        featureName: usage.featureName,
        featureCategory: usage.featureCategory,
      });

      return {
        ...response.data.limits,
        feature: usage.featureName,
        percentage: Math.round((response.data.limits.currentUsage / response.data.limits.limit) * 100)
      };
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to track feature usage',
        'FEATURE_TRACKING_FAILED',
        error.response?.status || 500,
        error.response?.data,
        {
          operation: 'feature_usage_tracking',
          feature: usage.featureName
        }
      );
    }
  }

  /**
   * Check demo limits for specific feature
   */
  async checkLimits(feature: string, sessionId?: string): Promise<DemoLimits> {
    try {
      const sessionToCheck = sessionId || this.currentSession?.sessionId;

      if (!sessionToCheck) {
        throw new AxonPulsError(
          'No demo session available for limit check',
          'DEMO_SESSION_MISSING',
          400,
          null,
          { operation: 'demo_limits_check' }
        );
      }

      const response = await this.apiClient.get(`/api/v1/demo/limits/${sessionToCheck}/${feature}`);

      return {
        ...response.data,
        feature,
        percentage: Math.round((response.data.currentUsage / response.data.limit) * 100)
      };
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to check demo limits',
        'DEMO_LIMITS_CHECK_FAILED',
        error.response?.status || 500,
        error.response?.data,
        {
          operation: 'demo_limits_check',
          feature
        }
      );
    }
  }

  /**
   * Get current demo session
   */
  getCurrentSession(): DemoSession | null {
    return this.currentSession || null;
  }

  /**
   * Check if currently in demo mode
   */
  isDemoMode(): boolean {
    return !!this.currentSession && new Date(this.currentSession.expiresAt) > new Date();
  }

  /**
   * Get time remaining in demo session
   */
  getTimeRemaining(): number {
    if (!this.currentSession) {
      return 0;
    }

    const expiresAt = new Date(this.currentSession.expiresAt);
    const now = new Date();
    return Math.max(0, expiresAt.getTime() - now.getTime());
  }

  /**
   * Clear current demo session
   */
  clearSession(): void {
    this.currentSession = undefined;
  }

  /**
   * Validate upgrade request
   */
  private validateUpgradeRequest(request: UpgradeRequest): void {
    const validPlans = ['starter', 'professional', 'enterprise'];

    if (!validPlans.includes(request.planType)) {
      throw new AxonPulsError(
        `Invalid plan type: ${request.planType}`,
        'INVALID_PLAN_TYPE',
        400,
        { validPlans },
        { operation: 'upgrade_validation' }
      );
    }

    if (request.paymentMethod) {
      const validPaymentTypes = ['card', 'bank_transfer', 'invoice'];

      if (!validPaymentTypes.includes(request.paymentMethod.type)) {
        throw new AxonPulsError(
          `Invalid payment method: ${request.paymentMethod.type}`,
          'INVALID_PAYMENT_METHOD',
          400,
          { validTypes: validPaymentTypes },
          { operation: 'upgrade_validation' }
        );
      }

      if (request.paymentMethod.type === 'card' && !request.paymentMethod.cardToken) {
        throw new AxonPulsError(
          'Card token is required for card payments',
          'CARD_TOKEN_REQUIRED',
          400,
          null,
          { operation: 'upgrade_validation' }
        );
      }
    }

    if (request.email && !this.isValidEmail(request.email)) {
      throw new AxonPulsError(
        'Invalid email address',
        'INVALID_EMAIL',
        400,
        null,
        { operation: 'upgrade_validation' }
      );
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
