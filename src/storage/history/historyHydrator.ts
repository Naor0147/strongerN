/**
 * historyHydrator.ts
 *
 * Scale-invariant chunked history hydration engine.
 * Streams workout sessions from SQLite in idle slices to guarantee 120 FPS UI responsiveness.
 */

import { InteractionManager } from 'react-native';
import { listSessions, countSessions } from './repository';
import { WorkoutSessionV2 } from '../contracts/types';
import { mergeSessionChunks } from './sessionMerge';

export interface HydrationProgress {
  sessions: WorkoutSessionV2[];
  isComplete: boolean;
  totalCount: number;
  loadedCount: number;
}

export type HydrationListener = (progress: HydrationProgress) => void;

export class HistoryHydrator {
  private isRunning = false;
  private isCancelled = false;
  private currentOffset = 0;
  private accumulatedSessions: WorkoutSessionV2[] = [];
  private totalCount = 0;
  private listeners: Set<HydrationListener> = new Set();
  private chunkSize = 100;
  private initialChunkSize = 50;

  constructor(options?: { initialChunkSize?: number; chunkSize?: number }) {
    if (options?.initialChunkSize) this.initialChunkSize = options.initialChunkSize;
    if (options?.chunkSize) this.chunkSize = options.chunkSize;
  }

  public subscribe(listener: HydrationListener): () => void {
    this.listeners.add(listener);
    // Emit current state if already loaded
    if (this.accumulatedSessions.length > 0) {
      listener({
        sessions: this.accumulatedSessions,
        isComplete: !this.isRunning && this.currentOffset >= this.totalCount,
        totalCount: this.totalCount,
        loadedCount: this.accumulatedSessions.length,
      });
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async start(initialSessions?: WorkoutSessionV2[]): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isCancelled = false;

    if (initialSessions && initialSessions.length > 0) {
      this.accumulatedSessions = [...initialSessions];
      this.currentOffset = initialSessions.length;
    } else {
      this.accumulatedSessions = [];
      this.currentOffset = 0;
    }

    try {
      this.totalCount = await countSessions().catch(() => 0);

      // If initial sessions already cover total count or SQLite has 0
      if (this.totalCount <= this.currentOffset) {
        this.notify(true);
        this.isRunning = false;
        return;
      }

      // Schedule progressive chunk loading on idle
      this.scheduleNextChunk();
    } catch (err) {
      console.warn('[HistoryHydrator] Initialization warning:', err);
      this.notify(true);
      this.isRunning = false;
    }
  }

  private scheduleNextChunk(): void {
    if (this.isCancelled) {
      this.isRunning = false;
      return;
    }

    // Yield to main thread interactions
    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(async () => {
        if (this.isCancelled) {
          this.isRunning = false;
          return;
        }

        await this.loadChunk();
      }, 30);
    });
  }

  private async loadChunk(): Promise<void> {
    if (this.isCancelled) {
      this.isRunning = false;
      return;
    }

    try {
      const limit = this.currentOffset === 0 ? this.initialChunkSize : this.chunkSize;
      const chunk = await listSessions(limit, this.currentOffset);

      if (this.isCancelled) {
        this.isRunning = false;
        return;
      }

      if (chunk.length === 0) {
        this.notify(true);
        this.isRunning = false;
        return;
      }

      this.accumulatedSessions = mergeSessionChunks(this.accumulatedSessions, chunk);
      this.currentOffset += chunk.length;

      const isComplete = chunk.length < limit || this.currentOffset >= this.totalCount;
      this.notify(isComplete);

      if (!isComplete && !this.isCancelled) {
        this.scheduleNextChunk();
      } else {
        this.isRunning = false;
      }
    } catch (err) {
      console.warn('[HistoryHydrator] Error loading chunk:', err);
      this.notify(true);
      this.isRunning = false;
    }
  }

  private notify(isComplete: boolean): void {
    const payload: HydrationProgress = {
      sessions: this.accumulatedSessions,
      isComplete,
      totalCount: Math.max(this.totalCount, this.accumulatedSessions.length),
      loadedCount: this.accumulatedSessions.length,
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
  }

  public getSessions(): WorkoutSessionV2[] {
    return this.accumulatedSessions;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}

export const historyHydrator = new HistoryHydrator();
