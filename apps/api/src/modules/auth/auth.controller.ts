import { Controller, Post, Body, UseGuards, Get, HttpCode, HttpStatus, Req, Res, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { SessionService } from './services/session.service';
import { WSTicketService } from './services/ws-ticket.service';
import { TokenService } from './services/token.service';
import type { Request, Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly wsTicketService: WSTicketService,
    private readonly tokenService: TokenService,
  ) { }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Public()
  @Post('trial/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start invisible trial - zero friction access',
    description: 'Get immediate access to AxonStream without tokens. Just provide email for security validation.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email',
          example: 'user@example.com',
          description: 'Email for trial session validation (prevents duplicate trials)'
        }
      },
      required: ['email']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Trial access granted - no token returned',
    schema: {
      type: 'object',
      properties: {
        accessGranted: { type: 'boolean', example: true },
        trialInfo: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', example: 'trial_123' },
            expiresAt: { type: 'string', format: 'date-time' },
            message: { type: 'string', example: 'Trial access granted! You can now use AxonStream immediately.' },
            limitations: {
              type: 'array',
              items: { type: 'string' },
              example: ['7-day trial period', 'Limited to 10 channels', 'Max 1000 events per day']
            },
            features: {
              type: 'array',
              items: { type: 'string' },
              example: ['Real-time event streaming', 'WebSocket connections', 'Event publishing/subscribing']
            },
            nextSteps: {
              type: 'object',
              properties: {
                docs: { type: 'string', example: 'https://docs.axonstream.ai' },
                examples: { type: 'string', example: 'https://github.com/axonstream/examples' },
                upgrade: { type: 'string', example: '/auth/register' }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid email provided' })
  @ApiResponse({ status: 500, description: 'Failed to setup trial environment' })
  async startInvisibleTrial(@Body() body: { email: string }, @Req() req: any) {
    const { email } = body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new BadRequestException('Valid email address is required');
    }

    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    return this.authService.generateTrialAccess(email, ipAddress, userAgent);
  }

  @Public()
  @Post('trial')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get trial token - legacy endpoint',
    description: 'Generate a 7-day trial token for immediate access to AxonStream. Use /trial/start for invisible trial.'
  })
  @ApiResponse({
    status: 200,
    description: 'Trial token generated successfully',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        expiresIn: { type: 'string', example: '7d' },
        trialInfo: {
          type: 'object',
          properties: {
            organizationId: { type: 'string', example: 'trial_org_123' },
            organizationSlug: { type: 'string', example: 'trial' },
            userId: { type: 'string', example: 'trial_1234567890_abc123' },
            expiresAt: { type: 'string', format: 'date-time' },
            limitations: {
              type: 'array',
              items: { type: 'string' },
              example: ['7-day trial period', 'Limited to 10 channels', 'Max 1000 events per day']
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 500, description: 'Failed to generate trial token' })
  async getTrialToken() {
    return this.authService.generateTrialToken();
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: any) {
    return {
      user: user.user,
      organizationId: user.organizationId,
      organizationSlug: user.organizationSlug,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@CurrentUser() user: any) {
    // In a real implementation, you might want to blacklist the token
    // or store logout information
    return { message: 'Logout successful' };
  }

  @Get('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate current token' })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Token is invalid' })
  async validateToken(@CurrentUser() user: any) {
    return {
      valid: true,
      userId: user.userId,
      organizationId: user.organizationId,
      organizationSlug: user.organizationSlug,
    };
  }

  // ============================================================================
  // SESSION-BASED AUTHENTICATION ENDPOINTS
  // ============================================================================

  @Get('.well-known/jwks.json')
  @Public()
  @ApiOperation({ summary: 'Get JSON Web Key Set for token verification' })
  @ApiResponse({ status: 200, description: 'JWKS retrieved successfully' })
  async getJWKS() {
    return this.tokenService.getJWKS();
  }

  @Post('session/login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with session-based authentication' })
  @ApiResponse({ status: 200, description: 'Login successful, session cookie set' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async sessionLogin(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Authenticate user
    const authResult = await this.authService.login(loginDto);

    // Create session
    const session = await this.sessionService.createSession({
      userId: authResult.user.id,
      orgId: authResult.user.organizationId,
      orgSlug: authResult.organization.slug,
      roleIds: [], // Will be populated from RBAC
      permissions: [], // Will be populated from RBAC
      ua: req.headers['user-agent'],
      ip: req.ip,
      sessionType: 'user',
    });

    // Set session cookie
    res.setHeader('Set-Cookie', this.sessionService.createSessionCookie(session.sid));

    // Return user info (no tokens)
    res.json({
      success: true,
      user: authResult.user,
      organization: authResult.organization,
      sessionId: session.sid,
    });
  }

  @Post('session/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate session' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async sessionLogout(@Req() req: Request, @Res() res: Response) {
    const sessionId = this.sessionService.parseSessionCookie(req.headers.cookie || '');

    if (sessionId) {
      await this.sessionService.invalidateSession(sessionId);
    }

    // Clear session cookie
    const cookieName = process.env.AUTH_COOKIE_NAME || '__Host-axon.sid';
    res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
    res.json({ success: true, message: 'Logged out successfully' });
  }

  @Post('ws-ticket')
  @ApiOperation({ summary: 'Get WebSocket authentication ticket' })
  @ApiResponse({ status: 200, description: 'WebSocket ticket issued' })
  @ApiResponse({ status: 401, description: 'No valid session' })
  async getWSTicket(@Req() req: Request) {
    const sessionId = this.sessionService.parseSessionCookie(req.headers.cookie || '');

    if (!sessionId) {
      return { success: false, error: 'NO_SESSION' };
    }

    const sessionValidation = await this.sessionService.validateSession(sessionId);
    if (!sessionValidation.valid || !sessionValidation.session) {
      return { success: false, error: 'INVALID_SESSION' };
    }

    const session = sessionValidation.session;

    // Issue WebSocket ticket
    const ticket = await this.wsTicketService.issueTicket({
      userId: session.userId,
      orgId: session.orgId,
      orgSlug: session.orgSlug,
      roleIds: session.roleIds,
      permissions: session.permissions,
      pv: session.pv,
      ua: req.headers['user-agent'],
      ip: req.ip,
      isDemo: session.isDemo,
      sessionId: session.sid,
    });

    const ttlSeconds = parseInt(process.env.WS_TICKET_TTL_SEC || '60', 10);

    return {
      success: true,
      ticket: ticket.tid,
      expiresIn: ttlSeconds,
      expiresAt: new Date(ticket.expiresAt).toISOString(),
    };
  }

  @Post('token/exchange')
  @ApiOperation({ summary: 'Exchange session for internal access token' })
  @ApiResponse({ status: 200, description: 'Access token issued' })
  @ApiResponse({ status: 401, description: 'No valid session' })
  async exchangeToken(@Req() req: Request) {
    const sessionId = this.sessionService.parseSessionCookie(req.headers.cookie || '');

    if (!sessionId) {
      return { success: false, error: 'NO_SESSION' };
    }

    const sessionValidation = await this.sessionService.validateSession(sessionId);
    if (!sessionValidation.valid || !sessionValidation.session) {
      return { success: false, error: 'INVALID_SESSION' };
    }

    const session = sessionValidation.session;

    // Create internal access token
    const accessToken = await this.tokenService.signAccessToken({
      sub: session.userId,
      org: session.orgId,
      orgSlug: session.orgSlug,
      role_ids: session.roleIds,
      permissions: session.permissions,
      pv: session.pv,
      sessionId: session.sid,
      isDemo: session.isDemo,
    });

    const ttl = process.env.ACCESS_TTL || '15m';

    return {
      success: true,
      accessToken,
      expiresIn: ttl,
      tokenType: 'Bearer',
    };
  }
}
