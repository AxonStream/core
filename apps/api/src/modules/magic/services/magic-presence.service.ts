import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { RedisService } from '../../../common/services/redis.service';
import { EventStreamService } from '../../../common/services/event-stream.service';
import { TenantContext } from '../../../common/services/tenant-aware.service';
import {
    MagicPresenceEvent,
    MagicPresenceEventType,
    createEventId,
    validateEventByType,
} from '../../../common/schemas/axon-events.schema';

// Production-grade presence interfaces
export interface MagicPresenceInfo {
    id: string;
    roomId: string;
    userId: string;
    sessionId: string;
    userName: string;
    userAvatar?: string;
    isActive: boolean;
    lastSeen: Date;
    cursorPosition?: {
        x: number;
        y: number;
        elementId?: string;
    };
    selection?: {
        start: number;
        end: number;
        elementId?: string;
    };
    viewportInfo?: {
        scrollX: number;
        scrollY: number;
        zoom: number;
    };
    deviceInfo?: {
        userAgent?: string;
        platform?: string;
        screenWidth?: number;
        screenHeight?: number;
    };
    joinedAt: Date;
}

export interface PresenceUpdateData {
    cursorPosition?: {
        x: number;
        y: number;
        elementId?: string;
    };
    selection?: {
        start: number;
        end: number;
        elementId?: string;
    };
    viewportInfo?: {
        scrollX: number;
        scrollY: number;
        zoom: number;
    };
    isActive?: boolean;
}

@Injectable()
export class MagicPresenceService {
    private readonly logger = new Logger(MagicPresenceService.name);

    // Redis keys for real-time presence tracking
    private readonly PRESENCE_KEY = 'magic:presence';
    private readonly ROOM_PRESENCE_KEY = 'magic:room_presence';
    private readonly USER_ROOMS_KEY = 'magic:user_rooms';

    // Presence configuration
    private readonly config = {
        presenceTimeout: 30000,     // 30 seconds
        heartbeatInterval: 5000,    // 5 seconds
        maxPresencePerRoom: 100,    // Limit concurrent users
        cursorUpdateThreshold: 50,  // Min ms between cursor updates
    };

    constructor(
        private prisma: PrismaService,
        private redis: RedisService,
        private eventStream: EventStreamService,
    ) {
        // Start cleanup job for inactive presences
        this.startPresenceCleanupJob();
    }

    /**
     * PRODUCTION: User joins a Magic room
     */
    async joinRoom(
        context: TenantContext,
        roomName: string,
        userData: {
            userName: string;
            userAvatar?: string;
            deviceInfo?: any;
        }
    ): Promise<MagicPresenceInfo> {

        // Validate tenant context
        if (!context.organizationId || !context.userId || !context.sessionId) {
            throw new Error('Invalid tenant context for presence');
        }

        // Find the room
        const room = await this.prisma.magicRoom.findUnique({
            where: {
                name_organizationId: {
                    name: roomName,
                    organizationId: context.organizationId
                }
            }
        });

        if (!room) {
            throw new Error(`Magic room '${roomName}' not found`);
        }

        // Create or update presence in database
        const presence = await this.prisma.magicPresence.upsert({
            where: {
                roomId_sessionId: {
                    roomId: room.id,
                    sessionId: context.sessionId
                }
            },
            update: {
                isActive: true,
                lastSeen: new Date(),
                userName: userData.userName,
                userAvatar: userData.userAvatar,
                deviceInfo: userData.deviceInfo || {},
            },
            create: {
                roomId: room.id,
                userId: context.userId,
                sessionId: context.sessionId,
                organizationId: context.organizationId,
                userName: userData.userName,
                userAvatar: userData.userAvatar,
                isActive: true,
                deviceInfo: userData.deviceInfo || {},
            }
        });

        // Store presence in Redis for real-time access
        await this.storePresenceInRedis(room.id, context.sessionId, {
            id: presence.id,
            roomId: room.id,
            userId: context.userId,
            sessionId: context.sessionId,
            userName: userData.userName,
            userAvatar: userData.userAvatar,
            isActive: true,
            lastSeen: new Date(),
            deviceInfo: userData.deviceInfo,
            joinedAt: presence.joinedAt,
        });

        // Broadcast presence join event
        await this.broadcastPresenceEvent(context, room.id, 'presence_join', {
            userId: context.userId,
            sessionId: context.sessionId,
            userName: userData.userName,
            userAvatar: userData.userAvatar,
            isActive: true,
            lastSeen: new Date().toISOString(),
        });

        this.logger.log(`User ${userData.userName} joined Magic room ${roomName}`);

        return {
            id: presence.id,
            roomId: room.id,
            userId: context.userId,
            sessionId: context.sessionId,
            userName: userData.userName,
            userAvatar: userData.userAvatar,
            isActive: true,
            lastSeen: presence.lastSeen,
            joinedAt: presence.joinedAt,
        };
    }

    /**
     * PRODUCTION: User leaves a Magic room
     */
    async leaveRoom(
        context: TenantContext,
        roomName: string
    ): Promise<void> {

        if (!context.organizationId || !context.sessionId) {
            throw new Error('Invalid tenant context for presence');
        }

        // Find the room
        const room = await this.prisma.magicRoom.findUnique({
            where: {
                name_organizationId: {
                    name: roomName,
                    organizationId: context.organizationId
                }
            }
        });

        if (!room) {
            return; // Room doesn't exist, nothing to leave
        }

        // Get current presence info before removing
        const presence = await this.prisma.magicPresence.findUnique({
            where: {
                roomId_sessionId: {
                    roomId: room.id,
                    sessionId: context.sessionId
                }
            }
        });

        if (presence) {
            // Mark as inactive in database
            await this.prisma.magicPresence.update({
                where: { id: presence.id },
                data: {
                    isActive: false,
                    lastSeen: new Date(),
                }
            });

            // Remove from Redis
            await this.removePresenceFromRedis(room.id, context.sessionId);

            // Broadcast presence leave event
            await this.broadcastPresenceEvent(context, room.id, 'presence_leave', {
                userId: presence.userId,
                sessionId: context.sessionId,
                userName: presence.userName,
                userAvatar: presence.userAvatar,
                isActive: false,
                lastSeen: new Date().toISOString(),
            });

            this.logger.log(`User ${presence.userName} left Magic room ${roomName}`);
        }
    }

    /**
     * PRODUCTION: Update user's cursor position, selection, or viewport
     */
    async updatePresence(
        context: TenantContext,
        roomName: string,
        updateData: PresenceUpdateData
    ): Promise<void> {

        if (!context.organizationId || !context.sessionId) {
            throw new Error('Invalid tenant context for presence');
        }

        // Find the room
        const room = await this.prisma.magicRoom.findUnique({
            where: {
                name_organizationId: {
                    name: roomName,
                    organizationId: context.organizationId
                }
            }
        });

        if (!room) {
            throw new Error(`Magic room '${roomName}' not found`);
        }

        // Update presence in database
        const presence = await this.prisma.magicPresence.updateMany({
            where: {
                roomId: room.id,
                sessionId: context.sessionId,
                isActive: true,
            },
            data: {
                cursorPosition: updateData.cursorPosition || undefined,
                selection: updateData.selection || undefined,
                viewportInfo: updateData.viewportInfo || undefined,
                isActive: updateData.isActive !== undefined ? updateData.isActive : true,
                lastSeen: new Date(),
            }
        });

        if (presence.count > 0) {
            // Update Redis cache
            await this.updatePresenceInRedis(room.id, context.sessionId, updateData);

            // Get full presence info for broadcast
            const fullPresence = await this.getPresenceFromRedis(room.id, context.sessionId);

            if (fullPresence) {
                // Broadcast presence update event (throttled for cursor movements)
                await this.broadcastPresenceEvent(context, room.id, 'presence_update', {
                    userId: fullPresence.userId,
                    sessionId: context.sessionId,
                    userName: fullPresence.userName,
                    userAvatar: fullPresence.userAvatar,
                    cursorPosition: updateData.cursorPosition,
                    selection: updateData.selection,
                    viewportInfo: updateData.viewportInfo,
                    isActive: updateData.isActive !== undefined ? updateData.isActive : true,
                    lastSeen: new Date().toISOString(),
                });
            }
        }
    }

    /**
     * Get all active users in a room
     */
    async getRoomPresences(
        context: TenantContext,
        roomName: string
    ): Promise<MagicPresenceInfo[]> {

        if (!context.organizationId) {
            throw new Error('Invalid tenant context for presence');
        }

        // Find the room
        const room = await this.prisma.magicRoom.findUnique({
            where: {
                name_organizationId: {
                    name: roomName,
                    organizationId: context.organizationId
                }
            }
        });

        if (!room) {
            return [];
        }

        // Get presences from Redis first (faster)
        const redisPresences = await this.getAllPresencesFromRedis(room.id);

        if (redisPresences.length > 0) {
            return redisPresences;
        }

        // Fallback to database
        const dbPresences = await this.prisma.magicPresence.findMany({
            where: {
                roomId: room.id,
                isActive: true,
                lastSeen: {
                    gte: new Date(Date.now() - this.config.presenceTimeout)
                }
            },
            orderBy: { joinedAt: 'asc' }
        });

        return dbPresences.map(p => ({
            id: p.id,
            roomId: p.roomId,
            userId: p.userId,
            sessionId: p.sessionId,
            userName: p.userName,
            userAvatar: p.userAvatar,
            isActive: p.isActive,
            lastSeen: p.lastSeen,
            cursorPosition: p.cursorPosition as any,
            selection: p.selection as any,
            viewportInfo: p.viewportInfo as any,
            deviceInfo: p.deviceInfo as any,
            joinedAt: p.joinedAt,
        }));
    }

    /**
     * Send heartbeat to keep presence alive
     */
    async sendHeartbeat(
        context: TenantContext,
        roomName: string
    ): Promise<void> {

        if (!context.organizationId || !context.sessionId) {
            return; // Silent fail for heartbeat
        }

        // Find the room
        const room = await this.prisma.magicRoom.findUnique({
            where: {
                name_organizationId: {
                    name: roomName,
                    organizationId: context.organizationId
                }
            }
        });

        if (!room) {
            return;
        }

        // Update last seen in Redis
        await this.updatePresenceInRedis(room.id, context.sessionId, {
            isActive: true,
        });

        // Periodically sync to database (every 10 heartbeats)
        const shouldSyncToDb = Math.random() < 0.1; // 10% chance
        if (shouldSyncToDb) {
            await this.prisma.magicPresence.updateMany({
                where: {
                    roomId: room.id,
                    sessionId: context.sessionId,
                },
                data: {
                    lastSeen: new Date(),
                    isActive: true,
                }
            });
        }
    }

    // ============================================================================
    // REDIS OPERATIONS
    // ============================================================================

    private async storePresenceInRedis(
        roomId: string,
        sessionId: string,
        presence: MagicPresenceInfo
    ): Promise<void> {
        const key = `${this.PRESENCE_KEY}:${roomId}:${sessionId}`;
        const roomKey = `${this.ROOM_PRESENCE_KEY}:${roomId}`;

        // Store individual presence
        await this.redis.client.set(key, JSON.stringify(presence), {
            EX: Math.floor(this.config.presenceTimeout / 1000)
        });

        // Add to room presence set
        await this.redis.client.sAdd(roomKey, sessionId);
        await this.redis.client.expire(roomKey, Math.floor(this.config.presenceTimeout / 1000));
    }

    private async updatePresenceInRedis(
        roomId: string,
        sessionId: string,
        updateData: Partial<MagicPresenceInfo>
    ): Promise<void> {
        const key = `${this.PRESENCE_KEY}:${roomId}:${sessionId}`;
        const currentData = await this.redis.client.get(key);

        if (currentData && typeof currentData === 'string') {
            const presence = JSON.parse(currentData) as MagicPresenceInfo;
            const updatedPresence = {
                ...presence,
                ...updateData,
                lastSeen: new Date(),
            };

            await this.redis.client.set(key, JSON.stringify(updatedPresence), {
                EX: Math.floor(this.config.presenceTimeout / 1000)
            });
        }
    }

    private async getPresenceFromRedis(
        roomId: string,
        sessionId: string
    ): Promise<MagicPresenceInfo | null> {
        const key = `${this.PRESENCE_KEY}:${roomId}:${sessionId}`;
        const data = await this.redis.client.get(key);

        return data && typeof data === 'string' ? JSON.parse(data) as MagicPresenceInfo : null;
    }

    private async getAllPresencesFromRedis(roomId: string): Promise<MagicPresenceInfo[]> {
        const roomKey = `${this.ROOM_PRESENCE_KEY}:${roomId}`;
        const sessionIds = await this.redis.client.sMembers(roomKey);

        const presences: MagicPresenceInfo[] = [];
        for (const sessionId of sessionIds) {
            const presence = await this.getPresenceFromRedis(roomId, sessionId);
            if (presence && presence.isActive) {
                presences.push(presence);
            }
        }

        return presences;
    }

    private async removePresenceFromRedis(
        roomId: string,
        sessionId: string
    ): Promise<void> {
        const key = `${this.PRESENCE_KEY}:${roomId}:${sessionId}`;
        const roomKey = `${this.ROOM_PRESENCE_KEY}:${roomId}`;

        await this.redis.client.del(key);
        await this.redis.client.sRem(roomKey, sessionId);
    }

    // ============================================================================
    // EVENT BROADCASTING
    // ============================================================================

    private async broadcastPresenceEvent(
        context: TenantContext,
        roomId: string,
        presenceType: MagicPresenceEventType,
        presenceData: any
    ): Promise<void> {

        const presenceEvent: MagicPresenceEvent = {
            id: createEventId(),
            eventType: 'magic_presence_events',
            channel: `org:${context.organizationId}:magic:presence:${roomId}`,
            payload: {
                magicRoomId: roomId,
                presenceType,
                ...presenceData,
            },
            organizationId: context.organizationId,
            userId: context.userId,
            sessionId: context.sessionId,
            createdAt: new Date().toISOString(),
            acknowledgment: false,
            retryCount: 0,
            priority: 'NORMAL',
            status: 'PENDING',
        };

        // Validate event
        const validation = validateEventByType('magic_presence_events', presenceEvent);
        if (!validation.success) {
            this.logger.error(`Invalid presence event: ${validation.error}`);
            return;
        }

        // Broadcast through event stream
        await this.eventStream.publishEvent(validation.data);
    }

    // ============================================================================
    // CLEANUP & MAINTENANCE
    // ============================================================================

    private startPresenceCleanupJob(): void {
        // Clean up inactive presences every minute
        setInterval(async () => {
            try {
                await this.cleanupInactivePresences();
            } catch (error) {
                this.logger.error('Presence cleanup failed:', error);
            }
        }, 60000); // 1 minute
    }

    private async cleanupInactivePresences(): Promise<void> {
        const cutoffTime = new Date(Date.now() - this.config.presenceTimeout);

        // Mark inactive presences in database
        const result = await this.prisma.magicPresence.updateMany({
            where: {
                lastSeen: { lt: cutoffTime },
                isActive: true,
            },
            data: {
                isActive: false,
            }
        });

        if (result.count > 0) {
            this.logger.debug(`Cleaned up ${result.count} inactive presences`);
        }
    }
}
