import { Module } from '@nestjs/common';
import { SubscriptionManagerService } from './subscription-manager.service';
import { SubscriptionManagerController } from './subscription-manager.controller';
import { DatabaseModule } from '../../common/database.module';
import { RedisModule } from '../../common/redis.module';
import { TenantModule } from '../../common/modules/tenant.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    TenantModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [SubscriptionManagerController],
  providers: [SubscriptionManagerService],
  exports: [SubscriptionManagerService],
})
export class SubscriptionManagerModule {}
