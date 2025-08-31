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
      useFactory: async (configService: ConfigService) => {
        const algorithm = configService.get<string>('auth.jwt.algorithm');
        const privateKey = configService.get<string>('auth.jwt.privateKey');
        const secret = configService.get<string>('auth.jwt.secret');

        // Configure based on algorithm
        const config: any = {
          signOptions: {
            expiresIn: configService.get<string>('auth.jwt.expiresIn'),
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
    AuthModule,
    SubscriptionManagerModule,
    MagicModule,
  ],
  providers: [AxonpulsGateway],
  exports: [AxonpulsGateway],
})
export class AxonpulsGatewayModule { }
