/**
 * 🚀 AXONPULS Webhook Templates Service
 * 
 * Provides prebuilt webhook configurations for common integrations
 * and advanced webhook features beyond traditional implementations
 */

import { Injectable, Logger } from '@nestjs/common';
import { DeliveryEndpoint } from './delivery-guarantee.service';

export interface WebhookTemplate {
  id: string;
  name: string;
  description: string;
  category: 'integration' | 'monitoring' | 'analytics' | 'notification' | 'custom';
  config: Partial<DeliveryEndpoint>;
  variables: Record<string, {
    description: string;
    required: boolean;
    default?: string;
    validation?: RegExp;
  }>;
  examples: {
    description: string;
    payload: any;
  }[];
}

export interface WebhookFilter {
  eventTypes?: string[];
  channels?: string[];
  payloadFilters?: Record<string, any>;
  conditionalLogic?: {
    operator: 'AND' | 'OR';
    conditions: Array<{
      field: string;
      operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'gt' | 'lt';
      value: any;
    }>;
  };
}

export interface AdvancedWebhookConfig extends DeliveryEndpoint {
  filters?: WebhookFilter;
  transformation?: {
    enabled: boolean;
    template: string; // Handlebars template
    customFields?: Record<string, string>;
  };
  batching?: {
    enabled: boolean;
    maxSize: number;
    maxWaitMs: number;
    flushOnEventTypes?: string[];
  };
  rateLimit?: {
    requestsPerSecond: number;
    burstLimit: number;
  };
}

@Injectable()
export class WebhookTemplatesService {
  private readonly logger = new Logger(WebhookTemplatesService.name);
  private readonly templates = new Map<string, WebhookTemplate>();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Slack Integration Template
    this.templates.set('slack-notifications', {
      id: 'slack-notifications',
      name: 'Slack Notifications',
      description: 'Send real-time notifications to Slack channels',
      category: 'notification',
      config: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer {{SLACK_BOT_TOKEN}}',
        },
        timeout: 10000,
        retryPolicy: {
          maxRetries: 3,
          backoffStrategy: 'exponential',
          baseDelay: 1000,
          maxDelay: 30000,
          jitter: true,
        },
        semantics: 'at-least-once',
      },
      variables: {
        SLACK_BOT_TOKEN: {
          description: 'Slack Bot OAuth Token',
          required: true,
          validation: /^xoxb-/,
        },
        SLACK_CHANNEL: {
          description: 'Slack channel ID or name',
          required: true,
          default: '#general',
        },
      },
      examples: [
        {
          description: 'User registration notification',
          payload: {
            channel: '{{SLACK_CHANNEL}}',
            text: 'New user registered: {{event.payload.username}}',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '*New User Registration*\nUser: {{event.payload.username}}\nEmail: {{event.payload.email}}',
                },
              },
            ],
          },
        },
      ],
    });

    // Discord Integration Template
    this.templates.set('discord-webhooks', {
      id: 'discord-webhooks',
      name: 'Discord Webhooks',
      description: 'Send events to Discord channels via webhooks',
      category: 'notification',
      config: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000,
        retryPolicy: {
          maxRetries: 2,
          backoffStrategy: 'linear',
          baseDelay: 2000,
          maxDelay: 10000,
          jitter: false,
        },
        semantics: 'at-most-once',
      },
      variables: {
        DISCORD_WEBHOOK_URL: {
          description: 'Discord webhook URL',
          required: true,
          validation: /^https:\/\/discord\.com\/api\/webhooks\//,
        },
      },
      examples: [
        {
          description: 'System alert notification',
          payload: {
            content: '🚨 **System Alert**',
            embeds: [
              {
                title: '{{event.eventType}}',
                description: '{{event.payload.message}}',
                color: 15158332, // Red color
                timestamp: '{{event.createdAt}}',
              },
            ],
          },
        },
      ],
    });

    // Zapier Integration Template
    this.templates.set('zapier-integration', {
      id: 'zapier-integration',
      name: 'Zapier Integration',
      description: 'Connect to 5000+ apps via Zapier webhooks',
      category: 'integration',
      config: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Zapier-Source': 'AXONPULS',
        },
        timeout: 30000,
        retryPolicy: {
          maxRetries: 5,
          backoffStrategy: 'exponential',
          baseDelay: 500,
          maxDelay: 60000,
          jitter: true,
        },
        semantics: 'exactly-once',
      },
      variables: {
        ZAPIER_WEBHOOK_URL: {
          description: 'Zapier webhook URL from your Zap',
          required: true,
          validation: /^https:\/\/hooks\.zapier\.com\//,
        },
      },
      examples: [
        {
          description: 'E-commerce order event',
          payload: {
            event_type: '{{event.eventType}}',
            timestamp: '{{event.createdAt}}',
            data: '{{event.payload}}',
            organization: '{{event.organizationId}}',
          },
        },
      ],
    });

    // Analytics/Mixpanel Template
    this.templates.set('mixpanel-analytics', {
      id: 'mixpanel-analytics',
      name: 'Mixpanel Analytics',
      description: 'Send events to Mixpanel for analytics tracking',
      category: 'analytics',
      config: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic {{MIXPANEL_AUTH}}',
        },
        timeout: 20000,
        retryPolicy: {
          maxRetries: 3,
          backoffStrategy: 'exponential',
          baseDelay: 1000,
          maxDelay: 30000,
          jitter: true,
        },
        semantics: 'at-least-once',
      },
      variables: {
        MIXPANEL_AUTH: {
          description: 'Base64 encoded Mixpanel project token',
          required: true,
        },
        MIXPANEL_PROJECT_ID: {
          description: 'Mixpanel project ID',
          required: true,
        },
      },
      examples: [
        {
          description: 'User behavior tracking',
          payload: {
            event: '{{event.eventType}}',
            properties: {
              distinct_id: '{{event.userId}}',
              time: '{{event.createdAt}}',
              $insert_id: '{{event.id}}',
              // Note: event.payload will be merged at runtime, not parsed here
            },
          },
        },
      ],
    });

    // Custom API Integration Template
    this.templates.set('custom-api', {
      id: 'custom-api',
      name: 'Custom API Integration',
      description: 'Generic template for custom API integrations',
      category: 'custom',
      config: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AXONPULS-Webhook/1.0',
        },
        timeout: 15000,
        retryPolicy: {
          maxRetries: 3,
          backoffStrategy: 'exponential',
          baseDelay: 1000,
          maxDelay: 30000,
          jitter: true,
        },
        semantics: 'at-least-once',
      },
      variables: {
        API_ENDPOINT: {
          description: 'Your API endpoint URL',
          required: true,
          validation: /^https?:\/\//,
        },
        API_KEY: {
          description: 'API authentication key',
          required: false,
        },
      },
      examples: [
        {
          description: 'Standard event forwarding',
          payload: {
            event_id: '{{event.id}}',
            event_type: '{{event.eventType}}',
            channel: '{{event.channel}}',
            timestamp: '{{event.createdAt}}',
            organization_id: '{{event.organizationId}}',
            user_id: '{{event.userId}}',
            data: '{{event.payload}}',
            metadata: '{{event.metadata}}',
          },
        },
      ],
    });

    this.logger.log(`Initialized ${this.templates.size} webhook templates`);
  }

  /**
   * Get all available webhook templates
   */
  getTemplates(): WebhookTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: WebhookTemplate['category']): WebhookTemplate[] {
    return this.getTemplates().filter(template => template.category === category);
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(templateId: string): WebhookTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * Create webhook configuration from template
   */
  createFromTemplate(
    templateId: string,
    variables: Record<string, string>,
    customConfig?: Partial<DeliveryEndpoint>
  ): DeliveryEndpoint | null {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required variables
    for (const [key, config] of Object.entries(template.variables)) {
      if (config.required && !variables[key]) {
        throw new Error(`Required variable missing: ${key}`);
      }

      // Validate format if regex provided
      if (variables[key] && config.validation && !config.validation.test(variables[key])) {
        throw new Error(`Invalid format for variable ${key}`);
      }
    }

    // Replace variables in template config
    const configStr = JSON.stringify(template.config);
    const replacedConfigStr = this.replaceVariables(configStr, variables);
    const config = JSON.parse(replacedConfigStr);

    // Merge with custom configuration
    return {
      id: `${templateId}-${Date.now()}`,
      name: `${template.name} - ${new Date().toISOString()}`,
      ...config,
      ...customConfig,
    };
  }

  /**
   * Replace template variables with actual values
   */
  private replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  /**
   * Validate webhook filter conditions
   */
  validateFilter(filter: WebhookFilter, event: any): boolean {
    // Event type filter
    if (filter.eventTypes && !filter.eventTypes.includes(event.eventType)) {
      return false;
    }

    // Channel filter
    if (filter.channels && !filter.channels.includes(event.channel)) {
      return false;
    }

    // Payload filters
    if (filter.payloadFilters) {
      for (const [key, value] of Object.entries(filter.payloadFilters)) {
        if (event.payload[key] !== value) {
          return false;
        }
      }
    }

    // Conditional logic
    if (filter.conditionalLogic) {
      return this.evaluateConditionalLogic(filter.conditionalLogic, event);
    }

    return true;
  }

  /**
   * Evaluate complex conditional logic
   */
  private evaluateConditionalLogic(logic: WebhookFilter['conditionalLogic'], event: any): boolean {
    if (!logic) return true;

    const results = logic.conditions.map(condition => {
      const fieldValue = this.getNestedValue(event, condition.field);
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });

    return logic.operator === 'AND'
      ? results.every(r => r)
      : results.some(r => r);
  }

  /**
   * Evaluate individual condition
   */
  private evaluateCondition(fieldValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'contains':
        return String(fieldValue).includes(String(expectedValue));
      case 'startsWith':
        return String(fieldValue).startsWith(String(expectedValue));
      case 'endsWith':
        return String(fieldValue).endsWith(String(expectedValue));
      case 'regex':
        return new RegExp(expectedValue).test(String(fieldValue));
      case 'gt':
        return Number(fieldValue) > Number(expectedValue);
      case 'lt':
        return Number(fieldValue) < Number(expectedValue);
      default:
        return false;
    }
  }

  /**
   * Get nested object value by dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}
