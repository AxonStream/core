import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebSocketServerRegistryService } from '../../common/services/websocket-server-registry.service';
import { CrossServerEventRouterService } from '../../common/services/cross-server-event-router.service';
import { DistributedConnectionManagerService } from '../../common/services/distributed-connection-manager.service';
import { MultiServerGatewayService } from '../axon-gateway/multi-server-gateway.service';
import { WebSocketHealthController } from '../health/websocket-health.controller';
import { RedisService } from '../../common/services/redis.service';
import { EventStreamService } from '../../common/services/event-stream.service';
import { TenantAwareService } from '../../common/services/tenant-aware.service';

@Module({
  imports: [ConfigModule],
  providers: [
    WebSocketServerRegistryService,
    CrossServerEventRouterService,
    DistributedConnectionManagerService,
    MultiServerGatewayService,
    RedisService,
    EventStreamService,
    TenantAwareService,
  ],
  controllers: [WebSocketHealthController],
  exports: [
    WebSocketServerRegistryService,
    CrossServerEventRouterService,
    DistributedConnectionManagerService,
    MultiServerGatewayService,
  ],
})
export class MultiServerModule {}
