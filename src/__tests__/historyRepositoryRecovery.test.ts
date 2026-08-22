// src/__tests__/historyRepositoryRecovery.test.ts
// Unit and regression tests for History Recovery, Tombstone Self-Healing, and SQLite Diagnostics.

import {
  countTombstonedSessions,
  restoreAllTombstonedSessions,
  recoverTombstonedSessions,
  getDatabaseDiagnostics,
  insertMissingSessionsOnly,
} from '../storage/history/repository';
import * as repository from '../storage/history/repository';
import * as dbSingleton from '../storage/dbSingleton';
import * as instantCache from '../storage/instantCache';
import { bootstrapPersistence } from '../storage/persistenceBootstrap';
import { WorkoutSessionV2 } from '../storage/contracts/types';
import { initMMKVAdapter, setInjectedStorageAdapter, SynchronousStorageAdapter } from '../storage/adapters/mmkvAdapter';

class MockStorageAdapter implements SynchronousStorageAdapter {
  private store = new Map<string, string>();
  isAvailable = () => true;
  isNative = () => true;
  getString = (key: string) => this.store.get(key) ?? null;
  setString = (key: string, value: string) => { this.store.set(key, value); return true; };
  removeItem = (key: string) => { this.store.delete(key); return true; };
}

describe('History Repository Recovery & Diagnostics Engine', () => {
  let mockDb: any;
  let mockAdapter: MockStorageAdapter;

  beforeEach(() => {
    mockAdapter = new MockStorageAdapter();
    setInjectedStorageAdapter(mockAdapter);
    initMMKVAdapter();

    mockDb = {
      runAsync: jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 1 }),
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn().mockResolvedValue([]),
      execAsync: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(dbSingleton, 'getV2Database').mockResolvedValue(mockDb);
  });

  afterEach(() => {
    setInjectedStorageAdapter(null);
    jest.restoreAllMocks();
  });

  describe('countTombstonedSessions', () => {
    test('returns exact count of sessions where deleted_at_ms IS NOT NULL', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ count: 42 });

      const count = await countTombstonedSessions();
      expect(count).toBe(42);
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE deleted_at_ms IS NOT NULL')
      );
    });

    test('returns 0 when database returns null or errors', async () => {
      mockDb.getFirstAsync.mockRejectedValueOnce(new Error('DB Error'));

      const count = await countTombstonedSessions();
      expect(count).toBe(0);
    });
  });

  describe('restoreAllTombstonedSessions / recoverTombstonedSessions', () => {
    test('executes UPDATE to set deleted_at_ms = NULL and increments revision', async () => {
      mockDb.runAsync.mockResolvedValueOnce({ changes: 15 });

      const affected = await restoreAllTombstonedSessions();
      expect(affected).toBe(15);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE workout_sessions SET deleted_at_ms = NULL.*WHERE deleted_at_ms IS NOT NULL/s),
        expect.any(Array)
      );
    });

    test('recoverTombstonedSessions alias points to same recovery implementation', async () => {
      mockDb.runAsync.mockResolvedValueOnce({ changes: 5 });

      const affected = await recoverTombstonedSessions();
      expect(affected).toBe(5);
    });
  });

  describe('getDatabaseDiagnostics', () => {
    test('returns comprehensive diagnostic snapshot across SQLite and MMKV', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 120 }) // active
        .mockResolvedValueOnce({ count: 180 }) // tombstoned
        .mockResolvedValueOnce({ count: 300 }); // raw total

      jest.spyOn(instantCache, 'getCachedRecentSessions').mockReturnValue(new Array(20).fill({ id: 's' }));
      jest.spyOn(instantCache, 'getCachedTotalSessionsCount').mockReturnValue(300);

      const diagnostics = await getDatabaseDiagnostics();

      expect(diagnostics).toEqual({
        isReady: true,
        activeSessionsCount: 120,
        tombstonedSessionsCount: 180,
        rawTotalSessionsCount: 300,
        cachedRecentCount: 20,
        cachedTotalCount: 300,
      });
    });

    test('handles database offline state gracefully', async () => {
      jest.spyOn(dbSingleton, 'getV2Database').mockResolvedValue(null);
      jest.spyOn(instantCache, 'getCachedRecentSessions').mockReturnValue(null);
      jest.spyOn(instantCache, 'getCachedTotalSessionsCount').mockReturnValue(null);

      const diagnostics = await getDatabaseDiagnostics();

      expect(diagnostics).toEqual({
        isReady: false,
        activeSessionsCount: 0,
        tombstonedSessionsCount: 0,
        rawTotalSessionsCount: 0,
        cachedRecentCount: 0,
        cachedTotalCount: 0,
      });
    });
  });

  describe('insertMissingSessionsOnly with tombstone restoration', () => {
    const mockSession: WorkoutSessionV2 = {
      id: 'session-123',
      title: 'Chest & Triceps',
      titleNorm: 'chest triceps',
      startedAtMs: 1786687000000,
      endedAtMs: 1786690600000,
      durationSec: 3600,
      comment: null,
      totalVolumeMilliKg: 5000000,
      prs: 0,
      createdAtMs: 1786687000000,
      updatedAtMs: 1786690600000,
      revision: 1,
      deletedAtMs: null,
      exercises: [],
    };

    test('restores tombstoned session when session exists with deleted_at_ms', async () => {
      // Return existing row that has deleted_at_ms = 1786689000000
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 'session-123', deleted_at_ms: 1786689000000 },
      ]);

      await insertMissingSessionsOnly([mockSession]);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE workout_sessions SET deleted_at_ms = NULL.*WHERE id = \?;/),
        expect.arrayContaining(['session-123'])
      );
    });

    test('inserts brand new session if it does not exist in SQLite', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]); // No existing sessions

      await insertMissingSessionsOnly([mockSession]);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO workout_sessions'),
        expect.arrayContaining(['session-123'])
      );
    });

    test('does not modify session if already active in SQLite', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 'session-123', deleted_at_ms: null },
      ]);

      await insertMissingSessionsOnly([mockSession]);

      // runAsync should not be called with UPDATE or INSERT for session-123
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('bootstrapPersistence startup self-healing', () => {
    test('detects tombstoned sessions and automatically restores them on fast-path startup', async () => {
      const activeSession: WorkoutSessionV2 = {
        id: 'session-active',
        title: 'Active Session',
        titleNorm: 'active session',
        startedAtMs: 1786687000000,
        endedAtMs: null,
        durationSec: 1800,
        comment: null,
        totalVolumeMilliKg: 1000,
        prs: 0,
        createdAtMs: 1786687000000,
        updatedAtMs: 1786687000000,
        revision: 1,
        deletedAtMs: null,
        exercises: [],
      };

      const restoredSession: WorkoutSessionV2 = {
        ...activeSession,
        id: 'session-healed',
        title: 'Recovered Session',
      };

      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
      jest.spyOn(repository, 'getPersistenceMeta').mockResolvedValue(JSON.stringify({
        version: 2,
        verifiedAtMs: 1786687000000,
        sourceFingerprint: 'fastpath-valid',
      }));

      // Header path: after restore returns 2 sessions (active + healed)
      jest.spyOn(repository, 'loadSessionHeadersChunk')
        .mockResolvedValue({ headers: [activeSession, restoredSession] as any, hasMore: false });
      jest.spyOn(repository, 'loadAllSessions')
        .mockResolvedValue([activeSession, restoredSession] as any);
      jest.spyOn(repository, 'countSessions').mockResolvedValue(2);

      const countSpy = jest.spyOn(repository, 'countTombstonedSessions').mockResolvedValue(5);
      const restoreSpy = jest.spyOn(repository, 'restoreAllTombstonedSessions').mockResolvedValue(5);

      const result = await bootstrapPersistence({}, null);

      expect(countSpy).toHaveBeenCalled();
      expect(restoreSpy).toHaveBeenCalled();
      expect(result.sessions).toHaveLength(2);
      expect(result.migration.status).toBe('verified');
    });
  });
});
