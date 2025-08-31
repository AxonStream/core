import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';

export interface WSTicket {
  tid: string;
  userId: string;
  orgId: string;
  orgSlug: string;
  roleIds: string[];
  permissions: string[];
  pv: number; // permission version
  ua?: string;
  ip?: string;
  isDemo?: boolean;
  sessionId: string;
  createdAt: number;
  expiresAt: number;
}

export interface WSTicketCreateData {
  userId: string;
  orgId: string;
  orgSlug: string;
  roleIds: string[];
  permissions: string[];
  pv?: number;
  ua?: string;
  ip?: string;
  isDemo?: boolean;
  sessionId: string;
}

@Injectable()
export class WSTicketService {
  private readonly logger = new Logger(WSTicketService.name);
  private readonly redis: Redis;
  private readonly ticketTTL: number;

  constructor(private readonly configService: ConfigService) {
    // Initialize Redis connection
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379/1';
    this.redis = new Redis(redisUrl);

    // Ticket TTL (default 60 seconds)
    this.ticketTTL = parseInt(this.configService.get<string>('WS_TICKET_TTL_SEC') || '60', 10);

    this.logger.log('WSTicketService initialized');
  }

  /**
   * Issue a new WebSocket ticket
   */
  async issueTicket(data: WSTicketCreateData): Promise<WSTicket> {
    const tid = this.generateTicketId();
    const now = Date.now();

    const ticket: WSTicket = {
      tid,
      userId: data.userId,
      orgId: data.orgId,
      orgSlug: data.orgSlug,
      roleIds: data.roleIds,
      permissions: data.permissions,
      pv: data.pv || 1,
      ua: data.ua,
      ip: data.ip,
      isDemo: data.isDemo || false,
      sessionId: data.sessionId,
      createdAt: now,
      expiresAt: now + (this.ticketTTL * 1000),
    };

    // Store in Redis with TTL
    const key = this.getTicketKey(tid);
    await this.redis.setex(key, this.ticketTTL, JSON.stringify(ticket));

    this.logger.debug(`WebSocket ticket issued: ${tid} for user ${data.userId}`);
    return ticket;
  }

  /**
   * Consume a WebSocket ticket (one-time use)
   */
  async consumeTicket(tid: string): Promise<WSTicket | null> {
    try {
      const key = this.getTicketKey(tid);
      
      // Get and delete atomically
      const ticketData = await this.redis.get(key);
      if (!ticketData) {
        this.logger.debug(`WebSocket ticket not found or expired: ${tid}`);
        return null;
      }

      // Delete the ticket (one-time use)
      await this.redis.del(key);

      const ticket = JSON.parse(ticketData) as WSTicket;

      // Validate expiration
      if (Date.now() > ticket.expiresAt) {
        this.logger.debug(`WebSocket ticket expired: ${tid}`);
        return null;
      }

      this.logger.debug(`WebSocket ticket consumed: ${tid} for user ${ticket.userId}`);
      return ticket;
    } catch (error) {
      this.logger.error(`Failed to consume WebSocket ticket ${tid}:`, error);
      return null;
    }
  }

  /**
   * Validate ticket without consuming it
   */
  async validateTicket(tid: string): Promise<{ valid: boolean; ticket?: WSTicket; reason?: string }> {
    try {
      const key = this.getTicketKey(tid);
      const ticketData = await this.redis.get(key);

      if (!ticketData) {
        return { valid: false, reason: 'TICKET_NOT_FOUND' };
      }

      const ticket = JSON.parse(ticketData) as WSTicket;

      // Check expiration
      if (Date.now() > ticket.expiresAt) {
        // Clean up expired ticket
        await this.redis.del(key);
        return { valid: false, reason: 'TICKET_EXPIRED', ticket };
      }

      return { valid: true, ticket };
    } catch (error) {
      this.logger.error(`Ticket validation failed for ${tid}:`, error);
      return { valid: false, reason: 'VALIDATION_ERROR' };
    }
  }

  /**
   * Get ticket information without consuming
   */
  async getTicketInfo(tid: string): Promise<WSTicket | null> {
    try {
      const key = this.getTicketKey(tid);
      const ticketData = await this.redis.get(key);

      if (!ticketData) {
        return null;
      }

      const ticket = JSON.parse(ticketData) as WSTicket;

      // Check if expired
      if (Date.now() > ticket.expiresAt) {
        await this.redis.del(key);
        return null;
      }

      return ticket;
    } catch (error) {
      this.logger.error(`Failed to get ticket info for ${tid}:`, error);
      return null;
    }
  }

  /**
   * Revoke a ticket before expiration
   */
  async revokeTicket(tid: string): Promise<boolean> {
    try {
      const key = this.getTicketKey(tid);
      const result = await this.redis.del(key);
      
      if (result > 0) {
        this.logger.debug(`WebSocket ticket revoked: ${tid}`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Failed to revoke ticket ${tid}:`, error);
      return false;
    }
  }

  /**
   * Get active tickets for a user (for debugging/monitoring)
   */
  async getUserActiveTickets(userId: string): Promise<WSTicket[]> {
    try {
      // This is a simplified implementation - in production you'd want to maintain
      // user->tickets mapping for efficiency
      const pattern = this.getTicketKey('*');
      const keys = await this.redis.keys(pattern);
      const tickets: WSTicket[] = [];

      for (const key of keys) {
        const ticketData = await this.redis.get(key);
        if (ticketData) {
          const ticket = JSON.parse(ticketData) as WSTicket;
          if (ticket.userId === userId && Date.now() <= ticket.expiresAt) {
            tickets.push(ticket);
          }
        }
      }

      return tickets;
    } catch (error) {
      this.logger.error(`Failed to get user tickets for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Clean up expired tickets (maintenance task)
   */
  async cleanupExpiredTickets(): Promise<number> {
    try {
      const pattern = this.getTicketKey('*');
      const keys = await this.redis.keys(pattern);
      let cleanedCount = 0;

      for (const key of keys) {
        const ticketData = await this.redis.get(key);
        if (ticketData) {
          const ticket = JSON.parse(ticketData) as WSTicket;
          if (Date.now() > ticket.expiresAt) {
            await this.redis.del(key);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} expired WebSocket tickets`);
      }

      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired tickets:', error);
      return 0;
    }
  }

  /**
   * Get ticket statistics
   */
  async getTicketStats(): Promise<{
    totalActive: number;
    byOrganization: Record<string, number>;
    byUser: Record<string, number>;
  }> {
    try {
      const pattern = this.getTicketKey('*');
      const keys = await this.redis.keys(pattern);
      const stats = {
        totalActive: 0,
        byOrganization: {} as Record<string, number>,
        byUser: {} as Record<string, number>,
      };

      for (const key of keys) {
        const ticketData = await this.redis.get(key);
        if (ticketData) {
          const ticket = JSON.parse(ticketData) as WSTicket;
          if (Date.now() <= ticket.expiresAt) {
            stats.totalActive++;
            stats.byOrganization[ticket.orgId] = (stats.byOrganization[ticket.orgId] || 0) + 1;
            stats.byUser[ticket.userId] = (stats.byUser[ticket.userId] || 0) + 1;
          }
        }
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get ticket stats:', error);
      return { totalActive: 0, byOrganization: {}, byUser: {} };
    }
  }

  /**
   * Generate secure ticket ID
   */
  private generateTicketId(): string {
    return crypto.randomUUID();
  }

  /**
   * Get Redis key for ticket
   */
  private getTicketKey(tid: string): string {
    return `wst:${tid}`;
  }
}
