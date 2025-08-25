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
}
