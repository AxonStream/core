import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisService } from './services/redis.service';
import { EventStreamService } from './services/event-stream.service';
import { DeliveryGuaranteeService } from './services/delivery-guarantee.service';
import { EventReplayService } from './services/event-replay.service';

@Global()
@Module({
  imports: [ConfigModule, EventEmitterModule],
  providers: [
    RedisService,
    EventStreamService,
    DeliveryGuaranteeService,
    EventReplayService
  ],
  exports: [
    RedisService,
    EventStreamService,
    DeliveryGuaranteeService,
    EventReplayService
  ],
})
export class RedisModule { }
