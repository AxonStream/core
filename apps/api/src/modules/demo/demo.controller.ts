/**
 * 🎯 Demo Controller - Zero Friction Onboarding
 * 
 * Provides public demo access without authentication
 * Following market standards from Stripe, Firebase, Pusher
 */

import { Controller, Post, Get, Body, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { DemoService } from './demo.service';
import { PublishDemoEventDto, UpgradeInfoDto } from './dto/demo.dto';
import { Request } from 'express';

@ApiTags('demo')
@Controller('demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) { }

  @Public()
  @Get('token')
  @ApiOperation({
    summary: 'Get enhanced demo access token',
    description: 'Generate a comprehensive demo token with server-side session tracking',
  })
  @ApiResponse({
    status: 200,
    description: 'Enhanced demo token generated with comprehensive access',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        token: { type: 'string', example: 'demo_abc123...' },
        org: { type: 'string', example: 'demo-org' },
        expiresIn: { type: 'string', example: '2h' },
        expiresAt: { type: 'string', format: 'date-time' },
        limitations: {
          type: 'object',
          properties: {
            maxChannels: { type: 'number', example: 5 },
            maxEvents: { type: 'number', example: 100 },
            rateLimit: { type: 'string', example: '10/minute' },
          },
        },
        nextSteps: {
          type: 'object',
          properties: {
            signup: { type: 'string', example: '/auth/register' },
            docs: { type: 'string', example: 'https://docs.axonstream.ai' },
            examples: { type: 'string', example: 'https://github.com/axonstream/examples' },
            upgrade: { type: 'string', example: '/demo/upgrade' },
          },
        },
      },
    },
  })
  async getDemoToken(@Req() req: Request) {
    return this.demoService.generateDemoToken(req);
  }

  @Public()
  @Get('channels')
  @ApiOperation({
    summary: 'List demo channels',
    description: 'Get available demo channels with sample data',
  })
  @ApiResponse({
    status: 200,
    description: 'Demo channels listed',
  })
  async getDemoChannels() {
    return this.demoService.getDemoChannels();
  }

  @Public()
  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Publish demo event',
    description: 'Publish an event to demo channels - rate limited',
  })
  @ApiResponse({
    status: 201,
    description: 'Demo event published',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async publishDemoEvent(
    @Body() eventData: PublishDemoEventDto,
  ) {
    return this.demoService.publishDemoEvent(eventData);
  }

  @Public()
  @Get('events')
  @ApiOperation({
    summary: 'Get demo events',
    description: 'Retrieve recent events from demo channels',
  })
  @ApiResponse({
    status: 200,
    description: 'Demo events retrieved',
  })
  async getDemoEvents(
    @Query('channel') channel?: string,
    @Query('limit') limit?: number,
  ) {
    return this.demoService.getDemoEvents(channel, limit);
  }

  @Public()
  @Get('status')
  @ApiOperation({
    summary: 'Demo environment status',
    description: 'Check demo environment health and usage',
  })
  @ApiResponse({
    status: 200,
    description: 'Demo status retrieved',
  })
  async getDemoStatus() {
    return this.demoService.getDemoStatus();
  }

  @Public()
  @Post('upgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upgrade from demo',
    description: 'Get information about upgrading from demo to full account',
  })
  @ApiResponse({
    status: 200,
    description: 'Upgrade information provided',
  })
  async getUpgradeInfo(
    @Body() data: UpgradeInfoDto,
  ) {
    return this.demoService.getUpgradeInfo(data);
  }

  @Public()
  @Post('session/validate')
  @ApiOperation({
    summary: 'Validate demo session',
    description: 'Server-side validation of demo token and session tracking',
  })
  async validateDemoSession(@Body() body: { token: string }) {
    const session = await this.demoService.validateDemoSession(body.token);
    return {
      valid: !!session,
      session: session || null,
    };
  }

  @Public()
  @Post('usage/track')
  @ApiOperation({
    summary: 'Track feature usage',
    description: 'Track when demo users use specific features',
  })
  async trackFeatureUsage(
    @Body() body: {
      sessionId: string;
      featureName: string;
      featureCategory: string;
    }
  ) {
    await this.demoService.trackFeatureUsage(
      body.sessionId,
      body.featureName,
      body.featureCategory,
      0 // Initial usage count
    );

    const limits = await this.demoService.checkDemoLimits(
      body.sessionId,
      body.featureName
    );

    return {
      success: true,
      limits,
    };
  }

  @Public()
  @Get('limits/:sessionId/:feature')
  @ApiOperation({
    summary: 'Check demo limits',
    description: 'Check if demo session has reached feature limits',
  })
  async checkDemoLimits(
    @Query('sessionId') sessionId: string,
    @Query('feature') feature: string,
  ) {
    return this.demoService.checkDemoLimits(sessionId, feature);
  }
}
