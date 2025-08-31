/**
 * AxonEmbed - Enhanced Embeddable Widget System
 * 
 * Features:
 * - Multiple feature combinations
 * - Responsive design
 * - Theme customization
 * - Easy one-line embedding
 * - Auto-configuration
 */

import { AxonUIComponent, type ComponentConfig, createElement } from '../base';
import { AxonChat, type ChatConfig } from './chat';
import { AxonPresence, type PresenceConfig } from './presence';
import { AxonHITL, type HITLConfig } from './hitl';
import type { AxonPulsClient } from '../../core/client';
import { getEmbedConfig } from '../../config/ui-config';

export interface EmbedConfig extends ComponentConfig {
    el: string | HTMLElement;
    token: string;
    channel: string;
    org?: string;
    features?: Array<'chat' | 'presence' | 'hitl' | 'notifications'>;
    width?: string;
    height?: string;
}

export class AxonEmbed extends AxonUIComponent {
    public config: EmbedConfig;
    private client: AxonPulsClient;
    private components: Map<string, AxonUIComponent> = new Map();
    private tabContainer!: HTMLElement;
    private contentContainer!: HTMLElement;
    private activeTab = 'chat';

    constructor(config: EmbedConfig) {
        super(config);
        const embedDefaults = getEmbedConfig();
        this.config = {
            features: embedDefaults.defaultFeatures,
            width: embedDefaults.defaultWidth,
            height: embedDefaults.defaultHeight,
            theme: 'light',
            ...config
        };

        // Create client
        this.client = new (require('../../core/client').AxonPulsClient)({
            url: this.config.org ? `wss://${this.config.org}.axonstream.ai` : 'ws://localhost:3001',
            token: this.config.token,
            autoReconnect: true,
            debug: this.config.debug || false
        });

        this.initializeClient();
    }

    private async initializeClient(): Promise<void> {
        try {
            await this.client.connect();
            this.setupComponents();

            if (this.config.debug) {
                console.log('[AxonEmbed] Connected and components initialized');
            }
        } catch (error) {
            console.error('[AxonEmbed] Failed to initialize:', error);
        }
    }

    private setupComponents(): void {
        const features = this.config.features || ['chat'];

        // Setup Chat component
        if (features.includes('chat')) {
            const chatComponent = new AxonChat({
                channel: this.config.channel,
                client: this.client,
                theme: this.config.theme,
                enableInput: true,
                showTimestamps: true
            });
            this.components.set('chat', chatComponent);
        }

        // Setup Presence component  
        if (features.includes('presence')) {
            const presenceComponent = new AxonPresence({
                room: this.config.channel.replace(':', '_'), // Convert channel to room name
                client: this.client,
                theme: this.config.theme,
                showAvatars: true,
                showStatus: true
            });
            this.components.set('presence', presenceComponent);
        }

        // Setup HITL component
        if (features.includes('hitl')) {
            const hitlComponent = new AxonHITL({
                department: 'general',
                client: this.client,
                theme: this.config.theme,
                showPriority: true
            });
            this.components.set('hitl', hitlComponent);
        }

        // Render components in container
        this.renderComponents();
    }

    private renderComponents(): void {
        if (!this.contentContainer) return;

        // Clear existing content
        this.contentContainer.innerHTML = '';

        const features = this.config.features || ['chat'];

        if (features.length === 1) {
            // Single feature - render directly
            const component = this.components.get(features[0]!);
            if (component) {
                const componentEl = component.render();
                this.contentContainer.appendChild(componentEl);
            }
        } else {
            // Multiple features - use tabs
            this.renderTabbedInterface();
        }
    }

    private renderTabbedInterface(): void {
        const features = this.config.features || ['chat'];

        // Update tab buttons
        this.tabContainer.innerHTML = '';

        features.forEach(feature => {
            const tabButton = createElement('button', {
                className: `axon-embed-tab ${feature === this.activeTab ? 'active' : ''}`,
                style: {
                    padding: '8px 16px',
                    border: 'none',
                    background: feature === this.activeTab ? 'var(--primary)' : 'transparent',
                    color: feature === this.activeTab ? 'white' : 'var(--text)',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                }
            }, [this.getFeatureLabel(feature)]);

            this.applyTheme(tabButton, tabButton.style as any);

            tabButton.addEventListener('click', () => {
                this.activeTab = feature;
                this.renderTabbedInterface();
            });

            this.tabContainer.appendChild(tabButton);
        });

        // Render active component
        const activeComponent = this.components.get(this.activeTab);
        if (activeComponent) {
            this.contentContainer.innerHTML = '';
            const componentEl = activeComponent.render();

            // Adjust component styles for embed
            componentEl.style.border = 'none';
            componentEl.style.borderRadius = '0';
            componentEl.style.height = '100%';

            this.contentContainer.appendChild(componentEl);
        }
    }

    private getFeatureLabel(feature: string): string {
        switch (feature) {
            case 'chat': return '💬 Chat';
            case 'presence': return '👥 Users';
            case 'hitl': return '🔄 Approvals';
            case 'notifications': return '🔔 Alerts';
            default: return feature;
        }
    }

    public render(): HTMLElement {
        const targetElement = typeof this.config.el === 'string'
            ? document.querySelector(this.config.el)
            : this.config.el;

        if (!targetElement) {
            throw new Error(`Target element not found: ${this.config.el}`);
        }

        const container = createElement('div', {
            className: `axon-embed ${this.config.className || ''}`,
            style: {
                width: this.config.width,
                height: this.config.height,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: '14px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                ...this.config.style
            }
        });

        this.applyTheme(container, container.style as any);

        const features = this.config.features || ['chat'];

        // Header (always shown)
        const header = createElement('div', {
            className: 'axon-embed-header',
            style: {
                padding: '12px 16px',
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }
        });

        this.applyTheme(header, header.style as any);

        // Title and status
        const titleContainer = createElement('div', {
            style: { display: 'flex', alignItems: 'center' }
        });

        const statusIndicator = createElement('div', {
            style: {
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: this.client?.isConnected() ? this.theme.success : this.theme.danger,
                marginRight: '8px'
            }
        });

        const title = createElement('span', {
            style: {
                fontWeight: '600',
                color: 'var(--text)'
            }
        }, [`AXONPULS • ${this.config.channel}`]);

        this.applyTheme(title, title.style as any);

        titleContainer.appendChild(statusIndicator);
        titleContainer.appendChild(title);

        // Minimize button (optional)
        const minimizeBtn = createElement('button', {
            style: {
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '18px',
                padding: '0',
                width: '20px',
                height: '20px'
            }
        }, ['−']);

        this.applyTheme(minimizeBtn, minimizeBtn.style as any);

        minimizeBtn.addEventListener('click', () => {
            const isMinimized = container.style.height === '40px';
            container.style.height = isMinimized ? (this.config.height || '500px') : '40px';
            minimizeBtn.textContent = isMinimized ? '−' : '+';
        });

        header.appendChild(titleContainer);
        header.appendChild(minimizeBtn);
        container.appendChild(header);

        // Tabs (if multiple features)
        if (features.length > 1) {
            this.tabContainer = createElement('div', {
                className: 'axon-embed-tabs',
                style: {
                    display: 'flex',
                    gap: '4px',
                    padding: '8px 12px',
                    background: 'var(--surface)',
                    borderBottom: '1px solid var(--border)'
                }
            });

            this.applyTheme(this.tabContainer, this.tabContainer.style as any);
            container.appendChild(this.tabContainer);
        }

        // Content area
        this.contentContainer = createElement('div', {
            className: 'axon-embed-content',
            style: {
                flex: '1',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }
        });

        container.appendChild(this.contentContainer);

        // Mount to target element
        targetElement.innerHTML = '';
        targetElement.appendChild(container);

        return container;
    }

    // Public methods
    public getClient(): AxonPulsClient {
        return this.client;
    }

    public getComponent(feature: string): AxonUIComponent | undefined {
        return this.components.get(feature);
    }

    public switchTab(feature: string): void {
        if (this.components.has(feature)) {
            this.activeTab = feature;
            this.renderComponents();
        }
    }

    public sendMessage(message: any): Promise<void> {
        return this.client.publish(this.config.channel, {
            type: 'embed_message',
            payload: message
        });
    }

    public on(event: string, handler: (data: any) => void): void {
        this.client.on(event, handler);
    }

    public destroy(): void {
        // Destroy all components
        this.components.forEach(component => component.destroy());
        this.components.clear();

        // Disconnect client
        if (this.client) {
            this.client.disconnect();
        }

        super.destroy();
    }
}

// Factory function for easy embedding
export async function createAxonEmbed(config: EmbedConfig): Promise<AxonEmbed> {
    const embed = new AxonEmbed(config);
    embed.render();
    return embed;
}

// Global mount function (for CDN usage)
if (typeof window !== 'undefined') {
    (window as any).AXONUI = {
        ...(window as any).AXONUI,
        createEmbed: createAxonEmbed,
        AxonEmbed
    };
}
