// src/__tests__/startupDeBottleneckingM2.test.ts
// Unit and regression tests for Milestone 2: Startup Pipeline & Render De-Bottlenecking

import * as crashLogger from '../utils/crashLogger';
import * as instantCache from '../storage/instantCache';
import * as notifications from '../utils/notifications';
import {
  initMMKVAdapter,
  setInjectedStorageAdapter,
  SynchronousStorageAdapter,
} from '../storage/adapters/mmkvAdapter';

class TestMemoryAdapter implements SynchronousStorageAdapter {
  private data = new Map<string, string>();
  isAvailable = () => true;
  isNative = () => true;
  getString = (key: string) => this.data.get(key) ?? null;
  setString = (key: string, value: string) => { this.data.set(key, value); return true; };
  removeItem = (key: string) => { this.data.delete(key); return true; };
}

describe('Milestone 2: Startup Pipeline & Render De-Bottlenecking', () => {
  let mockAdapter: TestMemoryAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdapter = new TestMemoryAdapter();
    setInjectedStorageAdapter(mockAdapter);
    initMMKVAdapter();
    instantCache.clearInstantCache();
  });

  afterEach(() => {
    setInjectedStorageAdapter(null);
  });

  describe('1. CrashLogger Async In-Memory Queue', () => {
    it('queues non-fatal errors in memory without throwing', async () => {
      await crashLogger.clearCrashLogs();
      await crashLogger.addCrashLog('Non-fatal test warning', 'Stack line 1\nStack line 2', false);

      // getCrashLogs should include in-memory queued items
      const logs = await crashLogger.getCrashLogs();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const found = logs.find(l => l.message === 'Non-fatal test warning');
      expect(found).toBeDefined();
      expect(found?.fatal).toBe(false);
    });

    it('flushes memory queue asynchronously', async () => {
      await crashLogger.clearCrashLogs();
      await crashLogger.addCrashLog('Async queued log 1', 'Stack 1', false);
      await crashLogger.addCrashLog('Async queued log 2', 'Stack 2', false);

      await crashLogger.flushCrashQueueAsync();
      const logs = await crashLogger.getCrashLogs();
      expect(logs.length).toBe(2);
      expect(logs.map(l => l.message)).toEqual(
        expect.arrayContaining(['Async queued log 1', 'Async queued log 2'])
      );
    });

    it('handles delete and clear with in-memory queue correctly', async () => {
      await crashLogger.clearCrashLogs();
      await crashLogger.addCrashLog('Log to delete', 'Stack', false);
      await crashLogger.addCrashLog('Log to keep', 'Stack', false);

      const logsBefore = await crashLogger.getCrashLogs();
      const target = logsBefore.find(l => l.message === 'Log to delete');
      expect(target).toBeDefined();

      if (target) {
        await crashLogger.deleteCrashLog(target.id);
      }

      const logsAfter = await crashLogger.getCrashLogs();
      expect(logsAfter.find(l => l.message === 'Log to delete')).toBeUndefined();
      expect(logsAfter.find(l => l.message === 'Log to keep')).toBeDefined();

      await crashLogger.clearCrashLogs();
      const logsCleared = await crashLogger.getCrashLogs();
      expect(logsCleared.length).toBe(0);
    });
  });

  describe('2. Instant Cache Profile Summaries & Zero-Delay Render Pass', () => {
    it('persists and retrieves precomputed profile summaries for Frame 0 instant hydration', () => {
      const mockSummaries: instantCache.InstantProfileSummaries = {
        dynamicWeeklyChartData: [
          { weekLabel: '8/1', count: 3 },
          { weekLabel: '8/8', count: 4 },
        ],
        weeklyMuscleSets: {
          Chest: 12,
          Back: 15,
          Quads: 10,
        },
      };

      instantCache.setCachedProfileSummaries(mockSummaries);
      const retrieved = instantCache.getCachedProfileSummaries();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.dynamicWeeklyChartData).toHaveLength(2);
      expect(retrieved?.weeklyMuscleSets?.Chest).toBe(12);
      expect(retrieved?.weeklyMuscleSets?.Back).toBe(15);
    });

    it('safely handles empty or missing profile summaries', () => {
      instantCache.clearInstantCache();
      const retrieved = instantCache.getCachedProfileSummaries();
      expect(retrieved).toBeNull();
    });
  });

  describe('3. Notifications Deferral Safety', () => {
    it('initializes notifications gracefully without uncaught exceptions on any platform', async () => {
      await expect(notifications.initNotifications()).resolves.not.toThrow();
    });

    it('correctly classifies workout vs non-workout notification responses', () => {
      expect(
        notifications.isWorkoutNotificationResponse({
          notification: {
            request: {
              content: { data: { type: 'workout' } },
            },
          },
        })
      ).toBe(true);

      expect(
        notifications.isWorkoutNotificationResponse({
          notification: {
            request: {
              content: { data: { type: 'rest-timer' } },
            },
          },
        })
      ).toBe(false);

      expect(notifications.isWorkoutNotificationResponse(null)).toBe(false);
    });
  });
});
