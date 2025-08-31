import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SessionService } from './services/session.service';
import { WSTicketService } from './services/ws-ticket.service';
import { TokenService } from './services/token.service';
import { PrismaModule } from '../../common/modules/prisma.module';
import { RBACModule } from '../rbac/rbac.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    PrismaModule,
    RBACModule,
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
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    WSTicketService,
    TokenService,
    JwtStrategy,
    LocalStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, SessionService, WSTicketService, TokenService, JwtModule],
})
export class AuthModule implements OnModuleInit {
  constructor(private readonly tokenService: TokenService) { }

  async onModuleInit() {
    await this.tokenService.init();
  }
}
