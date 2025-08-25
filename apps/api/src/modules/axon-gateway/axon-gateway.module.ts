import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AxonpulsGateway } from './axon-gateway.gateway';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionManagerModule } from '../subscription-manager/subscription-manager.module';
import { MagicModule } from '../magic/magic.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('auth.jwt.expiresIn'),
          issuer: configService.get<string>('auth.jwt.issuer'),
          audience: configService.get<string>('auth.jwt.audience'),
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    SubscriptionManagerModule,
    MagicModule,
  ],
  providers: [AxonpulsGateway],
  exports: [AxonpulsGateway],
})
export class AxonpulsGatewayModule { }
