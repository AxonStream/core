import { Controller, Get, Post, Body, Param, UseGuards, Logger, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MagicService, MagicRoomConfig } from './magic.service';
import { MagicTimeTravelService } from './services/magic-time-travel.service';
import { MagicMetricsService } from './services/magic-metrics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { TenantIsolationGuard } from '../../common/guards/tenant-isolation.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/services/tenant-aware.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Magic Collaboration')
@ApiBearerAuth()
@Controller('magic')
@UseGuards(JwtAuthGuard, TenantIsolationGuard, RBACGuard)
export class MagicController {
    private readonly logger = new Logger(MagicController.name);

    constructor(
        private readonly magicService: MagicService,
        private readonly timeTravelService: MagicTimeTravelService,
        private readonly metricsService: MagicMetricsService
    ) { }

    @Post('rooms')
    @Roles('magic:create')
    @ApiOperation({ summary: 'Create a new Magic collaborative room' })
    @ApiResponse({ status: 201, description: 'Magic room created successfully' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    async createRoom(
        @CurrentTenant() context: TenantContext,
        @Body() createRoomDto: {
            name: string;
            initialState: Record<string, any>;
            config?: MagicRoomConfig;
        }
    ) {
        this.logger.log(`Creating Magic room '${createRoomDto.name}' for org ${context.organizationId}`);

        return await this.magicService.createMagicRoom(
            context,
            createRoomDto.name,
            createRoomDto.initialState,
            createRoomDto.config
        );
    }

    @Get('rooms')
    @Roles('magic:read')
    @ApiOperation({ summary: 'List Magic rooms for organization' })
    @ApiResponse({ status: 200, description: 'List of Magic rooms' })
    async listRooms(@CurrentTenant() context: TenantContext) {
        return await this.magicService.listRooms(context);
    }

    @Get('rooms/:roomName/state')
    @Roles('magic:read')
    @ApiOperation({ summary: 'Get current state of Magic room' })
    @ApiResponse({ status: 200, description: 'Current room state' })
    @ApiResponse({ status: 404, description: 'Room not found' })
    async getRoomState(
        @CurrentTenant() context: TenantContext,
        @Param('roomName') roomName: string
    ) {
        const state = await this.magicService.getCurrentState(context, roomName);

        if (!state) {
            throw new Error(`Magic room '${roomName}' not found`);
        }

        return state;
    }

    // ============================================================================
    // PRESENCE AWARENESS ENDPOINTS
    // ============================================================================

    @Post(':roomName/join')
    async joinMagicRoom(
        @Param('roomName') roomName: string,
        @Body() joinData: {
            userName: string;
            userAvatar?: string;
            deviceInfo?: any;
        },
        @Req() req: any
    ) {
        const context = this.buildTenantContext(req);
        return await this.magicService.joinMagicRoom(context, roomName, joinData);
    }

    @Post(':roomName/leave')
    async leaveMagicRoom(
        @Param('roomName') roomName: string,
        @Req() req: any
    ) {
        const context = this.buildTenantContext(req);
        await this.magicService.leaveMagicRoom(context, roomName);
        return { success: true };
    }

    @Post(':roomName/presence')
    async updatePresence(
        @Param('roomName') roomName: string,
        @Body() presenceData: {
            cursorPosition?: { x: number; y: number; elementId?: string };
            selection?: { start: number; end: number; elementId?: string };
            viewportInfo?: { scrollX: number; scrollY: number; zoom: number };
            isActive?: boolean;
        },
        @Req() req: any
    ) {
        const context = this.buildTenantContext(req);
        await this.magicService.updateMagicPresence(context, roomName, presenceData);
        return { success: true };
    }

    @Get(':roomName/presences')
    async getRoomPresences(
        @Param('roomName') roomName: string,
        @Req() req: any
    ) {
        const context = this.buildTenantContext(req);
        const presences = await this.magicService.getMagicRoomPresences(context, roomName);
        return { presences };
    }

    @Post(':roomName/heartbeat')
    async sendHeartbeat(
        @Param('roomName') roomName: string,
        @Req() req: any
    ) {
        const context = this.buildTenantContext(req);
        await this.magicService.sendMagicHeartbeat(context, roomName);
        return { success: true };
    }

    // ==================== TIME TRAVEL ENDPOINTS ====================

    @Post('rooms/:roomId/snapshots')
    @Roles('magic:timetravel')
    @ApiOperation({ summary: 'Create a snapshot for time travel' })
    @ApiResponse({ status: 201, description: 'Snapshot created successfully' })
    async createSnapshot(
        @Param('roomId') roomId: string,
        @Body() body: { description?: string; branchName?: string },
        @CurrentTenant() context: TenantContext
    ) {
        const currentState = await this.magicService.getCurrentState(context, roomId);
        const snapshot = await this.timeTravelService.createSnapshot(
            context,
            roomId,
            currentState.currentState,
            currentState.version,
            body.description
        );
        const snapshotId = snapshot.id;
        return { snapshotId, message: 'Snapshot created successfully' };
    }

    @Post('rooms/:roomId/revert/:snapshotId')
    @Roles('magic:timetravel')
    @ApiOperation({ summary: 'Revert room state to a specific snapshot' })
    @ApiResponse({ status: 200, description: 'State reverted successfully' })
    async revertToSnapshot(
        @Param('roomId') roomId: string,
        @Param('snapshotId') snapshotId: string,
        @CurrentTenant() context: TenantContext
    ) {
        const result = await this.timeTravelService.revertToSnapshot(context, roomId, snapshotId);
        return { message: 'State reverted successfully', version: result.snapshot?.version || 0 };
    }

    @Get('rooms/:roomId/timeline')
    @Roles('magic:read')
    @ApiOperation({ summary: 'Get timeline of snapshots for a room' })
    @ApiResponse({ status: 200, description: 'Timeline retrieved successfully' })
    async getTimeline(
        @Param('roomId') roomId: string,
        @CurrentTenant() context: TenantContext
    ) {
        const timeline = await this.timeTravelService.getSnapshotHistory(context, roomId);
        return { timeline };
    }

    @Post('rooms/:roomId/branches')
    @Roles('magic:branch')
    @ApiOperation({ summary: 'Create a new branch from a snapshot' })
    @ApiResponse({ status: 201, description: 'Branch created successfully' })
    async createBranch(
        @Param('roomId') roomId: string,
        @Body() body: { fromSnapshotId: string; branchName: string },
        @CurrentTenant() context: TenantContext
    ) {
        const newSnapshotId = await this.timeTravelService.createBranch(
            context,
            roomId,
            body.fromSnapshotId,
            body.branchName
        );
        return { newSnapshotId, message: 'Branch created successfully' };
    }

    @Get('rooms/:roomId/branches')
    @Roles('magic:read')
    @ApiOperation({ summary: 'List all branches for a room' })
    @ApiResponse({ status: 200, description: 'Branches listed successfully' })
    async listBranches(
        @Param('roomId') roomId: string,
        @CurrentTenant() context: TenantContext
    ) {
        const branches = await this.timeTravelService.getBranches(context, roomId);
        return { branches };
    }

    @Post('rooms/:roomId/merge')
    @Roles('magic:merge')
    @ApiOperation({ summary: 'Merge two branches with conflict resolution' })
    @ApiResponse({ status: 200, description: 'Branches merged successfully' })
    async mergeBranches(
        @Param('roomId') roomId: string,
        @Body() body: {
            sourceBranch: string;
            targetBranch: string;
            mergeStrategy?: 'auto' | 'manual' | 'ours' | 'theirs'
        },
        @CurrentTenant() context: TenantContext
    ) {
        const result = await this.timeTravelService.mergeBranch(
            context,
            roomId,
            body.sourceBranch,
            body.targetBranch
        );
        return result;
    }

    @Get('rooms/:roomId/compare/:branch1/:branch2')
    @Roles('magic:read')
    @ApiOperation({ summary: 'Compare two branches to see differences' })
    @ApiResponse({ status: 200, description: 'Branch comparison completed' })
    async compareBranches(
        @Param('roomId') roomId: string,
        @Param('branch1') branch1: string,
        @Param('branch2') branch2: string,
        @CurrentTenant() context: TenantContext
    ) {
        const comparison = await this.timeTravelService.compareBranches(context, roomId, branch1, branch2);
        return comparison;
    }

    // ==================== MONITORING ENDPOINTS ====================

    @Get('metrics')
    @Roles('magic:admin')
    @ApiOperation({ summary: 'Get comprehensive Magic collaboration metrics' })
    @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
    async getMetrics(
        @CurrentTenant() context: TenantContext,
        @Body() body?: { timeRange?: '1h' | '24h' | '7d' | '30d' }
    ) {
        const now = new Date();
        const timeRanges = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000
        };

        const range = body?.timeRange || '24h';
        const timeRange = {
            start: new Date(now.getTime() - timeRanges[range]),
            end: now
        };

        const metrics = await this.metricsService.getMagicMetrics(context, timeRange);
        return { metrics, timeRange: range };
    }

    @Get('metrics/realtime')
    @Roles('magic:read')
    @ApiOperation({ summary: 'Get real-time Magic collaboration metrics' })
    @ApiResponse({ status: 200, description: 'Real-time metrics retrieved successfully' })
    async getRealTimeMetrics(@CurrentTenant() context: TenantContext) {
        const metrics = await this.metricsService.getRealTimeMetrics(context);
        return { metrics, timestamp: new Date() };
    }

    @Get('metrics/alerts')
    @Roles('magic:admin')
    @ApiOperation({ summary: 'Get Magic collaboration performance alerts' })
    @ApiResponse({ status: 200, description: 'Performance alerts retrieved successfully' })
    async getPerformanceAlerts(@CurrentTenant() context: TenantContext) {
        const alerts = await this.metricsService.getPerformanceAlerts(context);
        return { alerts, alertCount: alerts.length };
    }

    @Get('health')
    @Roles('magic:read')
    @ApiOperation({ summary: 'Get Magic collaboration system health status' })
    @ApiResponse({ status: 200, description: 'Health status retrieved successfully' })
    async getHealthStatus(@CurrentTenant() context: TenantContext) {
        const [metrics, alerts] = await Promise.all([
            this.metricsService.getRealTimeMetrics(context),
            this.metricsService.getPerformanceAlerts(context)
        ]);

        const criticalAlerts = alerts.filter(a => a.severity === 'critical');
        const warningAlerts = alerts.filter(a => a.severity === 'medium');

        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (criticalAlerts.length > 0) {
            status = 'critical';
        } else if (warningAlerts.length > 0 || metrics.errorRate > 0.05) {
            status = 'warning';
        }

        return {
            status,
            timestamp: new Date(),
            metrics: {
                operationsPerSecond: metrics.operationsPerSecond,
                averageLatency: metrics.averageLatency,
                errorRate: metrics.errorRate,
                activeRooms: metrics.activeRooms,
                activePresences: metrics.activePresences
            },
            alerts: {
                critical: criticalAlerts.length,
                warning: warningAlerts.length,
                total: alerts.length
            }
        };
    }

    // Helper method to build tenant context from request
    private buildTenantContext(req: any): any {
        return {
            organizationId: req.user?.organizationId || req.headers['x-organization-id'],
            userId: req.user?.id || req.headers['x-user-id'],
            sessionId: req.sessionID || req.headers['x-session-id'] || `session_${Date.now()}`,
        };
    }
}
