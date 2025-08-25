import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantIsolationGuard } from '../../../common/guards/tenant-isolation.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../../common/services/tenant-aware.service';
import { EventStreamService } from '../../../common/services/event-stream.service';

@ApiTags('channels')
@Controller('channels')
@UseGuards(JwtAuthGuard, TenantIsolationGuard)
@ApiBearerAuth()
export class ChannelsController {
    private readonly logger = new Logger(ChannelsController.name);

    constructor(private readonly eventStreamService: EventStreamService) { }

    @Get(':name/replay')
    @ApiOperation({
        summary: 'Replay events from a channel',
        description: 'Retrieve historical events from a specific channel with optional time range filtering.',
    })
    @ApiParam({
        name: 'name',
        description: 'Channel name to replay events from',
        example: 'agent_events',
    })
    @ApiQuery({
        name: 'startTime',
        description: 'Start time for replay (ISO 8601)',
        required: false,
        example: '2024-01-01T00:00:00Z',
    })
    @ApiQuery({
        name: 'endTime',
        description: 'End time for replay (ISO 8601)',
        required: false,
        example: '2024-01-01T23:59:59Z',
    })
    @ApiQuery({
        name: 'count',
        description: 'Maximum number of events to return',
        required: false,
        example: 100,
        type: 'number',
    })
    @ApiResponse({
        status: 200,
        description: 'Events retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                channel: { type: 'string', example: 'org:123:agent_events' },
                events: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            eventType: { type: 'string' },
                            channel: { type: 'string' },
                            payload: { type: 'object' },
                            timestamp: { type: 'string', format: 'date-time' },
                            organizationId: { type: 'string' },
                            userId: { type: 'string' },
                        },
                    },
                },
                pagination: {
                    type: 'object',
                    properties: {
                        count: { type: 'number' },
                        hasMore: { type: 'boolean' },
                    },
                },
                timestamp: { type: 'string', format: 'date-time' },
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid channel name or parameters',
    })
    @ApiResponse({
        status: 403,
        description: 'Access denied to channel',
    })
    async replayChannelEvents(
        @CurrentTenant() context: TenantContext,
        @Param('name') channelName: string,
        @Query('startTime') startTime?: string,
        @Query('endTime') endTime?: string,
        @Query('count') count?: number,
    ) {
        try {
            this.logger.debug(`Replaying events from channel: ${channelName}`);

            // Validate channel name
            if (!channelName || channelName.trim() === '') {
                throw new BadRequestException('Channel name is required');
            }

            // Ensure channel is org-scoped
            const channel = channelName.startsWith(`org:${context.organizationId}:`)
                ? channelName
                : `org:${context.organizationId}:${channelName}`;

            // Validate time range
            if (startTime && endTime) {
                const start = new Date(startTime);
                const end = new Date(endTime);

                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    throw new BadRequestException('Invalid date format. Use ISO 8601 format.');
                }

                if (start >= end) {
                    throw new BadRequestException('Start time must be before end time');
                }
            }

            // Validate count
            const eventCount = count ? Math.min(Math.max(1, Number(count)), 1000) : 100;

            // Use existing EventStreamService for replay
            const events = await this.eventStreamService.replayEvents(
                channel,
                context.organizationId,
                startTime,
                endTime,
                eventCount,
            );

            this.logger.log(`Retrieved ${events.length} events from channel ${channel}`);

            return {
                success: true,
                channel,
                events,
                pagination: {
                    count: events.length,
                    hasMore: events.length === eventCount, // Simple check - could be enhanced
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`Failed to replay channel events: ${error.message}`);
            throw error;
        }
    }
}
