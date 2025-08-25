import { Module } from '@nestjs/common';
import { RBACController } from './rbac.controller';
import { RBACService } from './rbac.service';
import { PrismaModule } from '../../common/modules/prisma.module';
import { TenantModule } from '../../common/modules/tenant.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    PrismaModule,
    TenantModule,
    EventEmitterModule,
  ],
  controllers: [RBACController],
  providers: [RBACService],
  exports: [RBACService],
})
export class RBACModule {}
