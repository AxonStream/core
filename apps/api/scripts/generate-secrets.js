#!/usr/bin/env node

/**
 * AxonPuls Platform - Security Secrets Generator
 * Generates cryptographically secure secrets for production deployment
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 AxonPuls Platform - Security Secrets Generator');
console.log('=============================================\n');

/**
 * Generate a cryptographically secure random string
 * @param {number} length - Length of the string to generate
 * @returns {string} - Base64 encoded random string
 */
function generateSecureSecret(length = 32) {
    return crypto.randomBytes(length).toString('base64');
}

/**
 * Generate a hex-encoded secret
 * @param {number} length - Length in bytes
 * @returns {string} - Hex encoded random string
 */
function generateHexSecret(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

// Generate all required secrets
const secrets = {
    JWT_SECRET: generateSecureSecret(32),
    JWT_REFRESH_SECRET: generateSecureSecret(32),
    SESSION_SECRET: generateSecureSecret(24),
    ENCRYPTION_KEY: generateHexSecret(32),
    API_KEY_SECRET: generateSecureSecret(24),
    WEBHOOK_SECRET: generateSecureSecret(16),
};

console.log('Generated Production Secrets:');
console.log('============================\n');

// Display secrets
Object.entries(secrets).forEach(([key, value]) => {
    console.log(`${key}=${value}`);
});

console.log('\n🔒 Security Recommendations:');
console.log('============================');
console.log('1. Store these secrets securely (use environment variables or secret management)');
console.log('2. Never commit these secrets to version control');
console.log('3. Rotate secrets regularly (every 90 days recommended)');
console.log('4. Use different secrets for different environments');
console.log('5. Limit access to these secrets to authorized personnel only');

// Option to save to .env.secrets file
console.log('\n💾 Save Options:');
console.log('================');

const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Save secrets to .env.secrets file? (y/N): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        const envContent = `# =============================================================================
# AxonPuls PLATFORM - GENERATED PRODUCTION SECRETS
# =============================================================================
# Generated on: ${new Date().toISOString()}
# SECURITY WARNING: Keep these secrets secure and never commit to version control!

# JWT Authentication Secrets
${secrets.JWT_SECRET}
JWT_REFRESH_SECRET=${secrets.JWT_REFRESH_SECRET}

# Session Secret
SESSION_SECRET=${secrets.SESSION_SECRET}

# Encryption Key (for sensitive data encryption)
ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}

# API Key Secret (for external API authentication)
API_KEY_SECRET=${secrets.API_KEY_SECRET}

# Webhook Secret (for webhook signature verification)
WEBHOOK_SECRET=${secrets.WEBHOOK_SECRET}

# =============================================================================
# USAGE INSTRUCTIONS
# =============================================================================
# 1. Copy the values above to your .env file
# 2. Update your production environment variables
# 3. Delete this file after copying the secrets
# 4. Ensure proper access controls are in place
`;

        fs.writeFileSync('.env.secrets', envContent);
        console.log('✅ Secrets saved to .env.secrets');
        console.log('⚠️  Remember to delete this file after copying the secrets!');
        
        // Set restrictive permissions on the secrets file
        try {
            fs.chmodSync('.env.secrets', 0o600); // Read/write for owner only
            console.log('🔒 File permissions set to 600 (owner read/write only)');
        } catch (error) {
            console.log('⚠️  Could not set file permissions. Please set manually: chmod 600 .env.secrets');
        }
    } else {
        console.log('📋 Copy the secrets above manually to your environment configuration');
    }
    
    console.log('\n🎯 Next Steps:');
    console.log('==============');
    console.log('1. Update your .env file with the generated secrets');
    console.log('2. Run: npm run setup:production');
    console.log('3. Test your authentication endpoints');
    console.log('4. Deploy to production');
    
    rl.close();
});

// Additional security utilities
console.log('\n🛠️  Additional Security Tools:');
console.log('==============================');
console.log('Generate additional secrets:');
console.log(`node -e "console.log('CUSTOM_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"`);
console.log('\nValidate secret strength:');
console.log('- Minimum 32 characters for JWT secrets');
console.log('- Use base64 or hex encoding');
console.log('- Avoid special characters that might cause shell issues');

// Export for programmatic use
module.exports = {
    generateSecureSecret,
    generateHexSecret,
    secrets
};
