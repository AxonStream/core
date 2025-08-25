import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConnectionManagerService } from './connection-manager.service';
import { ConnectionHealthMonitorService } from './connection-health-monitor.service';
import { RetryManagerModule } from '../retry-manager/retry-manager.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    RetryManagerModule,
  ],
  providers: [
    ConnectionManagerService,
    ConnectionHealthMonitorService,
  ],
  exports: [
    ConnectionManagerService,
    ConnectionHealthMonitorService,
  ],
})
export class ConnectionManagerModule {}