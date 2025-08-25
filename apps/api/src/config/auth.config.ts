import { registerAs } from '@nestjs/config';

/**
 * Validates and formats RSA key for JWT RS256 algorithm
 */
function validateRSAKey(key: string | undefined, keyType: 'public' | 'private'): string {
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

export const authConfig = registerAs('auth', () => {
  // Validate required environment variables for production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_PUBLIC_KEY || !process.env.JWT_PRIVATE_KEY) {
      throw new Error('JWT_PUBLIC_KEY and JWT_PRIVATE_KEY are required in production. Run: npm run generate:keys');
    }
  }

  return {
    jwt: {
      // For RS256, use public key for verification and private key for signing
      publicKey: process.env.JWT_PUBLIC_KEY ? validateRSAKey(process.env.JWT_PUBLIC_KEY, 'public') : null,
      privateKey: process.env.JWT_PRIVATE_KEY ? validateRSAKey(process.env.JWT_PRIVATE_KEY, 'private') : null,
      secret: process.env.JWT_SECRET || 'dev-fallback-secret-change-in-production', // Fallback for development only
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      algorithm: process.env.JWT_PUBLIC_KEY && process.env.JWT_PRIVATE_KEY ? 'RS256' : 'HS256',
      issuer: process.env.JWT_ISSUER || 'axonstream-core',
      audience: process.env.JWT_AUDIENCE || 'axonstream-clients',
    },
    refresh: {
      secret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    bcrypt: {
      saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12'),
    },
    session: {
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
    },
    rateLimit: {
      windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW || '900000'), // 15 minutes
      max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'), // 5 attempts per window
    },
  };
});  
