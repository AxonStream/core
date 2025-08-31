/**
 * Demo DTOs for API validation
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class PublishDemoEventDto {
  @ApiProperty({
    description: 'Demo channel name',
    example: 'demo-chat',
    enum: ['demo-chat', 'demo-notifications', 'demo-analytics', 'demo-collaboration', 'demo-iot'],
  })
  @IsString()
  @IsNotEmpty()
  channel: string;

  @ApiProperty({
    description: 'Event type',
    example: 'message',
  })
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({
    description: 'Event payload',
    example: { message: 'Hello World', user: 'Demo User' },
  })
  @IsObject()
  payload: any;
}

export class UpgradeInfoDto {
  @ApiProperty({
    description: 'Email address for upgrade information',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    description: 'Use case description',
    example: 'Real-time chat application',
    required: false,
  })
  @IsOptional()
  @IsString()
  useCase?: string;
}
