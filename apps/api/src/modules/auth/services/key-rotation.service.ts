import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface KeyRotationConfig {
    enabled: boolean;
    rotationInterval: string; // Cron expression
    keyRetentionPeriod: number; // Days to keep old keys for validation
    backupLocation?: string;
}

export interface RSAKeyPair {
    publicKey: string;
    privateKey: string;
    keyId: string;
    createdAt: Date;
    isActive: boolean;
}

@Injectable()
export class KeyRotationService {
    private readonly logger = new Logger(KeyRotationService.name);
    private readonly keyHistory: Map<string, RSAKeyPair> = new Map();
    private currentKeyId: string;

    constructor(private configService: ConfigService) {
        this.initialize();
    }

    private initialize(): void {
        // Load existing keys and set current key ID
        this.loadExistingKeys();

        const rotationConfig = this.getRotationConfig();
        if (rotationConfig.enabled) {
            this.logger.log('Key rotation is enabled', rotationConfig);
        } else {
            this.logger.log('Key rotation is disabled');
        }
    }

    private getRotationConfig(): KeyRotationConfig {
        return {
            enabled: process.env.JWT_KEY_ROTATION_ENABLED === 'true',
            rotationInterval: process.env.JWT_KEY_ROTATION_INTERVAL || '0 0 1 * *', // Monthly by default
            keyRetentionPeriod: parseInt(process.env.JWT_KEY_RETENTION_DAYS || '30'),
            backupLocation: process.env.JWT_KEY_BACKUP_LOCATION,
        };
    }

    /**
     * Scheduled key rotation - runs based on configured cron expression
     */
    @Cron(process.env.JWT_KEY_ROTATION_INTERVAL || '0 0 1 * *') // Default: 1st of every month at midnight
    async rotateKeysScheduled(): Promise<void> {
        const config = this.getRotationConfig();

        if (!config.enabled) {
            return;
        }

        this.logger.log('Starting scheduled key rotation...');

        try {
            await this.rotateKeys();
            this.logger.log('Scheduled key rotation completed successfully');
        } catch (error) {
            this.logger.error('Scheduled key rotation failed:', error);
        }
    }

    /**
     * Manual key rotation - can be triggered via API or admin command
     */
    async rotateKeys(): Promise<RSAKeyPair> {
        this.logger.log('Generating new RSA key pair for rotation...');

        try {
            // Generate new key pair
            const newKeyPair = this.generateNewKeyPair();

            // Backup current keys
            await this.backupCurrentKeys();

            // Update environment variables (in production, this should update secret management)
            await this.updateEnvironmentKeys(newKeyPair);

            // Add to key history
            this.keyHistory.set(newKeyPair.keyId, newKeyPair);

            // Update current key ID
            this.currentKeyId = newKeyPair.keyId;

            // Clean up old keys
            await this.cleanupOldKeys();

            this.logger.log(`Key rotation completed. New key ID: ${newKeyPair.keyId}`);

            return newKeyPair;
        } catch (error) {
            this.logger.error('Key rotation failed:', error);
            throw error;
        }
    }

    private generateNewKeyPair(): RSAKeyPair {
        const keyId = `key_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

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

        return {
            publicKey,
            privateKey,
            keyId,
            createdAt: new Date(),
            isActive: true,
        };
    }

    private async backupCurrentKeys(): Promise<void> {
        const config = this.getRotationConfig();

        if (!config.backupLocation) {
            this.logger.warn('No backup location configured, skipping key backup');
            return;
        }

        try {
            const currentPublicKey = this.configService.get<string>('auth.jwt.publicKey');
            const currentPrivateKey = this.configService.get<string>('auth.jwt.privateKey');

            if (currentPublicKey && currentPrivateKey) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupDir = path.join(config.backupLocation, `backup_${timestamp}`);

                // Create backup directory
                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir, { recursive: true });
                }

                // Save current keys
                fs.writeFileSync(path.join(backupDir, 'jwt-public.pem'), currentPublicKey);
                fs.writeFileSync(path.join(backupDir, 'jwt-private.pem'), currentPrivateKey);

                this.logger.log(`Keys backed up to: ${backupDir}`);
            }
        } catch (error) {
            this.logger.error('Failed to backup current keys:', error);
        }
    }

    private async updateEnvironmentKeys(keyPair: RSAKeyPair): Promise<void> {
        // In production, this should update your secret management system
        // For now, we'll update the local files and environment

        try {
            const keysDir = path.join(process.cwd(), 'keys');

            // Ensure keys directory exists
            if (!fs.existsSync(keysDir)) {
                fs.mkdirSync(keysDir, { recursive: true });
            }

            // Write new keys to files
            fs.writeFileSync(path.join(keysDir, 'jwt-public.pem'), keyPair.publicKey);
            fs.writeFileSync(path.join(keysDir, 'jwt-private.pem'), keyPair.privateKey);

            // Set restrictive permissions on private key
            try {
                fs.chmodSync(path.join(keysDir, 'jwt-private.pem'), 0o600);
            } catch (error) {
                this.logger.warn('Could not set restrictive permissions on private key file');
            }

            // Create new environment file with rotated keys
            const envContent = this.createEnvContent(keyPair);
            fs.writeFileSync(path.join(process.cwd(), '.env.jwt-rotated'), envContent);

            this.logger.log('Environment keys updated. Restart application to use new keys.');

        } catch (error) {
            this.logger.error('Failed to update environment keys:', error);
            throw error;
        }
    }

    private createEnvContent(keyPair: RSAKeyPair): string {
        const publicKeyOneLine = keyPair.publicKey.replace(/\n/g, '\\n');
        const privateKeyOneLine = keyPair.privateKey.replace(/\n/g, '\\n');

        return `# JWT RS256 Keys - Rotated on ${new Date().toISOString()}
# Key ID: ${keyPair.keyId}

JWT_PUBLIC_KEY="${publicKeyOneLine}"
JWT_PRIVATE_KEY="${privateKeyOneLine}"
JWT_KEY_ID="${keyPair.keyId}"

# Copy these to your main .env file and restart the application
`;
    }

    private loadExistingKeys(): void {
        try {
            const currentPublicKey = this.configService.get<string>('auth.jwt.publicKey');
            const currentKeyId = process.env.JWT_KEY_ID || `current_${Date.now()}`;

            if (currentPublicKey) {
                this.currentKeyId = currentKeyId;
                // In a real implementation, you would load the full key history from a database
                this.logger.log(`Loaded current key ID: ${currentKeyId}`);
            }
        } catch (error) {
            this.logger.error('Failed to load existing keys:', error);
        }
    }

    private async cleanupOldKeys(): Promise<void> {
        const config = this.getRotationConfig();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - config.keyRetentionPeriod);

        let cleanedCount = 0;

        for (const [keyId, keyPair] of this.keyHistory.entries()) {
            if (keyPair.createdAt < cutoffDate && !keyPair.isActive) {
                this.keyHistory.delete(keyId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.logger.log(`Cleaned up ${cleanedCount} old keys older than ${config.keyRetentionPeriod} days`);
        }
    }

    /**
     * Get current active key information
     */
    getCurrentKeyInfo(): { keyId: string; createdAt?: Date } {
        const currentKey = this.keyHistory.get(this.currentKeyId);
        return {
            keyId: this.currentKeyId,
            createdAt: currentKey?.createdAt,
        };
    }

    /**
     * Get key rotation status and next scheduled rotation
     */
    getRotationStatus(): {
        enabled: boolean;
        currentKeyId: string;
        keyCount: number;
        nextRotation?: string;
        config: KeyRotationConfig;
    } {
        const config = this.getRotationConfig();

        return {
            enabled: config.enabled,
            currentKeyId: this.currentKeyId,
            keyCount: this.keyHistory.size,
            nextRotation: config.enabled ? config.rotationInterval : undefined,
            config,
        };
    }

    /**
     * Validate if a key ID is still within the retention period
     */
    isKeyIdValid(keyId: string): boolean {
        const keyPair = this.keyHistory.get(keyId);

        if (!keyPair) {
            return false;
        }

        const config = this.getRotationConfig();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - config.keyRetentionPeriod);

        return keyPair.createdAt >= cutoffDate;
    }
}
