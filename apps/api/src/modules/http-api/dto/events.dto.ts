import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { EVENT_PRIORITIES } from '../../../common/schemas/axon-events.schema';

export class PublishEventDto {
    @ApiProperty({
        description: 'Type of event to publish',
        example: 'agent_events',
        enum: ['agent_events', 'tool_events', 'workflow_events', 'system_events', 'connection_events', 'provider_events'],
    })
    @IsString()
    eventType: string;

    @ApiProperty({
        description: 'Channel to publish to (will be org-scoped automatically)',
        example: 'notifications',
    })
    @IsString()
    channel: string;

    @ApiProperty({
        description: 'Event payload data',
        example: {
            agentId: 'agent-123',
            action: 'start',
            status: 'running',
            timestamp: '2024-01-01T00:00:00Z',
        },
    })
    @IsObject()
    payload: Record<string, any>;

    @ApiProperty({
        description: 'Whether to require acknowledgment',
        required: false,
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    acknowledgment?: boolean;

    @ApiProperty({
        description: 'Correlation ID for tracking',
        required: false,
    })
    @IsOptional()
    @IsString()
    correlationId?: string;

    @ApiProperty({
        description: 'Additional metadata',
        required: false,
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}
