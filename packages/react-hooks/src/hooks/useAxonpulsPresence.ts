import { useEffect, useState, useCallback } from 'react';
import { AxonpulsConnection } from './useAxonpuls';

export interface PresenceUser {
    id: string;
    name: string;
    status: 'online' | 'away' | 'busy' | 'offline';
    lastSeen: string;
    metadata?: {
        avatar?: string;
        role?: string;
        department?: string;
        customStatus?: string;
        [key: string]: any;
    };
}

export interface PresenceState {
    users: PresenceUser[];
    onlineCount: number;
    currentUser: PresenceUser | null;
    updateStatus: (status: PresenceUser['status'], metadata?: any) => void;
    setCustomStatus: (customStatus: string) => void;
    getUsersByStatus: (status: PresenceUser['status']) => PresenceUser[];
}

/**
 * Real-time presence tracking - See who's online, away, or busy
 * Perfect for collaborative apps, live dashboards, team coordination
 * 
 * @example
 * ```tsx
 * function TeamPresence() {
 *   const presence = useAxonpulsPresence(axonpuls, {
 *     room: 'team-dashboard',
 *     currentUser: {
 *       id: 'user123',
 *       name: 'John Doe',
 *       metadata: { avatar: '/avatars/john.jpg', role: 'developer' }
 *     }
 *   });
 * 
 *   return (
 *     <div>
 *       <h3>Team Online ({presence.onlineCount})</h3>
 *       {presence.users.map(user => (
 *         <div key={user.id} className={`user-${user.status}`}>
 *           <img src={user.metadata?.avatar} alt={user.name} />
 *           <span>{user.name}</span>
 *           <span className="status">{user.status}</span>
 *         </div>
 *       ))}
 *       
 *       <button onClick={() => presence.updateStatus('away')}>
 *         Set Away
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAxonpulsPresence(
    connection: AxonpulsConnection,
    options: {
        room: string;
        currentUser?: {
            id: string;
            name: string;
            metadata?: any;
        };
        heartbeatInterval?: number;
        debug?: boolean;
    }
): PresenceState {
    const { room, currentUser, heartbeatInterval = 30000, debug = false } = options;
    const [users, setUsers] = useState<PresenceUser[]>([]);
    const [currentUserState, setCurrentUserState] = useState<PresenceUser | null>(null);

    const updateStatus = useCallback((status: PresenceUser['status'], metadata?: any) => {
        if (!connection.isConnected || !currentUser) return;

        const updatedUser: PresenceUser = {
            id: currentUser.id,
            name: currentUser.name,
            status,
            lastSeen: new Date().toISOString(),
            metadata: { ...currentUser.metadata, ...metadata },
        };

        connection.publish(`presence:${room}`, {
            type: 'presence_update',
            user: updatedUser,
        });

        setCurrentUserState(updatedUser);

        if (debug) {
            console.log(`👤 Presence updated for ${currentUser.name}:`, status);
        }
    }, [connection, currentUser, room, debug]);

    const setCustomStatus = useCallback((customStatus: string) => {
        updateStatus(currentUserState?.status || 'online', { customStatus });
    }, [updateStatus, currentUserState]);

    const getUsersByStatus = useCallback((status: PresenceUser['status']) => {
        return users.filter(user => user.status === status);
    }, [users]);

    // Join presence room and set initial status
    useEffect(() => {
        if (connection.isConnected && currentUser) {
            // Join the presence room
            connection.subscribe([`presence:${room}`]);

            // Set initial online status
            updateStatus('online');

            // Request current presence state
            connection.publish(`presence:${room}`, { type: 'presence_request' });

            if (debug) {
                console.log(`👥 Joined presence room: ${room}`);
            }

            return () => {
                // Set offline status when leaving
                updateStatus('offline');
                connection.unsubscribe([`presence:${room}`]);
            };
        }
    }, [connection.isConnected, currentUser, room, updateStatus, debug]);

    // Set up heartbeat to maintain presence
    useEffect(() => {
        if (!connection.isConnected || !currentUser) return;

        const heartbeat = setInterval(() => {
            if (currentUserState) {
                connection.publish(`presence:${room}`, {
                    type: 'presence_heartbeat',
                    userId: currentUser.id,
                    lastSeen: new Date().toISOString(),
                });
            }
        }, heartbeatInterval);

        return () => clearInterval(heartbeat);
    }, [connection.isConnected, currentUser, currentUserState, room, heartbeatInterval]);

    // Listen for presence updates
    useEffect(() => {
        if (!connection.client || !connection.isConnected) return;

        const handlePresenceUpdate = (data: { room: string; users: PresenceUser[] }) => {
            if (data.room === room) {
                setUsers(data.users);

                if (debug) {
                    console.log(`👥 Presence update for room ${room}:`, data.users.length, 'users');
                }
            }
        };

        const handleUserJoined = (data: { room: string; user: PresenceUser }) => {
            if (data.room === room) {
                setUsers(prev => {
                    const filtered = prev.filter(u => u.id !== data.user.id);
                    return [...filtered, data.user];
                });

                if (debug) {
                    console.log(`✅ User joined ${room}:`, data.user.name);
                }
            }
        };

        const handleUserLeft = (data: { room: string; userId: string }) => {
            if (data.room === room) {
                setUsers(prev => prev.filter(u => u.id !== data.userId));

                if (debug) {
                    console.log(`❌ User left ${room}:`, data.userId);
                }
            }
        };

        connection.client.on('event', (event: any) => {
            if (event.type === 'presence_update') handlePresenceUpdate(event.payload);
            if (event.type === 'presence_user_joined') handleUserJoined(event.payload);
            if (event.type === 'presence_user_left') handleUserLeft(event.payload);
        });

        return () => {
            // Event cleanup handled by AxonPulsClient internally
        };
    }, [connection.client, connection.isConnected, room, debug]);

    // Handle window/tab visibility for auto away/online
    useEffect(() => {
        if (!currentUser) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                updateStatus('away');
            } else {
                updateStatus('online');
            }
        };

        const handleBeforeUnload = () => {
            updateStatus('offline');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [currentUser, updateStatus]);

    const onlineCount = users.filter(user => user.status === 'online').length;

    return {
        users,
        onlineCount,
        currentUser: currentUserState,
        updateStatus,
        setCustomStatus,
        getUsersByStatus,
    };
}
