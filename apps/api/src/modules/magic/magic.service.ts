import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';  // REUSE
import { RedisService } from '../../common/services/redis.service';    // REUSE  
import { TenantAwareService, TenantContext } from '../../common/services/tenant-aware.service'; // REUSE
import { EventStreamService } from '../../common/services/event-stream.service'; // REUSE
import { RBACService } from '../rbac/rbac.service'; // REUSE
import {
    MagicEvent,
    MagicEventSchema,
    validateEventByType,
    createEventId
} from '../../common/schemas/axon-events.schema'; // REUSE EXISTING!
import { MagicOperationalTransformService, MagicOperation, ConflictResolutionStrategy } from './services/magic-operational-transform.service';
import { MagicTimeTravelService } from './services/magic-time-travel.service';
import { MagicPresenceService, MagicPresenceInfo, PresenceUpdateData } from './services/magic-presence.service';
import { MagicMetricsService } from './services/magic-metrics.service';

export interface MagicRoomConfig {
    pattern?: string;
    autoCreate?: boolean;
    timeTravel?: boolean;
    presence?: boolean;
    persistence?: boolean;
    maxSnapshots?: number;
    conflictResolution?: ConflictResolutionStrategy;
    enableAdvancedOT?: boolean;
    enablePresenceAwareness?: boolean;
    enableRealtimeSync?: boolean;
}

export interface MagicState {
    id: string;
    roomId: string;
    stateKey: string;
    currentState: Record<string, any>;
    version: number;
    lastModifiedBy: string;
    lastModifiedAt: Date;
}

@Injectable()
export class MagicService {
    private readonly logger = new Logger(MagicService.name);

    constructor(
        private prisma: PrismaService,              // EXISTING
        private redis: RedisService,                // EXISTING  
        private tenantAware: TenantAwareService,    // EXISTING
        private eventStream: EventStreamService,    // EXISTING
        private rbac: RBACService,                  // EXISTING
        private magicOT: MagicOperationalTransformService,  // NEW - only OT logic
        private magicTimeTravel: MagicTimeTravelService,    // NEW - only time travel
        private magicPresence: MagicPresenceService,        // NEW - only presence logic
        private metricsService: MagicMetricsService,        // NEW - metrics tracking
    ) { }

    /**
     * Create a new Magic collaborative room with initial state
     * REUSES existing tenant validation and RBAC patterns
     */
    async createMagicRoom(
        context: TenantContext,  // REUSE existing tenant pattern
        roomName: string,
        initialState: Record<string, any>,
        config: MagicRoomConfig = {}
    ): Promise<MagicState> {

        // Validate tenant context
        if (!context.organizationId || !context.userId) {
            throw new Error('Invalid tenant context');
        }

        // Create Magic room using existing Prisma patterns
        const room = await this.prisma.magicRoom.create({
            data: {
                name: roomName,
                organizationId: context.organizationId,
                config: config as any,
                pattern: config.pattern,
            }
        });

        // Create initial state
        const state = await this.prisma.magicState.create({
            data: {
                roomId: room.id,
                stateKey: 'main',
                currentState: initialState,
                version: 0,
                lastModifiedBy: context.userId || 'system',
            }
        });

        // Create Magic event using EXISTING event patterns
        const magicEvent: MagicEvent = {
            id: createEventId(), // REUSE existing function
            eventType: 'magic_events',
            channel: `org:${context.organizationId}:magic:${roomName}`,
            payload: {
                magicRoomId: room.id,
                stateKey: 'main',
                operation: {
                    type: 'magic_set',
                    path: [],
                    value: initialState,
                    timestamp: Date.now(),
                    clientId: context.sessionId || 'system',
                    version: 0,
                },
                currentState: initialState,
                conflictResolution: config.conflictResolution || 'operational_transform',
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

        // Validate using EXISTING schema validation
        const validation = validateEventByType('magic_events', magicEvent);
        if (!validation.success) {
            throw new Error(`Invalid magic event: ${validation.error}`);
        }

        // Store magic event in database
        await this.prisma.magicEvent.create({
            data: {
                roomId: room.id,
                eventType: 'magic_events',
                payload: magicEvent.payload as any,
                organizationId: context.organizationId,
                userId: context.userId,
                sessionId: context.sessionId,
            }
        });

        // Store using EXISTING event stream
        await this.eventStream.publishEvent(validation.data);

        // Create snapshot using NEW time travel service
        if (config.timeTravel !== false) {
            await this.magicTimeTravel.createSnapshot(context, room.id, initialState, 0);
        }

        this.logger.log(`Created Magic room '${roomName}' for org ${context.organizationId}`);

        return {
            id: state.id,
            roomId: room.id,
            stateKey: 'main',
            currentState: initialState,
            version: 0,
            lastModifiedBy: context.userId || 'system',
            lastModifiedAt: state.lastModifiedAt,
        };
    }

    /**
     * Get current state of a Magic room
     * REUSES existing tenant isolation
     */
    async getCurrentState(
        context: TenantContext,
        roomName: string,
        stateKey = 'main'
    ): Promise<MagicState | null> {

        // Validate tenant context
        if (!context.organizationId) {
            throw new Error('Invalid tenant context');
        }

        // Find room with tenant isolation
        const room = await this.prisma.magicRoom.findUnique({
            where: {
                name_organizationId: {
                    name: roomName,
                    organizationId: context.organizationId
                }
            }
        });

        if (!room) {
            return null;
        }

        const state = await this.prisma.magicState.findUnique({
            where: {
                roomId_stateKey: { roomId: room.id, stateKey }
            }
        });

        if (!state) {
            return null;
        }

        return {
            id: state.id,
            roomId: room.id,
            stateKey: state.stateKey,
            currentState: state.currentState as Record<string, any>,
            version: state.version,
            lastModifiedBy: state.lastModifiedBy,
            lastModifiedAt: state.lastModifiedAt,
        };
    }

    /**
     * List Magic rooms for organization
     * REUSES existing tenant isolation
     */
    async listRooms(context: TenantContext): Promise<Array<{
        id: string;
        name: string;
        config: any;
        createdAt: Date;
        updatedAt: Date;
    }>> {

        // Validate tenant context
        if (!context.organizationId) {
            throw new Error('Invalid tenant context');
        }

        const rooms = await this.prisma.magicRoom.findMany({
            where: {
                organizationId: context.organizationId
            },
            orderBy: { updatedAt: 'desc' }
        });

        return rooms.map(room => ({
            id: room.id,
            name: room.name,
            config: room.config,
            createdAt: room.createdAt,
            updatedAt: room.updatedAt,
        }));
    }

    /**
     * PRODUCTION-GRADE: Process Magic operation with advanced conflict resolution
     * Integrates with the full OT engine for enterprise-grade collaboration
     */
    async processOperation(
        context: TenantContext,
        roomName: string,
        operation: Partial<MagicOperation>,
        strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.OPERATIONAL_TRANSFORM
    ): Promise<{
        success: boolean;
        transformedOperation?: MagicOperation;
        conflicts: any[];
        appliedOperations: MagicOperation[];
        requiresUserIntervention: boolean;
        stateVersion: number;
    }> {

        // Validate tenant context
        if (!context.organizationId) {
            throw new Error('Invalid tenant context');
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

        // Create complete operation object with metadata
        const completeOperation: MagicOperation = {
            id: operation.id || `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: operation.type!,
            path: operation.path!,
            value: operation.value,
            index: operation.index,
            timestamp: operation.timestamp || Date.now(),
            clientId: operation.clientId || context.sessionId || 'unknown',
            version: operation.version || Date.now(),
            correlationId: operation.correlationId,
            priority: operation.priority || 'normal',
            causality: operation.causality || [],
            metadata: {
                userId: context.userId!,
                sessionId: context.sessionId || '',
                branchName: operation.metadata?.branchName || 'main',
                deviceInfo: operation.metadata?.deviceInfo,
                selectionRange: operation.metadata?.selectionRange,
            },
        };

        try {
            // Process operation through OT engine
            const result = await this.magicOT.processOperation(
                context,
                room.id,
                completeOperation,
                strategy
            );

            if (result.success && result.transformedOperation) {
                // Update state in database
                await this.updateRoomState(room.id, result.transformedOperation);

                // Create snapshot if time travel is enabled
                const roomConfig = room.config as MagicRoomConfig;
                if (roomConfig.timeTravel !== false) {
                    await this.magicTimeTravel.createSnapshot(
                        context,
                        room.id,
                        result.transformedOperation.value || {},
                        result.transformedOperation.version,
                        `Operation ${result.transformedOperation.type} applied`
                    );
                }

                this.logger.log(`Magic operation processed successfully: ${completeOperation.id} in room ${roomName}`);
            }

            return {
                success: result.success,
                transformedOperation: result.transformedOperation,
                conflicts: result.conflicts,
                appliedOperations: result.appliedOperations,
                requiresUserIntervention: result.requiresUserIntervention,
                stateVersion: result.transformedOperation?.version || 0,
            };

        } catch (error) {
            this.logger.error(`Magic operation processing failed: ${error.message}`, error.stack);

            return {
                success: false,
                conflicts: [],
                appliedOperations: [],
                requiresUserIntervention: true,
                stateVersion: 0,
            };
        }
    }

    /**
     * Update room state after successful operation
     */
    private async updateRoomState(roomId: string, operation: MagicOperation): Promise<void> {
        // Get current state
        const currentState = await this.prisma.magicState.findUnique({
            where: {
                roomId_stateKey: { roomId, stateKey: 'main' }
            }
        });

        if (!currentState) {
            // Create initial state
            await this.prisma.magicState.create({
                data: {
                    roomId,
                    stateKey: 'main',
                    currentState: operation.value || {},
                    version: operation.version,
                    lastModifiedBy: operation.metadata.userId,
                }
            });
        } else {
            // Apply operation to existing state
            const newState = this.applyOperationToState(
                currentState.currentState as Record<string, any>,
                operation
            );

            await this.prisma.magicState.update({
                where: {
                    roomId_stateKey: { roomId, stateKey: 'main' }
                },
                data: {
                    currentState: newState,
                    version: operation.version,
                    lastModifiedBy: operation.metadata.userId,
                    lastModifiedAt: new Date(),
                }
            });
        }
    }

    /**
     * Apply operation to state object (production-grade state transformation)
     */
    private applyOperationToState(state: Record<string, any>, operation: MagicOperation): Record<string, any> {
        const newState = JSON.parse(JSON.stringify(state)); // Deep clone

        try {
            switch (operation.type) {
                case 'magic_set':
                    this.setNestedProperty(newState, operation.path, operation.value);
                    break;

                case 'magic_array_insert':
                    const arr1 = this.getNestedProperty(newState, operation.path);
                    if (Array.isArray(arr1) && typeof operation.index === 'number') {
                        arr1.splice(operation.index, 0, operation.value);
                    }
                    break;

                case 'magic_array_delete':
                    const arr2 = this.getNestedProperty(newState, operation.path);
                    if (Array.isArray(arr2) && typeof operation.index === 'number') {
                        arr2.splice(operation.index, 1);
                    }
                    break;

                case 'magic_array_move':
                    const arr3 = this.getNestedProperty(newState, operation.path);
                    if (Array.isArray(arr3) && typeof operation.index === 'number' && operation.value?.toIndex !== undefined) {
                        const item = arr3.splice(operation.index, 1)[0];
                        arr3.splice(operation.value.toIndex, 0, item);
                    }
                    break;

                case 'magic_object_merge':
                    const obj = this.getNestedProperty(newState, operation.path);
                    if (typeof obj === 'object' && obj !== null && typeof operation.value === 'object') {
                        Object.assign(obj, operation.value);
                    }
                    break;

                default:
                    this.logger.warn(`Unknown operation type: ${operation.type}`);
            }
        } catch (error) {
            this.logger.error(`Failed to apply operation to state: ${error.message}`);
            throw error;
        }

        return newState;
    }

    /**
     * Helper methods for nested property access
     */
    private setNestedProperty(obj: any, path: string[], value: any): void {
        let current = obj;
        for (let i = 0; i < path.length - 1; i++) {
            if (!(path[i] in current)) {
                current[path[i]] = {};
            }
            current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
    }

    private getNestedProperty(obj: any, path: string[]): any {
        let current = obj;
        for (const segment of path) {
            if (current && typeof current === 'object' && segment in current) {
                current = current[segment];
            } else {
                return undefined;
            }
        }
        return current;
    }

    // ============================================================================
    // PRESENCE AWARENESS METHODS
    // ============================================================================

    /**
     * User joins a Magic room for collaboration
     */
    async joinMagicRoom(
        context: TenantContext,
        roomName: string,
        userData: {
            userName: string;
            userAvatar?: string;
            deviceInfo?: any;
        }
    ): Promise<MagicPresenceInfo> {
        return await this.magicPresence.joinRoom(context, roomName, userData);
    }

    /**
     * User leaves a Magic room
     */
    async leaveMagicRoom(
        context: TenantContext,
        roomName: string
    ): Promise<void> {
        return await this.magicPresence.leaveRoom(context, roomName);
    }

    /**
     * Update user's cursor position, selection, or viewport in real-time
     */
    async updateMagicPresence(
        context: TenantContext,
        roomName: string,
        updateData: PresenceUpdateData
    ): Promise<void> {
        return await this.magicPresence.updatePresence(context, roomName, updateData);
    }

    /**
     * Get all active users in a Magic room
     */
    async getMagicRoomPresences(
        context: TenantContext,
        roomName: string
    ): Promise<MagicPresenceInfo[]> {
        return await this.magicPresence.getRoomPresences(context, roomName);
    }

    /**
     * Send heartbeat to maintain presence
     */
    async sendMagicHeartbeat(
        context: TenantContext,
        roomName: string
    ): Promise<void> {
        return await this.magicPresence.sendHeartbeat(context, roomName);
    }
}
