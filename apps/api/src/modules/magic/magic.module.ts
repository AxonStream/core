import { Module } from '@nestjs/common';
import { MagicService } from './magic.service';
import { MagicController } from './magic.controller';
import { MagicOperationalTransformService } from './services/magic-operational-transform.service';
import { MagicTimeTravelService } from './services/magic-time-travel.service';
import { MagicPresenceService } from './services/magic-presence.service';
import { MagicMetricsService } from './services/magic-metrics.service';

// Import existing modules - REUSE, don't recreate
import { PrismaModule } from '../../common/modules/prisma.module';
import { RedisModule } from '../../common/redis.module';
import { RBACModule } from '../rbac/rbac.module';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
    imports: [
        PrismaModule,      // REUSE existing Prisma service
        RedisModule,       // REUSE existing Redis service
        RBACModule,        // REUSE existing RBAC service
        ConfigModule,      // REUSE existing Config service
        EventEmitterModule, // REUSE existing EventEmitter service
    ],
    providers: [
        MagicService,
        MagicOperationalTransformService,  // NEW - only OT logic
        MagicTimeTravelService,           // NEW - only time travel
        MagicPresenceService,             // NEW - only presence logic
        MagicMetricsService,              // NEW - monitoring and metrics
    ],
    controllers: [MagicController],
    exports: [
        MagicService,
        MagicPresenceService,
        MagicOperationalTransformService,
        MagicTimeTravelService,
        MagicMetricsService,
    ],
})
export class MagicModule { }
