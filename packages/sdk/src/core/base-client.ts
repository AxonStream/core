/**
 * 🏗️ Base Client Class
 * 
 * Provides common functionality for all SDK client classes
 * including authentication, error handling, and request management.
 */

import { ErrorFactory, AxonPulsError } from './errors';
import type { ErrorContext } from './errors';

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface ApiClient {
  get<T = any>(url: string, config?: any): Promise<ApiResponse<T>>;
  post<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>>;
  put<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>>;
  patch<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>>;
  delete<T = any>(url: string, config?: any): Promise<ApiResponse<T>>;
}

/**
 * Base client class that all SDK clients extend
 */
export abstract class BaseClient {
  protected readonly apiClient: ApiClient;
  protected readonly config: ApiClientConfig;

  constructor(apiClient: ApiClient, config: ApiClientConfig) {
    this.apiClient = apiClient;
    this.config = config;
  }

  /**
   * Create error context for better error reporting
   */
  protected createErrorContext(
    operation: string,
    resource?: string,
    resourceId?: string,
    metadata?: Record<string, any>
  ): ErrorContext {
    return {
      operation,
      resource,
      resourceId,
      timestamp: new Date().toISOString(),
      metadata
    };
  }

  /**
   * Handle API errors with proper error transformation
   */
  protected handleApiError(error: any, context?: ErrorContext): never {
    if (error instanceof AxonPulsError) {
      throw error;
    }

    throw ErrorFactory.fromHttpError(error, context);
  }

  /**
   * Execute API request with error handling
   */
  protected async executeRequest<T>(
    operation: () => Promise<ApiResponse<T>>,
    context?: ErrorContext
  ): Promise<T> {
    try {
      const response = await operation();
      return response.data;
    } catch (error) {
      this.handleApiError(error, context);
    }
  }

  /**
   * Execute API request with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<ApiResponse<T>>,
    context?: ErrorContext,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries || this.config.retries || 3;
    const delay = this.config.retryDelay || 1000;

    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await operation();
        return response.data;
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx) except 429
        if (this.isHttpError(error) && error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
          this.handleApiError(error, context);
        }

        // Don't retry on last attempt
        if (attempt === retries) {
          this.handleApiError(error, context);
        }

        // Calculate exponential backoff delay
        const retryDelay = delay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    this.handleApiError(lastError, context);
  }

  /**
   * Validate required parameters
   */
  protected validateRequired(params: Record<string, any>, requiredFields: string[]): void {
    const missing = requiredFields.filter(field =>
      params[field] === undefined || params[field] === null || params[field] === ''
    );

    if (missing.length > 0) {
      throw new AxonPulsError(
        `Missing required parameters: ${missing.join(', ')}`,
        'MISSING_REQUIRED_PARAMS',
        400,
        { missing, provided: Object.keys(params) }
      );
    }
  }

  /**
   * Sanitize and validate input data
   */
  protected sanitizeInput<T extends Record<string, any>>(data: T): T {
    const sanitized = { ...data };

    // Remove undefined values
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === undefined) {
        delete sanitized[key];
      }
    });

    return sanitized;
  }

  /**
   * Build query parameters from object
   */
  protected buildQueryParams(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(item => searchParams.append(key, String(item)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Format URL with path parameters
   */
  protected formatUrl(template: string, params: Record<string, string | number>): string {
    let url = template;

    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, encodeURIComponent(String(value)));
    });

    return url;
  }

  /**
   * Check if response indicates success
   */
  protected isSuccessResponse(status: number): boolean {
    return status >= 200 && status < 300;
  }

  /**
   * Extract pagination info from response headers
   */
  protected extractPaginationInfo(headers: Record<string, string>): {
    total?: number;
    page?: number;
    pageSize?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  } {
    return {
      total: headers['x-total-count'] ? parseInt(headers['x-total-count']) : undefined,
      page: headers['x-page'] ? parseInt(headers['x-page']) : undefined,
      pageSize: headers['x-page-size'] ? parseInt(headers['x-page-size']) : undefined,
      hasNext: headers['x-has-next'] === 'true',
      hasPrev: headers['x-has-prev'] === 'true',
    };
  }

  /**
   * Create request headers with authentication
   */
  protected createHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...this.config.headers,
      ...additionalHeaders
    };
  }

  /**
   * Log request for debugging (if enabled)
   */
  protected logRequest(method: string, url: string, data?: any): void {
    if (process.env.NODE_ENV === 'development' || process.env.AXONPULS_DEBUG) {
      console.log(`[AxonPuls SDK] ${method.toUpperCase()} ${url}`, data ? { data } : '');
    }
  }

  /**
   * Log response for debugging (if enabled)
   */
  protected logResponse(method: string, url: string, status: number, data?: any): void {
    if (process.env.NODE_ENV === 'development' || process.env.AXONPULS_DEBUG) {
      console.log(`[AxonPuls SDK] ${method.toUpperCase()} ${url} -> ${status}`, data ? { data } : '');
    }
  }

  /**
   * Check if error is an HTTP error with response
   */
  private isHttpError(error: any): error is { response: { status: number; data?: any } } {
    return error && error.response && typeof error.response.status === 'number';
  }

  /**
   * Get client configuration
   */
  public getConfig(): ApiClientConfig {
    return { ...this.config };
  }

  /**
   * Update client configuration
   */
  public updateConfig(updates: Partial<ApiClientConfig>): void {
    Object.assign(this.config, updates);
  }
}
