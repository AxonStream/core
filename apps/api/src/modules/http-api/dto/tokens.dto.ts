import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsObject, IsEnum } from 'class-validator';

export class WidgetTokenDto {
    @ApiProperty({
        description: 'Type of widget requesting the token',
        example: 'dashboard',
        enum: ['dashboard', 'notifications', 'analytics', 'chat', 'status', 'custom'],
    })
    @IsString()
    @IsEnum(['dashboard', 'notifications', 'analytics', 'chat', 'status', 'custom'])
    widgetType: string;

    @ApiProperty({
        description: 'Channels the widget needs access to',
        example: ['agent_events', 'notifications'],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    channels: string[];

    @ApiProperty({
        description: 'Token expiration time (e.g., "1h", "30m", "1d")',
        example: '1h',
        required: false,
        default: '1h',
    })
    @IsOptional()
    @IsString()
    expiresIn?: string;

    @ApiProperty({
        description: 'Additional metadata for the widget',
        required: false,
        example: {
            origin: 'https://example.com',
            version: '1.0.0',
        },
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}
