/**
 * 🕰️ MAGIC TIME TRAVEL SDK (Hardened)
 * - No fabricated fields: return server truth
 * - Typed client calls
 * - Input validation, idempotency support, safe defaults
 */

import type { AxonPulsClient } from '../core/client';

export interface MagicSnapshot {
    id: string;
    roomId: string;
    branchName: string;
    state: Record<string, any>;
    version: number;
    description?: string;
    createdAt: string; // ISO string from server
    metadata?: Record<string, any>;
}

export interface MagicBranch {
    id: string;
    name: string;
    roomId: string;
    fromSnapshotId: string;
    description?: string;
    createdAt: string; // ISO string from server
    metadata?: {
        conflictCount?: number;
        lastActivity?: string;
    };
}

export interface TimeTravelResult {
    success: boolean;
    snapshotId?: string;
    branchName?: string;
    conflictsResolved?: number;
    operationsApplied?: number;
    timestamp: string; // ISO string from server
    metadata?: Record<string, any>;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
    idempotencyKey?: string;     // for POST/PATCH/PUT/DELETE
    query?: Record<string, string | number | boolean | undefined>;
    headers?: Record<string, string>;
}

export class MagicTimeTravel {
    private client: AxonPulsClient;

    constructor(client: AxonPulsClient) {
        this.client = client;
    }

    /**
     * Create a snapshot of current room state.
     * Do not fabricate snapshot shape; return server payload.
     */
    async createSnapshot(
        roomId: string,
        opts: {
            description?: string;
            branchName?: string;
            idempotencyKey?: string;
        } = {}
    ): Promise<MagicSnapshot> {
        this.assertId('roomId', roomId);
        const body: Record<string, unknown> = {};
        if (opts.description) body.description = opts.description;
        if (opts.branchName) body.branchName = opts.branchName;

        return this.request<MagicSnapshot>(
            'POST',
            `/magic/rooms/${encodeURIComponent(roomId)}/snapshots`,
            body,
            {
                idempotencyKey: opts.idempotencyKey,
            }
        );
    }

    /**
     * Revert room state to a specific snapshot.
     */
    async revertToSnapshot(
        roomId: string,
        snapshotId: string,
        opts: {
            branchName?: string;
            strategy?: 'safe' | 'force';
            ifMatchEtag?: string;
            idempotencyKey?: string;
        } = {}
    ): Promise<TimeTravelResult> {
        this.assertId('roomId', roomId);
        this.assertId('snapshotId', snapshotId);

        const body: Record<string, unknown> = {};
        if (opts.branchName) body.branchName = opts.branchName;
        if (opts.strategy) body.strategy = opts.strategy;

        const headers: Record<string, string> = {};
        if (opts.ifMatchEtag) headers['If-Match'] = opts.ifMatchEtag;

        return this.request<TimeTravelResult>(
            'POST',
            `/magic/rooms/${encodeURIComponent(roomId)}/revert/${encodeURIComponent(snapshotId)}`,
            body,
            {
                idempotencyKey: opts.idempotencyKey,
                headers,
            }
        );
    }

    /**
     * Get timeline (server-filtered if possible).
     */
    async getTimeline(
        roomId: string,
        opts: {
            branchName?: string;
            limit?: number;
            cursor?: string;
        } = {}
    ): Promise<{
        snapshots: MagicSnapshot[];
        branches: MagicBranch[];
        timeline: Array<{
            timestamp: string;
            event: 'snapshot' | 'branch' | 'merge' | 'revert';
            description: string;
            snapshotId?: string;
            branchName?: string;
        }>;
        nextCursor?: string;
    }> {
        this.assertId('roomId', roomId);

        return this.request(
            'GET',
            `/magic/rooms/${encodeURIComponent(roomId)}/timeline`,
            undefined,
            {
                query: {
                    branch: opts.branchName,
                    limit: opts.limit,
                    cursor: opts.cursor,
                },
            }
        );
    }

    /**
     * Create a new branch from a snapshot.
     */
    async createBranch(
        roomId: string,
        fromSnapshotId: string,
        branchName: string,
        opts: {
            description?: string;
            idempotencyKey?: string;
        } = {}
    ): Promise<MagicBranch> {
        this.assertId('roomId', roomId);
        this.assertId('fromSnapshotId', fromSnapshotId);
        this.assertBranch(branchName);

        const body: Record<string, unknown> = {
            fromSnapshotId,
            branchName,
        };
        if (opts.description) body.description = opts.description;

        return this.request<MagicBranch>(
            'POST',
            `/magic/rooms/${encodeURIComponent(roomId)}/branches`,
            body,
            { idempotencyKey: opts.idempotencyKey }
        );
    }

    /**
     * List branches.
     */
    async listBranches(
        roomId: string,
        opts: { limit?: number; cursor?: string } = {}
    ): Promise<MagicBranch[]> {
        this.assertId('roomId', roomId);
        const res = await this.request<{ branches: MagicBranch[]; nextCursor?: string }>(
            'GET',
            `/magic/rooms/${encodeURIComponent(roomId)}/branches`,
            undefined,
            { query: { limit: opts.limit, cursor: opts.cursor } }
        );
        return Array.isArray(res?.branches) ? res.branches : [];
    }

    /**
     * Merge two branches.
     */
    async mergeBranches(
        roomId: string,
        sourceBranch: string,
        targetBranch = 'main',
        opts: {
            mergeStrategy?: 'auto' | 'manual' | 'ours' | 'theirs';
            idempotencyKey?: string;
        } = {}
    ): Promise<TimeTravelResult> {
        this.assertId('roomId', roomId);
        this.assertBranch(sourceBranch);
        this.assertBranch(targetBranch);

        return this.request<TimeTravelResult>(
            'POST',
            `/magic/rooms/${encodeURIComponent(roomId)}/merge`,
            {
                sourceBranch,
                targetBranch,
                mergeStrategy: opts.mergeStrategy ?? 'auto',
            },
            { idempotencyKey: opts.idempotencyKey }
        );
    }

    /**
     * Compare two branches.
     */
    async compareBranches(
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
        this.assertId('roomId', roomId);
        this.assertBranch(branch1);
        this.assertBranch(branch2);

        return this.request(
            'GET',
            `/magic/rooms/${encodeURIComponent(roomId)}/compare/${encodeURIComponent(branch1)}/${encodeURIComponent(branch2)}`
        );
    }

    /**
     * Branch snapshot history (server-filtered if supported).
     */
    async getSnapshotHistory(
        roomId: string,
        branchName = 'main',
        limit = 100
    ): Promise<MagicSnapshot[]> {
        this.assertId('roomId', roomId);
        this.assertBranch(branchName);

        const timeline = await this.getTimeline(roomId, { branchName, limit });
        if (Array.isArray(timeline.snapshots)) {
            const filtered = timeline.snapshots.filter(s => s.branchName === branchName);
            return filtered.sort((a, b) => {
                const at = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : +new Date(a.createdAt as any);
                const bt = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : +new Date(b.createdAt as any);
                return bt - at;
            }).slice(0, limit);
        }
        return [];
    }

    /**
     * Latest snapshot for a branch.
     */
    async getLatestSnapshot(
        roomId: string,
        branchName = 'main'
    ): Promise<MagicSnapshot | null> {
        const list = await this.getSnapshotHistory(roomId, branchName, 1);
        return list.length ? list[0] : null;
    }

    /**
     * Branch has conflicts?
     */
    async hasConflicts(roomId: string, branchName: string): Promise<boolean> {
        this.assertId('roomId', roomId);
        this.assertBranch(branchName);

        const branches = await this.listBranches(roomId);
        const b = branches.find(x => x.name === branchName);
        const count = b?.metadata?.conflictCount ?? 0;
        return count > 0;
    }

    /**
     * Conflict stats (derived if no dedicated endpoint).
     */
    async getConflictStats(
        roomId: string
    ): Promise<{
        totalConflicts: number;
        conflictsByBranch: Record<string, number>;
        conflictsByType: Record<string, number>;
        lastConflictAt?: string;
    }> {
        this.assertId('roomId', roomId);

        const branches = await this.listBranches(roomId);
        const conflictsByBranch: Record<string, number> = {};
        let total = 0;

        for (const b of branches) {
            const n = b?.metadata?.conflictCount ?? 0;
            conflictsByBranch[b.name] = n;
            total += n;
        }

        return {
            totalConflicts: total,
            conflictsByBranch,
            conflictsByType: {},
            lastConflictAt: undefined,
        };
    }

    private assertId(label: string, v: string) {
        if (!v || typeof v !== 'string') {
            throw new MagicTimeTravelError(`Invalid ${label}`, { label, value: v });
        }
    }

    private assertBranch(name: string) {
        if (!name || typeof name !== 'string' || !/^[a-zA-Z0-9._\-\/]+$/.test(name)) {
            throw new MagicTimeTravelError('Invalid branchName', { branchName: name });
        }
    }

    private buildQuery(query?: RequestOptions['query']): string {
        if (!query) return '';
        const params = Object.entries(query)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            .join('&');
        return params ? `?${params}` : '';
    }

    private async request<T>(
        method: HttpMethod,
        path: string,
        body?: unknown,
        opts: RequestOptions = {}
    ): Promise<T> {
        const headers: Record<string, string> = { ...(opts.headers || {}) };
        if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

        const q = this.buildQuery(opts.query);
        const url = `${path}${q}`;

        const anyClient = this.client as any;
        if (typeof anyClient.request === 'function') {
            try {
                if (anyClient.request.length >= 4) {
                    return await anyClient.request(method, url, body, { headers }) as T;
                }
                return await anyClient.request(method, url, body) as T;
            } catch (err) {
                throw wrapError(err, { method, url });
            }
        }
        throw new MagicTimeTravelError('AxonPulsClient.request not available', { method, url });
    }
}

export class MagicTimeTravelError extends Error {
    context?: Record<string, unknown>;
    constructor(message: string, context?: Record<string, unknown>) {
        super(message);
        this.name = 'MagicTimeTravelError';
        this.context = context;
    }
}

function wrapError(err: unknown, ctx: Record<string, unknown>) {
    if (err instanceof MagicTimeTravelError) return err;
    const e = new MagicTimeTravelError(
        err instanceof Error ? err.message : 'Request failed',
        { cause: err, ...ctx }
    );
    return e;
}
