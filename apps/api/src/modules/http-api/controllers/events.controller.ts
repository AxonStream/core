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
import { EventStreamService } from '../../../common/services/event-stream.service';
import { validateAndTransformEvent } from '../../../common/schemas/axon-events.schema';
import { PublishEventDto } from '../dto/events.dto';

@ApiTags('events')
@Controller('events')
@UseGuards(JwtAuthGuard, TenantIsolationGuard)
@ApiBearerAuth()
export class EventsController {
    private readonly logger = new Logger(EventsController.name);

    constructor(private readonly eventStreamService: EventStreamService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Publish an event via HTTP',
        description: 'Publish an event to the real-time event system. Alternative to WebSocket for HTTP-only clients.',
    })
    @ApiBody({ type: PublishEventDto })
    @ApiResponse({
        status: 201,
        description: 'Event published successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                messageId: { type: 'string', example: 'msg_1234567890_abc123' },
                channel: { type: 'string', example: 'org:123:agent_events' },
                timestamp: { type: 'string', format: 'date-time' },
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid event data',
    })
    @ApiResponse({
        status: 403,
        description: 'Insufficient permissions',
    })
    async publishEvent(
        @CurrentTenant() context: TenantContext,
        @Body() eventDto: PublishEventDto,
    ) {
        try {
            this.logger.debug(`Publishing event: ${eventDto.eventType} to ${eventDto.channel}`);

            // Ensure channel is org-scoped
            const channel = eventDto.channel.startsWith(`org:${context.organizationId}:`)
                ? eventDto.channel
                : `org:${context.organizationId}:${eventDto.channel}`;

            // Build event using existing schema
            const rawEvent = {
                eventType: eventDto.eventType,
                channel,
                payload: eventDto.payload,
                sessionId: context.sessionId,
                organizationId: context.organizationId,
                userId: context.userId,
                acknowledgment: eventDto.acknowledgment || false,
                retryCount: 0,
                createdAt: new Date().toISOString(),
                metadata: {
                    version: '1.0.0',
                    source: 'http-api',
                    correlationId: eventDto.correlationId,
                    ...eventDto.metadata,
                },
            };

            // Validate using existing schema
            const validation = validateAndTransformEvent(rawEvent);
            if (!validation.success) {
                throw new BadRequestException(`Invalid event data: ${validation.error}`);
            }

            // Publish using existing EventStreamService
            const messageId = await this.eventStreamService.publishEvent(validation.event);

            this.logger.log(`Event published successfully: ${messageId}`);

            return {
                success: true,
                messageId,
                channel,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`Failed to publish event: ${error.message}`);
            throw error;
        }
    }
}
