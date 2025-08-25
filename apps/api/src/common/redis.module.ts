import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './services/redis.service';
import { EventStreamService } from './services/event-stream.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisService, EventStreamService],
  exports: [RedisService, EventStreamService],
})
export class RedisModule {}
