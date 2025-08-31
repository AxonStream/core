/**
 * Angular Adapter - Provides Angular services and directives
 * 
 * Auto-detects Angular and provides:
 * - AxonStreamService
 * - AxonChannelService
 * - AxonPresenceService
 * - AxonHITLService
 * - Angular components/directives
 */

import type { AxonPulsClient, AxonPulsEvent } from '../core/client';
import type { FrameworkAdapter } from './index';
import { isAngularEnvironment } from '../utils/framework-detection';

// Angular types (will be available when Angular is present)
declare const ViewChild: any;
declare const Input: any;
type ElementRef = any;

// Angular binding interface
export interface AngularBinding {
    services: {
        AxonStreamService: any;
        AxonChannelService: any;
        AxonPresenceService: any;
        AxonHITLService: any;
    };
    components: {
        AxonChatComponent: any;
        AxonPresenceComponent: any;
        AxonHITLComponent: any;
        AxonEmbedComponent: any;
    };
    module: any;
}

// Angular services implementation (will be loaded if Angular is detected)
export function createAngularBinding(client: AxonPulsClient): AngularBinding {
    // Import Angular dependencies dynamically to avoid errors in non-Angular environments
    let ng: any;
    let Injectable: any;
    let Component: any;
    let BehaviorSubject: any;
    let Observable: any;
    let Subject: any;

    try {
        if (typeof window !== 'undefined' && (window as any).ng) {
            ng = (window as any).ng;
        } else if (typeof require !== 'undefined') {
            const core = require('@angular/core');
            const rxjs = require('rxjs');
            Injectable = core.Injectable;
            Component = core.Component;
            BehaviorSubject = rxjs.BehaviorSubject;
            Observable = rxjs.Observable;
            Subject = rxjs.Subject;
        } else {
            throw new Error('Angular not found');
        }
    } catch (error) {
        throw new Error('Angular adapter requires Angular to be available');
    }

    // AxonStreamService
    const AxonStreamService = Injectable()(class {
        private isConnectedSubject = new BehaviorSubject(false);
        private isConnectingSubject = new BehaviorSubject(false);
        private errorSubject = new BehaviorSubject(null as string | null);

        public isConnected$ = this.isConnectedSubject.asObservable();
        public isConnecting$ = this.isConnectingSubject.asObservable();
        public error$ = this.errorSubject.asObservable();

        constructor() {
            // Set up event listeners
            client.on('connect', () => this.isConnectedSubject.next(true));
            client.on('disconnect', () => this.isConnectedSubject.next(false));
            client.on('error', (err: any) => this.errorSubject.next(err.message || 'Unknown error'));
        }

        async connect(config?: { autoConnect?: boolean; debug?: boolean }): Promise<void> {
            try {
                this.isConnectingSubject.next(true);
                this.errorSubject.next(null);
                await client.connect();
                this.isConnectedSubject.next(true);
            } catch (err) {
                this.errorSubject.next(err instanceof Error ? err.message : 'Connection failed');
                throw err;
            } finally {
                this.isConnectingSubject.next(false);
            }
        }

        disconnect(): void {
            client.disconnect();
            this.isConnectedSubject.next(false);
        }

        subscribe(channels: string[]): Promise<void> {
            return client.subscribe(channels);
        }

        publish(channel: string, data: any): Promise<void> {
            return client.publish(channel, data);
        }

        getClient(): AxonPulsClient {
            return client;
        }
    });

    // AxonChannelService
    const AxonChannelService = Injectable()(class {
        private messagesSubject = new BehaviorSubject([] as AxonPulsEvent[]);
        private isSubscribedSubject = new BehaviorSubject(false);

        public messages$ = this.messagesSubject.asObservable();
        public isSubscribed$ = this.isSubscribedSubject.asObservable();

        private currentChannel: string | null = null;
        private eventHandler: ((event: AxonPulsEvent) => void) | null = null;

        subscribeToChannel(channel: string): Promise<void> {
            if (this.currentChannel) {
                this.unsubscribeFromChannel();
            }

            this.currentChannel = channel;
            this.eventHandler = (event: AxonPulsEvent) => {
                if (event.metadata?.channel === channel) {
                    const currentMessages = this.messagesSubject.value;
                    this.messagesSubject.next([...currentMessages, event]);
                }
            };

            client.on('event', this.eventHandler);

            return client.subscribe([channel]).then(() => {
                this.isSubscribedSubject.next(true);
            }).catch((err) => {
                console.error('Failed to subscribe to channel:', err);
                throw err;
            });
        }

        unsubscribeFromChannel(): void {
            if (this.currentChannel && this.eventHandler) {
                client.off('event', this.eventHandler);
                client.unsubscribe([this.currentChannel]);
                this.isSubscribedSubject.next(false);
                this.currentChannel = null;
                this.eventHandler = null;
            }
        }

        sendMessage(type: string, payload: any): Promise<void> {
            if (!this.currentChannel) {
                throw new Error('No channel subscribed');
            }
            return client.publish(this.currentChannel, { type, payload });
        }

        clearMessages(): void {
            this.messagesSubject.next([]);
        }

        getMessageCount(): number {
            return this.messagesSubject.value.length;
        }
    });

    // AxonPresenceService
    const AxonPresenceService = Injectable()(class {
        private usersSubject = new BehaviorSubject([] as any[]);
        public users$ = this.usersSubject.asObservable();

        private currentRoom: string | null = null;
        private currentUser: any = null;
        private eventHandler: ((event: AxonPulsEvent) => void) | null = null;

        joinRoom(room: string, currentUser?: { id: string; name: string; metadata?: any }): Promise<void> {
            if (this.currentRoom) {
                this.leaveRoom();
            }

            this.currentRoom = room;
            this.currentUser = currentUser;

            const presenceChannel = `presence:${room}`;

            this.eventHandler = (event: AxonPulsEvent) => {
                if (event.type === 'user_joined') {
                    const users = this.usersSubject.value;
                    const filteredUsers = users.filter((u: any) => u.id !== event.payload.user.id);
                    this.usersSubject.next([...filteredUsers, event.payload.user]);
                } else if (event.type === 'user_left') {
                    const users = this.usersSubject.value;
                    this.usersSubject.next(users.filter((u: any) => u.id !== event.payload.user.id));
                } else if (event.type === 'presence_update') {
                    this.usersSubject.next(event.payload.users || []);
                }
            };

            client.on('event', this.eventHandler);

            return client.subscribe([presenceChannel]).then(() => {
                // Send join event
                if (currentUser) {
                    return client.publish(presenceChannel, {
                        type: 'user_join',
                        payload: { user: currentUser }
                    });
                }
            });
        }

        leaveRoom(): Promise<void> {
            if (this.currentRoom && this.eventHandler) {
                const presenceChannel = `presence:${this.currentRoom}`;

                client.off('event', this.eventHandler);

                let leavePromise = Promise.resolve();

                // Send leave event
                if (this.currentUser) {
                    leavePromise = client.publish(presenceChannel, {
                        type: 'user_leave',
                        payload: { user: this.currentUser }
                    });
                }

                return leavePromise.then(() => {
                    client.unsubscribe([presenceChannel]);
                    this.currentRoom = null;
                    this.currentUser = null;
                    this.eventHandler = null;
                    this.usersSubject.next([]);
                });
            }
            return Promise.resolve();
        }

        getOnlineCount(): number {
            return this.usersSubject.value.length;
        }

        getUsersByStatus(status: string): any[] {
            return this.usersSubject.value.filter((u: any) => u.status === status);
        }
    });

    // AxonHITLService
    const AxonHITLService = Injectable()(class {
        private pendingRequestsSubject = new BehaviorSubject([] as any[]);
        private activeRequestSubject = new BehaviorSubject(null as any | null);

        public pendingRequests$ = this.pendingRequestsSubject.asObservable();
        public activeRequest$ = this.activeRequestSubject.asObservable();

        private department: string = 'general';
        private currentUser: any = null;
        private eventHandler: ((event: AxonPulsEvent) => void) | null = null;

        initialize(options: {
            department?: string;
            autoAcceptRoles?: string[];
            currentUser?: { id: string; name: string; role: string };
        }): Promise<void> {
            this.department = options.department || 'general';
            this.currentUser = options.currentUser;

            const hitlChannel = `hitl:${this.department}`;

            this.eventHandler = (event: AxonPulsEvent) => {
                if (event.type === 'hitl_request') {
                    const current = this.pendingRequestsSubject.value;
                    this.pendingRequestsSubject.next([...current, event.payload]);
                } else if (event.type === 'hitl_request_update') {
                    const current = this.pendingRequestsSubject.value;
                    const updated = current.map((r: any) =>
                        r.id === event.payload.id ? { ...r, ...event.payload } : r
                    );
                    this.pendingRequestsSubject.next(updated);
                }
            };

            client.on('event', this.eventHandler);
            return client.subscribe([hitlChannel]);
        }

        submitResponse(response: {
            requestId: string;
            action: 'approve' | 'reject' | 'escalate';
            comment?: string;
        }): Promise<void> {
            const hitlChannel = `hitl:${this.department}`;

            const payload = { ...response, respondedBy: this.currentUser };

            return client.publish(hitlChannel, {
                type: 'hitl_response',
                payload
            }).then(() => {
                // Remove from pending
                const current = this.pendingRequestsSubject.value;
                this.pendingRequestsSubject.next(current.filter((r: any) => r.id !== response.requestId));

                // Clear active if it matches
                if (this.activeRequestSubject.value?.id === response.requestId) {
                    this.activeRequestSubject.next(null);
                }
            });
        }

        setActiveRequest(request: any): void {
            this.activeRequestSubject.next(request);
        }

        getUrgentRequests(): any[] {
            return this.pendingRequestsSubject.value.filter((r: any) => r.priority === 'urgent');
        }

        destroy(): void {
            if (this.eventHandler) {
                client.off('event', this.eventHandler);
                const hitlChannel = `hitl:${this.department}`;
                client.unsubscribe([hitlChannel]);
            }
        }
    });

    // Angular Components
    const AxonChatComponent = Component({
        selector: 'axon-chat',
        template: `
      <div class="axon-chat">
        <div class="axon-messages">
          <div *ngFor="let msg of messages" class="axon-message">
            <span class="message-type">{{ msg.type }}</span>
            <span>{{ msg.payload | json }}</span>
          </div>
        </div>
        <div class="axon-input">
          <input 
            [(ngModel)]="inputValue"
            (keyup.enter)="handleSend()"
            type="text" 
            placeholder="Type a message..."
          />
          <button (click)="handleSend()">Send</button>
        </div>
      </div>
    `,
        inputs: ['channel', 'client']
    })(class {
        channel!: string;
        client!: AxonPulsClient;
        messages: AxonPulsEvent[] = [];
        inputValue: string = '';

        constructor(private channelService: any) { }

        ngOnInit() {
            this.channelService.subscribeToChannel(this.channel);
            this.channelService.messages$.subscribe((messages: AxonPulsEvent[]) => {
                this.messages = messages;
            });
        }

        ngOnDestroy() {
            this.channelService.unsubscribeFromChannel();
        }

        handleSend() {
            if (this.inputValue.trim()) {
                this.channelService.sendMessage('chat_message', {
                    text: this.inputValue,
                    timestamp: new Date().toISOString()
                });
                this.inputValue = '';
            }
        }
    });

    const AxonPresenceComponent = Component({
        selector: 'axon-presence',
        template: `
      <div class="axon-presence">
        <h3>Online ({{ onlineCount }})</h3>
        <div class="presence-users">
          <div *ngFor="let user of users" class="presence-user">
            <span>{{ user.name }}</span>
            <span [class]="'status-' + (user.status || 'online')">
              {{ user.status || 'online' }}
            </span>
          </div>
        </div>
      </div>
    `,
        inputs: ['room', 'currentUser']
    })(class {
        room!: string;
        currentUser?: any;
        users: any[] = [];
        onlineCount: number = 0;

        constructor(private presenceService: any) { }

        ngOnInit() {
            this.presenceService.joinRoom(this.room, this.currentUser);
            this.presenceService.users$.subscribe((users: any[]) => {
                this.users = users;
                this.onlineCount = users.length;
            });
        }

        ngOnDestroy() {
            this.presenceService.leaveRoom();
        }
    });

    // Create Angular module
    const AxonStreamModule = (() => {
        if (typeof require !== 'undefined') {
            try {
                const { NgModule } = require('@angular/core');
                return NgModule({
                    providers: [
                        AxonStreamService,
                        AxonChannelService,
                        AxonPresenceService,
                        AxonHITLService
                    ],
                    declarations: [
                        AxonChatComponent,
                        AxonPresenceComponent
                    ],
                    exports: [
                        AxonChatComponent,
                        AxonPresenceComponent
                    ]
                })(class AxonStreamModule { });
            } catch (error) {
                console.warn('Could not create Angular module:', error);
                return null;
            }
        }
        return null;
    })();

    return {
        services: {
            AxonStreamService,
            AxonChannelService,
            AxonPresenceService,
            AxonHITLService
        },
        components: {
            AxonChatComponent,
            AxonPresenceComponent,
            AxonHITLComponent: Component({
                selector: 'axon-hitl',
                template: '<div #hitlContainer></div>',
                inputs: ['department', 'client', 'currentUser', 'autoAcceptRoles', 'showPriority']
            })(class {
                @ViewChild('hitlContainer', { static: true }) hitlContainer!: ElementRef;
                @Input() department: string = 'general';
                @Input() client: any;
                @Input() currentUser: any;
                @Input() autoAcceptRoles: string[] = [];
                @Input() showPriority: boolean = true;

                private hitlInstance: any = null;

                async ngAfterViewInit() {
                    try {
                        const { AxonHITL } = await import('../ui/components/hitl');
                        this.hitlInstance = new AxonHITL({
                            department: this.department,
                            client: this.client,
                            currentUser: this.currentUser,
                            autoAcceptRoles: this.autoAcceptRoles,
                            showPriority: this.showPriority,
                            theme: 'auto'
                        });
                        this.hitlInstance.mount(this.hitlContainer.nativeElement);
                    } catch (error) {
                        console.error('Failed to load HITL component:', error);
                        this.hitlContainer.nativeElement.innerHTML = '<div style="padding: 20px; color: #e74c3c;">Failed to load HITL component</div>';
                    }
                }

                ngOnDestroy() {
                    if (this.hitlInstance) {
                        this.hitlInstance.unmount();
                        this.hitlInstance = null;
                    }
                }
            }),
            AxonEmbedComponent: Component({
                selector: 'axon-embed',
                template: '<div #embedContainer></div>',
                inputs: ['token', 'channel', 'org', 'features', 'width', 'height']
            })(class {
                @ViewChild('embedContainer', { static: true }) embedContainer!: ElementRef;
                @Input() token: string = '';
                @Input() channel: string = '';
                @Input() org: string = '';
                @Input() features: ('chat' | 'presence' | 'hitl' | 'notifications')[] = ['chat'];
                @Input() width: string = '400px';
                @Input() height: string = '500px';

                private embedInstance: any = null;

                async ngAfterViewInit() {
                    try {
                        const { AxonEmbed } = await import('../ui/components/embed');
                        this.embedInstance = new AxonEmbed({
                            el: this.embedContainer.nativeElement,
                            token: this.token,
                            channel: this.channel,
                            org: this.org,
                            features: this.features,
                            width: this.width,
                            height: this.height,
                            theme: 'auto'
                        });
                    } catch (error) {
                        console.error('Failed to load Embed component:', error);
                        this.embedContainer.nativeElement.innerHTML = '<div style="padding: 20px; color: #e74c3c;">Failed to load Embed component</div>';
                    }
                }

                ngOnDestroy() {
                    if (this.embedInstance) {
                        this.embedInstance.unmount();
                        this.embedInstance = null;
                    }
                }
            })
        },
        module: AxonStreamModule
    };
}

// Angular adapter registration
export const AngularAdapter: FrameworkAdapter = {
    name: 'angular',
    version: '1.0.0',
    detectFramework() {
        return isAngularEnvironment();
    },
    createBinding(client: AxonPulsClient) {
        return createAngularBinding(client);
    }
};
