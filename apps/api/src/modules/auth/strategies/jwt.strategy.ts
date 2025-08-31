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
