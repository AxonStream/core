import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/AxonPuls_db',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'AxonPuls_db',
  ssl: process.env.DB_SSL === 'true',
  logging: process.env.NODE_ENV === 'development',
  synchronize: process.env.NODE_ENV === 'development',
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '100'),
  acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'),
  timeout: parseInt(process.env.DB_TIMEOUT || '60000'),
  retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.DB_RETRY_DELAY || '3000'),
}));
