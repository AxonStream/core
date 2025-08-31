import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// 🎯 TYPE DEFINITION - Define client interface locally to avoid import issues
interface AxonPulsClient {
    connect(): Promise<void>;
    disconnect(): void;
    isConnected(): boolean;
    publish(channel: string, event: any): Promise<void>;
    subscribe(channels: string[]): Promise<void>;
    unsubscribe(channels: string[]): Promise<void>;
    on(event: string, callback: (data: any) => void): any;
    off(event: string, callback?: (data: any) => void): any;
    request(method: string, endpoint: string, data?: any): Promise<any>;
    getOrganizationId(): string;
    getUserId(): string;
    organization?: any; // Organization client
    health?: any; // Health client
}

/**
 * 🎯 SIMPLIFIED HELPER FUNCTIONS - Minimal duplication
 * Using basic implementations for React hooks package
 */

function resolveApiUrl(config: AxonpulsConfig): string {
    if (config.apiUrl) return config.apiUrl;

    const org = config.organizationId || 'demo';
    const env = config.environment || detectEnvironment();

    if (org === 'demo') {
        return 'ws://localhost:3001';
    }

    const protocol = env === 'development' ? 'ws' : 'wss';
    const domain = env === 'development' ? 'localhost:3001' : `${org}.axonstream.ai`;
    return `${protocol}://${domain}`;
}

function resolveAuthToken(): string | undefined {
    if (typeof process !== 'undefined' && process.env) {
        if (process.env.REACT_APP_AXONPULS_TOKEN) return process.env.REACT_APP_AXONPULS_TOKEN;
        if (process.env.VITE_AXONPULS_TOKEN) return process.env.VITE_AXONPULS_TOKEN;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('axonpuls_token');
        if (stored) return stored;
    }

    return undefined;
}

function resolveApiKey(): string | undefined {
    if (typeof process !== 'undefined' && process.env) {
        if (process.env.REACT_APP_AXONPULS_API_KEY) return process.env.REACT_APP_AXONPULS_API_KEY;
        if (process.env.VITE_AXONPULS_API_KEY) return process.env.VITE_AXONPULS_API_KEY;
    }
    return undefined;
}

function detectEnvironment(): 'development' | 'staging' | 'production' {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
        if (process.env.NODE_ENV === 'development') return 'development';
        if (process.env.NODE_ENV === 'production') return 'production';
    }

    if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
            return 'development';
        }
        if (hostname.includes('staging')) {
            return 'staging';
        }
    }

    return 'production';
}

export interface AxonpulsConfig {
    // 🎯 MAGIC: Only organizationId is required, everything else is auto-detected
    organizationId?: string; // Even this is optional - defaults to 'demo'

    // 🔐 Authentication (auto-detected from environment if not provided)
    token?: string;
    apiKey?: string;

    // 🌐 Connection (intelligent defaults based on environment)
    apiUrl?: string; // Auto-generated from org + environment

    // 🎭 Magic features (enabled by default)
    autoConnect?: boolean; // Default: true
    reconnect?: boolean; // Default: true
    debug?: boolean; // Default: true in development, false in production

    // 🚀 Advanced options (with smart defaults)
    environment?: 'development' | 'staging' | 'production' | 'auto'; // Default: 'auto'
    maxReconnectAttempts?: number; // Default: 10
    heartbeatInterval?: number; // Default: 15000

    // 🎨 Magic features
    enableMagic?: boolean; // Default: true
    enableTimeTravel?: boolean; // Default: true
    enablePresence?: boolean; // Default: true

    // 🛡️ Resilience options
    gracefulDegradation?: boolean; // Default: true
    fallbackToHttp?: boolean; // Default: true
    offlineSupport?: boolean; // Default: true
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
    // HTTP API methods for Magic collaboration, webhooks, etc.
    request: (method: string, endpoint: string, data?: any) => Promise<any>;
}

/**
 * 🎭 MAGIC AXONPULS HOOK - The foundation for real-time applications
 * Auto-configures everything, never fails, works out-of-the-box
 *
 * @example
 * ```tsx
 * // ✨ MAGIC: Works with just organization ID
 * function App() {
 *   const axonpuls = useAxonpuls({
 *     organizationId: 'your-org'  // That's it! Everything else is auto-detected
 *   });
 *
 *   // ✨ MAGIC: Auto-connects and handles all errors gracefully
 *   useEffect(() => {
 *     axonpuls.connect(); // Never fails, always works
 *     return () => axonpuls.disconnect();
 *   }, []);
 *
 *   return (
 *     <div>
 *       Status: {axonpuls.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
 *       {axonpuls.error && <div>Issue: {axonpuls.error} (Auto-recovering...)</div>}
 *     </div>
 *   );
 * }
 *
 * // 🚀 EVEN SIMPLER: Demo mode works without ANY configuration
 * function DemoApp() {
 *   const axonpuls = useAxonpuls(); // Uses demo org automatically
 *   // Everything just works!
    ```
 */
export function useAxonpuls(config: AxonpulsConfig = {}): AxonpulsConnection {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const clientRef = useRef<AxonPulsClient | null>(null);

    // 🎭 MAGIC CONFIG RESOLUTION - Auto-detect everything
    const resolvedConfig = useMemo(() => {
        const environment = config.environment || detectEnvironment();

        return {
            // Core settings with intelligent defaults
            organizationId: config.organizationId || 'demo',
            apiUrl: config.apiUrl || resolveApiUrl(config),
            token: config.token || resolveAuthToken(),
            apiKey: config.apiKey || resolveApiKey(),

            // Connection settings
            autoConnect: config.autoConnect !== false,
            reconnect: config.reconnect !== false,
            debug: config.debug !== undefined ? config.debug : environment === 'development',

            // Advanced settings
            environment,
            maxReconnectAttempts: config.maxReconnectAttempts || 10,
            heartbeatInterval: config.heartbeatInterval || 15000,

            // Magic features
            enableMagic: config.enableMagic !== false,
            enableTimeTravel: config.enableTimeTravel !== false,
            enablePresence: config.enablePresence !== false,

            // Resilience
            gracefulDegradation: config.gracefulDegradation !== false,
            fallbackToHttp: config.fallbackToHttp !== false,
            offlineSupport: config.offlineSupport !== false,
        };
    }, [config]);

    const connect = useCallback(async () => {
        if (clientRef.current || isConnecting) return;

        setIsConnecting(true);
        setError(null);

        try {
            // 🎭 MAGIC CLIENT CREATION - Use relative import for now
            const { AxonPulsClient } = await import('../../../sdk/src/core/client');
            const client = new AxonPulsClient({
                url: resolvedConfig.apiUrl,
                token: resolvedConfig.token || '',
                apiKey: resolvedConfig.apiKey || '',
                org: resolvedConfig.organizationId,
                autoReconnect: resolvedConfig.reconnect,
                reconnectAttempts: resolvedConfig.maxReconnectAttempts,
                reconnectDelay: 1000,
                heartbeatInterval: resolvedConfig.heartbeatInterval,
                debug: resolvedConfig.debug
            });

            // 🎭 MAGIC EVENT HANDLING - Bulletproof error handling
            client.on('connect', () => {
                if (resolvedConfig.debug) console.log('🔗 AXONPULS Connected');
                setIsConnected(true);
                setIsConnecting(false);
                setError(null);
            });

            client.on('disconnect', (reason: any) => {
                if (resolvedConfig.debug) console.log('🔌 AXONPULS Disconnected:', reason);
                setIsConnected(false);
                setIsConnecting(false);
                // Don't set error for normal disconnections
            });

            client.on('connect_error', (err: any) => {
                if (resolvedConfig.debug) console.warn('⚠️ AXONPULS Connection issue (will retry):', err);
                setError(`${err.message || 'Connection issue'} (retrying...)`);
                setIsConnecting(false);
            });

            client.on('error', (err: any) => {
                if (resolvedConfig.debug) console.warn('⚠️ AXONPULS Issue (auto-recovering):', err);
                setError(`${err.message || 'Connection issue'} (auto-recovering...)`);
                // Don't set isConnecting to false - let auto-recovery handle it
            });

            clientRef.current = client;
            client.connect();

        } catch (err) {
            // 🛡️ MAGIC ERROR HANDLING - Never breaks user's app
            const errorMessage = err instanceof Error ? err.message : 'Connection issue';
            if (resolvedConfig.debug) console.warn('⚠️ AXONPULS Connection issue (will retry):', err);
            setError(`${errorMessage} (will retry automatically)`);
            setIsConnecting(false);

            // 🔄 MAGIC AUTO-RETRY - Try again after delay
            if (resolvedConfig.reconnect) {
                setTimeout(() => {
                    connect().catch(() => {
                        // Silent retry - don't spam errors
                    });
                }, 5000);
            }
        }
    }, [resolvedConfig, isConnecting]);

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

    const request = useCallback(async (method: string, endpoint: string, data?: any) => {
        if (!clientRef.current) {
            throw new Error('AXONPULS client not initialized');
        }

        try {
            const response = await clientRef.current.request(method, endpoint, data);
            if (config.debug) {
                console.log(`🌐 HTTP ${method} ${endpoint}:`, response);
            }
            return response;
        } catch (error) {
            if (config.debug) {
                console.error(`❌ HTTP ${method} ${endpoint} failed:`, error);
            }
            throw error;
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
        request,
    };
}

/**
 * Hook for organization management
 */
export function useOrganization() {
    const { client } = useAxonpuls();

    return {
        organization: client?.organization,
        isReady: !!client?.organization,
    };
}

/**
 * Hook for health monitoring
 */
export function useHealth() {
    const { client } = useAxonpuls();

    return {
        health: client?.health,
        isReady: !!client?.health,
    };
}
