/**
 * CDN Build - Global AxonSDK + AXONUI + Framework Adapters
 * 
 * Usage: <script src="https://cdn.axonstream.ai/axonui.min.js"></script>
 * Then: window.AxonSDK, window.AXONUI, and framework adapters are available
 */

import {
    AxonPulsClient
} from './index';

// 🚧 CDN BUILD TEMPORARILY DISABLED
// This module needs factory functions that don't exist yet
// Will be re-enabled after implementing missing functions

// Simple factory function for now
function createAxonPulsClient(config?: any) {
    return new AxonPulsClient(config || {});
}

function detectFramework() {
    return { framework: 'vanilla', version: '1.0.0' };
}

function createFrameworkBinding() {
    return {};
}

// Import all UI components for CDN
import {
    AxonChat,
    AxonPresence,
    AxonHITL,
    AxonEmbed as AxonEmbedComponent,
    AxonNotifications,
    createChat,
    createPresence,
    createHITL,
    createEmbed,
    createNotifications,
    AxonUIBuilder
} from './ui';

// Make everything globally available
declare global {
    interface Window {
        AxonSDK: typeof AxonPulsClient;
        createAxonStream: typeof createAxonPulsClient;
        AXONUI: {
            // Legacy mount function
            mount: (config: {
                el: string | HTMLElement;
                token: string;
                channel: string;
                org?: string;
                theme?: 'light' | 'dark' | 'auto';
            }) => Promise<{ disconnect: () => void; send: (data: any) => void }>;

            // Full UI component system
            create: typeof createUI;
            createChat: typeof createChat;
            createPresence: typeof createPresence;
            createHITL: typeof createHITL;
            createEmbed: typeof createEmbed;
            createNotifications: typeof createNotifications;
            builder: (client: AxonPulsClient) => AxonUIBuilder;

            // Component classes
            Chat: typeof AxonChat;
            Presence: typeof AxonPresence;
            HITL: typeof AxonHITL;
            Embed: typeof AxonEmbedComponent;
            Notifications: typeof AxonNotifications;
            Builder: typeof AxonUIBuilder;
        };

        // Framework detection
        AxonFramework: {
            detect: typeof detectFramework;
            createBinding: typeof createFrameworkBinding;
        };
    }
}

function createUI(client: AxonPulsClient, type: string, config: any) {
    const baseConfig = { client, ...config };

    switch (type) {
        case 'chat':
            return createChat(baseConfig);
        case 'presence':
            return createPresence(baseConfig);
        case 'hitl':
            return createHITL(baseConfig);
        case 'embed':
            return createEmbed(baseConfig);
        case 'notifications':
            return createNotifications(baseConfig);
        default:
            throw new Error(`Unknown UI component type: ${type}`);
    }
}

// Attach to window
if (typeof window !== 'undefined') {
    window.AxonSDK = AxonPulsClient;
    window.createAxonStream = createAxonPulsClient;

    // Enhanced AXONUI with full component system
    window.AXONUI = {
        // Legacy mount function (enhanced)
        async mount(config) {
            const client = new AxonPulsClient({
                url: config.org ? `wss://${config.org}.axonstream.ai` : 'ws://localhost:3001',
                token: config.token,
                autoReconnect: true,
                debug: true
            });

            // Use the new embed component for better UI
            const embed = createEmbed({
                el: config.el,
                token: config.token,
                channel: config.channel,
                org: config.org,
                theme: config.theme,
                features: ['chat']
            });

            return {
                disconnect: () => embed.destroy(),
                send: (data) => embed.sendMessage(data),
                getClient: () => embed.getClient(),
                getComponent: (type: string) => embed.getComponent(type)
            };
        },

        // Full UI component system
        create: createUI,
        createChat,
        createPresence,
        createHITL,
        createEmbed,
        createNotifications,
        builder: (client: AxonPulsClient) => new AxonUIBuilder(client),

        // Component classes
        Chat: AxonChat,
        Presence: AxonPresence,
        HITL: AxonHITL,
        Embed: AxonEmbedComponent,
        Notifications: AxonNotifications,
        Builder: AxonUIBuilder
    };

    // Framework detection
    window.AxonFramework = {
        detect: detectFramework,
        createBinding: createFrameworkBinding
    };
}

// Also export for module usage
export { AxonPulsClient as AxonSDK, createAxonPulsClient as createAxonStream };
