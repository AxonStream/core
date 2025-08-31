/**
 * AxonPuls Platform - Configuration Utilities
 * Provides secure, reusable configuration validation and parsing utilities
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('ConfigUtils');

/**
 * Environment types for configuration validation
 */
export type Environment = 'development' | 'test' | 'staging' | 'production';

/**
 * Configuration validation options
 */
export interface ValidationOptions {
  required?: boolean;
  allowEmpty?: boolean;
  environment?: Environment[];
}

/**
 * Safe integer parsing with validation and fallbacks
 * Prevents parseInt(undefined) = NaN issues
 */
export function safeParseInt(
  value: string | undefined,
  fallback: number,
  options: ValidationOptions = {}
): number {
  const { required = false, environment = [] } = options;
  const currentEnv = (process.env.NODE_ENV as Environment) || 'development';
  const isProduction = currentEnv === 'production';
  
  // Production validation
  if (isProduction && required && !value) {
    throw new Error(`Environment variable is required in production but not provided`);
  }
  
  // Environment-specific validation
  if (environment.length > 0 && environment.includes(currentEnv) && !value) {
    throw new Error(`Environment variable is required in ${currentEnv} environment`);
  }
  
  if (!value) {
    return fallback;
  }
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    logger.warn(`Invalid integer value provided, using fallback: ${fallback}`);
    return fallback;
  }
  
  return parsed;
}

/**
 * Safe float parsing with validation and fallbacks
 */
export function safeParseFloat(
  value: string | undefined,
  fallback: number,
  options: ValidationOptions = {}
): number {
  const { required = false, environment = [] } = options;
  const currentEnv = (process.env.NODE_ENV as Environment) || 'development';
  const isProduction = currentEnv === 'production';
  
  if (isProduction && required && !value) {
    throw new Error(`Environment variable is required in production but not provided`);
  }
  
  if (environment.length > 0 && environment.includes(currentEnv) && !value) {
    throw new Error(`Environment variable is required in ${currentEnv} environment`);
  }
  
  if (!value) {
    return fallback;
  }
  
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    logger.warn(`Invalid float value provided, using fallback: ${fallback}`);
    return fallback;
  }
  
  return parsed;
}

/**
 * Safe boolean parsing with validation
 */
export function safeParseBool(
  value: string | undefined,
  fallback: boolean,
  options: ValidationOptions = {}
): boolean {
  const { required = false, environment = [] } = options;
  const currentEnv = (process.env.NODE_ENV as Environment) || 'development';
  const isProduction = currentEnv === 'production';
  
  if (isProduction && required && value === undefined) {
    throw new Error(`Environment variable is required in production but not provided`);
  }
  
  if (environment.length > 0 && environment.includes(currentEnv) && value === undefined) {
    throw new Error(`Environment variable is required in ${currentEnv} environment`);
  }
  
  if (value === undefined) {
    return fallback;
  }
  
  return value === 'true';
}

/**
 * Secure string validation with production requirements
 */
export function validateSecureString(
  value: string | undefined,
  name: string,
  options: ValidationOptions = {}
): string | undefined {
  const { required = false, allowEmpty = false, environment = [] } = options;
  const currentEnv = (process.env.NODE_ENV as Environment) || 'development';
  const isProduction = currentEnv === 'production';
  
  // Production validation
  if (isProduction && required && !value) {
    throw new Error(`${name} is required in production environment`);
  }
  
  // Environment-specific validation
  if (environment.length > 0 && environment.includes(currentEnv) && !value) {
    throw new Error(`${name} is required in ${currentEnv} environment`);
  }
  
  // Empty string validation
  if (value === '' && !allowEmpty) {
    if (required) {
      throw new Error(`${name} cannot be empty`);
    }
    return undefined;
  }
  
  return value;
}

/**
 * Validate required production secrets
 */
export function validateProductionSecrets(secrets: Record<string, string | undefined>): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    return;
  }
  
  const missingSecrets: string[] = [];
  
  for (const [name, value] of Object.entries(secrets)) {
    if (!value || value.trim() === '') {
      missingSecrets.push(name);
    }
  }
  
  if (missingSecrets.length > 0) {
    throw new Error(
      `The following secrets are required in production: ${missingSecrets.join(', ')}. ` +
      'Run: npm run generate:secrets to create secure secrets.'
    );
  }
}

/**
 * Get current environment with validation
 */
export function getCurrentEnvironment(): Environment {
  const env = process.env.NODE_ENV as Environment;
  const validEnvironments: Environment[] = ['development', 'test', 'staging', 'production'];
  
  if (!env || !validEnvironments.includes(env)) {
    logger.warn(`Invalid NODE_ENV: ${env}, defaulting to development`);
    return 'development';
  }
  
  return env;
}

/**
 * Check if current environment is production
 */
export function isProduction(): boolean {
  return getCurrentEnvironment() === 'production';
}

/**
 * Check if current environment is development
 */
export function isDevelopment(): boolean {
  return getCurrentEnvironment() === 'development';
}

/**
 * Validate RSA key format and structure
 */
export function validateRSAKey(key: string | undefined, keyType: 'public' | 'private'): string {
  if (!key) {
    throw new Error(`JWT_${keyType.toUpperCase()}_KEY environment variable is required for RS256 algorithm`);
  }

  // Handle single-line environment variable format (with \n)
  const formattedKey = key.replace(/\\n/g, '\n');

  // Validate key format
  const expectedHeader = keyType === 'public' ? 'BEGIN PUBLIC KEY' : 'BEGIN PRIVATE KEY';
  const expectedFooter = keyType === 'public' ? 'END PUBLIC KEY' : 'END PRIVATE KEY';

  if (!formattedKey.includes(expectedHeader) || !formattedKey.includes(expectedFooter)) {
    throw new Error(`Invalid JWT ${keyType} key format. Expected PEM format with proper headers.`);
  }

  return formattedKey;
}

/**
 * Configuration validation summary for logging
 */
export function logConfigurationSummary(configName: string, config: Record<string, any>): void {
  const env = getCurrentEnvironment();
  const sensitiveKeys = ['secret', 'password', 'key', 'token'];
  
  const sanitizedConfig = Object.entries(config).reduce((acc, [key, value]) => {
    const isSensitive = sensitiveKeys.some(sensitive => 
      key.toLowerCase().includes(sensitive)
    );
    
    if (isSensitive && value) {
      acc[key] = '[REDACTED]';
    } else {
      acc[key] = value;
    }
    
    return acc;
  }, {} as Record<string, any>);
  
  logger.log(`${configName} configuration loaded for ${env} environment`);
  logger.debug(`${configName} config:`, sanitizedConfig);
}
