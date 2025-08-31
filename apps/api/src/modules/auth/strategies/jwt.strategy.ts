import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwt.publicKey') || configService.get<string>('auth.jwt.secret'),
      algorithms: [configService.get<string>('auth.jwt.algorithm') || 'HS256'],
      issuer: configService.get<string>('auth.jwt.issuer'),
      audience: configService.get<string>('auth.jwt.audience'),
      clockTolerance: 30, // Allow 30 seconds clock skew
      maxAge: '24h', // Maximum token age
    } as any);
  }

  async validate(payload: JwtPayload) {
    // Handle trial tokens - no user lookup required
    if (payload.isTrial) {
      return this.validateTrialToken(payload);
    }

    // Handle demo tokens - no user lookup required
    if (payload.isDemo) {
      return this.validateDemoToken(payload);
    }

    // Existing validation for real users
    const user = await this.authService.getUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Validate organization context
    if (user.organizationId !== payload.organizationId) {
      throw new UnauthorizedException('Invalid organization context');
    }

    return {
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      organizationSlug: payload.organizationSlug,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      user,
    };
  }

  /**
   * Validate demo tokens - comprehensive validation with seamless UX
   */
  private validateDemoToken(payload: JwtPayload) {
    // Check if demo expired
    if (payload.expiresAt && new Date() > new Date(payload.expiresAt)) {
      throw new UnauthorizedException({
        message: 'Demo period expired',
        code: 'DEMO_EXPIRED',
        upgradeUrl: '/upgrade',
        upgradeMessage: 'Your demo has expired. Upgrade to continue with unlimited access.',
        demoExpiresAt: payload.expiresAt,
      });
    }

    // Validate demo token structure
    if (!payload.sub?.startsWith('demo_')) {
      throw new UnauthorizedException({
        message: 'Invalid demo token',
        code: 'INVALID_DEMO_TOKEN',
        action: 'regenerate',
      });
    }

    // Validate organization context for demo
    if (!payload.organizationId || !payload.organizationSlug || payload.organizationSlug !== 'demo-org') {
      throw new UnauthorizedException({
        message: 'Invalid demo organization context',
        code: 'INVALID_DEMO_ORG',
        action: 'regenerate',
      });
    }

    // Calculate time remaining for UX
    const expiresAt = new Date(payload.expiresAt);
    const now = new Date();
    const timeRemaining = expiresAt.getTime() - now.getTime();
    const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));

    // Warn when demo is expiring soon (30 minutes)
    const isExpiringSoon = minutesRemaining <= 30 && minutesRemaining > 0;

    return {
      userId: payload.sub,
      email: payload.email || 'demo@axonstream.ai',
      organizationId: payload.organizationId,
      organizationSlug: payload.organizationSlug,
      roles: payload.roles || ['demo'],
      permissions: payload.permissions || [],
      isDemo: true,
      demoExpiresAt: payload.expiresAt,
      timeRemaining: minutesRemaining,
      isExpiringSoon,
      upgradePrompt: isExpiringSoon ? {
        title: 'Demo Expiring Soon',
        message: `Your demo expires in ${minutesRemaining} minutes. Upgrade now to continue with unlimited access.`,
        ctaText: 'Upgrade Now',
        ctaUrl: '/upgrade',
        urgency: 'high',
      } : null,
      user: null, // No real user for demo tokens
      sessionMetadata: {
        sessionId: payload.sub,
        sessionType: 'demo',
        createdAt: payload.iat ? new Date(payload.iat * 1000) : null,
        expiresAt: payload.expiresAt,
        permissions: payload.permissions?.length || 0,
      },
    };
  }

  /**
   * Validate trial tokens - separate validation logic
   */
  private validateTrialToken(payload: JwtPayload) {
    // Check if trial expired
    if (payload.expiresAt && new Date() > new Date(payload.expiresAt)) {
      throw new UnauthorizedException('Trial period expired. Please register for full access at /auth/register');
    }

    // Validate trial token structure
    if (!payload.sub?.startsWith('trial_') || !payload.organizationSlug || payload.organizationSlug !== 'trial') {
      throw new UnauthorizedException('Invalid trial token');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      organizationId: payload.organizationId,
      organizationSlug: payload.organizationSlug,
      roles: payload.roles || ['trial'],
      permissions: payload.permissions || [],
      isTrial: true,
      trialExpiresAt: payload.expiresAt,
      user: null // No real user for trial tokens
    };
  }
}
