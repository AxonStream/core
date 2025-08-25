/**
 * Embed Helper - AXONUI.mount({ el, token, channel })
 * 
 * Single embed function that "just works"
 */

import { AxonPulsClient } from './core/client';

export interface EmbedConfig {
    el: string | HTMLElement;
    token: string;
    channel: string;
    org?: string;
    theme?: 'light' | 'dark' | 'auto';
    features?: Array<'chat' | 'presence' | 'hitl' | 'notifications'>;
}

export class AxonEmbed {
    private client: AxonPulsClient;

    constructor(client?: AxonPulsClient) {
        this.client = client || new AxonPulsClient({
            url: 'ws://localhost:3001',
            token: '',
            autoReconnect: true
        });
    }

    /**
     * ONE-LINE EMBED: AXONUI.mount({ el, token, channel })
     */
    async mount(config: EmbedConfig): Promise<{
        disconnect: () => void;
        send: (message: any) => void;
        on: (event: string, handler: (data: any) => void) => void;
    }> {
        // Configure client if needed
        if (!this.client.isConnected()) {
            this.client = new AxonPulsClient({
                url: config.org ? `wss://${config.org}.axonstream.ai` : 'ws://localhost:3001',
                token: config.token,
                autoReconnect: true,
                debug: true
            });

            await this.client.connect();
        }

        // Subscribe to channel
        await this.client.subscribe([config.channel]);

        // Find element
        const el = typeof config.el === 'string' ? document.querySelector(config.el) : config.el;
        if (!el) throw new Error(`Element not found: ${config.el}`);

        // Create themed UI
        const theme = config.theme || 'light';
        const themeColors = {
            light: { bg: '#ffffff', border: '#e1e5e9', text: '#24292e' },
            dark: { bg: '#0d1117', border: '#30363d', text: '#f0f6fc' },
            auto: window.matchMedia('(prefers-color-scheme: dark)').matches ?
                { bg: '#0d1117', border: '#30363d', text: '#f0f6fc' } :
                { bg: '#ffffff', border: '#e1e5e9', text: '#24292e' }
        }[theme];

        el.innerHTML = `
      <div style="
        background: ${themeColors.bg}; 
        color: ${themeColors.text}; 
        border: 1px solid ${themeColors.border}; 
        padding: 20px; 
        border-radius: 8px; 
        max-width: 400px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ">
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
          <div style="width: 8px; height: 8px; background: #28a745; border-radius: 50%; margin-right: 8px;"></div>
          <strong>AXONPULS Live • ${config.channel}</strong>
        </div>
        <div id="axon-messages" style="
          height: 200px; 
          overflow-y: auto; 
          border: 1px solid ${themeColors.border}; 
          padding: 10px; 
          margin-bottom: 10px;
          background: ${theme === 'dark' ? '#161b22' : '#f6f8fa'};
          border-radius: 4px;
        "></div>
        ${config.features?.includes('chat') !== false ? `
          <div style="display: flex; gap: 8px;">
            <input 
              id="axon-input" 
              type="text" 
              placeholder="Type a message..." 
              style="
                flex: 1; 
                padding: 8px 12px; 
                border: 1px solid ${themeColors.border}; 
                border-radius: 4px;
                background: ${themeColors.bg};
                color: ${themeColors.text};
                outline: none;
              "
            >
            <button 
              id="axon-send" 
              style="
                padding: 8px 16px; 
                background: #0969da; 
                color: white; 
                border: none; 
                border-radius: 4px; 
                cursor: pointer;
              "
            >Send</button>
          </div>
        ` : ''}
      </div>
    `;

        const messagesDiv = el.querySelector('#axon-messages');
        const messageInput = el.querySelector('#axon-input') as HTMLInputElement;
        const sendButton = el.querySelector('#axon-send');

        // Handle incoming events
        const eventHandler = (event: any) => {
            const messageEl = document.createElement('div');
            messageEl.style.marginBottom = '8px';
            messageEl.style.padding = '8px';
            messageEl.style.borderRadius = '4px';
            messageEl.style.background = theme === 'dark' ? '#21262d' : '#ffffff';
            messageEl.innerHTML = `
        <div style="font-size: 12px; opacity: 0.7; margin-bottom: 4px;">
          ${new Date().toLocaleTimeString()} • ${event.type}
        </div>
        <div>${typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload, null, 2)}</div>
      `;
            messagesDiv?.appendChild(messageEl);
            messagesDiv?.scrollTo(0, messagesDiv.scrollHeight);
        };

        this.client.on('event', eventHandler);

        // Handle sending messages
        const sendMessage = () => {
            if (messageInput && messageInput.value.trim()) {
                this.client.publish(config.channel, {
                    type: 'chat_message',
                    payload: { text: messageInput.value, timestamp: new Date().toISOString() }
                });
                messageInput.value = '';
            }
        };

        sendButton?.addEventListener('click', sendMessage);
        messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        return {
            disconnect: () => {
                this.client.off('event', eventHandler);
                this.client.disconnect();
            },
            send: (message) => {
                this.client.publish(config.channel, {
                    type: 'custom_message',
                    payload: message
                });
            },
            on: (event, handler) => {
                this.client.on(event, handler);
            }
        };
    }
}

// Export factory function
export function mount(config: EmbedConfig) {
    const embed = new AxonEmbed();
    return embed.mount(config);
}
