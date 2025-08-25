# 🔐 JWT RS256 Setup Guide

This guide provides complete instructions for setting up production-grade JWT RS256 authentication with proper key management.

## 🚀 Quick Setup

### 1. Generate RSA Key Pair

```bash
# Generate production-ready RSA keys
npm run generate:keys
```

This creates:
- `keys/jwt-public.pem` - Public key for token verification
- `keys/jwt-private.pem` - Private key for token signing (SECURE!)
- `.env.jwt-keys` - Environment variables ready to copy

### 2. Configure Environment Variables

Copy the generated environment variables from `.env.jwt-keys` to your `.env` file:

```bash
# JWT RS256 Keys - Generated on 2025-01-XX
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----"
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----"

# JWT Configuration
JWT_ISSUER="axonstream-core"
JWT_AUDIENCE="axonstream-clients"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_EXPIRES_IN="7d"
JWT_REFRESH_SECRET="your-secure-refresh-token-secret"
```

### 3. Restart Application

```bash
npm run start:prod
```

## 🔒 Security Features

### ✅ What's Implemented

- **RS256 Algorithm**: Asymmetric encryption with 2048-bit RSA keys
- **Key Validation**: Automatic validation of key format and headers
- **Environment Fallback**: Graceful fallback to HS256 for development
- **Production Checks**: Mandatory key validation in production environment
- **Key Rotation**: Automated key rotation system (optional)
- **Secure Key Storage**: Restrictive file permissions (600) on private keys

### 🔐 Key Features

1. **Asymmetric Encryption**: 
   - Public key for token verification (can be shared)
   - Private key for token signing (must be kept secure)

2. **Production Validation**:
   - Throws error if keys are missing in production
   - Validates key format and PEM headers
   - Handles single-line environment variable format

3. **Algorithm Selection**:
   - RS256 when both keys are available
   - HS256 fallback for development (with warning)

## 🔄 Key Rotation (Optional)

Enable automatic key rotation for enhanced security:

```bash
# Enable key rotation
JWT_KEY_ROTATION_ENABLED="true"
JWT_KEY_ROTATION_INTERVAL="0 0 1 * *"  # Monthly
JWT_KEY_RETENTION_DAYS="30"
JWT_KEY_BACKUP_LOCATION="./backups/keys"
```

### Manual Key Rotation

```bash
# Rotate keys manually
npm run rotate:keys
```

## 📋 Environment Variables Reference

### Required (Production)
- `JWT_PUBLIC_KEY` - RSA public key in PEM format
- `JWT_PRIVATE_KEY` - RSA private key in PEM format

### Optional
- `JWT_ISSUER` - Token issuer (default: "axonstream-core")
- `JWT_AUDIENCE` - Token audience (default: "axonstream-clients")
- `JWT_EXPIRES_IN` - Access token expiry (default: "24h")
- `JWT_REFRESH_EXPIRES_IN` - Refresh token expiry (default: "7d")
- `JWT_REFRESH_SECRET` - Refresh token secret (separate from main JWT)

### Development Fallback
- `JWT_SECRET` - HS256 secret for development (when RS256 keys not available)

### Key Rotation
- `JWT_KEY_ROTATION_ENABLED` - Enable/disable automatic rotation
- `JWT_KEY_ROTATION_INTERVAL` - Cron expression for rotation schedule
- `JWT_KEY_RETENTION_DAYS` - Days to keep old keys for validation
- `JWT_KEY_BACKUP_LOCATION` - Directory to backup old keys

## 🏭 Production Deployment

### 1. Secret Management

**Recommended**: Use cloud secret management services:

```bash
# AWS Secrets Manager
aws secretsmanager create-secret --name jwt-public-key --secret-string "$(cat keys/jwt-public.pem)"
aws secretsmanager create-secret --name jwt-private-key --secret-string "$(cat keys/jwt-private.pem)"

# Or Azure Key Vault
az keyvault secret set --vault-name MyKeyVault --name jwt-public-key --file keys/jwt-public.pem
az keyvault secret set --vault-name MyKeyVault --name jwt-private-key --file keys/jwt-private.pem
```

### 2. Security Best Practices

- ✅ Never commit keys to version control
- ✅ Use environment variables or secret management
- ✅ Set restrictive file permissions (600) on private keys
- ✅ Enable key rotation for long-running systems
- ✅ Monitor key usage and expiration
- ✅ Backup keys securely before rotation

### 3. Docker Deployment

```dockerfile
# Add to Dockerfile
COPY keys/jwt-public.pem /app/keys/
# Private key should be mounted as secret volume in production
VOLUME ["/app/keys/private"]
```

```yaml
# docker-compose.yml
services:
  api:
    secrets:
      - jwt-private-key
    environment:
      - JWT_PUBLIC_KEY_FILE=/app/keys/jwt-public.pem
      - JWT_PRIVATE_KEY_FILE=/run/secrets/jwt-private-key

secrets:
  jwt-private-key:
    file: ./keys/jwt-private.pem
```

## 🧪 Testing JWT Implementation

### 1. Generate Test Token

```bash
# Test token generation
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 2. Verify Token

```bash
# Verify token (should return user info)
curl -X GET http://localhost:3000/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Check Key Info

```bash
# Get current key information
curl -X GET http://localhost:3000/auth/key-info \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔧 Troubleshooting

### Common Issues

1. **"JWT configuration error"**
   - Check that keys are properly formatted in environment variables
   - Ensure keys have proper PEM headers/footers
   - Verify single-line format uses `\\n` for newlines

2. **"Invalid refresh token"**
   - Refresh tokens use HS256 with separate secret
   - Check `JWT_REFRESH_SECRET` is set

3. **Development fallback warning**
   - Set proper RSA keys to use RS256
   - HS256 fallback is only for development

### Debug Commands

```bash
# Check key format
node -e "console.log(process.env.JWT_PUBLIC_KEY?.includes('BEGIN PUBLIC KEY'))"

# Validate keys
npm run generate:keys --validate-only

# Test auth system
npm run test:auth
```

## 📚 Additional Resources

- [JWT RS256 vs HS256](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [RSA Key Management Best Practices](https://tools.ietf.org/html/rfc7517)
- [NestJS JWT Documentation](https://docs.nestjs.com/security/authentication#jwt-functionality)

---

**✅ Production Status**: JWT RS256 implementation is now **PRODUCTION READY** with proper key management and security features.
