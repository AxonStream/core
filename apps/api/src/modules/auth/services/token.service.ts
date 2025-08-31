import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

const ALG = 'RS256';

export interface InternalJWTPayload {
  sub: string; // User ID
  org: string; // Organization ID
  orgSlug: string;
  role_ids: string[];
  permissions: string[];
  pv: number; // permission version
  sessionId: string;
  isDemo?: boolean;
  jti: string; // JWT ID
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly issuer: string;
  private readonly audience: string;
  private readonly keyId: string;
  private readonly accessTTL: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.issuer = this.configService.get<string>('AUTH_ISSUER') || 'https://auth.axonstream.com';
    this.audience = this.configService.get<string>('AUTH_AUDIENCE') || 'axonstream-api';
    this.keyId = this.configService.get<string>('AUTH_KEY_ID') || 'key-2025-08';
    this.accessTTL = this.configService.get<string>('ACCESS_TTL') || '15m';
  }

  /**
   * Initialize the token service
   */
  async init(): Promise<void> {
    try {
      this.logger.log('TokenService initialized with existing JWT configuration');
    } catch (error) {
      this.logger.error('Failed to initialize TokenService:', error);
      throw error;
    }
  }

  /**
   * Get JWKS (JSON Web Key Set) for public key distribution
   */
  getJWKS(): { keys: any[] } {
    // Return a simplified JWKS for development
    return {
      keys: [{
        kty: 'oct',
        kid: this.keyId,
        alg: 'HS256',
        use: 'sig'
      }]
    };
  }

  /**
   * Sign an access token for internal service communication
   */
  async signAccessToken(payload: Omit<InternalJWTPayload, 'jti' | 'iat' | 'exp' | 'iss' | 'aud'>, ttl?: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const jti = crypto.randomUUID();

    const fullPayload: InternalJWTPayload = {
      ...payload,
      jti,
      iat: now,
      exp: 0, // Will be set by JWT service
      iss: this.issuer,
      aud: this.audience,
    };

    try {
      const token = this.jwtService.sign(fullPayload, {
        expiresIn: ttl || this.accessTTL,
        issuer: this.issuer,
        audience: this.audience,
      });

      this.logger.debug(`Access token signed for user ${payload.sub} in org ${payload.org}`);
      return token;
    } catch (error) {
      this.logger.error('Failed to sign access token:', error);
      throw error;
    }
  }

  /**
   * Verify an access token
   */
  async verifyAccessToken(token: string): Promise<InternalJWTPayload> {
    try {
      const payload = this.jwtService.verify(token, {
        issuer: this.issuer,
        audience: this.audience,
      });

      this.logger.debug(`Access token verified for user ${payload.sub}`);
      return payload as InternalJWTPayload;
    } catch (error) {
      this.logger.debug(`Token verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a short-lived token for specific operations
   */
  async createOperationToken(
    userId: string,
    orgId: string,
    operation: string,
    ttl = '5m'
  ): Promise<string> {
    const payload = {
      sub: userId,
      org: orgId,
      orgSlug: '', // Not needed for operation tokens
      role_ids: [],
      permissions: [operation],
      pv: 1,
      sessionId: '',
      operation,
    };

    return this.signAccessToken(payload, ttl);
  }

  /**
   * Validate token structure and claims
   */
  async validateTokenClaims(token: string): Promise<{
    valid: boolean;
    payload?: InternalJWTPayload;
    reason?: string;
  }> {
    try {
      const payload = await this.verifyAccessToken(token);

      // Validate required claims
      if (!payload.sub || !payload.org || !payload.iss || !payload.aud) {
        return { valid: false, reason: 'MISSING_REQUIRED_CLAIMS' };
      }

      // Validate issuer and audience
      if (payload.iss !== this.issuer || payload.aud !== this.audience) {
        return { valid: false, reason: 'INVALID_ISSUER_OR_AUDIENCE' };
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && now > payload.exp) {
        return { valid: false, reason: 'TOKEN_EXPIRED', payload };
      }

      return { valid: true, payload };
    } catch (error) {
      return { valid: false, reason: 'VERIFICATION_FAILED' };
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    try {
      // Decode without verification to get expiration
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      return payload.exp ? new Date(payload.exp * 1000) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get token metadata without verification
   */
  getTokenMetadata(token: string): {
    userId?: string;
    orgId?: string;
    isDemo?: boolean;
    exp?: number;
    iat?: number;
  } | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      return {
        userId: payload.sub,
        orgId: payload.org,
        isDemo: payload.isDemo,
        exp: payload.exp,
        iat: payload.iat,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expiring soon
   */
  isTokenExpiringSoon(token: string, thresholdMinutes = 5): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return false;

    const now = new Date();
    const threshold = new Date(now.getTime() + (thresholdMinutes * 60 * 1000));

    return expiration <= threshold;
  }

  /**
   * Generate a secure random string for JTI
   */
  generateJTI(): string {
    return crypto.randomUUID();
  }

  /**
   * Get algorithm used for signing
   */
  getAlgorithm(): string {
    return ALG;
  }

  /**
   * Get key ID
   */
  getKeyId(): string {
    return this.keyId;
  }

  /**
   * Get issuer
   */
  getIssuer(): string {
    return this.issuer;
  }

  /**
   * Get audience
   */
  getAudience(): string {
    return this.audience;
  }
}
