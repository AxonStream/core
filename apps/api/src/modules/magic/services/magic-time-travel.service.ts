import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/services/prisma.service';
import { RedisService } from '../../../common/services/redis.service';
import { TenantContext } from '../../../common/services/tenant-aware.service';
import { EventStreamService } from '../../../common/services/event-stream.service';
import { Prisma } from '@prisma/client';

export interface MagicSnapshot {
    id: string;
    roomId: string;
    branchName: string;
    snapshotData: Record<string, unknown>;
    version: number;
    description: string;
    createdAt: Date;
    createdBy: string;
    parentSnapshot?: string;
    operations: Record<string, unknown>;
}

export interface MagicBranch {
    id: string;
    roomId: string;
    name: string;
    baseSnapshotId: string;
    currentSnapshotId: string;
    createdAt: Date;
    createdBy: string;
    isActive: boolean;
    lastActivity: Date;
    metadata: {
        operationCount: number;
        conflictCount: number;
        mergeAttempts: number;
        lastMergeAt?: Date;
    };
}

export interface TimeTravelResult {
    success: boolean;
    snapshot?: MagicSnapshot;
    branch?: MagicBranch;
    conflicts?: Array<{
        type: 'merge_conflict' | 'version_conflict' | 'state_conflict';
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        conflictingOperations: string[];
        suggestedResolution?: string;
    }>;
    requiresUserIntervention: boolean;
    performanceMetrics: {
        processingTime: number;
        snapshotSize: number;
        compressionTime: number;
        validationTime: number;
    };
}

@Injectable()
export class MagicTimeTravelService {
    private readonly logger = new Logger(MagicTimeTravelService.name);

    // Production-grade configuration
    private readonly config = {
        // Snapshot management
        maxSnapshotsPerRoom: 1000,
        maxSnapshotSizeBytes: 10 * 1024 * 1024, // 10MB
        snapshotRetentionDays: 365,
        enableSnapshotCompression: true,
        compressionThresholdBytes: 1024, // 1KB

        // Branch management
        maxBranchesPerRoom: 50,
        maxBranchLifetimeDays: 30,
        enableBranchCleanup: true,
        branchCleanupInterval: 24 * 60 * 60 * 1000, // 24 hours

        // Performance tuning
        enableSnapshotCaching: true,
        cacheExpirationSeconds: 3600, // 1 hour
        batchSnapshotSize: 100,
        snapshotTimeoutMs: 60000, // 1 minute

        // Monitoring
        enableTimeTravelMetrics: true,
        enableConflictTracking: true,
        metricsCollectionInterval: 300000 // 5 minutes
    };

    // Redis keys for time travel management
    private readonly SNAPSHOT_CACHE_KEY = 'magic:snapshot_cache';
    private readonly BRANCH_TRACKING_KEY = 'magic:branch_tracking';
    private readonly TIME_TRAVEL_METRICS_KEY = 'magic:timetravel_metrics';

    constructor(
        private prisma: PrismaService,
        private redis: RedisService,
        private eventStream: EventStreamService,
        private configService: ConfigService,
    ) {
        this.loadConfiguration();
    }

    private loadConfiguration(): void {
        // Load configuration from environment with sensible defaults
        this.config.maxSnapshotsPerRoom = this.configService.get<number>('MAGIC_MAX_SNAPSHOTS_PER_ROOM', 1000);
        this.config.maxSnapshotSizeBytes = this.configService.get<number>('MAGIC_MAX_SNAPSHOT_SIZE_BYTES', 10 * 1024 * 1024);
        this.config.snapshotRetentionDays = this.configService.get<number>('MAGIC_SNAPSHOT_RETENTION_DAYS', 365);
        this.config.maxBranchesPerRoom = this.configService.get<number>('MAGIC_MAX_BRANCHES_PER_ROOM', 50);
        this.config.maxBranchLifetimeDays = this.configService.get<number>('MAGIC_MAX_BRANCH_LIFETIME_DAYS', 30);
        this.config.snapshotTimeoutMs = this.configService.get<number>('MAGIC_SNAPSHOT_TIMEOUT_MS', 60000);
        this.config.cacheExpirationSeconds = this.configService.get<number>('MAGIC_SNAPSHOT_CACHE_EXPIRATION_SECONDS', 3600);
    }

    /**
     * Create a new snapshot of the current state
     */
    async createSnapshot(
        context: TenantContext,
        roomId: string,
        state: Record<string, unknown>,
        version: number,
        description: string = 'Auto-generated snapshot'
    ): Promise<MagicSnapshot> {
        const startTime = this.getCurrentTimestamp();

        try {
            // Validate state size
            const stateSize = JSON.stringify(state).length;
            if (stateSize > this.config.maxSnapshotSizeBytes) {
                throw new Error(`State size ${stateSize} bytes exceeds maximum allowed ${this.config.maxSnapshotSizeBytes} bytes`);
            }

            // Check snapshot limits
            const snapshotCount = await this.prisma.magicSnapshot.count({
                where: { roomId }
            });

            if (snapshotCount >= this.config.maxSnapshotsPerRoom) {
                await this.cleanupOldSnapshots(roomId);
            }

            // Compress state if enabled and above threshold
            let compressedState = state;
            let compressionRatio = 1;
            let compressionTime = 0;

            if (this.config.enableSnapshotCompression && stateSize > this.config.compressionThresholdBytes) {
                const compressionStart = this.getCurrentTimestamp();
                compressedState = await this.compressState(state);
                compressionTime = this.getCurrentTimestamp() - compressionStart;
                compressionRatio = JSON.stringify(compressedState).length / stateSize;
            }

            // Generate checksum for state validation
            const checksum = this.generateChecksum(compressedState);

            // Create snapshot
            const snapshot = await this.prisma.magicSnapshot.create({
                data: {
                    roomId,
                    stateKey: 'main',
                    branchName: 'main',
                    snapshotData: compressedState as Prisma.JsonValue,
                    version,
                    description,
                    createdBy: context.userId || 'system',
                    operations: {
                        operationCount: 0,
                        conflictCount: 0,
                        stateSize,
                        compressionRatio,
                        checksum
                    }
                }
            });

            // Cache snapshot
            if (this.config.enableSnapshotCaching) {
                await this.cacheSnapshot(snapshot);
            }

            // Record metrics
            if (this.config.enableTimeTravelMetrics) {
                await this.recordSnapshotMetrics(roomId, {
                    processingTime: this.getCurrentTimestamp() - startTime,
                    snapshotSize: stateSize,
                    compressionTime,
                    validationTime: 0
                });
            }

            this.logger.log(`Created snapshot ${snapshot.id} for room ${roomId} at version ${version}`);

            return {
                id: snapshot.id,
                roomId: snapshot.roomId,
                branchName: snapshot.branchName,
                snapshotData: compressedState,
                version: snapshot.version,
                description: snapshot.description,
                createdAt: snapshot.createdAt,
                createdBy: snapshot.createdBy,
                parentSnapshot: snapshot.parentSnapshot || undefined,
                operations: snapshot.operations as Record<string, unknown>
            };

        } catch (error) {
            this.logger.error(`Failed to create snapshot for room ${roomId}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
            throw error;
        }
    }

    /**
     * Create a new branch from an existing snapshot
     */
    async createBranch(
        context: TenantContext,
        roomId: string,
        baseSnapshotId: string,
        branchName: string,
        description?: string
    ): Promise<MagicBranch> {
        try {
            // Validate base snapshot exists
            const baseSnapshot = await this.prisma.magicSnapshot.findUnique({
                where: { id: baseSnapshotId }
            });

            if (!baseSnapshot || baseSnapshot.roomId !== roomId) {
                throw new Error(`Base snapshot ${baseSnapshotId} not found`);
            }

            // Check branch limits
            const branchCount = await this.prisma.magicSnapshot.count({
                where: { roomId }
            });

            if (branchCount >= this.config.maxBranchesPerRoom) {
                throw new Error(`Room ${roomId} has reached maximum branch limit`);
            }

            // Create branch
            const branch = await this.prisma.magicSnapshot.create({
                data: {
                    roomId,
                    branchName,
                    stateKey: 'main',
                    snapshotData: baseSnapshot.snapshotData,
                    version: baseSnapshot.version,
                    description: description || `Branch from ${baseSnapshot.description}`,
                    createdBy: context.userId || 'system',
                    parentSnapshot: baseSnapshotId,
                    operations: {
                        operationCount: 0,
                        conflictCount: 0,
                        stateSize: JSON.stringify(baseSnapshot.snapshotData).length,
                        compressionRatio: 1,
                        checksum: this.generateChecksum(baseSnapshot.snapshotData as Record<string, unknown>)
                    }
                }
            });

            // Track branch
            await this.trackBranch(roomId, branchName, baseSnapshotId, branch.id);

            this.logger.log(`Created branch ${branchName} for room ${roomId} from snapshot ${baseSnapshotId}`);

            return {
                id: branch.id,
                roomId: branch.roomId,
                name: branch.branchName,
                baseSnapshotId: branch.parentSnapshot || branch.id,
                currentSnapshotId: branch.id,
                createdAt: branch.createdAt,
                createdBy: branch.createdBy,
                isActive: true,
                lastActivity: branch.createdAt,
                metadata: {
                    operationCount: 0,
                    conflictCount: 0,
                    mergeAttempts: 0
                }
            };

        } catch (error) {
            this.logger.error(`Failed to create branch ${branchName} for room ${roomId}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
            throw error;
        }
    }

    /**
     * Merge a branch back to the main branch
     */
    async mergeBranch(
        context: TenantContext,
        roomId: string,
        branchName: string,
        targetBranchName: string = 'main',
        mergeStrategy: 'auto' | 'manual' | 'ours' | 'theirs' = 'auto'
    ): Promise<TimeTravelResult> {
        const startTime = this.getCurrentTimestamp();

        try {
            // Get branch snapshots
            const [branchSnapshot, targetSnapshot] = await Promise.all([
                this.prisma.magicSnapshot.findFirst({
                    where: { roomId, branchName },
                    orderBy: { createdAt: 'desc' }
                }),
                this.prisma.magicSnapshot.findFirst({
                    where: { roomId, branchName: targetBranchName },
                    orderBy: { createdAt: 'desc' }
                })
            ]);

            if (!branchSnapshot) {
                throw new Error(`Branch ${branchName} not found`);
            }

            if (!targetSnapshot) {
                throw new Error(`Target branch ${targetBranchName} not found`);
            }

            // Detect conflicts
            const conflicts = await this.detectMergeConflicts(branchSnapshot, targetSnapshot);

            if (conflicts.length > 0) {
                const criticalConflicts = conflicts.filter(c => c.severity === 'critical');
                if (criticalConflicts.length > 0) {
                    return {
                        success: false,
                        conflicts,
                        requiresUserIntervention: true,
                        performanceMetrics: {
                            processingTime: this.getCurrentTimestamp() - startTime,
                            snapshotSize: 0,
                            compressionTime: 0,
                            validationTime: 0
                        }
                    };
                }
            }

            // Apply merge strategy
            let mergedState: Record<string, unknown>;
            switch (mergeStrategy) {
                case 'ours':
                    mergedState = branchSnapshot.snapshotData as Record<string, unknown>;
                    break;
                case 'theirs':
                    mergedState = targetSnapshot.snapshotData as Record<string, unknown>;
                    break;
                case 'manual':
                    if (conflicts.length > 0) {
                        return {
                            success: false,
                            conflicts,
                            requiresUserIntervention: true,
                            performanceMetrics: {
                                processingTime: this.getCurrentTimestamp() - startTime,
                                snapshotSize: 0,
                                compressionTime: 0,
                                validationTime: 0
                            }
                        };
                    }
                    mergedState = await this.mergeStates(
                        branchSnapshot.snapshotData as Record<string, unknown>,
                        targetSnapshot.snapshotData as Record<string, unknown>
                    );
                    break;
                case 'auto':
                default:
                    mergedState = await this.mergeStates(
                        branchSnapshot.snapshotData as Record<string, unknown>,
                        targetSnapshot.snapshotData as Record<string, unknown>
                    );
                    break;
            }

            // Create merge snapshot
            const mergeSnapshot = await this.prisma.magicSnapshot.create({
                data: {
                    roomId,
                    branchName: targetBranchName,
                    stateKey: 'main',
                    snapshotData: mergedState as Prisma.JsonValue,
                    version: Math.max(branchSnapshot.version, targetSnapshot.version) + 1,
                    description: `Merge from ${branchName} to ${targetBranchName} using ${mergeStrategy} strategy`,
                    createdBy: context.userId || 'system',
                    parentSnapshot: targetSnapshot.id,
                    operations: {
                        operationCount: ((branchSnapshot.operations as Record<string, unknown>)?.operationCount as number || 0) + ((targetSnapshot.operations as Record<string, unknown>)?.operationCount as number || 0),
                        conflictCount: conflicts.length,
                        stateSize: JSON.stringify(mergedState).length,
                        compressionRatio: 1,
                        checksum: this.generateChecksum(mergedState)
                    }
                }
            });

            // Update branch tracking
            await this.updateBranchTracking(roomId, branchName, mergeSnapshot.id);

            // Record metrics
            if (this.config.enableTimeTravelMetrics) {
                await this.recordMergeMetrics(roomId, {
                    processingTime: this.getCurrentTimestamp() - startTime,
                    snapshotSize: JSON.stringify(mergedState).length,
                    compressionTime: 0,
                    validationTime: 0
                });
            }

            this.logger.log(`Successfully merged branch ${branchName} to ${targetBranchName} in room ${roomId} using ${mergeStrategy} strategy`);

            return {
                success: true,
                snapshot: {
                    id: mergeSnapshot.id,
                    roomId: mergeSnapshot.roomId,
                    branchName: mergeSnapshot.branchName,
                    snapshotData: mergedState,
                    version: mergeSnapshot.version,
                    description: mergeSnapshot.description,
                    createdAt: mergeSnapshot.createdAt,
                    createdBy: mergeSnapshot.createdBy,
                    parentSnapshot: mergeSnapshot.parentSnapshot || undefined,
                    operations: mergeSnapshot.operations as Record<string, unknown>
                },
                conflicts,
                requiresUserIntervention: false,
                performanceMetrics: {
                    processingTime: this.getCurrentTimestamp() - startTime,
                    snapshotSize: JSON.stringify(mergedState).length,
                    compressionTime: 0,
                    validationTime: 0
                }
            };

        } catch (error) {
            this.logger.error(`Failed to merge branch ${branchName} in room ${roomId}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
            throw error;
        }
    }

    /**
     * Revert to a previous snapshot
     */
    async revertToSnapshot(
        context: TenantContext,
        roomId: string,
        snapshotId: string,
        branchName: string = 'main'
    ): Promise<TimeTravelResult> {
        const startTime = this.getCurrentTimestamp();

        try {
            // Get target snapshot
            const targetSnapshot = await this.prisma.magicSnapshot.findUnique({
                where: { id: snapshotId }
            });

            if (!targetSnapshot || targetSnapshot.roomId !== roomId) {
                throw new Error(`Snapshot ${snapshotId} not found`);
            }

            // Validate snapshot checksum
            const currentChecksum = this.generateChecksum(targetSnapshot.snapshotData as Record<string, unknown>);
            const snapshotOperations = targetSnapshot.operations as Record<string, unknown>;
            if (currentChecksum !== snapshotOperations?.checksum) {
                throw new Error(`Snapshot ${snapshotId} checksum validation failed`);
            }

            // Create revert snapshot
            const revertSnapshot = await this.prisma.magicSnapshot.create({
                data: {
                    roomId,
                    branchName,
                    stateKey: 'main',
                    snapshotData: targetSnapshot.snapshotData,
                    version: targetSnapshot.version + 1,
                    description: `Revert to snapshot ${snapshotId}`,
                    createdBy: context.userId || 'system',
                    parentSnapshot: snapshotId,
                    operations: {
                        operationCount: 0,
                        conflictCount: 0,
                        stateSize: JSON.stringify(targetSnapshot.snapshotData).length,
                        compressionRatio: 1,
                        checksum: currentChecksum
                    }
                }
            });

            // Record metrics
            if (this.config.enableTimeTravelMetrics) {
                await this.recordRevertMetrics(roomId, {
                    processingTime: this.getCurrentTimestamp() - startTime,
                    snapshotSize: JSON.stringify(targetSnapshot.snapshotData).length,
                    compressionTime: 0,
                    validationTime: this.getCurrentTimestamp() - startTime
                });
            }

            this.logger.log(`Successfully reverted room ${roomId} to snapshot ${snapshotId}`);

            return {
                success: true,
                snapshot: {
                    id: revertSnapshot.id,
                    roomId: revertSnapshot.roomId,
                    branchName: revertSnapshot.branchName,
                    snapshotData: targetSnapshot.snapshotData as Record<string, unknown>,
                    version: revertSnapshot.version,
                    description: revertSnapshot.description,
                    createdAt: revertSnapshot.createdAt,
                    createdBy: revertSnapshot.createdBy,
                    parentSnapshot: revertSnapshot.parentSnapshot || undefined,
                    operations: revertSnapshot.operations as Record<string, unknown>
                },
                requiresUserIntervention: false,
                performanceMetrics: {
                    processingTime: this.getCurrentTimestamp() - startTime,
                    snapshotSize: JSON.stringify(targetSnapshot.snapshotData).length,
                    compressionTime: 0,
                    validationTime: this.getCurrentTimestamp() - startTime
                }
            };

        } catch (error) {
            this.logger.error(`Failed to revert room ${roomId} to snapshot ${snapshotId}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
            throw error;
        }
    }

    /**
     * Get snapshot history for a room
     */
    async getSnapshotHistory(
        context: TenantContext,
        roomId: string,
        branchName: string = 'main',
        limit: number = 100
    ): Promise<MagicSnapshot[]> {
        try {
            const snapshots = await this.prisma.magicSnapshot.findMany({
                where: { roomId, branchName },
                orderBy: { createdAt: 'desc' },
                take: Math.min(limit, this.config.batchSnapshotSize)
            });

            return snapshots.map(snapshot => ({
                id: snapshot.id,
                roomId: snapshot.roomId,
                branchName: snapshot.branchName,
                snapshotData: snapshot.snapshotData as Record<string, unknown>,
                version: snapshot.version,
                description: snapshot.description,
                createdAt: snapshot.createdAt,
                createdBy: snapshot.createdBy,
                parentSnapshot: snapshot.parentSnapshot || undefined,
                operations: snapshot.operations as Record<string, unknown>
            }));

        } catch (error) {
            this.logger.error(`Failed to get snapshot history for room ${roomId}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
            throw error;
        }
    }

    /**
     * Get branch information for a room
     */
    async getBranches(
        context: TenantContext,
        roomId: string
    ): Promise<MagicBranch[]> {
        try {
            const branches = await this.prisma.magicSnapshot.groupBy({
                by: ['branchName'],
                where: { roomId },
                _count: { id: true },
                _max: { createdAt: true, version: true }
            });

            const branchPromises = branches.map(async (branch) => {
                const latestSnapshot = await this.prisma.magicSnapshot.findFirst({
                    where: { roomId, branchName: branch.branchName },
                    orderBy: { createdAt: 'desc' }
                });

                if (!latestSnapshot) return null;

                return {
                    id: latestSnapshot.id,
                    roomId: latestSnapshot.roomId,
                    name: branch.branchName,
                    baseSnapshotId: latestSnapshot.parentSnapshot || latestSnapshot.id,
                    currentSnapshotId: latestSnapshot.id,
                    createdAt: latestSnapshot.createdAt,
                    createdBy: latestSnapshot.createdBy,
                    isActive: true,
                    lastActivity: latestSnapshot.createdAt,
                    metadata: {
                        operationCount: (latestSnapshot.operations as Record<string, unknown>)?.operationCount as number || 0,
                        conflictCount: (latestSnapshot.operations as Record<string, unknown>)?.conflictCount as number || 0,
                        mergeAttempts: 0
                    }
                };
            });

            const branchResults = await Promise.all(branchPromises);
            return branchResults.filter((branch): branch is MagicBranch => branch !== null);

        } catch (error) {
            this.logger.error(`Failed to get branches for room ${roomId}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
            throw error;
        }
    }

    /**
     * Compare two branches to see differences
     */
    async compareBranches(
        context: TenantContext,
        roomId: string,
        branch1: string,
        branch2: string
    ): Promise<{
        success: boolean;
        differences: Array<{
            path: string;
            type: 'added' | 'removed' | 'modified';
            oldValue?: unknown;
            newValue?: unknown;
            severity: 'low' | 'medium' | 'high';
        }>;
        summary: {
            totalDifferences: number;
            addedCount: number;
            removedCount: number;
            modifiedCount: number;
            conflictCount: number;
        };
    }> {
        try {
            // Get latest snapshots for both branches
            const [branch1Snapshot, branch2Snapshot] = await Promise.all([
                this.prisma.magicSnapshot.findFirst({
                    where: { roomId, branchName: branch1 },
                    orderBy: { createdAt: 'desc' }
                }),
                this.prisma.magicSnapshot.findFirst({
                    where: { roomId, branchName: branch2 },
                    orderBy: { createdAt: 'desc' }
                })
            ]);

            if (!branch1Snapshot) {
                throw new Error(`Branch ${branch1} not found`);
            }

            if (!branch2Snapshot) {
                throw new Error(`Branch ${branch2} not found`);
            }

            // Compare states
            const differences = this.compareStates(
                branch1Snapshot.snapshotData as Record<string, unknown>,
                branch2Snapshot.snapshotData as Record<string, unknown>
            );

            // Categorize differences
            const addedCount = differences.filter(d => d.type === 'added').length;
            const removedCount = differences.filter(d => d.type === 'removed').length;
            const modifiedCount = differences.filter(d => d.type === 'modified').length;
            const conflictCount = differences.filter(d => d.severity === 'high').length;

            return {
                success: true,
                differences,
                summary: {
                    totalDifferences: differences.length,
                    addedCount,
                    removedCount,
                    modifiedCount,
                    conflictCount
                }
            };

        } catch (error) {
            this.logger.error(`Failed to compare branches ${branch1} and ${branch2} in room ${roomId}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
            throw error;
        }
    }

    /**
     * Get timeline of snapshots for a room
     */
    async getTimeline(
        context: TenantContext,
        roomId: string,
        limit: number = 100
    ): Promise<{
        snapshots: MagicSnapshot[];
        branches: MagicBranch[];
        timeline: Array<{
            timestamp: Date;
            event: 'snapshot' | 'branch' | 'merge' | 'revert';
            description: string;
            snapshotId?: string;
            branchName?: string;
        }>;
    }> {
        try {
            // Get snapshots and branches
            const [snapshots, branches] = await Promise.all([
                this.getSnapshotHistory(context, roomId, 'main', limit),
                this.getBranches(context, roomId)
            ]);

            // Build timeline
            const timeline = [];

            // Add snapshots to timeline
            for (const snapshot of snapshots) {
                timeline.push({
                    timestamp: snapshot.createdAt,
                    event: 'snapshot' as const,
                    description: snapshot.description,
                    snapshotId: snapshot.id
                });
            }

            // Add branch events to timeline
            for (const branch of branches) {
                timeline.push({
                    timestamp: branch.createdAt,
                    event: 'branch' as const,
                    description: `Branch ${branch.name} created`,
                    branchName: branch.name
                });
            }

            // Sort timeline by timestamp
            timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

            return {
                snapshots,
                branches,
                timeline: timeline.slice(0, limit)
            };

        } catch (error) {
            this.logger.error(`Failed to get timeline for room ${roomId}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
            throw error;
        }
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Compress state data
     */
    private async compressState(state: Record<string, unknown>): Promise<Record<string, unknown>> {
        try {
            // Simple compression: remove null/undefined values and compress strings
            const compressed = JSON.parse(JSON.stringify(state, (key, value) => {
                if (value === null || value === undefined) {
                    return undefined;
                }
                if (typeof value === 'string' && value.length > 100) {
                    // For very long strings, consider compression
                    return value;
                }
                return value;
            }));

            return compressed;
        } catch (error) {
            this.logger.error(`State compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
            return state; // Return original state if compression fails
        }
    }

    /**
     * Generate checksum for state validation
     */
    private generateChecksum(state: Record<string, unknown>): string {
        try {
            const stateString = JSON.stringify(state);
            const crypto = require('crypto');
            return crypto.createHash('sha256').update(stateString).digest('hex').substring(0, 16);
        } catch (error) {
            this.logger.error(`Checksum generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
            return 'checksum_failed';
        }
    }

    /**
     * Detect merge conflicts between snapshots
     */
    private async detectMergeConflicts(
        branchSnapshot: { id: string; version: number; snapshotData: unknown },
        targetSnapshot: { id: string; version: number; snapshotData: unknown }
    ): Promise<Array<{
        type: 'merge_conflict' | 'version_conflict' | 'state_conflict';
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        conflictingOperations: string[];
        suggestedResolution?: string;
    }>> {
        const conflicts = [];

        try {
            // Check version conflicts
            if (branchSnapshot.version === targetSnapshot.version) {
                conflicts.push({
                    type: 'version_conflict',
                    severity: 'high',
                    description: `Both snapshots have same version ${branchSnapshot.version}`,
                    conflictingOperations: [branchSnapshot.id, targetSnapshot.id],
                    suggestedResolution: 'Resolve version conflict manually'
                });
            }

            // Check state conflicts
            const branchState = branchSnapshot.snapshotData as Record<string, unknown>;
            const targetState = targetSnapshot.snapshotData as Record<string, unknown>;

            const conflictingKeys = this.findConflictingKeys(branchState, targetState);
            if (conflictingKeys.length > 0) {
                conflicts.push({
                    type: 'state_conflict',
                    severity: conflictingKeys.length > 10 ? 'critical' : 'medium',
                    description: `Found ${conflictingKeys.length} conflicting keys between snapshots`,
                    conflictingOperations: [branchSnapshot.id, targetSnapshot.id],
                    suggestedResolution: 'Review conflicting keys and resolve manually'
                });
            }

        } catch (error) {
            this.logger.error(`Conflict detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
        }

        return conflicts;
    }

    /**
     * Find conflicting keys between two states
     */
    private findConflictingKeys(state1: Record<string, unknown>, state2: Record<string, unknown>): string[] {
        const conflicts: string[] = [];

        try {
            const allKeys = new Set([...Object.keys(state1), ...Object.keys(state2)]);

            for (const key of allKeys) {
                if (state1[key] !== undefined && state2[key] !== undefined) {
                    if (JSON.stringify(state1[key]) !== JSON.stringify(state2[key])) {
                        conflicts.push(key);
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Key conflict detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
        }

        return conflicts;
    }

    /**
     * Merge two states
     */
    private async mergeStates(
        state1: Record<string, unknown>,
        state2: Record<string, unknown>
    ): Promise<Record<string, unknown>> {
        try {
            // Simple merge: combine all properties, with state2 taking precedence
            const merged = { ...state1, ...state2 };

            // For nested objects, perform deep merge
            for (const key in merged) {
                if (state1[key] && state2[key] &&
                    typeof state1[key] === 'object' && typeof state2[key] === 'object' &&
                    !Array.isArray(state1[key]) && !Array.isArray(state2[key])) {
                    merged[key] = await this.mergeStates(
                        state1[key] as Record<string, unknown>,
                        state2[key] as Record<string, unknown>
                    );
                }
            }

            return merged;
        } catch (error) {
            this.logger.error(`State merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
            // Return state2 as fallback
            return state2;
        }
    }

    /**
     * Clean up old snapshots
     */
    private async cleanupOldSnapshots(roomId: string): Promise<void> {
        try {
            const cutoffDate = new Date(Date.now() - this.config.snapshotRetentionDays * 24 * 60 * 60 * 1000);

            const oldSnapshots = await this.prisma.magicSnapshot.findMany({
                where: {
                    roomId,
                    createdAt: { lt: cutoffDate }
                },
                orderBy: { createdAt: 'asc' },
                take: 100 // Clean up in batches
            });

            if (oldSnapshots.length > 0) {
                await this.prisma.magicSnapshot.deleteMany({
                    where: {
                        id: { in: oldSnapshots.map(s => s.id) }
                    }
                });

                this.logger.log(`Cleaned up ${oldSnapshots.length} old snapshots for room ${roomId}`);
            }
        } catch (error) {
            this.logger.error(`Snapshot cleanup failed for room ${roomId}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
        }
    }

    // ==================== CACHING METHODS ====================

    private async cacheSnapshot(snapshot: { id: string }): Promise<void> {
        try {
            const cacheKey = `${this.SNAPSHOT_CACHE_KEY}:${snapshot.id}`;
            await this.redis.client.setEx(
                cacheKey,
                this.config.cacheExpirationSeconds,
                JSON.stringify(snapshot)
            );
        } catch (error) {
            this.logger.error(`Failed to cache snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
        }
    }

    // ==================== TRACKING METHODS ====================

    private async trackBranch(
        roomId: string,
        branchName: string,
        baseSnapshotId: string,
        currentSnapshotId: string
    ): Promise<void> {
        try {
            const branchData = {
                roomId,
                branchName,
                baseSnapshotId,
                currentSnapshotId,
                createdAt: this.getCurrentTimestamp(),
                isActive: true
            };

            await this.redis.client.hSet(
                `${this.BRANCH_TRACKING_KEY}:${roomId}`,
                branchName,
                JSON.stringify(branchData)
            );
        } catch (error) {
            this.logger.error(`Failed to track branch: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
        }
    }

    private async updateBranchTracking(
        roomId: string,
        branchName: string,
        currentSnapshotId: string
    ): Promise<void> {
        try {
            const branchData = await this.redis.client.hGet(
                `${this.BRANCH_TRACKING_KEY}:${roomId}`,
                String(branchName)
            );

            if (branchData && typeof branchData === 'string') {
                const branch = JSON.parse(branchData) as {
                    currentSnapshotId: string;
                    lastActivity: number;
                };
                branch.currentSnapshotId = currentSnapshotId;
                branch.lastActivity = this.getCurrentTimestamp();

                await this.redis.client.hSet(
                    `${this.BRANCH_TRACKING_KEY}:${roomId}`,
                    String(branchName),
                    JSON.stringify(branch)
                );
            }
        } catch (error) {
            this.logger.error(`Failed to update branch tracking: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
        }
    }

    // ==================== METRICS METHODS ====================

    private async recordSnapshotMetrics(
        roomId: string,
        metrics: {
            processingTime: number;
            snapshotSize: number;
            compressionTime: number;
            validationTime: number;
        }
    ): Promise<void> {
        try {
            const metricsData = {
                roomId,
                type: 'snapshot',
                timestamp: this.getCurrentTimestamp(),
                ...metrics
            };

            await this.redis.client.lPush(
                `${this.TIME_TRAVEL_METRICS_KEY}:${roomId}`,
                JSON.stringify(metricsData)
            );

            await this.redis.client.lTrim(`${this.TIME_TRAVEL_METRICS_KEY}:${roomId}`, 0, 999);
        } catch (error) {
            this.logger.error(`Failed to record snapshot metrics: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
        }
    }

    private async recordMergeMetrics(
        roomId: string,
        metrics: {
            processingTime: number;
            snapshotSize: number;
            compressionTime: number;
            validationTime: number;
        }
    ): Promise<void> {
        try {
            const metricsData = {
                roomId,
                type: 'merge',
                timestamp: this.getCurrentTimestamp(),
                ...metrics
            };

            await this.redis.client.lPush(
                `${this.TIME_TRAVEL_METRICS_KEY}:${roomId}`,
                JSON.stringify(metricsData)
            );

            await this.redis.client.lTrim(`${this.TIME_TRAVEL_METRICS_KEY}:${roomId}`, 0, 999);
        } catch (error) {
            this.logger.error(`Failed to record merge metrics: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
        }
    }

    private async recordRevertMetrics(
        roomId: string,
        metrics: {
            processingTime: number;
            snapshotSize: number;
            compressionTime: number;
            validationTime: number;
        }
    ): Promise<void> {
        try {
            const metricsData = {
                roomId,
                type: 'revert',
                timestamp: this.getCurrentTimestamp(),
                ...metrics
            };

            await this.redis.client.lPush(
                `${this.TIME_TRAVEL_METRICS_KEY}:${roomId}`,
                JSON.stringify(metricsData)
            );

            await this.redis.client.lTrim(`${this.TIME_TRAVEL_METRICS_KEY}:${roomId}`, 0, 999);
        } catch (error) {
            this.logger.error(`Failed to record revert metrics: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
        }
    }

    // ==================== UTILITY METHODS ====================

    private getCurrentTimestamp(): number {
        return Date.now();
    }

    /**
     * Compare two states and find differences
     */
    private compareStates(
        state1: Record<string, unknown>,
        state2: Record<string, unknown>,
        path: string[] = []
    ): Array<{
        path: string;
        type: 'added' | 'removed' | 'modified';
        oldValue?: unknown;
        newValue?: unknown;
        severity: 'low' | 'medium' | 'high';
    }> {
        const differences: Array<{
            path: string;
            type: 'added' | 'removed' | 'modified';
            oldValue?: unknown;
            newValue?: unknown;
            severity: 'low' | 'medium' | 'high';
        }> = [];

        try {
            const allKeys = new Set([...Object.keys(state1), ...Object.keys(state2)]);

            for (const key of allKeys) {
                const currentPath = [...path, key];
                const pathString = currentPath.join('.');

                if (state1[key] === undefined && state2[key] !== undefined) {
                    // Added in state2
                    differences.push({
                        path: pathString,
                        type: 'added',
                        newValue: state2[key],
                        severity: this.determineChangeSeverity(state2[key])
                    });
                } else if (state1[key] !== undefined && state2[key] === undefined) {
                    // Removed in state2
                    differences.push({
                        path: pathString,
                        type: 'removed',
                        oldValue: state1[key],
                        severity: this.determineChangeSeverity(state1[key])
                    });
                } else if (JSON.stringify(state1[key]) !== JSON.stringify(state2[key])) {
                    // Modified
                    if (typeof state1[key] === 'object' && state1[key] !== null &&
                        typeof state2[key] === 'object' && state2[key] !== null &&
                        !Array.isArray(state1[key]) && !Array.isArray(state2[key])) {
                        // Recursively compare nested objects
                        differences.push(...this.compareStates(
                            state1[key] as Record<string, unknown>,
                            state2[key] as Record<string, unknown>,
                            currentPath
                        ));
                    } else {
                        // Direct value change
                        differences.push({
                            path: pathString,
                            type: 'modified',
                            oldValue: state1[key],
                            newValue: state2[key],
                            severity: this.determineChangeSeverity(state1[key], state2[key])
                        });
                    }
                }
            }
        } catch (error) {
            this.logger.error(`State comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
        }

        return differences;
    }

    /**
     * Determine severity of a change
     */
    private determineChangeSeverity(oldValue?: unknown, newValue?: unknown): 'low' | 'medium' | 'high' {
        try {
            if (oldValue === undefined || newValue === undefined) {
                return 'medium'; // Adding/removing values
            }

            // High severity for structural changes
            if (Array.isArray(oldValue) !== Array.isArray(newValue)) {
                return 'high';
            }

            if (typeof oldValue !== typeof newValue) {
                return 'high';
            }

            // Medium severity for object changes
            if (typeof oldValue === 'object' && oldValue !== null) {
                return 'medium';
            }

            // Low severity for primitive value changes
            return 'low';
        } catch (error) {
            return 'medium'; // Default to medium if analysis fails
        }
    }
}
