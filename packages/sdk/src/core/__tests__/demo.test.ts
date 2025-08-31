/**
 * 🧪 Demo Client Tests
 * 
 * Comprehensive test suite for demo functionality
 */

import { DemoClient } from '../demo';
import { AxonPulsError } from '../errors';

// Mock API client
const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};

const mockConfig = {
  baseURL: 'https://api.axonstream.ai',
  timeout: 5000,
};

describe('DemoClient', () => {
  let demoClient: DemoClient;

  beforeEach(() => {
    demoClient = new DemoClient(mockApiClient as any, mockConfig);
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create demo session successfully', async () => {
      const mockSession = {
        sessionId: 'demo-session-123',
        token: 'demo-token-123',
        organizationSlug: 'demo-org',
        expiresIn: '2h',
        expiresAt: '2024-01-01T02:00:00Z',
        limitations: {
          maxChannels: 20,
          maxEvents: 1000,
          maxMagicRooms: 5,
          maxWebhooks: 3,
          rateLimit: '50/minute',
          duration: '2 hours',
          features: 'Full platform access except admin functions'
        }
      };

      mockApiClient.post.mockResolvedValue({ data: mockSession });

      const result = await demoClient.createSession('test@example.com');

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/demo/token', {
        email: 'test@example.com',
        source: 'sdk',
        userAgent: 'SDK'
      });
      expect(result).toEqual(mockSession);
    });

    it('should create session with auto-generated email', async () => {
      const mockSession = {
        sessionId: 'demo-session-123',
        token: 'demo-token-123',
        organizationSlug: 'demo-org',
        expiresIn: '2h',
        expiresAt: '2024-01-01T02:00:00Z',
        limitations: {
          maxChannels: 20,
          maxEvents: 1000,
          maxMagicRooms: 5,
          maxWebhooks: 3,
          rateLimit: '50/minute',
          duration: '2 hours',
          features: 'Full platform access except admin functions'
        }
      };

      mockApiClient.post.mockResolvedValue({ data: mockSession });

      await demoClient.createSession();

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/demo/token', 
        expect.objectContaining({
          email: expect.stringMatching(/^demo-\d+@example\.com$/),
          source: 'sdk',
          userAgent: 'SDK'
        })
      );
    });
  });

  describe('getStatus', () => {
    it('should get demo status successfully', async () => {
      const mockStatus = {
        active: true,
        sessionsCount: 42,
        eventsCount: 1500,
        uptime: 99.9,
        version: '2.0.0',
        environment: 'demo' as const
      };

      mockApiClient.get.mockResolvedValue({ data: mockStatus });

      const result = await demoClient.getStatus();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/demo/status');
      expect(result).toEqual(mockStatus);
    });
  });

  describe('getUpgradeOptions', () => {
    it('should get upgrade options successfully', async () => {
      const mockUpgradeOptions = {
        success: true,
        message: 'Ready to upgrade from demo to full AxonStream access?',
        benefits: [
          'Unlimited channels and events',
          'Custom organization setup',
          'Advanced security features'
        ],
        pricing: {
          starter: { price: '$29/month', events: '100K/month', channels: 'Unlimited' },
          professional: { price: '$99/month', events: '1M/month', channels: 'Unlimited' },
          enterprise: { price: 'Custom', events: 'Unlimited', channels: 'Unlimited' }
        },
        nextSteps: {
          contact: 'sales@axonstream.ai',
          documentation: 'https://docs.axonstream.ai/upgrade',
          migration: 'https://docs.axonstream.ai/migration'
        }
      };

      mockApiClient.post.mockResolvedValue({ data: mockUpgradeOptions });

      const result = await demoClient.getUpgradeOptions({
        email: 'test@example.com',
        useCase: 'real-time notifications'
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/demo/upgrade', {
        email: 'test@example.com',
        useCase: 'real-time notifications'
      });
      expect(result).toEqual(mockUpgradeOptions);
    });
  });

  describe('upgrade', () => {
    it('should process upgrade successfully', async () => {
      const mockUpgradeResult = {
        success: true,
        organizationId: 'org-123',
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        redirectUrl: 'https://app.axonstream.ai/dashboard',
        message: 'Upgrade successful! Welcome to AxonStream Pro.',
        nextSteps: [
          'Complete organization setup',
          'Invite team members',
          'Configure integrations'
        ],
        migrationStatus: {
          dataTransferred: true,
          channelsPreserved: true,
          webhooksTransferred: true,
          settingsApplied: true
        }
      };

      mockApiClient.post.mockResolvedValue({ data: mockUpgradeResult });

      const upgradeRequest = {
        email: 'test@example.com',
        planType: 'professional' as const,
        organizationName: 'Test Corp',
        estimatedUsers: 10,
        estimatedEvents: 50000,
        paymentMethod: {
          type: 'card' as const,
          cardToken: 'card-token-123',
          billingAddress: {
            name: 'John Doe',
            email: 'john@testcorp.com',
            address: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105',
            country: 'US'
          }
        }
      };

      const result = await demoClient.upgrade(upgradeRequest);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/demo/upgrade/process', 
        expect.objectContaining(upgradeRequest)
      );
      expect(result).toEqual(mockUpgradeResult);
    });

    it('should validate plan type', async () => {
      await expect(demoClient.upgrade({
        planType: 'invalid' as any,
        email: 'test@example.com'
      })).rejects.toThrow(AxonPulsError);
    });

    it('should validate payment method', async () => {
      await expect(demoClient.upgrade({
        planType: 'starter',
        email: 'test@example.com',
        paymentMethod: {
          type: 'invalid' as any
        }
      })).rejects.toThrow(AxonPulsError);
    });

    it('should validate card token for card payments', async () => {
      await expect(demoClient.upgrade({
        planType: 'starter',
        email: 'test@example.com',
        paymentMethod: {
          type: 'card'
          // Missing cardToken
        }
      })).rejects.toThrow(AxonPulsError);
    });

    it('should validate email format', async () => {
      await expect(demoClient.upgrade({
        planType: 'starter',
        email: 'invalid-email'
      })).rejects.toThrow(AxonPulsError);
    });
  });

  describe('validateSession', () => {
    it('should validate session successfully', async () => {
      const mockSession = {
        sessionId: 'demo-session-123',
        token: 'demo-token-123',
        organizationSlug: 'demo-org',
        expiresIn: '2h',
        expiresAt: '2024-01-01T02:00:00Z',
        limitations: {
          maxChannels: 20,
          maxEvents: 1000,
          maxMagicRooms: 5,
          maxWebhooks: 3,
          rateLimit: '50/minute',
          duration: '2 hours',
          features: 'Full platform access except admin functions'
        }
      };

      mockApiClient.post.mockResolvedValue({ 
        data: { valid: true, session: mockSession }
      });

      const result = await demoClient.validateSession('demo-token-123');

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/demo/session/validate', {
        token: 'demo-token-123'
      });
      expect(result).toEqual(mockSession);
    });

    it('should return null for invalid session', async () => {
      mockApiClient.post.mockResolvedValue({ 
        data: { valid: false, session: null }
      });

      const result = await demoClient.validateSession('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('trackFeatureUsage', () => {
    it('should track feature usage successfully', async () => {
      const mockLimits = {
        withinLimits: true,
        currentUsage: 5,
        limit: 20,
        upgradePrompted: false
      };

      mockApiClient.post.mockResolvedValue({ 
        data: { success: true, limits: mockLimits }
      });

      const result = await demoClient.trackFeatureUsage({
        sessionId: 'demo-session-123',
        featureName: 'channels',
        featureCategory: 'messaging'
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/demo/usage/track', {
        sessionId: 'demo-session-123',
        featureName: 'channels',
        featureCategory: 'messaging'
      });
      expect(result).toEqual({
        ...mockLimits,
        feature: 'channels',
        percentage: 25
      });
    });
  });

  describe('checkLimits', () => {
    it('should check demo limits successfully', async () => {
      const mockLimits = {
        withinLimits: false,
        currentUsage: 18,
        limit: 20,
        upgradePrompted: true
      };

      mockApiClient.get.mockResolvedValue({ data: mockLimits });

      const result = await demoClient.checkLimits('channels', 'demo-session-123');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/demo/limits/demo-session-123/channels');
      expect(result).toEqual({
        ...mockLimits,
        feature: 'channels',
        percentage: 90
      });
    });
  });

  describe('session management', () => {
    it('should track current session', async () => {
      const mockSession = {
        sessionId: 'demo-session-123',
        token: 'demo-token-123',
        organizationSlug: 'demo-org',
        expiresIn: '2h',
        expiresAt: '2024-01-01T02:00:00Z',
        limitations: {
          maxChannels: 20,
          maxEvents: 1000,
          maxMagicRooms: 5,
          maxWebhooks: 3,
          rateLimit: '50/minute',
          duration: '2 hours',
          features: 'Full platform access except admin functions'
        }
      };

      mockApiClient.post.mockResolvedValue({ data: mockSession });

      await demoClient.createSession('test@example.com');

      expect(demoClient.getCurrentSession()).toEqual(mockSession);
      expect(demoClient.isDemoMode()).toBe(true);
      expect(demoClient.getTimeRemaining()).toBeGreaterThan(0);
    });

    it('should clear session', () => {
      demoClient.clearSession();
      
      expect(demoClient.getCurrentSession()).toBeNull();
      expect(demoClient.isDemoMode()).toBe(false);
      expect(demoClient.getTimeRemaining()).toBe(0);
    });
  });
});
