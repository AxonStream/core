import {
    Controller,
    Post,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantIsolationGuard } from '../../../common/guards/tenant-isolation.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../../common/services/tenant-aware.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WidgetTokenDto } from '../dto/tokens.dto';

@ApiTags('tokens')
@Controller('tokens')
@UseGuards(JwtAuthGuard, TenantIsolationGuard)
@ApiBearerAuth()
export class TokensController {
    private readonly logger = new Logger(TokensController.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    @Post('widget')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Generate a widget token',
        description: 'Generate a limited-scope JWT token for widget embedding and public access.',
    })
    @ApiBody({ type: WidgetTokenDto })
    @ApiResponse({
        status: 201,
        description: 'Widget token generated successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                token: { type: 'string', example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...' },
                expiresIn: { type: 'string', example: '1h' },
                expiresAt: { type: 'string', format: 'date-time' },
                permissions: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['widget:read', 'events:subscribe'],
                },
                scope: { type: 'string', example: 'widget' },
                timestamp: { type: 'string', format: 'date-time' },
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid widget configuration',
    })
    @ApiResponse({
        status: 403,
        description: 'Insufficient permissions to create widget tokens',
    })
    async generateWidgetToken(
        @CurrentTenant() context: TenantContext,
        @Body() widgetDto: WidgetTokenDto,
    ) {
        try {
            this.logger.debug(`Generating widget token for org: ${context.organizationId}`);

            // Validate widget configuration
            if (!widgetDto.widgetType || !widgetDto.channels || widgetDto.channels.length === 0) {
                throw new BadRequestException('Widget type and channels are required');
            }

            // Ensure channels are org-scoped
            const orgScopedChannels = widgetDto.channels.map(channel =>
                channel.startsWith(`org:${context.organizationId}:`)
                    ? channel
                    : `org:${context.organizationId}:${channel}`
            );

            // Define widget permissions based on type
            const widgetPermissions = this.getWidgetPermissions(widgetDto.widgetType);

            // Set token expiration (shorter for widgets)
            const expiresIn = widgetDto.expiresIn || '1h';
            const expiresAt = new Date();

            // Parse expiration string (1h, 30m, etc.)
            const expirationMs = this.parseExpirationString(expiresIn);
            expiresAt.setTime(expiresAt.getTime() + expirationMs);

            // Create widget token payload
            const payload = {
                sub: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                organizationId: context.organizationId,
                organizationSlug: context.organizationSlug,
                scope: 'widget',
                widgetType: widgetDto.widgetType,
                channels: orgScopedChannels,
                permissions: widgetPermissions,
                metadata: widgetDto.metadata || {},
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(expiresAt.getTime() / 1000),
                iss: this.configService.get('auth.jwt.issuer'),
                aud: this.configService.get('auth.jwt.audience'),
            };

            // Sign token using existing JWT configuration
            const authConfig = this.configService.get('auth.jwt');
            const signOptions: any = {
                algorithm: authConfig.algorithm,
            };

            // Use appropriate key based on algorithm
            if (authConfig.algorithm === 'RS256') {
                signOptions.privateKey = authConfig.privateKey;
            } else {
                signOptions.secret = authConfig.secret;
            }

            const token = this.jwtService.sign(payload, signOptions);

            this.logger.log(`Widget token generated for ${widgetDto.widgetType} widget`);

            return {
                success: true,
                token,
                expiresIn,
                expiresAt: expiresAt.toISOString(),
                permissions: widgetPermissions,
                scope: 'widget',
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`Failed to generate widget token: ${error.message}`);
            throw error;
        }
    }

    private getWidgetPermissions(widgetType: string): string[] {
        const permissionMap: Record<string, string[]> = {
            'dashboard': ['widget:read', 'events:subscribe', 'channels:read'],
            'notifications': ['widget:read', 'events:subscribe'],
            'analytics': ['widget:read', 'monitoring:read'],
            'chat': ['widget:read', 'events:subscribe', 'events:publish'],
            'status': ['widget:read', 'monitoring:read'],
            'custom': ['widget:read', 'events:subscribe'],
        };

        return permissionMap[widgetType] || permissionMap['custom'];
    }

    private parseExpirationString(expiresIn: string): number {
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new BadRequestException('Invalid expiration format. Use format like "1h", "30m", "1d"');
        }

        const value = parseInt(match[1]);
        const unit = match[2];

        const multipliers = {
            s: 1000,           // seconds
            m: 60 * 1000,      // minutes
            h: 60 * 60 * 1000, // hours
            d: 24 * 60 * 60 * 1000, // days
        };

        const multiplier = multipliers[unit as keyof typeof multipliers];
        if (!multiplier) {
            throw new BadRequestException('Invalid time unit. Use s, m, h, or d');
        }

        const maxDuration = 7 * 24 * 60 * 60 * 1000; // 7 days max
        const duration = value * multiplier;

        if (duration > maxDuration) {
            throw new BadRequestException('Widget token expiration cannot exceed 7 days');
        }

        return duration;
    }
}
