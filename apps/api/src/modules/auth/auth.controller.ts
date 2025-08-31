import { Controller, Post, Body, UseGuards, Get, HttpCode, HttpStatus, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

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
}
