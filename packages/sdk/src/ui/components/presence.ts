/**
 * AxonPresence - Real-time Presence Component
 * 
 * Features:
 * - User online/offline status
 * - Avatars and status indicators
 * - Real-time user list
 * - Custom status messages
 * - Activity indicators
 */

import { AxonUIComponent, type ComponentConfig, createElement } from '../index';
import type { AxonPulsEvent, AxonPulsClient } from '../../core/client';

interface PresenceUser {
    id: string;
    name: string;
    avatar?: string;
    status?: 'online' | 'away' | 'busy' | 'offline';
    lastSeen?: string;
    metadata?: any;
}

export interface PresenceConfig extends ComponentConfig {
    room: string;
    client: AxonPulsClient;
    currentUser?: { id: string; name: string; avatar?: string; status?: string };
    showAvatars?: boolean;
    showStatus?: boolean;
}

export class AxonPresence extends AxonUIComponent {
    public config: PresenceConfig;
    private users: PresenceUser[] = [];
    private userListContainer!: HTMLElement;
    private onlineCountElement!: HTMLElement;
    private eventHandler: ((event: AxonPulsEvent) => void) | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private isJoined = false;

    constructor(config: PresenceConfig) {
        super(config);
        this.config = {
            showAvatars: true,
            showStatus: true,
            currentUser: {
                id: `user-${Date.now()}`,
                name: 'Anonymous',
                status: 'online'
            },
            ...config
        };
        this.setupPresence();
    }

    private setupPresence(): void {
        const presenceChannel = `presence:${this.config.room}`;

        this.eventHandler = (event: AxonPulsEvent) => {
            if (event.metadata?.channel !== presenceChannel &&
                !event.type.startsWith('user_') &&
                !event.type.startsWith('presence_')) {
                return;
            }

            switch (event.type) {
                case 'user_joined':
                    this.handleUserJoined(event.payload.user);
                    break;
                case 'user_left':
                    this.handleUserLeft(event.payload.user);
                    break;
                case 'user_status_changed':
                    this.handleUserStatusChanged(event.payload.user);
                    break;
                case 'presence_update':
                    this.handlePresenceUpdate(event.payload.users || []);
                    break;
            }
        };

        this.config.client.on('event', this.eventHandler);

        // Subscribe to presence channel
        this.config.client.subscribe([presenceChannel]).then(() => {
            this.isJoined = true;

            // Announce current user
            if (this.config.currentUser) {
                this.announcePresence('join');
            }

            // Set up heartbeat to maintain presence
            this.startHeartbeat();

            if (this.config.debug) {
                console.log(`[AxonPresence] Joined presence room: ${this.config.room}`);
            }
        }).catch((error) => {
            console.error('[AxonPresence] Failed to join presence room:', error);
        });
    }

    private startHeartbeat(): void {
        // Send heartbeat every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            if (this.config.currentUser && this.isJoined) {
                this.announcePresence('heartbeat');
            }
        }, 30000);
    }

    private announcePresence(type: 'join' | 'leave' | 'heartbeat' | 'status_change'): void {
        if (!this.config.currentUser) return;

        const presenceChannel = `presence:${this.config.room}`;

        let eventType = 'user_joined';
        if (type === 'leave') eventType = 'user_left';
        else if (type === 'heartbeat') eventType = 'user_heartbeat';
        else if (type === 'status_change') eventType = 'user_status_changed';

        this.config.client.publish(presenceChannel, {
            type: eventType,
            payload: {
                user: {
                    ...this.config.currentUser,
                    lastSeen: new Date().toISOString()
                }
            }
        }).catch((error) => {
            if (this.config.debug) {
                console.warn(`[AxonPresence] Failed to announce ${type}:`, error);
            }
        });
    }

    private handleUserJoined(user: PresenceUser): void {
        if (user.id === this.config.currentUser?.id) return;

        const existingIndex = this.users.findIndex(u => u.id === user.id);
        if (existingIndex !== -1) {
            this.users[existingIndex] = { ...this.users[existingIndex], ...user };
        } else {
            this.users.push(user);
        }

        this.renderUserList();
    }

    private handleUserLeft(user: PresenceUser): void {
        if (user.id === this.config.currentUser?.id) return;

        this.users = this.users.filter(u => u.id !== user.id);
        this.renderUserList();
    }

    private handleUserStatusChanged(user: PresenceUser): void {
        const existingIndex = this.users.findIndex(u => u.id === user.id);
        if (existingIndex !== -1) {
            this.users[existingIndex] = { ...this.users[existingIndex], ...user };
            this.renderUserList();
        }
    }

    private handlePresenceUpdate(users: PresenceUser[]): void {
        // Filter out current user from the list
        this.users = users.filter(u => u.id !== this.config.currentUser?.id);
        this.renderUserList();
    }

    private getStatusColor(status?: string): string {
        switch (status) {
            case 'online': return this.theme.success;
            case 'away': return this.theme.warning;
            case 'busy': return this.theme.danger;
            case 'offline': return this.theme.textMuted;
            default: return this.theme.success;
        }
    }

    private getStatusEmoji(status?: string): string {
        switch (status) {
            case 'online': return '🟢';
            case 'away': return '🟡';
            case 'busy': return '🔴';
            case 'offline': return '⚫';
            default: return '🟢';
        }
    }

    private renderUserList(): void {
        // Update online count
        const onlineUsers = this.users.filter(u => u.status !== 'offline');
        const totalOnline = onlineUsers.length + (this.config.currentUser ? 1 : 0);
        this.onlineCountElement.textContent = `${totalOnline} online`;

        // Clear existing list
        this.userListContainer.innerHTML = '';

        // Add current user first (if configured)
        if (this.config.currentUser) {
            this.userListContainer.appendChild(this.createUserElement({
                ...this.config.currentUser,
                name: `${this.config.currentUser.name} (you)`,
                status: this.config.currentUser.status as PresenceUser['status']
            }, true));
        }

        // Sort users by status and name
        const sortedUsers = [...this.users].sort((a, b) => {
            // Online users first
            const aOnline = a.status !== 'offline';
            const bOnline = b.status !== 'offline';
            if (aOnline !== bOnline) return bOnline ? 1 : -1;

            // Then by name
            return a.name.localeCompare(b.name);
        });

        // Add other users
        sortedUsers.forEach(user => {
            this.userListContainer.appendChild(this.createUserElement(user));
        });
    }

    private createUserElement(user: PresenceUser, isCurrentUser = false): HTMLElement {
        const userEl = createElement('div', {
            className: 'axon-presence-user',
            style: {
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: '6px',
                marginBottom: '2px',
                background: isCurrentUser ? 'var(--primary)' : 'transparent',
                color: isCurrentUser ? 'white' : 'var(--text)',
                transition: 'background-color 0.2s ease'
            }
        });

        this.applyTheme(userEl, userEl.style as any);

        // Avatar
        if (this.config.showAvatars) {
            const avatarEl = createElement('div', {
                className: 'axon-presence-avatar',
                style: {
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    marginRight: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    background: user.avatar ? `url(${user.avatar})` : 'var(--primary)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    color: 'white'
                }
            });

            this.applyTheme(avatarEl, avatarEl.style as any);

            if (!user.avatar) {
                avatarEl.textContent = user.name.charAt(0).toUpperCase();
            }

            userEl.appendChild(avatarEl);
        }

        // User info container
        const infoEl = createElement('div', {
            className: 'axon-presence-info',
            style: {
                flex: '1',
                minWidth: '0'
            }
        });

        // Name
        const nameEl = createElement('div', {
            className: 'axon-presence-name',
            style: {
                fontWeight: '500',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }
        }, [user.name]);

        infoEl.appendChild(nameEl);

        // Status (if enabled)
        if (this.config.showStatus && user.status) {
            const statusEl = createElement('div', {
                className: 'axon-presence-status',
                style: {
                    fontSize: '12px',
                    color: isCurrentUser ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    marginTop: '2px'
                }
            });

            const statusEmoji = createElement('span', {
                style: { marginRight: '4px' }
            }, [this.getStatusEmoji(user.status)]);

            const statusText = createElement('span', {}, [user.status]);

            statusEl.appendChild(statusEmoji);
            statusEl.appendChild(statusText);
            infoEl.appendChild(statusEl);
        }

        userEl.appendChild(infoEl);

        // Online indicator
        if (user.status !== 'offline') {
            const indicatorEl = createElement('div', {
                className: 'axon-presence-indicator',
                style: {
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: this.getStatusColor(user.status)
                }
            });

            userEl.appendChild(indicatorEl);
        }

        return userEl;
    }

    public render(): HTMLElement {
        const container = createElement('div', {
            className: `axon-presence ${this.config.className || ''}`,
            style: {
                width: '250px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: '14px',
                ...this.config.style
            }
        });

        this.applyTheme(container, container.style as any);

        // Header
        const header = createElement('div', {
            className: 'axon-presence-header',
            style: {
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                borderRadius: '8px 8px 0 0'
            }
        });

        this.applyTheme(header, header.style as any);

        const titleEl = createElement('div', {
            style: {
                fontWeight: '600',
                color: 'var(--text)',
                marginBottom: '4px'
            }
        }, [`👥 ${this.config.room}`]);

        this.applyTheme(titleEl, titleEl.style as any);

        this.onlineCountElement = createElement('div', {
            className: 'axon-presence-count',
            style: {
                fontSize: '12px',
                color: 'var(--text-muted)'
            }
        }, ['0 online']);

        this.applyTheme(this.onlineCountElement, this.onlineCountElement.style as any);

        header.appendChild(titleEl);
        header.appendChild(this.onlineCountElement);
        container.appendChild(header);

        // User list
        this.userListContainer = createElement('div', {
            className: 'axon-presence-list',
            style: {
                padding: '8px',
                maxHeight: '300px',
                overflowY: 'auto'
            }
        });

        container.appendChild(this.userListContainer);

        return container;
    }

    // Public methods
    public getUsers(): PresenceUser[] {
        return [...this.users];
    }

    public getOnlineUsers(): PresenceUser[] {
        return this.users.filter(u => u.status !== 'offline');
    }

    public getUsersByStatus(status: string): PresenceUser[] {
        return this.users.filter(u => u.status === status);
    }

    public updateStatus(status: 'online' | 'away' | 'busy' | 'offline'): void {
        if (this.config.currentUser) {
            this.config.currentUser.status = status;
            this.announcePresence('status_change');
            this.renderUserList();
        }
    }

    public destroy(): void {
        if (this.eventHandler) {
            this.config.client.off('event', this.eventHandler);
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        if (this.isJoined && this.config.currentUser) {
            this.announcePresence('leave');
        }

        if (this.isJoined) {
            const presenceChannel = `presence:${this.config.room}`;
            this.config.client.unsubscribe([presenceChannel]);
        }

        super.destroy();
    }
}
