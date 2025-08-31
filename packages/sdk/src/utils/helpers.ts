/**
 * 🛠️ UTILITY HELPERS
 * 
 * Common utility functions used throughout the SDK
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique event ID
 */
export function createEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a unique session ID
 */
export function createSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a UUID
 */
export function generateUUID(): string {
    return uuidv4();
}

/**
 * Validate an event object
 */
export function validateEvent(event: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!event) {
        errors.push('Event is required');
        return { valid: false, errors };
    }

    if (!event.eventType) {
        errors.push('Event type is required');
    }

    if (!event.channel) {
        errors.push('Channel is required');
    }

    if (!event.payload) {
        errors.push('Payload is required');
    }

    if (!event.createdAt) {
        errors.push('Created at timestamp is required');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Sanitize event payload by removing sensitive information
 */
export function sanitizePayload(payload: Record<string, any>): Record<string, any> {
    if (!payload || typeof payload !== 'object') {
        return payload;
    }

    const sanitized = { ...payload };
    const sensitiveFields = [
        'password', 'token', 'secret', 'key', 'apiKey', 'authorization',
        'auth', 'credentials', 'private', 'sensitive', 'confidential'
    ];

    sensitiveFields.forEach(field => {
        if (field in sanitized) {
            sanitized[field] = '[REDACTED]';
        }
    });

    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            sanitized[key] = sanitizePayload(value);
        }
    }

    return sanitized;
}

/**
 * Generate a checksum for data
 */
export function generateChecksum(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as T;
    }

    if (obj instanceof Array) {
        return obj.map(item => deepClone(item)) as T;
    }

    if (typeof obj === 'object') {
        const cloned = {} as T;
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }

    return obj;
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt === maxAttempts) {
                throw lastError;
            }

            const delay = baseDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError!;
}

/**
 * Check if a value is a valid URL
 */
export function isValidUrl(value: string): boolean {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if a value is a valid email
 */
export function isValidEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 🎭 MAGIC CONFIGURATION HELPERS
 * Consolidated configuration resolution functions
 */

/**
 * Resolve API URL from organization and environment
 */
export function resolveApiUrl(org?: string, environment?: string): string {
    const resolvedOrg = org || 'demo';
    const env = environment || detectEnvironment();

    if (resolvedOrg === 'demo') {
        return 'ws://localhost:3001';
    }

    const protocol = env === 'development' ? 'ws' : 'wss';
    const domain = env === 'development' ? 'localhost:3001' : `${resolvedOrg}.axonstream.ai`;
    return `${protocol}://${domain}`;
}

/**
 * Resolve authentication token from multiple sources
 */
export function resolveAuthToken(): string | undefined {
    // Check environment variables
    if (typeof process !== 'undefined' && process.env) {
        if (process.env.AXONPULS_TOKEN) return process.env.AXONPULS_TOKEN;
        if (process.env.REACT_APP_AXONPULS_TOKEN) return process.env.REACT_APP_AXONPULS_TOKEN;
        if (process.env.VITE_AXONPULS_TOKEN) return process.env.VITE_AXONPULS_TOKEN;
    }

    // Check localStorage in browser
    if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('axonpuls_token');
        if (stored) return stored;
    }

    return undefined;
}

/**
 * Resolve API key from environment variables
 */
export function resolveApiKey(): string | undefined {
    if (typeof process !== 'undefined' && process.env) {
        if (process.env.AXONPULS_API_KEY) return process.env.AXONPULS_API_KEY;
        if (process.env.REACT_APP_AXONPULS_API_KEY) return process.env.REACT_APP_AXONPULS_API_KEY;
        if (process.env.VITE_AXONPULS_API_KEY) return process.env.VITE_AXONPULS_API_KEY;
    }
    return undefined;
}

/**
 * Resolve organization from multiple sources
 */
export function resolveOrganization(): string {
    // Check environment variables
    if (typeof process !== 'undefined' && process.env) {
        if (process.env.AXONPULS_ORG) return process.env.AXONPULS_ORG;
        if (process.env.REACT_APP_AXONPULS_ORG) return process.env.REACT_APP_AXONPULS_ORG;
    }

    // Extract from URL subdomain
    if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        const subdomain = hostname.split('.')[0];
        if (subdomain && subdomain !== 'www' && subdomain !== 'localhost') {
            return subdomain;
        }
    }

    return 'demo';
}

/**
 * Detect current environment
 */
export function detectEnvironment(): 'development' | 'staging' | 'production' {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
        if (process.env.NODE_ENV === 'development') return 'development';
        if (process.env.NODE_ENV === 'production') return 'production';
    }

    if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
            return 'development';
        }
        if (hostname.includes('staging')) {
            return 'staging';
        }
    }

    return 'production';
}

/**
 * Format milliseconds to human readable format
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`;
    return `${(ms / 86400000).toFixed(1)}d`;
}

/**
 * Generate a random string
 */
export function randomString(length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if the code is running in a browser environment
 */
export function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if the code is running in a Node.js environment
 */
export function isNode(): boolean {
    return typeof process !== 'undefined' && !!process.versions && !!process.versions.node;
}

/**
 * Get the current timestamp
 */
export function getCurrentTimestamp(): number {
    return Date.now();
}

/**
 * Get the current ISO timestamp string
 */
export function getCurrentISOTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Parse a timestamp (supports multiple formats)
 */
export function parseTimestamp(timestamp: string | number | Date): Date {
    if (timestamp instanceof Date) {
        return timestamp;
    }

    if (typeof timestamp === 'number') {
        return new Date(timestamp);
    }

    if (typeof timestamp === 'string') {
        const parsed = new Date(timestamp);
        if (isNaN(parsed.getTime())) {
            throw new Error(`Invalid timestamp: ${timestamp}`);
        }
        return parsed;
    }

    throw new Error(`Invalid timestamp type: ${typeof timestamp}`);
}
