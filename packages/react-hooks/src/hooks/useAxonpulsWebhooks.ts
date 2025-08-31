import { useEffect, useState, useCallback } from 'react';
import { AxonpulsConnection } from './useAxonpuls';

export interface Webhook {
    id: string;
    name: string;
    url: string;
    method: 'POST' | 'PUT' | 'PATCH';
    active: boolean;
    semantics: 'at-least-once' | 'at-most-once' | 'exactly-once';
    timeout: number;
    retryPolicy: {
        maxRetries: number;
        backoffStrategy: 'fixed' | 'linear' | 'exponential';
        baseDelay: number;
        maxDelay: number;
        jitter: boolean;
    };
    headers?: Record<string, string>;
    secret?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateWebhookData {
    name: string;
    url: string;
    method?: 'POST' | 'PUT' | 'PATCH';
    secret?: string;
    headers?: Record<string, string>;
    timeout?: number;
    maxRetries?: number;
    backoffStrategy?: 'fixed' | 'linear' | 'exponential';
    baseDelay?: number;
    maxDelay?: number;
    jitter?: boolean;
    semantics?: 'at-least-once' | 'at-most-once' | 'exactly-once';
    active?: boolean;
}

export interface WebhookDelivery {
    id: string;
    eventId: string;
    status: 'pending' | 'delivered' | 'failed' | 'retrying';
    attempts: number;
    firstAttempt: Date;
    lastAttempt: Date;
    responseCode?: number;
    responseTime?: number;
    error?: string;
}

export interface WebhookTemplate {
    id: string;
    name: string;
    description: string;
    category: 'integration' | 'monitoring' | 'analytics' | 'notification' | 'custom';
    variables: Record<string, {
        description: string;
        required: boolean;
        default?: string;
    }>;
    examples: Array<{
        description: string;
        payload: any;
    }>;
}

export interface WebhookState {
    webhooks: Webhook[];
    templates: WebhookTemplate[];
    isLoading: boolean;
    error: string | null;
    createWebhook: (data: CreateWebhookData) => Promise<Webhook>;
    updateWebhook: (id: string, data: Partial<CreateWebhookData>) => Promise<void>;
    deleteWebhook: (id: string) => Promise<void>;
    getWebhookDeliveries: (id: string, limit?: number) => Promise<WebhookDelivery[]>;
    getTemplates: () => Promise<WebhookTemplate[]>;
    createFromTemplate: (templateId: string, variables: Record<string, string>, customConfig?: any) => Promise<Webhook>;
    refreshWebhooks: () => Promise<void>;
}

/**
 * Webhook Management Hook - Manage webhook endpoints and delivery
 * Uses HTTP API for webhook CRUD operations and monitoring
 * 
 * @example
 * ```tsx
 * function WebhookDashboard() {
 *   const webhooks = useAxonpulsWebhooks(axonpuls, {
 *     autoLoad: true,
 *     debug: true
 *   });
 * 
 *   const createSlackWebhook = async () => {
 *     await webhooks.createFromTemplate('slack-notifications', {
 *       SLACK_BOT_TOKEN: 'xoxb-your-token',
 *       SLACK_CHANNEL: '#alerts'
 *     });
 *   };
 * 
 *   return (
 *     <div>
 *       <h3>Webhooks ({webhooks.webhooks.length})</h3>
 *       {webhooks.isLoading && <div>Loading...</div>}
 *       {webhooks.error && <div>Error: {webhooks.error}</div>}
 *       
 *       {webhooks.webhooks.map(webhook => (
 *         <div key={webhook.id}>
 *           <h4>{webhook.name}</h4>
 *           <p>URL: {webhook.url}</p>
 *           <p>Status: {webhook.active ? 'Active' : 'Inactive'}</p>
 *           <button onClick={() => webhooks.deleteWebhook(webhook.id)}>
 *             Delete
 *           </button>
 *         </div>
 *       ))}
 *       
 *       <button onClick={createSlackWebhook}>
 *         Add Slack Webhook
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAxonpulsWebhooks(
    connection: AxonpulsConnection,
    options: {
        autoLoad?: boolean;
        debug?: boolean;
    } = {}
): WebhookState {
    const { autoLoad = true, debug = false } = options;
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [templates, setTemplates] = useState<WebhookTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshWebhooks = useCallback(async (): Promise<void> => {
        if (!connection.client) {
            throw new Error('AXONPULS client not connected');
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await connection.request('GET', '/webhooks');
            
            const webhookList: Webhook[] = response.webhooks.map((w: any) => ({
                id: w.id,
                name: w.name,
                url: w.url,
                method: w.method,
                active: w.active,
                semantics: w.semantics,
                timeout: w.timeout,
                retryPolicy: w.retryPolicy,
                headers: w.headers,
                secret: w.secret,
                createdAt: new Date(w.createdAt || Date.now()),
                updatedAt: new Date(w.updatedAt || Date.now())
            }));

            setWebhooks(webhookList);

            if (debug) {
                console.log('🔗 Webhooks loaded:', webhookList);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load webhooks';
            setError(errorMessage);
            if (debug) {
                console.error('❌ Failed to load webhooks:', err);
            }
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [connection, debug]);

    const createWebhook = useCallback(async (data: CreateWebhookData): Promise<Webhook> => {
        if (!connection.client) {
            throw new Error('AXONPULS client not connected');
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await connection.request('POST', '/webhooks', data);

            const webhook: Webhook = {
                id: response.webhookId,
                name: data.name,
                url: data.url,
                method: data.method || 'POST',
                active: data.active !== false,
                semantics: data.semantics || 'at-least-once',
                timeout: data.timeout || 10000,
                retryPolicy: {
                    maxRetries: data.maxRetries || 3,
                    backoffStrategy: data.backoffStrategy || 'exponential',
                    baseDelay: data.baseDelay || 1000,
                    maxDelay: data.maxDelay || 30000,
                    jitter: data.jitter !== false
                },
                headers: data.headers,
                secret: data.secret,
                createdAt: new Date(response.timestamp),
                updatedAt: new Date(response.timestamp)
            };

            setWebhooks(prev => [...prev, webhook]);

            if (debug) {
                console.log('🔗 Webhook created:', webhook);
            }

            return webhook;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create webhook';
            setError(errorMessage);
            if (debug) {
                console.error('❌ Failed to create webhook:', err);
            }
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [connection, debug]);

    const updateWebhook = useCallback(async (id: string, data: Partial<CreateWebhookData>): Promise<void> => {
        if (!connection.client) {
            throw new Error('AXONPULS client not connected');
        }

        setIsLoading(true);
        setError(null);

        try {
            await connection.request('PUT', `/webhooks/${id}`, data);

            setWebhooks(prev => prev.map(webhook => 
                webhook.id === id 
                    ? { ...webhook, ...data, updatedAt: new Date() }
                    : webhook
            ));

            if (debug) {
                console.log('🔗 Webhook updated:', id);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update webhook';
            setError(errorMessage);
            if (debug) {
                console.error('❌ Failed to update webhook:', err);
            }
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [connection, debug]);

    const deleteWebhook = useCallback(async (id: string): Promise<void> => {
        if (!connection.client) {
            throw new Error('AXONPULS client not connected');
        }

        setIsLoading(true);
        setError(null);

        try {
            await connection.request('DELETE', `/webhooks/${id}`);

            setWebhooks(prev => prev.filter(webhook => webhook.id !== id));

            if (debug) {
                console.log('🔗 Webhook deleted:', id);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete webhook';
            setError(errorMessage);
            if (debug) {
                console.error('❌ Failed to delete webhook:', err);
            }
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [connection, debug]);

    const getWebhookDeliveries = useCallback(async (id: string, limit: number = 50): Promise<WebhookDelivery[]> => {
        if (!connection.client) {
            throw new Error('AXONPULS client not connected');
        }

        try {
            const response = await connection.request('GET', `/webhooks/${id}/deliveries?limit=${limit}`);

            const deliveries: WebhookDelivery[] = response.deliveries.map((d: any) => ({
                id: d.id,
                eventId: d.eventId,
                status: d.status,
                attempts: d.attempts,
                firstAttempt: new Date(d.firstAttempt),
                lastAttempt: new Date(d.lastAttempt),
                responseCode: d.responseCode,
                responseTime: d.responseTime,
                error: d.error
            }));

            if (debug) {
                console.log('🔗 Webhook deliveries loaded:', deliveries);
            }

            return deliveries;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to get webhook deliveries';
            setError(errorMessage);
            if (debug) {
                console.error('❌ Failed to get webhook deliveries:', err);
            }
            throw err;
        }
    }, [connection, debug]);

    const getTemplates = useCallback(async (): Promise<WebhookTemplate[]> => {
        if (!connection.client) {
            throw new Error('AXONPULS client not connected');
        }

        try {
            const response = await connection.request('GET', '/webhooks/templates');

            const templateList: WebhookTemplate[] = response.templates.map((t: any) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                category: t.category,
                variables: t.variables,
                examples: t.examples
            }));

            setTemplates(templateList);

            if (debug) {
                console.log('🔗 Webhook templates loaded:', templateList);
            }

            return templateList;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load webhook templates';
            setError(errorMessage);
            if (debug) {
                console.error('❌ Failed to load webhook templates:', err);
            }
            throw err;
        }
    }, [connection, debug]);

    const createFromTemplate = useCallback(async (
        templateId: string, 
        variables: Record<string, string>, 
        customConfig?: any
    ): Promise<Webhook> => {
        if (!connection.client) {
            throw new Error('AXONPULS client not connected');
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await connection.request('POST', `/webhooks/from-template/${templateId}`, {
                variables,
                customConfig
            });

            const webhook: Webhook = {
                id: response.webhookId,
                name: `${templateId} - ${new Date().toISOString()}`,
                url: response.url,
                method: 'POST',
                active: response.active,
                semantics: 'at-least-once',
                timeout: 10000,
                retryPolicy: {
                    maxRetries: 3,
                    backoffStrategy: 'exponential',
                    baseDelay: 1000,
                    maxDelay: 30000,
                    jitter: true
                },
                createdAt: new Date(response.timestamp),
                updatedAt: new Date(response.timestamp)
            };

            setWebhooks(prev => [...prev, webhook]);

            if (debug) {
                console.log('🔗 Webhook created from template:', webhook);
            }

            return webhook;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create webhook from template';
            setError(errorMessage);
            if (debug) {
                console.error('❌ Failed to create webhook from template:', err);
            }
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [connection, debug]);

    // Auto-load webhooks and templates if enabled
    useEffect(() => {
        if (connection.isConnected && autoLoad) {
            refreshWebhooks().catch(() => {
                // Error already handled in refreshWebhooks
            });
            getTemplates().catch(() => {
                // Error already handled in getTemplates
            });
        }
    }, [connection.isConnected, autoLoad, refreshWebhooks, getTemplates]);

    return {
        webhooks,
        templates,
        isLoading,
        error,
        createWebhook,
        updateWebhook,
        deleteWebhook,
        getWebhookDeliveries,
        getTemplates,
        createFromTemplate,
        refreshWebhooks,
    };
}
