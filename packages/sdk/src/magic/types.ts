/**
 * 🎯 MAGIC COLLABORATION TYPES
 * 
 * Type definitions for the Magic collaboration system
 * Matches the existing API structure we already built
 */

export type ConflictResolutionStrategy =
    | 'operational_transform'
    | 'last_write_wins'
    | 'first_write_wins'
    | 'merge_strategy'
    | 'user_choice'
    | 'ai_resolution';

export type MagicOperationType =
    | 'magic_set'
    | 'magic_array_insert'
    | 'magic_array_delete'
    | 'magic_array_move'
    | 'magic_object_merge';

export interface MagicOperation {
    id: string;
    type: MagicOperationType;
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

export interface MagicState {
    id: string;
    roomId: string;
    stateKey: string;
    currentState: Record<string, any>;
    version: number;
    lastModifiedBy: string;
    lastModifiedAt: Date;
}

export interface MagicRoom {
    id: string;
    name: string;
    state: Record<string, any>;
    version: number;
    config: {
        timeTravel?: boolean;
        presence?: boolean;
        conflictResolution?: ConflictResolutionStrategy;
        [key: string]: any;
    };
    createdAt: Date;
    updatedAt: Date;
}

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

export interface MagicPresenceInfo {
    id: string;
    roomId: string;
    userId: string;
    sessionId: string;
    userName: string;
    userAvatar?: string;
    isActive: boolean;
    lastSeen: Date;
    cursorPosition?: {
        x: number;
        y: number;
        elementId?: string;
    };
    selection?: {
        start: number;
        end: number;
        elementId?: string;
    };
    viewportInfo?: {
        scrollX: number;
        scrollY: number;
        zoom: number;
    };
    deviceInfo?: {
        userAgent?: string;
        platform?: string;
        screenWidth?: number;
        screenHeight?: number;
    };
    joinedAt: Date;
}

export interface PresenceUpdateData {
    cursorPosition?: {
        x: number;
        y: number;
        elementId?: string;
    };
    selection?: {
        start: number;
        end: number;
        elementId?: string;
    };
    viewportInfo?: {
        scrollX: number;
        scrollY: number;
        zoom: number;
    };
    isActive?: boolean;
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
