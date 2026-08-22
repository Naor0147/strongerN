/**
 * historyHydrator.ts
 *
 * Scale-invariant chunked history hydration engine.
 * Streams workout sessions from SQLite in idle slices using cursor pagination.
 */

import { InteractionManager } from 'react-native';
import { loadSessionsCursorChunk, loadSessionHeadersChunk, countSessions } from './repository';
import { WorkoutSessionV2 } from '../contracts/types';
import { mergeSessionChunks } from './sessionMerge';

export type HydrationPhase = 'idle' | 'hydrating' | 'complete' | 'failed';

export interface HydrationProgress {
  sessions: WorkoutSessionV2[];
  isComplete: boolean;
  phase: HydrationPhase;
  totalCount: number;
  loadedCount: number;
  error?: string | null;
}

export type HydrationListener = (progress: HydrationProgress) => void;

export class HistoryHydrator {
  private isRunning = false;
  private isCancelled = false;
  private accumulatedSessions: WorkoutSessionV2[] = [];
  private totalCount = 0;
  private listeners: Set<HydrationListener> = new Set();
  private chunkSize = 40;
  private isDeletedCheck: ((id: string) => boolean) | null = null;
  private phase: HydrationPhase = 'idle';
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelays = [1000, 4000, 10000];
  private headerOnly = false;
  private paused = false;

  constructor(options?: { chunkSize?: number; headerOnly?: boolean }) {
    if (options?.chunkSize) this.chunkSize = options.chunkSize;
    if (options?.headerOnly) this.headerOnly = options.headerOnly;
  }

  public setHeaderOnly(v: boolean): void { this.headerOnly = v; }
  public pause(): void { this.paused = true; }
  public resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.isRunning && this.phase === 'hydrating') this.scheduleNextChunk();
  }

  public subscribe(listener: HydrationListener): () => void {
    this.listeners.add(listener);
    // Emit current state if already loaded
    listener({
      sessions: this.accumulatedSessions,
      isComplete: this.phase === 'complete',
      phase: this.phase,
      totalCount: this.totalCount,
      loadedCount: this.accumulatedSessions.length,
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async start(
    initialSessions?: WorkoutSessionV2[],
    isDeleted?: (id: string) => boolean,
    options?: { headerOnly?: boolean }
  ): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isCancelled = false;
    this.retryCount = 0;
    this.isDeletedCheck = isDeleted || null;
    if (options?.headerOnly !== undefined) this.headerOnly = options.headerOnly;

    if (initialSessions && initialSessions.length > 0) {
      this.accumulatedSessions = isDeleted
        ? initialSessions.filter(s => !isDeleted(s.id))
        : [...initialSessions];
    } else {
      this.accumulatedSessions = [];
    }

    try {
      this.totalCount = await countSessions().catch(() => 0);
      this.phase = 'hydrating';

      // If initial sessions already cover total count or SQLite has 0
      if (this.totalCount <= this.accumulatedSessions.length || this.totalCount === 0) {
        this.phase = 'complete';
        this.notify(true);
        this.isRunning = false;
        return;
      }

      this.notify(false);
      this.scheduleNextChunk();
    } catch (err: any) {
      console.warn('[HistoryHydrator] Initialization warning:', err);
      this.phase = 'failed';
      this.notify(false, err?.message);
      this.isRunning = false;
    }
  }

  private scheduleNextChunk(): void {
    if (this.isCancelled) {
      this.isRunning = false;
      return;
    }
    if (this.paused) {
      setTimeout(() => { if (!this.isCancelled && !this.paused) this.scheduleNextChunk(); }, 250);
      return;
    }

    // Use direct micro-delay instead of InteractionManager which can stall on
    // continuous JS animations (Skeleton shimmer) or navigation transitions.
    // Priority: if requestIdleCallback exists and we are not paused, use it
    // with short timeout; otherwise plain setTimeout(16) guarantees progress.
    const schedule = (cb: () => void) => {
      if (typeof (global as any).requestIdleCallback === 'function') {
        try {
          (global as any).requestIdleCallback(cb, { timeout: 50 });
          return;
        } catch {}
      }
      setTimeout(cb, 16);
    };

    schedule(async () => {
      if (this.isCancelled || this.paused) {
        if (this.paused) return;
        this.isRunning = false;
        return;
      }
      await this.loadChunk();
    });
  }

  public async loadMoreOnDemand(): Promise<{ added: number; isComplete: boolean }> {
    if (this.isCancelled || this.paused) return { added: 0, isComplete: this.phase === 'complete' };
    const before = this.accumulatedSessions.length;
    await this.loadChunk();
    return { added: this.accumulatedSessions.length - before, isComplete: this.phase === 'complete' };
  }

  private async loadChunk(): Promise<void> {
    if (this.isCancelled) {
      this.isRunning = false;
      return;
    }

    try {
      let lastStartedAtMs: number | undefined = undefined;
      let lastId: string | undefined = undefined;

      if (this.accumulatedSessions.length > 0) {
        const lastSession = this.accumulatedSessions[this.accumulatedSessions.length - 1];
        lastStartedAtMs = lastSession.startedAtMs;
        lastId = lastSession.id;
      }

      const startTime = Date.now();
      let chunk: WorkoutSessionV2[] = [];
      let hasMore = false;
      if (this.headerOnly) {
        const res = await loadSessionHeadersChunk(lastStartedAtMs, lastId, this.chunkSize);
        chunk = res.headers as any;
        hasMore = res.hasMore;
      } else {
        const res = await loadSessionsCursorChunk(lastStartedAtMs, lastId, this.chunkSize);
        chunk = res.sessions;
        hasMore = res.hasMore;
      }
      const durationMs = Date.now() - startTime;

      // Adaptive throttle: if query took > 8ms, decrease chunk size
      if (durationMs > 8 && this.chunkSize > 15) {
        this.chunkSize = Math.max(15, Math.floor(this.chunkSize * 0.75));
      }

      if (this.isCancelled) {
        this.isRunning = false;
        return;
      }

      // Filter out deleted sessions
      const filteredChunk = this.isDeletedCheck
        ? chunk.filter(s => !this.isDeletedCheck!(s.id))
        : chunk;

      // Append-only fast path when ids don't collide (common), else dedup merge
      if (filteredChunk.length > 0) {
        const existingIds = new Set(this.accumulatedSessions.map(s => s.id));
        const hasOverlap = filteredChunk.some(s => existingIds.has(s.id));
        if (!hasOverlap) {
          this.accumulatedSessions = [...this.accumulatedSessions, ...filteredChunk];
        } else {
          this.accumulatedSessions = mergeSessionChunks(this.accumulatedSessions, filteredChunk);
        }
      }
      this.retryCount = 0; // Reset retry count on successful load

      const isComplete = !hasMore || filteredChunk.length === 0 || this.accumulatedSessions.length >= this.totalCount;

      if (isComplete) {
        this.phase = 'complete';
        this.notify(true);
        this.isRunning = false;
      } else {
        this.phase = 'hydrating';
        this.notify(false);
        this.scheduleNextChunk();
      }
    } catch (err: any) {
      console.warn('[HistoryHydrator] Error loading chunk (attempt ' + (this.retryCount + 1) + '):', err);
      if (this.retryCount < this.maxRetries && !this.isCancelled) {
        const delay = this.retryDelays[this.retryCount] || 5000;
        this.retryCount++;
        setTimeout(() => {
          if (!this.isCancelled) {
            this.scheduleNextChunk();
          }
        }, delay);
      } else {
        this.phase = 'failed';
        this.notify(false, err?.message);
        this.isRunning = false;
      }
    }
  }

  private notify(isComplete: boolean, error?: string | null): void {
    const payload: HydrationProgress = {
      sessions: this.accumulatedSessions,
      isComplete,
      phase: this.phase,
      totalCount: Math.max(this.totalCount, this.accumulatedSessions.length),
      loadedCount: this.accumulatedSessions.length,
      error: error || null,
    };

    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error('[HistoryHydrator] Listener error:', err);
      }
    }
  }

  public cancel(): void {
    this.isCancelled = true;
    this.isRunning = false;
    this.phase = 'idle';
  }

  public getSessions(): WorkoutSessionV2[] {
    return this.accumulatedSessions;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getPhase(): HydrationPhase {
    return this.phase;
  }
}

export const historyHydrator = new HistoryHydrator();
