/**
 * 🚨 Standardized Error Handling System
 *
 * Provides consistent error handling across the entire SDK
 * with proper error codes, context, and recovery suggestions.
 */

import type { SDKError } from '../types/schemas';

export interface ErrorContext {
  operation?: string;
  resource?: string;
  resourceId?: string;
  organizationId?: string;
  userId?: string;
  timestamp?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  planType?: string;
  feature?: string;
  hasPaymentMethod?: boolean;
  timeRange?: { start: Date; end: Date };
  widgetType?: string;
  channelCount?: number;
  roleId?: string;
  roleName?: string;
  permissionCount?: number;
  eventType?: string;
  format?: string;
  requiredPermissions?: string[];
}

export interface ErrorRecovery {
  retryable: boolean;
  retryAfter?: number;
  maxRetries?: number;
  suggestions?: string[];
  documentation?: string;
}

/**
 * Base AxonPuls Error Class
 * All SDK errors extend from this class for consistent handling
 * Implements the existing SDKError interface for compatibility
 */
export class AxonPulsError extends Error implements SDKError {
  public name = 'AxonPulsError';
  public readonly timestamp: Date;
  public readonly requestId?: string;
  public retryable?: boolean;

  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: any,
    public readonly context?: ErrorContext,
    public readonly recovery?: ErrorRecovery
  ) {
    super(message);
    this.timestamp = new Date();
    this.requestId = context?.requestId || this.generateRequestId();
    this.retryable = recovery?.retryable || false;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AxonPulsError);
    }
  }

  /**
   * Convert error to JSON for logging/transmission
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      requestId: this.requestId,
      details: this.details,
      context: this.context,
      recovery: this.recovery,
      retryable: this.retryable,
      stack: this.stack
    };
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.recovery?.retryable || false;
  }

  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(): number {
    return this.recovery?.retryAfter || 1000;
  }

  /**
   * Get maximum retry attempts
   */
  getMaxRetries(): number {
    return this.recovery?.maxRetries || 3;
  }



  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Authentication and Authorization Errors
 */
export class AuthenticationError extends AxonPulsError {
  constructor(message: string, details?: any, context?: ErrorContext) {
    super(
      message,
      'AUTH_FAILED',
      401,
      details,
      context,
      {
        retryable: false,
        suggestions: [
          'Check your authentication credentials',
          'Ensure your token is valid and not expired',
          'Verify your organization access'
        ],
        documentation: 'https://docs.axonstream.ai/authentication'
      }
    );
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AxonPulsError {
  constructor(message: string, details?: any, context?: ErrorContext) {
    super(
      message,
      'AUTHORIZATION_FAILED',
      403,
      details,
      context,
      {
        retryable: false,
        suggestions: [
          'Check your user permissions',
          'Verify your role has access to this resource',
          'Contact your organization administrator'
        ],
        documentation: 'https://docs.axonstream.ai/permissions'
      }
    );
    this.name = 'AuthorizationError';
  }
}

/**
 * Connection and Network Errors
 */
export class ConnectionError extends AxonPulsError {
  constructor(message: string, details?: any, context?: ErrorContext) {
    super(
      message,
      'CONNECTION_FAILED',
      503,
      details,
      context,
      {
        retryable: true,
        retryAfter: 2000,
        maxRetries: 5,
        suggestions: [
          'Check your internet connection',
          'Verify the server URL is correct',
          'Check if the service is experiencing downtime'
        ],
        documentation: 'https://docs.axonstream.ai/troubleshooting/connection'
      }
    );
    this.name = 'ConnectionError';
  }
}

export class WebSocketError extends AxonPulsError {
  constructor(message: string, details?: any, context?: ErrorContext) {
    super(
      message,
      'WEBSOCKET_ERROR',
      503,
      details,
      context,
      {
        retryable: true,
        retryAfter: 3000,
        maxRetries: 3,
        suggestions: [
          'Check WebSocket connection status',
          'Verify firewall settings allow WebSocket connections',
          'Try reconnecting to the WebSocket server'
        ],
        documentation: 'https://docs.axonstream.ai/websockets'
      }
    );
    this.name = 'WebSocketError';
  }
}

/**
 * Rate Limiting and Quota Errors
 */
export class RateLimitError extends AxonPulsError {
  constructor(message: string, retryAfter: number = 60000, details?: any, context?: ErrorContext) {
    super(
      message,
      'RATE_LIMIT_EXCEEDED',
      429,
      details,
      context,
      {
        retryable: true,
        retryAfter,
        maxRetries: 1,
        suggestions: [
          'Wait before making another request',
          'Implement exponential backoff in your application',
          'Consider upgrading your plan for higher limits'
        ],
        documentation: 'https://docs.axonstream.ai/rate-limits'
      }
    );
    this.name = 'RateLimitError';
  }
}

export class QuotaExceededError extends AxonPulsError {
  constructor(message: string, details?: any, context?: ErrorContext) {
    super(
      message,
      'QUOTA_EXCEEDED',
      402,
      details,
      context,
      {
        retryable: false,
        suggestions: [
          'Upgrade your plan to increase quotas',
          'Wait for quota reset period',
          'Optimize your usage patterns'
        ],
        documentation: 'https://docs.axonstream.ai/quotas'
      }
    );
    this.name = 'QuotaExceededError';
  }
}

/**
 * Validation and Input Errors
 */
export class ValidationError extends AxonPulsError {
  constructor(message: string, details?: any, context?: ErrorContext) {
    super(
      message,
      'VALIDATION_FAILED',
      400,
      details,
      context,
      {
        retryable: false,
        suggestions: [
          'Check the input data format',
          'Verify all required fields are provided',
          'Ensure data types match the expected format'
        ],
        documentation: 'https://docs.axonstream.ai/api-reference'
      }
    );
    this.name = 'ValidationError';
  }
}

/**
 * Resource and State Errors
 */
export class ResourceNotFoundError extends AxonPulsError {
  constructor(resource: string, resourceId: string, context?: ErrorContext) {
    super(
      `${resource} with ID '${resourceId}' not found`,
      'RESOURCE_NOT_FOUND',
      404,
      { resource, resourceId },
      context,
      {
        retryable: false,
        suggestions: [
          'Verify the resource ID is correct',
          'Check if the resource exists in your organization',
          'Ensure you have permission to access this resource'
        ]
      }
    );
    this.name = 'ResourceNotFoundError';
  }
}

export class ConflictError extends AxonPulsError {
  constructor(message: string, details?: any, context?: ErrorContext) {
    super(
      message,
      'CONFLICT',
      409,
      details,
      context,
      {
        retryable: false,
        suggestions: [
          'Check for existing resources with the same identifier',
          'Resolve the conflict before retrying',
          'Use update instead of create if the resource exists'
        ]
      }
    );
    this.name = 'ConflictError';
  }
}

/**
 * Server and Service Errors
 */
export class ServerError extends AxonPulsError {
  constructor(message: string, details?: any, context?: ErrorContext) {
    super(
      message,
      'SERVER_ERROR',
      500,
      details,
      context,
      {
        retryable: true,
        retryAfter: 5000,
        maxRetries: 2,
        suggestions: [
          'Try the request again after a short delay',
          'Check the service status page',
          'Contact support if the issue persists'
        ],
        documentation: 'https://docs.axonstream.ai/support'
      }
    );
    this.name = 'ServerError';
  }
}

export class ServiceUnavailableError extends AxonPulsError {
  constructor(message: string, details?: any, context?: ErrorContext) {
    super(
      message,
      'SERVICE_UNAVAILABLE',
      503,
      details,
      context,
      {
        retryable: true,
        retryAfter: 10000,
        maxRetries: 3,
        suggestions: [
          'The service is temporarily unavailable',
          'Try again in a few minutes',
          'Check the service status page for updates'
        ],
        documentation: 'https://status.axonstream.ai'
      }
    );
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Error Factory Functions
 */
export class ErrorFactory {
  static fromHttpError(error: any, context?: ErrorContext): AxonPulsError {
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message || 'Unknown error';
    const details = error.response?.data;

    switch (status) {
      case 400:
        return new ValidationError(message, details, context);
      case 401:
        return new AuthenticationError(message, details, context);
      case 403:
        return new AuthorizationError(message, details, context);
      case 404:
        return new ResourceNotFoundError(
          context?.resource || 'Resource',
          context?.resourceId || 'unknown',
          context
        );
      case 409:
        return new ConflictError(message, details, context);
      case 429:
        const retryAfter = error.response?.headers['retry-after']
          ? parseInt(error.response.headers['retry-after']) * 1000
          : 60000;
        return new RateLimitError(message, retryAfter, details, context);
      case 402:
        return new QuotaExceededError(message, details, context);
      case 503:
        return new ServiceUnavailableError(message, details, context);
      default:
        return new ServerError(message, details, context);
    }
  }

  static fromWebSocketError(error: any, context?: ErrorContext): WebSocketError {
    return new WebSocketError(
      error.message || 'WebSocket connection failed',
      error,
      context
    );
  }

  static fromConnectionError(error: any, context?: ErrorContext): ConnectionError {
    return new ConnectionError(
      error.message || 'Connection failed',
      error,
      context
    );
  }
}

/**
 * Error Handler Utility
 */
export class ErrorHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: AxonPulsError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof AxonPulsError
          ? error
          : new AxonPulsError('Operation failed', 'OPERATION_FAILED', 500, error);

        if (attempt === maxRetries || !lastError.isRetryable()) {
          throw lastError;
        }

        const delay = Math.min(baseDelay * Math.pow(2, attempt), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  static isRetryableError(error: any): boolean {
    return error instanceof AxonPulsError && error.isRetryable();
  }

  static getErrorCode(error: any): string {
    return error instanceof AxonPulsError ? error.code : 'UNKNOWN_ERROR';
  }
}
