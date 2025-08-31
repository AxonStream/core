import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface RetryOperation {
  id: string;
  operation: () => Promise<any>;
  maxAttempts: number;
  currentAttempt: number;
  strategy: RetryStrategy;
  context?: Record<string, any>;
  createdAt: Date;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;
  errors: Array<{ attempt: number; error: string; timestamp: Date }>;
}

export interface RetryStrategy {
  type: 'EXPONENTIAL' | 'LINEAR' | 'FIXED' | 'ADAPTIVE' | 'CIRCUIT_BREAKER';
  baseDelay: number;
  maxDelay: number;
  multiplier?: number;
  jitter?: boolean;
  jitterRange?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

@Injectable()
export class RetryManagerService {
  private readonly logger = new Logger(RetryManagerService.name);
  private retryOperations = new Map<string, RetryOperation>();
  private retryTimeouts = new Map<string, NodeJS.Timeout>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private config: {
    // Default retry configuration
    defaults: {
      maxAttempts: number;
      baseDelay: number;
      maxDelay: number;
      multiplier: number;
      jitter: boolean;
      jitterRange: number;
      minDelay: number;
    };
    // Circuit breaker configuration
    circuitBreaker: {
      defaultThreshold: number;
      defaultTimeout: number;
      maxTimeout: number;
      minTimeout: number;
    };
    // Adaptive retry configuration
    adaptive: {
      enabled: boolean;
      errorPatternWeight: number;
      systemLoadWeight: number;
      maxLoadMultiplier: number;
      errorHistorySize: number;
    };
    // Monitoring configuration
    monitoring: {
      cleanupInterval: number;
      maxOperationAge: number;
      metricsRetention: number;
    };
  };

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.loadConfiguration();
    this.setupConfigurationWatcher();
  }

  private loadConfiguration(): void {
    this.config = {
      defaults: {
        maxAttempts: this.configService.get<number>('retry.defaults.maxAttempts', 3),
        baseDelay: this.configService.get<number>('retry.defaults.baseDelay', 1000),
        maxDelay: this.configService.get<number>('retry.defaults.maxDelay', 30000),
        multiplier: this.configService.get<number>('retry.defaults.multiplier', 2),
        jitter: this.configService.get<boolean>('retry.defaults.jitter', true),
        jitterRange: this.configService.get<number>('retry.defaults.jitterRange', 0.1),
        minDelay: this.configService.get<number>('retry.defaults.minDelay', 100),
      },
      circuitBreaker: {
        defaultThreshold: this.configService.get<number>('retry.circuitBreaker.defaultThreshold', 5),
        defaultTimeout: this.configService.get<number>('retry.circuitBreaker.defaultTimeout', 60000),
        maxTimeout: this.configService.get<number>('retry.circuitBreaker.maxTimeout', 300000), // 5 minutes
        minTimeout: this.configService.get<number>('retry.circuitBreaker.minTimeout', 10000), // 10 seconds
      },
      adaptive: {
        enabled: this.configService.get<boolean>('retry.adaptive.enabled', true),
        errorPatternWeight: this.configService.get<number>('retry.adaptive.errorPatternWeight', 0.6),
        systemLoadWeight: this.configService.get<number>('retry.adaptive.systemLoadWeight', 0.4),
        maxLoadMultiplier: this.configService.get<number>('retry.adaptive.maxLoadMultiplier', 3),
        errorHistorySize: this.configService.get<number>('retry.adaptive.errorHistorySize', 3),
      },
      monitoring: {
        cleanupInterval: this.configService.get<number>('retry.monitoring.cleanupInterval', 300000), // 5 minutes
        maxOperationAge: this.configService.get<number>('retry.monitoring.maxOperationAge', 3600000), // 1 hour
        metricsRetention: this.configService.get<number>('retry.monitoring.metricsRetention', 86400000), // 24 hours
      },
    };
  }

  private setupConfigurationWatcher(): void {
    // Watch for configuration changes via Redis pub/sub
    // In a real implementation, this would be injected from RedisService
    setInterval(() => {
      // Check for configuration updates
      this.loadConfiguration();
    }, 30000); // Check every 30 seconds
  }

  // Execute operation with retry logic
  async executeWithRetry<T>(
    operationId: string,
    operation: () => Promise<T>,
    strategy: Partial<RetryStrategy> = {},
    maxAttempts?: number,
    context?: Record<string, any>
  ): Promise<T> {
    const fullStrategy: RetryStrategy = {
      type: 'EXPONENTIAL',
      baseDelay: this.config.defaults.baseDelay,
      maxDelay: this.config.defaults.maxDelay,
      multiplier: this.config.defaults.multiplier,
      jitter: this.config.defaults.jitter,
      jitterRange: this.config.defaults.jitterRange,
      ...strategy,
    };

    const retryOp: RetryOperation = {
      id: operationId,
      operation,
      maxAttempts: maxAttempts || this.config.defaults.maxAttempts,
      currentAttempt: 0,
      strategy: fullStrategy,
      context,
      createdAt: new Date(),
      errors: [],
    };

    this.retryOperations.set(operationId, retryOp);

    try {
      return await this.attemptOperation(retryOp);
    } finally {
      this.retryOperations.delete(operationId);
      const timeout = this.retryTimeouts.get(operationId);
      if (timeout) {
        clearTimeout(timeout);
        this.retryTimeouts.delete(operationId);
      }
    }
  }

  // Schedule retry for failed operation
  async scheduleRetry(
    operationId: string,
    operation: () => Promise<any>,
    strategy: RetryStrategy,
    maxAttempts: number,
    context?: Record<string, any>
  ): Promise<void> {
    const retryOp: RetryOperation = {
      id: operationId,
      operation,
      maxAttempts,
      currentAttempt: 0,
      strategy,
      context,
      createdAt: new Date(),
      errors: [],
    };

    this.retryOperations.set(operationId, retryOp);
    await this.scheduleNextAttempt(retryOp);
  }

  // Cancel retry operation
  cancelRetry(operationId: string): boolean {
    const timeout = this.retryTimeouts.get(operationId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(operationId);
    }

    const operation = this.retryOperations.get(operationId);
    if (operation) {
      this.retryOperations.delete(operationId);

      this.eventEmitter.emit('retry.cancelled', {
        operationId,
        attempts: operation.currentAttempt,
        context: operation.context,
      });

      return true;
    }

    return false;
  }

  // Get retry operation status
  getRetryStatus(operationId: string): RetryOperation | null {
    return this.retryOperations.get(operationId) || null;
  }

  // Get all active retry operations
  getActiveRetries(): RetryOperation[] {
    return Array.from(this.retryOperations.values());
  }

  // Circuit breaker operations
  async executeWithCircuitBreaker<T>(
    circuitId: string,
    operation: () => Promise<T>,
    threshold?: number,
    timeout?: number
  ): Promise<T> {
    const circuitThreshold = threshold || this.config.circuitBreaker.defaultThreshold;
    const circuitTimeout = Math.min(
      Math.max(timeout || this.config.circuitBreaker.defaultTimeout, this.config.circuitBreaker.minTimeout),
      this.config.circuitBreaker.maxTimeout
    );
    const circuitState = this.getCircuitBreakerState(circuitId, circuitThreshold, circuitTimeout);

    if (circuitState.state === 'OPEN') {
      if (Date.now() < (circuitState.nextAttemptTime?.getTime() || 0)) {
        throw new Error(`Circuit breaker ${circuitId} is OPEN. Next attempt at ${circuitState.nextAttemptTime}`);
      } else {
        // Transition to HALF_OPEN
        circuitState.state = 'HALF_OPEN';
        this.logger.log(`Circuit breaker ${circuitId} transitioning to HALF_OPEN`);
      }
    }

    try {
      const result = await operation();

      // Success - reset circuit breaker if it was HALF_OPEN
      if (circuitState.state === 'HALF_OPEN') {
        circuitState.state = 'CLOSED';
        circuitState.failureCount = 0;
        circuitState.lastFailureTime = undefined;
        circuitState.nextAttemptTime = undefined;

        this.eventEmitter.emit('circuit-breaker.closed', {
          circuitId,
          previousFailures: circuitState.failureCount,
        });

        this.logger.log(`Circuit breaker ${circuitId} reset to CLOSED`);
      }

      return result;
    } catch (error) {
      // Failure - increment failure count
      circuitState.failureCount++;
      circuitState.lastFailureTime = new Date();

      if (circuitState.failureCount >= circuitThreshold) {
        circuitState.state = 'OPEN';
        circuitState.nextAttemptTime = new Date(Date.now() + circuitTimeout);

        this.eventEmitter.emit('circuit-breaker.opened', {
          circuitId,
          failureCount: circuitState.failureCount,
          nextAttemptTime: circuitState.nextAttemptTime,
        });

        this.logger.warn(`Circuit breaker ${circuitId} OPENED after ${circuitState.failureCount} failures`);
      }

      throw error;
    }
  }

  // Private helper methods
  private async attemptOperation<T>(retryOp: RetryOperation): Promise<T> {
    while (retryOp.currentAttempt < retryOp.maxAttempts) {
      retryOp.currentAttempt++;
      retryOp.lastAttemptAt = new Date();

      try {
        this.eventEmitter.emit('retry.attempt', {
          operationId: retryOp.id,
          attempt: retryOp.currentAttempt,
          maxAttempts: retryOp.maxAttempts,
          context: retryOp.context,
        });

        const result = await retryOp.operation();

        this.eventEmitter.emit('retry.success', {
          operationId: retryOp.id,
          attempts: retryOp.currentAttempt,
          context: retryOp.context,
        });

        return result;
      } catch (error) {
        const errorInfo = {
          attempt: retryOp.currentAttempt,
          error: error.message || String(error),
          timestamp: new Date(),
        };

        retryOp.errors.push(errorInfo);

        this.eventEmitter.emit('retry.failed', {
          operationId: retryOp.id,
          attempt: retryOp.currentAttempt,
          maxAttempts: retryOp.maxAttempts,
          error: errorInfo.error,
          context: retryOp.context,
        });

        if (retryOp.currentAttempt >= retryOp.maxAttempts) {
          this.eventEmitter.emit('retry.exhausted', {
            operationId: retryOp.id,
            attempts: retryOp.currentAttempt,
            errors: retryOp.errors,
            context: retryOp.context,
          });

          throw new Error(`Operation ${retryOp.id} failed after ${retryOp.currentAttempt} attempts. Last error: ${errorInfo.error}`);
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(retryOp);
        retryOp.nextAttemptAt = new Date(Date.now() + delay);

        this.logger.debug(`Retrying operation ${retryOp.id} in ${delay}ms (attempt ${retryOp.currentAttempt + 1}/${retryOp.maxAttempts})`);

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`Operation ${retryOp.id} failed after all retry attempts`);
  }

  private async scheduleNextAttempt(retryOp: RetryOperation): Promise<void> {
    if (retryOp.currentAttempt >= retryOp.maxAttempts) {
      this.eventEmitter.emit('retry.exhausted', {
        operationId: retryOp.id,
        attempts: retryOp.currentAttempt,
        errors: retryOp.errors,
        context: retryOp.context,
      });
      return;
    }

    const delay = this.calculateDelay(retryOp);
    retryOp.nextAttemptAt = new Date(Date.now() + delay);

    const timeout = setTimeout(async () => {
      try {
        await this.attemptOperation(retryOp);
      } catch (error) {
        // Operation failed completely, clean up
        this.retryOperations.delete(retryOp.id);
        this.retryTimeouts.delete(retryOp.id);
      }
    }, delay);

    this.retryTimeouts.set(retryOp.id, timeout);
  }

  private calculateDelay(retryOp: RetryOperation): number {
    const { strategy } = retryOp;

    switch (strategy.type) {
      case 'ADAPTIVE':
        return this.calculateAdaptiveDelay(retryOp);
      default:
        return this.calculateStandardDelay(retryOp);
    }
  }

  private calculateAdaptiveDelay(retryOp: RetryOperation): number {
    if (!this.config.adaptive.enabled) {
      return this.calculateStandardDelay(retryOp);
    }

    const baseDelay = retryOp.strategy.baseDelay;
    const maxDelay = retryOp.strategy.maxDelay;

    // Factor in recent error patterns
    const recentErrors = retryOp.errors.slice(-this.config.adaptive.errorHistorySize);
    const errorFrequency = recentErrors.length / Math.max(retryOp.currentAttempt, 1);

    // Factor in system load (number of active retries)
    const systemLoad = this.retryOperations.size;
    const loadFactor = Math.min(1 + systemLoad * 0.1, this.config.adaptive.maxLoadMultiplier);

    // Calculate adaptive delay with weighted factors
    const errorPatternFactor = 1 + (errorFrequency * this.config.adaptive.errorPatternWeight);
    const systemLoadFactor = 1 + ((loadFactor - 1) * this.config.adaptive.systemLoadWeight);

    const adaptiveMultiplier = Math.pow(1.5, retryOp.currentAttempt - 1) * errorPatternFactor * systemLoadFactor;
    const delay = Math.min(baseDelay * adaptiveMultiplier, maxDelay);

    return Math.max(delay, this.config.defaults.minDelay);
  }

  private calculateStandardDelay(retryOp: RetryOperation): number {
    const { strategy, currentAttempt } = retryOp;
    let delay: number;

    switch (strategy.type) {
      case 'EXPONENTIAL':
        delay = Math.min(
          strategy.baseDelay * Math.pow(strategy.multiplier || this.config.defaults.multiplier, currentAttempt - 1),
          strategy.maxDelay
        );
        break;

      case 'LINEAR':
        delay = Math.min(
          strategy.baseDelay * currentAttempt,
          strategy.maxDelay
        );
        break;

      case 'FIXED':
        delay = strategy.baseDelay;
        break;

      default:
        delay = strategy.baseDelay;
    }

    // Apply jitter if enabled
    if (strategy.jitter) {
      const jitterRange = strategy.jitterRange || this.config.defaults.jitterRange;
      const jitterFactor = 1 + (Math.random() - 0.5) * 2 * jitterRange;
      delay *= jitterFactor;
    }

    return Math.floor(Math.max(delay, this.config.defaults.minDelay));
  }

  private getCircuitBreakerState(circuitId: string, threshold: number, timeout: number): CircuitBreakerState {
    if (!this.circuitBreakers.has(circuitId)) {
      this.circuitBreakers.set(circuitId, {
        state: 'CLOSED',
        failureCount: 0,
      });
    }

    return this.circuitBreakers.get(circuitId)!;
  }

  // Public API for monitoring
  getCircuitBreakerStatus(circuitId: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(circuitId) || null;
  }

  getAllCircuitBreakers(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  resetCircuitBreaker(circuitId: string): boolean {
    const circuit = this.circuitBreakers.get(circuitId);
    if (circuit) {
      circuit.state = 'CLOSED';
      circuit.failureCount = 0;
      circuit.lastFailureTime = undefined;
      circuit.nextAttemptTime = undefined;

      this.eventEmitter.emit('circuit-breaker.reset', { circuitId });
      this.logger.log(`Circuit breaker ${circuitId} manually reset`);

      return true;
    }
    return false;
  }
}
