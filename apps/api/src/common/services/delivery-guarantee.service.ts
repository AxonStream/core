import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from './redis.service';
import { EventReplayService, ReplayableEvent } from './event-replay.service';
import { TenantContext } from './tenant-aware.service';
import axios from 'axios';
import * as crypto from 'crypto';

/**
 * Delivery Guarantee Service
 * Ensures reliable event delivery with at-least-once, at-most-once, and exactly-once semantics
 */

export type DeliverySemantics = 'at-least-once' | 'at-most-once' | 'exactly-once';

export interface DeliveryEndpoint {
  id: string;
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  timeout: number;
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'fixed' | 'exponential' | 'linear';
    baseDelay: number;
    maxDelay: number;
    jitter: boolean;
  };
  semantics: DeliverySemantics;
  active: boolean;
}

export interface DeliveryReceipt {
  id: string;
  eventId: string;
  endpointId: string;
  organizationId: string;
  status: 'pending' | 'delivered' | 'failed' | 'acknowledged';
  attempts: number;
  firstAttempt: string;
  lastAttempt: string;
  acknowledgedAt?: string;
  error?: string;
  responseCode?: number;
  responseTime?: number;
}

export interface WebhookPayload {
  event: ReplayableEvent;
  delivery: {
    id: string;
    attempt: number;
    timestamp: string;
  };
  signature?: string;
}

@Injectable()
export class DeliveryGuaranteeService {
  private readonly logger = new Logger(DeliveryGuaranteeService.name);
  private endpoints = new Map<string, DeliveryEndpoint>();
  private deliveryQueue = new Map<string, DeliveryReceipt[]>();

  constructor(
    private readonly redisService: RedisService,
    private readonly eventReplayService: EventReplayService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  // ============================================================================
  // ENDPOINT MANAGEMENT
  // ============================================================================

  async registerDeliveryEndpoint(
    context: TenantContext,
    endpoint: Omit<DeliveryEndpoint, 'id'>
  ): Promise<string> {
    try {
      const endpointId = this.generateEndpointId();
      const fullEndpoint: DeliveryEndpoint = {
        ...endpoint,
        id: endpointId,
      };

      // Store endpoint configuration
      await this.storeEndpointConfig(context.organizationId, fullEndpoint);
      this.endpoints.set(endpointId, fullEndpoint);

      this.logger.log(`Registered delivery endpoint: ${endpointId} for ${context.organizationId}`);
      return endpointId;
    } catch (error) {
      this.logger.error(`Failed to register delivery endpoint: ${error.message}`);
      throw error;
    }
  }

  async updateDeliveryEndpoint(
    context: TenantContext,
    endpointId: string,
    updates: Partial<DeliveryEndpoint>
  ): Promise<void> {
    try {
      const existing = await this.getEndpointConfig(context.organizationId, endpointId);
      if (!existing) {
        throw new Error(`Endpoint ${endpointId} not found`);
      }

      const updated = { ...existing, ...updates, id: endpointId };
      await this.storeEndpointConfig(context.organizationId, updated);
      this.endpoints.set(endpointId, updated);

      this.logger.log(`Updated delivery endpoint: ${endpointId}`);
    } catch (error) {
      this.logger.error(`Failed to update delivery endpoint: ${error.message}`);
      throw error;
    }
  }

  async getDeliveryEndpoints(context: TenantContext): Promise<DeliveryEndpoint[]> {
    try {
      const endpoints = await this.getAllEndpointConfigs(context.organizationId);
      return endpoints.filter(endpoint => endpoint.active);
    } catch (error) {
      this.logger.error(`Failed to get delivery endpoints: ${error.message}`);
      return [];
    }
  }

  // ============================================================================
  // EVENT DELIVERY WITH GUARANTEES
  // ============================================================================

  async deliverEvent(
    context: TenantContext,
    event: ReplayableEvent,
    endpointIds?: string[]
  ): Promise<DeliveryReceipt[]> {
    try {
      const endpoints = await this.getDeliveryEndpoints(context);
      const targetEndpoints = endpointIds
        ? endpoints.filter(ep => endpointIds.includes(ep.id))
        : endpoints;

      const receipts: DeliveryReceipt[] = [];

      for (const endpoint of targetEndpoints) {
        const receipt = await this.deliverToEndpoint(event, endpoint);
        receipts.push(receipt);

        // Store delivery receipt
        await this.storeDeliveryReceipt(context.organizationId, receipt);
      }

      return receipts;
    } catch (error) {
      this.logger.error(`Failed to deliver event: ${error.message}`);
      throw error;
    }
  }

  private async deliverToEndpoint(
    event: ReplayableEvent,
    endpoint: DeliveryEndpoint
  ): Promise<DeliveryReceipt> {
    const receipt: DeliveryReceipt = {
      id: this.generateReceiptId(),
      eventId: event.id,
      endpointId: endpoint.id,
      organizationId: event.organizationId,
      status: 'pending',
      attempts: 0,
      firstAttempt: new Date().toISOString(),
      lastAttempt: new Date().toISOString(),
    };

    try {
      // Apply delivery semantics
      switch (endpoint.semantics) {
        case 'at-most-once':
          return await this.deliverAtMostOnce(event, endpoint, receipt);
        case 'exactly-once':
          return await this.deliverExactlyOnce(event, endpoint, receipt);
        case 'at-least-once':
        default:
          return await this.deliverAtLeastOnce(event, endpoint, receipt);
      }
    } catch (error) {
      receipt.status = 'failed';
      receipt.error = error.message;
      this.logger.error(`Delivery failed for endpoint ${endpoint.id}: ${error.message}`);
      return receipt;
    }
  }

  // ============================================================================
  // DELIVERY SEMANTICS IMPLEMENTATION
  // ============================================================================

  private async deliverAtLeastOnce(
    event: ReplayableEvent,
    endpoint: DeliveryEndpoint,
    receipt: DeliveryReceipt
  ): Promise<DeliveryReceipt> {
    // Retry until successful or max retries exceeded
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= endpoint.retryPolicy.maxRetries; attempt++) {
      try {
        receipt.attempts = attempt;
        receipt.lastAttempt = new Date().toISOString();

        const success = await this.sendWebhook(event, endpoint, receipt);

        if (success) {
          receipt.status = 'delivered';
          this.logger.debug(`At-least-once delivery successful: ${receipt.id}`);
          return receipt;
        }
      } catch (error) {
        lastError = error;

        // Wait before retry (except on last attempt)
        if (attempt < endpoint.retryPolicy.maxRetries) {
          const delay = this.calculateRetryDelay(endpoint.retryPolicy, attempt);
          await this.sleep(delay);
        }
      }
    }

    receipt.status = 'failed';
    receipt.error = lastError?.message || 'Max retries exceeded';
    return receipt;
  }

  private async deliverAtMostOnce(
    event: ReplayableEvent,
    endpoint: DeliveryEndpoint,
    receipt: DeliveryReceipt
  ): Promise<DeliveryReceipt> {
    // Single attempt only - no retries
    try {
      receipt.attempts = 1;
      const success = await this.sendWebhook(event, endpoint, receipt);

      receipt.status = success ? 'delivered' : 'failed';
      this.logger.debug(`At-most-once delivery result: ${receipt.status}`);
      return receipt;
    } catch (error) {
      receipt.status = 'failed';
      receipt.error = error.message;
      return receipt;
    }
  }

  private async deliverExactlyOnce(
    event: ReplayableEvent,
    endpoint: DeliveryEndpoint,
    receipt: DeliveryReceipt
  ): Promise<DeliveryReceipt> {
    // Check if already delivered (idempotency)
    const existingReceipt = await this.getExistingDeliveryReceipt(
      event.organizationId,
      event.id,
      endpoint.id
    );

    if (existingReceipt && existingReceipt.status === 'delivered') {
      this.logger.debug(`Event ${event.id} already delivered to ${endpoint.id}`);
      return existingReceipt;
    }

    // Deliver with at-least-once semantics but track for idempotency
    const result = await this.deliverAtLeastOnce(event, endpoint, receipt);

    // Store idempotency record
    if (result.status === 'delivered') {
      await this.storeIdempotencyRecord(event.organizationId, event.id, endpoint.id, receipt.id);
    }

    return result;
  }

  // ============================================================================
  // WEBHOOK DELIVERY
  // ============================================================================

  private async sendWebhook(
    event: ReplayableEvent,
    endpoint: DeliveryEndpoint,
    receipt: DeliveryReceipt
  ): Promise<boolean> {
    try {
      const payload: WebhookPayload = {
        event,
        delivery: {
          id: receipt.id,
          attempt: receipt.attempts,
          timestamp: new Date().toISOString(),
        },
      };

      // Add signature if configured
      if (endpoint.headers?.['X-Webhook-Secret']) {
        payload.signature = this.generateWebhookSignature(payload, endpoint.headers['X-Webhook-Secret']);
      }

      const startTime = Date.now();

      // Make HTTP request
      const response = await this.makeHttpRequest(endpoint, payload);

      const responseTime = Date.now() - startTime;
      receipt.responseCode = response.status;
      receipt.responseTime = responseTime;

      // Consider 2xx status codes as successful
      const success = response.status >= 200 && response.status < 300;

      if (success) {
        this.eventEmitter.emit('delivery.success', {
          receiptId: receipt.id,
          eventId: event.id,
          endpointId: endpoint.id,
          organizationId: event.organizationId,
          responseTime,
        });
      } else {
        this.eventEmitter.emit('delivery.failed', {
          receiptId: receipt.id,
          eventId: event.id,
          endpointId: endpoint.id,
          organizationId: event.organizationId,
          statusCode: response.status,
          error: `HTTP ${response.status}`,
        });
      }

      return success;
    } catch (error) {
      this.logger.error(`Webhook delivery failed: ${error.message}`);

      this.eventEmitter.emit('delivery.error', {
        receiptId: receipt.id,
        eventId: event.id,
        endpointId: endpoint.id,
        organizationId: event.organizationId,
        error: error.message,
      });

      throw error;
    }
  }

  private async makeHttpRequest(endpoint: DeliveryEndpoint, payload: WebhookPayload): Promise<{ status: number; data?: any }> {
    try {
      this.logger.debug(`Making HTTP request to ${endpoint.url}`, {
        method: endpoint.method,
        endpointId: endpoint.id,
        timeout: endpoint.timeout,
      });

      // Create axios instance with timeout and default headers
      const axiosInstance = axios.create({
        timeout: endpoint.timeout,
        validateStatus: () => true, // Don't throw on HTTP error status codes
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AXONPULS-Webhook/1.0',
          ...endpoint.headers,
        },
      } as any);

      // Add request interceptor for logging
      axiosInstance.interceptors.request.use((config) => {
        this.logger.debug(`Webhook request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      });

      // Add response interceptor for logging
      axiosInstance.interceptors.response.use(
        (response) => {
          this.logger.debug(`Webhook response: ${response.status} from ${response.config.url}`);
          return response;
        },
        (error) => {
          if (error.response) {
            this.logger.warn(`Webhook HTTP error: ${error.response.status} from ${error.config?.url}`);
          } else if (error.request) {
            this.logger.error(`Webhook network error: ${error.message}`);
          } else {
            this.logger.error(`Webhook request setup error: ${error.message}`);
          }
          return Promise.reject(error);
        }
      );

      // Make the HTTP request
      const response = await axiosInstance({
        method: endpoint.method,
        url: endpoint.url,
        data: payload,
      });

      // Return normalized response
      return {
        status: response.status,
        data: response.data,
      };

    } catch (error) {
      // Handle axios errors
      if (error.response || error.request || error.config) {
        const axiosError = error;

        if (axiosError.response) {
          // Server responded with error status
          this.logger.warn(`Webhook HTTP error: ${axiosError.response.status} - ${axiosError.message}`);
          return {
            status: axiosError.response.status,
            data: axiosError.response.data,
          };
        } else if (axiosError.request) {
          // Request was made but no response received (timeout, network error, etc.)
          this.logger.error(`Webhook network error: ${axiosError.message}`);
          throw new Error(`Network error: ${axiosError.message}`);
        } else {
          // Something else happened
          this.logger.error(`Webhook request error: ${axiosError.message}`);
          throw new Error(`Request error: ${axiosError.message}`);
        }
      } else {
        // Non-axios error
        this.logger.error(`Webhook unexpected error: ${error}`);
        throw error;
      }
    }
  }

  // ============================================================================
  // ACKNOWLEDGMENT HANDLING
  // ============================================================================

  async acknowledgeDelivery(
    context: TenantContext,
    receiptId: string,
    acknowledgmentData?: Record<string, any>
  ): Promise<boolean> {
    try {
      const receipt = await this.getDeliveryReceipt(context.organizationId, receiptId);
      if (!receipt) {
        throw new Error(`Delivery receipt ${receiptId} not found`);
      }

      if (receipt.status !== 'delivered') {
        throw new Error(`Cannot acknowledge delivery with status: ${receipt.status}`);
      }

      receipt.status = 'acknowledged';
      receipt.acknowledgedAt = new Date().toISOString();

      await this.storeDeliveryReceipt(context.organizationId, receipt);

      this.eventEmitter.emit('delivery.acknowledged', {
        receiptId,
        eventId: receipt.eventId,
        organizationId: context.organizationId,
        acknowledgmentData,
      });

      this.logger.debug(`Acknowledged delivery: ${receiptId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to acknowledge delivery: ${error.message}`);
      return false;
    }
  }

  // ============================================================================
  // DELIVERY MONITORING & ANALYTICS
  // ============================================================================

  async getDeliveryReceipts(
    context: TenantContext,
    filters?: {
      eventId?: string;
      endpointId?: string;
      status?: string;
      startTime?: string;
      endTime?: string;
      limit?: number;
    }
  ): Promise<DeliveryReceipt[]> {
    try {
      return await this.queryDeliveryReceipts(context.organizationId, filters);
    } catch (error) {
      this.logger.error(`Failed to get delivery receipts: ${error.message}`);
      return [];
    }
  }

  async getDeliveryStats(
    context: TenantContext,
    timeRange: { start: string; end: string }
  ): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    acknowledgedDeliveries: number;
    averageResponseTime: number;
    deliveryRate: number;
  }> {
    try {
      const receipts = await this.queryDeliveryReceipts(context.organizationId, {
        startTime: timeRange.start,
        endTime: timeRange.end,
      });

      const totalDeliveries = receipts.length;
      const successfulDeliveries = receipts.filter(r => r.status === 'delivered' || r.status === 'acknowledged').length;
      const failedDeliveries = receipts.filter(r => r.status === 'failed').length;
      const acknowledgedDeliveries = receipts.filter(r => r.status === 'acknowledged').length;

      const responseTimes = receipts
        .filter(r => r.responseTime)
        .map(r => r.responseTime!);
      const averageResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

      const deliveryRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

      return {
        totalDeliveries,
        successfulDeliveries,
        failedDeliveries,
        acknowledgedDeliveries,
        averageResponseTime,
        deliveryRate,
      };
    } catch (error) {
      this.logger.error(`Failed to get delivery stats: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private calculateRetryDelay(retryPolicy: DeliveryEndpoint['retryPolicy'], attempt: number): number {
    let delay: number;

    switch (retryPolicy.backoffStrategy) {
      case 'exponential':
        delay = retryPolicy.baseDelay * Math.pow(2, attempt - 1);
        break;
      case 'linear':
        delay = retryPolicy.baseDelay * attempt;
        break;
      case 'fixed':
      default:
        delay = retryPolicy.baseDelay;
        break;
    }

    // Apply jitter if enabled
    if (retryPolicy.jitter) {
      const jitterRange = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }

    // Ensure delay doesn't exceed max
    return Math.min(delay, retryPolicy.maxDelay);
  }

  private generateWebhookSignature(payload: WebhookPayload, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
    return `sha256=${signature}`;
  }

  private async storeEndpointConfig(organizationId: string, endpoint: DeliveryEndpoint): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      const key = `endpoints:${organizationId}:${endpoint.id}`;
      await redis.setEx(key, 86400 * 30, JSON.stringify(endpoint)); // 30 days TTL
    } catch (error) {
      this.logger.error(`Failed to store endpoint config: ${error.message}`);
    }
  }

  private async getEndpointConfig(organizationId: string, endpointId: string): Promise<DeliveryEndpoint | null> {
    try {
      const redis = this.redisService.getRedisInstance();
      const key = `endpoints:${organizationId}:${endpointId}`;
      const data = await redis.get(key);
      return (data && typeof data === 'string') ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get endpoint config: ${error.message}`);
      return null;
    }
  }

  private async getAllEndpointConfigs(organizationId: string): Promise<DeliveryEndpoint[]> {
    try {
      const redis = this.redisService.getRedisInstance();
      const pattern = `endpoints:${organizationId}:*`;
      const keys = await redis.keys(pattern);

      const endpoints: DeliveryEndpoint[] = [];
      for (const key of keys) {
        const data = await redis.get(key);
        if (data && typeof data === 'string') {
          endpoints.push(JSON.parse(data));
        }
      }

      return endpoints;
    } catch (error) {
      this.logger.error(`Failed to get all endpoint configs: ${error.message}`);
      return [];
    }
  }

  private generateEndpointId(): string {
    return `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReceiptId(): string {
    return `rcpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async storeDeliveryReceipt(organizationId: string, receipt: DeliveryReceipt): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      const key = `receipts:${organizationId}:${receipt.id}`;
      await redis.setEx(key, 86400 * 7, JSON.stringify(receipt)); // 7 days TTL
    } catch (error) {
      this.logger.error(`Failed to store delivery receipt: ${error.message}`);
    }
  }

  private async getDeliveryReceipt(organizationId: string, receiptId: string): Promise<DeliveryReceipt | null> {
    try {
      const redis = this.redisService.getRedisInstance();
      const key = `receipts:${organizationId}:${receiptId}`;
      const data = await redis.get(key);
      return (data && typeof data === 'string') ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get delivery receipt: ${error.message}`);
      return null;
    }
  }

  private async queryDeliveryReceipts(
    organizationId: string,
    filters?: any
  ): Promise<DeliveryReceipt[]> {
    try {
      const redis = this.redisService.getRedisInstance();
      const pattern = `receipts:${organizationId}:*`;
      const keys = await redis.keys(pattern);

      const receipts: DeliveryReceipt[] = [];
      for (const key of keys) {
        const data = await redis.get(key);
        if (data && typeof data === 'string') {
          const receipt = JSON.parse(data);

          // Apply filters
          if (filters) {
            if (filters.eventId && receipt.eventId !== filters.eventId) continue;
            if (filters.endpointId && receipt.endpointId !== filters.endpointId) continue;
            if (filters.status && receipt.status !== filters.status) continue;
            if (filters.startTime && receipt.firstAttempt < filters.startTime) continue;
            if (filters.endTime && receipt.firstAttempt > filters.endTime) continue;
          }

          receipts.push(receipt);
        }
      }

      // Sort by first attempt time (newest first)
      receipts.sort((a, b) => new Date(b.firstAttempt).getTime() - new Date(a.firstAttempt).getTime());

      // Apply limit
      if (filters?.limit) {
        return receipts.slice(0, filters.limit);
      }

      return receipts;
    } catch (error) {
      this.logger.error(`Failed to query delivery receipts: ${error.message}`);
      return [];
    }
  }

  private async getExistingDeliveryReceipt(
    organizationId: string,
    eventId: string,
    endpointId: string
  ): Promise<DeliveryReceipt | null> {
    try {
      const receipts = await this.queryDeliveryReceipts(organizationId, {
        eventId,
        endpointId,
        limit: 1,
      });
      return receipts.length > 0 ? receipts[0] : null;
    } catch (error) {
      this.logger.error(`Failed to get existing delivery receipt: ${error.message}`);
      return null;
    }
  }

  private async storeIdempotencyRecord(
    organizationId: string,
    eventId: string,
    endpointId: string,
    receiptId: string
  ): Promise<void> {
    try {
      const redis = this.redisService.getRedisInstance();
      const key = `idempotency:${organizationId}:${eventId}:${endpointId}`;
      await redis.setEx(key, 86400 * 30, receiptId); // 30 days TTL
    } catch (error) {
      this.logger.error(`Failed to store idempotency record: ${error.message}`);
    }
  }

}
