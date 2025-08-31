/**
 * 🎯 MAGIC COLLABORATION SDK
 * 
 * Client-side implementation that integrates with the existing Magic API
 * Uses the real Magic collaboration features we already built:
 * - Operational Transform (OT)
 * - Time Travel & Branching
 * - Presence Awareness
 * - Conflict Resolution
 */

import { AxonPulsClient } from '../core/client';
import { MagicTimeTravel } from './magic-time-travel';
import { MagicPresence } from './magic-presence';
import type {
    MagicOperation,
    MagicState,
    MagicRoom,
    MagicSnapshot,
    MagicBranch,
    ConflictResolutionStrategy
} from './types';

export class MagicCollaboration {
    private client: AxonPulsClient;
    private timeTravel: MagicTimeTravel;
    private presence: MagicPresence;
    private activeRooms = new Map<string, MagicRoom>();

    constructor(client: AxonPulsClient) {
        this.client = client;
        this.timeTravel = new MagicTimeTravel(client);
        this.presence = new MagicPresence(client);
    }

    /**
     * Create a new Magic collaborative room
     */
    async createRoom(
        roomName: string,
        initialState: Record<string, any> = {},
        config: {
            timeTravel?: boolean;
            presence?: boolean;
            conflictResolution?: ConflictResolutionStrategy;
        } = {}
    ): Promise<MagicRoom> {
        const response = await this.client.request('POST', `/magic/rooms`, {
            name: roomName,
            initialState,
            config: {
                timeTravel: config.timeTravel !== false,
                presence: config.presence !== false,
                conflictResolution: config.conflictResolution || 'operational_transform',
                ...config
            }
        });

        const room: MagicRoom = {
            id: response.id,
            name: roomName,
            state: initialState,
            version: 0,
            config,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.activeRooms.set(roomName, room);
        return room;
    }

    /**
     * Join an existing Magic room
     */
    async joinRoom(
        roomName: string,
        userData: {
            userName: string;
            userAvatar?: string;
            deviceInfo?: any;
        }
    ): Promise<MagicRoom> {
        // Join room via API
        await this.client.request('POST', `/magic/${roomName}/join`, userData);

        // Get current state
        const stateResponse = await this.client.request('GET', `/magic/rooms/${roomName}/state`);

        const room: MagicRoom = {
            id: stateResponse.id,
            name: roomName,
            state: stateResponse.currentState,
            version: stateResponse.version,
            config: stateResponse.config,
            createdAt: new Date(stateResponse.createdAt),
            updatedAt: new Date(stateResponse.updatedAt)
        };

        this.activeRooms.set(roomName, room);

        // Join presence
        if (room.config.presence !== false) {
            await this.presence.joinRoom(roomName, userData);
        }

        return room;
    }

    /**
     * Leave a Magic room
     */
    async leaveRoom(roomName: string): Promise<void> {
        await this.client.request('POST', `/magic/${roomName}/leave`);

        if (this.activeRooms.has(roomName)) {
            const room = this.activeRooms.get(roomName)!;
            if (room.config.presence !== false) {
                await this.presence.leaveRoom(roomName);
            }
            this.activeRooms.delete(roomName);
        }
    }

    /**
     * Apply a Magic operation (with OT conflict resolution)
     */
    async applyOperation(
        roomName: string,
        operation: Omit<MagicOperation, 'id' | 'timestamp' | 'clientId' | 'version'>
    ): Promise<{
        success: boolean;
        transformedOperation?: MagicOperation;
        conflicts: any[];
        stateVersion: number;
    }> {
        const response = await this.client.request('POST', `/magic/rooms/${roomName}/operation`, {
            operation: {
                ...operation,
                timestamp: Date.now(),
                clientId: this.client.getUserId(),
                version: Date.now()
            }
        });

        if (response.success && response.transformedOperation) {
            // Update local room state
            const room = this.activeRooms.get(roomName);
            if (room) {
                room.state = response.transformedOperation.value || room.state;
                room.version = response.stateVersion;
                room.updatedAt = new Date();
            }
        }

        return response;
    }

    /**
     * Get current room state
     */
    async getRoomState(roomName: string): Promise<MagicState | null> {
        try {
            const response = await this.client.request('GET', `/magic/rooms/${roomName}/state`);
            return response;
        } catch (error) {
            return null;
        }
    }

    /**
     * Subscribe to real-time room updates
     */
    async subscribeToRoom(roomName: string): Promise<void> {
        // Subscribe to WebSocket events for this room
        await this.client.subscribe([`magic:${roomName}`]);

        // Listen for Magic events
        this.client.on('magic_operation_applied', (data: any) => {
            if (data.roomName === roomName) {
                this.handleRemoteOperation(roomName, data.operation);
            }
        });

        this.client.on('magic_state_sync', (data: any) => {
            if (data.roomName === roomName) {
                this.handleStateSync(roomName, data);
            }
        });
    }

    /**
     * Unsubscribe from room updates
     */
    async unsubscribeFromRoom(roomName: string): Promise<void> {
        await this.client.unsubscribe([`magic:${roomName}`]);
    }

    /**
     * Get time travel capabilities
     */
    getTimeTravel(): MagicTimeTravel {
        return this.timeTravel;
    }

    /**
     * Get presence capabilities
     */
    getPresence(): MagicPresence {
        return this.presence;
    }

    /**
     * Get active rooms
     */
    getActiveRooms(): MagicRoom[] {
        return Array.from(this.activeRooms.values());
    }

    /**
     * Handle remote operations from other clients
     */
    private handleRemoteOperation(roomName: string, operation: MagicOperation): void {
        const room = this.activeRooms.get(roomName);
        if (!room) return;

        // Apply operation to local state
        room.state = operation.value || room.state;
        room.version = operation.version;
        room.updatedAt = new Date();

        // Emit event for UI updates
        this.client.emit('magic_operation_received', {
            roomName,
            operation,
            timestamp: new Date()
        });
    }

    /**
     * Handle state synchronization
     */
    private handleStateSync(roomName: string, data: any): void {
        const room = this.activeRooms.get(roomName);
        if (!room) return;

        room.state = data.state;
        room.version = data.version;
        room.updatedAt = new Date(data.lastModified);

        this.client.emit('magic_state_synced', {
            roomName,
            state: data.state,
            version: data.version,
            timestamp: new Date()
        });
    }
}
