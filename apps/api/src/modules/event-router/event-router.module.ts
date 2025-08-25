import { Module } from '@nestjs/common';
import { EventRouterService } from './event-router.service';

@Module({
  providers: [EventRouterService],
  exports: [EventRouterService],
})
export class EventRouterModule {}