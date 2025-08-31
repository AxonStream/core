import { jwtDecode } from 'jwt-decode';
import chalk from 'chalk';

export interface AxonPulsJwtPayload {
    sub: string;
    orgId?: string;
    organizationId?: string;
    email?: string;
    organizationSlug?: string;
    roles?: string[];
    permissions?: string[];
    iat?: number;
    exp?: number;
}

export interface TokenValidationResult {
    valid: boolean;
    payload?: AxonPulsJwtPayload;
    error?: string;
}

export function validateToken(token: string): TokenValidationResult {
    try {
        const payload = jwtDecode<AxonPulsJwtPayload>(token);

        // Check required fields for AxonPuls - support both orgId and organizationId
        const orgId = payload.orgId || payload.organizationId;
        if (!payload.sub || !orgId) {
            return {
                valid: false,
                error: 'Token missing required fields (sub, organizationId)',
            };
        }

        // Check expiration
        if (payload.exp && payload.exp < Date.now() / 1000) {
            return {
                valid: false,
                error: 'Token has expired',
            };
        }

        return {
            valid: true,
            payload: {
                ...payload,
                orgId,
                organizationId: orgId
            },
        };
    } catch (error: any) {
        return {
            valid: false,
            error: `Invalid token format: ${error.message}`,
        };
    }
}

export function displayTokenInfo(token: string): void {
    const result = validateToken(token);

    if (!result.valid) {
        console.log(chalk.red('✗ Invalid token'));
        console.log(chalk.red(`  Error: ${result.error}`));
        return;
    }

    const { payload } = result;
    if (!payload) return;

    const orgId = payload.orgId || payload.organizationId;

    console.log(chalk.green('✓ Valid token'));
    console.log();
    console.log(chalk.blue('Token information:'));
    console.log(`  Subject (User ID): ${chalk.cyan(payload.sub)}`);
    console.log(`  Organization ID: ${chalk.cyan(orgId)}`);

    if (payload.email) {
        console.log(`  Email: ${chalk.cyan(payload.email)}`);
    }

    if (payload.organizationSlug) {
        console.log(`  Organization Slug: ${chalk.cyan(payload.organizationSlug)}`);
    }

    if (payload.roles && payload.roles.length > 0) {
        console.log(`  Roles: ${chalk.cyan(payload.roles.join(', '))}`);
    }

    if (payload.permissions && payload.permissions.length > 0) {
        console.log(`  Permissions: ${chalk.cyan(payload.permissions.join(', '))}`);
    }

    if (payload.iat) {
        console.log(`  Issued at: ${chalk.cyan(new Date(payload.iat * 1000).toLocaleString())}`);
    }

    if (payload.exp) {
        const expiresAt = new Date(payload.exp * 1000);
        const isExpired = payload.exp < Date.now() / 1000;
        const timeUntilExpiry = payload.exp - Date.now() / 1000;

        console.log(`  Expires at: ${chalk.cyan(expiresAt.toLocaleString())}`);

        if (isExpired) {
            console.log(chalk.red('  Status: EXPIRED'));
        } else {
            const hours = Math.floor(timeUntilExpiry / 3600);
            const minutes = Math.floor((timeUntilExpiry % 3600) / 60);
            console.log(`  Status: ${chalk.green('Valid')} (expires in ${hours}h ${minutes}m)`);
        }
    }
}

export function getTokenOrgId(token: string): string | null {
    const result = validateToken(token);
    if (!result.valid || !result.payload) return null;

    return result.payload.orgId || result.payload.organizationId || null;
}
