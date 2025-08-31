/**
 * 🎯 Demo Module - Zero Friction Onboarding
 * 
 * Provides demo functionality without authentication
 * Following market standards from Stripe, Firebase, Pusher
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';
import { PrismaModule } from '../../common/modules/prisma.module';
import { TenantModule } from '../../common/modules/tenant.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    TenantModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const algorithm = configService.get<string>('auth.jwt.algorithm');
        const privateKey = configService.get<string>('auth.jwt.privateKey');
        const secret = configService.get<string>('auth.jwt.secret');

        // Configure based on algorithm
        const config: any = {
          signOptions: {
            expiresIn: '2h', // Demo tokens expire in 2 hours
            issuer: configService.get<string>('auth.jwt.issuer'),
            audience: configService.get<string>('auth.jwt.audience'),
            algorithm: algorithm || 'HS256',
          },
        };

        if (algorithm === 'RS256' && privateKey) {
          config.privateKey = privateKey;
          config.publicKey = configService.get<string>('auth.jwt.publicKey');
        } else {
          config.secret = secret;
        }

        return config;
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [DemoController],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule { }
