export enum AxonPulsErrorCode {
    // Connection errors
    CONNECTION_FAILED = 'AxonPuls_CONNECTION_FAILED',
    CONNECTION_TIMEOUT = 'AxonPuls_CONNECTION_TIMEOUT',
    CONNECTION_LOST = 'AxonPuls_CONNECTION_LOST',

    // Authentication errors
    AUTH_INVALID_TOKEN = 'AxonPuls_AUTH_INVALID_TOKEN',
    AUTH_TOKEN_EXPIRED = 'AxonPuls_AUTH_TOKEN_EXPIRED',
    AUTH_INSUFFICIENT_PERMISSIONS = 'AxonPuls_AUTH_INSUFFICIENT_PERMISSIONS',

    // Validation errors
    INVALID_PAYLOAD = 'AxonPuls_INVALID_PAYLOAD',
    PAYLOAD_TOO_LARGE = 'AxonPuls_PAYLOAD_TOO_LARGE',
    INVALID_CHANNEL = 'AxonPuls_INVALID_CHANNEL',

    // Rate limiting
    RATE_LIMIT_EXCEEDED = 'AxonPuls_RATE_LIMIT_EXCEEDED',
    SUBSCRIPTION_LIMIT_EXCEEDED = 'AxonPuls_SUBSCRIPTION_LIMIT_EXCEEDED',

    // Tenant isolation
    TENANT_ISOLATION_VIOLATION = 'AxonPuls_TENANT_ISOLATION_VIOLATION',
    INVALID_ORGANIZATION = 'AxonPuls_INVALID_ORGANIZATION',

    // Circuit breaker
    CIRCUIT_BREAKER_OPEN = 'AxonPuls_CIRCUIT_BREAKER_OPEN',

    // General errors
    UNKNOWN_ERROR = 'AxonPuls_UNKNOWN_ERROR',
    INTERNAL_ERROR = 'AxonPuls_INTERNAL_ERROR',
}

export class AxonPulsError extends Error {
    public readonly code: AxonPulsErrorCode;
    public readonly details?: Record<string, any>;
    public readonly timestamp: number;

    constructor(
        message: string,
        code: AxonPulsErrorCode = AxonPulsErrorCode.UNKNOWN_ERROR,
        details?: Record<string, any>
    ) {
        super(message);
        this.name = 'AxonPulsError';
        this.code = code;
        this.details = details;
        this.timestamp = Date.now();

        // Ensure proper prototype chain
        Object.setPrototypeOf(this, AxonPulsError.prototype);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack,
        };
    }

    static fromError(error: Error, code?: AxonPulsErrorCode): AxonPulsError {
        if (error instanceof AxonPulsError) {
            return error;
        }

        return new AxonPulsError(
            error.message,
            code || AxonPulsErrorCode.UNKNOWN_ERROR,
            { originalError: error.name }
        );
    }

    static isAxonPulsError(error: any): error is AxonPulsError {
        return error instanceof AxonPulsError;
    }
}

// Specific error classes
export class AxonPulsConnectionError extends AxonPulsError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, AxonPulsErrorCode.CONNECTION_FAILED, details);
        this.name = 'AxonPulsConnectionError';
    }
}

export class AxonPulsAuthenticationError extends AxonPulsError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, AxonPulsErrorCode.AUTH_INVALID_TOKEN, details);
        this.name = 'AxonPulsAuthenticationError';
    }
}

export class AxonPulsValidationError extends AxonPulsError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, AxonPulsErrorCode.INVALID_PAYLOAD, details);
        this.name = 'AxonPulsValidationError';
    }
}

export class AxonPulsRateLimitError extends AxonPulsError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, AxonPulsErrorCode.RATE_LIMIT_EXCEEDED, details);
        this.name = 'AxonPulsRateLimitError';
    }
}

export class AxonPulsTenantIsolationError extends AxonPulsError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, AxonPulsErrorCode.TENANT_ISOLATION_VIOLATION, details);
        this.name = 'AxonPulsTenantIsolationError';
    }
}

export class AxonPulsCircuitBreakerError extends AxonPulsError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, AxonPulsErrorCode.CIRCUIT_BREAKER_OPEN, details);
        this.name = 'AxonPulsCircuitBreakerError';
    }
}

// Error factory function
export function createAxonPulsError(
    message: string,
    code: AxonPulsErrorCode,
    details?: Record<string, any>
): AxonPulsError {
    switch (code) {
        case AxonPulsErrorCode.CONNECTION_FAILED:
        case AxonPulsErrorCode.CONNECTION_TIMEOUT:
        case AxonPulsErrorCode.CONNECTION_LOST:
            return new AxonPulsConnectionError(message, details);

        case AxonPulsErrorCode.AUTH_INVALID_TOKEN:
        case AxonPulsErrorCode.AUTH_TOKEN_EXPIRED:
        case AxonPulsErrorCode.AUTH_INSUFFICIENT_PERMISSIONS:
            return new AxonPulsAuthenticationError(message, details);

        case AxonPulsErrorCode.INVALID_PAYLOAD:
        case AxonPulsErrorCode.PAYLOAD_TOO_LARGE:
        case AxonPulsErrorCode.INVALID_CHANNEL:
            return new AxonPulsValidationError(message, details);

        case AxonPulsErrorCode.RATE_LIMIT_EXCEEDED:
        case AxonPulsErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED:
            return new AxonPulsRateLimitError(message, details);

        case AxonPulsErrorCode.TENANT_ISOLATION_VIOLATION:
        case AxonPulsErrorCode.INVALID_ORGANIZATION:
            return new AxonPulsTenantIsolationError(message, details);

        case AxonPulsErrorCode.CIRCUIT_BREAKER_OPEN:
            return new AxonPulsCircuitBreakerError(message, details);

        default:
            return new AxonPulsError(message, code, details);
    }
}
