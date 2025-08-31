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
