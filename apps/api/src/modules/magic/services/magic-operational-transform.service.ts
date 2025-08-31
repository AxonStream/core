import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/services/prisma.service';
import { RedisService } from '../../../common/services/redis.service';
import { TenantContext } from '../../../common/services/tenant-aware.service';
import { EventStreamService } from '../../../common/services/event-stream.service';

export enum ConflictResolutionStrategy {
    OPERATIONAL_TRANSFORM = 'operational_transform',
    LAST_WRITE_WINS = 'last_write_wins',
    MANUAL_RESOLUTION = 'manual_resolution',
    MERGE_STRATEGY = 'merge_strategy',
    VERSION_VECTOR = 'version_vector'
}

export interface MagicOperation {
    id: string;
    type: 'magic_set' | 'magic_array_insert' | 'magic_array_delete' | 'magic_array_move' | 'magic_object_merge';
    path: string[];
    value?: any;
    index?: number;
    timestamp: number;
    clientId: string;
    version: number;
    correlationId?: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
    causality: string[];
    metadata: {
        userId: string;
        sessionId: string;
        branchName: string;
        deviceInfo?: any;
        selectionRange?: { start: number; end: number };
    };
}

export interface ConflictResolutionResult {
    success: boolean;
    transformedOperation?: MagicOperation;
    conflicts: Array<{
        type: 'concurrent_modification' | 'version_mismatch' | 'path_conflict' | 'data_inconsistency';
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        conflictingOperations: MagicOperation[];
        suggestedResolution?: string;
    }>;
    appliedOperations: MagicOperation[];
    requiresUserIntervention: boolean;
    resolutionStrategy: ConflictResolutionStrategy;
    performanceMetrics: {
        processingTime: number;
        transformationCount: number;
        conflictCount: number;
        cacheHits: number;
        cacheMisses: number;
    };
}

@Injectable()
export class MagicOperationalTransformService {
    private readonly logger = new Logger(MagicOperationalTransformService.name);

    // Production-grade configuration
    private readonly config = {
        // Conflict resolution thresholds
        conflictThresholds: {
            low: 0.1,      // 10% - configurable via environment
            medium: 0.25,  // 25% - configurable via environment
            high: 0.5,     // 50% - configurable via environment
            critical: 0.75 // 75% - configurable via environment
        },
        
        // Performance tuning
        maxConcurrentOperations: 1000,
        operationTimeoutMs: 30000, // 30 seconds - configurable via environment
        enableOperationCaching: true,
        cacheExpirationSeconds: 300, // 5 minutes - configurable via environment
        
        // Transformation limits
        maxTransformationsPerOperation: 100,
        maxPathDepth: 20,
        maxArraySize: 10000,
        
        // Monitoring
        enablePerformanceMonitoring: true,
        enableConflictTracking: true,
        metricsCollectionInterval: 60000 // 1 minute
    };

    // Redis keys for operation management
    private readonly OPERATION_CACHE_KEY = 'magic:operation_cache';
    private readonly CONFLICT_TRACKING_KEY = 'magic:conflict_tracking';
    private readonly PERFORMANCE_METRICS_KEY = 'magic:performance_metrics';

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
        this.config.conflictThresholds.low = this.configService.get<number>('MAGIC_CONFLICT_THRESHOLD_LOW', 0.1);
        this.config.conflictThresholds.medium = this.configService.get<number>('MAGIC_CONFLICT_THRESHOLD_MEDIUM', 0.25);
        this.config.conflictThresholds.high = this.configService.get<number>('MAGIC_CONFLICT_THRESHOLD_HIGH', 0.5);
        this.config.conflictThresholds.critical = this.configService.get<number>('MAGIC_CONFLICT_THRESHOLD_CRITICAL', 0.75);
        this.config.operationTimeoutMs = this.configService.get<number>('MAGIC_OPERATION_TIMEOUT_MS', 30000);
        this.config.maxConcurrentOperations = this.configService.get<number>('MAGIC_MAX_CONCURRENT_OPERATIONS', 1000);
        this.config.cacheExpirationSeconds = this.configService.get<number>('MAGIC_CACHE_EXPIRATION_SECONDS', 300);
    }

    /**
     * Process Magic operation with advanced conflict resolution
     */
    async processOperation(
        context: TenantContext,
        roomId: string,
        operation: MagicOperation,
        strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.OPERATIONAL_TRANSFORM
    ): Promise<ConflictResolutionResult> {
        const startTime = this.getCurrentTimestamp();
        let cacheHits = 0;
        let cacheMisses = 0;

        try {
            // Validate operation
            this.validateOperation(operation);

            // Check for cached transformation
            const cacheKey = this.generateCacheKey(roomId, operation);
            let cachedResult = await this.getCachedTransformation(cacheKey);
            
            if (cachedResult && this.config.enableOperationCaching) {
                cacheHits++;
                this.logger.log(`Using cached transformation for operation ${operation.id}`);
                return {
                    ...cachedResult,
                    performanceMetrics: {
                        ...cachedResult.performanceMetrics,
                        processingTime: this.getCurrentTimestamp() - startTime,
                        cacheHits,
                        cacheMisses
                    }
                };
            } else {
                cacheMisses++;
            }

            // Get concurrent operations
            const concurrentOperations = await this.getConcurrentOperations(roomId, operation);
            
            // Detect conflicts
            const conflicts = this.detectConflicts(operation, concurrentOperations);
            
            // Apply conflict resolution strategy
            const resolutionResult = await this.applyConflictResolutionStrategy(
                operation,
                concurrentOperations,
                conflicts,
                strategy
            );

            // Transform operations if needed
            let transformedOperation = operation;
            let appliedOperations = [operation];
            let transformationCount = 0;

            if (conflicts.length > 0 && strategy === ConflictResolutionStrategy.OPERATIONAL_TRANSFORM) {
                const transformResult = await this.transformOperations(operation, concurrentOperations);
                transformedOperation = transformResult.transformedOperation;
                appliedOperations = transformResult.appliedOperations;
                transformationCount = transformResult.transformationCount;
            }

            // Store result in cache
            if (this.config.enableOperationCaching) {
                await this.cacheTransformation(cacheKey, {
                    success: resolutionResult.success,
                    transformedOperation,
                    conflicts,
                    appliedOperations,
                    requiresUserIntervention: conflicts.some(c => c.severity === 'critical'),
                    resolutionStrategy: strategy,
                    performanceMetrics: {
                        processingTime: 0, // Will be set by caller
                        transformationCount,
                        conflictCount: conflicts.length,
                        cacheHits: 0,
                        cacheMisses: 0
                    }
                });
            }

            // Track conflicts for monitoring
            if (this.config.enableConflictTracking && conflicts.length > 0) {
                await this.trackConflict(roomId, operation, conflicts);
            }

            // Record performance metrics
            if (this.config.enablePerformanceMonitoring) {
                await this.recordPerformanceMetrics(roomId, {
                    processingTime: this.getCurrentTimestamp() - startTime,
                    transformationCount,
                    conflictCount: conflicts.length,
                    cacheHits,
                    cacheMisses
                });
            }

            return {
                success: resolutionResult.success,
                transformedOperation,
                conflicts,
                appliedOperations,
                requiresUserIntervention: conflicts.some(c => c.severity === 'critical'),
                resolutionStrategy: strategy,
                performanceMetrics: {
                    processingTime: this.getCurrentTimestamp() - startTime,
                    transformationCount,
                    conflictCount: conflicts.length,
                    cacheHits,
                    cacheMisses
                }
            };

        } catch (error) {
            this.logger.error(`Failed to process operation ${operation.id}: ${error.message}`, error.stack);
            
            return {
                success: false,
                conflicts: [{
                    type: 'data_inconsistency',
                    severity: 'critical',
                    description: `Operation processing failed: ${error.message}`,
                    conflictingOperations: [],
                    suggestedResolution: 'Retry operation or contact support'
                }],
                appliedOperations: [],
                requiresUserIntervention: true,
                resolutionStrategy: strategy,
                performanceMetrics: {
                    processingTime: this.getCurrentTimestamp() - startTime,
                    transformationCount: 0,
                    conflictCount: 1,
                    cacheHits,
                    cacheMisses
                }
            };
        }
    }

    /**
     * Validate operation structure and constraints
     */
    private validateOperation(operation: MagicOperation): void {
        if (!operation.id || !operation.type || !operation.path) {
            throw new Error('Invalid operation: missing required fields');
        }

        if (operation.path.length > this.config.maxPathDepth) {
            throw new Error(`Path depth ${operation.path.length} exceeds maximum allowed ${this.config.maxPathDepth}`);
        }

        if (operation.type.includes('array') && typeof operation.index !== 'number') {
            throw new Error(`Array operation requires valid index`);
        }

        if (operation.type === 'magic_array_insert' && operation.index !== undefined) {
            if (operation.index < 0 || operation.index > this.config.maxArraySize) {
                throw new Error(`Array index ${operation.index} out of valid range`);
            }
        }
    }

    /**
     * Get concurrent operations that might conflict
     */
    private async getConcurrentOperations(roomId: string, operation: MagicOperation): Promise<MagicOperation[]> {
        try {
            // Get operations from the last 5 minutes to check for conflicts
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            
            const recentEvents = await this.prisma.magicEvent.findMany({
                where: {
                    roomId,
                    eventType: 'magic_events',
                    createdAt: { gte: fiveMinutesAgo },
                    id: { not: operation.id }
                },
                orderBy: { createdAt: 'desc' },
                take: this.config.maxConcurrentOperations
            });

            return recentEvents
                .map(event => {
                    try {
                        const payload = event.payload as any;
                        return payload.operation as MagicOperation;
                    } catch {
                        return null;
                    }
                })
                .filter(op => op !== null) as MagicOperation[];

        } catch (error) {
            this.logger.error(`Failed to get concurrent operations: ${error.message}`, error.stack);
            return [];
        }
    }

    /**
     * Detect conflicts between operations
     */
    private detectConflicts(
        operation: MagicOperation,
        concurrentOperations: MagicOperation[]
    ): Array<{
        type: 'concurrent_modification' | 'version_mismatch' | 'path_conflict' | 'data_inconsistency';
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        conflictingOperations: MagicOperation[];
        suggestedResolution?: string;
    }> {
        const conflicts = [];

        for (const concurrentOp of concurrentOperations) {
            // Check for path conflicts
            if (this.hasPathConflict(operation, concurrentOp)) {
                const severity = this.determineConflictSeverity(operation, concurrentOp);
                conflicts.push({
                    type: 'path_conflict',
                    severity,
                    description: `Path conflict between operations ${operation.id} and ${concurrentOp.id}`,
                    conflictingOperations: [concurrentOp],
                    suggestedResolution: this.suggestPathConflictResolution(operation, concurrentOp)
                });
            }

            // Check for version conflicts
            if (operation.version <= concurrentOp.version) {
                conflicts.push({
                    type: 'version_mismatch',
                    severity: 'high',
                    description: `Version conflict: operation ${operation.id} has version ${operation.version}, but concurrent operation ${concurrentOp.id} has version ${concurrentOp.version}`,
                    conflictingOperations: [concurrentOp],
                    suggestedResolution: 'Increment operation version and retry'
                });
            }

            // Check for concurrent modifications to same data
            if (this.hasConcurrentModification(operation, concurrentOp)) {
                const severity = this.determineConflictSeverity(operation, concurrentOp);
                conflicts.push({
                    type: 'concurrent_modification',
                    severity,
                    description: `Concurrent modification detected between operations ${operation.id} and ${concurrentOp.id}`,
                    conflictingOperations: [concurrentOp],
                    suggestedResolution: this.suggestConcurrentModificationResolution(operation, concurrentOp)
                });
            }
        }

        return conflicts;
    }

    /**
     * Check if two operations have conflicting paths
     */
    private hasPathConflict(op1: MagicOperation, op2: MagicOperation): boolean {
        // Check if operations modify the same path or overlapping paths
        if (op1.path.length !== op2.path.length) {
            return false;
        }

        for (let i = 0; i < op1.path.length; i++) {
            if (op1.path[i] !== op2.path[i]) {
                return false;
            }
        }

        // Same path, check if operations are incompatible
        if (op1.type === 'magic_set' && op2.type === 'magic_set') {
            return true; // Both setting the same path
        }

        if (op1.type.includes('array') && op2.type.includes('array')) {
            // Check array index conflicts
            if (op1.index !== undefined && op2.index !== undefined) {
                if (op1.type === 'magic_array_delete' && op2.type === 'magic_array_delete') {
                    return op1.index === op2.index;
                }
                if (op1.type === 'magic_array_insert' || op2.type === 'magic_array_insert') {
                    return Math.abs((op1.index || 0) - (op2.index || 0)) <= 1;
                }
            }
        }

        return false;
    }

    /**
     * Check for concurrent modifications
     */
    private hasConcurrentModification(op1: MagicOperation, op2: MagicOperation): boolean {
        // Operations are concurrent if they were created within a short time window
        const timeDiff = Math.abs(op1.timestamp - op2.timestamp);
        const concurrentThreshold = 5000; // 5 seconds

        return timeDiff < concurrentThreshold && this.hasPathConflict(op1, op2);
    }

    /**
     * Determine conflict severity based on operation types and data
     */
    private determineConflictSeverity(op1: MagicOperation, op2: MagicOperation): 'low' | 'medium' | 'high' | 'critical' {
        // Critical: conflicting deletes or incompatible data types
        if (op1.type === 'magic_array_delete' && op2.type === 'magic_array_delete') {
            return 'critical';
        }

        // High: conflicting inserts or major data changes
        if (op1.type === 'magic_array_insert' && op2.type === 'magic_array_insert') {
            return 'high';
        }

        // Medium: conflicting updates to same path
        if (op1.type === 'magic_set' && op2.type === 'magic_set') {
            return 'medium';
        }

        // Low: minor conflicts that can be auto-resolved
        return 'low';
    }

    /**
     * Apply conflict resolution strategy
     */
    private async applyConflictResolutionStrategy(
        operation: MagicOperation,
        concurrentOperations: MagicOperation[],
        conflicts: any[],
        strategy: ConflictResolutionStrategy
    ): Promise<{ success: boolean }> {
        try {
            switch (strategy) {
                case ConflictResolutionStrategy.OPERATIONAL_TRANSFORM:
                    // OT will handle conflicts automatically
                    return { success: true };

                case ConflictResolutionStrategy.LAST_WRITE_WINS:
                    // Keep the operation with the latest timestamp
                    const latestOp = [operation, ...concurrentOperations]
                        .sort((a, b) => b.timestamp - a.timestamp)[0];
                    
                    if (latestOp.id !== operation.id) {
                        this.logger.warn(`Operation ${operation.id} superseded by ${latestOp.id} (last-write-wins)`);
                        return { success: false };
                    }
                    return { success: true };

                case ConflictResolutionStrategy.MANUAL_RESOLUTION:
                    // Require manual intervention for all conflicts
                    if (conflicts.length > 0) {
                        return { success: false };
                    }
                    return { success: true };

                case ConflictResolutionStrategy.MERGE_STRATEGY:
                    // Attempt to merge conflicting operations
                    return await this.attemptMergeStrategy(operation, concurrentOperations, conflicts);

                case ConflictResolutionStrategy.VERSION_VECTOR:
                    // Use vector clocks for conflict detection
                    return await this.applyVersionVectorStrategy(operation, concurrentOperations);

                default:
                    this.logger.warn(`Unknown conflict resolution strategy: ${strategy}`);
                    return { success: false };
            }
        } catch (error) {
            this.logger.error(`Conflict resolution strategy failed: ${error.message}`, error.stack);
            return { success: false };
        }
    }

    /**
     * Attempt to merge conflicting operations
     */
    private async attemptMergeStrategy(
        operation: MagicOperation,
        concurrentOperations: MagicOperation[],
        conflicts: any[]
    ): Promise<{ success: boolean }> {
        try {
            // For now, only allow merging of non-critical conflicts
            const criticalConflicts = conflicts.filter(c => c.severity === 'critical');
            if (criticalConflicts.length > 0) {
                this.logger.warn(`Cannot merge operations with critical conflicts`);
                return { success: false };
            }

            // Simple merge strategy: combine values where possible
            for (const conflict of conflicts) {
                if (conflict.type === 'path_conflict' && operation.type === 'magic_object_merge') {
                    // Merge object properties
                    const conflictingOp = conflict.conflictingOperations[0];
                    if (conflictingOp.type === 'magic_object_merge' && conflictingOp.value) {
                        operation.value = { ...operation.value, ...conflictingOp.value };
                    }
                }
            }

            return { success: true };
        } catch (error) {
            this.logger.error(`Merge strategy failed: ${error.message}`, error.stack);
            return { success: false };
        }
    }

    /**
     * Apply version vector strategy
     */
    private async applyVersionVectorStrategy(
        operation: MagicOperation,
        concurrentOperations: MagicOperation[]
    ): Promise<{ success: boolean }> {
        try {
            // Check if operation has higher version than all concurrent operations
            const maxConcurrentVersion = Math.max(...concurrentOperations.map(op => op.version), 0);
            
            if (operation.version <= maxConcurrentVersion) {
                this.logger.warn(`Operation ${operation.id} version ${operation.version} not higher than concurrent max ${maxConcurrentVersion}`);
                return { success: false };
            }

            return { success: true };
        } catch (error) {
            this.logger.error(`Version vector strategy failed: ${error.message}`, error.stack);
            return { success: false };
        }
    }

    /**
     * Transform operations using operational transformation
     */
    private async transformOperations(
        operation: MagicOperation,
        concurrentOperations: MagicOperation[]
    ): Promise<{
        transformedOperation: MagicOperation;
        appliedOperations: MagicOperation[];
        transformationCount: number;
    }> {
        let transformedOperation = { ...operation };
        let appliedOperations = [operation];
        let transformationCount = 0;

        try {
            // Sort operations by timestamp for consistent transformation
            const sortedOperations = concurrentOperations
                .filter(op => op.timestamp < operation.timestamp)
                .sort((a, b) => a.timestamp - b.timestamp);

            for (const concurrentOp of sortedOperations) {
                if (this.hasPathConflict(transformedOperation, concurrentOp)) {
                    transformedOperation = this.transformOperation(transformedOperation, concurrentOp);
                    transformationCount++;
                }
                appliedOperations.push(concurrentOp);
            }

            return {
                transformedOperation,
                appliedOperations,
                transformationCount
            };
        } catch (error) {
            this.logger.error(`Operation transformation failed: ${error.message}`, error.stack);
            // Return original operation if transformation fails
            return {
                transformedOperation: operation,
                appliedOperations: [operation],
                transformationCount: 0
            };
        }
    }

    /**
     * Transform a single operation against a concurrent operation
     */
    private transformOperation(
        operation: MagicOperation,
        concurrentOp: MagicOperation
    ): MagicOperation {
        const transformed = { ...operation };

        try {
            switch (operation.type) {
                case 'magic_set':
                    if (concurrentOp.type === 'magic_set') {
                        // Both setting same path - use timestamp-based resolution
                        if (operation.timestamp > concurrentOp.timestamp) {
                            // Keep this operation
                        } else {
                            // This operation is superseded
                            transformed.value = concurrentOp.value;
                        }
                    }
                    break;

                case 'magic_array_insert':
                    if (concurrentOp.type === 'magic_array_insert') {
                        // Adjust index based on concurrent insertions
                        if (operation.index !== undefined && concurrentOp.index !== undefined) {
                            if (concurrentOp.index <= operation.index) {
                                transformed.index = (operation.index || 0) + 1;
                            }
                        }
                    } else if (concurrentOp.type === 'magic_array_delete') {
                        // Adjust index based on concurrent deletions
                        if (operation.index !== undefined && concurrentOp.index !== undefined) {
                            if (concurrentOp.index < operation.index) {
                                transformed.index = (operation.index || 0) - 1;
                            } else if (concurrentOp.index === operation.index) {
                                // Conflict - this insertion is invalid
                                throw new Error('Insertion index conflicts with deletion');
                            }
                        }
                    }
                    break;

                case 'magic_array_delete':
                    if (concurrentOp.type === 'magic_array_insert') {
                        // Adjust index based on concurrent insertions
                        if (operation.index !== undefined && concurrentOp.index !== undefined) {
                            if (concurrentOp.index <= operation.index) {
                                transformed.index = (operation.index || 0) + 1;
                            }
                        }
                    }
                    break;

                case 'magic_object_merge':
                    if (concurrentOp.type === 'magic_object_merge') {
                        // Merge object properties
                        if (operation.value && concurrentOp.value) {
                            transformed.value = { ...operation.value, ...concurrentOp.value };
                        }
                    }
                    break;
            }
        } catch (error) {
            this.logger.error(`Operation transformation failed: ${error.message}`, error.stack);
            // Return original operation if transformation fails
            return operation;
        }

        return transformed;
    }

    // ==================== CACHING METHODS ====================

    private generateCacheKey(roomId: string, operation: MagicOperation): string {
        const operationHash = this.hashOperation(operation);
        return `${this.OPERATION_CACHE_KEY}:${roomId}:${operationHash}`;
    }

    private hashOperation(operation: MagicOperation): string {
        const { id, type, path, value, index, timestamp, version } = operation;
        const hashInput = `${id}_${type}_${path.join('.')}_${JSON.stringify(value)}_${index}_${timestamp}_${version}`;
        return require('crypto').createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
    }

    private async getCachedTransformation(cacheKey: string): Promise<ConflictResolutionResult | null> {
        try {
            const cached = await this.redis.client.get(cacheKey);
            if (cached) {
                return JSON.parse(cached as string);
            }
            return null;
        } catch (error) {
            this.logger.error(`Failed to get cached transformation: ${error.message}`, error.stack);
            return null;
        }
    }

    private async cacheTransformation(cacheKey: string, result: ConflictResolutionResult): Promise<void> {
        try {
            await this.redis.client.setEx(
                cacheKey,
                this.config.cacheExpirationSeconds,
                JSON.stringify(result)
            );
        } catch (error) {
            this.logger.error(`Failed to cache transformation: ${error.message}`, error.stack);
        }
    }

    // ==================== MONITORING METHODS ====================

    private async trackConflict(
        roomId: string,
        operation: MagicOperation,
        conflicts: any[]
    ): Promise<void> {
        try {
            const conflictData = {
                roomId,
                operationId: operation.id,
                timestamp: this.getCurrentTimestamp(),
                conflictCount: conflicts.length,
                conflictTypes: conflicts.map(c => c.type),
                severityLevels: conflicts.map(c => c.severity)
            };

            await this.redis.client.lPush(
                `${this.CONFLICT_TRACKING_KEY}:${roomId}`,
                JSON.stringify(conflictData)
            );

            // Keep only recent conflicts
            await this.redis.client.lTrim(`${this.CONFLICT_TRACKING_KEY}:${roomId}`, 0, 999);

        } catch (error) {
            this.logger.error(`Failed to track conflict: ${error.message}`, error.stack);
        }
    }

    private async recordPerformanceMetrics(
        roomId: string,
        metrics: {
            processingTime: number;
            transformationCount: number;
            conflictCount: number;
            cacheHits: number;
            cacheMisses: number;
        }
    ): Promise<void> {
        try {
            const metricsData = {
                roomId,
                timestamp: this.getCurrentTimestamp(),
                ...metrics
            };

            await this.redis.client.lPush(
                `${this.PERFORMANCE_METRICS_KEY}:${roomId}`,
                JSON.stringify(metricsData)
            );

            // Keep only recent metrics
            await this.redis.client.lTrim(`${this.PERFORMANCE_METRICS_KEY}:${roomId}`, 0, 999);

        } catch (error) {
            this.logger.error(`Failed to record performance metrics: ${error.message}`, error.stack);
        }
    }

    // ==================== UTILITY METHODS ====================

    private getCurrentTimestamp(): number {
        return Date.now();
    }

    private suggestPathConflictResolution(
        op1: MagicOperation,
        op2: MagicOperation
    ): string {
        if (op1.type === 'magic_set' && op2.type === 'magic_set') {
            return 'Use operational transformation to merge changes';
        }
        if (op1.type.includes('array') && op2.type.includes('array')) {
            return 'Adjust array indices based on concurrent operations';
        }
        return 'Review and manually resolve conflicting operations';
    }

    private suggestConcurrentModificationResolution(
        op1: MagicOperation,
        op2: MagicOperation
    ): string {
        if (op1.type === 'magic_object_merge' && op2.type === 'magic_object_merge') {
            return 'Merge object properties automatically';
        }
        return 'Use operational transformation to resolve conflicts';
    }
}
