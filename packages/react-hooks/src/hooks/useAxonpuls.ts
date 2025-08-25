import { useEffect, useRef, useState, useCallback } from 'react';
import type { AxonPulsClient } from '@axonstream/core';

export interface AxonpulsConfig {
    apiUrl: string;
    token?: string;
    organizationId: string;
    autoConnect?: boolean;
    reconnect?: boolean;
    debug?: boolean;
}

export interface AxonpulsConnection {
    client: AxonPulsClient | null;
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    publish: (channel: string, data: any) => void;
    subscribe: (channels: string[]) => void;
    unsubscribe: (channels: string[]) => void;
}

/**
 * Main AXONPULS hook - The foundation for real-time applications
 * 
 * @example
 * ```tsx
 * function App() {
 *   const axonpuls = useAxonpuls({
 *     apiUrl: 'ws://localhost:3001',
 *     organizationId: 'your-org',
 *     token: 'your-jwt-token'
 *   });
 * 
 *   useEffect(() => {
 *     axonpuls.connect();
 *     return () => axonpuls.disconnect();
 *   }, []);
 * 
 *   return (
 *     <div>
 *       Status: {axonpuls.isConnected ? 'Connected' : 'Disconnected'}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAxonpuls(config: AxonpulsConfig): AxonpulsConnection {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const clientRef = useRef<AxonPulsClient | null>(null);

    const connect = useCallback(async () => {
        if (clientRef.current || isConnecting) return;

        setIsConnecting(true);
        setError(null);

        try {
            // Dynamic import to avoid circular dependency at build time
            const { AxonPulsClient } = await import('@axonstream/core');
            const client = new AxonPulsClient({
                url: config.apiUrl,
                token: config.token || '',
                autoReconnect: config.reconnect !== false,
                reconnectAttempts: 5,
                reconnectDelay: 1000,
                debug: config.debug || false
            });

            client.on('connect', () => {
                if (config.debug) console.log('🔗 AXONPULS Connected');
                setIsConnected(true);
                setIsConnecting(false);
                setError(null);
            });

            client.on('disconnect', (reason: any) => {
                if (config.debug) console.log('🔌 AXONPULS Disconnected:', reason);
                setIsConnected(false);
                setIsConnecting(false);
            });

            client.on('connect_error', (err: any) => {
                if (config.debug) console.error('❌ AXONPULS Connection Error:', err);
                setError(err.message);
                setIsConnecting(false);
            });

            client.on('error', (err: any) => {
                if (config.debug) console.error('🚨 AXONPULS Error:', err);
                setError(err.message || 'Unknown error');
            });

            clientRef.current = client;
            client.connect();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Connection failed');
            setIsConnecting(false);
        }
    }, [config, isConnecting]);

    const disconnect = useCallback(() => {
        if (clientRef.current) {
            clientRef.current.disconnect();
            clientRef.current = null;
        }
        setIsConnected(false);
        setIsConnecting(false);
    }, []);

    const publish = useCallback((channel: string, data: any) => {
        if (clientRef.current?.isConnected()) {
            clientRef.current.publish(channel, { type: 'event', payload: data });
        } else if (config.debug) {
            console.warn('⚠️ Cannot publish - AXONPULS not connected');
        }
    }, [config.debug]);

    const subscribe = useCallback((channels: string[]) => {
        if (clientRef.current?.isConnected()) {
            clientRef.current.subscribe(channels);
            if (config.debug) console.log(`📺 Subscribed to channels: ${channels.join(', ')}`);
        }
    }, [config.debug]);

    const unsubscribe = useCallback((channels: string[]) => {
        if (clientRef.current?.isConnected()) {
            clientRef.current.unsubscribe(channels);
            if (config.debug) console.log(`📻 Unsubscribed from channels: ${channels.join(', ')}`);
        }
    }, [config.debug]);

    // Auto-connect if enabled
    useEffect(() => {
        if (config.autoConnect !== false) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [config.autoConnect, connect, disconnect]);

    return {
        client: clientRef.current,
        isConnected,
        isConnecting,
        error,
        connect,
        disconnect,
        publish,
        subscribe,
        unsubscribe,
    };
}
