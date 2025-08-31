import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealth(): { message: string; timestamp: string; version: string } {
    return this.appService.getHealth();
  }

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'Detailed status endpoint' })
  @ApiResponse({ status: 200, description: 'Detailed service status' })
  getStatus() {
    return this.appService.getStatus();
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Kubernetes health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealthCheck() {
    return this.appService.getHealth();
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Kubernetes readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  getReadiness() {
    return this.appService.getReadiness();
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Kubernetes liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is live' })
  getLiveness() {
    return this.appService.getLiveness();
  }

  @Public()
  @Get('metrics')
  @ApiOperation({ summary: 'Prometheus metrics endpoint' })
  @ApiResponse({ status: 200, description: 'Prometheus metrics' })
  getMetrics() {
    return this.appService.getMetrics();
  }
}
