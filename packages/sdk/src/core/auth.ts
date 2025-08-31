/**
 * 🔐 Authentication Client
 * 
 * Production-grade authentication management with token refresh,
 * widget token generation, and session management capabilities.
 */

import { BaseClient } from './base-client';
import { AxonPulsError } from './errors';
import type { AxonPulsEvent } from '../types/schemas';

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: string;
  tokenType: 'Bearer';
  expiresAt?: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: string;
  tokenType: 'Bearer';
}

export interface WidgetTokenRequest {
  widgetType: 'dashboard' | 'notifications' | 'analytics' | 'chat' | 'status' | 'custom';
  channels: string[];
  expiresIn?: string;
  metadata?: Record<string, any>;
}

export interface WidgetTokenResponse {
  success: boolean;
  token: string;
  expiresIn: string;
  expiresAt: string;
  permissions: string[];
  scope: 'widget';
  timestamp: string;
}

export interface JWKSResponse {
  keys: Array<{
    kty: string;
    use: string;
    kid: string;
    n: string;
    e: string;
    alg: string;
  }>;
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: any;
  error?: string;
  expiresAt?: Date;
}

export interface SessionInfo {
  userId: string;
  organizationId: string;
  organizationSlug: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  isDemo: boolean;
  expiresAt: Date;
}

/**
 * Authentication Client
 * Handles token management, refresh, and widget token generation
 */
export class AuthClient extends BaseClient {
  private currentTokens?: AuthTokens;
  private refreshTimer?: NodeJS.Timeout;
  private readonly refreshThreshold = 5 * 60 * 1000; // 5 minutes before expiry

  /**
   * Refresh access token using refresh token
   */
  async refresh(refreshToken?: string): Promise<RefreshTokenResponse> {
    try {
      const tokenToUse = refreshToken || this.currentTokens?.refreshToken;
      
      if (!tokenToUse) {
        throw new AxonPulsError(
          'No refresh token available',
          'REFRESH_TOKEN_MISSING',
          401,
          null,
          { operation: 'token_refresh' }
        );
      }

      const response = await this.apiClient.post('/api/v1/auth/refresh', {
        refreshToken: tokenToUse
      });

      const tokens: RefreshTokenResponse = response.data;
      
      // Update current tokens if we refreshed our own
      if (!refreshToken && this.currentTokens) {
        this.currentTokens.accessToken = tokens.accessToken;
        this.currentTokens.expiresIn = tokens.expiresIn;
        this.scheduleTokenRefresh(tokens.expiresIn);
      }

      return tokens;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to refresh token',
        'TOKEN_REFRESH_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { operation: 'token_refresh' }
      );
    }
  }

  /**
   * Generate widget token for embedding
   */
  async getWidgetToken(request: WidgetTokenRequest): Promise<WidgetTokenResponse> {
    try {
      this.validateWidgetTokenRequest(request);

      const response = await this.apiClient.post('/api/v1/tokens/widget', {
        widgetType: request.widgetType,
        channels: request.channels,
        expiresIn: request.expiresIn || '1h',
        metadata: request.metadata || {}
      });

      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to generate widget token',
        'WIDGET_TOKEN_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { 
          operation: 'widget_token_generation',
          widgetType: request.widgetType,
          channelCount: request.channels.length
        }
      );
    }
  }

  /**
   * Get JSON Web Key Set for token verification
   */
  async getJWKS(): Promise<JWKSResponse> {
    try {
      const response = await this.apiClient.get('/api/v1/auth/.well-known/jwks.json');
      return response.data;
    } catch (error: any) {
      throw new AxonPulsError(
        'Failed to get JWKS',
        'JWKS_FETCH_FAILED',
        error.response?.status || 500,
        error.response?.data,
        { operation: 'jwks_fetch' }
      );
    }
  }

  /**
   * Validate token locally (basic validation)
   */
  validateToken(token: string): TokenValidationResult {
    try {
      // Basic JWT structure validation
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid JWT structure' };
      }

      // Decode payload (without verification for basic checks)
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      
      // Check expiration
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return { valid: false, error: 'Token expired', expiresAt: new Date(payload.exp * 1000) };
      }

      return { 
        valid: true, 
        payload,
        expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined
      };
    } catch (error) {
      return { valid: false, error: 'Token parsing failed' };
    }
  }

  /**
   * Get current session information from token
   */
  getSessionInfo(): SessionInfo | null {
    if (!this.currentTokens?.accessToken) {
      return null;
    }

    const validation = this.validateToken(this.currentTokens.accessToken);
    if (!validation.valid || !validation.payload) {
      return null;
    }

    const payload = validation.payload;
    return {
      userId: payload.sub,
      organizationId: payload.organizationId || payload.org,
      organizationSlug: payload.organizationSlug || payload.orgSlug,
      roles: payload.roles || payload.role_ids || [],
      permissions: payload.permissions || [],
      sessionId: payload.sessionId || payload.jti,
      isDemo: payload.isDemo || false,
      expiresAt: validation.expiresAt || new Date()
    };
  }

  /**
   * Set current tokens and schedule refresh
   */
  setTokens(tokens: AuthTokens): void {
    this.currentTokens = tokens;
    this.scheduleTokenRefresh(tokens.expiresIn);
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.currentTokens?.accessToken || null;
  }

  /**
   * Check if current token is valid and not expired
   */
  isTokenValid(): boolean {
    if (!this.currentTokens?.accessToken) {
      return false;
    }

    const validation = this.validateToken(this.currentTokens.accessToken);
    return validation.valid;
  }

  /**
   * Clear current tokens and cancel refresh timer
   */
  clearTokens(): void {
    this.currentTokens = undefined;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(expiresIn: string): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Parse expiration time
    const expirationMs = this.parseExpirationTime(expiresIn);
    const refreshTime = Math.max(expirationMs - this.refreshThreshold, 60000); // At least 1 minute

    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refresh();
      } catch (error) {
        // Emit error event for handling by application
        console.warn('Automatic token refresh failed:', error);
      }
    }, refreshTime);
  }

  /**
   * Parse expiration time string to milliseconds
   */
  private parseExpirationTime(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 15 * 60 * 1000; // Default 15 minutes
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 15 * 60 * 1000;
    }
  }

  /**
   * Validate widget token request
   */
  private validateWidgetTokenRequest(request: WidgetTokenRequest): void {
    const validWidgetTypes = ['dashboard', 'notifications', 'analytics', 'chat', 'status', 'custom'];
    
    if (!validWidgetTypes.includes(request.widgetType)) {
      throw new AxonPulsError(
        `Invalid widget type: ${request.widgetType}`,
        'INVALID_WIDGET_TYPE',
        400,
        { validTypes: validWidgetTypes },
        { operation: 'widget_token_validation' }
      );
    }

    if (!request.channels || request.channels.length === 0) {
      throw new AxonPulsError(
        'At least one channel is required for widget token',
        'CHANNELS_REQUIRED',
        400,
        null,
        { operation: 'widget_token_validation' }
      );
    }

    if (request.channels.length > 50) {
      throw new AxonPulsError(
        'Too many channels requested (max 50)',
        'TOO_MANY_CHANNELS',
        400,
        { maxChannels: 50, requested: request.channels.length },
        { operation: 'widget_token_validation' }
      );
    }
  }
}
