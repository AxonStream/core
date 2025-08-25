import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/services/redis.service';
import { EventStreamService } from '../../common/services/event-stream.service';

@Injectable()
export class WebSocketDiagnosticsService {
    private readonly logger = new Logger(WebSocketDiagnosticsService.name);

    constructor(
        private configService: ConfigService,
        private redisService: RedisService,
        private eventStreamService: EventStreamService,
    ) { }

    async runDiagnostics(): Promise<any> {
        const results: any = {
            timestamp: new Date().toISOString(),
            tests: [],
            summary: { passed: 0, failed: 0, warnings: 0 }
        };

        // Test 1: Redis Connection
        try {
            const redisStatus = await this.redisService.getRedisInstance().ping();
            results.tests.push({
                name: 'Redis Connection',
                status: redisStatus ? 'PASS' : 'FAIL',
                message: redisStatus ? 'Redis is responsive' : 'Redis connection failed',
            });
            redisStatus ? results.summary.passed++ : results.summary.failed++;
        } catch (error) {
            results.tests.push({
                name: 'Redis Connection',
                status: 'FAIL',
                message: `Redis error: ${error.message}`,
            });
            results.summary.failed++;
        }

        // Test 2: WebSocket Configuration
        try {
            const wsPort = this.configService.get('websocket.port', 3002);
            const wsCors = this.configService.get('websocket.cors.origin');

            results.tests.push({
                name: 'WebSocket Configuration',
                status: 'PASS',
                message: `WebSocket configured on port ${wsPort} with CORS: ${wsCors}`,
            });
            results.summary.passed++;
        } catch (error) {
            results.tests.push({
                name: 'WebSocket Configuration',
                status: 'FAIL',
                message: `Configuration error: ${error.message}`,
            });
            results.summary.failed++;
        }

        // Test 3: JWT Configuration
        try {
            const jwtPublicKey = this.configService.get('auth.jwt.publicKey');
            const jwtIssuer = this.configService.get('auth.jwt.issuer');

            if (!jwtPublicKey || jwtPublicKey === 'your-rsa-public-key-here') {
                results.tests.push({
                    name: 'JWT Configuration',
                    status: 'WARNING',
                    message: 'JWT public key not configured for RS256. Using default fallback.',
                });
                results.summary.warnings++;
            } else {
                results.tests.push({
                    name: 'JWT Configuration',
                    status: 'PASS',
                    message: `JWT RS256 configured with issuer: ${jwtIssuer}`,
                });
                results.summary.passed++;
            }
        } catch (error) {
            results.tests.push({
                name: 'JWT Configuration',
                status: 'FAIL',
                message: `JWT configuration error: ${error.message}`,
            });
            results.summary.failed++;
        }

        // Test 4: Redis Streams Configuration
        try {
            const streamPrefix = this.configService.get('redis.streams.prefix', 'axonstream:events:');
            const consumerGroup = this.configService.get('redis.streams.consumerGroup', 'axonstream-consumers');

            results.tests.push({
                name: 'Redis Streams Configuration',
                status: 'PASS',
                message: `Streams configured with prefix: ${streamPrefix}, consumer group: ${consumerGroup}`,
            });
            results.summary.passed++;
        } catch (error) {
            results.tests.push({
                name: 'Redis Streams Configuration',
                status: 'FAIL',
                message: `Streams configuration error: ${error.message}`,
            });
            results.summary.failed++;
        }

        // Test 5: Audit Logging Status
        try {
            const auditEnabled = this.configService.get('tenant.auditLogging', true);
            const auditRealtime = this.configService.get('tenant.audit.realTime', true);

            results.tests.push({
                name: 'Audit Logging',
                status: 'PASS',
                message: `Audit logging enabled: ${auditEnabled}, real-time: ${auditRealtime}`,
            });
            results.summary.passed++;
        } catch (error) {
            results.tests.push({
                name: 'Audit Logging',
                status: 'FAIL',
                message: `Audit configuration error: ${error.message}`,
            });
            results.summary.failed++;
        }

        this.logger.log(`Diagnostics completed: ${results.summary.passed} passed, ${results.summary.failed} failed, ${results.summary.warnings} warnings`);

        return results;
    }

    async testWebSocketSubscription(organizationId: string, userId: string, channel: string): Promise<any> {
        try {
            // Test event publishing to Redis stream
            const testEvent = {
                id: `test-${Date.now()}`,
                eventType: 'diagnostic.test',
                channel,
                payload: { message: 'WebSocket subscription test', timestamp: Date.now() },
                organizationId,
                userId,
                acknowledgment: true,
                retryCount: 0,
                createdAt: new Date().toISOString(),
            };

            // This would normally be done through the EventStreamService
            const streamKey = `axonstream:events:${organizationId}:${channel}`;
            const redis = this.redisService.getRedisInstance();

            const result = await redis.sendCommand([
                'XADD',
                streamKey,
                '*',
                'event',
                JSON.stringify(testEvent)
            ]);

            return {
                success: true,
                streamKey,
                messageId: result,
                testEvent,
                message: 'Test event published to Redis stream successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Failed to publish test event to Redis stream'
            };
        }
    }
}
