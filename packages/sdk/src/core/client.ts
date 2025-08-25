import { io, Socket } from 'socket.io-client';
import { jwtDecode } from 'jwt-decode';
import { AxonPulsError, AxonPulsErrorCode } from '../errors';
import {
    AxonPulsEventSchema,
    ChannelSchema,
    WebSocketSubscribeSchema,
    WebSocketPublishSchema,
    WebSocketUnsubscribeSchema,
    generateUUID,
} from './contracts';

// EventEmitter interfaces and class (moved here to avoid bundling issues)
export interface EventMap {
    [event: string]: any;
}

export interface DefaultEvents {
    connect: void;
    connecting: void;
    connected: void;
    disconnect: { reason: string };
    disconnected: { reason?: string };
    reconnecting: { attempt: number; delay: number };
    error: Error;
    event: any;
    subscribed: { channels: string[] };
    unsubscribed: { channels: string[] };
    published: { channel: string; event: any };
    ack: any;
    rate_limit: any;
    token_refreshed: void;
    [eventType: string]: any;
}

export type EventListener<T = any> = (data: T) => void;

export class EventEmitter<T extends EventMap = DefaultEvents> {
    private events: { [K in keyof T]?: EventListener<T[K]>[] } = {};

    on<K extends keyof T>(event: K, listener: EventListener<T[K]>): this {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event]!.push(listener);
        return this;
    }

    off<K extends keyof T>(event: K, listener?: EventListener<T[K]>): this {
        if (!this.events[event]) return this;

        if (listener) {
            const index = this.events[event]!.indexOf(listener);
            if (index !== -1) {
                this.events[event]!.splice(index, 1);
            }
        } else {
            delete this.events[event];
        }
        return this;
    }

    emit<K extends keyof T>(event: K, data?: T[K]): boolean {
        const listeners = this.events[event];
        if (!listeners) return false;

        listeners.forEach(listener => {
            try {
                listener(data as T[K]);
            } catch (error) {
                console.error(`Error in event listener for ${String(event)}:`, error);
            }
        });

        return true;
    }

    once<K extends keyof T>(event: K, listener: EventListener<T[K]>): this {
        const onceListener = (data: T[K]) => {
            this.off(event, onceListener);
            listener(data);
        };
        return this.on(event, onceListener);
    }

    removeAllListeners<K extends keyof T>(event?: K): this {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
        return this;
    }

    listenerCount<K extends keyof T>(event: K): number {
        return this.events[event]?.length || 0;
    }

    listeners<K extends keyof T>(event: K): EventListener<T[K]>[] {
        return [...(this.events[event] || [])];
    }
}

export interface AxonPulsClientConfig {
    url: string;
    token: string;
    clientType?: string;
    autoReconnect?: boolean;
    reconnectAttempts?: number;
    reconnectDelay?: number;
    heartbeatInterval?: number;
    debug?: boolean;
    tokenProvider?: () => Promise<string>; // optional async provider for refresh
}

export interface JwtPayload {
    sub: string; // User ID
    email: string;
    organizationId: string;
    organizationSlug: string;
    roles?: string[];
    permissions?: string[];
    iat?: number;
    exp?: number;
}

export interface AxonPulsEvent {
    id: string;
    type: string;
    payload: any;
    timestamp: number;
    metadata?: {
        correlation_id?: string;
        org_id: string;
        channel?: string;
        stream_entry_id?: string;
    };
}

export interface SubscribeOptions {
    replay_from?: string;
    replay_count?: number;
    filter?: string;
}

export interface PublishOptions {
    delivery_guarantee?: 'at_least_once' | 'at_most_once';
    partition_key?: string;
}

export class AxonPulsClient extends EventEmitter {
    private socket: Socket | null = null;
    private config: AxonPulsClientConfig & {
        clientType: string;
        autoReconnect: boolean;
        reconnectAttempts: number;
        reconnectDelay: number;
        heartbeatInterval: number;
        debug: boolean;
    };
    private orgId: string;
    private userId: string;
    private subscriptions = new Set<string>();
    private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempt = 0;
    private lastStreamIdByChannel: Map<string, string> = new Map();

    // Heartbeat / liveness
    private lastPongAt: number = 0;
    private missedPongs: number = 0;

    // Circuit breaker
    private cbFailures: number = 0;
    private cbState: 'closed' | 'open' | 'half' = 'closed';
    private cbOpenUntil: number = 0;

    // Token refresh
    private tokenRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
    private tokenProvider?: () => Promise<string>;

    // Limits
    private static readonly MAX_PAYLOAD_BYTES = 1048576; // 1MB
    private static readonly MAX_CHANNELS = 200;

    // Backoff params
    private static readonly BACKOFF_BASE_MS = 250;
    private static readonly BACKOFF_FACTOR = 2;
    private static readonly BACKOFF_MAX_MS = 30000;
    private static readonly BACKOFF_JITTER = 0.2; // ±20%

    // Heartbeat params
    private static readonly HEARTBEAT_MS = 15000;
    private static readonly MISSED_PONGS_DEAD = 2; // declare dead after 2 missed

    constructor(config: AxonPulsClientConfig) {
        super();

        // Validate and set defaults
        this.config = {
            url: config.url,
            token: config.token,
            clientType: config.clientType || 'web',
            autoReconnect: config.autoReconnect ?? true,
            reconnectAttempts: config.reconnectAttempts || 5,
            reconnectDelay: config.reconnectDelay || 1000,
            heartbeatInterval: config.heartbeatInterval || AxonPulsClient.HEARTBEAT_MS,
            debug: config.debug ?? false,
        };

        this.tokenProvider = config.tokenProvider;

        // Extract org and user info from JWT
        const payload = this.decodeToken(this.config.token);
        this.orgId = payload.organizationId;
        this.userId = payload.sub;

        if (this.config.debug) {
            console.log(`AxonPuls client initialized for org: ${this.orgId}, user: ${this.userId}`);
        }
    }

    /**
     * Connect to AxonPuls gateway
     */
    async connect(): Promise<void> {
        if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
            return;
        }

        // Circuit breaker guard
        const now = Date.now();
        if (this.cbState === 'open' && now < this.cbOpenUntil) {
            const waitMs = this.cbOpenUntil - now;
            throw new Error(`Circuit open. Retry after ${waitMs}ms`);
        }
        if (this.cbState === 'open' && now >= this.cbOpenUntil) {
            this.cbState = 'half';
        }

        this.connectionState = 'connecting';
        this.emit('connecting');

        try {
            this.socket = io(this.config.url, {
                auth: {
                    token: this.config.token,
                },
                extraHeaders: {
                    'User-Agent': `AxonPuls-sdk/${this.config.clientType}`,
                },
                transports: ['websocket'],
                upgrade: false,
                autoConnect: false,
            });

            this.setupSocketListeners();
            this.socket.connect();

            // Wait for connection
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);

                this.socket!.once('connect', () => {
                    clearTimeout(timeout);
                    this.cbFailures = 0;
                    if (this.cbState === 'half') this.cbState = 'closed';
                    this.scheduleTokenRefresh();
                    resolve();
                });

                this.socket!.once('connect_error', (error: Error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });

        } catch (error) {
            this.connectionState = 'disconnected';
            this.cbFailures += 1;
            if (this.cbFailures >= 8) {
                this.cbState = 'open';
                this.cbOpenUntil = Date.now() + 60000; // 60s open
            }
            this.emit('error', error as Error);
            throw error;
        }
    }

    /**
     * Disconnect from AxonPuls gateway
     */
    async disconnect(): Promise<void> {
        this.connectionState = 'disconnected';

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.tokenRefreshTimeout) {
            clearTimeout(this.tokenRefreshTimeout);
            this.tokenRefreshTimeout = null;
        }

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this.emit('disconnected');
    }

    /**
     * Subscribe to channels
     */
    async subscribe(channels: string[], options?: SubscribeOptions): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('Not connected to AxonPuls gateway');
        }

        // Channel limits and validation
        if (channels.length + this.subscriptions.size > AxonPulsClient.MAX_CHANNELS) {
            throw new Error('Maximum channel subscriptions exceeded');
        }
        for (const channel of channels) {
            this.validateChannel(channel);
        }

        const message = {
            id: generateUUID(),
            type: 'subscribe' as const,
            payload: {
                channels,
                options: options || {},
            },
            timestamp: Date.now(),
        };

        // Validate message structure
        WebSocketSubscribeSchema.parse(message);

        this.socket!.emit('subscribe', message);

        // Add to local subscriptions
        channels.forEach(channel => this.subscriptions.add(channel));

        this.emit('subscribed', { channels });
    }

    /**
     * Unsubscribe from channels
     */
    async unsubscribe(channels: string[]): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('Not connected to AxonPuls gateway');
        }

        const message = {
            id: generateUUID(),
            type: 'unsubscribe' as const,
            payload: { channels },
            timestamp: Date.now(),
        };

        WebSocketUnsubscribeSchema.parse(message);

        this.socket!.emit('unsubscribe', message);

        // Remove from local subscriptions
        channels.forEach(channel => this.subscriptions.delete(channel));

        this.emit('unsubscribed', { channels });
    }

    /**
     * Publish event to channel
     */
    async publish(
        channel: string,
        event: Omit<AxonPulsEvent, 'id' | 'timestamp' | 'metadata'>,
        options?: PublishOptions
    ): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('Not connected to AxonPuls gateway');
        }

        this.validateChannel(channel);

        // Payload size limit (1MB)
        try {
            const size = new TextEncoder().encode(JSON.stringify(event.payload ?? {})).length;
            if (size > AxonPulsClient.MAX_PAYLOAD_BYTES) {
                const err: any = new Error('Payload too large');
                err.code = 'AxonPuls-PAYLOAD1';
                throw err;
            }
        } catch (e) {
            // If payload is not serializable, treat as too large/invalid
            const err: any = new Error('Invalid payload');
            err.code = 'AxonPuls-PAYLOAD1';
            throw err;
        }

        const fullEvent = {
            ...event,
            id: generateUUID(),
            timestamp: Date.now(),
            metadata: {
                correlation_id: this.generateId(),
                org_id: this.orgId,
                channel,
            },
        };

        // Validate event structure
        AxonPulsEventSchema.parse(fullEvent);

        const message = {
            id: generateUUID(),
            type: 'publish' as const,
            payload: {
                channel,
                event: fullEvent,
                options: options || {},
            },
            timestamp: Date.now(),
        };

        WebSocketPublishSchema.parse(message);

        this.socket!.emit('publish', message);

        this.emit('published', { channel, event: fullEvent });
    }

    /**
     * Get current connection state
     */
    getConnectionState(): string {
        return this.connectionState;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.connectionState === 'connected' && this.socket?.connected === true;
    }

    /**
     * Get current subscriptions
     */
    getSubscriptions(): string[] {
        return Array.from(this.subscriptions);
    }

    /**
     * Get organization ID
     */
    getOrganizationId(): string {
        return this.orgId;
    }

    /**
     * Get user ID
     */
    getUserId(): string {
        return this.userId;
    }

    /**
     * Setup socket event listeners
     */
    private setupSocketListeners(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            this.connectionState = 'connected';
            this.reconnectAttempt = 0;
            this.emit('connected');
            this.startHeartbeat();
        });

        this.socket.on('disconnect', (reason: string) => {
            this.connectionState = 'disconnected';
            this.emit('disconnected', { reason });
            this.stopHeartbeat();

            if (this.config.autoReconnect && reason !== 'io client disconnect') {
                this.scheduleReconnect();
            }
        });

        this.socket.on('connect_error', (error: Error) => {
            this.emit('error', error);

            if (this.config.autoReconnect) {
                this.scheduleReconnect();
            }
        });

        this.socket.on('message', (data: any) => {
            try {
                // Handle server time drift on connection.established
                if (data?.type === 'connection.established' && typeof data.timestamp === 'number') {
                    const drift = Math.abs(Date.now() - data.timestamp);
                    if (drift > 3000) {
                        // attempt token refresh if possible; otherwise disconnect
                        if (this.tokenProvider) {
                            this.scheduleTokenRefresh();
                        } else {
                            this.emit('error', new Error('Clock drift exceeds 3s'));
                            this.socket?.disconnect();
                        }
                    }
                }

                // Track last stream id for resume
                if (data?.type === 'event' && data?.payload?.metadata?.channel && data?.payload?.metadata?.stream_entry_id) {
                    this.lastStreamIdByChannel.set(data.payload.metadata.channel, data.payload.metadata.stream_entry_id);
                }

                this.handleMessage(data);
            } catch (error) {
                this.emit('error', new Error(`Failed to handle message: ${error}`));
            }
        });

        this.socket.on('ack', (data: any) => {
            this.emit('ack', data);
        });

        // Rate limit headers (if provided via error/info frames)
        this.socket.on('ratelimit', (info: any) => {
            this.emit('rate_limit', info);
        });

        this.socket.on('error', (data: any) => {
            this.emit('error', new Error(data.payload?.error?.message || 'Unknown error'));
        });

        this.socket.on('pong', () => {
            this.lastPongAt = Date.now();
            this.missedPongs = 0;
        });
    }

    /**
     * Handle incoming messages
     */
    private handleMessage(data: any): void {
        if (data.type === 'event' && data.payload) {
            this.emit('event', data.payload);

            // Emit specific event type
            if (data.payload.type) {
                // Ensure correlation propagation if missing
                if (data.payload?.metadata?.correlation_id && !data.correlation_id) {
                    data.correlation_id = data.payload.metadata.correlation_id;
                }
                this.emit(data.payload.type, data.payload);
            }
        }
    }

    /**
     * Start heartbeat
     */
    private startHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.missedPongs = 0;
        this.lastPongAt = Date.now();
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
                const now = Date.now();
                // liveness check
                if (now - this.lastPongAt > this.config.heartbeatInterval * (AxonPulsClient.MISSED_PONGS_DEAD + 0.5)) {
                    // declare dead and reconnect
                    this.emit('error', new Error('Heartbeat missed'));
                    this.socket?.disconnect();
                    this.scheduleReconnect();
                    return;
                }
                this.socket!.emit('ping', {
                    id: generateUUID(),
                    type: 'ping',
                    payload: {},
                    timestamp: now,
                });
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Stop heartbeat
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Schedule reconnection
     */
    private scheduleReconnect(): void {
        if (this.reconnectAttempt >= this.config.reconnectAttempts) {
            this.emit('error', new Error('Maximum reconnection attempts reached'));
            return;
        }

        this.connectionState = 'reconnecting';
        this.reconnectAttempt++;

        const base = AxonPulsClient.BACKOFF_BASE_MS * Math.pow(AxonPulsClient.BACKOFF_FACTOR, this.reconnectAttempt - 1);
        let delay = Math.min(base, AxonPulsClient.BACKOFF_MAX_MS);
        const jitter = 1 + (Math.random() * 2 - 1) * AxonPulsClient.BACKOFF_JITTER; // ±20%
        delay = Math.floor(delay * jitter);

        this.emit('reconnecting', { attempt: this.reconnectAttempt, delay });

        this.reconnectTimeout = setTimeout(() => {
            this.connect().catch(error => {
                this.emit('error', error);
            });
        }, delay);
    }

    /**
     * Decode JWT token
     */
    private decodeToken(token: string): JwtPayload {
        try {
            const payload = jwtDecode<JwtPayload>(token);

            if (!payload.organizationId || !payload.sub) {
                throw new Error('Token missing required claims (organizationId, sub)');
            }

            return payload;
        } catch (error) {
            throw new Error(`Invalid JWT token: ${error}`);
        }
    }

    /**
     * Validate channel belongs to organization
     */
    private validateChannel(channel: string): void {
        try {
            ChannelSchema.parse(channel);
        } catch {
            throw new Error(`Invalid channel format: ${channel}`);
        }

        if (!channel.startsWith(`org:${this.orgId}:`)) {
            throw new Error(`Channel ${channel} not in your organization (${this.orgId})`);
        }
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return generateUUID();
    }

    private scheduleTokenRefresh(): void {
        if (!this.config.token || !this.tokenProvider) return;
        try {
            const payload = this.decodeToken(this.config.token);
            const nowMs = Date.now();
            const expMs = payload.exp! * 1000;
            const issuedMs = (payload.iat || Math.floor(expMs / 1000)) * 1000;
            const lifetime = expMs - issuedMs;
            const refreshAt = expMs - Math.floor(lifetime * 0.20);
            const driftGuard = 3000;
            const delay = Math.max(0, refreshAt - nowMs - driftGuard);
            if (this.tokenRefreshTimeout) clearTimeout(this.tokenRefreshTimeout);
            this.tokenRefreshTimeout = setTimeout(async () => {
                try {
                    const newToken = await this.tokenProvider!();
                    if (newToken && newToken !== this.config.token) {
                        this.config = { ...this.config, token: newToken };
                        if (this.socket && (this.socket as any).auth) {
                            (this.socket as any).auth.token = newToken;
                        }
                        this.emit('token_refreshed');
                    }
                } catch (e) {
                    this.emit('error', new Error('Token refresh failed'));
                }
            }, delay);
        } catch {
            // ignore decode failures
        }
    }
}

/**
 * Factory function to create AxonPuls client
 */
export function createAxonPulsClient(config: AxonPulsClientConfig): AxonPulsClient {
    return new AxonPulsClient(config);
}
