/**
 * 🧪 Health Client Tests
 * 
 * Comprehensive test suite for health monitoring functionality
 */

import { HealthClient } from '../health';
import { AxonPulsError } from '../errors';

// Mock API client
const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};

const mockConfig = {
  baseURL: 'https://api.axonstream.ai',
  timeout: 5000,
};

describe('HealthClient', () => {
  let healthClient: HealthClient;

  beforeEach(() => {
    healthClient = new HealthClient(mockApiClient as any, mockConfig);
    jest.clearAllMocks();
  });

  describe('check', () => {
    it('should get health status successfully', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: '2024-01-01T00:00:00Z',
        version: '2.0.0',
        uptime: 3600000,
        checks: [
          {
            name: 'database',
            status: 'pass',
            message: 'Database connection healthy',
            duration: 5,
          },
          {
            name: 'redis',
            status: 'pass',
            message: 'Redis connection healthy',
            duration: 2,
          },
        ],
        services: [
          {
            name: 'postgres',
            status: 'up',
            responseTime: 5,
            lastCheck: '2024-01-01T00:00:00Z',
          },
          {
            name: 'redis',
            status: 'up',
            responseTime: 2,
            lastCheck: '2024-01-01T00:00:00Z',
          },
        ],
        performance: {
          cpu: {
            usage: 25.5,
            load: [0.5, 0.6, 0.7],
          },
          memory: {
            used: 512000000,
            total: 2048000000,
            percentage: 25,
          },
          connections: {
            active: 150,
            total: 200,
            peak: 180,
          },
          throughput: {
            requestsPerSecond: 100,
            messagesPerSecond: 500,
            eventsPerSecond: 250,
          },
        },
      };

      mockApiClient.get.mockResolvedValue({ data: mockHealth });

      const result = await healthClient.check();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/health');
      expect(result).toEqual(mockHealth);
    });

    it('should handle health check errors', async () => {
      mockApiClient.get.mockRejectedValue({
        response: {
          status: 503,
          data: { message: 'Service unavailable' },
        },
      });

      await expect(healthClient.check()).rejects.toThrow(AxonPulsError);
    });
  });

  describe('checkWebSocket', () => {
    it('should get WebSocket health status successfully', async () => {
      const mockWebSocketHealth = {
        status: 'healthy',
        timestamp: 1640995200000,
        server: {
          id: 'server-1',
          uptime: 3600000,
          version: '2.0.0',
        },
        websocket: {
          connections: 150,
          maxConnections: 1000,
          loadPercentage: 0.15,
          status: 'ready',
        },
        redis: {
          connected: true,
          latency: 2,
        },
        cluster: {
          activeServers: 3,
          totalConnections: 450,
          crossServerCommunication: true,
        },
        checks: [
          {
            name: 'websocket_capacity',
            status: 'pass',
            message: 'WebSocket capacity normal: 15%',
          },
        ],
      };

      mockApiClient.get.mockResolvedValue({ data: mockWebSocketHealth });

      const result = await healthClient.checkWebSocket();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/health/websocket');
      expect(result).toEqual(mockWebSocketHealth);
    });
  });

  describe('checkReadiness', () => {
    it('should get readiness status successfully', async () => {
      const mockReadiness = {
        ready: true,
        checks: {
          redis: true,
          websocket: true,
          cluster: true,
          database: true,
        },
      };

      mockApiClient.get.mockResolvedValue({ data: mockReadiness });

      const result = await healthClient.checkReadiness();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/health/ready');
      expect(result).toEqual(mockReadiness);
    });

    it('should handle not ready status', async () => {
      const mockReadiness = {
        ready: false,
        reason: 'Failed checks: redis, database',
        checks: {
          redis: false,
          websocket: true,
          cluster: true,
          database: false,
        },
      };

      mockApiClient.get.mockResolvedValue({ data: mockReadiness });

      const result = await healthClient.checkReadiness();

      expect(result.ready).toBe(false);
      expect(result.reason).toBe('Failed checks: redis, database');
    });
  });

  describe('checkLiveness', () => {
    it('should get liveness status successfully', async () => {
      const mockLiveness = {
        alive: true,
        timestamp: 1640995200000,
        pid: 12345,
        uptime: 3600000,
      };

      mockApiClient.get.mockResolvedValue({ data: mockLiveness });

      const result = await healthClient.checkLiveness();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/health/live');
      expect(result).toEqual(mockLiveness);
    });
  });

  describe('getMetrics', () => {
    it('should get system metrics successfully', async () => {
      const mockMetrics = {
        timestamp: '2024-01-01T00:00:00Z',
        server: {
          hostname: 'axonpuls-server-1',
          platform: 'linux',
          arch: 'x64',
          nodeVersion: '18.17.0',
        },
        process: {
          pid: 12345,
          uptime: 3600000,
          memoryUsage: {
            rss: 100000000,
            heapUsed: 50000000,
            heapTotal: 80000000,
            external: 5000000,
          },
          cpuUsage: {
            user: 1000000,
            system: 500000,
          },
        },
        system: {
          loadAverage: [0.5, 0.6, 0.7],
          totalMemory: 2048000000,
          freeMemory: 1024000000,
          cpuCount: 4,
        },
        application: {
          activeConnections: 150,
          totalRequests: 10000,
          errorRate: 0.01,
          averageResponseTime: 50,
        },
      };

      mockApiClient.get.mockResolvedValue({ data: mockMetrics });

      const result = await healthClient.getMetrics();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/health/metrics');
      expect(result).toEqual(mockMetrics);
    });
  });

  describe('checkDependencies', () => {
    it('should get dependencies health successfully', async () => {
      const mockDependencies = [
        {
          name: 'postgres',
          status: 'up',
          responseTime: 5,
          lastCheck: '2024-01-01T00:00:00Z',
        },
        {
          name: 'redis',
          status: 'up',
          responseTime: 2,
          lastCheck: '2024-01-01T00:00:00Z',
        },
        {
          name: 'external-api',
          status: 'down',
          responseTime: undefined,
          lastCheck: '2024-01-01T00:00:00Z',
          error: 'Connection timeout',
        },
      ];

      mockApiClient.get.mockResolvedValue({ data: mockDependencies });

      const result = await healthClient.checkDependencies();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/health/dependencies');
      expect(result).toEqual(mockDependencies);
    });
  });

  describe('drainServer', () => {
    it('should drain server successfully', async () => {
      const mockDrainResponse = {
        status: 'draining',
        timeout: 30000,
      };

      mockApiClient.post.mockResolvedValue({ data: mockDrainResponse });

      const result = await healthClient.drainServer(30000);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/health/drain', { timeout: 30000 });
      expect(result).toEqual(mockDrainResponse);
    });

    it('should drain server with default timeout', async () => {
      const mockDrainResponse = {
        status: 'draining',
        timeout: undefined,
      };

      mockApiClient.post.mockResolvedValue({ data: mockDrainResponse });

      await healthClient.drainServer();

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/health/drain', { timeout: undefined });
    });
  });

  describe('checkCluster', () => {
    it('should get cluster health successfully', async () => {
      const mockClusterHealth = {
        status: 'healthy',
        servers: [
          {
            id: 'server-1',
            status: 'active',
            connections: 150,
            lastSeen: '2024-01-01T00:00:00Z',
          },
          {
            id: 'server-2',
            status: 'active',
            connections: 200,
            lastSeen: '2024-01-01T00:00:00Z',
          },
          {
            id: 'server-3',
            status: 'draining',
            connections: 100,
            lastSeen: '2024-01-01T00:00:00Z',
          },
        ],
        totalConnections: 450,
        averageLoad: 0.5,
      };

      mockApiClient.get.mockResolvedValue({ data: mockClusterHealth });

      const result = await healthClient.checkCluster();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/health/cluster');
      expect(result).toEqual(mockClusterHealth);
    });
  });

  describe('ping', () => {
    it('should ping server successfully', async () => {
      const mockPingResponse = {
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockApiClient.get.mockResolvedValue({ data: mockPingResponse });

      const result = await healthClient.ping();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/health/ping');
      expect(result.pong).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBe('2024-01-01T00:00:00Z');
    });

    it('should handle ping failures', async () => {
      mockApiClient.get.mockRejectedValue({
        response: {
          status: 503,
          data: { message: 'Service unavailable' },
        },
      });

      await expect(healthClient.ping()).rejects.toThrow(AxonPulsError);
    });
  });

  describe('monitor', () => {
    it('should start health monitoring', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: '2024-01-01T00:00:00Z',
        version: '2.0.0',
        uptime: 3600000,
        checks: [],
        services: [],
        performance: {
          cpu: { usage: 25, load: [] },
          memory: { used: 0, total: 0, percentage: 0 },
          connections: { active: 0, total: 0, peak: 0 },
          throughput: { requestsPerSecond: 0, messagesPerSecond: 0, eventsPerSecond: 0 },
        },
      };

      mockApiClient.get.mockResolvedValue({ data: mockHealth });

      const callback = jest.fn();
      const stopMonitoring = await healthClient.monitor(callback, 1000);

      // Wait for first call
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledWith(mockHealth);

      // Stop monitoring
      stopMonitoring();
    });

    it('should handle monitoring errors', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'));

      const callback = jest.fn();
      const stopMonitoring = await healthClient.monitor(callback, 100);

      // Wait for first call
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          checks: expect.arrayContaining([
            expect.objectContaining({
              name: 'health_monitor',
              status: 'fail',
              message: 'Network error',
            }),
          ]),
        })
      );

      // Stop monitoring
      stopMonitoring();
    });
  });
});
