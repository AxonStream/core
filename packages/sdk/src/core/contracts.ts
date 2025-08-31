import { z } from 'zod';

// 🛡️ SECURE UUID GENERATION - Cryptographically secure
export function generateUUID(): string {
    // Use crypto.randomUUID() if available (modern browsers/Node.js 14.17+)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback to crypto.getRandomValues() for older environments
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);

        // Set version (4) and variant bits
        array[6] = (array[6]! & 0x0f) | 0x40; // Version 4
        array[8] = (array[8]! & 0x3f) | 0x80; // Variant 10

        // Convert to hex string with proper formatting
        const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        return [
            hex.slice(0, 8),
            hex.slice(8, 12),
            hex.slice(12, 16),
            hex.slice(16, 20),
            hex.slice(20, 32)
        ].join('-');
    }

    // Last resort fallback (should never happen in production)
    console.warn('⚠️ SECURITY WARNING: Using insecure UUID generation. Upgrade your environment.');
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Event Types
export const EventTypes = [
    'agent.created',
    'agent.updated',
    'agent.deleted',
    'tool.executed',
    'workflow.started',
    'workflow.completed',
    'workflow.failed',
    'connection.established',
    'connection.lost',
    'system.alert',
    'user.action',
    'provider.status',
] as const;

// Error Codes
export const ErrorCodes = {
    INVALID_CHANNEL: 'AxonPuls-CHANNEL1',
    PAYLOAD_TOO_LARGE: 'AxonPuls-PAYLOAD1',
    SUBSCRIPTION_LIMIT: 'AxonPuls-SUB1',
    TENANT_ISOLATION: 'AxonPuls-TENANT1',
    AUTHENTICATION: 'AxonPuls-AUTH1',
    RATE_LIMIT: 'AxonPuls-RATE1',
} as const;

// Channel Schema
export const ChannelSchema = z.string().regex(
    /^org:[a-zA-Z0-9_-]+:[a-zA-Z0-9_.-]+$/,
    'Channel must follow format: org:<org_id>:<channel_name>'
);

// Event Metadata Schema
export const EventMetadataSchema = z.object({
    correlation_id: z.string().optional(),
    org_id: z.string(),
    channel: z.string().optional(),
    stream_entry_id: z.string().optional(),
    timestamp: z.number().optional(),
});

// AxonPuls Event Schema
export const AxonPulsEventSchema = z.object({
    id: z.string(),
    type: z.string(),
    payload: z.any(),
    timestamp: z.number(),
    metadata: EventMetadataSchema.optional(),
});

// WebSocket Message Schemas
export const WebSocketSubscribeSchema = z.object({
    id: z.string(),
    type: z.literal('subscribe'),
    payload: z.object({
        channels: z.array(ChannelSchema),
        options: z.object({
            replay_from: z.string().optional(),
            replay_count: z.number().optional(),
            filter: z.string().optional(),
        }).optional(),
    }),
    timestamp: z.number(),
});

export const WebSocketUnsubscribeSchema = z.object({
    id: z.string(),
    type: z.literal('unsubscribe'),
    payload: z.object({
        channels: z.array(ChannelSchema),
    }),
    timestamp: z.number(),
});

export const WebSocketPublishSchema = z.object({
    id: z.string(),
    type: z.literal('publish'),
    payload: z.object({
        channel: ChannelSchema,
        event: AxonPulsEventSchema,
        options: z.object({
            delivery_guarantee: z.enum(['at_least_once', 'at_most_once']).optional(),
            partition_key: z.string().optional(),
        }).optional(),
    }),
    timestamp: z.number(),
});

export const WebSocketReplaySchema = z.object({
    id: z.string(),
    type: z.literal('replay'),
    payload: z.object({
        channel: ChannelSchema,
        sinceId: z.string().optional(),
        count: z.number().optional(),
    }),
    timestamp: z.number(),
});

export const ErrorResponseSchema = z.object({
    id: z.string(),
    type: z.literal('error'),
    payload: z.object({
        type: z.string(),
        error: z.object({
            code: z.string(),
            message: z.string(),
        }),
    }),
    timestamp: z.number(),
});

// Type exports
export type AxonPulsEvent = z.infer<typeof AxonPulsEventSchema>;
export type EventMetadata = z.infer<typeof EventMetadataSchema>;
export type WebSocketSubscribeMessage = z.infer<typeof WebSocketSubscribeSchema>;
export type WebSocketPublishMessage = z.infer<typeof WebSocketPublishSchema>;
export type WebSocketUnsubscribeMessage = z.infer<typeof WebSocketUnsubscribeSchema>;
export type WebSocketReplayMessage = z.infer<typeof WebSocketReplaySchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Utility functions
export function createEventMetadata(orgId: string, channelOrOptions?: string | Partial<EventMetadata>): EventMetadata {
    const base: EventMetadata = {
        org_id: orgId,
        correlation_id: generateUUID(),
        timestamp: Date.now(),
    };

    if (typeof channelOrOptions === 'string') {
        return { ...base, channel: channelOrOptions };
    } else if (channelOrOptions) {
        return { ...base, ...channelOrOptions };
    }

    return base;
}

export function validateChannel(channel: string): boolean {
    try {
        ChannelSchema.parse(channel);
        return true;
    } catch {
        return false;
    }
}

export function extractOrgIdFromChannel(channel: string): string | null {
    const match = channel.match(/^org:([a-zA-Z0-9_-]+):/);
    return match ? match[1] || null : null;
}
