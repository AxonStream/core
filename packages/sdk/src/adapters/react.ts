/**
 * React Adapter - Provides React hooks and components
 * 
 * Auto-detects React and provides:
 * - useAxonStream hook
 * - useAxonChannel hook  
 * - useAxonPresence hook
 * - useAxonHITL hook
 * - React components
 */

import type { AxonPulsClient, AxonPulsEvent } from '../core/client';
import type { FrameworkAdapter } from './index';

// React binding interface
export interface ReactBinding {
    useAxonStream: (config?: any) => any;
    useAxonChannel: (channel: string, client: AxonPulsClient) => any;
    useAxonPresence: (client: AxonPulsClient, options?: any) => any;
    useAxonHITL: (client: AxonPulsClient, options?: any) => any;
    components: {
        AxonChat: any;
        AxonPresence: any;
        AxonHITL: any;
        AxonEmbed: any;
    };
}

// React hooks implementation (will be loaded if React is detected)
export function createReactBinding(client: AxonPulsClient): ReactBinding {
    // Import React hooks dynamically to avoid errors in non-React environments
    let React: any;
    let useState: any;
    let useEffect: any;
    let useCallback: any;
    let useRef: any;

    try {
        if (typeof window !== 'undefined' && (window as any).React) {
            React = (window as any).React;
        } else if (typeof require !== 'undefined') {
            React = require('react');
        } else {
            throw new Error('React not found');
        }

        ({ useState, useEffect, useCallback, useRef } = React);
    } catch (error) {
        throw new Error('React adapter requires React to be available');
    }

    // useAxonStream hook
    const useAxonStream = (config?: { autoConnect?: boolean; debug?: boolean }) => {
        const [isConnected, setIsConnected] = useState(false);
        const [isConnecting, setIsConnecting] = useState(false);
        const [error, setError] = useState(null as string | null);
        const clientRef = useRef(client);

        const connect = useCallback(async () => {
            try {
                setIsConnecting(true);
                setError(null);
                await clientRef.current.connect();
                setIsConnected(true);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Connection failed');
            } finally {
                setIsConnecting(false);
            }
        }, []);

        const disconnect = useCallback(() => {
            clientRef.current.disconnect();
            setIsConnected(false);
        }, []);

        useEffect(() => {
            const handleConnect = () => setIsConnected(true);
            const handleDisconnect = () => setIsConnected(false);
            const handleError = (err: any) => setError(err.message || 'Unknown error');

            client.on('connect', handleConnect);
            client.on('disconnect', handleDisconnect);
            client.on('error', handleError);

            // Auto-connect if requested
            if (config?.autoConnect && !client.isConnected()) {
                connect();
            }

            return () => {
                client.off('connect', handleConnect);
                client.off('disconnect', handleDisconnect);
                client.off('error', handleError);
            };
        }, [connect, config?.autoConnect]);

        return {
            client: clientRef.current,
            isConnected,
            isConnecting,
            error,
            connect,
            disconnect,
            subscribe: useCallback((channels: string[]) => client.subscribe(channels), []),
            publish: useCallback((channel: string, data: any) => client.publish(channel, data), []),
        };
    };

    // useAxonChannel hook
    const useAxonChannel = (channel: string, axonClient: AxonPulsClient) => {
        const [messages, setMessages] = useState([] as AxonPulsEvent[]);
        const [isSubscribed, setIsSubscribed] = useState(false);

        const sendMessage = useCallback((type: string, payload: any) => {
            axonClient.publish(channel, { type, payload });
        }, [channel, axonClient]);

        const clearMessages = useCallback(() => {
            setMessages([]);
        }, []);

        useEffect(() => {
            const handleEvent = (event: AxonPulsEvent) => {
                if (event.metadata?.channel === channel) {
                    setMessages((prev: AxonPulsEvent[]) => [...prev, event]);
                }
            };

            axonClient.on('event', handleEvent);

            // Subscribe to channel
            axonClient.subscribe([channel]).then(() => {
                setIsSubscribed(true);
            }).catch((err) => {
                console.error('Failed to subscribe to channel:', err);
            });

            return () => {
                axonClient.off('event', handleEvent);
                axonClient.unsubscribe([channel]);
                setIsSubscribed(false);
            };
        }, [channel, axonClient]);

        return {
            messages,
            messageCount: messages.length,
            isSubscribed,
            sendMessage,
            clearMessages,
        };
    };

    // useAxonPresence hook
    const useAxonPresence = (axonClient: AxonPulsClient, options: {
        room: string;
        currentUser?: { id: string; name: string; metadata?: any };
        heartbeatInterval?: number;
    }) => {
        const [users, setUsers] = useState([] as any[]);
        const [onlineCount, setOnlineCount] = useState(0);

        useEffect(() => {
            const presenceChannel = `presence:${options.room}`;

            const handlePresence = (event: AxonPulsEvent) => {
                if (event.type === 'user_joined') {
                    setUsers((prev: any[]) => [...prev.filter((u: any) => u.id !== event.payload.user.id), event.payload.user]);
                } else if (event.type === 'user_left') {
                    setUsers((prev: any[]) => prev.filter((u: any) => u.id !== event.payload.user.id));
                } else if (event.type === 'presence_update') {
                    setUsers(event.payload.users || []);
                }
            };

            axonClient.on('event', handlePresence);
            axonClient.subscribe([presenceChannel]);

            // Send join event
            if (options.currentUser) {
                axonClient.publish(presenceChannel, {
                    type: 'user_join',
                    payload: { user: options.currentUser }
                });
            }

            return () => {
                axonClient.off('event', handlePresence);
                axonClient.unsubscribe([presenceChannel]);

                // Send leave event
                if (options.currentUser) {
                    axonClient.publish(presenceChannel, {
                        type: 'user_leave',
                        payload: { user: options.currentUser }
                    });
                }
            };
        }, [axonClient, options.room, options.currentUser]);

        useEffect(() => {
            setOnlineCount(users.length);
        }, [users]);

        return {
            users,
            onlineCount,
            getUsersByStatus: (status: string) => users.filter((u: any) => u.status === status),
        };
    };

    // useAxonHITL hook
    const useAxonHITL = (axonClient: AxonPulsClient, options: {
        department?: string;
        autoAcceptRoles?: string[];
        currentUser?: { id: string; name: string; role: string };
    }) => {
        const [pendingRequests, setPendingRequests] = useState([] as any[]);
        const [activeRequest, setActiveRequest] = useState(null as any | null);

        const submitResponse = useCallback((response: {
            requestId: string;
            action: 'approve' | 'reject' | 'escalate';
            comment?: string;
        }) => {
            const hitlChannel = `hitl:${options.department || 'general'}`;
            axonClient.publish(hitlChannel, {
                type: 'hitl_response',
                payload: { ...response, respondedBy: options.currentUser }
            });

            // Remove from pending
            setPendingRequests((prev: any[]) => prev.filter((r: any) => r.id !== response.requestId));
            if (activeRequest?.id === response.requestId) {
                setActiveRequest(null);
            }
        }, [axonClient, options.department, options.currentUser]);

        useEffect(() => {
            const hitlChannel = `hitl:${options.department || 'general'}`;

            const handleHITL = (event: AxonPulsEvent) => {
                if (event.type === 'hitl_request') {
                    setPendingRequests((prev: any[]) => [...prev, event.payload]);
                } else if (event.type === 'hitl_request_update') {
                    setPendingRequests((prev: any[]) => prev.map((r: any) =>
                        r.id === event.payload.id ? { ...r, ...event.payload } : r
                    ));
                }
            };

            axonClient.on('event', handleHITL);
            axonClient.subscribe([hitlChannel]);

            return () => {
                axonClient.off('event', handleHITL);
                axonClient.unsubscribe([hitlChannel]);
            };
        }, [axonClient, options.department]);

        return {
            pendingRequests,
            activeRequest,
            submitResponse,
            setActiveRequest,
            getUrgentRequests: () => pendingRequests.filter((r: any) => r.priority === 'urgent'),
        };
    };

    // React Components
    const AxonChat = ({ channel, client: axonClient, className }: any) => {
        const { messages, sendMessage } = useAxonChannel(channel, axonClient);
        const [inputValue, setInputValue] = useState('');

        const handleSend = () => {
            if (inputValue.trim()) {
                sendMessage('chat_message', { text: inputValue, timestamp: new Date().toISOString() });
                setInputValue('');
            }
        };

        return React.createElement('div', { className: `axon-chat ${className || ''}` }, [
            React.createElement('div', { key: 'messages', className: 'axon-messages' },
                messages.map((msg: any, idx: number) =>
                    React.createElement('div', { key: idx, className: 'axon-message' }, [
                        React.createElement('span', { key: 'type', className: 'message-type' }, msg.type),
                        React.createElement('span', { key: 'content' }, JSON.stringify(msg.payload))
                    ])
                )
            ),
            React.createElement('div', { key: 'input', className: 'axon-input' }, [
                React.createElement('input', {
                    key: 'text',
                    type: 'text',
                    value: inputValue,
                    onChange: (e: any) => setInputValue(e.target.value),
                    onKeyPress: (e: any) => e.key === 'Enter' && handleSend(),
                    placeholder: 'Type a message...'
                }),
                React.createElement('button', {
                    key: 'send',
                    onClick: handleSend
                }, 'Send')
            ])
        ]);
    };

    const AxonPresence = ({ room, client: axonClient, currentUser }: any) => {
        const { users, onlineCount } = useAxonPresence(axonClient, { room, currentUser });

        return React.createElement('div', { className: 'axon-presence' }, [
            React.createElement('h3', { key: 'title' }, `Online (${onlineCount})`),
            React.createElement('div', { key: 'users', className: 'presence-users' },
                users.map((user: any, idx: number) =>
                    React.createElement('div', { key: idx, className: 'presence-user' }, [
                        React.createElement('span', { key: 'name' }, user.name),
                        React.createElement('span', { key: 'status', className: `status-${user.status || 'online'}` },
                            user.status || 'online')
                    ])
                )
            )
        ]);
    };

    return {
        useAxonStream,
        useAxonChannel,
        useAxonPresence,
        useAxonHITL,
        components: {
            AxonChat,
            AxonPresence,
            AxonHITL: () => React.createElement('div', {}, 'HITL Component'),
            AxonEmbed: () => React.createElement('div', {}, 'Embed Component'),
        },
    };
}

// React adapter registration
export const ReactAdapter: FrameworkAdapter = {
    name: 'react',
    version: '1.0.0',
    detectFramework() {
        try {
            return !!(typeof window !== 'undefined' && (window as any).React) ||
                !!(typeof require !== 'undefined' && require('react'));
        } catch {
            return false;
        }
    },
    createBinding(client: AxonPulsClient) {
        return createReactBinding(client);
    }
};
