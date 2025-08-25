import { Module } from '@nestjs/common';
import { AuditLoggerService } from './audit-logger.service';
import { AuditLoggerController } from './audit-logger.controller';
// import { CommonModule } from '../../common/common.module';

@Module({
  imports: [],
  controllers: [AuditLoggerController],
  providers: [AuditLoggerService],
  exports: [AuditLoggerService],
})
export class AuditLoggerModule {}