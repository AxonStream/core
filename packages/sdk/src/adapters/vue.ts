/**
 * Vue Adapter - Provides Vue composables and components
 * 
 * Auto-detects Vue and provides:
 * - useAxonStream composable
 * - useAxonChannel composable
 * - useAxonPresence composable  
 * - useAxonHITL composable
 * - Vue components
 */

import type { AxonPulsClient, AxonPulsEvent } from '../core/client';
import type { FrameworkAdapter } from './index';
import { isVueEnvironment } from '../utils/framework-detection';

// Vue binding interface
export interface VueBinding {
    useAxonStream: (config?: any) => any;
    useAxonChannel: (channel: string, client: AxonPulsClient) => any;
    useAxonPresence: (client: AxonPulsClient, options?: any) => any;
    useAxonHITL: (client: AxonPulsClient, options?: any) => any;
    components: {
        AxonChat: any;
        AxonPresence: any;
        AxonHITL: any;
        AxonEmbed: any;
    };
}

// Vue composables implementation (will be loaded if Vue is detected)
export function createVueBinding(client: AxonPulsClient): VueBinding {
    // Import Vue composables dynamically to avoid errors in non-Vue environments
    let Vue: any;
    let ref: any;
    let reactive: any;
    let computed: any;
    let onMounted: any;
    let onUnmounted: any;
    let watch: any;

    try {
        if (typeof window !== 'undefined' && (window as any).Vue) {
            Vue = (window as any).Vue;
        } else if (typeof require !== 'undefined') {
            Vue = require('vue');
        } else {
            throw new Error('Vue not found');
        }

        // Support both Vue 2 and Vue 3
        if (Vue.version && Vue.version.startsWith('3')) {
            ({ ref, reactive, computed, onMounted, onUnmounted, watch } = Vue);
        } else {
            // Vue 2 compatibility
            const { observable, watch: vueWatch } = Vue;
            ref = (value: any) => ({ value });
            reactive = observable;
            computed = Vue.computed;
            onMounted = (fn: () => void) => Vue.nextTick(fn);
            onUnmounted = () => { }; // No direct equivalent in Vue 2
            watch = vueWatch;
        }
    } catch (error) {
        throw new Error('Vue adapter requires Vue to be available');
    }

    // useAxonStream composable
    const useAxonStream = (config?: { autoConnect?: boolean; debug?: boolean }) => {
        const isConnected = ref(false);
        const isConnecting = ref(false);
        const error = ref(null as string | null);

        const connect = async () => {
            try {
                isConnecting.value = true;
                error.value = null;
                await client.connect();
                isConnected.value = true;
            } catch (err) {
                error.value = err instanceof Error ? err.message : 'Connection failed';
            } finally {
                isConnecting.value = false;
            }
        };

        const disconnect = () => {
            client.disconnect();
            isConnected.value = false;
        };

        const handleConnect = () => isConnected.value = true;
        const handleDisconnect = () => isConnected.value = false;
        const handleError = (err: any) => error.value = err.message || 'Unknown error';

        onMounted(() => {
            client.on('connect', handleConnect);
            client.on('disconnect', handleDisconnect);
            client.on('error', handleError);

            // Auto-connect if requested
            if (config?.autoConnect && !client.isConnected()) {
                connect();
            }
        });

        onUnmounted(() => {
            client.off('connect', handleConnect);
            client.off('disconnect', handleDisconnect);
            client.off('error', handleError);
        });

        return {
            client,
            isConnected,
            isConnecting,
            error,
            connect,
            disconnect,
            subscribe: (channels: string[]) => client.subscribe(channels),
            publish: (channel: string, data: any) => client.publish(channel, data),
        };
    };

    // useAxonChannel composable
    const useAxonChannel = (channel: string, axonClient: AxonPulsClient) => {
        const messages = ref([] as AxonPulsEvent[]);
        const isSubscribed = ref(false);

        const sendMessage = (type: string, payload: any) => {
            axonClient.publish(channel, { type, payload });
        };

        const clearMessages = () => {
            messages.value = [];
        };

        const handleEvent = (event: AxonPulsEvent) => {
            if (event.metadata?.channel === channel) {
                messages.value.push(event);
            }
        };

        onMounted(() => {
            axonClient.on('event', handleEvent);

            // Subscribe to channel
            axonClient.subscribe([channel]).then(() => {
                isSubscribed.value = true;
            }).catch((err) => {
                console.error('Failed to subscribe to channel:', err);
            });
        });

        onUnmounted(() => {
            axonClient.off('event', handleEvent);
            axonClient.unsubscribe([channel]);
            isSubscribed.value = false;
        });

        return {
            messages,
            messageCount: computed(() => messages.value.length),
            isSubscribed,
            sendMessage,
            clearMessages,
        };
    };

    // useAxonPresence composable
    const useAxonPresence = (axonClient: AxonPulsClient, options: {
        room: string;
        currentUser?: { id: string; name: string; metadata?: any };
        heartbeatInterval?: number;
    }) => {
        const users = ref([] as any[]);
        const onlineCount = computed(() => users.value.length);

        const handlePresence = (event: AxonPulsEvent) => {
            if (event.type === 'user_joined') {
                users.value = [...users.value.filter((u: any) => u.id !== event.payload.user.id), event.payload.user];
            } else if (event.type === 'user_left') {
                users.value = users.value.filter((u: any) => u.id !== event.payload.user.id);
            } else if (event.type === 'presence_update') {
                users.value = event.payload.users || [];
            }
        };

        onMounted(() => {
            const presenceChannel = `presence:${options.room}`;

            axonClient.on('event', handlePresence);
            axonClient.subscribe([presenceChannel]);

            // Send join event
            if (options.currentUser) {
                axonClient.publish(presenceChannel, {
                    type: 'user_join',
                    payload: { user: options.currentUser }
                });
            }
        });

        onUnmounted(() => {
            axonClient.off('event', handlePresence);

            // Send leave event
            if (options.currentUser) {
                const presenceChannel = `presence:${options.room}`;
                axonClient.publish(presenceChannel, {
                    type: 'user_leave',
                    payload: { user: options.currentUser }
                });
                axonClient.unsubscribe([presenceChannel]);
            }
        });

        return {
            users,
            onlineCount,
            getUsersByStatus: (status: string) => users.value.filter((u: any) => u.status === status),
        };
    };

    // useAxonHITL composable
    const useAxonHITL = (axonClient: AxonPulsClient, options: {
        department?: string;
        autoAcceptRoles?: string[];
        currentUser?: { id: string; name: string; role: string };
    }) => {
        const pendingRequests = ref([] as any[]);
        const activeRequest = ref(null as any | null);

        const submitResponse = (response: {
            requestId: string;
            action: 'approve' | 'reject' | 'escalate';
            comment?: string;
        }) => {
            const hitlChannel = `hitl:${options.department || 'general'}`;
            axonClient.publish(hitlChannel, {
                type: 'hitl_response',
                payload: { ...response, respondedBy: options.currentUser }
            });

            // Remove from pending
            pendingRequests.value = pendingRequests.value.filter((r: any) => r.id !== response.requestId);
            if (activeRequest.value?.id === response.requestId) {
                activeRequest.value = null;
            }
        };

        const handleHITL = (event: AxonPulsEvent) => {
            if (event.type === 'hitl_request') {
                pendingRequests.value.push(event.payload);
            } else if (event.type === 'hitl_request_update') {
                const index = pendingRequests.value.findIndex((r: any) => r.id === event.payload.id);
                if (index !== -1) {
                    pendingRequests.value[index] = { ...pendingRequests.value[index], ...event.payload };
                }
            }
        };

        onMounted(() => {
            const hitlChannel = `hitl:${options.department || 'general'}`;

            axonClient.on('event', handleHITL);
            axonClient.subscribe([hitlChannel]);
        });

        onUnmounted(() => {
            axonClient.off('event', handleHITL);
            const hitlChannel = `hitl:${options.department || 'general'}`;
            axonClient.unsubscribe([hitlChannel]);
        });

        return {
            pendingRequests,
            activeRequest,
            submitResponse,
            setActiveRequest: (request: any) => activeRequest.value = request,
            getUrgentRequests: () => pendingRequests.value.filter((r: any) => r.priority === 'urgent'),
        };
    };

    // Vue Components
    const AxonChat = {
        props: {
            channel: { type: String, required: true },
            client: { type: Object, required: true },
            className: { type: String, default: '' }
        },
        setup(props: any) {
            const { messages, sendMessage } = useAxonChannel(props.channel, props.client);
            const inputValue = ref('');

            const handleSend = () => {
                if (inputValue.value.trim()) {
                    sendMessage('chat_message', {
                        text: inputValue.value,
                        timestamp: new Date().toISOString()
                    });
                    inputValue.value = '';
                }
            };

            return {
                messages,
                inputValue,
                handleSend
            };
        },
        template: `
      <div :class="'axon-chat ' + className">
        <div class="axon-messages">
          <div v-for="(msg, idx) in messages" :key="idx" class="axon-message">
            <span class="message-type">{{ msg.type }}</span>
            <span>{{ JSON.stringify(msg.payload) }}</span>
          </div>
        </div>
        <div class="axon-input">
          <input 
            v-model="inputValue"
            @keyup.enter="handleSend"
            type="text" 
            placeholder="Type a message..."
          />
          <button @click="handleSend">Send</button>
        </div>
      </div>
    `
    };

    const AxonPresence = {
        props: {
            room: { type: String, required: true },
            client: { type: Object, required: true },
            currentUser: { type: Object, default: null }
        },
        setup(props: any) {
            const { users, onlineCount } = useAxonPresence(props.client, {
                room: props.room,
                currentUser: props.currentUser
            });

            return {
                users,
                onlineCount
            };
        },
        template: `
      <div class="axon-presence">
        <h3>Online ({{ onlineCount }})</h3>
        <div class="presence-users">
          <div v-for="(user, idx) in users" :key="idx" class="presence-user">
            <span>{{ user.name }}</span>
            <span :class="'status-' + (user.status || 'online')">
              {{ user.status || 'online' }}
            </span>
          </div>
        </div>
      </div>
    `
    };

    return {
        useAxonStream,
        useAxonChannel,
        useAxonPresence,
        useAxonHITL,
        components: {
            AxonChat,
            AxonPresence,
            AxonHITL: {
                template: '<div ref="hitlContainer"></div>',
                props: ['department', 'client', 'currentUser', 'autoAcceptRoles', 'showPriority'],
                data() {
                    return {
                        hitlInstance: null,
                        loading: true
                    };
                },
                async mounted() {
                    try {
                        const { AxonHITL } = await import('../ui/components/hitl');
                        this.hitlInstance = new AxonHITL({
                            department: this.department || 'general',
                            client: this.client,
                            currentUser: this.currentUser,
                            autoAcceptRoles: this.autoAcceptRoles,
                            showPriority: this.showPriority !== false,
                            theme: 'auto'
                        });
                        this.hitlInstance.mount(this.$refs.hitlContainer);
                        this.loading = false;
                    } catch (error) {
                        console.error('Failed to load HITL component:', error);
                        this.$refs.hitlContainer.innerHTML = '<div style="padding: 20px; color: #e74c3c;">Failed to load HITL component</div>';
                    }
                },
                beforeUnmount() {
                    if (this.hitlInstance) {
                        this.hitlInstance.unmount();
                        this.hitlInstance = null;
                    }
                }
            },
            AxonEmbed: {
                template: '<div ref="embedContainer"></div>',
                props: ['token', 'channel', 'org', 'features', 'width', 'height'],
                data() {
                    return {
                        embedInstance: null,
                        loading: true
                    };
                },
                async mounted() {
                    try {
                        const { AxonEmbed } = await import('../ui/components/embed');
                        this.embedInstance = new AxonEmbed({
                            el: this.$refs.embedContainer,
                            token: this.token,
                            channel: this.channel,
                            org: this.org,
                            features: this.features || ['chat'],
                            width: this.width || '400px',
                            height: this.height || '500px',
                            theme: 'auto'
                        });
                        this.loading = false;
                    } catch (error) {
                        console.error('Failed to load Embed component:', error);
                        this.$refs.embedContainer.innerHTML = '<div style="padding: 20px; color: #e74c3c;">Failed to load Embed component</div>';
                    }
                },
                beforeUnmount() {
                    if (this.embedInstance) {
                        this.embedInstance.unmount();
                        this.embedInstance = null;
                    }
                }
            },
        },
    };
}

// Vue adapter registration
export const VueAdapter: FrameworkAdapter = {
    name: 'vue',
    version: '1.0.0',
    detectFramework() {
        return isVueEnvironment();
    },
    createBinding(client: AxonPulsClient) {
        return createVueBinding(client);
    }
};
