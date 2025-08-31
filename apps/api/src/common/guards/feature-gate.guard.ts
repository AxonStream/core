import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DemoService, FeatureGateResult } from '../../modules/demo/demo.service';
import { Request, Response } from 'express';

export interface FeatureGateOptions {
    feature: string;
    category: string;
    usageKey?: string; // Key to extract current usage from request/context
    allowUpgrade?: boolean; // Whether to show upgrade prompts
    gracefulDegradation?: boolean; // Whether to allow partial functionality
}

export const FEATURE_GATE_KEY = 'feature_gate';

/**
 * Decorator to protect endpoints with feature gating
 */
export const FeatureGate = (options: FeatureGateOptions) =>
    SetMetadata(FEATURE_GATE_KEY, options);

/**
 * Guard that enforces demo limitations and provides upgrade prompts
 */
@Injectable()
export class FeatureGateGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly demoService: DemoService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const featureGateOptions = this.reflector.get<FeatureGateOptions>(
            FEATURE_GATE_KEY,
            context.getHandler(),
        );

        if (!featureGateOptions) {
            // No feature gate configured, allow access
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();

        // Extract session information from JWT
        const user = request.user as any;
        if (!user || !user.isDemo) {
            // Not a demo user, allow access
            return true;
        }

        const sessionId = user.userId;
        if (!sessionId) {
            throw new ForbiddenException('Invalid demo session');
        }

        // Get current usage if specified
        let currentUsage: number | undefined = user.requestMetadata?.usage;
        if (featureGateOptions.usageKey) {
            currentUsage = this.extractUsageFromRequest(request, featureGateOptions.usageKey);
        }

        // Store usage in user object for response headers
        user.requestMetadata.usage = currentUsage;

        // Check feature access
        const accessResult = await this.demoService.checkFeatureGateAccess(
            sessionId,
            featureGateOptions.feature,
            featureGateOptions.category,
        );

        // Track feature usage attempt
        await this.demoService.trackFeatureUsage(
            sessionId,
            featureGateOptions.feature,
            featureGateOptions.category,
            accessResult.currentUsage, // Pass current usage to track limits
        );

        if (!accessResult.allowed) {
            if (featureGateOptions.gracefulDegradation) {
                // Add upgrade prompt to response headers but allow request
                this.addUpgradePromptHeaders(response, accessResult);
                return true;
            } else {
                // Block request with upgrade prompt
                throw new FeatureGateForbiddenException(accessResult);
            }
        }

        return true;
    }

    private extractUsageFromRequest(request: Request, usageKey: string): number | undefined {
        // Extract usage from various sources
        if (request.body && request.body[usageKey] !== undefined) {
            return Number(request.body[usageKey]);
        }

        if (request.query && request.query[usageKey] !== undefined) {
            return Number(request.query[usageKey]);
        }

        if (request.params && request.params[usageKey] !== undefined) {
            return Number(request.params[usageKey]);
        }

        // For array operations, count items
        if (usageKey === 'count' && request.body && Array.isArray(request.body)) {
            return request.body.length;
        }

        return undefined;
    }

    private addUpgradePromptHeaders(response: Response, accessResult: FeatureGateResult): void {
        if (accessResult.upgradePrompt) {
            response.setHeader('X-Upgrade-Required', 'true');
            response.setHeader('X-Upgrade-Reason', accessResult.reason || 'Feature limited');
            response.setHeader('X-Upgrade-Title', accessResult.upgradePrompt.title);
            response.setHeader('X-Upgrade-Message', accessResult.upgradePrompt.message);
            response.setHeader('X-Upgrade-CTA-Text', accessResult.upgradePrompt.ctaText);
            response.setHeader('X-Upgrade-CTA-URL', accessResult.upgradePrompt.ctaUrl);
            response.setHeader('X-Upgrade-Urgency', accessResult.upgradePrompt.urgency || 'normal');
        }
    }

    private addUsageHeaders(response: Response, accessResult: FeatureGateResult): void {
        if (accessResult.currentUsage !== undefined) {
            response.setHeader('X-Current-Usage', accessResult.currentUsage.toString());
        }

        if (accessResult.limit !== undefined) {
            response.setHeader('X-Usage-Limit', accessResult.limit.toString());

            if (accessResult.currentUsage !== undefined) {
                const percentage = (accessResult.currentUsage / accessResult.limit) * 100;
                response.setHeader('X-Usage-Percentage', percentage.toFixed(1));

                // Add warning headers when approaching limits
                if (percentage >= 80) {
                    response.setHeader('X-Usage-Warning', 'approaching-limit');
                }
                if (percentage >= 90) {
                    response.setHeader('X-Usage-Warning', 'near-limit');
                }
            }
        }
    }
}

/**
 * Custom exception for feature gate violations
 */
export class FeatureGateForbiddenException extends ForbiddenException {
    constructor(accessResult: FeatureGateResult) {
        const message = accessResult.reason || 'Feature access denied';

        super({
            statusCode: 403,
            error: 'Feature Gate Violation',
            message,
            upgradeRequired: accessResult.upgradeRequired,
            currentUsage: accessResult.currentUsage,
            limit: accessResult.limit,
            upgradePrompt: accessResult.upgradePrompt,
        });
    }
}

/**
 * Decorator for endpoints that should show usage warnings
 */
export const UsageWarning = (feature: string, category: string) =>
    FeatureGate({
        feature,
        category,
        gracefulDegradation: true,
        allowUpgrade: true,
    });

/**
 * Decorator for endpoints that should enforce hard limits
 */
export const UsageLimit = (feature: string, category: string, usageKey?: string) =>
    FeatureGate({
        feature,
        category,
        usageKey,
        gracefulDegradation: false,
        allowUpgrade: true,
    });

/**
 * Decorator for premium features that require upgrade
 */
export const PremiumFeature = (feature: string, category: string) =>
    FeatureGate({
        feature,
        category,
        gracefulDegradation: false,
        allowUpgrade: true,
    });
