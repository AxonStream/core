import { Module } from '@nestjs/common';
import { LatencyTrackerService } from './latency-tracker.service';
import { LatencyTrackerController } from './latency-tracker.controller';
// import { CommonModule } from '../../common/common.module';

@Module({
  imports: [],
  controllers: [LatencyTrackerController],
  providers: [LatencyTrackerService],
  exports: [LatencyTrackerService],
})
export class LatencyTrackerModule {}