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

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  // Execute operation with retry logic
  async executeWithRetry<T>(
    operationId: string,
    operation: () => Promise<T>,
    strategy: Partial<RetryStrategy> = {},
    maxAttempts: number = 3,
    context?: Record<string, any>
  ): Promise<T> {
    const fullStrategy: RetryStrategy = {
      type: 'EXPONENTIAL',
      baseDelay: 1000,
      maxDelay: 30000,
      multiplier: 2,
      jitter: true,
      jitterRange: 0.1,
      ...strategy,
    };

    const retryOp: RetryOperation = {
      id: operationId,
      operation,
      maxAttempts,
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
    threshold: number = 5,
    timeout: number = 60000
  ): Promise<T> {
    const circuitState = this.getCircuitBreakerState(circuitId, threshold, timeout);

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
      
      if (circuitState.failureCount >= threshold) {
        circuitState.state = 'OPEN';
        circuitState.nextAttemptTime = new Date(Date.now() + timeout);
        
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
    const { strategy, currentAttempt } = retryOp;
    let delay: number;

    switch (strategy.type) {
      case 'EXPONENTIAL':
        delay = Math.min(
          strategy.baseDelay * Math.pow(strategy.multiplier || 2, currentAttempt - 1),
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

      case 'ADAPTIVE':
        // Adaptive delay based on error patterns and system load
        delay = this.calculateAdaptiveDelay(retryOp);
        break;

      default:
        delay = strategy.baseDelay;
    }

    // Apply jitter if enabled
    if (strategy.jitter) {
      const jitterRange = strategy.jitterRange || 0.1;
      const jitterFactor = 1 + (Math.random() - 0.5) * 2 * jitterRange;
      delay *= jitterFactor;
    }

    return Math.floor(Math.max(delay, 100)); // Minimum 100ms
  }

  private calculateAdaptiveDelay(retryOp: RetryOperation): number {
    const baseDelay = retryOp.strategy.baseDelay;
    const maxDelay = retryOp.strategy.maxDelay;
    
    // Factor in recent error patterns
    const recentErrors = retryOp.errors.slice(-3); // Last 3 errors
    const errorFrequency = recentErrors.length / Math.max(retryOp.currentAttempt, 1);
    
    // Factor in system load (number of active retries)
    const systemLoad = this.retryOperations.size;
    const loadFactor = Math.min(1 + systemLoad * 0.1, 3); // Max 3x multiplier
    
    // Calculate adaptive delay
    const adaptiveMultiplier = Math.pow(1.5, retryOp.currentAttempt - 1) * (1 + errorFrequency) * loadFactor;
    const delay = Math.min(baseDelay * adaptiveMultiplier, maxDelay);
    
    return delay;
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
