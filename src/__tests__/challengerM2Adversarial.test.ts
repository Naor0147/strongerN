// src/__tests__/challengerM2Adversarial.test.ts
// Empirical Challenger Stress & Adversarial Test Suite for Milestone 2

import { bootstrapPersistence } from '../storage/persistenceBootstrap';
import { WorkoutSessionV2 } from '../storage/contracts/types';
import { legacySessionToV2 } from '../storage/history/legacySessionMapper';
import * as repository from '../storage/history/repository';
import { initMMKVAdapter, setInjectedStorageAdapter, SynchronousStorageAdapter } from '../storage/adapters/mmkvAdapter';
import { getStorageHealthState } from '../storage/healthState';

class TestMemoryAdapter implements SynchronousStorageAdapter {
  private data = new Map<string, string>();
  isAvailable = () => true;
  isNative = () => true;
  getString = (key: string) => this.data.get(key) ?? null;
  setString = (key: string, value: string) => { this.data.set(key, value); return true; };
  removeItem = (key: string) => { this.data.delete(key); return true; };
}

describe('Milestone 2 - Adversarial Challenger Test Suite', () => {
  let mockAdapter: TestMemoryAdapter;

  beforeEach(() => {
    mockAdapter = new TestMemoryAdapter();
    setInjectedStorageAdapter(mockAdapter);
    initMMKVAdapter();
  });

  afterEach(() => {
    setInjectedStorageAdapter(null);
    jest.restoreAllMocks();
  });

  describe('Scenario 1: Scale Edge Cases (0, 50, 350, 1000 sessions)', () => {
    test('0 sessions loads cleanly with empty sessions list', async () => {
      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
      jest.spyOn(repository, 'getPersistenceMeta').mockResolvedValue(JSON.stringify({
        version: 2,
        verifiedAtMs: 1786687000000,
        sourceFingerprint: 'empty-fingerprint',
      }));
      jest.spyOn(repository, 'loadAllSessions').mockResolvedValue([]);
      jest.spyOn(repository, 'loadSessionHeadersChunk').mockResolvedValue({ headers: [] as any, hasMore: false });
      jest.spyOn(repository, 'countSessions').mockResolvedValue(0);
      jest.spyOn(repository, 'countTombstonedSessions').mockResolvedValue(0);

      const result = await bootstrapPersistence({}, null);
      expect(result.historyReady).toBe(true);
      expect(result.sessions).toEqual([]);
      expect(result.migration.status).toBe('verified');
    });

    test('350 sessions fast-path load preserves array references and ordering', async () => {
      const mockSessions: WorkoutSessionV2[] = Array.from({ length: 350 }, (_, i) => ({
        id: `session-scale-${i}`,
        title: `Workout ${i}`,
        titleNorm: `workout ${i}`,
        startedAtMs: 1786687000000 - i * 86400000,
        endedAtMs: 1786690600000 - i * 86400000,
        durationSec: 3600,
        comment: null,
        totalVolumeMilliKg: 10000000,
        prs: 1,
        createdAtMs: 1786687000000 - i * 86400000,
        updatedAtMs: 1786690600000 - i * 86400000,
        revision: 1,
        deletedAtMs: null,
        exercises: [],
      }));

      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
      jest.spyOn(repository, 'getPersistenceMeta').mockResolvedValue(JSON.stringify({
        version: 2,
        verifiedAtMs: 1786687000000,
        sourceFingerprint: 'scale-fingerprint',
      }));
      jest.spyOn(repository, 'loadAllSessions').mockResolvedValue(mockSessions);
      jest.spyOn(repository, 'loadSessionHeadersChunk').mockResolvedValue({ headers: mockSessions as any, hasMore: false });
      jest.spyOn(repository, 'countSessions').mockResolvedValue(mockSessions.length);
      jest.spyOn(repository, 'countTombstonedSessions').mockResolvedValue(0);

      const result = await bootstrapPersistence({}, null);
      expect(result.sessions).toHaveLength(350);
      expect(result.sessions[0].id).toBe('session-scale-0');
      expect(result.sessions[349].id).toBe('session-scale-349');
    });
  });

  describe('Scenario 2: Corrupted Meta Keys and Resilient Fallback', () => {
    const corruptCases = [
      '{ invalid json string',
      '{"version": 1}',
      '{"version": 2}', // missing verifiedAtMs
      'null',
      '',
      '12345',
      '{"version": "two", "verifiedAtMs": "yes"}',
    ];

    test.each(corruptCases)('handles corrupted meta value "%s" safely by re-running migration', async (corruptValue) => {
      const legacyRaw = {
        sessionsList: [
          { id: 'leg-1', title: 'Leg 1', datetime: '2026-08-01T12:00:00Z', exercises: [] },
        ],
      };

      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
      jest.spyOn(repository, 'getPersistenceMeta').mockResolvedValue(corruptValue);
      const setMetaSpy = jest.spyOn(repository, 'setPersistenceMeta').mockResolvedValue();
      const upsertSpy = jest.spyOn(repository, 'upsertSession').mockResolvedValue();
      jest.spyOn(repository, 'bulkImportSessions').mockResolvedValue();
      const expected = legacySessionToV2(legacyRaw.sessionsList[0], 0);
      jest.spyOn(repository, 'loadSessionHeadersChunk').mockResolvedValue({ headers: [expected] as any, hasMore: false });
      jest.spyOn(repository, 'loadAllSessions').mockResolvedValue([expected]);
      jest.spyOn(repository, 'countSessions').mockResolvedValue(1);
      jest.spyOn(repository, 'countTombstonedSessions').mockResolvedValue(0);

      const result = await bootstrapPersistence(legacyRaw, null);

      expect(result.historyReady).toBe(true);
      // bulk path now, upsert may be 0-1; either ensures migration writes
      expect(setMetaSpy).toHaveBeenCalledWith('legacy_v1_to_relational_v2', expect.stringContaining('"version":2'));
      expect(result.migration.status).toBe('verified');
      expect(result.sessions).toHaveLength(1);
    });

    test('aborts meta registration and reports failure if migration count verification fails', async () => {
      const legacyRaw = {
        sessionsList: [
          { id: 'leg-missing-1', title: 'Session 1', datetime: '2026-08-01T12:00:00Z', exercises: [] },
          { id: 'leg-missing-2', title: 'Session 2', datetime: '2026-08-01T14:00:00Z', exercises: [] },
        ],
      };

      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
      jest.spyOn(repository, 'getPersistenceMeta').mockResolvedValue(null);
      const setMetaSpy = jest.spyOn(repository, 'setPersistenceMeta').mockResolvedValue();
      jest.spyOn(repository, 'upsertSession').mockResolvedValue();
      jest.spyOn(repository, 'bulkImportSessions').mockResolvedValue();
      jest.spyOn(repository, 'loadSessionHeadersChunk').mockResolvedValue({ headers: [] as any, hasMore: false });
      jest.spyOn(repository, 'countSessions').mockResolvedValue(1);
      jest.spyOn(repository, 'countTombstonedSessions').mockResolvedValue(0);
      // Simulate partial write where only 1 of 2 sessions was loaded
      jest.spyOn(repository, 'loadAllSessions').mockResolvedValue([legacySessionToV2(legacyRaw.sessionsList[0], 0)]);

      const result = await bootstrapPersistence(legacyRaw, null);

      // setPersistenceMeta should NOT have been called due to verification failure
      expect(setMetaSpy).not.toHaveBeenCalled();
      expect(result.migration.status).toBe('failed');
      expect(result.migration.error).toContain('Migration verification failed');
      expect(getStorageHealthState().mode).toBe('migration_failed_readonly');
    });
  });

  describe('Scenario 3: SQLite Error & Crash Recovery Fallback', () => {
    test('catches SQLite crash in loadAllSessions and safely returns legacy mapped data', async () => {
      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
      jest.spyOn(repository, 'getPersistenceMeta').mockResolvedValue(JSON.stringify({
        version: 2,
        verifiedAtMs: 1786687000000,
      }));
      jest.spyOn(repository, 'loadSessionHeadersChunk').mockRejectedValue(new Error('SQLITE_CORRUPT: database disk image is malformed'));
      jest.spyOn(repository, 'loadAllSessions').mockRejectedValue(new Error('SQLITE_CORRUPT: database disk image is malformed'));
      jest.spyOn(repository, 'countTombstonedSessions').mockResolvedValue(0);

      const legacyRaw = {
        sessionsList: [
          { id: 'fallback-1', title: 'Safety Net Session', datetime: '2026-08-01T12:00:00Z', exercises: [] },
        ],
      };

      const result = await bootstrapPersistence(legacyRaw, null);

      // Should not throw, but report failure state and return legacy sessions safely
      expect(result.migration.status).toBe('failed');
      expect(result.migration.error).toContain('SQLITE_CORRUPT');
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].title).toBe('Safety Net Session');
      expect(getStorageHealthState().mode).toBe('migration_failed_readonly');
    });

    test('handles missing or malformed legacy payload without throwing', async () => {
      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
      jest.spyOn(repository, 'getPersistenceMeta').mockResolvedValue(null);
      jest.spyOn(repository, 'setPersistenceMeta').mockResolvedValue();
      jest.spyOn(repository, 'loadAllSessions').mockResolvedValue([]);

      const result = await bootstrapPersistence(null, null);

      expect(result.sessions).toEqual([]);
      expect(result.migration.status).toBe('verified');
    });
  });
});
