/**
 * AXONUI Factory Functions
 * 
 * Easy-to-use factory functions for creating UI components
 */

import type { AxonPulsClient } from '../core/client';
import { AxonChat, type ChatConfig } from './components/chat';
import { AxonPresence, type PresenceConfig } from './components/presence';
import { AxonHITL, type HITLConfig } from './components/hitl';
import { AxonEmbed, type EmbedConfig } from './components/embed';
import { AxonNotifications, type NotificationConfig } from './components/notifications';

// Factory functions
export function createChat(config: ChatConfig): AxonChat {
    return new AxonChat(config);
}

export function createPresence(config: PresenceConfig): AxonPresence {
    return new AxonPresence(config);
}

export function createHITL(config: HITLConfig): AxonHITL {
    return new AxonHITL(config);
}

export function createEmbed(config: EmbedConfig): AxonEmbed {
    return new AxonEmbed(config);
}

export function createNotifications(config: NotificationConfig): AxonNotifications {
    return new AxonNotifications(config);
}

// Enhanced factory with auto-detection
export function createUI(client: AxonPulsClient, type: string, config: any) {
    const baseConfig = { client, ...config };

    switch (type) {
        case 'chat':
            return createChat(baseConfig as ChatConfig);
        case 'presence':
            return createPresence(baseConfig as PresenceConfig);
        case 'hitl':
            return createHITL(baseConfig as HITLConfig);
        case 'embed':
            return createEmbed(baseConfig as EmbedConfig);
        case 'notifications':
            return createNotifications(baseConfig);
        default:
            throw new Error(`Unknown UI component type: ${type}`);
    }
}

// All-in-one UI builder
export class AxonUIBuilder {
    private client: AxonPulsClient;
    private components: Map<string, any> = new Map();

    constructor(client: AxonPulsClient) {
        this.client = client;
    }

    chat(config: Omit<ChatConfig, 'client'>): AxonUIBuilder {
        const component = createChat({ ...config, client: this.client });
        this.components.set('chat', component);
        return this;
    }

    presence(config: Omit<PresenceConfig, 'client'>): AxonUIBuilder {
        const component = createPresence({ ...config, client: this.client });
        this.components.set('presence', component);
        return this;
    }

    hitl(config: Omit<HITLConfig, 'client'>): AxonUIBuilder {
        const component = createHITL({ ...config, client: this.client });
        this.components.set('hitl', component);
        return this;
    }

    notifications(config: Omit<NotificationConfig, 'client'>): AxonUIBuilder {
        const component = createNotifications({ ...config, client: this.client });
        this.components.set('notifications', component);
        return this;
    }

    build(): Map<string, any> {
        return new Map(this.components);
    }

    mount(selector: string): { [key: string]: any } {
        const container = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!container) {
            throw new Error(`Container not found: ${selector}`);
        }

        const mounted: { [key: string]: any } = {};

        this.components.forEach((component, type) => {
            const wrapper = document.createElement('div');
            wrapper.className = `axon-ui-${type}`;
            wrapper.style.marginBottom = '16px';

            component.mount(wrapper);
            container.appendChild(wrapper);

            mounted[type] = component;
        });

        return mounted;
    }

    destroy(): void {
        this.components.forEach(component => component.destroy());
        this.components.clear();
    }
}

// Global AXONUI object for CDN usage
if (typeof window !== 'undefined') {
    (window as any).AXONUI = {
        ...(window as any).AXONUI,
        create: createUI,
        createChat,
        createPresence,
        createHITL,
        createEmbed,
        createNotifications,
        builder: (client: AxonPulsClient) => new AxonUIBuilder(client),

        // Direct component classes
        Chat: AxonChat,
        Presence: AxonPresence,
        HITL: AxonHITL,
        Embed: AxonEmbed,
        Notifications: AxonNotifications,
        Builder: AxonUIBuilder
    };
}
