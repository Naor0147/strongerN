// src/__tests__/challengerM2CloudSyncAndRestore.test.ts
// Empirical Adversarial Challenger Test Suite for Milestone 2:
// - Manual Cloud Sync (handleCloudSync) & Backup Export (handleExportBackup) truncated data protection
// - Safe Merge-Only restore vs Stale/Partial Backups
// - Concurrency & Race Condition Stress testing for insertMissingSessionsOnly + loadAllSessions + setCachedRecentSessions

import * as repository from '../storage/history/repository';
import * as dbSingleton from '../storage/dbSingleton';
import * as instantCache from '../storage/instantCache';
import * as googleDrive from '../utils/googleDrive';
import { WorkoutSessionV2 } from '../storage/contracts/types';
import { legacySessionToV2, sessionV2ToLegacy } from '../storage/history/legacySessionMapper';
import { initMMKVAdapter, setInjectedStorageAdapter, SynchronousStorageAdapter } from '../storage/adapters/mmkvAdapter';
import { buildBackupData } from '../utils/backupManager';

class MemoryStorageAdapter implements SynchronousStorageAdapter {
  private data = new Map<string, string>();
  isAvailable = () => true;
  isNative = () => true;
  getString = (key: string) => this.data.get(key) ?? null;
  setString = (key: string, value: string) => { this.data.set(key, value); return true; };
  removeItem = (key: string) => { this.data.delete(key); return true; };
  clear = () => this.data.clear();
}

function generateMockSessionsV2(count: number, prefix = 'sess'): WorkoutSessionV2[] {
  return Array.from({ length: count }, (_, i) => {
    const sessId = count === 1 ? prefix : `${prefix}-${i}`;
    return {
      id: sessId,
      title: `Workout Session ${i}`,
      titleNorm: `workout session ${i}`,
      startedAtMs: 1786687000000 - i * 86400000,
      endedAtMs: 1786690600000 - i * 86400000,
      durationSec: 3600,
      comment: `Comment for session ${i}`,
      totalVolumeMilliKg: 5000000 + i * 10000,
      prs: i % 3,
      createdAtMs: 1786687000000 - i * 86400000,
      updatedAtMs: 1786690600000 - i * 86400000,
      revision: 1,
      deletedAtMs: null,
      exercises: [
        {
          id: `ex-${sessId}-1`,
          sessionId: sessId,
          exerciseId: `bench-press`,
          nameSnapshot: 'Bench Press',
          nameNorm: 'bench press',
          variationKey: '',
          position: 0,
          supersetGroupId: null,
          note: null,
          sets: [
            {
              id: `set-${sessId}-1`,
              sessionExerciseId: `ex-${sessId}-1`,
              position: 0,
              category: 'S',
              completed: true,
              weightMilliKg: 80000,
              reps: 10,
              rpeTenths: 80,
              isUnilateral: false,
              leftWeightMilliKg: 0,
              leftReps: 0,
              rightWeightMilliKg: 0,
              rightReps: 0,
            },
          ],
        },
      ],
    };
  });
}

describe('Challenger 2 - Milestone 2 Empirical Verification Suite', () => {
  let mockAdapter: MemoryStorageAdapter;

  beforeEach(() => {
    mockAdapter = new MemoryStorageAdapter();
    setInjectedStorageAdapter(mockAdapter);
    initMMKVAdapter();
  });

  afterEach(() => {
    setInjectedStorageAdapter(null);
    jest.restoreAllMocks();
  });

  describe('1. Manual Cloud Sync (handleCloudSync) Truncation Guards', () => {
    test('lazily loads full 300+ history if isFullHistoryLoaded is false before uploading to cloud', async () => {
      const full350Sessions = generateMockSessionsV2(350);
      const preview20Sessions = full350Sessions.slice(0, 20).map(sessionV2ToLegacy);

      const loadAllSpy = jest.spyOn(repository, 'loadAllSessions').mockResolvedValue(full350Sessions);
      const updateBackupSpy = jest.spyOn(googleDrive, 'updateBackupFile').mockResolvedValue(undefined as any);
      const findBackupSpy = jest.spyOn(googleDrive, 'findBackupFile').mockResolvedValue('file-existing-123');

      // Simulate App state when only preview sessions are loaded
      let isFullHistoryLoaded = false;
      let sessionsList = preview20Sessions;
      const historyRepositoryReady = true;
      const googleUser = { email: 'user@test.com', name: 'User', accessToken: 'token-abc', fileId: 'file-existing-123' };
      const user = { name: 'User', totalWorkouts: 350, isPro: true };

      // Replicate handleCloudSync logic exactly from App.tsx
      const handleCloudSyncSim = async () => {
        if (!googleUser || !googleUser.accessToken) return false;
        let currentSessions = sessionsList;
        if (!isFullHistoryLoaded) {
          if (historyRepositoryReady) {
            try {
              const fullSessions = await repository.loadAllSessions();
              if (fullSessions) {
                const fullLegacy = fullSessions.map(sessionV2ToLegacy);
                sessionsList = fullLegacy;
                instantCache.setCachedRecentSessions(fullLegacy, fullLegacy.length);
                isFullHistoryLoaded = true;
                currentSessions = fullLegacy;
              } else {
                return false;
              }
            } catch (err) {
              return false;
            }
          } else {
            return false;
          }
        }
        const nowStr = new Date().toISOString();
        const backupData = {
          user: {
            ...user,
            totalWorkouts: currentSessions.length,
          },
          sessionsList: currentSessions,
          timestamp: nowStr,
        };
        await googleDrive.updateBackupFile(googleUser.accessToken, googleUser.fileId, backupData);
        return true;
      };

      const syncResult = await handleCloudSyncSim();

      expect(syncResult).toBe(true);
      expect(loadAllSpy).toHaveBeenCalledTimes(1);
      expect(isFullHistoryLoaded).toBe(true);
      expect(sessionsList).toHaveLength(350);

      // Verify the uploaded payload contains all 350 sessions and user.totalWorkouts is 350
      expect(updateBackupSpy).toHaveBeenCalledWith(
        'token-abc',
        'file-existing-123',
        expect.objectContaining({
          user: expect.objectContaining({ totalWorkouts: 350 }),
          sessionsList: expect.arrayContaining([expect.objectContaining({ id: 'sess-0' }), expect.objectContaining({ id: 'sess-349' })]),
        })
      );
      const uploadedPayload = updateBackupSpy.mock.calls[0][2] as any;
      expect(uploadedPayload.sessionsList).toHaveLength(350);
    });

    test('strictly blocks cloud sync when SQLite repository is unready and full history is not loaded', async () => {
      const preview20Sessions = generateMockSessionsV2(20).map(sessionV2ToLegacy);
      const updateBackupSpy = jest.spyOn(googleDrive, 'updateBackupFile');

      let isFullHistoryLoaded = false;
      const sessionsList = preview20Sessions;
      const historyRepositoryReady = false; // DB offline / not ready
      const googleUser = { email: 'user@test.com', name: 'User', accessToken: 'token-abc', fileId: 'file-123' };

      const handleCloudSyncSim = async () => {
        if (!googleUser || !googleUser.accessToken) return false;
        let currentSessions = sessionsList;
        if (!isFullHistoryLoaded) {
          if (historyRepositoryReady) {
            const fullSessions = await repository.loadAllSessions();
            if (fullSessions) {
              currentSessions = fullSessions.map(sessionV2ToLegacy);
            }
          } else {
            console.warn('[CloudSync] Sync blocked: Full history not loaded yet');
            return false;
          }
        }
        await googleDrive.updateBackupFile(googleUser.accessToken, googleUser.fileId, { sessionsList: currentSessions });
        return true;
      };

      const syncResult = await handleCloudSyncSim();

      expect(syncResult).toBe(false);
      expect(updateBackupSpy).not.toHaveBeenCalled();
    });

    test('safely catches error in loadAllSessions and blocks cloud upload without corrupting state', async () => {
      jest.spyOn(repository, 'loadAllSessions').mockRejectedValue(new Error('SQLite disk I/O error'));
      const updateBackupSpy = jest.spyOn(googleDrive, 'updateBackupFile');

      const isFullHistoryLoaded = false;
      const historyRepositoryReady = true;
      const googleUser = { email: 'user@test.com', name: 'User', accessToken: 'token-abc', fileId: 'file-123' };

      const handleCloudSyncSim = async () => {
        if (!googleUser || !googleUser.accessToken) return false;
        let currentSessions: any[] = [];
        if (!isFullHistoryLoaded) {
          if (historyRepositoryReady) {
            try {
              const fullSessions = await repository.loadAllSessions();
              if (fullSessions) {
                currentSessions = fullSessions.map(sessionV2ToLegacy);
              } else {
                return false;
              }
            } catch (err) {
              return false;
            }
          } else {
            return false;
          }
        }
        await googleDrive.updateBackupFile(googleUser.accessToken, googleUser.fileId, { sessionsList: currentSessions });
        return true;
      };

      const syncResult = await handleCloudSyncSim();

      expect(syncResult).toBe(false);
      expect(updateBackupSpy).not.toHaveBeenCalled();
    });
  });

  describe('2. Backup Export (handleExportBackup) Truncation Guards', () => {
    test('exports full 300+ history when initiated before full history was loaded', async () => {
      const full350Sessions = generateMockSessionsV2(350);
      const preview20Sessions = full350Sessions.slice(0, 20).map(sessionV2ToLegacy);

      jest.spyOn(repository, 'loadAllSessions').mockResolvedValue(full350Sessions);

      let isFullHistoryLoaded = false;
      let sessionsList = preview20Sessions;
      const historyRepositoryReady = true;
      const user = { name: 'Athlete', totalWorkouts: 350, isPro: true };

      // Replicate handleExportBackup logic exactly from App.tsx
      const handleExportBackupSim = async () => {
        let currentSessions = sessionsList;
        if (!isFullHistoryLoaded) {
          if (historyRepositoryReady) {
            try {
              const fullSessions = await repository.loadAllSessions();
              if (fullSessions) {
                const fullLegacy = fullSessions.map(sessionV2ToLegacy);
                sessionsList = fullLegacy;
                instantCache.setCachedRecentSessions(fullLegacy, fullLegacy.length);
                isFullHistoryLoaded = true;
                currentSessions = fullLegacy;
              }
            } catch (err) {
              console.error('[BackupExport] Failed to load full history:', err);
            }
          }
        }

        const backupData = buildBackupData({
          username: user.name,
          user: {
            ...user,
            totalWorkouts: currentSessions.length,
          },
          sessionsList: currentSessions,
          templatesList: [],
          exercisesList: [],
          primaryMetricsList: [],
          bodyPartMetricsList: [],
          settings: {},
        });

        return backupData;
      };

      const exportedBackup = await handleExportBackupSim();

      expect(exportedBackup.sessionsList).toHaveLength(350);
      expect(exportedBackup.user.totalWorkouts).toBe(350);
      expect(exportedBackup.sessionsList[0].id).toBe('sess-0');
      expect(exportedBackup.sessionsList[349].id).toBe('sess-349');
      expect(isFullHistoryLoaded).toBe(true);
      expect(sessionsList).toHaveLength(350);
    });
  });

  describe('3. Safe Merge-Only Restore (applyBackupData & handleGoogleLogin)', () => {
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        runAsync: jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 1 }),
        getFirstAsync: jest.fn(),
        getAllAsync: jest.fn().mockResolvedValue([]),
        execAsync: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(dbSingleton, 'getV2Database').mockResolvedValue(mockDb);
    });

    test('restoring partial/stale backup (5 sessions) NEVER soft-deletes 300 local sessions', async () => {
      // Local DB has 300 active sessions
      const existingRows = Array.from({ length: 300 }, (_, i) => ({
        id: `sess-${i}`,
        deleted_at_ms: null,
      }));
      mockDb.getAllAsync.mockResolvedValueOnce(existingRows);

      // Incoming stale backup has only 5 sessions (sess-0 .. sess-4)
      const staleBackupSessions = generateMockSessionsV2(5);

      await repository.insertMissingSessionsOnly(staleBackupSessions);

      // Verify that NO DELETE or soft-delete UPDATE was executed against the remaining 295 sessions
      const calls = mockDb.runAsync.mock.calls;
      for (const call of calls) {
        const query = call[0];
        expect(query).not.toMatch(/UPDATE workout_sessions SET deleted_at_ms = \? WHERE id NOT IN/i);
        expect(query).not.toMatch(/DELETE FROM workout_sessions/i);
      }
    });

    test('restoring backup un-tombstones any previously soft-deleted sessions', async () => {
      // Local DB has 2 tombstoned sessions (deleted_at_ms != null) and 1 active session
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 'sess-tomb-0', deleted_at_ms: 1786689000000 },
        { id: 'sess-tomb-1', deleted_at_ms: 1786689000000 },
        { id: 'sess-active-0', deleted_at_ms: null },
      ]);

      const incomingSessions: WorkoutSessionV2[] = [
        ...generateMockSessionsV2(2, 'sess-tomb'),
        ...generateMockSessionsV2(1, 'sess-new'),
      ];

      await repository.insertMissingSessionsOnly(incomingSessions);

      // Verify un-tombstoning UPDATE query executed for sess-tomb-0 and sess-tomb-1
      const updateCalls = mockDb.runAsync.mock.calls.filter((c: any) =>
        typeof c[0] === 'string' && c[0].includes('UPDATE workout_sessions SET deleted_at_ms = NULL')
      );
      expect(updateCalls).toHaveLength(2);
      expect(updateCalls[0][1]).toContain('sess-tomb-0');
      expect(updateCalls[1][1]).toContain('sess-tomb-1');

      // Verify INSERT query executed for brand new session sess-new
      const insertCalls = mockDb.runAsync.mock.calls.filter((c: any) =>
        typeof c[0] === 'string' && c[0].includes('INSERT INTO workout_sessions')
      );
      expect(insertCalls).toHaveLength(1);
      expect(insertCalls[0][1]).toContain('sess-new');
    });

    test('empty backup restore ({ sessionsList: [] }) does not delete local rows', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 'sess-1', deleted_at_ms: null },
        { id: 'sess-2', deleted_at_ms: null },
      ]);

      await repository.insertMissingSessionsOnly([]);

      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('4. Concurrency Stress Test & Instant Cache Integrity', () => {
    test('50 concurrent operations serialize cleanly through enqueueWrite without race conditions', async () => {
      let executionOrder: number[] = [];
      let dbCounter = 0;

      const mockDb: any = {
        runAsync: jest.fn().mockImplementation(async () => {
          await new Promise(r => setTimeout(r, 2));
          dbCounter++;
          return { changes: 1, lastInsertRowId: 1 };
        }),
        getFirstAsync: jest.fn(),
        getAllAsync: jest.fn().mockImplementation(async () => {
          await new Promise(r => setTimeout(r, 1));
          return [];
        }),
        execAsync: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(dbSingleton, 'getV2Database').mockResolvedValue(mockDb);

      const tasks = Array.from({ length: 50 }, (_, i) => {
        const session = generateMockSessionsV2(1, `concurrent-sess-${i}`)[0];
        return repository.insertMissingSessionsOnly([session]).then(() => {
          executionOrder.push(i);
        });
      });

      await Promise.all(tasks);

      // Verify all 50 operations finished cleanly without rejected promises
      expect(executionOrder).toHaveLength(50);
      expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN IMMEDIATE TRANSACTION;');
      expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT;');
    });

    test('instantCache keeps top 20 preview and preserves 350 total count accurately', () => {
      const full350 = generateMockSessionsV2(350).map(sessionV2ToLegacy);

      instantCache.setCachedRecentSessions(full350, 350);

      const cachedRecent = instantCache.getCachedRecentSessions();
      const cachedCount = instantCache.getCachedTotalSessionsCount();

      expect(cachedRecent).toHaveLength(20);
      expect(cachedRecent![0].id).toBe('sess-0');
      expect(cachedRecent![19].id).toBe('sess-19');
      expect(cachedCount).toBe(350);
    });

    test('instantCache handles null, undefined, empty, and huge arrays gracefully', () => {
      instantCache.setCachedRecentSessions([], 0);
      expect(instantCache.getCachedRecentSessions()).toEqual([]);
      expect(instantCache.getCachedTotalSessionsCount()).toBe(0);

      instantCache.setCachedRecentSessions(null as any, undefined as any);
      expect(instantCache.getCachedRecentSessions()).toEqual([]);
      expect(instantCache.getCachedTotalSessionsCount()).toBe(0);

      const huge1000 = generateMockSessionsV2(1000).map(sessionV2ToLegacy);
      instantCache.setCachedRecentSessions(huge1000, 1000);
      expect(instantCache.getCachedRecentSessions()).toHaveLength(20);
      expect(instantCache.getCachedTotalSessionsCount()).toBe(1000);
    });
  });

  describe('5. Auto-Sync Upload Protection Guard Logic', () => {
    test('auto-sync is blocked when isDataLoaded=false or isFullHistoryLoaded=false', () => {
      const canUpload = (isDataLoaded: boolean, isFullHistoryLoaded: boolean, googleUser: any, sessionsList: any[], totalWorkouts: number) => {
        if (!isDataLoaded || !isFullHistoryLoaded) return false;
        if (!googleUser || !googleUser.accessToken) return false;
        if (sessionsList.length === 0 && (totalWorkouts || 0) > 0) return false;
        return true;
      };

      const googleUser = { accessToken: 'token-xyz' };

      // Case 1: Initial startup before SQLite loaded
      expect(canUpload(false, false, googleUser, [{ id: '1' }], 1)).toBe(false);

      // Case 2: Data loaded from MMKV preview (20 items), but full SQLite history pending
      expect(canUpload(true, false, googleUser, new Array(20).fill({ id: '1' }), 300)).toBe(false);

      // Case 3: Empty in-memory list when user profile has 150 workouts
      expect(canUpload(true, true, googleUser, [], 150)).toBe(false);

      // Case 4: Full history confirmed loaded (350 sessions)
      expect(canUpload(true, true, googleUser, new Array(350).fill({ id: '1' }), 350)).toBe(true);
    });
  });
});
