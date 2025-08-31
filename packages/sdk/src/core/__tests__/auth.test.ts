/**
 * 🧪 Authentication Client Tests
 * 
 * Comprehensive test suite for authentication functionality
 */

import { AuthClient } from '../auth';
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

describe('AuthClient', () => {
  let authClient: AuthClient;

  beforeEach(() => {
    authClient = new AuthClient(mockApiClient as any, mockConfig);
    jest.clearAllMocks();
  });

  describe('refresh', () => {
    it('should refresh token successfully', async () => {
      const mockRefreshResponse = {
        accessToken: 'new-access-token',
        expiresIn: '1h',
        tokenType: 'Bearer',
      };

      mockApiClient.post.mockResolvedValue({ data: mockRefreshResponse });

      const result = await authClient.refresh('refresh-token-123');

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/auth/refresh', {
        refreshToken: 'refresh-token-123'
      });
      expect(result).toEqual(mockRefreshResponse);
    });

    it('should handle refresh token missing error', async () => {
      await expect(authClient.refresh()).rejects.toThrow(AxonPulsError);
    });

    it('should handle refresh failure', async () => {
      mockApiClient.post.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Invalid refresh token' },
        },
      });

      await expect(authClient.refresh('invalid-token')).rejects.toThrow(AxonPulsError);
    });
  });

  describe('getWidgetToken', () => {
    it('should generate widget token successfully', async () => {
      const mockWidgetToken = {
        success: true,
        token: 'widget-token-123',
        expiresIn: '1h',
        expiresAt: '2024-01-01T01:00:00Z',
        permissions: ['read'],
        scope: 'widget',
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockApiClient.post.mockResolvedValue({ data: mockWidgetToken });

      const result = await authClient.getWidgetToken({
        widgetType: 'dashboard',
        channels: ['notifications', 'updates'],
        expiresIn: '1h',
        metadata: { userId: 'user-123' }
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/tokens/widget', {
        widgetType: 'dashboard',
        channels: ['notifications', 'updates'],
        expiresIn: '1h',
        metadata: { userId: 'user-123' }
      });
      expect(result).toEqual(mockWidgetToken);
    });

    it('should validate widget type', async () => {
      await expect(authClient.getWidgetToken({
        widgetType: 'invalid' as any,
        channels: ['test']
      })).rejects.toThrow(AxonPulsError);
    });

    it('should validate channels requirement', async () => {
      await expect(authClient.getWidgetToken({
        widgetType: 'dashboard',
        channels: []
      })).rejects.toThrow(AxonPulsError);
    });

    it('should validate channel limit', async () => {
      const tooManyChannels = Array.from({ length: 51 }, (_, i) => `channel-${i}`);
      
      await expect(authClient.getWidgetToken({
        widgetType: 'dashboard',
        channels: tooManyChannels
      })).rejects.toThrow(AxonPulsError);
    });
  });

  describe('getJWKS', () => {
    it('should get JWKS successfully', async () => {
      const mockJWKS = {
        keys: [
          {
            kty: 'RSA',
            use: 'sig',
            kid: 'key-1',
            n: 'example-n',
            e: 'AQAB',
            alg: 'RS256'
          }
        ]
      };

      mockApiClient.get.mockResolvedValue({ data: mockJWKS });

      const result = await authClient.getJWKS();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/auth/.well-known/jwks.json');
      expect(result).toEqual(mockJWKS);
    });
  });

  describe('validateToken', () => {
    it('should validate valid token', () => {
      // Create a mock JWT token (header.payload.signature)
      const payload = {
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        organizationId: 'org-123'
      };
      const encodedPayload = btoa(JSON.stringify(payload));
      const mockToken = `header.${encodedPayload}.signature`;

      const result = authClient.validateToken(mockToken);

      expect(result.valid).toBe(true);
      expect(result.payload).toEqual(payload);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should detect expired token', () => {
      const payload = {
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };
      const encodedPayload = btoa(JSON.stringify(payload));
      const mockToken = `header.${encodedPayload}.signature`;

      const result = authClient.validateToken(mockToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should detect invalid token structure', () => {
      const result = authClient.validateToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JWT structure');
    });
  });

  describe('setTokens', () => {
    it('should set tokens and schedule refresh', () => {
      const tokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: '1h',
        tokenType: 'Bearer' as const,
      };

      authClient.setTokens(tokens);

      expect(authClient.getAccessToken()).toBe('access-token');
      expect(authClient.isTokenValid()).toBe(true);
    });
  });

  describe('getSessionInfo', () => {
    it('should get session info from valid token', () => {
      const payload = {
        sub: 'user-123',
        organizationId: 'org-123',
        organizationSlug: 'test-org',
        roles: ['admin'],
        permissions: ['read', 'write'],
        sessionId: 'session-123',
        isDemo: false,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const encodedPayload = btoa(JSON.stringify(payload));
      const mockToken = `header.${encodedPayload}.signature`;

      authClient.setTokens({
        accessToken: mockToken,
        expiresIn: '1h',
        tokenType: 'Bearer'
      });

      const sessionInfo = authClient.getSessionInfo();

      expect(sessionInfo).toEqual({
        userId: 'user-123',
        organizationId: 'org-123',
        organizationSlug: 'test-org',
        roles: ['admin'],
        permissions: ['read', 'write'],
        sessionId: 'session-123',
        isDemo: false,
        expiresAt: expect.any(Date)
      });
    });

    it('should return null for no token', () => {
      const sessionInfo = authClient.getSessionInfo();
      expect(sessionInfo).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('should clear tokens and cancel refresh timer', () => {
      const tokens = {
        accessToken: 'access-token',
        expiresIn: '1h',
        tokenType: 'Bearer' as const,
      };

      authClient.setTokens(tokens);
      expect(authClient.getAccessToken()).toBe('access-token');

      authClient.clearTokens();
      expect(authClient.getAccessToken()).toBeNull();
      expect(authClient.isTokenValid()).toBe(false);
    });
  });

  describe('token refresh scheduling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should schedule automatic token refresh', async () => {
      const mockRefreshResponse = {
        accessToken: 'new-access-token',
        expiresIn: '1h',
        tokenType: 'Bearer',
      };

      mockApiClient.post.mockResolvedValue({ data: mockRefreshResponse });

      const tokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: '10m', // 10 minutes
        tokenType: 'Bearer' as const,
      };

      authClient.setTokens(tokens);

      // Fast-forward to just before refresh time (5 minutes before expiry)
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

      await jest.runAllTimersAsync();

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/auth/refresh', {
        refreshToken: 'refresh-token'
      });
    });
  });
});
