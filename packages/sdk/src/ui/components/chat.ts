/**
 * AxonChat - Real-time Chat Component
 * 
 * Features:
 * - Real-time messaging
 * - Message history
 * - Typing indicators
 * - Message formatting
 * - Custom themes
 */

import { AxonUIComponent, type ComponentConfig, createElement, formatTimestamp, sanitizeHtml } from '../base';
import type { AxonPulsEvent, AxonPulsClient } from '../../core/client';
import { getChatConfig } from '../../config/ui-config';

export interface ChatConfig extends ComponentConfig {
    channel: string;
    client: AxonPulsClient;
    placeholder?: string;
    showTimestamps?: boolean;
    showTypes?: boolean;
    maxMessages?: number;
    enableInput?: boolean;
}

export class AxonChat extends AxonUIComponent {
    public config: ChatConfig;
    private messages: AxonPulsEvent[] = [];
    private messagesContainer!: HTMLElement;
    private inputElement!: HTMLInputElement;
    private sendButton!: HTMLButtonElement;
    private eventHandler: ((event: AxonPulsEvent) => void) | null = null;
    private isSubscribed = false;

    constructor(config: ChatConfig) {
        super(config);
        const chatDefaults = getChatConfig();
        this.config = {
            placeholder: chatDefaults.placeholder,
            showTimestamps: chatDefaults.showTimestamps,
            showTypes: chatDefaults.showTypes,
            maxMessages: chatDefaults.maxMessages,
            enableInput: chatDefaults.enableInput,
            ...config
        };
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        this.eventHandler = (event: AxonPulsEvent) => {
            if (event.metadata?.channel === this.config.channel || !event.metadata?.channel) {
                this.addMessage(event);
            }
        };

        this.config.client.on('event', this.eventHandler);

        // Subscribe to channel
        this.config.client.subscribe([this.config.channel]).then(() => {
            this.isSubscribed = true;
            if (this.config.debug) {
                console.log(`[AxonChat] Subscribed to channel: ${this.config.channel}`);
            }
        }).catch((error) => {
            console.error('[AxonChat] Failed to subscribe to channel:', error);
        });
    }

    private addMessage(event: AxonPulsEvent): void {
        this.messages.push(event);

        // Limit message history
        if (this.messages.length > this.config.maxMessages!) {
            this.messages = this.messages.slice(-this.config.maxMessages!);
        }

        this.renderMessage(event);
        this.scrollToBottom();
    }

    private renderMessage(event: AxonPulsEvent): void {
        const messageEl = createElement('div', {
            className: 'axon-message',
            style: {
                marginBottom: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                wordWrap: 'break-word'
            }
        });

        this.applyTheme(messageEl, messageEl.style as any);

        // Message header
        const headerEl = createElement('div', {
            className: 'axon-message-header',
            style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
                fontSize: '12px',
                color: 'var(--text-muted)'
            }
        });

        this.applyTheme(headerEl, headerEl.style as any);

        // Message type (if enabled)
        if (this.config.showTypes) {
            const typeEl = createElement('span', {
                className: 'axon-message-type',
                style: {
                    fontWeight: '600',
                    color: 'var(--primary)'
                }
            }, [event.type]);
            this.applyTheme(typeEl, typeEl.style as any);
            headerEl.appendChild(typeEl);
        }

        // Timestamp (if enabled)
        if (this.config.showTimestamps) {
            const timestampEl = createElement('span', {
                className: 'axon-message-timestamp'
            }, [formatTimestamp(event.timestamp)]);
            headerEl.appendChild(timestampEl);
        }

        messageEl.appendChild(headerEl);

        // Message content
        const contentEl = createElement('div', {
            className: 'axon-message-content',
            style: {
                color: 'var(--text)',
                lineHeight: '1.4'
            }
        });

        this.applyTheme(contentEl, contentEl.style as any);

        // Format payload based on type
        let content = '';
        if (typeof event.payload === 'string') {
            content = sanitizeHtml(event.payload);
        } else if (event.payload?.text) {
            content = sanitizeHtml(event.payload.text);
        } else {
            content = `<pre style="margin:0;font-family:monospace;font-size:11px;">${JSON.stringify(event.payload, null, 2)}</pre>`;
        }

        contentEl.innerHTML = content;
        messageEl.appendChild(contentEl);

        this.messagesContainer.appendChild(messageEl);
    }

    private scrollToBottom(): void {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    private sendMessage(): void {
        const message = this.inputElement.value.trim();
        if (!message || !this.isSubscribed) return;

        this.config.client.publish(this.config.channel, {
            type: 'chat_message',
            payload: {
                text: message,
                timestamp: new Date().toISOString(),
                user: 'User' // Could be enhanced with user context
            }
        }).then(() => {
            this.inputElement.value = '';
        }).catch((error) => {
            console.error('[AxonChat] Failed to send message:', error);
        });
    }

    public render(): HTMLElement {
        const container = createElement('div', {
            className: `axon-chat ${this.config.className || ''}`,
            style: {
                display: 'flex',
                flexDirection: 'column',
                height: '400px',
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--bg)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: '14px',
                boxShadow: 'var(--shadow)',
                ...this.config.style
            }
        });

        this.applyTheme(container, container.style as any);

        // Header
        const header = createElement('div', {
            className: 'axon-chat-header',
            style: {
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                borderRadius: '8px 8px 0 0',
                fontWeight: '600',
                color: 'var(--text)'
            }
        }, [`💬 ${this.config.channel}`]);

        this.applyTheme(header, header.style as any);
        container.appendChild(header);

        // Messages container
        this.messagesContainer = createElement('div', {
            className: 'axon-chat-messages',
            style: {
                flex: '1',
                overflow: 'auto',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }
        });

        container.appendChild(this.messagesContainer);

        // Input area (if enabled)
        if (this.config.enableInput) {
            const inputContainer = createElement('div', {
                className: 'axon-chat-input',
                style: {
                    padding: '12px',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--surface)',
                    borderRadius: '0 0 8px 8px',
                    display: 'flex',
                    gap: '8px'
                }
            });

            this.applyTheme(inputContainer, inputContainer.style as any);

            this.inputElement = createElement('input', {
                type: 'text',
                placeholder: this.config.placeholder,
                style: {
                    flex: '1',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    outline: 'none',
                    fontSize: '14px'
                }
            }) as HTMLInputElement;

            this.applyTheme(this.inputElement, this.inputElement.style as any);

            this.inputElement.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });

            this.sendButton = createElement('button', {
                style: {
                    padding: '8px 16px',
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                }
            }, ['Send']) as HTMLButtonElement;

            this.applyTheme(this.sendButton, this.sendButton.style as any);

            this.sendButton.addEventListener('click', () => this.sendMessage());

            inputContainer.appendChild(this.inputElement);
            inputContainer.appendChild(this.sendButton);
            container.appendChild(inputContainer);
        }

        return container;
    }

    // Public methods
    public clearMessages(): void {
        this.messages = [];
        this.messagesContainer.innerHTML = '';
    }

    public getMessages(): AxonPulsEvent[] {
        return [...this.messages];
    }

    public getMessageCount(): number {
        return this.messages.length;
    }

    public focus(): void {
        if (this.inputElement) {
            this.inputElement.focus();
        }
    }

    public destroy(): void {
        if (this.eventHandler) {
            this.config.client.off('event', this.eventHandler);
        }

        if (this.isSubscribed) {
            this.config.client.unsubscribe([this.config.channel]);
        }

        super.destroy();
    }
}
