import { useAxonpulsChannel } from './hooks/useAxonpulsChannel';
import { useAxonpulsHITL } from './hooks/useAxonpulsHITL';
import { useAxonpulsPresence } from './hooks/useAxonpulsPresence';
import { useAxonpuls } from './hooks/useAxonpuls';
import { useAxonpulsMagic } from './hooks/useAxonpulsMagic';
import { useAxonpulsWebhooks } from './hooks/useAxonpulsWebhooks';

// Main AXONPULS React Hooks Library
export {
    useAxonpuls,
    useAxonpulsChannel,
    useAxonpulsHITL,
    useAxonpulsPresence,
    useAxonpulsMagic,
    useAxonpulsWebhooks
};

// 🎯 LEGACY COMPATIBILITY EXPORTS
export { useAxonpuls as useAxonStream } from './hooks/useAxonpuls';
export { useAxonpulsChannel as useChannel } from './hooks/useAxonpulsChannel';

// Re-export types
export type {
    AxonpulsConfig,
    AxonpulsConnection,
} from './hooks/useAxonpuls';

export type {
    ChannelMessage,
    ChannelState,
} from './hooks/useAxonpulsChannel';

export type {
    HITLRequest,
    HITLResponse,
    HITLState,
} from './hooks/useAxonpulsHITL';

export type {
    PresenceUser,
    PresenceState,
} from './hooks/useAxonpulsPresence';

export type {
    MagicRoom,
    MagicOperation,
    MagicState,
} from './hooks/useAxonpulsMagic';

export type {
    Webhook,
    CreateWebhookData,
    WebhookDelivery,
    WebhookTemplate,
    WebhookState,
} from './hooks/useAxonpulsWebhooks';

// Integration with core SDK adapters
// Enhanced factory function that integrates with core SDK
export function createAxonpulsReactBinding(client: any) {
    // Real integration with production features
    return {
        useAxonpuls: (config: any) => useAxonpuls(config),
        useAxonpulsChannel: (channel: string, options?: any) => {
            // Create a connection object that wraps the client
            const connection = {
                client: client,
                isConnected: client?.isConnected() || false,
                isConnecting: false,
                error: null,
                connect: () => client?.connect(),
                disconnect: () => client?.disconnect(),
                publish: (ch: string, data: any) => client?.publish(ch, data),
                subscribe: (channels: string[]) => client?.subscribe(channels),
                unsubscribe: (channels: string[]) => client?.unsubscribe(channels),
                request: (method: string, endpoint: string, data?: any) => (client as any)?.request(method, endpoint, data)
            };
            return useAxonpulsChannel(channel, connection, options);
        },
        useAxonpulsHITL: (options: any) => useAxonpulsHITL(client, options),
        useAxonpulsPresence: (options: any) => useAxonpulsPresence(client, options),
        client
    };
}