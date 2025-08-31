/**
 * 🧪 Error Handling Tests
 * 
 * Comprehensive test suite for standardized error handling system
 */

import {
  AxonPulsError,
  AuthenticationError,
  AuthorizationError,
  ConnectionError,
  WebSocketError,
  RateLimitError,
  QuotaExceededError,
  ValidationError,
  ResourceNotFoundError,
  ConflictError,
  ServerError,
  ServiceUnavailableError,
  ErrorFactory,
  ErrorHandler,
} from '../errors';

describe('AxonPulsError', () => {
  it('should create basic error', () => {
    const error = new AxonPulsError('Test error', 'TEST_ERROR', 500);

    expect(error.name).toBe('AxonPulsError');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.timestamp).toBeDefined();
    expect(error.requestId).toBeDefined();
  });

  it('should create error with context and recovery', () => {
    const context = {
      operation: 'create_organization',
      resource: 'organization',
      resourceId: 'org-123',
      organizationId: 'org-123',
      userId: 'user-456',
    };

    const recovery = {
      retryable: true,
      retryAfter: 5000,
      maxRetries: 3,
      suggestions: ['Try again later'],
    };

    const error = new AxonPulsError('Test error', 'TEST_ERROR', 500, null, context, recovery);

    expect(error.context).toEqual(context);
    expect(error.recovery).toEqual(recovery);
    expect(error.isRetryable()).toBe(true);
    expect(error.getRetryDelay()).toBe(5000);
    expect(error.getMaxRetries()).toBe(3);
  });

  it('should convert to JSON', () => {
    const error = new AxonPulsError('Test error', 'TEST_ERROR', 500);
    const json = error.toJSON();

    expect(json.name).toBe('AxonPulsError');
    expect(json.message).toBe('Test error');
    expect(json.code).toBe('TEST_ERROR');
    expect(json.statusCode).toBe(500);
    expect(json.timestamp).toBeDefined();
    expect(json.requestId).toBeDefined();
  });
});

describe('Specific Error Types', () => {
  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError('Invalid token');

      expect(error.name).toBe('AuthenticationError');
      expect(error.code).toBe('AUTH_FAILED');
      expect(error.statusCode).toBe(401);
      expect(error.isRetryable()).toBe(false);
      expect(error.recovery?.suggestions).toContain('Check your authentication credentials');
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error', () => {
      const error = new AuthorizationError('Insufficient permissions');

      expect(error.name).toBe('AuthorizationError');
      expect(error.code).toBe('AUTHORIZATION_FAILED');
      expect(error.statusCode).toBe(403);
      expect(error.isRetryable()).toBe(false);
      expect(error.recovery?.suggestions).toContain('Check your user permissions');
    });
  });

  describe('ConnectionError', () => {
    it('should create connection error', () => {
      const error = new ConnectionError('Connection failed');

      expect(error.name).toBe('ConnectionError');
      expect(error.code).toBe('CONNECTION_FAILED');
      expect(error.statusCode).toBe(503);
      expect(error.isRetryable()).toBe(true);
      expect(error.getRetryDelay()).toBe(2000);
      expect(error.getMaxRetries()).toBe(5);
    });
  });

  describe('WebSocketError', () => {
    it('should create WebSocket error', () => {
      const error = new WebSocketError('WebSocket connection failed');

      expect(error.name).toBe('WebSocketError');
      expect(error.code).toBe('WEBSOCKET_ERROR');
      expect(error.statusCode).toBe(503);
      expect(error.isRetryable()).toBe(true);
      expect(error.getRetryDelay()).toBe(3000);
      expect(error.getMaxRetries()).toBe(3);
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError('Rate limit exceeded', 60000);

      expect(error.name).toBe('RateLimitError');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.isRetryable()).toBe(true);
      expect(error.getRetryDelay()).toBe(60000);
      expect(error.getMaxRetries()).toBe(1);
    });
  });

  describe('QuotaExceededError', () => {
    it('should create quota exceeded error', () => {
      const error = new QuotaExceededError('Monthly quota exceeded');

      expect(error.name).toBe('QuotaExceededError');
      expect(error.code).toBe('QUOTA_EXCEEDED');
      expect(error.statusCode).toBe(402);
      expect(error.isRetryable()).toBe(false);
      expect(error.recovery?.suggestions).toContain('Upgrade your plan to increase quotas');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid input data');

      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.statusCode).toBe(400);
      expect(error.isRetryable()).toBe(false);
      expect(error.recovery?.suggestions).toContain('Check the input data format');
    });
  });

  describe('ResourceNotFoundError', () => {
    it('should create resource not found error', () => {
      const error = new ResourceNotFoundError('Organization', 'org-123');

      expect(error.name).toBe('ResourceNotFoundError');
      expect(error.code).toBe('RESOURCE_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("Organization with ID 'org-123' not found");
      expect(error.details.resource).toBe('Organization');
      expect(error.details.resourceId).toBe('org-123');
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError('Resource already exists');

      expect(error.name).toBe('ConflictError');
      expect(error.code).toBe('CONFLICT');
      expect(error.statusCode).toBe(409);
      expect(error.isRetryable()).toBe(false);
    });
  });

  describe('ServerError', () => {
    it('should create server error', () => {
      const error = new ServerError('Internal server error');

      expect(error.name).toBe('ServerError');
      expect(error.code).toBe('SERVER_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.isRetryable()).toBe(true);
      expect(error.getRetryDelay()).toBe(5000);
      expect(error.getMaxRetries()).toBe(2);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error', () => {
      const error = new ServiceUnavailableError('Service temporarily unavailable');

      expect(error.name).toBe('ServiceUnavailableError');
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.statusCode).toBe(503);
      expect(error.isRetryable()).toBe(true);
      expect(error.getRetryDelay()).toBe(10000);
      expect(error.getMaxRetries()).toBe(3);
    });
  });
});

describe('ErrorFactory', () => {
  describe('fromHttpError', () => {
    it('should create ValidationError for 400 status', () => {
      const httpError = {
        response: {
          status: 400,
          data: { message: 'Invalid input' },
        },
      };

      const error = ErrorFactory.fromHttpError(httpError);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid input');
    });

    it('should create AuthenticationError for 401 status', () => {
      const httpError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      };

      const error = ErrorFactory.fromHttpError(httpError);

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Unauthorized');
    });

    it('should create AuthorizationError for 403 status', () => {
      const httpError = {
        response: {
          status: 403,
          data: { message: 'Forbidden' },
        },
      };

      const error = ErrorFactory.fromHttpError(httpError);

      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe('Forbidden');
    });

    it('should create ResourceNotFoundError for 404 status', () => {
      const httpError = {
        response: {
          status: 404,
          data: { message: 'Not found' },
        },
      };

      const context = { resource: 'User', resourceId: 'user-123' };
      const error = ErrorFactory.fromHttpError(httpError, context);

      expect(error).toBeInstanceOf(ResourceNotFoundError);
      expect(error.message).toBe("User with ID 'user-123' not found");
    });

    it('should create ConflictError for 409 status', () => {
      const httpError = {
        response: {
          status: 409,
          data: { message: 'Conflict' },
        },
      };

      const error = ErrorFactory.fromHttpError(httpError);

      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe('Conflict');
    });

    it('should create RateLimitError for 429 status', () => {
      const httpError = {
        response: {
          status: 429,
          data: { message: 'Too many requests' },
          headers: { 'retry-after': '60' },
        },
      };

      const error = ErrorFactory.fromHttpError(httpError);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.getRetryDelay()).toBe(60000);
    });

    it('should create ServerError for 500 status', () => {
      const httpError = {
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      };

      const error = ErrorFactory.fromHttpError(httpError);

      expect(error).toBeInstanceOf(ServerError);
      expect(error.message).toBe('Internal server error');
    });

    it('should create ServiceUnavailableError for 503 status', () => {
      const httpError = {
        response: {
          status: 503,
          data: { message: 'Service unavailable' },
        },
      };

      const error = ErrorFactory.fromHttpError(httpError);

      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error.message).toBe('Service unavailable');
    });

    it('should handle errors without response', () => {
      const httpError = {
        message: 'Network error',
      };

      const error = ErrorFactory.fromHttpError(httpError);

      expect(error).toBeInstanceOf(ServerError);
      expect(error.message).toBe('Network error');
    });
  });

  describe('fromWebSocketError', () => {
    it('should create WebSocketError', () => {
      const wsError = { message: 'Connection failed' };
      const error = ErrorFactory.fromWebSocketError(wsError);

      expect(error).toBeInstanceOf(WebSocketError);
      expect(error.message).toBe('Connection failed');
    });
  });

  describe('fromConnectionError', () => {
    it('should create ConnectionError', () => {
      const connError = { message: 'Connection timeout' };
      const error = ErrorFactory.fromConnectionError(connError);

      expect(error).toBeInstanceOf(ConnectionError);
      expect(error.message).toBe('Connection timeout');
    });
  });
});

describe('ErrorHandler', () => {
  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await ErrorHandler.withRetry(operation, 3, 100);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new ConnectionError('Connection failed'))
        .mockRejectedValueOnce(new ConnectionError('Connection failed'))
        .mockResolvedValue('success');

      const result = await ErrorHandler.withRetry(operation, 3, 100);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new ValidationError('Invalid input'));

      await expect(ErrorHandler.withRetry(operation, 3, 100)).rejects.toThrow(ValidationError);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new ConnectionError('Connection failed'));

      await expect(ErrorHandler.withRetry(operation, 2, 100)).rejects.toThrow(ConnectionError);
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      expect(ErrorHandler.isRetryableError(new ConnectionError('Failed'))).toBe(true);
      expect(ErrorHandler.isRetryableError(new ServerError('Failed'))).toBe(true);
      expect(ErrorHandler.isRetryableError(new ValidationError('Failed'))).toBe(false);
      expect(ErrorHandler.isRetryableError(new Error('Generic error'))).toBe(false);
    });
  });

  describe('getErrorCode', () => {
    it('should get error code from AxonPulsError', () => {
      const error = new ValidationError('Invalid input');
      expect(ErrorHandler.getErrorCode(error)).toBe('VALIDATION_FAILED');
    });

    it('should return UNKNOWN_ERROR for generic errors', () => {
      const error = new Error('Generic error');
      expect(ErrorHandler.getErrorCode(error)).toBe('UNKNOWN_ERROR');
    });
  });
});
