#!/usr/bin/env node

/**
 * RSA Key Pair Generator for JWT RS256 Signing
 * 
 * This script generates a production-ready RSA key pair for JWT signing
 * and provides the keys in the correct format for environment variables.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateRSAKeyPair() {
    console.log('🔐 Generating RSA key pair for JWT RS256 signing...\n');

    // Generate RSA key pair with 2048-bit key size (minimum recommended for production)
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    return { publicKey, privateKey };
}

function createEnvTemplate(publicKey, privateKey) {
    // Convert keys to single-line format for environment variables
    const publicKeyOneLine = publicKey.replace(/\n/g, '\\n');
    const privateKeyOneLine = privateKey.replace(/\n/g, '\\n');

    return `# JWT RS256 Keys - Generated on ${new Date().toISOString()}
# IMPORTANT: Keep private key secure and never commit to version control

# JWT Public Key (for token verification)
JWT_PUBLIC_KEY="${publicKeyOneLine}"

# JWT Private Key (for token signing - KEEP SECURE!)
JWT_PRIVATE_KEY="${privateKeyOneLine}"

# JWT Configuration
JWT_ISSUER="axonstream-core"
JWT_AUDIENCE="axonstream-clients"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_EXPIRES_IN="7d"

# Generate a secure random secret for refresh tokens
JWT_REFRESH_SECRET="${crypto.randomBytes(64).toString('hex')}"
`;
}

function saveKeysToFiles(publicKey, privateKey) {
    const keysDir = path.join(__dirname, '../keys');

    // Create keys directory if it doesn't exist
    if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir, { recursive: true });
    }

    // Save keys to separate files
    fs.writeFileSync(path.join(keysDir, 'jwt-public.pem'), publicKey);
    fs.writeFileSync(path.join(keysDir, 'jwt-private.pem'), privateKey);

    // Set restrictive permissions on private key
    try {
        fs.chmodSync(path.join(keysDir, 'jwt-private.pem'), 0o600);
    } catch (error) {
        console.warn('⚠️  Could not set restrictive permissions on private key file');
    }

    return keysDir;
}

function main() {
    try {
        // Generate key pair
        const { publicKey, privateKey } = generateRSAKeyPair();

        // Save keys to files
        const keysDir = saveKeysToFiles(publicKey, privateKey);

        // Create environment template
        const envTemplate = createEnvTemplate(publicKey, privateKey);

        // Save environment template
        const envFile = path.join(__dirname, '../.env.jwt-keys');
        fs.writeFileSync(envFile, envTemplate);

        console.log('✅ RSA key pair generated successfully!\n');
        console.log('📁 Files created:');
        console.log(`   - ${path.join(keysDir, 'jwt-public.pem')} (Public key)`);
        console.log(`   - ${path.join(keysDir, 'jwt-private.pem')} (Private key - SECURE!)`);
        console.log(`   - ${envFile} (Environment variables)\n`);

        console.log('🔒 Security Notes:');
        console.log('   1. Keep the private key secure and never commit to version control');
        console.log('   2. Add keys/ directory to .gitignore');
        console.log('   3. In production, store keys in secure secret management (AWS Secrets Manager, etc.)');
        console.log('   4. Consider implementing key rotation for enhanced security\n');

        console.log('📝 Next Steps:');
        console.log('   1. Copy the environment variables from .env.jwt-keys to your .env file');
        console.log('   2. Restart your application to use the new keys');
        console.log('   3. Test JWT token generation and verification\n');

        // Display public key for easy copying
        console.log('🔑 Public Key (for verification):');
        console.log('-----------------------------------');
        console.log(publicKey);

    } catch (error) {
        console.error('❌ Error generating RSA keys:', error);
        process.exit(1);
    }
}

// Allow script to be run directly or imported
if (require.main === module) {
    main();
}

module.exports = { generateRSAKeyPair, createEnvTemplate };
