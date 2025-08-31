import { useEffect, useState, useCallback } from 'react';
import { AxonpulsConnection } from './useAxonpuls';

// 🎯 PRODUCTION-GRADE TYPES - No fabricated fields
export interface MagicRoom {
    id: string;
    name: string;
    state: Record<string, any>;
    version: number;
    config: any;
    createdAt: string; // ISO string from server
    updatedAt: string; // ISO string from server
    branchName?: string;
    metadata?: Record<string, any>;
}

export interface MagicOperation {
    type: 'magic_set' | 'magic_array_insert' | 'magic_array_delete' | 'magic_array_move' | 'magic_object_merge';
    path: string[];
    value?: any;
    index?: number;
    priority: 'low' | 'normal' | 'high' | 'critical';
    correlationId?: string;
    timestamp?: number; // Server-provided
    clientId?: string;
    version?: number; // Server-provided
}

export interface MagicSnapshot {
    id: string;
    roomId: string;
    branchName: string;
    state: Record<string, any>;
    version: number;
    description?: string;
    createdAt: string; // ISO string from server
    metadata?: Record<string, any>;
}

export interface MagicBranch {
    id: string;
    name: string;
    roomId: string;
    fromSnapshotId: string;
    description?: string;
    createdAt: string; // ISO string from server
    metadata?: {
        conflictCount?: number;
        lastActivity?: string;
    };
}

export interface TimeTravelResult {
    success: boolean;
    snapshotId?: string;
    branchName?: string;
    conflictsResolved?: number;
    operationsApplied?: number;
    timestamp: string; // ISO string from server
    metadata?: Record<string, any>;
}

export interface MagicState {
    rooms: MagicRoom[];
    activeRoom: MagicRoom | null;
    isLoading: boolean;
    error: string | null;
    createRoom: (name: string, initialState?: Record<string, any>, config?: any) => Promise<MagicRoom>;
    joinRoom: (roomName: string, userData: any) => Promise<MagicRoom>;
    leaveRoom: (roomName: string) => Promise<void>;
    applyOperation: (roomName: string, operation: Omit<MagicOperation, 'timestamp' | 'clientId' | 'version'>) => Promise<any>;
    getRoomState: (roomName: string) => Promise<any>;
}

/**
 * Magic Collaboration Hook - Real-time collaborative editing and state management
 * Uses HTTP API for CRUD operations and WebSocket for real-time updates
 * 
 * @example
 * ```tsx
 * function CollaborativeEditor() {
 *   const magic = useAxonpulsMagic(axonpuls, {
 *     autoJoinRooms: ['document-123'],
 *     debug: true
 *   });
 * 
 *   const handleTextChange = (newText: string) => {
 *     magic.applyOperation('document-123', {
 *       type: 'magic_set',
 *       path: ['content', 'text'],
 *       value: newText,
 *       priority: 'normal'
 *     });
 *   };
 * 
 *   return (
 *     <div>
 *       <h3>Active Room: {magic.activeRoom?.name}</h3>
 *       <div>Rooms: {magic.rooms.length}</div>
 *       {magic.isLoading && <div>Loading...</div>}
 *       {magic.error && <div>Error: {magic.error}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAxonpulsMagic(
    connection: AxonpulsConnection,
    options: {
        autoJoinRooms?: string[];
        debug?: boolean;
    } = {}
): MagicState {
    const { autoJoinRooms = [], debug = false } = options;
    const [rooms, setRooms] = useState<MagicRoom[]>([]);
    const [activeRoom, setActiveRoom] = useState<MagicRoom | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createRoom = useCallback(async (
        name: string,
        initialState: Record<string, any> = {},
        config: any = {}
    ): Promise<MagicRoom> => {
        if (!connection.client) {
            throw new Error('AXONPULS client not connected');
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await connection.request('POST', '/magic/rooms', {
                name,
                initialState,
                config
            });

            const room: MagicRoom = {
                id: response.id,
                name: response.name,
                state: response.currentState || initialState,
                version: response.version || 1,
                config: response.config || config,
                createdAt: response.createdAt, // Use server timestamp directly
                updatedAt: response.updatedAt  // Use server timestamp directly
            };

            setRooms(prev => [...prev, room]);
            setActiveRoom(room);

            if (debug) {
                console.log('🎭 Magic room created:', room);
            }

            return room;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create room';
            setError(errorMessage);
            if (debug) {
                console.error('❌ Failed to create Magic room:', err);
            }
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [connection, debug]);

    const joinRoom = useCallback(async (
        roomName: string,
        userData: any
    ): Promise<MagicRoom> => {
        if (!connection.client) {
            throw new Error('AXONPULS client not connected');
        }

        setIsLoading(true);
        setError(null);

        try {
            // Join room via HTTP API
            await connection.request('POST', `/magic/${roomName}/join`, userData);

            // Get current state
            const stateResponse = await connection.request('GET', `/magic/rooms/${roomName}/state`);

            const room: MagicRoom = {
                id: stateResponse.id,
                name: roomName,
                state: stateResponse.currentState,
                version: stateResponse.version,
                config: stateResponse.config,
                createdAt: stateResponse.createdAt, // Use server timestamp directly
                updatedAt: stateResponse.updatedAt  // Use server timestamp directly
            };

            setRooms(prev => {
                const existing = prev.find(r => r.name === roomName);
                if (existing) {
                    return prev.map(r => r.name === roomName ? room : r);
                }
                return [...prev, room];
            });
            setActiveRoom(room);

            // Subscribe to real-time updates
            connection.subscribe([`magic:${roomName}`, `magic_presence_${roomName}`]);

            if (debug) {
                console.log('🎭 Joined Magic room:', room);
            }

            return room;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to join room';
            setError(errorMessage);
            if (debug) {
                console.error('❌ Failed to join Magic room:', err);
            }
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [connection, debug]);

    const leaveRoom = useCallback(async (roomName: string): Promise<void> => {
        if (!connection.client) {
            throw new Error('AXONPULS client not connected');
        }

        try {
            await connection.request('POST', `/magic/${roomName}/leave`);

            setRooms(prev => prev.filter(r => r.name !== roomName));
            if (activeRoom?.name === roomName) {
                setActiveRoom(null);
            }

            // Unsubscribe from real-time updates
            connection.unsubscribe([`magic:${roomName}`, `magic_presence_${roomName}`]);

            if (debug) {
                console.log('🎭 Left Magic room:', roomName);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to leave room';
            setError(errorMessage);
            if (debug) {
                console.error('❌ Failed to leave Magic room:', err);
            }
            throw err;
        }
    }, [connection, activeRoom, debug]);

    const applyOperation = useCallback(async (
        roomName: string,
        operation: Omit<MagicOperation, 'timestamp' | 'clientId' | 'version'>
    ): Promise<any> => {
        if (!connection.client) {
            throw new Error('AXONPULS client not connected');
        }

        try {
            const response = await connection.request('POST', `/magic/rooms/${roomName}/operation`, {
                operation: {
                    ...operation,
                    timestamp: Date.now(),
                    clientId: connection.client?.getUserId() || 'anonymous',
                    version: Date.now()
                }
            });

            // Update local room state if successful
            if (response.success && response.transformedOperation) {
                setRooms(prev => prev.map(room => {
                    if (room.name === roomName) {
                        return {
                            ...room,
                            state: response.transformedOperation.value || room.state,
                            version: response.stateVersion,
                            updatedAt: response.updatedAt  // Use server timestamp directly
                        };
                    }
                    return room;
                }));

                if (activeRoom?.name === roomName) {
                    setActiveRoom(prev => prev ? {
                        ...prev,
                        state: response.transformedOperation.value || prev.state,
                        version: response.stateVersion,
                        updatedAt: response.updatedAt  // Use server timestamp directly
                    } : null);
                }
            }

            if (debug) {
                console.log('🎭 Magic operation applied:', response);
            }

            return response;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to apply operation';
            setError(errorMessage);
            if (debug) {
                console.error('❌ Failed to apply Magic operation:', err);
            }
            throw err;
        }
    }, [connection, activeRoom, debug]);

    const getRoomState = useCallback(async (roomName: string): Promise<any> => {
        if (!connection.client) {
            throw new Error('AXONPULS client not connected');
        }

        try {
            const response = await connection.request('GET', `/magic/rooms/${roomName}/state`);

            if (debug) {
                console.log('🎭 Magic room state retrieved:', response);
            }

            return response;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to get room state';
            setError(errorMessage);
            if (debug) {
                console.error('❌ Failed to get Magic room state:', err);
            }
            throw err;
        }
    }, [connection, debug]);

    // Auto-join rooms if specified
    useEffect(() => {
        if (connection.isConnected && autoJoinRooms.length > 0) {
            autoJoinRooms.forEach(roomName => {
                joinRoom(roomName, {
                    userName: 'User',
                    userAvatar: '',
                    deviceInfo: { userAgent: navigator.userAgent }
                }).catch(err => {
                    if (debug) {
                        console.warn(`Failed to auto-join room ${roomName}:`, err);
                    }
                });
            });
        }
    }, [connection.isConnected, autoJoinRooms, joinRoom, debug]);

    return {
        rooms,
        activeRoom,
        isLoading,
        error,
        createRoom,
        joinRoom,
        leaveRoom,
        applyOperation,
        getRoomState,
    };
}
