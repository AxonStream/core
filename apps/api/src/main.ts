import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create NestJS application with Fastify adapter
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const environment = configService.get<string>('NODE_ENV', 'development');

  // Security middleware
  await app.register(helmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        styleSrc: [`'self'`, `'unsafe-inline'`],
        scriptSrc: [`'self'`],
        objectSrc: [`'none'`],
        upgradeInsecureRequests: [],
      },
    },
  });

  // CORS configuration
  await app.register(cors as any, {
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit as any, {
    max: configService.get<number>('RATE_LIMIT_MAX', 100),
    timeWindow: configService.get<number>('RATE_LIMIT_WINDOW', 60000), // 1 minute
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation
  if (environment !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AXONPULS Real-Time Platform')
      .setDescription('Enterprise-grade real-time messaging platform by AxonStreamAI')
      .setVersion('1.0.0')
      .setContact('AxonStreamAI', 'https://axonstream.ai', 'info@axonstream.ai')
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('websocket', 'WebSocket gateway endpoints')
      .addTag('events', 'Event management endpoints')
      .addTag('subscriptions', 'Subscription management endpoints')
      .addTag('monitoring', 'Platform monitoring endpoints')
      .addTag('audit', 'Audit and compliance endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Start the application
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 AXONPULS Real-Time Platform is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  logger.log(`🌍 Environment: ${environment}`);
  logger.log(`🏢 Organization: AxonStreamAI (https://axonstream.ai)`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
