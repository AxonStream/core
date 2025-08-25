export interface EventMap {
    [event: string]: any;
}

export interface DefaultEvents {
    connect: void;
    connecting: void;
    connected: void;
    disconnect: { reason: string };
    disconnected: { reason?: string };
    reconnecting: { attempt: number; delay: number };
    error: Error;
    event: any;
    subscribed: { channels: string[] };
    unsubscribed: { channels: string[] };
    published: { channel: string; event: any };
    ack: any;
    rate_limit: any;
    token_refreshed: void;
    [eventType: string]: any;
}

export type EventListener<T = any> = (data: T) => void;

export class EventEmitter<T extends EventMap = DefaultEvents> {
    private events: { [K in keyof T]?: EventListener<T[K]>[] } = {};

    on<K extends keyof T>(event: K, listener: EventListener<T[K]>): this {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event]!.push(listener);
        return this;
    }

    off<K extends keyof T>(event: K, listener?: EventListener<T[K]>): this {
        if (!this.events[event]) return this;

        if (listener) {
            const index = this.events[event]!.indexOf(listener);
            if (index !== -1) {
                this.events[event]!.splice(index, 1);
            }
        } else {
            delete this.events[event];
        }
        return this;
    }

    emit<K extends keyof T>(event: K, data?: T[K]): boolean {
        const listeners = this.events[event];
        if (!listeners) return false;

        listeners.forEach(listener => {
            try {
                listener(data as T[K]);
            } catch (error) {
                console.error(`Error in event listener for ${String(event)}:`, error);
            }
        });

        return true;
    }

    once<K extends keyof T>(event: K, listener: EventListener<T[K]>): this {
        const onceListener = (data: T[K]) => {
            this.off(event, onceListener);
            listener(data);
        };
        return this.on(event, onceListener);
    }

    removeAllListeners<K extends keyof T>(event?: K): this {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
        return this;
    }

    listenerCount<K extends keyof T>(event: K): number {
        return this.events[event]?.length || 0;
    }

    listeners<K extends keyof T>(event: K): EventListener<T[K]>[] {
        return [...(this.events[event] || [])];
    }
}
