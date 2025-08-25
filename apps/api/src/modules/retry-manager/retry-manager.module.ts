import { Module } from '@nestjs/common';
import { RetryManagerService } from './retry-manager.service';

@Module({
  providers: [RetryManagerService],
  exports: [RetryManagerService],
})
export class RetryManagerModule {}