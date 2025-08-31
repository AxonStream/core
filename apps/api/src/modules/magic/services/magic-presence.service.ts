import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/services/prisma.service';
import { RedisService } from '../../../common/services/redis.service';
import { EventStreamService } from '../../../common/services/event-stream.service';
import { TenantContext } from '../../../common/services/tenant-aware.service';
import { MagicPresenceEventType } from '../../../common/schemas/axon-events.schema';

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
export class MagicPresenceService implements OnModuleInit {
    private readonly logger = new Logger(MagicPresenceService.name);

    // Production-grade configuration with environment-driven values
    private readonly config = {
        // Presence management
        presenceTimeout: 300000, // 5 minutes - configurable via environment
        heartbeatInterval: 30000, // 30 seconds - configurable via environment
        maxPresencesPerRoom: 100, // configurable via environment
        presenceCleanupInterval: 60000, // 1 minute - configurable via environment

        // Database sync strategy
        dbSyncStrategy: 'adaptive' as 'adaptive' | 'always' | 'periodic',
        dbSyncInterval: 300000, // 5 minutes - configurable via environment
        dbSyncThreshold: 0.1, // 10% - configurable via environment

        // Performance optimization
        enablePresenceCaching: true,
        cacheExpiration: 600, // 10 minutes - configurable via environment
        batchUpdateSize: 50, // configurable via environment

        // Monitoring and alerts
        enablePresenceMonitoring: true,
        presenceAlertThreshold: 0.8, // 80% - configurable via environment
        maxInactivePresences: 1000 // configurable via environment
    };

    // Redis keys for presence management
    private readonly PRESENCE_KEY = 'magic:presence';
    private readonly ROOM_PRESENCE_KEY = 'magic:room_presence';
    private readonly USER_ROOMS_KEY = 'magic:user_rooms';
    private readonly PRESENCE_STATS_KEY = 'magic:presence_stats';

    constructor(
        private prisma: PrismaService,
        private redis: RedisService,
        private eventStream: EventStreamService,
        private configService: ConfigService,
    ) {
        this.loadConfiguration();
    }

    async onModuleInit() {
        if (this.config.enablePresenceMonitoring) {
            this.setupPresenceCleanupJob();
            this.setupPresenceMonitoring();
            this.logger.log('Magic presence service initialized with monitoring');
        }
    }

    private loadConfiguration(): void {
        // Load configuration from environment with sensible defaults
        this.config.presenceTimeout = this.configService.get<number>('MAGIC_PRESENCE_TIMEOUT_MS', 300000);
        this.config.heartbeatInterval = this.configService.get<number>('MAGIC_HEARTBEAT_INTERVAL_MS', 30000);
        this.config.maxPresencesPerRoom = this.configService.get<number>('MAGIC_MAX_PRESENCES_PER_ROOM', 100);
        this.config.presenceCleanupInterval = this.configService.get<number>('MAGIC_PRESENCE_CLEANUP_INTERVAL_MS', 60000);
        this.config.dbSyncInterval = this.configService.get<number>('MAGIC_DB_SYNC_INTERVAL_MS', 300000);
        this.config.dbSyncThreshold = this.configService.get<number>('MAGIC_DB_SYNC_THRESHOLD', 0.1);
        this.config.presenceAlertThreshold = this.configService.get<number>('MAGIC_PRESENCE_ALERT_THRESHOLD', 0.8);
        this.config.maxInactivePresences = this.configService.get<number>('MAGIC_MAX_INACTIVE_PRESENCES', 1000);

        // Load sync strategy
        const syncStrategy = this.configService.get<string>('MAGIC_DB_SYNC_STRATEGY', 'adaptive');
        if (['adaptive', 'always', 'periodic'].includes(syncStrategy)) {
            this.config.dbSyncStrategy = syncStrategy as any;
        }
    }

    async joinRoom(
        context: TenantContext,
        roomName: string,
        userData: {
            userName: string;
            userAvatar?: string;
            deviceInfo?: any;
        }
    ): Promise<MagicPresenceInfo> {
        try {
            // Validate room exists and user has access
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

            // Check room capacity
            const currentPresences = await this.getRoomPresences(context, roomName);
            if (currentPresences.length >= this.config.maxPresencesPerRoom) {
                throw new Error(`Room '${roomName}' is at maximum capacity`);
            }

            // Generate unique presence ID
            const presenceId = this.generatePresenceId(context.organizationId, roomName, context.userId!);
            const sessionId = context.sessionId || this.generateSessionId();

            // Create presence info
            const presenceInfo: MagicPresenceInfo = {
                id: presenceId,
                roomId: room.id,
                userId: context.userId!,
                sessionId,
                userName: userData.userName,
                userAvatar: userData.userAvatar,
                isActive: true,
                lastSeen: new Date(),
                deviceInfo: userData.deviceInfo,
                joinedAt: new Date(),
            };

            // Store in Redis for real-time access
            await this.storePresenceInRedis(room.id, sessionId, presenceInfo);

            // Store in database based on sync strategy
            await this.syncPresenceToDatabase(presenceInfo, 'join');

            // Update user's room associations
            await this.redis.client.sAdd(
                `${this.USER_ROOMS_KEY}:${context.userId}`,
                roomName
            );

            // Update room presence count
            await this.redis.client.hIncrBy(
                `${this.PRESENCE_STATS_KEY}:${room.id}`,
                'active_presences',
                1
            );

            // Broadcast presence event
            await this.broadcastPresenceEvent(
                context,
                room.id,
                'presence_join',
                presenceInfo
            );

            this.logger.log(`User ${context.userId} joined room ${roomName}`);

            return presenceInfo;
        } catch (error) {
            this.logger.error(`Failed to join room ${roomName}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async leaveRoom(
        context: TenantContext,
        roomName: string
    ): Promise<void> {
        try {
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

            const sessionId = context.sessionId || this.generateSessionId();
            const presenceKey = `${this.ROOM_PRESENCE_KEY}:${room.id}:${sessionId}`;

            // Get presence info before removal
            const presenceInfo = await this.getPresenceFromRedis(room.id, sessionId);
            if (!presenceInfo) {
                this.logger.warn(`Presence not found for session ${sessionId} in room ${roomName}`);
                return;
            }

            // Remove from Redis
            await this.removePresenceFromRedis(room.id, sessionId);

            // Remove from database
            await this.syncPresenceToDatabase(presenceInfo, 'leave');

            // Update user's room associations
            await this.redis.client.sRem(
                `${this.USER_ROOMS_KEY}:${context.userId}`,
                roomName
            );

            // Update room presence count
            await this.redis.client.hIncrBy(
                `${this.PRESENCE_STATS_KEY}:${room.id}`,
                'active_presences',
                -1
            );

            // Broadcast presence event
            await this.broadcastPresenceEvent(
                context,
                room.id,
                'presence_leave',
                presenceInfo
            );

            this.logger.log(`User ${context.userId} left room ${roomName}`);
        } catch (error) {
            this.logger.error(`Failed to leave room ${roomName}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async updatePresence(
        context: TenantContext,
        roomName: string,
        updateData: PresenceUpdateData
    ): Promise<void> {
        try {
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

            const sessionId = context.sessionId || this.generateSessionId();
            const presenceKey = `${this.ROOM_PRESENCE_KEY}:${room.id}:${sessionId}`;

            // Get current presence
            const currentPresence = await this.getPresenceFromRedis(room.id, sessionId);
            if (!currentPresence) {
                throw new Error('Presence not found');
            }

            // Update presence with new data
            const updatedPresence: MagicPresenceInfo = {
                ...currentPresence,
                ...updateData,
                lastSeen: new Date(),
            };

            // Store updated presence in Redis
            await this.updatePresenceInRedis(room.id, sessionId, updatedPresence);

            // Sync to database based on strategy
            await this.syncPresenceToDatabase(updatedPresence, 'update');

            // Broadcast presence update event
            await this.broadcastPresenceEvent(
                context,
                room.id,
                'presence_update',
                updatedPresence
            );

        } catch (error) {
            this.logger.error(`Failed to update presence in room ${roomName}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getRoomPresences(
        context: TenantContext,
        roomName: string
    ): Promise<MagicPresenceInfo[]> {
        try {
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

            // Get all presences from Redis
            const presences = await this.getAllPresencesFromRedis(room.id);

            // Filter out inactive presences
            const activePresences = presences.filter(presence => {
                const timeSinceLastSeen = Date.now() - presence.lastSeen.getTime();
                return timeSinceLastSeen < this.config.presenceTimeout;
            });

            // Update inactive presences in Redis
            const inactivePresences = presences.filter(presence => {
                const timeSinceLastSeen = Date.now() - presence.lastSeen.getTime();
                return timeSinceLastSeen >= this.config.presenceTimeout;
            });

            for (const presence of inactivePresences) {
                await this.updatePresenceInRedis(room.id, presence.sessionId, {
                    ...presence,
                    isActive: false
                });
            }

            return activePresences;
        } catch (error) {
            this.logger.error(`Failed to get room presences for ${roomName}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async sendHeartbeat(
        context: TenantContext,
        roomName: string
    ): Promise<void> {
        try {
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

            const sessionId = context.sessionId || this.generateSessionId();
            const presenceKey = `${this.ROOM_PRESENCE_KEY}:${room.id}:${sessionId}`;

            // Get current presence
            const currentPresence = await this.getPresenceFromRedis(room.id, sessionId);
            if (!currentPresence) {
                throw new Error('Presence not found');
            }

            // Update last seen timestamp
            const updatedPresence: MagicPresenceInfo = {
                ...currentPresence,
                lastSeen: new Date(),
                isActive: true,
            };

            // Update in Redis
            await this.updatePresenceInRedis(room.id, sessionId, updatedPresence);

            // Update heartbeat stats
            await this.redis.client.hIncrBy(
                `${this.PRESENCE_STATS_KEY}:${room.id}`,
                'heartbeats',
                1
            );

            // Sync to database periodically
            await this.syncPresenceToDatabase(updatedPresence, 'heartbeat');

        } catch (error) {
            this.logger.error(`Failed to send heartbeat in room ${roomName}: ${error.message}`, error.stack);
            throw error;
        }
    }

    // ==================== PRIVATE METHODS ====================

    private async storePresenceInRedis(
        roomId: string,
        sessionId: string,
        presence: MagicPresenceInfo
    ): Promise<void> {
        const roomKey = `${this.ROOM_PRESENCE_KEY}:${roomId}`;
        const presenceKey = `${roomKey}:${sessionId}`;

        // Store presence data
        await this.redis.client.hSet(
            presenceKey,
            'presence',
            JSON.stringify(presence)
        );

        // Add to room's presence set
        await this.redis.client.sAdd(roomKey, sessionId);

        // Set expiration based on config
        const expirationSeconds = Math.floor(this.config.presenceTimeout / 1000);
        await this.redis.client.expire(presenceKey, expirationSeconds);
        await this.redis.client.expire(roomKey, expirationSeconds);
    }

    private async updatePresenceInRedis(
        roomId: string,
        sessionId: string,
        updateData: Partial<MagicPresenceInfo>
    ): Promise<void> {
        const presenceKey = `${this.ROOM_PRESENCE_KEY}:${roomId}:${sessionId}`;
        const currentPresence = await this.getPresenceFromRedis(roomId, sessionId);

        if (currentPresence) {
            const updatedPresence = { ...currentPresence, ...updateData };
            await this.redis.client.hSet(
                presenceKey,
                'presence',
                JSON.stringify(updatedPresence)
            );

            // Reset expiration
            const expirationSeconds = Math.floor(this.config.presenceTimeout / 1000);
            await this.redis.client.expire(presenceKey, expirationSeconds);
        }
    }

    private async getPresenceFromRedis(
        roomId: string,
        sessionId: string
    ): Promise<MagicPresenceInfo | null> {
        try {
            const presenceKey = `${this.ROOM_PRESENCE_KEY}:${roomId}:${sessionId}`;
            const presenceData = await this.redis.client.hGet(presenceKey, 'presence');

            if (!presenceData) {
                return null;
            }

            const presence = JSON.parse(presenceData as string);
            return {
                ...presence,
                lastSeen: new Date(presence.lastSeen),
                joinedAt: new Date(presence.joinedAt),
            };
        } catch (error) {
            this.logger.error(`Failed to get presence from Redis: ${error.message}`, error.stack);
            return null;
        }
    }

    private async getAllPresencesFromRedis(roomId: string): Promise<MagicPresenceInfo[]> {
        try {
            const roomKey = `${this.ROOM_PRESENCE_KEY}:${roomId}`;
            const sessionIds = await this.redis.client.sMembers(roomKey);

            const presences: MagicPresenceInfo[] = [];
            for (const sessionId of sessionIds) {
                const presence = await this.getPresenceFromRedis(roomId, sessionId);
                if (presence) {
                    presences.push(presence);
                }
            }

            return presences;
        } catch (error) {
            this.logger.error(`Failed to get all presences from Redis: ${error.message}`, error.stack);
            return [];
        }
    }

    private async removePresenceFromRedis(
        roomId: string,
        sessionId: string
    ): Promise<void> {
        try {
            const roomKey = `${this.ROOM_PRESENCE_KEY}:${roomId}`;
            const presenceKey = `${roomKey}:${sessionId}`;

            // Remove from room's presence set
            await this.redis.client.sRem(roomKey, sessionId);

            // Delete presence data
            await this.redis.client.del(presenceKey);
        } catch (error) {
            this.logger.error(`Failed to remove presence from Redis: ${error.message}`, error.stack);
        }
    }

    private async syncPresenceToDatabase(
        presence: MagicPresenceInfo,
        action: 'join' | 'leave' | 'update' | 'heartbeat'
    ): Promise<void> {
        try {
            // Determine if we should sync based on strategy
            const shouldSync = this.shouldSyncToDatabase(action);
            if (!shouldSync) {
                return;
            }

            // Use upsert to handle both insert and update
            await this.prisma.magicPresence.upsert({
                where: {
                    roomId_sessionId: {
                        roomId: presence.roomId,
                        sessionId: presence.sessionId
                    }
                },
                update: {
                    isActive: presence.isActive,
                    lastSeen: presence.lastSeen,
                    cursorPosition: presence.cursorPosition as any,
                    selection: presence.selection as any,
                    viewportInfo: presence.viewportInfo as any,
                    deviceInfo: presence.deviceInfo as any,
                },
                create: {
                    roomId: presence.roomId,
                    userId: presence.userId,
                    sessionId: presence.sessionId,
                    organizationId: presence.roomId.split('_')[0], // Extract org ID from roomId
                    userName: presence.userName,
                    userAvatar: presence.userAvatar,
                    isActive: presence.isActive,
                    lastSeen: presence.lastSeen,
                    cursorPosition: presence.cursorPosition as any,
                    selection: presence.selection as any,
                    viewportInfo: presence.viewportInfo as any,
                    deviceInfo: presence.deviceInfo as any,
                    joinedAt: presence.joinedAt,
                }
            });

        } catch (error) {
            this.logger.error(`Failed to sync presence to database: ${error.message}`, error.stack);
            // Don't throw - database sync failure shouldn't break real-time functionality
        }
    }

    private shouldSyncToDatabase(action: 'join' | 'leave' | 'update' | 'heartbeat'): boolean {
        switch (this.config.dbSyncStrategy) {
            case 'always':
                return true;
            case 'periodic':
                return action === 'join' || action === 'leave';
            case 'adaptive':
                // Sync joins/leaves always, updates occasionally, heartbeats rarely
                if (action === 'join' || action === 'leave') return true;
                if (action === 'update') {
                    // Use adaptive threshold based on system load
                    const systemLoad = this.getSystemLoad();
                    return systemLoad < this.config.presenceAlertThreshold;
                }
                if (action === 'heartbeat') {
                    // Only sync heartbeats if system is under low load
                    const systemLoad = this.getSystemLoad();
                    return systemLoad < this.config.dbSyncThreshold;
                }
                return false;
            default:
                return false;
        }
    }

    private getSystemLoad(): number {
        try {
            const memoryUsage = process.memoryUsage();
            const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
            const memoryThreshold = this.configService.get<number>('MAGIC_MEMORY_THRESHOLD_MB', 1024);

            // Return load as percentage (0-1)
            return Math.min(memoryUsageMB / memoryThreshold, 1);
        } catch (error) {
            return 0.5; // Default to medium load if monitoring fails
        }
    }

    private async broadcastPresenceEvent(
        context: TenantContext,
        roomId: string,
        presenceType: MagicPresenceEventType,
        presenceData: any
    ): Promise<void> {
        try {
            const event = {
                type: presenceType,
                roomId,
                presence: presenceData,
                timestamp: new Date().toISOString(),
                organizationId: context.organizationId,
                userId: context.userId,
            };

            // Broadcast via event stream
            await this.eventStream.publishEvent({
                id: this.generateEventId(),
                eventType: 'magic_presence',
                channel: `org:${context.organizationId}:magic:${roomId}`,
                payload: event,
                organizationId: context.organizationId,
                userId: context.userId,
                sessionId: context.sessionId,
                acknowledgment: false,
                retryCount: 0,
                createdAt: new Date().toISOString(),
                metadata: { presenceType }
            });

        } catch (error) {
            this.logger.error(`Failed to broadcast presence event: ${error.message}`, error.stack);
        }
    }

    private setupPresenceCleanupJob(): void {
        // Clean up inactive presences based on configurable interval
        setInterval(async () => {
            try {
                await this.cleanupInactivePresences();
            } catch (error) {
                this.logger.error(`Presence cleanup failed: ${error.message}`, error.stack);
            }
        }, this.config.presenceCleanupInterval);
    }

    private setupPresenceMonitoring(): void {
        // Monitor presence health every 30 seconds
        setInterval(async () => {
            try {
                await this.monitorPresenceHealth();
            } catch (error) {
                this.logger.error(`Presence monitoring failed: ${error.message}`, error.stack);
            }
        }, 30 * 1000);
    }

    private async cleanupInactivePresences(): Promise<void> {
        try {
            const cutoffTime = new Date(Date.now() - this.config.presenceTimeout);

            // Find inactive presences in database
            const inactivePresences = await this.prisma.magicPresence.findMany({
                where: {
                    lastSeen: { lt: cutoffTime },
                    isActive: true
                },
                take: this.config.batchUpdateSize
            });

            if (inactivePresences.length === 0) {
                return;
            }

            // Mark as inactive in database
            await this.prisma.magicPresence.updateMany({
                where: {
                    id: { in: inactivePresences.map(p => p.id) }
                },
                data: {
                    isActive: false
                }
            });

            // Remove from Redis
            for (const presence of inactivePresences) {
                await this.removePresenceFromRedis(presence.roomId, presence.sessionId);
            }

            this.logger.log(`Cleaned up ${inactivePresences.length} inactive presences`);

        } catch (error) {
            this.logger.error(`Failed to cleanup inactive presences: ${error.message}`, error.stack);
        }
    }

    private async monitorPresenceHealth(): Promise<void> {
        try {
            // Get presence statistics
            const totalPresences = await this.prisma.magicPresence.count();
            const activePresences = await this.prisma.magicPresence.count({
                where: { isActive: true }
            });

            const activeRatio = totalPresences > 0 ? activePresences / totalPresences : 1;

            // Alert if too many inactive presences
            if (activeRatio < this.config.presenceAlertThreshold) {
                this.logger.warn(`Low presence health: ${(activeRatio * 100).toFixed(1)}% active presences`);

                // Trigger cleanup if needed
                if (totalPresences - activePresences > this.config.maxInactivePresences) {
                    await this.cleanupInactivePresences();
                }
            }

        } catch (error) {
            this.logger.error(`Failed to monitor presence health: ${error.message}`, error.stack);
        }
    }

    // ==================== UTILITY METHODS ====================

    private generatePresenceId(organizationId: string, roomName: string, userId: string): string {
        return `presence_${organizationId}_${roomName}_${userId}_${Date.now()}`;
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateEventId(): string {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
