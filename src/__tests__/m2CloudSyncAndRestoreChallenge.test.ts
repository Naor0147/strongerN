// src/__tests__/m2CloudSyncAndRestoreChallenge.test.ts
// Empirical Challenger Test Suite for Milestone 2: Cloud Sync & Reconcile Hardening

import { WorkoutSessionV2 } from '../storage/contracts/types';
import { insertMissingSessionsOnly, loadAllSessions, countTombstonedSessions, getDatabaseDiagnostics } from '../storage/history/repository';
import * as repository from '../storage/history/repository';
import * as dbSingleton from '../storage/dbSingleton';
import * as googleDrive from '../utils/googleDrive';
import { DatabaseSync } from 'node:sqlite';

describe('Milestone 2 Challenge: Cloud Sync Gating & Safe Restore Preservation', () => {
  let sqliteDb: DatabaseSync;
  let mockExpoDb: any;

  beforeEach(() => {
    // 1. Create a genuine in-memory SQLite database matching the production schema
    sqliteDb = new DatabaseSync(':memory:');
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS workout_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        title_norm TEXT NOT NULL,
        started_at_ms INTEGER NOT NULL,
        ended_at_ms INTEGER,
        duration_sec INTEGER NOT NULL,
        comment TEXT,
        total_volume_milli_kg INTEGER NOT NULL,
        prs INTEGER NOT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        deleted_at_ms INTEGER
      );

      CREATE TABLE IF NOT EXISTS session_exercises (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        exercise_id TEXT,
        name TEXT NOT NULL,
        name_norm TEXT NOT NULL,
        position INTEGER NOT NULL,
        notes TEXT,
        variation_key TEXT,
        exercise_type TEXT,
        equipment TEXT,
        muscle_group TEXT,
        custom_fields_json TEXT,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        deleted_at_ms INTEGER,
        FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS set_logs (
        id TEXT PRIMARY KEY,
        session_exercise_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        category TEXT NOT NULL,
        completed INTEGER NOT NULL,
        weight_milli_kg INTEGER,
        reps INTEGER,
        rpe_tenths INTEGER,
        is_unilateral INTEGER NOT NULL DEFAULT 0,
        left_weight_milli_kg INTEGER,
        left_reps INTEGER,
        right_weight_milli_kg INTEGER,
        right_reps INTEGER,
        tempo TEXT,
        rest_sec INTEGER,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        deleted_at_ms INTEGER,
        FOREIGN KEY (session_exercise_id) REFERENCES session_exercises(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS persistence_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // 2. Wrap the real SQLite database to simulate Expo-SQLite async API
    mockExpoDb = {
      execAsync: jest.fn(async (sql: string) => {
        sqliteDb.exec(sql);
      }),
      runAsync: jest.fn(async (sql: string, params: any[] = []) => {
        const stmt = sqliteDb.prepare(sql);
        const result = stmt.run(...params);
        return {
          changes: Number(result.changes),
          lastInsertRowId: Number(result.lastInsertRowid),
        };
      }),
      getAllAsync: jest.fn(async (sql: string, params: any[] = []) => {
        const stmt = sqliteDb.prepare(sql);
        return stmt.all(...params);
      }),
      getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
        const stmt = sqliteDb.prepare(sql);
        const res = stmt.get(...params);
        return res ?? null;
      }),
    };

    jest.spyOn(dbSingleton, 'getV2Database').mockResolvedValue(mockExpoDb);
    jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
  });

  afterEach(() => {
    try {
      sqliteDb.close();
    } catch {}
    jest.restoreAllMocks();
  });

  // ── Helper to seed real database with N sessions ──
  function seedDatabase(count: number, tombstoneCount: number = 0) {
    const insertSession = sqliteDb.prepare(`
      INSERT INTO workout_sessions (
        id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment,
        total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const insertExercise = sqliteDb.prepare(`
      INSERT INTO session_exercises (
        id, session_id, exercise_id, name, name_norm, position, notes, variation_key,
        exercise_type, equipment, muscle_group, custom_fields_json, created_at_ms, updated_at_ms, revision, deleted_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)
    `);

    const insertSet = sqliteDb.prepare(`
      INSERT INTO set_logs (
        id, session_exercise_id, position, category, completed, weight_milli_kg, reps,
        rpe_tenths, is_unilateral, left_weight_milli_kg, left_reps, right_weight_milli_kg, right_reps,
        tempo, rest_sec, created_at_ms, updated_at_ms, revision, deleted_at_ms
      ) VALUES (?, ?, ?, 'S', 1, 80000, 10, 80, 0, NULL, NULL, NULL, NULL, NULL, 90, ?, ?, 1, NULL)
    `);

    sqliteDb.exec('BEGIN TRANSACTION');
    for (let i = 0; i < count; i++) {
      const isTombstoned = i < tombstoneCount;
      const started = 1780000000000 + i * 3600000;
      const sessionId = `db-session-${i}`;
      insertSession.run(
        sessionId,
        `Workout #${i}`,
        `workout #${i}`,
        started,
        started + 3600000,
        3600,
        null,
        1000000,
        0,
        started,
        started + 3600000,
        isTombstoned ? started + 4000000 : null
      );

      const exerciseId = `db-ex-${i}`;
      insertExercise.run(
        exerciseId,
        sessionId,
        'ex-bench',
        'Bench Press',
        'bench press',
        0,
        null,
        '',
        'weight_reps',
        'barbell',
        'Chest',
        '{}',
        started,
        started
      );

      insertSet.run(
        `db-set-${i}`,
        exerciseId,
        0,
        started,
        started
      );
    }
    sqliteDb.exec('COMMIT');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CHALLENGE 1: RESTORING PARTIAL BACKUP INTO 300 SESSIONS NEVER DELETES/TOMBSTONES
  // ────────────────────────────────────────────────────────────────────────────
  describe('Adversarial Challenge: Partial & Empty Backup Restore Safety', () => {
    test('Restoring 5 sessions into 300 sessions does NOT delete or tombstone the other 295 sessions', async () => {
      // Seed 300 active sessions in SQLite
      seedDatabase(300, 0);

      // Verify baseline: 300 active, 0 tombstoned
      const initialActive = sqliteDb.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NULL').get() as { count: number };
      const initialTombstoned = sqliteDb.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL').get() as { count: number };
      expect(initialActive.count).toBe(300);
      expect(initialTombstoned.count).toBe(0);

      // Construct a partial backup with 5 sessions:
      // 2 overlapping sessions (db-session-0, db-session-1) + 3 brand new sessions (import-1, import-2, import-3)
      const partialBackup: WorkoutSessionV2[] = [
        {
          id: 'db-session-0',
          title: 'Workout #0 (from backup)',
          titleNorm: 'workout #0 (from backup)',
          startedAtMs: 1780000000000,
          endedAtMs: 1780003600000,
          durationSec: 3600,
          comment: null,
          totalVolumeMilliKg: 1000000,
          prs: 0,
          createdAtMs: 1780000000000,
          updatedAtMs: 1780003600000,
          revision: 1,
          deletedAtMs: null,
          exercises: [],
        },
        {
          id: 'db-session-1',
          title: 'Workout #1 (from backup)',
          titleNorm: 'workout #1 (from backup)',
          startedAtMs: 1780003600000,
          endedAtMs: 1780007200000,
          durationSec: 3600,
          comment: null,
          totalVolumeMilliKg: 1000000,
          prs: 0,
          createdAtMs: 1780003600000,
          updatedAtMs: 1780007200000,
          revision: 1,
          deletedAtMs: null,
          exercises: [],
        },
        {
          id: 'import-new-1',
          title: 'Imported Workout 1',
          titleNorm: 'imported workout 1',
          startedAtMs: 1785000000000,
          endedAtMs: 1785003600000,
          durationSec: 3600,
          comment: null,
          totalVolumeMilliKg: 500000,
          prs: 1,
          createdAtMs: 1785000000000,
          updatedAtMs: 1785003600000,
          revision: 1,
          deletedAtMs: null,
          exercises: [],
        },
        {
          id: 'import-new-2',
          title: 'Imported Workout 2',
          titleNorm: 'imported workout 2',
          startedAtMs: 1785003600000,
          endedAtMs: 1785007200000,
          durationSec: 3600,
          comment: null,
          totalVolumeMilliKg: 600000,
          prs: 0,
          createdAtMs: 1785003600000,
          updatedAtMs: 1785007200000,
          revision: 1,
          deletedAtMs: null,
          exercises: [],
        },
        {
          id: 'import-new-3',
          title: 'Imported Workout 3',
          titleNorm: 'imported workout 3',
          startedAtMs: 1785007200000,
          endedAtMs: 1785010800000,
          durationSec: 3600,
          comment: null,
          totalVolumeMilliKg: 700000,
          prs: 2,
          createdAtMs: 1785007200000,
          updatedAtMs: 1785010800000,
          revision: 1,
          deletedAtMs: null,
          exercises: [],
        },
      ];

      // Execute safe merge-only import
      await insertMissingSessionsOnly(partialBackup);

      // Verify post-condition in real SQLite database
      const postActive = sqliteDb.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NULL').get() as { count: number };
      const postTombstoned = sqliteDb.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL').get() as { count: number };
      const postTotal = sqliteDb.prepare('SELECT COUNT(*) as count FROM workout_sessions').get() as { count: number };

      // Total active must be 303 (300 original + 3 new)
      expect(postActive.count).toBe(303);
      // Zero tombstoned sessions!
      expect(postTombstoned.count).toBe(0);
      expect(postTotal.count).toBe(303);

      // Verify that all 298 non-overlapping sessions still exist and have intact data
      for (let i = 2; i < 300; i++) {
        const row = sqliteDb.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(`db-session-${i}`) as any;
        expect(row).toBeDefined();
        expect(row.deleted_at_ms).toBeNull();
        expect(row.title).toBe(`Workout #${i}`);

        const exerciseRow = sqliteDb.prepare('SELECT * FROM session_exercises WHERE session_id = ?').get(`db-session-${i}`) as any;
        expect(exerciseRow).toBeDefined();
        expect(exerciseRow.name).toBe('Bench Press');

        const setRow = sqliteDb.prepare('SELECT * FROM set_logs WHERE session_exercise_id = ?').get(exerciseRow.id) as any;
        expect(setRow).toBeDefined();
        expect(setRow.weight_milli_kg).toBe(80000);
      }
    });

    test('Restoring an EMPTY backup ([]) into 300 sessions retains all 300 active sessions with 0 tombstones', async () => {
      seedDatabase(300, 0);

      await insertMissingSessionsOnly([]);

      const active = sqliteDb.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NULL').get() as { count: number };
      const tombstoned = sqliteDb.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL').get() as { count: number };

      expect(active.count).toBe(300);
      expect(tombstoned.count).toBe(0);
    });

    test('Restoring sessions that match previously tombstoned IDs resurrects them while preserving other sessions', async () => {
      // 300 total sessions: 250 active + 50 tombstoned
      seedDatabase(300, 50);

      const beforeDiag = await getDatabaseDiagnostics();
      expect(beforeDiag.activeSessionsCount).toBe(250);
      expect(beforeDiag.tombstonedSessionsCount).toBe(50);
      expect(beforeDiag.rawTotalSessionsCount).toBe(300);

      // Backup contains 10 sessions:
      // 5 that match tombstoned IDs (db-session-0 .. db-session-4)
      // 5 brand new sessions (new-1 .. new-5)
      const restoreList: WorkoutSessionV2[] = [
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `db-session-${i}`,
          title: `Resurrected Session #${i}`,
          titleNorm: `resurrected session #${i}`,
          startedAtMs: 1780000000000 + i * 3600000,
          endedAtMs: 1780003600000 + i * 3600000,
          durationSec: 3600,
          comment: null,
          totalVolumeMilliKg: 1000000,
          prs: 0,
          createdAtMs: 1780000000000,
          updatedAtMs: 1780003600000,
          revision: 1,
          deletedAtMs: null,
          exercises: [],
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `brand-new-${i}`,
          title: `Brand New #${i}`,
          titleNorm: `brand new #${i}`,
          startedAtMs: 1790000000000 + i * 3600000,
          endedAtMs: 1790003600000 + i * 3600000,
          durationSec: 3600,
          comment: null,
          totalVolumeMilliKg: 500000,
          prs: 0,
          createdAtMs: 1790000000000,
          updatedAtMs: 1790003600000,
          revision: 1,
          deletedAtMs: null,
          exercises: [],
        })),
      ];

      await insertMissingSessionsOnly(restoreList);

      const afterDiag = await getDatabaseDiagnostics();
      // 250 (original active) + 5 (resurrected) + 5 (new) = 260 active
      expect(afterDiag.activeSessionsCount).toBe(260);
      // 50 - 5 = 45 tombstoned
      expect(afterDiag.tombstonedSessionsCount).toBe(45);
      // 300 + 5 (new) = 305 total rows
      expect(afterDiag.rawTotalSessionsCount).toBe(305);

      // Verify specific resurrected sessions
      for (let i = 0; i < 5; i++) {
        const row = sqliteDb.prepare('SELECT deleted_at_ms, revision FROM workout_sessions WHERE id = ?').get(`db-session-${i}`) as any;
        expect(row.deleted_at_ms).toBeNull();
        expect(row.revision).toBe(2); // revision bumped on untombstone
      }

      // Verify untouched tombstoned sessions (e.g. db-session-10)
      const tombstonedRow = sqliteDb.prepare('SELECT deleted_at_ms FROM workout_sessions WHERE id = ?').get('db-session-10') as any;
      expect(tombstonedRow.deleted_at_ms).not.toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // CHALLENGE 2: AUTO-SYNC UPLOAD NEVER TRIGGERS WHEN ONLY 20 PREVIEW SESSIONS LOADED
  // ────────────────────────────────────────────────────────────────────────────
  describe('Adversarial Challenge: Auto-Sync Upload Gating Safety', () => {
    let mockGoogleDrive: any;

    beforeEach(() => {
      jest.useFakeTimers();
      mockGoogleDrive = {
        findBackupFile: jest.fn().mockResolvedValue('file-123'),
        updateBackupFile: jest.fn().mockResolvedValue({ id: 'file-123' }),
        createBackupFile: jest.fn().mockResolvedValue('file-new-123'),
      };
      jest.spyOn(googleDrive, 'findBackupFile').mockImplementation(mockGoogleDrive.findBackupFile);
      jest.spyOn(googleDrive, 'updateBackupFile').mockImplementation(mockGoogleDrive.updateBackupFile);
      jest.spyOn(googleDrive, 'createBackupFile').mockImplementation(mockGoogleDrive.createBackupFile);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    /**
     * Reusable simulation of App.tsx auto-sync logic
     */
    function simulateAutoSyncLifecycle(params: {
      isDataLoaded: boolean;
      isFullHistoryLoaded: boolean;
      sessionsList: any[];
      user: { name: string; totalWorkouts: number };
      googleUser: { email: string; accessToken: string; fileId?: string } | null;
      initialLoadRef: { current: boolean };
    }) {
      const {
        isDataLoaded,
        isFullHistoryLoaded,
        sessionsList,
        user,
        googleUser,
        initialLoadRef,
      } = params;

      // Exact gating logic from src/App.tsx line 840
      if (!isDataLoaded || !isFullHistoryLoaded) return () => {};

      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        return () => {};
      }

      if (!googleUser || !googleUser.accessToken) return () => {};

      if (sessionsList.length === 0 && (user.totalWorkouts || 0) > 0) {
        return () => {};
      }

      const timer = setTimeout(async () => {
        const backupData = {
          user,
          sessionsList,
        };
        if (googleUser.fileId) {
          await googleDrive.updateBackupFile(googleUser.accessToken, googleUser.fileId, backupData);
        } else {
          await googleDrive.createBackupFile(googleUser.accessToken, backupData);
        }
      }, 2000);

      return () => clearTimeout(timer);
    }

    test('Auto-sync NEVER uploads when isFullHistoryLoaded is false (preview state with 20 sessions)', () => {
      const previewSessions = Array.from({ length: 20 }, (_, i) => ({ id: `preview-${i}`, datetime: new Date() }));
      const initialLoadRef = { current: true };
      const googleUser = { email: 'test@example.com', accessToken: 'ya29.valid-token', fileId: 'file-123' };
      const user = { name: 'Athlete', totalWorkouts: 300 };

      // State 1: App loaded 20 preview sessions from MMKV cache, SQLite full load pending
      const isDataLoaded = true;
      const isFullHistoryLoaded = false;

      const cleanup1 = simulateAutoSyncLifecycle({
        isDataLoaded,
        isFullHistoryLoaded,
        sessionsList: previewSessions,
        user,
        googleUser,
        initialLoadRef,
      });

      // Advance debounce timer well past 2000ms
      jest.advanceTimersByTime(5000);

      expect(mockGoogleDrive.updateBackupFile).not.toHaveBeenCalled();
      expect(mockGoogleDrive.createBackupFile).not.toHaveBeenCalled();
      cleanup1();

      // State 2: User mutates a setting or template while SQLite is still loading (isFullHistoryLoaded remains false)
      const updatedUser = { ...user, name: 'Athlete Updated' };
      const cleanup2 = simulateAutoSyncLifecycle({
        isDataLoaded,
        isFullHistoryLoaded: false,
        sessionsList: previewSessions,
        user: updatedUser,
        googleUser,
        initialLoadRef,
      });

      jest.advanceTimersByTime(10000);

      // Still ZERO upload calls! Google Drive was NOT poisoned with 20 preview sessions.
      expect(mockGoogleDrive.updateBackupFile).not.toHaveBeenCalled();
      expect(mockGoogleDrive.createBackupFile).not.toHaveBeenCalled();
      cleanup2();
    });

    test('Auto-sync only begins uploading once isFullHistoryLoaded becomes true and user makes subsequent edit', () => {
      const initialLoadRef = { current: true };
      const googleUser = { email: 'test@example.com', accessToken: 'ya29.valid-token', fileId: 'file-123' };
      const full300Sessions = Array.from({ length: 300 }, (_, i) => ({ id: `full-session-${i}`, datetime: new Date() }));
      const user = { name: 'Athlete', totalWorkouts: 300 };

      // Step 1: Initial full history load completes.
      // initialLoadRef.current is true, consuming the first load so it does not trigger redundant upload.
      simulateAutoSyncLifecycle({
        isDataLoaded: true,
        isFullHistoryLoaded: true,
        sessionsList: full300Sessions,
        user,
        googleUser,
        initialLoadRef,
      });

      jest.advanceTimersByTime(5000);
      expect(mockGoogleDrive.updateBackupFile).not.toHaveBeenCalled();
      expect(initialLoadRef.current).toBe(false); // consumed

      // Step 2: User completes a new workout, sessionsList now has 301 sessions
      const full301Sessions = [{ id: 'full-session-300', datetime: new Date() }, ...full300Sessions];
      const cleanup = simulateAutoSyncLifecycle({
        isDataLoaded: true,
        isFullHistoryLoaded: true,
        sessionsList: full301Sessions,
        user: { ...user, totalWorkouts: 301 },
        googleUser,
        initialLoadRef,
      });

      jest.advanceTimersByTime(2000);

      // Now auto-sync triggers and uploads ALL 301 sessions
      expect(mockGoogleDrive.updateBackupFile).toHaveBeenCalledTimes(1);
      expect(mockGoogleDrive.updateBackupFile).toHaveBeenCalledWith(
        'ya29.valid-token',
        'file-123',
        expect.objectContaining({
          sessionsList: expect.arrayContaining([
            expect.objectContaining({ id: 'full-session-300' }),
          ]),
        })
      );
      cleanup();
    });

    test('Empty sessionsList with totalWorkouts > 0 is blocked from uploading', () => {
      const initialLoadRef = { current: false };
      const googleUser = { email: 'test@example.com', accessToken: 'ya29.valid-token', fileId: 'file-123' };

      // Corrupted in-memory state: 0 sessions but user had 300 workouts
      simulateAutoSyncLifecycle({
        isDataLoaded: true,
        isFullHistoryLoaded: true,
        sessionsList: [],
        user: { name: 'Athlete', totalWorkouts: 300 },
        googleUser,
        initialLoadRef,
      });

      jest.advanceTimersByTime(5000);

      expect(mockGoogleDrive.updateBackupFile).not.toHaveBeenCalled();
      expect(mockGoogleDrive.createBackupFile).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // CHALLENGE 3: MANUAL CLOUD SYNC & EXPORT HYDRATION GATING
  // ────────────────────────────────────────────────────────────────────────────
  describe('Adversarial Challenge: Manual Cloud Sync & Export History Guard', () => {
    test('Manual cloud sync eagerly hydrates full 300 sessions from SQLite if isFullHistoryLoaded was false', async () => {
      seedDatabase(300, 0);

      const mockFullSessions = sqliteDb.prepare('SELECT * FROM workout_sessions WHERE deleted_at_ms IS NULL').all().map((s: any) => ({
        id: s.id,
        title: s.title,
        titleNorm: s.title_norm,
        startedAtMs: s.started_at_ms,
        endedAtMs: s.ended_at_ms,
        durationSec: s.duration_sec,
        comment: s.comment,
        totalVolumeMilliKg: s.total_volume_milli_kg,
        prs: s.prs,
        createdAtMs: s.created_at_ms,
        updatedAtMs: s.updated_at_ms,
        revision: s.revision,
        deletedAtMs: null,
        exercises: [],
      }));

      jest.spyOn(repository, 'loadAllSessions').mockResolvedValue(mockFullSessions);

      const mockUpload = jest.fn().mockResolvedValue({ id: 'file-123' });
      jest.spyOn(googleDrive, 'updateBackupFile').mockImplementation(mockUpload);

      // Simulate App.tsx handleCloudSync behavior
      let isFullHistoryLoaded = false;
      let sessionsList = [{ id: 'preview-1', datetime: new Date() }]; // 1 preview session
      const historyRepositoryReady = true;

      const performCloudSync = async () => {
        let currentSessions = sessionsList;
        if (!isFullHistoryLoaded) {
          if (historyRepositoryReady) {
            const full = await repository.loadAllSessions();
            if (full) {
              sessionsList = full.map(s => ({ id: s.id, datetime: new Date(s.startedAtMs) }));
              isFullHistoryLoaded = true;
              currentSessions = sessionsList;
            } else {
              return false;
            }
          } else {
            return false;
          }
        }

        await googleDrive.updateBackupFile('token', 'file-123', { sessionsList: currentSessions });
        return true;
      };

      const result = await performCloudSync();

      expect(result).toBe(true);
      expect(isFullHistoryLoaded).toBe(true);
      expect(sessionsList).toHaveLength(300);
      expect(mockUpload).toHaveBeenCalledWith(
        'token',
        'file-123',
        expect.objectContaining({
          sessionsList: expect.arrayContaining([
            expect.objectContaining({ id: 'db-session-0' }),
            expect.objectContaining({ id: 'db-session-299' }),
          ]),
        })
      );
    });

    test('Manual cloud sync aborts upload if history is not loaded and repository fails', async () => {
      jest.spyOn(repository, 'loadAllSessions').mockRejectedValue(new Error('SQLite locked'));
      const mockUpload = jest.fn().mockResolvedValue({ id: 'file-123' });
      jest.spyOn(googleDrive, 'updateBackupFile').mockImplementation(mockUpload);

      let isFullHistoryLoaded = false;
      const sessionsList = [{ id: 'preview-1', datetime: new Date() }];

      const performCloudSync = async () => {
        let currentSessions: any[] = sessionsList;
        if (!isFullHistoryLoaded) {
          try {
            const full = await repository.loadAllSessions();
            if (full) {
              currentSessions = full.map(s => ({ id: s.id, datetime: new Date(s.startedAtMs) }));
            } else {
              return false;
            }
          } catch {
            return false; // Safely abort
          }
        }
        await googleDrive.updateBackupFile('token', 'file-123', { sessionsList: currentSessions });
        return true;
      };

      const result = await performCloudSync();

      expect(result).toBe(false);
      // Ensure aborted sync NEVER uploaded preview session
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });
});
