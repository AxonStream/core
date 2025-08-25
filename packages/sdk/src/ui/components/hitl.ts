/**
 * AxonHITL - Human-in-the-Loop Component
 * 
 * Features:
 * - Approval workflows
 * - Priority-based queue
 * - Real-time notifications
 * - Response tracking
 * - Escalation handling
 */

import { AxonUIComponent, type ComponentConfig, createElement, formatTimestamp } from '../base';
import type { AxonPulsEvent, AxonPulsClient } from '../../core/client';

interface HITLRequest {
    id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    type: string;
    requester?: {
        id: string;
        name: string;
        email?: string;
    };
    metadata?: any;
    createdAt: string;
    expiresAt?: string;
    context?: any;
}

interface HITLResponse {
    requestId: string;
    action: 'approve' | 'reject' | 'escalate' | 'request_info';
    comment?: string;
    respondedBy: {
        id: string;
        name: string;
        role: string;
    };
    timestamp: string;
}

export interface HITLConfig extends ComponentConfig {
    department: string;
    client: AxonPulsClient;
    currentUser?: { id: string; name: string; role: string };
    autoAcceptRoles?: string[];
    showPriority?: boolean;
}

export class AxonHITL extends AxonUIComponent {
    public config: HITLConfig;
    private pendingRequests: HITLRequest[] = [];
    private activeRequest: HITLRequest | null = null;
    private requestHistory: HITLRequest[] = [];
    private requestListContainer!: HTMLElement;
    private detailContainer!: HTMLElement;
    private counterElement!: HTMLElement;
    private eventHandler: ((event: AxonPulsEvent) => void) | null = null;
    private isSubscribed = false;

    constructor(config: HITLConfig) {
        super(config);
        this.config = {
            autoAcceptRoles: [],
            showPriority: true,
            currentUser: {
                id: `user-${Date.now()}`,
                name: 'Anonymous',
                role: 'reviewer'
            },
            ...config
        };
        this.setupHITL();
    }

    private setupHITL(): void {
        const hitlChannel = `hitl:${this.config.department}`;

        this.eventHandler = (event: AxonPulsEvent) => {
            if (event.metadata?.channel !== hitlChannel && !event.type.startsWith('hitl_')) {
                return;
            }

            switch (event.type) {
                case 'hitl_request':
                    this.handleNewRequest(event.payload);
                    break;
                case 'hitl_response':
                    this.handleResponse(event.payload);
                    break;
                case 'hitl_request_update':
                    this.handleRequestUpdate(event.payload);
                    break;
                case 'hitl_request_expired':
                    this.handleRequestExpired(event.payload);
                    break;
            }
        };

        this.config.client.on('event', this.eventHandler);

        // Subscribe to HITL channel
        this.config.client.subscribe([hitlChannel]).then(() => {
            this.isSubscribed = true;

            if (this.config.debug) {
                console.log(`[AxonHITL] Subscribed to department: ${this.config.department}`);
            }
        }).catch((error) => {
            console.error('[AxonHITL] Failed to subscribe to HITL channel:', error);
        });
    }

    private handleNewRequest(request: HITLRequest): void {
        // Check if user should auto-accept
        if (this.config.autoAcceptRoles?.includes(this.config.currentUser?.role || '')) {
            this.submitResponse({
                requestId: request.id,
                action: 'approve',
                comment: 'Auto-approved based on role permissions'
            });
            return;
        }

        this.pendingRequests.push(request);
        this.sortRequestsByPriority();
        this.renderRequestList();
        this.updateCounter();
    }

    private handleResponse(response: HITLResponse): void {
        // Remove from pending if it was responded to
        this.pendingRequests = this.pendingRequests.filter(r => r.id !== response.requestId);

        // Clear active if it matches
        if (this.activeRequest?.id === response.requestId) {
            this.activeRequest = null;
            this.renderRequestDetail();
        }

        this.renderRequestList();
        this.updateCounter();
    }

    private handleRequestUpdate(updatedRequest: HITLRequest): void {
        const index = this.pendingRequests.findIndex(r => r.id === updatedRequest.id);
        if (index !== -1) {
            this.pendingRequests[index] = { ...this.pendingRequests[index], ...updatedRequest };
            this.renderRequestList();
        }

        if (this.activeRequest?.id === updatedRequest.id) {
            this.activeRequest = { ...this.activeRequest, ...updatedRequest };
            this.renderRequestDetail();
        }
    }

    private handleRequestExpired(request: { id: string }): void {
        this.pendingRequests = this.pendingRequests.filter(r => r.id !== request.id);

        if (this.activeRequest?.id === request.id) {
            this.activeRequest = null;
            this.renderRequestDetail();
        }

        this.renderRequestList();
        this.updateCounter();
    }

    private sortRequestsByPriority(): void {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        this.pendingRequests.sort((a, b) => {
            const aPriority = priorityOrder[a.priority] || 0;
            const bPriority = priorityOrder[b.priority] || 0;
            if (aPriority !== bPriority) return bPriority - aPriority;

            // Sort by creation time (oldest first)
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
    }

    private getPriorityColor(priority: string): string {
        switch (priority) {
            case 'urgent': return this.theme.danger;
            case 'high': return '#ff8c00'; // Orange
            case 'medium': return this.theme.warning;
            case 'low': return this.theme.textMuted;
            default: return this.theme.textMuted;
        }
    }

    private getPriorityEmoji(priority: string): string {
        switch (priority) {
            case 'urgent': return '🚨';
            case 'high': return '⚡';
            case 'medium': return '⚠️';
            case 'low': return 'ℹ️';
            default: return 'ℹ️';
        }
    }

    private updateCounter(): void {
        const urgentCount = this.pendingRequests.filter(r => r.priority === 'urgent').length;
        const totalCount = this.pendingRequests.length;

        this.counterElement.innerHTML = urgentCount > 0
            ? `${totalCount} pending (${urgentCount} urgent)`
            : `${totalCount} pending`;
    }

    private renderRequestList(): void {
        this.requestListContainer.innerHTML = '';

        if (this.pendingRequests.length === 0) {
            const emptyEl = createElement('div', {
                className: 'axon-hitl-empty',
                style: {
                    padding: '20px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '14px'
                }
            }, ['✅ No pending requests']);

            this.applyTheme(emptyEl, emptyEl.style as any);
            this.requestListContainer.appendChild(emptyEl);
            return;
        }

        this.pendingRequests.forEach(request => {
            const requestEl = this.createRequestElement(request);
            this.requestListContainer.appendChild(requestEl);
        });
    }

    private createRequestElement(request: HITLRequest): HTMLElement {
        const isActive = this.activeRequest?.id === request.id;

        const requestEl = createElement('div', {
            className: 'axon-hitl-request',
            style: {
                padding: '12px',
                marginBottom: '8px',
                border: `1px solid ${isActive ? this.theme.primary : 'var(--border)'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                background: isActive ? 'rgba(13, 110, 253, 0.1)' : 'var(--surface)',
                transition: 'all 0.2s ease'
            }
        });

        this.applyTheme(requestEl, requestEl.style as any);

        requestEl.addEventListener('click', () => {
            this.activeRequest = request;
            this.renderRequestList();
            this.renderRequestDetail();
        });

        requestEl.addEventListener('mouseenter', () => {
            if (!isActive) {
                requestEl.style.background = 'var(--surface)';
                requestEl.style.borderColor = this.theme.primary;
            }
        });

        requestEl.addEventListener('mouseleave', () => {
            if (!isActive) {
                requestEl.style.background = 'var(--surface)';
                requestEl.style.borderColor = 'var(--border)';
            }
        });

        // Header with priority and title
        const headerEl = createElement('div', {
            style: {
                display: 'flex',
                alignItems: 'center',
                marginBottom: '8px'
            }
        });

        if (this.config.showPriority) {
            const priorityEl = createElement('span', {
                className: 'axon-hitl-priority',
                style: {
                    fontSize: '12px',
                    fontWeight: '600',
                    color: this.getPriorityColor(request.priority),
                    marginRight: '8px'
                }
            }, [`${this.getPriorityEmoji(request.priority)} ${request.priority.toUpperCase()}`]);

            headerEl.appendChild(priorityEl);
        }

        const titleEl = createElement('span', {
            className: 'axon-hitl-title',
            style: {
                fontWeight: '500',
                color: 'var(--text)',
                flex: '1'
            }
        }, [request.title]);

        this.applyTheme(titleEl, titleEl.style as any);
        headerEl.appendChild(titleEl);

        requestEl.appendChild(headerEl);

        // Description
        const descEl = createElement('div', {
            className: 'axon-hitl-description',
            style: {
                fontSize: '13px',
                color: 'var(--text-muted)',
                lineHeight: '1.4',
                marginBottom: '8px'
            }
        }, [request.description]);

        this.applyTheme(descEl, descEl.style as any);
        requestEl.appendChild(descEl);

        // Footer with timestamp and requester
        const footerEl = createElement('div', {
            style: {
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--text-muted)'
            }
        });

        this.applyTheme(footerEl, footerEl.style as any);

        const timeEl = createElement('span', {}, [formatTimestamp(request.createdAt)]);
        const requesterEl = createElement('span', {}, [request.requester?.name || 'Unknown']);

        footerEl.appendChild(timeEl);
        footerEl.appendChild(requesterEl);
        requestEl.appendChild(footerEl);

        return requestEl;
    }

    private renderRequestDetail(): void {
        this.detailContainer.innerHTML = '';

        if (!this.activeRequest) {
            const emptyEl = createElement('div', {
                className: 'axon-hitl-detail-empty',
                style: {
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                }
            }, ['Select a request to view details']);

            this.applyTheme(emptyEl, emptyEl.style as any);
            this.detailContainer.appendChild(emptyEl);
            return;
        }

        const request = this.activeRequest;

        // Header
        const headerEl = createElement('div', {
            style: {
                padding: '16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)'
            }
        });

        this.applyTheme(headerEl, headerEl.style as any);

        const titleEl = createElement('h3', {
            style: {
                margin: '0 0 8px 0',
                color: 'var(--text)',
                fontSize: '16px'
            }
        }, [request.title]);

        this.applyTheme(titleEl, titleEl.style as any);

        const metaEl = createElement('div', {
            style: {
                fontSize: '12px',
                color: 'var(--text-muted)'
            }
        }, [`${this.getPriorityEmoji(request.priority)} ${request.priority.toUpperCase()} • ${formatTimestamp(request.createdAt)}`]);

        this.applyTheme(metaEl, metaEl.style as any);

        headerEl.appendChild(titleEl);
        headerEl.appendChild(metaEl);
        this.detailContainer.appendChild(headerEl);

        // Content
        const contentEl = createElement('div', {
            style: {
                padding: '16px'
            }
        });

        const descEl = createElement('p', {
            style: {
                margin: '0 0 16px 0',
                lineHeight: '1.5',
                color: 'var(--text)'
            }
        }, [request.description]);

        this.applyTheme(descEl, descEl.style as any);
        contentEl.appendChild(descEl);

        // Context/metadata
        if (request.context || request.metadata) {
            const contextEl = createElement('div', {
                style: {
                    background: 'var(--surface)',
                    padding: '12px',
                    borderRadius: '4px',
                    marginBottom: '16px'
                }
            });

            this.applyTheme(contextEl, contextEl.style as any);

            const contextTitle = createElement('h4', {
                style: {
                    margin: '0 0 8px 0',
                    fontSize: '14px',
                    color: 'var(--text)'
                }
            }, ['Additional Context']);

            this.applyTheme(contextTitle, contextTitle.style as any);

            const contextPre = createElement('pre', {
                style: {
                    margin: '0',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace'
                }
            }, [JSON.stringify(request.context || request.metadata, null, 2)]);

            contextEl.appendChild(contextTitle);
            contextEl.appendChild(contextPre);
            contentEl.appendChild(contextEl);
        }

        // Action buttons
        const actionsEl = createElement('div', {
            style: {
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap'
            }
        });

        const approveBtn = this.createActionButton('✅ Approve', 'approve', this.theme.success);
        const rejectBtn = this.createActionButton('❌ Reject', 'reject', this.theme.danger);
        const escalateBtn = this.createActionButton('⬆️ Escalate', 'escalate', this.theme.warning);

        actionsEl.appendChild(approveBtn);
        actionsEl.appendChild(rejectBtn);
        actionsEl.appendChild(escalateBtn);

        contentEl.appendChild(actionsEl);
        this.detailContainer.appendChild(contentEl);
    }

    private createActionButton(text: string, action: 'approve' | 'reject' | 'escalate', color: string): HTMLElement {
        const button = createElement('button', {
            style: {
                padding: '8px 16px',
                background: color,
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
            }
        }, [text]) as HTMLButtonElement;

        button.addEventListener('click', () => {
            const comment = prompt(`Add a comment for ${action}:`);
            this.submitResponse({
                requestId: this.activeRequest!.id,
                action,
                comment: comment || undefined
            });
        });

        return button;
    }

    public submitResponse(response: Omit<HITLResponse, 'respondedBy' | 'timestamp'>): void {
        if (!this.config.currentUser) {
            console.warn('[AxonHITL] Cannot submit response: no current user configured');
            return;
        }

        const fullResponse: HITLResponse = {
            ...response,
            respondedBy: this.config.currentUser,
            timestamp: new Date().toISOString()
        };

        const hitlChannel = `hitl:${this.config.department}`;

        this.config.client.publish(hitlChannel, {
            type: 'hitl_response',
            payload: fullResponse
        }).catch((error) => {
            console.error('[AxonHITL] Failed to submit response:', error);
        });
    }

    public render(): HTMLElement {
        const container = createElement('div', {
            className: `axon-hitl ${this.config.className || ''}`,
            style: {
                display: 'flex',
                height: '500px',
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

        // Left panel - Request list
        const leftPanel = createElement('div', {
            className: 'axon-hitl-list-panel',
            style: {
                width: '300px',
                borderRight: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column'
            }
        });

        this.applyTheme(leftPanel, leftPanel.style as any);

        // List header
        const listHeader = createElement('div', {
            style: {
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                borderRadius: '8px 0 0 0'
            }
        });

        this.applyTheme(listHeader, listHeader.style as any);

        const titleEl = createElement('div', {
            style: {
                fontWeight: '600',
                color: 'var(--text)',
                marginBottom: '4px'
            }
        }, [`🔄 HITL: ${this.config.department}`]);

        this.applyTheme(titleEl, titleEl.style as any);

        this.counterElement = createElement('div', {
            style: {
                fontSize: '12px',
                color: 'var(--text-muted)'
            }
        }, ['0 pending']);

        this.applyTheme(this.counterElement, this.counterElement.style as any);

        listHeader.appendChild(titleEl);
        listHeader.appendChild(this.counterElement);
        leftPanel.appendChild(listHeader);

        // Request list
        this.requestListContainer = createElement('div', {
            className: 'axon-hitl-requests',
            style: {
                flex: '1',
                overflow: 'auto',
                padding: '8px'
            }
        });

        leftPanel.appendChild(this.requestListContainer);

        // Right panel - Request detail
        this.detailContainer = createElement('div', {
            className: 'axon-hitl-detail-panel',
            style: {
                flex: '1',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }
        });

        container.appendChild(leftPanel);
        container.appendChild(this.detailContainer);

        // Initial render
        this.renderRequestList();
        this.renderRequestDetail();
        this.updateCounter();

        return container;
    }

    // Public methods
    public getPendingRequests(): HITLRequest[] {
        return [...this.pendingRequests];
    }

    public getUrgentRequests(): HITLRequest[] {
        return this.pendingRequests.filter(r => r.priority === 'urgent');
    }

    public setActiveRequest(request: HITLRequest): void {
        this.activeRequest = request;
        this.renderRequestList();
        this.renderRequestDetail();
    }

    public destroy(): void {
        if (this.eventHandler) {
            this.config.client.off('event', this.eventHandler);
        }

        if (this.isSubscribed) {
            const hitlChannel = `hitl:${this.config.department}`;
            this.config.client.unsubscribe([hitlChannel]);
        }

        super.destroy();
    }
}
