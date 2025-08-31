import { registerAs } from '@nestjs/config';
import {
  validateProductionSecrets,
  safeParseInt,
  safeParseBool,
  isProduction,
  isDevelopment,
  logConfigurationSummary,
} from './config.utils';

export const databaseConfig = registerAs('database', () => {
  // Validate required production secrets
  validateProductionSecrets({
    DATABASE_URL: process.env.DATABASE_URL,
  });

  const config = {
    // NO FALLBACK DATABASE URL - fail if missing in production
    url: process.env.DATABASE_URL || (isDevelopment() ? 'postgresql://postgres:password@localhost:5432/AxonPuls_db' : undefined),
    host: process.env.DB_HOST || (isDevelopment() ? 'localhost' : undefined),
    port: safeParseInt(process.env.DB_PORT, 5432, { required: false }),
    // NO FALLBACK CREDENTIALS - fail if missing in production
    username: process.env.DB_USERNAME || (isDevelopment() ? 'postgres' : undefined),
    password: process.env.DB_PASSWORD || (isDevelopment() ? 'password' : undefined),
    database: process.env.DB_NAME || (isDevelopment() ? 'AxonPuls_db' : undefined),
    ssl: safeParseBool(process.env.DB_SSL, isProduction(), { required: false }),
    logging: isDevelopment(),
    synchronize: isDevelopment(),
    maxConnections: safeParseInt(process.env.DB_MAX_CONNECTIONS, 100, { required: false }),
    acquireTimeout: safeParseInt(process.env.DB_ACQUIRE_TIMEOUT, 60000, { required: false }),
    timeout: safeParseInt(process.env.DB_TIMEOUT, 60000, { required: false }),
    retryAttempts: safeParseInt(process.env.DB_RETRY_ATTEMPTS, 3, { required: false }),
    retryDelay: safeParseInt(process.env.DB_RETRY_DELAY, 3000, { required: false }),
  };

  // Log configuration summary (with sensitive data redacted)
  logConfigurationSummary('Database', config);

  return config;
});
