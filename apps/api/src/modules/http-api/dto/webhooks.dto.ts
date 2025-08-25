import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, IsOptional, IsObject, IsBoolean, IsNumber, IsEnum, Min, Max } from 'class-validator';

export class CreateWebhookDto {
    @ApiProperty({
        description: 'Name for the webhook endpoint',
        example: 'My App Webhook',
    })
    @IsString()
    name: string;

    @ApiProperty({
        description: 'Webhook URL to send events to',
        example: 'https://api.myapp.com/webhooks/axonpuls',
    })
    @IsUrl()
    url: string;

    @ApiProperty({
        description: 'HTTP method for webhook requests',
        example: 'POST',
        enum: ['POST', 'PUT', 'PATCH'],
        required: false,
        default: 'POST',
    })
    @IsOptional()
    @IsEnum(['POST', 'PUT', 'PATCH'])
    method?: 'POST' | 'PUT' | 'PATCH';

    @ApiProperty({
        description: 'Secret for webhook signature verification',
        example: 'my-webhook-secret-123',
        required: false,
    })
    @IsOptional()
    @IsString()
    secret?: string;

    @ApiProperty({
        description: 'Additional HTTP headers',
        example: { 'Authorization': 'Bearer token123' },
        required: false,
    })
    @IsOptional()
    @IsObject()
    headers?: Record<string, string>;

    @ApiProperty({
        description: 'Request timeout in milliseconds',
        example: 10000,
        required: false,
        default: 10000,
    })
    @IsOptional()
    @IsNumber()
    @Min(1000)
    @Max(60000)
    timeout?: number;

    @ApiProperty({
        description: 'Maximum number of retry attempts',
        example: 3,
        required: false,
        default: 3,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(10)
    maxRetries?: number;

    @ApiProperty({
        description: 'Backoff strategy for retries',
        example: 'exponential',
        enum: ['fixed', 'linear', 'exponential'],
        required: false,
        default: 'exponential',
    })
    @IsOptional()
    @IsEnum(['fixed', 'linear', 'exponential'])
    backoffStrategy?: 'fixed' | 'linear' | 'exponential';

    @ApiProperty({
        description: 'Base delay between retries in milliseconds',
        example: 1000,
        required: false,
        default: 1000,
    })
    @IsOptional()
    @IsNumber()
    @Min(100)
    @Max(10000)
    baseDelay?: number;

    @ApiProperty({
        description: 'Maximum delay between retries in milliseconds',
        example: 30000,
        required: false,
        default: 30000,
    })
    @IsOptional()
    @IsNumber()
    @Min(1000)
    @Max(300000)
    maxDelay?: number;

    @ApiProperty({
        description: 'Add jitter to retry delays',
        example: true,
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    jitter?: boolean;

    @ApiProperty({
        description: 'Delivery semantics',
        example: 'at-least-once',
        enum: ['at-least-once', 'at-most-once', 'exactly-once'],
        required: false,
        default: 'at-least-once',
    })
    @IsOptional()
    @IsEnum(['at-least-once', 'at-most-once', 'exactly-once'])
    semantics?: 'at-least-once' | 'at-most-once' | 'exactly-once';

    @ApiProperty({
        description: 'Whether the webhook is active',
        example: true,
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    active?: boolean;
}

export class UpdateWebhookDto {
    @ApiProperty({
        description: 'Name for the webhook endpoint',
        required: false,
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({
        description: 'Webhook URL to send events to',
        required: false,
    })
    @IsOptional()
    @IsUrl()
    url?: string;

    @ApiProperty({
        description: 'HTTP method for webhook requests',
        enum: ['POST', 'PUT', 'PATCH'],
        required: false,
    })
    @IsOptional()
    @IsEnum(['POST', 'PUT', 'PATCH'])
    method?: 'POST' | 'PUT' | 'PATCH';

    @ApiProperty({
        description: 'Secret for webhook signature verification',
        required: false,
    })
    @IsOptional()
    @IsString()
    secret?: string;

    @ApiProperty({
        description: 'Additional HTTP headers',
        required: false,
    })
    @IsOptional()
    @IsObject()
    headers?: Record<string, string>;

    @ApiProperty({
        description: 'Request timeout in milliseconds',
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1000)
    @Max(60000)
    timeout?: number;

    @ApiProperty({
        description: 'Maximum number of retry attempts',
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(10)
    maxRetries?: number;

    @ApiProperty({
        description: 'Backoff strategy for retries',
        enum: ['fixed', 'linear', 'exponential'],
        required: false,
    })
    @IsOptional()
    @IsEnum(['fixed', 'linear', 'exponential'])
    backoffStrategy?: 'fixed' | 'linear' | 'exponential';

    @ApiProperty({
        description: 'Base delay between retries in milliseconds',
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(100)
    @Max(10000)
    baseDelay?: number;

    @ApiProperty({
        description: 'Maximum delay between retries in milliseconds',
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1000)
    @Max(300000)
    maxDelay?: number;

    @ApiProperty({
        description: 'Add jitter to retry delays',
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    jitter?: boolean;

    @ApiProperty({
        description: 'Whether the webhook is active',
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    active?: boolean;
}
