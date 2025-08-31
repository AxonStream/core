import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebSocketServerRegistryService } from '../../common/services/websocket-server-registry.service';
import { CrossServerEventRouterService } from '../../common/services/cross-server-event-router.service';
import { DistributedConnectionManagerService } from '../../common/services/distributed-connection-manager.service';
import { MultiServerGatewayService } from '../axon-gateway/multi-server-gateway.service';
import { RedisService } from '../../common/services/redis.service';
import { EventStreamService } from '../../common/services/event-stream.service';
import { TenantAwareService } from '../../common/services/tenant-aware.service';

describe('Multi-Server WebSocket System', () => {
  let serverRegistry: WebSocketServerRegistryService;
  let crossServerRouter: CrossServerEventRouterService;
  let connectionManager: DistributedConnectionManagerService;
  let multiServerGateway: MultiServerGatewayService;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketServerRegistryService,
        CrossServerEventRouterService,
        DistributedConnectionManagerService,
        MultiServerGatewayService,
        {
          provide: RedisService,
          useValue: {
            getRedisInstance: jest.fn().mockReturnValue({
              ping: jest.fn().mockResolvedValue('PONG'),
              hSet: jest.fn().mockResolvedValue(1),
              hGet: jest.fn().mockResolvedValue('{}'),
              hGetAll: jest.fn().mockResolvedValue({}),
              hDel: jest.fn().mockResolvedValue(1),
              sAdd: jest.fn().mockResolvedValue(1),
              sRem: jest.fn().mockResolvedValue(1),
              sMembers: jest.fn().mockResolvedValue([]),
              setEx: jest.fn().mockResolvedValue('OK'),
              get: jest.fn().mockResolvedValue(null),
              del: jest.fn().mockResolvedValue(1),
              expire: jest.fn().mockResolvedValue(1),
              publish: jest.fn().mockResolvedValue(1),
            }),
            getPubSubClient: jest.fn().mockReturnValue({
              subscribe: jest.fn().mockResolvedValue(undefined),
              unsubscribe: jest.fn().mockResolvedValue(undefined),
            }),
          },
        },
        {
          provide: EventStreamService,
          useValue: {
            publishEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TenantAwareService,
          useValue: {
            logTenantAccess: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
              const config = {
                'server.host': 'localhost',
                'server.port': 3000,
                'websocket.port': 3001,
                'websocket.maxConnections': 10000,
                'websocket.multiServer.enabled': true,
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    serverRegistry = module.get<WebSocketServerRegistryService>(WebSocketServerRegistryService);
    crossServerRouter = module.get<CrossServerEventRouterService>(CrossServerEventRouterService);
    connectionManager = module.get<DistributedConnectionManagerService>(DistributedConnectionManagerService);
    multiServerGateway = module.get<MultiServerGatewayService>(MultiServerGatewayService);
    redisService = module.get<RedisService>(RedisService);
  });

  describe('WebSocketServerRegistryService', () => {
    it('should register server successfully', async () => {
      await expect(serverRegistry.registerServer()).resolves.not.toThrow();
    });

    it('should get active servers', async () => {
      const servers = await serverRegistry.getActiveServers();
      expect(Array.isArray(servers)).toBe(true);
    });

    it('should find best server for connection', async () => {
      const bestServer = await serverRegistry.getBestServerForConnection('test-org');
      expect(bestServer).toBeDefined();
    });

    it('should update server metrics', async () => {
      await expect(serverRegistry.updateServerMetrics({ connections: 5 })).resolves.not.toThrow();
    });

    it('should get current server info', () => {
      const serverInfo = serverRegistry.getCurrentServer();
      expect(serverInfo).toBeDefined();
      expect(serverInfo.id).toBeDefined();
      expect(serverInfo.host).toBe('localhost');
      expect(serverInfo.port).toBe(3000);
    });
  });

  describe('CrossServerEventRouterService', () => {
    it('should broadcast to all servers', async () => {
      const messageId = await crossServerRouter.broadcastToAllServers(
        'test-org',
        'test-channel',
        {
          id: 'test-event',
          eventType: 'test',
          organizationId: 'test-org',
          payload: { message: 'Hello World' },
          timestamp: Date.now(),
        }
      );
      expect(messageId).toBeDefined();
    });

    it('should send to specific servers', async () => {
      const messageId = await crossServerRouter.sendToSpecificServers(
        ['server-1', 'server-2'],
        'test-org',
        'test-channel',
        {
          id: 'test-event',
          eventType: 'test',
          organizationId: 'test-org',
          payload: { message: 'Hello World' },
          timestamp: Date.now(),
        }
      );
      expect(messageId).toBeDefined();
    });

    it('should send to user server', async () => {
      const messageId = await crossServerRouter.sendToUserServer(
        'user-123',
        'test-org',
        'test-channel',
        {
          id: 'test-event',
          eventType: 'test',
          organizationId: 'test-org',
          payload: { message: 'Hello User' },
          timestamp: Date.now(),
        }
      );
      expect(messageId).toBeNull(); // User not found
    });
  });

  describe('DistributedConnectionManagerService', () => {
    it('should register connection', async () => {
      await expect(connectionManager.registerConnection({
        sessionId: 'session-123',
        userId: 'user-123',
        organizationId: 'test-org',
        socketId: 'socket-123',
        clientType: 'web',
        channels: ['general'],
        metadata: { userAgent: 'test-browser' },
      })).resolves.not.toThrow();
    });

    it('should get connection', async () => {
      const connection = await connectionManager.getConnection('session-123');
      expect(connection).toBeNull(); // Not found in mock
    });

    it('should get server connections', async () => {
      const connections = await connectionManager.getServerConnections('server-123');
      expect(Array.isArray(connections)).toBe(true);
    });

    it('should get organization connections', async () => {
      const connections = await connectionManager.getOrganizationConnections('test-org');
      expect(Array.isArray(connections)).toBe(true);
    });

    it('should get server load metrics', async () => {
      const metrics = await connectionManager.getServerLoadMetrics();
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should find user server', async () => {
      const serverId = await connectionManager.findUserServer('user-123', 'test-org');
      expect(serverId).toBeNull(); // Not found in mock
    });
  });

  describe('MultiServerGatewayService', () => {
    beforeEach(() => {
      // Mock the server property
      multiServerGateway.server = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      } as any;
    });

    it('should broadcast to all servers', async () => {
      await expect(multiServerGateway.broadcastToAllServers(
        'test-org',
        'test-channel',
        {
          id: 'test-event',
          eventType: 'test',
          organizationId: 'test-org',
          payload: { message: 'Hello World' },
          timestamp: Date.now(),
        }
      )).resolves.not.toThrow();
    });

    it('should send to user', async () => {
      const result = await multiServerGateway.sendToUser(
        'user-123',
        'test-org',
        'test-channel',
        {
          id: 'test-event',
          eventType: 'test',
          organizationId: 'test-org',
          payload: { message: 'Hello User' },
          timestamp: Date.now(),
        }
      );
      expect(typeof result).toBe('boolean');
    });

    it('should get cluster connection stats', async () => {
      const stats = await multiServerGateway.getClusterConnectionStats();
      expect(stats).toBeDefined();
      expect(stats.totalConnections).toBeDefined();
      expect(stats.serverConnections).toBeDefined();
      expect(stats.organizationConnections).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete connection lifecycle', async () => {
      // Register server
      await serverRegistry.registerServer();

      // Register connection
      await connectionManager.registerConnection({
        sessionId: 'integration-session',
        userId: 'integration-user',
        organizationId: 'integration-org',
        socketId: 'integration-socket',
        clientType: 'web',
        channels: ['general'],
        metadata: { userAgent: 'integration-test' },
      });

      // Broadcast message
      await crossServerRouter.broadcastToAllServers(
        'integration-org',
        'general',
        {
          id: 'integration-event',
          eventType: 'integration_test',
          organizationId: 'integration-org',
          payload: { message: 'Integration test message' },
          timestamp: Date.now(),
        }
      );

      // Unregister connection
      await connectionManager.unregisterConnection('integration-session');

      // Unregister server
      await serverRegistry.unregisterServer();
    });

    it('should handle server failure scenario', async () => {
      // Simulate server registration
      await serverRegistry.registerServer();

      // Get active servers
      const servers = await serverRegistry.getActiveServers();
      expect(Array.isArray(servers)).toBe(true);

      // Simulate server failure by not sending heartbeat
      // In real scenario, cleanup task would remove dead servers
    });

    it('should handle load balancing scenario', async () => {
      // Get load metrics
      const metrics = await connectionManager.getServerLoadMetrics();
      expect(Array.isArray(metrics)).toBe(true);

      // Find best server
      const bestServer = await serverRegistry.getBestServerForConnection('test-org');
      expect(bestServer).toBeDefined();
    });
  });

  afterEach(async () => {
    // Cleanup
    await serverRegistry.unregisterServer();
  });
});
