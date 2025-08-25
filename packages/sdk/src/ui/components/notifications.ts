/**
 * AxonNotifications - Real-time Notification System
 * 
 * Features:
 * - Toast notifications
 * - Persistent notification center
 * - Priority-based display
 * - Custom styling
 * - Auto-dismiss options
 */

import { AxonUIComponent, type ComponentConfig, createElement, formatTimestamp } from '../base';
import type { AxonPulsEvent, AxonPulsClient } from '../../core/client';

export interface NotificationConfig extends ComponentConfig {
    client: AxonPulsClient;
    channels?: string[];
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
    maxNotifications?: number;
    autoHide?: boolean;
    hideDelay?: number;
    enableSound?: boolean;
    filterTypes?: string[];
}

interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    channel?: string;
    persistent?: boolean;
    actions?: Array<{
        label: string;
        action: () => void;
        style?: 'primary' | 'secondary' | 'danger';
    }>;
}

export class AxonNotifications extends AxonUIComponent {
    public config: NotificationConfig;
    private notifications: Notification[] = [];
    private notificationContainer!: HTMLElement;
    private centerContainer!: HTMLElement;
    private eventHandler: ((event: AxonPulsEvent) => void) | null = null;
    private isSubscribed = false;
    private soundEnabled = false;

    constructor(config: NotificationConfig) {
        super(config);
        this.config = {
            position: 'top-right',
            maxNotifications: 5,
            autoHide: true,
            hideDelay: 5000,
            enableSound: false,
            channels: [],
            filterTypes: [],
            ...config
        };

        this.soundEnabled = this.config.enableSound || false;
        this.setupNotifications();
    }

    private setupNotifications(): void {
        this.eventHandler = (event: AxonPulsEvent) => {
            // Filter by channels if specified
            if (this.config.channels?.length &&
                !this.config.channels.includes(event.metadata?.channel || '')) {
                return;
            }

            // Filter by types if specified
            if (this.config.filterTypes?.length &&
                !this.config.filterTypes.includes(event.type)) {
                return;
            }

            this.handleNotificationEvent(event);
        };

        this.config.client.on('event', this.eventHandler);

        // Subscribe to notification channels
        if (this.config.channels?.length) {
            this.config.client.subscribe(this.config.channels).then(() => {
                this.isSubscribed = true;

                if (this.config.debug) {
                    console.log('[AxonNotifications] Subscribed to channels:', this.config.channels);
                }
            }).catch((error) => {
                console.error('[AxonNotifications] Failed to subscribe to channels:', error);
            });
        }
    }

    private handleNotificationEvent(event: AxonPulsEvent): void {
        let notification: Notification;

        // Handle different event types
        if (event.type === 'notification') {
            notification = this.parseNotificationPayload(event.payload);
        } else {
            // Convert regular events to notifications
            notification = this.eventToNotification(event);
        }

        this.addNotification(notification);
    }

    private parseNotificationPayload(payload: any): Notification {
        return {
            id: payload.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: payload.type || 'info',
            title: payload.title || 'Notification',
            message: payload.message || '',
            timestamp: payload.timestamp || new Date().toISOString(),
            priority: payload.priority || 'medium',
            channel: payload.channel,
            persistent: payload.persistent || false,
            actions: payload.actions || []
        };
    }

    private eventToNotification(event: AxonPulsEvent): Notification {
        let type: Notification['type'] = 'info';
        let title = 'Event Received';
        let message = '';

        // Infer notification type from event type
        if (event.type.includes('error') || event.type.includes('failed')) {
            type = 'error';
            title = 'Error';
        } else if (event.type.includes('success') || event.type.includes('completed')) {
            type = 'success';
            title = 'Success';
        } else if (event.type.includes('warning') || event.type.includes('alert')) {
            type = 'warning';
            title = 'Warning';
        }

        // Extract message from payload
        if (typeof event.payload === 'string') {
            message = event.payload;
        } else if (event.payload?.message) {
            message = event.payload.message;
        } else if (event.payload?.text) {
            message = event.payload.text;
        } else {
            message = JSON.stringify(event.payload);
        }

        return {
            id: `event-${event.id}`,
            type,
            title,
            message,
            timestamp: new Date(event.timestamp).toISOString(),
            channel: event.metadata?.channel,
            persistent: false
        };
    }

    private addNotification(notification: Notification): void {
        // Add to list
        this.notifications.unshift(notification);

        // Limit notifications
        if (this.notifications.length > this.config.maxNotifications!) {
            this.notifications = this.notifications.slice(0, this.config.maxNotifications);
        }

        // Play sound if enabled
        if (this.soundEnabled && notification.type !== 'info') {
            this.playNotificationSound(notification.type);
        }

        // Render toast
        this.renderToast(notification);

        // Update notification center
        this.renderNotificationCenter();
    }

    private playNotificationSound(type: string): void {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Different frequencies for different types
            const frequencies = {
                success: 800,
                warning: 600,
                error: 400,
                info: 500
            };

            oscillator.frequency.setValueAtTime(frequencies[type as keyof typeof frequencies] || 500, audioContext.currentTime);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            // Sound failed, continue silently
        }
    }

    private renderToast(notification: Notification): void {
        const toast = this.createToastElement(notification);
        this.notificationContainer.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        }, 10);

        // Auto-hide if enabled
        if (this.config.autoHide && !notification.persistent) {
            setTimeout(() => {
                this.removeToast(toast);
            }, this.config.hideDelay);
        }
    }

    private createToastElement(notification: Notification): HTMLElement {
        const colors = {
            info: { bg: this.theme.primary, icon: 'ℹ️' },
            success: { bg: this.theme.success, icon: '✅' },
            warning: { bg: this.theme.warning, icon: '⚠️' },
            error: { bg: this.theme.danger, icon: '❌' }
        };

        const color = colors[notification.type];

        const toast = createElement('div', {
            className: 'axon-notification-toast',
            style: {
                background: 'var(--bg)',
                border: `1px solid ${color.bg}`,
                borderLeft: `4px solid ${color.bg}`,
                borderRadius: '6px',
                padding: '12px 16px',
                marginBottom: '8px',
                boxShadow: 'var(--shadow)',
                transform: this.getToastTransform(),
                opacity: '0',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                maxWidth: '350px',
                wordWrap: 'break-word'
            }
        });

        this.applyTheme(toast, toast.style as any);

        // Header
        const header = createElement('div', {
            style: {
                display: 'flex',
                alignItems: 'center',
                marginBottom: '8px'
            }
        });

        const icon = createElement('span', {
            style: {
                fontSize: '16px',
                marginRight: '8px'
            }
        }, [color.icon]);

        const title = createElement('span', {
            style: {
                fontWeight: '600',
                color: 'var(--text)',
                flex: '1'
            }
        }, [notification.title]);

        this.applyTheme(title, title.style as any);

        const closeBtn = createElement('button', {
            style: {
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '18px',
                padding: '0',
                marginLeft: '8px'
            }
        }, ['×']);

        this.applyTheme(closeBtn, closeBtn.style as any);

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeToast(toast);
        });

        header.appendChild(icon);
        header.appendChild(title);
        header.appendChild(closeBtn);
        toast.appendChild(header);

        // Message
        if (notification.message) {
            const message = createElement('div', {
                style: {
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    marginBottom: notification.actions?.length ? '12px' : '0'
                }
            }, [notification.message]);

            this.applyTheme(message, message.style as any);
            toast.appendChild(message);
        }

        // Actions
        if (notification.actions?.length) {
            const actionsContainer = createElement('div', {
                style: {
                    display: 'flex',
                    gap: '8px',
                    marginTop: '8px'
                }
            });

            notification.actions.forEach(action => {
                const button = createElement('button', {
                    style: {
                        padding: '6px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        background: action.style === 'primary' ? color.bg : 'transparent',
                        color: action.style === 'primary' ? 'white' : 'var(--text)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500'
                    }
                }, [action.label]);

                this.applyTheme(button, button.style as any);

                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    action.action();
                    this.removeToast(toast);
                });

                actionsContainer.appendChild(button);
            });

            toast.appendChild(actionsContainer);
        }

        // Footer with timestamp
        const footer = createElement('div', {
            style: {
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: '8px',
                textAlign: 'right'
            }
        }, [formatTimestamp(notification.timestamp)]);

        this.applyTheme(footer, footer.style as any);
        toast.appendChild(footer);

        return toast;
    }

    private getToastTransform(): string {
        const position = this.config.position!;
        if (position.includes('right')) return 'translateX(100%)';
        if (position.includes('left')) return 'translateX(-100%)';
        if (position.includes('top')) return 'translateY(-100%)';
        if (position.includes('bottom')) return 'translateY(100%)';
        return 'translateX(100%)';
    }

    private removeToast(toast: HTMLElement): void {
        toast.style.transform = this.getToastTransform();
        toast.style.opacity = '0';

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    private renderNotificationCenter(): void {
        if (!this.centerContainer) return;

        this.centerContainer.innerHTML = '';

        if (this.notifications.length === 0) {
            const empty = createElement('div', {
                style: {
                    padding: '20px',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                }
            }, ['No notifications']);

            this.applyTheme(empty, empty.style as any);
            this.centerContainer.appendChild(empty);
            return;
        }

        this.notifications.forEach(notification => {
            const item = this.createCenterItem(notification);
            this.centerContainer.appendChild(item);
        });
    }

    private createCenterItem(notification: Notification): HTMLElement {
        const colors = {
            info: '🔵',
            success: '🟢',
            warning: '🟡',
            error: '🔴'
        };

        const item = createElement('div', {
            className: 'axon-notification-item',
            style: {
                padding: '12px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
            }
        });

        this.applyTheme(item, item.style as any);

        item.addEventListener('mouseenter', () => {
            item.style.background = 'var(--surface)';
        });

        item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
        });

        const header = createElement('div', {
            style: {
                display: 'flex',
                alignItems: 'center',
                marginBottom: '4px'
            }
        });

        const icon = createElement('span', {
            style: { marginRight: '8px' }
        }, [colors[notification.type]]);

        const title = createElement('span', {
            style: {
                fontWeight: '500',
                color: 'var(--text)',
                flex: '1'
            }
        }, [notification.title]);

        this.applyTheme(title, title.style as any);

        const time = createElement('span', {
            style: {
                fontSize: '11px',
                color: 'var(--text-muted)'
            }
        }, [formatTimestamp(notification.timestamp)]);

        this.applyTheme(time, time.style as any);

        header.appendChild(icon);
        header.appendChild(title);
        header.appendChild(time);
        item.appendChild(header);

        if (notification.message) {
            const message = createElement('div', {
                style: {
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    lineHeight: '1.4'
                }
            }, [notification.message]);

            this.applyTheme(message, message.style as any);
            item.appendChild(message);
        }

        return item;
    }

    public render(): HTMLElement {
        // Create toast container
        this.notificationContainer = createElement('div', {
            className: 'axon-notifications-container',
            style: {
                position: 'fixed',
                zIndex: '10000',
                pointerEvents: 'none',
                ...this.getPositionStyles()
            }
        });

        this.notificationContainer.style.pointerEvents = 'none';
        this.notificationContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Make toast elements interactive
        const style = document.createElement('style');
        style.textContent = `
      .axon-notification-toast {
        pointer-events: auto !important;
      }
    `;
        document.head.appendChild(style);

        document.body.appendChild(this.notificationContainer);

        // Create notification center (returns this for mounting)
        const center = createElement('div', {
            className: `axon-notifications-center ${this.config.className || ''}`,
            style: {
                width: '350px',
                height: '400px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: '14px',
                display: 'flex',
                flexDirection: 'column',
                ...this.config.style
            }
        });

        this.applyTheme(center, center.style as any);

        // Header
        const header = createElement('div', {
            style: {
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                borderRadius: '8px 8px 0 0',
                fontWeight: '600',
                color: 'var(--text)'
            }
        }, ['🔔 Notifications']);

        this.applyTheme(header, header.style as any);

        // Content
        this.centerContainer = createElement('div', {
            style: {
                flex: '1',
                overflow: 'auto'
            }
        });

        center.appendChild(header);
        center.appendChild(this.centerContainer);

        this.renderNotificationCenter();

        return center;
    }

    private getPositionStyles(): Record<string, string> {
        const position = this.config.position!;
        const styles: Record<string, string> = {};

        if (position.includes('top')) styles.top = '20px';
        if (position.includes('bottom')) styles.bottom = '20px';
        if (position.includes('left')) styles.left = '20px';
        if (position.includes('right')) styles.right = '20px';
        if (position.includes('center')) styles.left = '50%';

        return styles;
    }

    // Public methods
    public addManualNotification(notification: Omit<Notification, 'id' | 'timestamp'>): void {
        const fullNotification: Notification = {
            ...notification,
            id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString()
        };

        this.addNotification(fullNotification);
    }

    public clearNotifications(): void {
        this.notifications = [];
        this.renderNotificationCenter();

        // Clear toasts
        Array.from(this.notificationContainer.children).forEach(toast => {
            this.removeToast(toast as HTMLElement);
        });
    }

    public getNotifications(): Notification[] {
        return [...this.notifications];
    }

    public toggleSound(): void {
        this.soundEnabled = !this.soundEnabled;
    }

    public destroy(): void {
        if (this.eventHandler) {
            this.config.client.off('event', this.eventHandler);
        }

        if (this.isSubscribed && this.config.channels?.length) {
            this.config.client.unsubscribe(this.config.channels);
        }

        if (this.notificationContainer && this.notificationContainer.parentNode) {
            this.notificationContainer.parentNode.removeChild(this.notificationContainer);
        }

        super.destroy();
    }
}
