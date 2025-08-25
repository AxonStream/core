import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): { message: string; timestamp: string; version: string; platform: string } {
    return {
      message: 'AXONPULS Real-Time Platform is running',
      platform: 'AXONPULS by AxonStreamAI',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  getStatus() {
    return {
      service: 'AXONPULS Real-Time Platform',
      platform: 'AXONPULS by AxonStreamAI',
      organization: 'AxonStreamAI',
      website: 'https://axonstream.ai',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      components: {
        websocket: 'operational',
        redis: 'operational',
        database: 'operational',
        eventRouter: 'operational',
        messageQueue: 'operational',
        monitoring: 'operational',
        auditLog: 'operational',
      },
    };
  }
}
