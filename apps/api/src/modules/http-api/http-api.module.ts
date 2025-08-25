import { Module } from '@nestjs/common';
import { EventsController } from './controllers/events.controller';
import { ChannelsController } from './controllers/channels.controller';
import { TokensController } from './controllers/tokens.controller';
import { WebhooksController } from './controllers/webhooks.controller';
import { EventStreamService } from '../../common/services/event-stream.service';
import { EventReplayService } from '../../common/services/event-replay.service';
import { DeliveryGuaranteeService } from '../../common/services/delivery-guarantee.service';
import { TenantAwareService } from '../../common/services/tenant-aware.service';
import { RedisService } from '../../common/services/redis.service';
import { PrismaService } from '../../common/services/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';

/**
 * HTTP API Module
 * Provides v1 REST endpoints that expose existing robust services
 * Aligns with REAL_PROJECT_PLAN.md requirements
 */
@Module({
    imports: [AuthModule],
    controllers: [
        EventsController,
        ChannelsController,
        TokensController,
        WebhooksController,
    ],
    providers: [
        EventStreamService,
        EventReplayService,
        DeliveryGuaranteeService,
        TenantAwareService,
        RedisService,
        PrismaService,
        JwtService,
    ],
    exports: [],
})
export class HttpApiModule { }
