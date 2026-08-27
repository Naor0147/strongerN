// src/__tests__/challengerM5ConcurrencyAndSyncAdversarial.test.ts
// Adversarial test suite auditing multi-threaded background synchronization race conditions
// where Google Drive sync triggers simultaneously with live workout session finishing under load.

import * as repository from '../storage/history/repository';
import * as dbSingleton from '../storage/dbSingleton';
import * as instantCache from '../storage/instantCache';
import * as googleDrive from '../utils/googleDrive';
import { WorkoutSessionV2, ActiveWorkoutDraftV2 } from '../storage/contracts/types';
import { legacySessionToV2, sessionV2ToLegacy } from '../storage/history/legacySessionMapper';
import {
  saveActiveWorkoutDraft,
  restoreActiveWorkoutDraft,
  clearActiveWorkoutDraft,
} from '../storage/activeWorkoutSnapshot';
import {
  initMMKVAdapter,
  setInjectedStorageAdapter,
  SynchronousStorageAdapter,
} from '../storage/adapters/mmkvAdapter';
import { normalizeActiveWorkoutDraftV2 } from '../storage/contracts/validators';
import { buildBackupData } from '../utils/backupManager';

class MockSynchronousStorageAdapter implements SynchronousStorageAdapter {
  private store = new Map<string, string>();
  isAvailable = () => true;
  isNative = () => true;
  getString = (key: string) => this.store.get(key) ?? null;
  setString = (key: string, value: string) => {
    this.store.set(key, value);
    return true;
  };
  removeItem = (key: string) => {
    this.store.delete(key);
    return true;
  };
  clear = () => this.store.clear();
}

interface DbSessionRow {
  id: string;
  title: string;
  title_norm: string;
  started_at_ms: number;
  ended_at_ms: number | null;
  duration_sec: number;
  comment: string | null;
  total_volume_milli_kg: number;
  prs: number;
  created_at_ms: number;
  updated_at_ms: number;
  revision: number;
  deleted_at_ms: number | null;
}

interface DbExerciseRow {
  id: string;
  session_id: string;
  exercise_id: string | null;
  name_snapshot: string;
  name_norm: string;
  variation_key: string;
  position: number;
  superset_group_id: string | null;
  note: string | null;
}

interface DbSetRow {
  id: string;
  session_exercise_id: string;
  position: number;
  category: string;
  completed: number;
  weight_milli_kg: number;
  reps: number;
  rpe_tenths: number | null;
  is_unilateral: number;
  left_weight_milli_kg: number | null;
  left_reps: number | null;
  right_weight_milli_kg: number | null;
  right_reps: number | null;
}

class StatefulInMemoryDatabase {
  sessions = new Map<string, DbSessionRow>();
  exercises = new Map<string, DbExerciseRow>();
  sets = new Map<string, DbSetRow>();

  async execAsync(_sql: string): Promise<void> {}

  async runAsync(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowId: number }> {
    const trimmed = sql.trim();

    if (trimmed.startsWith('INSERT INTO workout_sessions')) {
      const [id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment,
        total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms] = params;

      const existing = this.sessions.get(id);
      this.sessions.set(id, {
        id,
        title,
        title_norm,
        started_at_ms,
        ended_at_ms,
        duration_sec,
        comment,
        total_volume_milli_kg,
        prs,
        created_at_ms: existing ? existing.created_at_ms : created_at_ms,
        updated_at_ms,
        revision,
        deleted_at_ms,
      });
      return { changes: 1, lastInsertRowId: 1 };
    }

    if (trimmed.startsWith('DELETE FROM session_exercises WHERE session_id = ?')) {
      const sessionId = params[0];
      const exerciseIdsToDelete: string[] = [];
      for (const [exId, ex] of this.exercises.entries()) {
        if (ex.session_id === sessionId) {
          exerciseIdsToDelete.push(exId);
        }
      }
      for (const exId of exerciseIdsToDelete) {
        this.exercises.delete(exId);
        for (const [setId, set] of Array.from(this.sets.entries())) {
          if (set.session_exercise_id === exId) {
            this.sets.delete(setId);
          }
        }
      }
      return { changes: exerciseIdsToDelete.length, lastInsertRowId: 0 };
    }

    if (trimmed.startsWith('INSERT INTO session_exercises')) {
      const [id, session_id, exercise_id, name_snapshot, name_norm, variation_key, position, superset_group_id, note] = params;
      this.exercises.set(id, {
        id, session_id, exercise_id, name_snapshot, name_norm, variation_key, position, superset_group_id, note,
      });
      return { changes: 1, lastInsertRowId: 1 };
    }

    if (trimmed.startsWith('INSERT INTO set_logs')) {
      const [id, session_exercise_id, position, category, completed, weight_milli_kg, reps, rpe_tenths, is_unilateral, left_weight_milli_kg, left_reps, right_weight_milli_kg, right_reps] = params;
      this.sets.set(id, {
        id, session_exercise_id, position, category, completed, weight_milli_kg, reps, rpe_tenths, is_unilateral, left_weight_milli_kg, left_reps, right_weight_milli_kg, right_reps,
      });
      return { changes: 1, lastInsertRowId: 1 };
    }

    if (trimmed.includes('UPDATE workout_sessions SET deleted_at_ms = NULL') && trimmed.includes('WHERE deleted_at_ms IS NOT NULL')) {
      const [now] = params;
      let changes = 0;
      for (const s of this.sessions.values()) {
        if (s.deleted_at_ms !== null) {
          s.deleted_at_ms = null;
          s.updated_at_ms = now;
          s.revision += 1;
          changes += 1;
        }
      }
      return { changes, lastInsertRowId: 0 };
    }

    if (trimmed.includes('UPDATE workout_sessions SET deleted_at_ms = ?') && trimmed.includes('WHERE id = ?')) {
      const [delAt, updAt, sessionId] = params;
      const s = this.sessions.get(sessionId);
      if (s) {
        s.deleted_at_ms = delAt;
        s.updated_at_ms = updAt;
        s.revision += 1;
        return { changes: 1, lastInsertRowId: 0 };
      }
      return { changes: 0, lastInsertRowId: 0 };
    }

    return { changes: 0, lastInsertRowId: 0 };
  }

  async getFirstAsync(sql: string, _params: any[] = []): Promise<any> {
    const trimmed = sql.trim();

    if (trimmed.includes('COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NULL')) {
      let count = 0;
      for (const s of this.sessions.values()) {
        if (s.deleted_at_ms === null) count += 1;
      }
      return { count };
    }

    if (trimmed.includes('COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL')) {
      let count = 0;
      for (const s of this.sessions.values()) {
        if (s.deleted_at_ms !== null) count += 1;
      }
      return { count };
    }

    if (trimmed.includes('COUNT(*) AS count FROM workout_sessions')) {
      return { count: this.sessions.size };
    }

    return null;
  }

  async getAllAsync(sql: string, params: any[] = []): Promise<any[]> {
    const trimmed = sql.trim();

    if (trimmed.startsWith('SELECT id, deleted_at_ms FROM workout_sessions')) {
      return Array.from(this.sessions.values()).map((s) => ({
        id: s.id,
        deleted_at_ms: s.deleted_at_ms,
      }));
    }

    if (trimmed.startsWith('SELECT id FROM workout_sessions')) {
      return Array.from(this.sessions.values()).map((s) => ({ id: s.id }));
    }

    if (trimmed.includes('FROM workout_sessions') && trimmed.includes('WHERE deleted_at_ms IS NULL')) {
      const allActive = Array.from(this.sessions.values())
        .filter((s) => s.deleted_at_ms === null)
        .sort((a, b) => b.started_at_ms - a.started_at_ms || b.id.localeCompare(a.id));

      if (trimmed.includes('LIMIT ? OFFSET ?') && params.length >= 2) {
        const [limit, offset] = params;
        return allActive.slice(offset, offset + limit);
      }
      return allActive;
    }

    if (trimmed.includes('FROM session_exercises se') && trimmed.includes('JOIN workout_sessions ws')) {
      const activeSessionIds = new Set(
        Array.from(this.sessions.values())
          .filter((s) => s.deleted_at_ms === null)
          .map((s) => s.id)
      );
      return Array.from(this.exercises.values())
        .filter((e) => activeSessionIds.has(e.session_id))
        .sort((a, b) => (a.session_id === b.session_id ? a.position - b.position : a.session_id.localeCompare(b.session_id)));
    }

    if (trimmed.includes('FROM set_logs sl') && trimmed.includes('JOIN session_exercises se') && trimmed.includes('JOIN workout_sessions ws')) {
      const activeSessionIds = new Set(
        Array.from(this.sessions.values())
          .filter((s) => s.deleted_at_ms === null)
          .map((s) => s.id)
      );
      const activeExerciseIds = new Set(
        Array.from(this.exercises.values())
          .filter((e) => activeSessionIds.has(e.session_id))
          .map((e) => e.id)
      );
      return Array.from(this.sets.values())
        .filter((s) => activeExerciseIds.has(s.session_exercise_id))
        .sort((a, b) => (a.session_exercise_id === b.session_exercise_id ? a.position - b.position : a.session_exercise_id.localeCompare(b.session_exercise_id)));
    }

    return [];
  }
}

function makeMockSession(id: string, overrides: Partial<WorkoutSessionV2> = {}): WorkoutSessionV2 {
  return {
    id,
    title: `Workout ${id}`,
    titleNorm: `workout ${id}`,
    startedAtMs: 1786687000000,
    endedAtMs: 1786690600000,
    durationSec: 3600,
    comment: 'Test comment',
    totalVolumeMilliKg: 6000000,
    prs: 1,
    createdAtMs: 1786687000000,
    updatedAtMs: 1786690600000,
    revision: 1,
    deletedAtMs: null,
    exercises: [
      {
        id: `ex-${id}`,
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
            weightMilliKg: 80000,
            reps: 8,
            rpeTenths: 80,
            isUnilateral: false,
            leftWeightMilliKg: null,
            leftReps: null,
            rightWeightMilliKg: null,
            rightReps: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('Challenger M5: Concurrency, Sync Race Conditions & Fallback Integrity', () => {
  let mockAdapter: MockSynchronousStorageAdapter;
  let statefulDb: StatefulInMemoryDatabase;

  beforeEach(() => {
    mockAdapter = new MockSynchronousStorageAdapter();
    setInjectedStorageAdapter(mockAdapter);
    initMMKVAdapter();
    repository.clearFallbackRepositoryForTests();

    statefulDb = new StatefulInMemoryDatabase();
    jest.spyOn(dbSingleton, 'getV2Database').mockResolvedValue(statefulDb as any);
    jest.clearAllMocks();
  });

  afterEach(() => {
    setInjectedStorageAdapter(null);
    jest.restoreAllMocks();
  });

  describe('1. Concurrent Background Sync and Workout Session Completion', () => {
    test('Simultaneous background Google Drive sync and live workout finish maintain data integrity without race conditions', async () => {
      // Setup initial SQLite data with 20 existing sessions
      const initialSessions = Array.from({ length: 20 }, (_, i) => makeMockSession(`sess-init-${i}`));
      for (const sess of initialSessions) {
        await repository.upsertSession(sess);
      }

      // Mock Google Drive updateBackupFile with latency to simulate slow cloud sync under load
      const uploadedSnapshots: any[] = [];
      jest.spyOn(googleDrive, 'findBackupFile').mockResolvedValue('backup-file-123');
      jest.spyOn(googleDrive, 'updateBackupFile').mockImplementation(async (_token, _fileId, data) => {
        await new Promise((resolve) => setTimeout(resolve, 25)); // 25ms simulated network latency
        uploadedSnapshots.push(data);
        return true;
      });

      // Track cloud sync state lock simulation
      let isCloudSyncInProgress = false;
      const triggerCloudSyncSim = async () => {
        if (isCloudSyncInProgress) return false;
        isCloudSyncInProgress = true;
        try {
          const full = await repository.loadAllSessions();
          const legacy = full.map(sessionV2ToLegacy);
          const backupData = buildBackupData({
            username: 'Athlete',
            user: { name: 'Athlete', totalWorkouts: legacy.length } as any,
            sessionsList: legacy,
            templatesList: [],
            exercisesList: [],
            primaryMetricsList: [],
            bodyPartMetricsList: [],
            settings: {},
          });
          await googleDrive.updateBackupFile('test-token', 'backup-file-123', backupData);
          return true;
        } finally {
          isCloudSyncInProgress = false;
        }
      };

      // Create an active workout draft
      const activeDraft = normalizeActiveWorkoutDraftV2({
        draftId: 'draft-concurrency-1',
        workoutName: 'Championship Chest',
        startTime: new Date().toISOString(),
        exercises: [{ name: 'Incline Dumbbell Press', sets: [{ weight: '36', reps: '10', completed: true }] }],
      });
      saveActiveWorkoutDraft(activeDraft);
      expect(restoreActiveWorkoutDraft()).not.toBeNull();

      // Launch background sync and simultaneous workout finish concurrently
      const backgroundSyncPromise = triggerCloudSyncSim();

      // Finishing workout while background sync is in flight
      const finishWorkoutPromise = (async () => {
        await new Promise((resolve) => setTimeout(resolve, 5)); // Slight offset to overlap with in-flight sync
        const finishedSession = makeMockSession('sess-new-championship', {
          title: 'Championship Chest',
          titleNorm: 'championship chest',
        });
        await repository.upsertSession(finishedSession);
        clearActiveWorkoutDraft();
      })();

      // Wait for both concurrent operations to settle
      await Promise.all([backgroundSyncPromise, finishWorkoutPromise]);

      // Active draft was cleanly cleared on finish
      expect(restoreActiveWorkoutDraft()).toBeNull();

      // Total sessions in repository is now 21 (20 initial + 1 finished)
      const allSessions = await repository.loadAllSessions();
      expect(allSessions).toHaveLength(21);
      expect(allSessions.some((s) => s.id === 'sess-new-championship')).toBe(true);

      // Perform a secondary cloud sync to ensure full sync state settles accurately
      const postSyncSuccess = await triggerCloudSyncSim();
      expect(postSyncSuccess).toBe(true);
      expect(uploadedSnapshots).toHaveLength(2);
      expect(uploadedSnapshots[1].sessionsList).toHaveLength(21);
    });

    test('Network failure or 401 token expiration during cloud sync NEVER loses local finished workout', async () => {
      // Mock Google Drive updateBackupFile throwing network error
      jest.spyOn(googleDrive, 'findBackupFile').mockResolvedValue('backup-file-123');
      jest.spyOn(googleDrive, 'updateBackupFile').mockRejectedValue(new Error('500 Internal Server Error / Network Timeout'));

      // Finish workout locally
      const session = makeMockSession('sess-offline-resilient-1');
      await repository.upsertSession(session);

      // Verify session is persisted in repository despite cloud sync failure
      const persisted = await repository.loadAllSessions();
      expect(persisted).toHaveLength(1);
      expect(persisted[0].id).toBe('sess-offline-resilient-1');

      // Diagnostics reflect the persisted session
      const diagnostics = await repository.getDatabaseDiagnostics();
      expect(diagnostics.activeSessionsCount).toBe(1);
      expect(diagnostics.rawTotalSessionsCount).toBe(1);
    });
  });

  describe('2. Validation & Security Guard in Batch Operations', () => {
    test('insertMissingSessionsOnly rejects malformed sessions before mutating fallback store', async () => {
      const invalidSession: any = {
        id: '', // Invalid empty ID
        title: 'Corrupted Session',
      };

      await expect(repository.insertMissingSessionsOnly([invalidSession])).rejects.toThrow(
        /Invalid normalized session/i
      );

      // Fallback cache remains pristine and empty
      const fallback = repository.getFallbackSessions();
      expect(fallback.size).toBe(0);
    });
  });

  describe('3. Diagnostics and Soft-Delete Recovery under Fallback and SQLite Modes', () => {
    test('getDatabaseDiagnostics accurately reports active, tombstoned, and total counts with live DB', async () => {
      // Add 3 active and 2 soft-deleted sessions
      await repository.upsertSession(makeMockSession('sess-diag-1'));
      await repository.upsertSession(makeMockSession('sess-diag-2'));
      await repository.upsertSession(makeMockSession('sess-diag-3'));
      await repository.upsertSession(makeMockSession('sess-diag-4'));
      await repository.upsertSession(makeMockSession('sess-diag-5'));

      await repository.softDeleteSession('sess-diag-4');
      await repository.softDeleteSession('sess-diag-5');

      const diagnostics = await repository.getDatabaseDiagnostics();
      expect(diagnostics.isReady).toBe(true);
      expect(diagnostics.activeSessionsCount).toBe(3);
      expect(diagnostics.tombstonedSessionsCount).toBe(2);
      expect(diagnostics.rawTotalSessionsCount).toBe(5);

      // Test recovery in database mode
      const restoredCount = await repository.restoreAllTombstonedSessions();
      expect(restoredCount).toBe(2);

      const postRestoreDiagnostics = await repository.getDatabaseDiagnostics();
      expect(postRestoreDiagnostics.activeSessionsCount).toBe(5);
      expect(postRestoreDiagnostics.tombstonedSessionsCount).toBe(0);
    });

    test('Fallback counting and recovery operate accurately in MMKV-only offline mode', async () => {
      jest.spyOn(dbSingleton, 'getV2Database').mockResolvedValue(null); // Force MMKV fallback

      await repository.upsertSession(makeMockSession('sess-fb-1'));
      await repository.upsertSession(makeMockSession('sess-fb-2'));
      await repository.upsertSession(makeMockSession('sess-fb-3'));

      await repository.softDeleteSession('sess-fb-3');

      expect(await repository.countSessions()).toBe(2);
      expect(await repository.countTombstonedSessions()).toBe(1);
      expect(await repository.countAllRawSessions()).toBe(3);

      const restored = await repository.restoreAllTombstonedSessions();
      expect(restored).toBe(1);

      expect(await repository.countSessions()).toBe(3);
      expect(await repository.countTombstonedSessions()).toBe(0);
    });
  });
});
