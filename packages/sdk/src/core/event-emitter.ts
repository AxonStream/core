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
    private errorCounts: Map<EventListener<any>, number> = new Map();
    private maxErrors = 5; // Remove listener after 5 consecutive errors
    private errorHandler?: (error: Error, event: keyof T, listener: EventListener<any>) => void;

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

        // 🛡️ IMPROVED ERROR HANDLING - Recovery mechanisms
        const listenersToRemove: EventListener<T[K]>[] = [];

        listeners.forEach(listener => {
            try {
                listener(data as T[K]);
                // Reset error count on successful execution
                this.errorCounts.delete(listener);
            } catch (error) {
                const errorCount = (this.errorCounts.get(listener) || 0) + 1;
                this.errorCounts.set(listener, errorCount);

                // Call custom error handler if provided
                if (this.errorHandler) {
                    try {
                        this.errorHandler(error as Error, event, listener);
                    } catch (handlerError) {
                        // Fallback if error handler itself fails
                        this.logError(`Error handler failed for event ${String(event)}:`, handlerError);
                    }
                } else {
                    this.logError(`Error in event listener for ${String(event)}:`, error);
                }

                // Remove listener if it has failed too many times
                if (errorCount >= this.maxErrors) {
                    listenersToRemove.push(listener);
                    this.logError(`Removing listener for ${String(event)} after ${errorCount} consecutive errors`);
                }
            }
        });

        // Remove problematic listeners
        listenersToRemove.forEach(listener => {
            this.off(event, listener);
            this.errorCounts.delete(listener);
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

    /**
     * Set custom error handler for listener failures
     */
    setErrorHandler(handler: (error: Error, event: keyof T, listener: EventListener<any>) => void): this {
        this.errorHandler = handler;
        return this;
    }

    /**
     * Get error statistics
     */
    getErrorStats(): { totalErrors: number; listenersWithErrors: number } {
        const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
        return {
            totalErrors,
            listenersWithErrors: this.errorCounts.size
        };
    }

    /**
     * 🛡️ PRODUCTION LOGGING - Replace console.error
     */
    private logError(message: string, error?: any): void {
        // In production, this should integrate with your logging service
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
            // Production logging - could integrate with services like DataDog, Sentry, etc.
            // For now, we'll use a structured log format
            const logEntry = {
                timestamp: new Date().toISOString(),
                level: 'ERROR',
                source: 'EventEmitter',
                message,
                error: error?.message || error,
                stack: error?.stack
            };
            console.error(JSON.stringify(logEntry));
        } else {
            // Development logging - more readable
            console.error(`[EventEmitter] ${message}`, error);
        }
    }
}
