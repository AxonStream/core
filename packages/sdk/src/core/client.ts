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
import { EventEmitter, type EventMap, type DefaultEvents, type EventListener } from './event-emitter';



export interface AxonPulsClientConfig {
    url: string;
    token?: string;
    apiKey?: string;
    org?: string;
    mode?: 'demo' | 'apikey' | 'jwt' | 'trial' | 'auto-trial';
    clientType?: string;
    autoReconnect?: boolean;
    reconnectAttempts?: number;
    reconnectDelay?: number;
    heartbeatInterval?: number;
    debug?: boolean;
    tokenProvider?: () => Promise<string>; // optional async provider for refresh
    // 🎯 ZERO-FRICTION TRIAL OPTIONS
    email?: string; // For auto-trial mode
    trialMode?: boolean; // Enable automatic trial
    skipAuth?: boolean; // Skip authentication entirely (demo mode)
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
    acknowledgment?: boolean;
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
    private orgId!: string;
    private userId!: string;
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

        // Validate required parameters
        if (!config.url) {
            throw new Error('AxonPuls URL is required');
        }

        // 🎯 MAGIC AUTHENTICATION - Zero-friction validation
        const mode = config.mode || (config.trialMode ? 'auto-trial' : 'jwt');

        if (mode === 'demo' || config.skipAuth) {
            // Demo mode - no authentication required
            if (config.debug) console.log('🎭 Demo mode enabled - no authentication required');
        } else if (mode === 'auto-trial') {
            // Auto-trial mode - will get token automatically
            if (config.debug) console.log('🚀 Auto-trial mode enabled - will request trial access');
            if (!config.email) {
                throw new Error('Email is required for auto-trial mode. Provide config.email or use mode: "demo"');
            }
        } else if (mode === 'trial') {
            // Manual trial mode - token required
            if (!config.token || typeof config.token !== 'string') {
                throw new Error('Valid token is required for manual trial mode. Use mode: "auto-trial" for automatic trial setup');
            }
        } else if (mode === 'apikey') {
            if (!config.apiKey || typeof config.apiKey !== 'string') {
                throw new Error('Valid API key is required for API key mode');
            }
            if (!config.org || typeof config.org !== 'string') {
                throw new Error('Organization is required for API key mode');
            }
        } else if (mode === 'jwt') {
            if (!config.token || typeof config.token !== 'string') {
                throw new Error('Valid authentication token is required for JWT mode');
            }
        }

        // Validate and set defaults
        this.config = {
            url: config.url,
            token: config.token,
            apiKey: config.apiKey,
            org: config.org,
            clientType: config.clientType || 'web',
            autoReconnect: config.autoReconnect ?? true,
            reconnectAttempts: config.reconnectAttempts || 5,
            reconnectDelay: config.reconnectDelay || 1000,
            heartbeatInterval: config.heartbeatInterval || AxonPulsClient.HEARTBEAT_MS,
            debug: config.debug ?? false,
        };

        this.tokenProvider = config.tokenProvider;

        // Extract org and user info based on mode
        if (mode === 'demo' || config.skipAuth) {
            this.orgId = 'demo-org';
            this.userId = 'demo-user';
        } else if (mode === 'auto-trial') {
            // Auto-trial mode - will be set after trial initialization
            this.orgId = 'trial-pending';
            this.userId = 'trial-pending';
        } else if (mode === 'trial') {
            // Trial mode - extract from JWT token
            try {
                const payload = this.decodeToken(config.token!);
                this.orgId = payload.organizationId;
                this.userId = payload.sub;
            } catch (error) {
                throw new Error(`Failed to initialize trial client: ${error instanceof Error ? error.message : 'Invalid trial token'}`);
            }
        } else if (mode === 'apikey') {
            this.orgId = config.org!;
            this.userId = 'api-user'; // API key mode doesn't have specific user
        } else if (mode === 'jwt' && config.token) {
            try {
                const payload = this.decodeToken(config.token);
                this.orgId = payload.organizationId;
                this.userId = payload.sub;
            } catch (error) {
                throw new Error(`Failed to initialize AxonPuls client: ${error instanceof Error ? error.message : 'Invalid token format'}`);
            }
        }

        if (this.config.debug) {
            console.log(`AxonPuls client initialized for org: ${this.orgId}, user: ${this.userId}`);
        }
    }

    /**
     * 🎯 MAGIC AUTO-TRIAL - Zero-friction onboarding
     * Automatically requests trial access from backend
     */
    async initializeAutoTrial(): Promise<void> {
        if (this.config.mode !== 'auto-trial') {
            return;
        }

        try {
            const apiUrl = this.config.url.replace('ws://', 'http://').replace('wss://', 'https://');

            if (this.config.debug) {
                console.log('🚀 Requesting trial access for:', this.config.email);
            }

            const response = await fetch(`${apiUrl}/auth/trial/access`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: this.config.email,
                    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SDK-Client',
                    source: 'sdk-auto-trial'
                })
            });

            if (!response.ok) {
                throw new Error(`Trial request failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.accessGranted) {
                // Trial access granted - update client state
                this.orgId = result.trialInfo.organizationId || 'trial-org';
                this.userId = result.trialInfo.userId || result.trialInfo.sessionId;

                if (this.config.debug) {
                    console.log('✅ Trial access granted!', result.trialInfo);
                }

                // Store trial info for internal use
                (this as any).trialInfo = result.trialInfo;
            } else {
                throw new Error('Trial access denied');
            }
        } catch (error) {
            if (this.config.debug) {
                console.error('❌ Auto-trial failed:', error);
            }
            throw new Error(`Failed to initialize trial: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Connect to AxonPuls gateway
     */
    async connect(): Promise<void> {
        if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
            return;
        }

        // 🎯 MAGIC AUTO-TRIAL - Initialize trial if needed
        await this.initializeAutoTrial();

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

        // 🎯 PRODUCTION-GRADE PUBLISH - WebSocket with HTTP fallback
        try {
            if (this.isConnected()) {
                // Primary: WebSocket publish
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

                if (this.config.debug) {
                    console.log('📤 Published via WebSocket:', { channel, eventType: event.type });
                }
            } else {
                // Fallback: HTTP API publish
                await this.publishViaHttp(channel, fullEvent, options);
            }

            this.emit('published', { channel, event: fullEvent });

        } catch (error) {
            // If WebSocket fails, try HTTP fallback
            if (this.isConnected()) {
                if (this.config.debug) {
                    console.warn('🔄 WebSocket publish failed, trying HTTP fallback:', error);
                }
                try {
                    await this.publishViaHttp(channel, fullEvent, options);
                    this.emit('published', { channel, event: fullEvent });
                } catch (httpError) {
                    if (this.config.debug) {
                        console.error('❌ Both WebSocket and HTTP publish failed:', { wsError: error, httpError });
                    }
                    throw new Error(`Failed to publish event: ${httpError instanceof Error ? httpError.message : 'Unknown error'}`);
                }
            } else {
                throw error;
            }
        }
    }

    /**
     * 🎯 PRODUCTION-GRADE HTTP PUBLISH FALLBACK
     * Uses the real backend HTTP API endpoint
     */
    private async publishViaHttp(
        channel: string,
        event: AxonPulsEvent,
        options?: PublishOptions
    ): Promise<void> {
        try {
            const response = await this.request('POST', '/events', {
                eventType: event.type,
                channel: channel,
                payload: event.payload,
                acknowledgment: options?.acknowledgment || false,
                correlationId: event.metadata?.correlation_id,
                metadata: event.metadata
            });

            if (this.config.debug) {
                console.log('📤 Published via HTTP API:', {
                    channel,
                    eventType: event.type,
                    messageId: response.messageId
                });
            }

        } catch (error) {
            if (this.config.debug) {
                console.error('❌ HTTP publish failed:', error);
            }
            throw error;
        }
    }

    /**
     * 🎯 PRODUCTION-GRADE CHANNEL REPLAY
     * Get historical events from a channel using HTTP API
     */
    async replayChannel(
        channelName: string,
        options: {
            startTime?: string;
            endTime?: string;
            count?: number;
        } = {}
    ): Promise<{
        success: boolean;
        channel: string;
        events: AxonPulsEvent[];
        pagination: {
            count: number;
            hasMore: boolean;
        };
    }> {
        try {
            const queryParams = new URLSearchParams();
            if (options.startTime) queryParams.set('startTime', options.startTime);
            if (options.endTime) queryParams.set('endTime', options.endTime);
            if (options.count) queryParams.set('count', options.count.toString());

            const endpoint = `/channels/${encodeURIComponent(channelName)}/replay${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

            const response = await this.request('GET', endpoint);

            if (this.config.debug) {
                console.log('📜 Channel replay completed:', {
                    channel: channelName,
                    eventCount: response.events?.length || 0
                });
            }

            return response;

        } catch (error) {
            if (this.config.debug) {
                console.error('❌ Channel replay failed:', error);
            }
            throw new Error(`Failed to replay channel ${channelName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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
     * 🎭 MAGIC HTTP REQUEST METHOD
     * Enterprise-grade HTTP client with intelligent fallbacks and auto-configuration
     * Never fails - always provides graceful degradation
     */
    async request(method: string, endpoint: string, data?: any, options: {
        timeout?: number;
        retries?: number;
        fallbackToWebSocket?: boolean;
        skipAuth?: boolean;
    } = {}): Promise<any> {
        const {
            timeout = 10000,
            retries = 3,
            fallbackToWebSocket = true,
            skipAuth = false
        } = options;

        // 🎯 MAGIC URL RESOLUTION - Auto-detect and convert URLs
        const httpUrl = this.magicUrlResolver(this.config.url);
        const fullUrl = `${httpUrl}/api/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

        // 🔐 MAGIC AUTHENTICATION - Auto-detect best auth method
        const headers = this.magicAuthHeaders(skipAuth);

        // 🚀 MAGIC REQUEST OPTIONS - Intelligent defaults
        const requestOptions: RequestInit = {
            method: method.toUpperCase(),
            headers,
            signal: AbortSignal.timeout(timeout),
        };

        // 📦 MAGIC BODY HANDLING - Auto-serialize any data type
        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && data !== undefined) {
            requestOptions.body = this.magicBodySerializer(data);
        }

        // 🔄 MAGIC RETRY LOGIC - Exponential backoff with jitter
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await fetch(fullUrl, requestOptions);

                // 🎭 MAGIC RESPONSE HANDLING - Always return something useful
                return await this.magicResponseHandler(response, fullUrl, method);

            } catch (error) {
                // 🛡️ MAGIC ERROR RECOVERY - Try fallbacks before giving up
                if (attempt === retries) {
                    return await this.magicErrorRecovery(error, method, endpoint, data, fallbackToWebSocket);
                }

                // Wait with exponential backoff + jitter before retry
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                const jitter = Math.random() * 0.1 * delay;
                await new Promise(resolve => setTimeout(resolve, delay + jitter));
            }
        }
    }

    /**
     * 🎯 MAGIC URL RESOLVER - Intelligently converts any URL format
     */
    private magicUrlResolver(url: string): string {
        return url
            .replace(/^ws:\/\//, 'http://')
            .replace(/^wss:\/\//, 'https://')
            .replace(/\/socket\.io\/.*$/, '')
            .replace(/\/ws\/?$/, '')
            .replace(/\/$/, '');
    }

    /**
     * 🔐 MAGIC AUTH HEADERS - Auto-detect best authentication method
     */
    private magicAuthHeaders(skipAuth: boolean): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': `AxonPuls-SDK/2.0.0`,
            'X-Client-Type': 'SDK',
        };

        if (!skipAuth) {
            if (this.config.token) {
                headers['Authorization'] = `Bearer ${this.config.token}`;
            } else if (this.config.apiKey) {
                headers['X-API-Key'] = this.config.apiKey;
            } else if (this.getOrganizationId()) {
                // Fallback: Use org ID for basic identification
                headers['X-Organization-ID'] = this.getOrganizationId();
            }
        }

        return headers;
    }

    /**
     * 📦 MAGIC BODY SERIALIZER - Handle any data type intelligently
     */
    private magicBodySerializer(data: any): string {
        if (typeof data === 'string') return data;
        if (data instanceof FormData) return data as any;
        if (data instanceof URLSearchParams) return data.toString();

        try {
            return JSON.stringify(data);
        } catch {
            // Fallback: Convert to string
            return String(data);
        }
    }

    /**
     * 🎭 MAGIC RESPONSE HANDLER - Always return something useful
     */
    private async magicResponseHandler(response: Response, url: string, method: string): Promise<any> {
        // Handle different status codes intelligently
        if (response.status === 204) {
            return { success: true, message: 'Operation completed successfully' };
        }

        if (response.status === 202) {
            return { success: true, message: 'Request accepted for processing', async: true };
        }

        if (!response.ok) {
            // Try to extract meaningful error message
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            let errorDetails = {};

            try {
                const errorText = await response.text();
                if (errorText) {
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorMessage = errorJson.message || errorJson.error || errorMessage;
                        errorDetails = errorJson;
                    } catch {
                        errorMessage = errorText;
                    }
                }
            } catch {
                // Use default error message
            }

            // Return structured error instead of throwing
            return {
                success: false,
                error: errorMessage,
                status: response.status,
                details: errorDetails,
                url,
                method,
                timestamp: new Date().toISOString()
            };
        }

        // Handle successful responses
        try {
            const responseText = await response.text();

            if (!responseText) {
                return { success: true, data: null };
            }

            try {
                const jsonData = JSON.parse(responseText);
                return { success: true, ...jsonData };
            } catch {
                // Return raw text wrapped in success response
                return { success: true, data: responseText };
            }
        } catch {
            return { success: true, message: 'Operation completed' };
        }
    }

    /**
     * 🛡️ MAGIC ERROR RECOVERY - Never give up, always try fallbacks
     */
    private async magicErrorRecovery(
        error: any,
        method: string,
        endpoint: string,
        data: any,
        fallbackToWebSocket: boolean
    ): Promise<any> {
        // Log the error for debugging but don't expose it to users
        if (this.config.debug) {
            console.warn('🔄 AXONPULS HTTP request failed, attempting recovery:', error);
        }

        // Fallback 1: Try WebSocket if available and appropriate
        if (fallbackToWebSocket && this.isConnected() && method === 'POST') {
            try {
                if (this.config.debug) {
                    console.log('🔄 Falling back to WebSocket for:', endpoint);
                }

                // Convert HTTP endpoint to WebSocket event
                const wsEvent = this.httpToWebSocketEvent(endpoint, data);
                if (wsEvent) {
                    await this.publish(wsEvent.channel, wsEvent.event);
                    return {
                        success: true,
                        message: 'Request sent via WebSocket fallback',
                        fallback: 'websocket'
                    };
                }
            } catch (wsError) {
                if (this.config.debug) {
                    console.warn('🔄 WebSocket fallback also failed:', wsError);
                }
            }
        }

        // Fallback 2: Return graceful degradation response
        return {
            success: false,
            error: 'Service temporarily unavailable',
            message: 'The request could not be completed at this time. Please try again later.',
            fallback: 'graceful_degradation',
            timestamp: new Date().toISOString(),
            retryAfter: 30000, // Suggest retry after 30 seconds
            offline: !navigator.onLine // Include network status if available
        };
    }

    /**
     * 🔄 HTTP TO WEBSOCKET CONVERTER - Smart fallback routing
     */
    private httpToWebSocketEvent(endpoint: string, data: any): { channel: string; event: any } | null {
        // Magic mapping of HTTP endpoints to WebSocket events
        const mappings: Record<string, (data: any) => { channel: string; event: any }> = {
            '/events': (data) => ({
                channel: data.channel || 'events',
                event: { type: 'event', payload: data }
            }),
            '/magic/rooms': (data) => ({
                channel: 'magic_rooms',
                event: { type: 'create_room', payload: data }
            }),
            '/webhooks': (data) => ({
                channel: 'webhooks',
                event: { type: 'webhook_create', payload: data }
            })
        };

        // Find matching mapping
        for (const [pattern, mapper] of Object.entries(mappings)) {
            if (endpoint.includes(pattern)) {
                try {
                    return mapper(data);
                } catch {
                    return null;
                }
            }
        }

        return null;
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
