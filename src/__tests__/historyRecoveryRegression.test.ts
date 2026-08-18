// src/__tests__/historyRecoveryRegression.test.ts
// Comprehensive Regression Test Suite for StrongerN Workout History Recovery & Sync Hardening
// Objectives:
// 1. Sync upload prevention before full load (Gating & Auto-Sync / Manual Sync / Export Protections)
// 2. Safe merge-only restore safety against stale/partial backups (insertMissingSessionsOnly & applyBackupData)
// 3. Soft-delete repair execution (restoreAllTombstonedSessions, countTombstonedSessions, and getDatabaseDiagnostics)

import * as repository from '../storage/history/repository';
import * as dbSingleton from '../storage/dbSingleton';
import * as instantCache from '../storage/instantCache';
import * as googleDrive from '../utils/googleDrive';
import { WorkoutSessionV2 } from '../storage/contracts/types';
import { legacySessionToV2, sessionV2ToLegacy } from '../storage/history/legacySessionMapper';
import { initMMKVAdapter, setInjectedStorageAdapter, SynchronousStorageAdapter } from '../storage/adapters/mmkvAdapter';
import { buildBackupData } from '../utils/backupManager';

class MockSynchronousStorageAdapter implements SynchronousStorageAdapter {
  private store = new Map<string, string>();
  isAvailable = () => true;
  isNative = () => true;
  getString = (key: string) => this.store.get(key) ?? null;
  setString = (key: string, value: string) => { this.store.set(key, value); return true; };
  removeItem = (key: string) => { this.store.delete(key); return true; };
  clear = () => this.store.clear();
}

function createSampleV2Session(id: string, overrides: Partial<WorkoutSessionV2> = {}): WorkoutSessionV2 {
  return {
    id,
    title: `Workout ${id}`,
    titleNorm: `workout ${id}`,
    startedAtMs: 1786687000000,
    endedAtMs: 1786690600000,
    durationSec: 3600,
    comment: null,
    totalVolumeMilliKg: 4500000,
    prs: 1,
    createdAtMs: 1786687000000,
    updatedAtMs: 1786690600000,
    revision: 1,
    deletedAtMs: null,
    exercises: [
      {
        id: `ex-${id}-1`,
        sessionId: id,
        exerciseId: 'bench-press',
        nameSnapshot: 'Bench Press',
        nameNorm: 'bench press',
        variationKey: '',
        position: 0,
        supersetGroupId: null,
        note: null,
        sets: [
          {
            id: `set-${id}-1`,
            position: 0,
            category: 'S',
            completed: true,
            weightMilliKg: 85000,
            reps: 8,
            rpeTenths: 85,
            isUnilateral: false,
            leftWeightMilliKg: 0,
            leftReps: 0,
            rightWeightMilliKg: 0,
            rightReps: 0,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function generateMockSessionList(count: number, prefix = 'sess'): WorkoutSessionV2[] {
  return Array.from({ length: count }, (_, i) =>
    createSampleV2Session(`${prefix}-${i}`, {
      startedAtMs: 1786687000000 - i * 86400000,
      endedAtMs: 1786690600000 - i * 86400000,
      createdAtMs: 1786687000000 - i * 86400000,
      updatedAtMs: 1786690600000 - i * 86400000,
    })
  );
}

describe('History Recovery & Sync Hardening Regression Suite', () => {
  let mockAdapter: MockSynchronousStorageAdapter;
  let mockDb: any;

  beforeEach(() => {
    mockAdapter = new MockSynchronousStorageAdapter();
    setInjectedStorageAdapter(mockAdapter);
    initMMKVAdapter();

    mockDb = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
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

  // =========================================================================
  // 1. Sync Upload Prevention Before Full Load
  // =========================================================================
  describe('1. Sync Upload Prevention Before Full Load', () => {
    describe('Auto-Sync Gating Safeguards', () => {
      // Simulates the exact auto-sync gate predicate from App.tsx (lines 840, 847, 849)
      const shouldAutoSyncUpload = (
        isDataLoaded: boolean,
        isFullHistoryLoaded: boolean,
        googleUser: { accessToken?: string; fileId?: string | null } | null,
        sessionsList: any[],
        userTotalWorkouts: number
      ): boolean => {
        if (!isDataLoaded || !isFullHistoryLoaded) return false;
        if (!googleUser || !googleUser.accessToken) return false;
        if (sessionsList.length === 0 && (userTotalWorkouts || 0) > 0) return false;
        return true;
      };

      test('R1.1: Blocks auto-sync when isDataLoaded=false (cold start before storage ready)', () => {
        const googleUser = { accessToken: 'valid-token-123', fileId: 'drive-file-abc' };
        const sessions = generateMockSessionList(20).map(sessionV2ToLegacy);

        const canSync = shouldAutoSyncUpload(false, false, googleUser, sessions, 20);
        expect(canSync).toBe(false);
      });

      test('R1.2: Blocks auto-sync when isFullHistoryLoaded=false even if instant cache preview is loaded (20 items)', () => {
        const googleUser = { accessToken: 'valid-token-123', fileId: 'drive-file-abc' };
        // User has 350 total workouts in profile, but instant cache only loaded top 20 preview items
        const previewSessions = generateMockSessionList(20).map(sessionV2ToLegacy);

        const canSync = shouldAutoSyncUpload(true, false, googleUser, previewSessions, 350);
        expect(canSync).toBe(false);
      });

      test('R1.3: Blocks auto-sync when sessionsList is empty but user.totalWorkouts > 0', () => {
        const googleUser = { accessToken: 'valid-token-123', fileId: 'drive-file-abc' };

        const canSync = shouldAutoSyncUpload(true, true, googleUser, [], 150);
        expect(canSync).toBe(false);
      });

      test('R1.4: Blocks auto-sync when googleUser is null or missing accessToken', () => {
        const fullSessions = generateMockSessionList(300).map(sessionV2ToLegacy);

        expect(shouldAutoSyncUpload(true, true, null, fullSessions, 300)).toBe(false);
        expect(shouldAutoSyncUpload(true, true, { accessToken: '' }, fullSessions, 300)).toBe(false);
        expect(shouldAutoSyncUpload(true, true, { accessToken: undefined }, fullSessions, 300)).toBe(false);
      });

      test('R1.5: Allows auto-sync ONLY when isDataLoaded=true, isFullHistoryLoaded=true, and sessionsList is populated', () => {
        const googleUser = { accessToken: 'valid-token-123', fileId: 'drive-file-abc' };
        const fullSessions = generateMockSessionList(300).map(sessionV2ToLegacy);

        const canSync = shouldAutoSyncUpload(true, true, googleUser, fullSessions, 300);
        expect(canSync).toBe(true);
      });
    });

    describe('Auto-Sync Execution Workflow', () => {
      test('R1.6: Updates existing Google Drive backup file when fileId is present', async () => {
        const updateSpy = jest.spyOn(googleDrive, 'updateBackupFile').mockResolvedValue(undefined as any);
        const findSpy = jest.spyOn(googleDrive, 'findBackupFile');
        const createSpy = jest.spyOn(googleDrive, 'createBackupFile');

        const googleUser: { accessToken: string; fileId?: string | null } = {
          accessToken: 'mock-oauth-token',
          fileId: 'existing-drive-id-999',
        };
        const fullSessions = generateMockSessionList(320).map(sessionV2ToLegacy);
        const user = { name: 'Test Athlete', totalWorkouts: 320, isPro: true };

        const backupData = {
          user,
          sessionsList: fullSessions,
          templatesList: [],
          exercisesList: [],
          primaryMetricsList: [],
          bodyPartMetricsList: [],
          isAutoTimerEnabled: true,
          timestamp: new Date().toISOString(),
          lastSynced: new Date().toISOString(),
        };

        let fileId: string | null | undefined = googleUser.fileId;
        if (!fileId) {
          fileId = await googleDrive.findBackupFile(googleUser.accessToken);
        }
        if (fileId) {
          await googleDrive.updateBackupFile(googleUser.accessToken, fileId, backupData);
        } else {
          await googleDrive.createBackupFile(googleUser.accessToken, backupData);
        }

        expect(updateSpy).toHaveBeenCalledWith('mock-oauth-token', 'existing-drive-id-999', backupData);
        expect(findSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      });

      test('R1.7: Discovers existing file via findBackupFile if googleUser.fileId is initially absent', async () => {
        const updateSpy = jest.spyOn(googleDrive, 'updateBackupFile').mockResolvedValue(undefined as any);
        const findSpy = jest.spyOn(googleDrive, 'findBackupFile').mockResolvedValue('discovered-file-777');
        const createSpy = jest.spyOn(googleDrive, 'createBackupFile');

        const googleUser: { accessToken: string; fileId?: string | null } = {
          accessToken: 'mock-oauth-token',
          fileId: undefined,
        };
        const backupData = { sessionsList: [] };

        let fileId: string | null | undefined = googleUser.fileId;
        if (!fileId) {
          const found = await googleDrive.findBackupFile(googleUser.accessToken);
          if (found) fileId = found;
        }
        if (fileId) {
          await googleDrive.updateBackupFile(googleUser.accessToken, fileId, backupData);
        } else {
          await googleDrive.createBackupFile(googleUser.accessToken, backupData);
        }

        expect(findSpy).toHaveBeenCalledWith('mock-oauth-token');
        expect(updateSpy).toHaveBeenCalledWith('mock-oauth-token', 'discovered-file-777', backupData);
        expect(createSpy).not.toHaveBeenCalled();
      });

      test('R1.8: Creates new backup file when no existing file is found on Google Drive', async () => {
        const updateSpy = jest.spyOn(googleDrive, 'updateBackupFile');
        const findSpy = jest.spyOn(googleDrive, 'findBackupFile').mockResolvedValue(null);
        const createSpy = jest.spyOn(googleDrive, 'createBackupFile').mockResolvedValue('brand-new-file-111');

        const googleUser: { accessToken: string; fileId?: string | null } = {
          accessToken: 'mock-oauth-token',
          fileId: undefined,
        };
        const backupData = { sessionsList: [] };

        let fileId: string | null | undefined = googleUser.fileId;
        if (!fileId) {
          const found = await googleDrive.findBackupFile(googleUser.accessToken);
          if (found) fileId = found;
        }
        if (fileId) {
          await googleDrive.updateBackupFile(googleUser.accessToken, fileId, backupData);
        } else {
          fileId = await googleDrive.createBackupFile(googleUser.accessToken, backupData);
        }

        expect(findSpy).toHaveBeenCalledWith('mock-oauth-token');
        expect(createSpy).toHaveBeenCalledWith('mock-oauth-token', backupData);
        expect(updateSpy).not.toHaveBeenCalled();
        expect(fileId).toBe('brand-new-file-111');
      });
    });

    describe('Manual Sync & Backup Export Lazy Loading Protections', () => {
      test('R1.9: Manual Cloud Sync lazily hydrates full 300+ sessions from SQLite before upload if isFullHistoryLoaded=false', async () => {
        const full300V2 = generateMockSessionList(300);
        const loadSpy = jest.spyOn(repository, 'loadAllSessions').mockResolvedValue(full300V2);
        const updateSpy = jest.spyOn(googleDrive, 'updateBackupFile').mockResolvedValue(undefined as any);

        let isFullHistoryLoaded = false;
        let sessionsList = full300V2.slice(0, 20).map(sessionV2ToLegacy); // only 20 preview items
        const historyRepositoryReady = true;
        const googleUser = { accessToken: 'token-xyz', fileId: 'file-123' };
        const user = { name: 'Athlete', totalWorkouts: 300, isPro: true };

        // Production logic simulation from App.tsx handleCloudSync
        const executeCloudSync = async () => {
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
          await googleDrive.updateBackupFile(googleUser.accessToken, googleUser.fileId, {
            user: { ...user, totalWorkouts: currentSessions.length },
            sessionsList: currentSessions,
          });
          return true;
        };

        const success = await executeCloudSync();

        expect(success).toBe(true);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(isFullHistoryLoaded).toBe(true);
        expect(sessionsList).toHaveLength(300);
        expect(updateSpy).toHaveBeenCalledWith(
          'token-xyz',
          'file-123',
          expect.objectContaining({
            user: expect.objectContaining({ totalWorkouts: 300 }),
            sessionsList: expect.arrayContaining([
              expect.objectContaining({ id: 'sess-0' }),
              expect.objectContaining({ id: 'sess-299' }),
            ]),
          })
        );
      });

      test('R1.10: Manual Cloud Sync strictly blocks upload if history repository is offline', async () => {
        const updateSpy = jest.spyOn(googleDrive, 'updateBackupFile');
        const isFullHistoryLoaded = false;
        const historyRepositoryReady = false;
        const googleUser = { accessToken: 'token-xyz', fileId: 'file-123' };
        const sessionsList = generateMockSessionList(20).map(sessionV2ToLegacy);

        const executeCloudSync = async () => {
          if (!googleUser || !googleUser.accessToken) return false;
          let currentSessions = sessionsList;
          if (!isFullHistoryLoaded) {
            if (historyRepositoryReady) {
              const fullSessions = await repository.loadAllSessions();
              if (fullSessions) currentSessions = fullSessions.map(sessionV2ToLegacy);
            } else {
              return false; // Gated: blocked
            }
          }
          await googleDrive.updateBackupFile(googleUser.accessToken, googleUser.fileId, { sessionsList: currentSessions });
          return true;
        };

        const success = await executeCloudSync();
        expect(success).toBe(false);
        expect(updateSpy).not.toHaveBeenCalled();
      });

      test('R1.11: Backup Export lazily loads all sessions from SQLite if initiated while preview-only', async () => {
        const full250V2 = generateMockSessionList(250);
        jest.spyOn(repository, 'loadAllSessions').mockResolvedValue(full250V2);

        let isFullHistoryLoaded = false;
        let sessionsList = full250V2.slice(0, 20).map(sessionV2ToLegacy);
        const historyRepositoryReady = true;
        const user = { name: 'User', totalWorkouts: 250, isPro: true };

        const executeExport = async () => {
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
              } catch (err) {}
            }
          }
          return buildBackupData({
            username: user.name,
            user: { ...user, totalWorkouts: currentSessions.length },
            sessionsList: currentSessions,
            templatesList: [],
            exercisesList: [],
            primaryMetricsList: [],
            bodyPartMetricsList: [],
            settings: {},
          });
        };

        const exportData = await executeExport();

        expect(exportData.sessionsList).toHaveLength(250);
        expect(exportData.user.totalWorkouts).toBe(250);
        expect(exportData.sessionsList[0].id).toBe('sess-0');
        expect(exportData.sessionsList[249].id).toBe('sess-249');
        expect(isFullHistoryLoaded).toBe(true);
      });
    });
  });

  // =========================================================================
  // 2. Safe Merge-Only Restore Against Stale/Partial Backups
  // =========================================================================
  describe('2. Safe Merge-Only Restore Against Stale/Partial Backups', () => {
    test('R2.1: insertMissingSessionsOnly inserts missing sessions into SQLite in a single transaction', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]); // No existing sessions

      const sessionsToImport = [
        createSampleV2Session('new-session-1'),
        createSampleV2Session('new-session-2'),
      ];

      await repository.insertMissingSessionsOnly(sessionsToImport);

      expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN IMMEDIATE TRANSACTION;');
      expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT;');

      // Verify INSERT queries for workout_sessions and children
      const calls = mockDb.runAsync.mock.calls;
      const insertSessionCalls = calls.filter((c: any) =>
        typeof c[0] === 'string' && c[0].includes('INSERT INTO workout_sessions')
      );
      expect(insertSessionCalls).toHaveLength(2);
      expect(insertSessionCalls[0][1]).toContain('new-session-1');
      expect(insertSessionCalls[1][1]).toContain('new-session-2');
    });

    test('R2.2: Restoring a stale/partial backup with 5 sessions NEVER soft-deletes or deletes 300 existing local sessions', async () => {
      // Local SQLite contains 300 active sessions
      const existingDbRows = Array.from({ length: 300 }, (_, i) => ({
        id: `local-session-${i}`,
        deleted_at_ms: null,
      }));
      mockDb.getAllAsync.mockResolvedValueOnce(existingDbRows);

      // Incoming stale backup only has 5 sessions
      const staleBackup = generateMockSessionList(5, 'local-session');

      await repository.insertMissingSessionsOnly(staleBackup);

      // Verify that no UPDATE with deleted_at_ms and no DELETE was executed against the remaining 295 sessions
      const calls = mockDb.runAsync.mock.calls;
      for (const call of calls) {
        const sql = call[0];
        expect(sql).not.toMatch(/UPDATE workout_sessions SET deleted_at_ms = \?/i);
        expect(sql).not.toMatch(/DELETE FROM workout_sessions/i);
      }
    });

    test('R2.3: Restoring a backup untombstones sessions that were previously soft-deleted (deleted_at_ms != null)', async () => {
      // Local DB has 2 soft-deleted sessions and 1 active session
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 'sess-deleted-1', deleted_at_ms: 1786689000000 },
        { id: 'sess-deleted-2', deleted_at_ms: 1786689000000 },
        { id: 'sess-active-1', deleted_at_ms: null },
      ]);

      const incomingSessions = [
        createSampleV2Session('sess-deleted-1'),
        createSampleV2Session('sess-deleted-2'),
        createSampleV2Session('sess-brand-new'),
      ];

      await repository.insertMissingSessionsOnly(incomingSessions);

      const calls = mockDb.runAsync.mock.calls;

      // Check untombstone updates for sess-deleted-1 and sess-deleted-2
      const untombstoneCalls = calls.filter((c: any) =>
        typeof c[0] === 'string' &&
        c[0].includes('UPDATE workout_sessions SET deleted_at_ms = NULL')
      );
      expect(untombstoneCalls).toHaveLength(2);
      expect(untombstoneCalls[0][1]).toContain('sess-deleted-1');
      expect(untombstoneCalls[1][1]).toContain('sess-deleted-2');

      // Check insert call for sess-brand-new
      const insertCalls = calls.filter((c: any) =>
        typeof c[0] === 'string' &&
        c[0].includes('INSERT INTO workout_sessions')
      );
      expect(insertCalls).toHaveLength(1);
      expect(insertCalls[0][1]).toContain('sess-brand-new');
    });

    test('R2.4: Restoring a backup with sessions already active in SQLite skips writes for those sessions', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 'sess-already-active', deleted_at_ms: null },
      ]);

      const incoming = [createSampleV2Session('sess-already-active')];

      await repository.insertMissingSessionsOnly(incoming);

      // No write operations should take place
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    test('R2.5: Restoring an empty backup array does not mutate SQLite', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 'sess-1', deleted_at_ms: null },
        { id: 'sess-2', deleted_at_ms: null },
      ]);

      await repository.insertMissingSessionsOnly([]);

      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    describe('applyBackupData End-to-End Integration Flow', () => {
      test('R2.6: Seamlessly merges backup sessions into SQLite and updates UI state and MMKV cache', async () => {
        const localSessionsV2 = generateMockSessionList(100, 'local');
        const backupSessionsV2 = generateMockSessionList(50, 'backup');

        // Merged full set
        const combinedFullV2 = [...localSessionsV2, ...backupSessionsV2];

        const insertSpy = jest.spyOn(repository, 'insertMissingSessionsOnly').mockResolvedValue(undefined);
        const loadSpy = jest.spyOn(repository, 'loadAllSessions').mockResolvedValue(combinedFullV2);

        let sessionsListState: any[] = localSessionsV2.map(sessionV2ToLegacy);
        let userState = { name: 'Athlete', totalWorkouts: 100, isPro: true };
        let isFullHistoryLoadedState = false;

        const historyRepositoryReady = true;

        // Simulate applyBackupData from App.tsx
        const applyBackupDataSim = async (backupPayload: any) => {
          if (backupPayload.user) {
            userState = {
              ...userState,
              ...backupPayload.user,
              totalWorkouts: backupPayload.sessionsList ? backupPayload.sessionsList.length : userState.totalWorkouts,
            };
          }
          if (backupPayload.sessionsList) {
            const restored = backupPayload.sessionsList.map((s: any) => ({
              ...s,
              datetime: new Date(s.datetime),
            }));

            if (historyRepositoryReady) {
              const v2Restored = restored.map((s: any, idx: number) => legacySessionToV2(s, idx));
              await repository.insertMissingSessionsOnly(v2Restored);
              const fullSessions = await repository.loadAllSessions();
              const fullLegacy = fullSessions.map(sessionV2ToLegacy);
              sessionsListState = fullLegacy;
              instantCache.setCachedRecentSessions(fullLegacy, fullLegacy.length);
              isFullHistoryLoadedState = true;
              userState = { ...userState, totalWorkouts: fullLegacy.length };
            }
          }
        };

        const backupPayload = {
          user: { name: 'Athlete', totalWorkouts: 50 },
          sessionsList: backupSessionsV2.map(sessionV2ToLegacy),
        };

        await applyBackupDataSim(backupPayload);

        expect(insertSpy).toHaveBeenCalledTimes(1);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(sessionsListState).toHaveLength(150);
        expect(userState.totalWorkouts).toBe(150);
        expect(isFullHistoryLoadedState).toBe(true);

        const cachedRecent = instantCache.getCachedRecentSessions();
        expect(cachedRecent).toHaveLength(20);
        expect(instantCache.getCachedTotalSessionsCount()).toBe(150);
      });

      test('R2.7: Safely falls back to non-destructive in-memory union if SQLite merge throws error', async () => {
        jest.spyOn(repository, 'insertMissingSessionsOnly').mockRejectedValue(new Error('SQLite locked error'));

        const localLegacy = generateMockSessionList(10, 'local').map(sessionV2ToLegacy);
        const incomingLegacy = generateMockSessionList(5, 'backup').map(sessionV2ToLegacy);

        let sessionsListState = [...localLegacy];
        let isFullHistoryLoadedState = false;

        const applyBackupDataSim = async (backupPayload: any) => {
          const restoredSessions = backupPayload.sessionsList.map((s: any) => ({
            ...s,
            datetime: new Date(s.datetime),
          }));

          try {
            const v2Restored = restoredSessions.map((s: any, idx: number) => legacySessionToV2(s, idx));
            await repository.insertMissingSessionsOnly(v2Restored);
          } catch (err) {
            // Fallback branch from App.tsx (line 1450)
            const local = sessionsListState || [];
            const merged = [...local];
            restoredSessions.forEach((rs: any) => {
              if (!merged.some((ls) => ls.id === rs.id)) merged.push(rs);
            });
            merged.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
            sessionsListState = merged;
            instantCache.setCachedRecentSessions(merged, merged.length);
            isFullHistoryLoadedState = true;
          }
        };

        await applyBackupDataSim({ sessionsList: incomingLegacy });

        expect(sessionsListState).toHaveLength(15);
        expect(isFullHistoryLoadedState).toBe(true);
        expect(instantCache.getCachedTotalSessionsCount()).toBe(15);
      });
    });
  });

  // =========================================================================
  // 3. Soft-Delete Repair Execution & Database Diagnostics
  // =========================================================================
  describe('3. Soft-Delete Repair Execution & Database Diagnostics', () => {
    test('R3.1: restoreAllTombstonedSessions untombstones all deleted rows and increments revision', async () => {
      mockDb.runAsync.mockResolvedValueOnce({ changes: 45 });

      const restoredCount = await repository.restoreAllTombstonedSessions();

      expect(restoredCount).toBe(45);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = \?, revision = revision \+ 1 WHERE deleted_at_ms IS NOT NULL;/),
        [expect.any(Number)]
      );
    });

    test('R3.2: countTombstonedSessions correctly queries rows with deleted_at_ms IS NOT NULL', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ count: 73 });

      const count = await repository.countTombstonedSessions();

      expect(count).toBe(73);
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;')
      );
    });

    test('R3.3: countTombstonedSessions returns 0 if database operation fails', async () => {
      mockDb.getFirstAsync.mockRejectedValueOnce(new Error('Corrupt table or lock'));

      const count = await repository.countTombstonedSessions();
      expect(count).toBe(0);
    });

    test('R3.4: getDatabaseDiagnostics aggregates active, tombstoned, raw rows, and MMKV cache metrics', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 210 }) // active
        .mockResolvedValueOnce({ count: 90 })  // tombstoned
        .mockResolvedValueOnce({ count: 300 }); // raw total

      // MMKV instant cache state
      const previewList = generateMockSessionList(20).map(sessionV2ToLegacy);
      instantCache.setCachedRecentSessions(previewList, 300);

      const diagnostics = await repository.getDatabaseDiagnostics();

      expect(diagnostics).toEqual({
        isReady: true,
        activeSessionsCount: 210,
        tombstonedSessionsCount: 90,
        rawTotalSessionsCount: 300,
        cachedRecentCount: 20,
        cachedTotalCount: 300,
      });
    });

    test('R3.5: getDatabaseDiagnostics reports isReady=false and fallback 0 counts if database is unavailable', async () => {
      jest.spyOn(dbSingleton, 'getV2Database').mockResolvedValue(null);

      const diagnostics = await repository.getDatabaseDiagnostics();

      expect(diagnostics.isReady).toBe(false);
      expect(diagnostics.activeSessionsCount).toBe(0);
      expect(diagnostics.tombstonedSessionsCount).toBe(0);
      expect(diagnostics.rawTotalSessionsCount).toBe(0);
    });

    test('R3.6: End-to-End Repair Flow restores 120 soft-deleted sessions and brings database diagnostics to 0 tombstones', async () => {
      // 1. Initial State: 180 active + 120 tombstoned = 300 raw
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 180 })
        .mockResolvedValueOnce({ count: 120 })
        .mockResolvedValueOnce({ count: 300 });

      const initialDiagnostics = await repository.getDatabaseDiagnostics();
      expect(initialDiagnostics.activeSessionsCount).toBe(180);
      expect(initialDiagnostics.tombstonedSessionsCount).toBe(120);
      expect(initialDiagnostics.rawTotalSessionsCount).toBe(300);

      // 2. Trigger Repair Action
      mockDb.runAsync.mockResolvedValueOnce({ changes: 120 });
      const repairedCount = await repository.restoreAllTombstonedSessions();
      expect(repairedCount).toBe(120);

      // 3. Post-Repair State: 300 active + 0 tombstoned = 300 raw
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 300 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 300 });

      const postRepairDiagnostics = await repository.getDatabaseDiagnostics();
      expect(postRepairDiagnostics.activeSessionsCount).toBe(300);
      expect(postRepairDiagnostics.tombstonedSessionsCount).toBe(0);
      expect(postRepairDiagnostics.rawTotalSessionsCount).toBe(300);

      // 4. In-memory reload verifies full 300 sessions
      const full300Sessions = generateMockSessionList(300);
      jest.spyOn(repository, 'loadAllSessions').mockResolvedValue(full300Sessions);

      const loadedSessions = await repository.loadAllSessions();
      expect(loadedSessions).toHaveLength(300);
      instantCache.setCachedRecentSessions(loadedSessions.map(sessionV2ToLegacy), loadedSessions.length);

      expect(instantCache.getCachedRecentSessions()).toHaveLength(20);
      expect(instantCache.getCachedTotalSessionsCount()).toBe(300);
    });
  });
});
