import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/services/prisma.service';
import Redis from 'ioredis';
import { serialize } from 'cookie';
import * as crypto from 'crypto';

export interface Session {
  sid: string;
  userId: string;
  orgId: string;
  orgSlug: string;
  roleIds: string[];
  permissions: string[];
  pv: number; // permission version
  createdAt: number;
  lastAccessAt: number;
  ua?: string;
  ip?: string;
  isDemo?: boolean;
  demoExpiresAt?: Date;
  sessionType: 'user' | 'demo' | 'trial';
}

export interface SessionCreateData {
  userId: string;
  orgId: string;
  orgSlug: string;
  roleIds: string[];
  permissions: string[];
  pv?: number;
  ua?: string;
  ip?: string;
  isDemo?: boolean;
  demoExpiresAt?: Date;
  sessionType?: 'user' | 'demo' | 'trial';
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly redis: Redis;
  private readonly cookieName: string;
  private readonly cookieDomain?: string;
  private readonly secureCookies: boolean;
  private readonly sessionTTL: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Initialize Redis connection
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379/1';
    this.redis = new Redis(redisUrl);

    // Cookie configuration
    this.cookieName = this.configService.get<string>('AUTH_COOKIE_NAME') || '__Host-axon.sid';
    this.cookieDomain = this.configService.get<string>('AUTH_COOKIE_DOMAIN');
    this.secureCookies = this.configService.get<string>('SECURE_COOKIES') !== 'false';
    this.sessionTTL = parseInt(this.configService.get<string>('SESSION_TTL') || '2592000', 10); // 30 days default

    this.logger.log('SessionService initialized with Redis backend');
  }

  /**
   * Create a new session
   */
  async createSession(data: SessionCreateData, ttlDays = 30): Promise<Session> {
    const sid = this.generateSessionId();
    const now = Date.now();

    const session: Session = {
      sid,
      userId: data.userId,
      orgId: data.orgId,
      orgSlug: data.orgSlug,
      roleIds: data.roleIds,
      permissions: data.permissions,
      pv: data.pv || 1,
      createdAt: now,
      lastAccessAt: now,
      ua: data.ua,
      ip: data.ip,
      isDemo: data.isDemo || false,
      demoExpiresAt: data.demoExpiresAt,
      sessionType: data.sessionType || 'user',
    };

    // Store in Redis
    const key = this.getSessionKey(sid);
    const ttlSeconds = ttlDays * 24 * 60 * 60;

    await this.redis.setex(key, ttlSeconds, JSON.stringify(session));

    // Store session metadata in database for analytics
    await this.storeSessionMetadata(session);

    this.logger.log(`Session created: ${sid} for user ${data.userId} in org ${data.orgId}`);
    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sid: string): Promise<Session | null> {
    try {
      const key = this.getSessionKey(sid);
      const sessionData = await this.redis.get(key);

      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData) as Session;

      // Update last access time
      session.lastAccessAt = Date.now();
      await this.redis.setex(key, this.sessionTTL, JSON.stringify(session));

      return session;
    } catch (error) {
      this.logger.error(`Failed to get session ${sid}:`, error);
      return null;
    }
  }

  /**
   * Update session data
   */
  async updateSession(sid: string, updates: Partial<Session>): Promise<boolean> {
    try {
      const session = await this.getSession(sid);
      if (!session) {
        return false;
      }

      const updatedSession = { ...session, ...updates, lastAccessAt: Date.now() };
      const key = this.getSessionKey(sid);

      await this.redis.setex(key, this.sessionTTL, JSON.stringify(updatedSession));

      this.logger.debug(`Session updated: ${sid}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update session ${sid}:`, error);
      return false;
    }
  }

  /**
   * Invalidate session
   */
  async invalidateSession(sid: string): Promise<void> {
    try {
      const key = this.getSessionKey(sid);
      await this.redis.del(key);

      // Update database record
      await this.prisma.session.updateMany({
        where: { sessionToken: sid },
        data: {
          isActive: false,
        },
      });

      this.logger.log(`Session invalidated: ${sid}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate session ${sid}:`, error);
    }
  }

  /**
   * Create session cookie
   */
  createSessionCookie(sid: string): string {
    const name = this.cookieName.startsWith('__Host-') ? '__Host-axon.sid' : this.cookieName;

    return serialize(name, sid, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'lax',
      path: '/',
      maxAge: this.sessionTTL,
      ...(this.cookieDomain && !this.cookieName.startsWith('__Host-') ? { domain: this.cookieDomain } : {}),
    });
  }

  /**
   * Parse session cookie from request
   */
  parseSessionCookie(cookieHeader: string): string | null {
    if (!cookieHeader) return null;

    const name = this.cookieName.startsWith('__Host-') ? '__Host-axon.sid' : this.cookieName;
    const cookieName = `${name}=`;

    const cookie = cookieHeader
      .split('; ')
      .find(c => c.startsWith(cookieName));

    return cookie ? decodeURIComponent(cookie.substring(cookieName.length)) : null;
  }

  /**
   * Validate session and check expiration
   */
  async validateSession(sid: string): Promise<{ valid: boolean; session?: Session; reason?: string }> {
    try {
      const session = await this.getSession(sid);

      if (!session) {
        return { valid: false, reason: 'SESSION_NOT_FOUND' };
      }

      // Check demo expiration
      if (session.isDemo && session.demoExpiresAt) {
        if (new Date() > session.demoExpiresAt) {
          await this.invalidateSession(sid);
          return { valid: false, reason: 'DEMO_EXPIRED', session };
        }
      }

      // Check session age (30 days max)
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
      if (Date.now() - session.createdAt > maxAge) {
        await this.invalidateSession(sid);
        return { valid: false, reason: 'SESSION_EXPIRED', session };
      }

      return { valid: true, session };
    } catch (error) {
      this.logger.error(`Session validation failed for ${sid}:`, error);
      return { valid: false, reason: 'VALIDATION_ERROR' };
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string, orgId: string): Promise<Session[]> {
    try {
      // This is a simplified implementation - in production you'd want to maintain
      // a user->sessions mapping in Redis for efficiency
      const sessions: Session[] = [];

      // Get from database for now (could be optimized with Redis sets)
      const sessionRecords = await this.prisma.session.findMany({
        where: {
          userId,
          organizationId: orgId,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const record of sessionRecords) {
        const session = await this.getSession(record.sessionToken);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (error) {
      this.logger.error(`Failed to get user sessions for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Generate secure session ID
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get Redis key for session
   */
  private getSessionKey(sid: string): string {
    return `sess:${sid}`;
  }

  /**
   * Store session metadata in database for analytics
   */
  private async storeSessionMetadata(session: Session): Promise<void> {
    try {
      await this.prisma.session.create({
        data: {
          sessionToken: session.sid,
          userId: session.userId,
          organizationId: session.orgId,
          userAgent: session.ua,
          ipAddress: session.ip,
          isActive: true,
          createdAt: new Date(session.createdAt),
          lastActivity: new Date(session.lastAccessAt),
          expiresAt: session.demoExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
        },
      });
    } catch (error) {
      // Don't fail session creation if metadata storage fails
      this.logger.warn(`Failed to store session metadata for ${session.sid}:`, error);
    }
  }
}
