import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service'; // REUSE
import { TenantContext } from '../../../common/services/tenant-aware.service'; // REUSE
import { MagicOperationalTransformService, MagicOperation } from './magic-operational-transform.service';

export interface MagicSnapshot {
    id: string;
    roomId: string;
    stateKey: string;
    snapshotData: Record<string, any>;
    version: number;
    description?: string;
    branchName: string;
    createdAt: Date;
    createdBy: string;
    operations?: MagicOperation[];
    parentSnapshot?: string;
}

export interface BranchMergeConflict {
    path: string;
    sourceBranch: string;
    targetBranch: string;
    sourceValue: any;
    targetValue: any;
    conflictType: 'type_mismatch' | 'concurrent_modification' | 'path_conflict';
}

export interface MergeResult {
    success: boolean;
    mergedState?: Record<string, any>;
    conflicts?: BranchMergeConflict[];
    mergeCommitId?: string;
}

export interface TimeTravelOperation {
    type: 'snapshot' | 'branch' | 'merge' | 'revert';
    roomId: string;
    branchName: string;
    description: string;
    metadata: Record<string, any>;
}

@Injectable()
export class MagicTimeTravelService {
    private readonly logger = new Logger(MagicTimeTravelService.name);

    constructor(
        private prisma: PrismaService, // REUSE existing service
        private operationalTransform: MagicOperationalTransformService, // REUSE for conflict resolution
    ) { }

    /**
     * Create snapshot for time travel
     * NEW functionality - time travel specific
     */
    async createSnapshot(
        context: TenantContext,
        roomId: string,
        stateData: Record<string, any>,
        version: number,
        description?: string,
        branchName = 'main'
    ): Promise<string> {

        const snapshot = await this.prisma.magicSnapshot.create({
            data: {
                roomId,
                stateKey: 'main',
                snapshotData: stateData,
                version,
                operations: [], // Empty for now - could store operations that led to this state
                createdBy: context.userId || 'system',
                description: description || `Snapshot at version ${version}`,
                branchName,
            }
        });

        this.logger.log(`Created snapshot ${snapshot.id} for room ${roomId} at version ${version}`);
        return snapshot.id;
    }

    /**
     * Replay to specific snapshot
     * NEW functionality
     */
    async replayToSnapshot(
        context: TenantContext,
        roomId: string,
        snapshotId: string
    ): Promise<{ state: any; version: number }> {

        const snapshot = await this.prisma.magicSnapshot.findUnique({
            where: { id: snapshotId }
        });

        if (!snapshot) {
            throw new Error(`Snapshot ${snapshotId} not found`);
        }

        if (snapshot.roomId !== roomId) {
            throw new Error(`Snapshot ${snapshotId} does not belong to room ${roomId}`);
        }

        // Update current state to snapshot state
        await this.prisma.magicState.updateMany({
            where: {
                roomId,
                stateKey: 'main'
            },
            data: {
                currentState: snapshot.snapshotData,
                version: snapshot.version,
                lastModifiedAt: new Date(),
                lastModifiedBy: context.userId || 'system',
            }
        });

        this.logger.log(`Replayed room ${roomId} to snapshot ${snapshotId} (version ${snapshot.version})`);

        return {
            state: snapshot.snapshotData as any,
            version: snapshot.version
        };
    }

    /**
     * Get timeline of snapshots
     */
    async getTimeline(
        context: TenantContext,
        roomId: string,
        branchName = 'main'
    ): Promise<Array<{
        id: string;
        version: number;
        createdAt: Date;
        description?: string;
        createdBy: string;
    }>> {

        const snapshots = await this.prisma.magicSnapshot.findMany({
            where: {
                roomId,
                branchName
            },
            orderBy: { version: 'asc' },
            select: {
                id: true,
                version: true,
                createdAt: true,
                description: true,
                createdBy: true,
            }
        });

        return snapshots;
    }

    /**
     * Create new branch from snapshot
     * NEW functionality
     */
    async createBranch(
        context: TenantContext,
        roomId: string,
        fromSnapshotId: string,
        newBranchName: string
    ): Promise<string> {

        const sourceSnapshot = await this.prisma.magicSnapshot.findUnique({
            where: { id: fromSnapshotId }
        });

        if (!sourceSnapshot) {
            throw new Error(`Source snapshot ${fromSnapshotId} not found`);
        }

        if (sourceSnapshot.roomId !== roomId) {
            throw new Error(`Snapshot ${fromSnapshotId} does not belong to room ${roomId}`);
        }

        const newSnapshot = await this.prisma.magicSnapshot.create({
            data: {
                roomId: sourceSnapshot.roomId,
                stateKey: sourceSnapshot.stateKey,
                snapshotData: sourceSnapshot.snapshotData,
                version: sourceSnapshot.version,
                operations: sourceSnapshot.operations,
                createdBy: context.userId || 'system',
                description: `Branch '${newBranchName}' created from ${sourceSnapshot.description || 'snapshot'}`,
                branchName: newBranchName,
                parentSnapshot: fromSnapshotId,
            }
        });

        this.logger.log(`Created branch '${newBranchName}' from snapshot ${fromSnapshotId}`);
        return newSnapshot.id;
    }

    /**
     * List all branches for a room
     */
    async listBranches(
        context: TenantContext,
        roomId: string
    ): Promise<Array<{
        branchName: string;
        latestVersion: number;
        snapshotCount: number;
        lastUpdated: Date;
    }>> {

        const branchData = await this.prisma.magicSnapshot.groupBy({
            by: ['branchName'],
            where: { roomId },
            _count: { id: true },
            _max: { version: true, createdAt: true },
        });

        return branchData.map(branch => ({
            branchName: branch.branchName,
            latestVersion: branch._max.version || 0,
            snapshotCount: branch._count.id,
            lastUpdated: branch._max.createdAt || new Date(),
        }));
    }

    /**
     * Get snapshot by ID
     */
    async getSnapshot(
        context: TenantContext,
        snapshotId: string
    ): Promise<MagicSnapshot | null> {

        const snapshot = await this.prisma.magicSnapshot.findUnique({
            where: { id: snapshotId }
        });

        if (!snapshot) {
            return null;
        }

        return {
            id: snapshot.id,
            roomId: snapshot.roomId,
            stateKey: snapshot.stateKey,
            snapshotData: snapshot.snapshotData as Record<string, any>,
            version: snapshot.version,
            description: snapshot.description || undefined,
            branchName: snapshot.branchName,
            createdAt: snapshot.createdAt,
            createdBy: snapshot.createdBy,
            operations: snapshot.operations ? (snapshot.operations as unknown as MagicOperation[]) : undefined,
            parentSnapshot: snapshot.parentSnapshot || undefined,
        };
    }

    /**
     * ADVANCED: Merge branch with conflict detection and resolution
     */
    async mergeBranches(
        context: TenantContext,
        roomId: string,
        sourceBranch: string,
        targetBranch: string,
        mergeStrategy: 'auto' | 'manual' | 'ours' | 'theirs' = 'auto'
    ): Promise<MergeResult> {
        this.logger.log(`Merging branch '${sourceBranch}' into '${targetBranch}' for room ${roomId}`);

        const [sourceSnapshot, targetSnapshot] = await Promise.all([
            this.getLatestSnapshot(roomId, sourceBranch),
            this.getLatestSnapshot(roomId, targetBranch)
        ]);

        if (!sourceSnapshot || !targetSnapshot) {
            throw new BadRequestException('Source or target branch not found');
        }

        const conflicts = this.detectBranchConflicts(
            sourceSnapshot.snapshotData,
            targetSnapshot.snapshotData,
            sourceBranch,
            targetBranch
        );

        if (conflicts.length > 0 && mergeStrategy === 'auto') {
            return { success: false, conflicts };
        }

        let mergedState: Record<string, any>;
        switch (mergeStrategy) {
            case 'ours': mergedState = targetSnapshot.snapshotData; break;
            case 'theirs': mergedState = sourceSnapshot.snapshotData; break;
            case 'manual': return { success: false, conflicts };
            default: mergedState = this.autoResolveMergeConflicts(sourceSnapshot.snapshotData, targetSnapshot.snapshotData, conflicts);
        }

        const mergeVersion = Math.max(sourceSnapshot.version, targetSnapshot.version) + 1;
        const mergeCommitId = await this.createSnapshot(context, roomId, mergedState, mergeVersion, `Merge branch '${sourceBranch}' into '${targetBranch}'`, targetBranch);

        await this.prisma.magicState.updateMany({
            where: { roomId, stateKey: 'main' },
            data: { currentState: mergedState, version: mergeVersion, lastModifiedAt: new Date(), lastModifiedBy: context.userId || 'system' }
        });

        return { success: true, mergedState, conflicts: conflicts.length > 0 ? conflicts : undefined, mergeCommitId };
    }

    /**
     * ADVANCED: Get branch comparison
     */
    async compareBranches(context: TenantContext, roomId: string, branch1: string, branch2: string) {
        const [snapshot1, snapshot2] = await Promise.all([
            this.getLatestSnapshot(roomId, branch1),
            this.getLatestSnapshot(roomId, branch2)
        ]);

        if (!snapshot1 || !snapshot2) {
            throw new BadRequestException('One or both branches not found');
        }

        const differences = this.findStateDifferences(snapshot1.snapshotData, snapshot2.snapshotData);
        const conflicts = this.detectBranchConflicts(snapshot1.snapshotData, snapshot2.snapshotData, branch1, branch2);

        return { differences, conflictCount: conflicts.length, mergeable: conflicts.length === 0 };
    }

    // HELPER METHODS
    private async getLatestSnapshot(roomId: string, branchName: string): Promise<MagicSnapshot | null> {
        const snapshot = await this.prisma.magicSnapshot.findFirst({
            where: { roomId, branchName },
            orderBy: { version: 'desc' }
        });

        if (!snapshot) return null;

        return {
            id: snapshot.id, roomId: snapshot.roomId, stateKey: snapshot.stateKey,
            snapshotData: snapshot.snapshotData as Record<string, any>, version: snapshot.version,
            description: snapshot.description || undefined, branchName: snapshot.branchName,
            createdAt: snapshot.createdAt, createdBy: snapshot.createdBy,
            operations: snapshot.operations ? (snapshot.operations as unknown as MagicOperation[]) : undefined,
            parentSnapshot: snapshot.parentSnapshot || undefined,
        };
    }

    private detectBranchConflicts(sourceState: Record<string, any>, targetState: Record<string, any>, sourceBranch: string, targetBranch: string, path = ''): BranchMergeConflict[] {
        const conflicts: BranchMergeConflict[] = [];
        const allKeys = new Set([...Object.keys(sourceState), ...Object.keys(targetState)]);

        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;
            const sourceValue = sourceState[key], targetValue = targetState[key];

            if (sourceValue !== undefined && targetValue !== undefined) {
                if (typeof sourceValue !== typeof targetValue) {
                    conflicts.push({ path: currentPath, sourceBranch, targetBranch, sourceValue, targetValue, conflictType: 'type_mismatch' });
                } else if (typeof sourceValue === 'object' && sourceValue !== null && targetValue !== null) {
                    conflicts.push(...this.detectBranchConflicts(sourceValue, targetValue, sourceBranch, targetBranch, currentPath));
                } else if (sourceValue !== targetValue) {
                    conflicts.push({ path: currentPath, sourceBranch, targetBranch, sourceValue, targetValue, conflictType: 'concurrent_modification' });
                }
            }
        }
        return conflicts;
    }

    private autoResolveMergeConflicts(sourceState: Record<string, any>, targetState: Record<string, any>, conflicts: BranchMergeConflict[]): Record<string, any> {
        let mergedState = JSON.parse(JSON.stringify(targetState));
        for (const conflict of conflicts) {
            if (conflict.conflictType === 'type_mismatch' && conflict.sourceValue !== null && conflict.targetValue === null) {
                this.setNestedValue(mergedState, conflict.path, conflict.sourceValue);
            }
        }
        return mergedState;
    }

    private findStateDifferences(state1: Record<string, any>, state2: Record<string, any>, path = ''): Array<{ path: string; branch1Value: any; branch2Value: any; changeType: 'added' | 'removed' | 'modified' }> {
        const differences: any[] = [];
        const allKeys = new Set([...Object.keys(state1), ...Object.keys(state2)]);

        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;
            const value1 = state1[key], value2 = state2[key];

            if (value1 === undefined && value2 !== undefined) {
                differences.push({ path: currentPath, branch1Value: undefined, branch2Value: value2, changeType: 'added' });
            } else if (value1 !== undefined && value2 === undefined) {
                differences.push({ path: currentPath, branch1Value: value1, branch2Value: undefined, changeType: 'removed' });
            } else if (value1 !== value2) {
                if (typeof value1 === 'object' && typeof value2 === 'object' && value1 !== null && value2 !== null) {
                    differences.push(...this.findStateDifferences(value1, value2, currentPath));
                } else {
                    differences.push({ path: currentPath, branch1Value: value1, branch2Value: value2, changeType: 'modified' });
                }
            }
        }
        return differences;
    }

    private setNestedValue(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        current[keys[keys.length - 1]] = value;
    }
}
