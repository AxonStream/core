#!/bin/bash

# Security Fix Script for Hardened API
# This script fixes critical security vulnerabilities in the hardened API

set -e

echo "🔒 Starting Hardened API Security Fixes..."

HARDENED_API_DIR="apps/axonstream_api_hardened_full_v6/api"
ORIGINAL_API_DIR="apps/api"
BACKUP_DIR="backup/hardened-api-$(date +%Y%m%d_%H%M%S)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Backup hardened API
echo "📦 Creating backup of hardened API..."
mkdir -p "$BACKUP_DIR"
cp -r "$HARDENED_API_DIR" "$BACKUP_DIR/"
print_status "Backup created at $BACKUP_DIR"

# Copy config utilities from original API
echo "📋 Copying configuration utilities..."
cp "$ORIGINAL_API_DIR/src/config/config.utils.ts" "$HARDENED_API_DIR/src/config/"
print_status "Configuration utilities copied"

echo "🔧 Applying security fixes..."

# Fix 1: Database Configuration
echo "   Fixing database configuration..."
cat > "$HARDENED_API_DIR/src/config/database.config.ts" << 'EOF'
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
EOF

# Fix 2: Auth Configuration
echo "   Fixing auth configuration..."
cat > "$HARDENED_API_DIR/src/config/auth.config.ts" << 'EOF'
import { registerAs } from '@nestjs/config';
import {
  validateRSAKey,
  validateProductionSecrets,
  safeParseInt,
  isProduction,
  logConfigurationSummary,
} from './config.utils';

export const authConfig = registerAs('auth', () => {
  // Validate required production secrets
  validateProductionSecrets({
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  });

  // Validate RSA keys for production
  if (isProduction()) {
    if (!process.env.JWT_PUBLIC_KEY || !process.env.JWT_PRIVATE_KEY) {
      throw new Error(
        'JWT_PUBLIC_KEY and JWT_PRIVATE_KEY are required in production. ' +
        'Run: npm run generate:keys'
      );
    }
  }

  const config = {
    jwt: {
      // For RS256, use public key for verification and private key for signing
      publicKey: process.env.JWT_PUBLIC_KEY
        ? validateRSAKey(process.env.JWT_PUBLIC_KEY, 'public')
        : null,
      privateKey: process.env.JWT_PRIVATE_KEY
        ? validateRSAKey(process.env.JWT_PRIVATE_KEY, 'private')
        : null,
      // NO FALLBACK SECRETS - fail if missing in production
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      algorithm: (process.env.JWT_PUBLIC_KEY && process.env.JWT_PRIVATE_KEY) ? 'RS256' : 'HS256',
      issuer: process.env.JWT_ISSUER || 'axonstream-core',
      audience: process.env.JWT_AUDIENCE || 'axonstream-clients',
    },
    refresh: {
      // NO FALLBACK SECRETS - fail if missing in production
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    bcrypt: {
      saltRounds: safeParseInt(process.env.BCRYPT_SALT_ROUNDS, 12, { required: false }),
    },
    session: {
      maxAge: safeParseInt(process.env.SESSION_MAX_AGE, 86400000, { required: false }), // 24 hours
      secure: isProduction(),
      httpOnly: true,
      sameSite: 'strict' as const,
    },
    rateLimit: {
      windowMs: safeParseInt(process.env.AUTH_RATE_LIMIT_WINDOW, 900000, { required: false }), // 15 minutes
      max: safeParseInt(process.env.AUTH_RATE_LIMIT_MAX, 5, { required: false }), // 5 attempts per window
    },
  };

  // Log configuration summary (with sensitive data redacted)
  logConfigurationSummary('Auth', config);

  return config;
});
EOF

print_status "Critical security fixes applied"

# Validate fixes
echo "🔍 Validating security fixes..."
cd "$HARDENED_API_DIR"

# Check if TypeScript compiles
if npx tsc --noEmit; then
    print_status "TypeScript compilation successful"
else
    print_error "TypeScript compilation failed"
    exit 1
fi

print_status "Security fixes validation completed"

echo ""
echo "🎉 Hardened API security fixes completed successfully!"
echo ""
echo "📊 Fixes Applied:"
echo "   • Database configuration: Added safe parsing and validation"
echo "   • Auth configuration: Added production secret validation"
echo "   • Configuration utilities: Copied from original API"
echo "   • TypeScript compilation: ✅ Validated"
echo ""
echo "🔗 Next Steps:"
echo "   1. Test the fixed configuration in staging"
echo "   2. Run integration tests"
echo "   3. Begin Phase 2: Code deduplication"
