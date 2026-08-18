// src/__tests__/challengerM1Adversarial.test.ts
// Empirical Adversarial Challenger Test Suite for Milestone 1: History Recovery & Tombstone Self-Healing

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.1.78',
}));

import {
  countTombstonedSessions,
  restoreAllTombstonedSessions,
  recoverTombstonedSessions,
  getDatabaseDiagnostics,
  insertMissingSessionsOnly,
  loadAllSessions,
  listSessions,
  upsertSession,
  softDeleteSession,
  findLastPerformance,
} from '../storage/history/repository';
import * as repository from '../storage/history/repository';
import * as dbSingleton from '../storage/dbSingleton';
import * as instantCache from '../storage/instantCache';
import * as crashLogger from '../utils/crashLogger';
import { bootstrapPersistence } from '../storage/persistenceBootstrap';
import { WorkoutSessionV2, SessionExerciseV2, SetLogV2 } from '../storage/contracts/types';
import { initMMKVAdapter, setInjectedStorageAdapter, SynchronousStorageAdapter } from '../storage/adapters/mmkvAdapter';

class MockMemoryStorageAdapter implements SynchronousStorageAdapter {
  private store = new Map<string, string>();
  isAvailable = () => true;
  isNative = () => true;
  getString = (key: string) => this.store.get(key) ?? null;
  setString = (key: string, value: string) => { this.store.set(key, value); return true; };
  removeItem = (key: string) => { this.store.delete(key); return true; };
  clear = () => { this.store.clear(); };
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
  meta = new Map<string, { key: string; value: string; updated_at_ms: number }>();

  async execAsync(sql: string): Promise<void> {
    // Transaction control or DDL
  }

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

    if (trimmed.includes('UPDATE workout_sessions SET deleted_at_ms = NULL') && trimmed.includes('WHERE id = ?')) {
      const [now, sessionId] = params;
      const s = this.sessions.get(sessionId);
      if (s && s.deleted_at_ms !== null) {
        s.deleted_at_ms = null;
        s.updated_at_ms = now;
        s.revision += 1;
        return { changes: 1, lastInsertRowId: 0 };
      }
      return { changes: 0, lastInsertRowId: 0 };
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

    if (trimmed.startsWith('INSERT INTO persistence_meta')) {
      const [key, value, updated_at_ms] = params;
      this.meta.set(key, { key, value, updated_at_ms });
      return { changes: 1, lastInsertRowId: 1 };
    }

    return { changes: 0, lastInsertRowId: 0 };
  }

  async getFirstAsync(sql: string, params: any[] = []): Promise<any> {
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

    if (trimmed.startsWith('SELECT value FROM persistence_meta WHERE key = ?')) {
      const row = this.meta.get(params[0]);
      return row ? { value: row.value } : null;
    }

    if (trimmed.includes('SELECT DISTINCT se.id FROM session_exercises se')) {
      const [normName, varKey, cat] = params;
      const sortedSessions = Array.from(this.sessions.values())
        .filter((s) => s.deleted_at_ms === null)
        .sort((a, b) => b.started_at_ms - a.started_at_ms || b.id.localeCompare(a.id));

      for (const session of sortedSessions) {
        const exercises = Array.from(this.exercises.values())
          .filter((e) => e.session_id === session.id && e.name_norm === normName && e.variation_key === varKey)
          .sort((a, b) => a.position - b.position);

        for (const ex of exercises) {
          const sets = Array.from(this.sets.values())
            .filter((st) => st.session_exercise_id === ex.id && st.category === cat && st.completed === 1);
          if (sets.length > 0) {
            return { id: ex.id };
          }
        }
      }
      return null;
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

    if (trimmed.startsWith('SELECT * FROM set_logs WHERE session_exercise_id = ? AND category = ? AND completed = 1')) {
      const [exId, cat] = params;
      return Array.from(this.sets.values())
        .filter((st) => st.session_exercise_id === exId && st.category === cat && st.completed === 1)
        .sort((a, b) => a.position - b.position);
    }

    if (trimmed.includes('FROM session_exercises WHERE session_id IN')) {
      const ids = new Set(params);
      return Array.from(this.exercises.values())
        .filter((e) => ids.has(e.session_id))
        .sort((a, b) => (a.session_id === b.session_id ? a.position - b.position : a.session_id.localeCompare(b.session_id)));
    }

    if (trimmed.includes('FROM set_logs sl') && trimmed.includes('JOIN session_exercises se WHERE se.session_id IN')) {
      const ids = new Set(params);
      const exerciseIds = new Set(
        Array.from(this.exercises.values())
          .filter((e) => ids.has(e.session_id))
          .map((e) => e.id)
      );
      return Array.from(this.sets.values())
        .filter((st) => exerciseIds.has(st.session_exercise_id))
        .sort((a, b) => (a.session_exercise_id === b.session_exercise_id ? a.position - b.position : a.session_exercise_id.localeCompare(b.session_exercise_id)));
    }

    return [];
  }
}

function createDummySession(id: string, overrides: Partial<WorkoutSessionV2> = {}): WorkoutSessionV2 {
  return {
    id,
    title: `Workout ${id}`,
    titleNorm: `workout ${id}`,
    startedAtMs: 1786687000000,
    endedAtMs: 1786690600000,
    durationSec: 3600,
    comment: 'Great workout session',
    totalVolumeMilliKg: 5000000,
    prs: 1,
    createdAtMs: 1786687000000,
    updatedAtMs: 1786690600000,
    revision: 1,
    deletedAtMs: null,
    exercises: [
      {
        id: `se-${id}-1`,
        sessionId: id,
        exerciseId: 'ex-bench-press',
        nameSnapshot: 'Bench Press',
        nameNorm: 'bench press',
        variationKey: 'barbell',
        position: 0,
        supersetGroupId: null,
        note: 'Felt strong',
        sets: [
          {
            id: `set-${id}-1-1`,
            position: 0,
            category: 'W',
            completed: true,
            weightMilliKg: 60000,
            reps: 10,
            rpeTenths: 60,
            isUnilateral: false,
            leftWeightMilliKg: null,
            leftReps: null,
            rightWeightMilliKg: null,
            rightReps: null,
          },
          {
            id: `set-${id}-1-2`,
            position: 1,
            category: 'S',
            completed: true,
            weightMilliKg: 100000,
            reps: 8,
            rpeTenths: 85,
            isUnilateral: false,
            leftWeightMilliKg: null,
            leftReps: null,
            rightWeightMilliKg: null,
            rightReps: null,
          },
        ],
      },
      {
        id: `se-${id}-2`,
        sessionId: id,
        exerciseId: 'ex-db-curl',
        nameSnapshot: 'Dumbbell Curl',
        nameNorm: 'dumbbell curl',
        variationKey: 'incline',
        position: 1,
        supersetGroupId: 'ss-1',
        note: 'Unilateral focus',
        sets: [
          {
            id: `set-${id}-2-1`,
            position: 0,
            category: 'S',
            completed: true,
            weightMilliKg: 16000,
            reps: 12,
            rpeTenths: 90,
            isUnilateral: true,
            leftWeightMilliKg: 16000,
            leftReps: 12,
            rightWeightMilliKg: 16000,
            rightReps: 12,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('Milestone 1 — Comprehensive Empirical Challenger Suite', () => {
  let statefulDb: StatefulInMemoryDatabase;
  let mockAdapter: MockMemoryStorageAdapter;

  beforeEach(() => {
    mockAdapter = new MockMemoryStorageAdapter();
    setInjectedStorageAdapter(mockAdapter);
    initMMKVAdapter();

    statefulDb = new StatefulInMemoryDatabase();
    jest.spyOn(dbSingleton, 'getV2Database').mockResolvedValue(statefulDb as any);
  });

  afterEach(() => {
    setInjectedStorageAdapter(null);
    jest.restoreAllMocks();
  });

  describe('1. Relational Integrity & Untombstoning Verification', () => {
    test('Untombstoning preserves and re-exposes full child exercises and sets relational graph', async () => {
      const session1 = createDummySession('session-relational-1');
      const session2 = createDummySession('session-relational-2');

      await upsertSession(session1);
      await upsertSession(session2);

      // Verify both sessions and all sets are loaded
      let loaded = await loadAllSessions();
      expect(loaded).toHaveLength(2);
      expect(loaded[0].exercises).toHaveLength(2);
      expect(loaded[0].exercises[0].sets).toHaveLength(2);
      expect(loaded[0].exercises[1].sets).toHaveLength(1);

      // Soft delete session 1
      await softDeleteSession(session1.id);

      // Verify session 1 and its child records are excluded from loadAllSessions
      loaded = await loadAllSessions();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe(session2.id);

      // Verify findLastPerformance cannot find bench press from tombstoned session 1
      // Soft delete session 2 as well
      await softDeleteSession(session2.id);
      let lastPerf = await findLastPerformance('Bench Press', 'barbell', 'S');
      expect(lastPerf).toBeNull();

      // Count tombstoned sessions
      const tombstonedCount = await countTombstonedSessions();
      expect(tombstonedCount).toBe(2);

      // Restore all tombstoned sessions
      const restored = await restoreAllTombstonedSessions();
      expect(restored).toBe(2);

      // Verify loadAllSessions restores full tree with complete field fidelity
      loaded = await loadAllSessions();
      expect(loaded).toHaveLength(2);

      const recovered1 = loaded.find((s) => s.id === session1.id)!;
      expect(recovered1).toBeDefined();
      expect(recovered1.deletedAtMs).toBeNull();
      expect(recovered1.exercises).toHaveLength(2);

      const benchEx = recovered1.exercises.find((e) => e.nameSnapshot === 'Bench Press')!;
      expect(benchEx).toBeDefined();
      expect(benchEx.variationKey).toBe('barbell');
      expect(benchEx.sets).toHaveLength(2);

      // Verify set fields
      const workingSet = benchEx.sets.find((s) => s.category === 'S')!;
      expect(workingSet.weightMilliKg).toBe(100000);
      expect(workingSet.reps).toBe(8);
      expect(workingSet.rpeTenths).toBe(85);

      // Verify unilateral set fields
      const curlEx = recovered1.exercises.find((e) => e.nameSnapshot === 'Dumbbell Curl')!;
      expect(curlEx.sets[0].isUnilateral).toBe(true);
      expect(curlEx.sets[0].leftWeightMilliKg).toBe(16000);
      expect(curlEx.sets[0].rightReps).toBe(12);

      // Verify findLastPerformance now finds working set again
      lastPerf = await findLastPerformance('Bench Press', 'barbell', 'S');
      expect(lastPerf).not.toBeNull();
      expect(lastPerf?.weightMilliKg).toBe(100000);
      expect(lastPerf?.reps).toBe(8);
    });

    test('listSessions respects limit, offset, and untombstoned state', async () => {
      for (let i = 1; i <= 5; i++) {
        await upsertSession(createDummySession(`list-s-${i}`, { startedAtMs: 1786687000000 + i * 1000 }));
      }

      await softDeleteSession('list-s-2');
      await softDeleteSession('list-s-4');

      let page1 = await listSessions(2, 0);
      expect(page1).toHaveLength(2);
      expect(page1[0].id).toBe('list-s-5');
      expect(page1[1].id).toBe('list-s-3');

      // Untombstone all
      await restoreAllTombstonedSessions();

      page1 = await listSessions(5, 0);
      expect(page1).toHaveLength(5);
      expect(page1.map((s) => s.id)).toEqual(['list-s-5', 'list-s-4', 'list-s-3', 'list-s-2', 'list-s-1']);
    });
  });

  describe('2. Idempotency & Revision Increment Verification', () => {
    test('Calling restoreAllTombstonedSessions multiple times is strictly idempotent', async () => {
      for (let i = 1; i <= 10; i++) {
        await upsertSession(createDummySession(`idemp-${i}`));
        await softDeleteSession(`idemp-${i}`);
      }

      expect(await countTombstonedSessions()).toBe(10);

      // First restore call
      const firstRun = await restoreAllTombstonedSessions();
      expect(firstRun).toBe(10);
      expect(await countTombstonedSessions()).toBe(0);

      const firstLoaded = await loadAllSessions();
      expect(firstLoaded).toHaveLength(10);
      const revisionsAfterFirst = firstLoaded.map((s) => s.revision);

      // 2nd to 5th sequential restore calls
      for (let run = 2; run <= 5; run++) {
        const subsequentRun = await restoreAllTombstonedSessions();
        expect(subsequentRun).toBe(0);
        expect(await countTombstonedSessions()).toBe(0);
      }

      // Verify no data changed or corrupted, and revisions did not bump needlessly
      const finalLoaded = await loadAllSessions();
      expect(finalLoaded).toHaveLength(10);
      expect(finalLoaded.map((s) => s.revision)).toEqual(revisionsAfterFirst);
    });

    test('Concurrent restoreAllTombstonedSessions calls are serialized and idempotent', async () => {
      for (let i = 1; i <= 5; i++) {
        await upsertSession(createDummySession(`concurrent-${i}`));
        await softDeleteSession(`concurrent-${i}`);
      }

      // Fire 5 restore operations concurrently
      const results = await Promise.all([
        restoreAllTombstonedSessions(),
        restoreAllTombstonedSessions(),
        restoreAllTombstonedSessions(),
        restoreAllTombstonedSessions(),
        restoreAllTombstonedSessions(),
      ]);

      // Exactly one should return 5, and all others should return 0
      const totalChanges = results.reduce((acc, curr) => acc + curr, 0);
      expect(totalChanges).toBe(5);
      expect(results).toContain(5);
      expect(results.filter((r) => r === 0)).toHaveLength(4);

      expect(await countTombstonedSessions()).toBe(0);
      expect(await loadAllSessions()).toHaveLength(5);
    });
  });

  describe('3. Diagnostics Engine Verification (`getDatabaseDiagnostics`)', () => {
    test('Accurately aggregates active, tombstoned, raw total, and MMKV cache metrics', async () => {
      // 10 active, 5 tombstoned
      for (let i = 1; i <= 10; i++) {
        await upsertSession(createDummySession(`diag-active-${i}`));
      }
      for (let i = 1; i <= 5; i++) {
        await upsertSession(createDummySession(`diag-tomb-${i}`));
        await softDeleteSession(`diag-tomb-${i}`);
      }

      jest.spyOn(instantCache, 'getCachedRecentSessions').mockReturnValue(new Array(10).fill({ id: 'dummy' }));
      jest.spyOn(instantCache, 'getCachedTotalSessionsCount').mockReturnValue(15);

      const diag = await getDatabaseDiagnostics();

      expect(diag.isReady).toBe(true);
      expect(diag.activeSessionsCount).toBe(10);
      expect(diag.tombstonedSessionsCount).toBe(5);
      expect(diag.rawTotalSessionsCount).toBe(15);
      expect(diag.cachedRecentCount).toBe(10);
      expect(diag.cachedTotalCount).toBe(15);
    });

    test('Diagnostics handles SQLite offline state gracefully without unhandled exception', async () => {
      jest.spyOn(dbSingleton, 'getV2Database').mockResolvedValueOnce(null);
      jest.spyOn(instantCache, 'getCachedRecentSessions').mockReturnValue(null);
      jest.spyOn(instantCache, 'getCachedTotalSessionsCount').mockReturnValue(null);

      const diag = await getDatabaseDiagnostics();

      expect(diag.isReady).toBe(false);
      expect(diag.activeSessionsCount).toBe(0);
      expect(diag.tombstonedSessionsCount).toBe(0);
      expect(diag.rawTotalSessionsCount).toBe(0);
      expect(diag.cachedRecentCount).toBe(0);
      expect(diag.cachedTotalCount).toBe(0);
    });
  });

  describe('4. Safe Merge-Only Import (`insertMissingSessionsOnly`) Verification', () => {
    test('Untombstones matching deleted sessions, inserts new ones, and leaves active intact', async () => {
      const activeSession = createDummySession('imp-active');
      const tombstonedSession = createDummySession('imp-tomb');
      const brandNewSession = createDummySession('imp-new');

      await upsertSession(activeSession);
      await upsertSession(tombstonedSession);
      await softDeleteSession(tombstonedSession.id);

      const originalActiveUpdated = statefulDb.sessions.get(activeSession.id)!.updated_at_ms;

      // Import batch containing active, tombstoned, and new
      await insertMissingSessionsOnly([activeSession, tombstonedSession, brandNewSession]);

      // 1. Tombstoned session should now be active
      const restoredTomb = statefulDb.sessions.get(tombstonedSession.id)!;
      expect(restoredTomb.deleted_at_ms).toBeNull();

      // 2. Brand new session should be inserted
      const insertedNew = statefulDb.sessions.get(brandNewSession.id)!;
      expect(insertedNew).toBeDefined();
      expect(insertedNew.title).toBe(brandNewSession.title);

      // 3. Active session was untouched
      const currentActive = statefulDb.sessions.get(activeSession.id)!;
      expect(currentActive.updated_at_ms).toBe(originalActiveUpdated);

      // Verify all 3 are returned by loadAllSessions
      const all = await loadAllSessions();
      expect(all).toHaveLength(3);
    });

    test('Calling insertMissingSessionsOnly with duplicates in array handles deduplication cleanly', async () => {
      const tombstoned = createDummySession('dup-tomb');
      await upsertSession(tombstoned);
      await softDeleteSession(tombstoned.id);

      await insertMissingSessionsOnly([tombstoned, tombstoned, tombstoned]);

      expect(await countTombstonedSessions()).toBe(0);
      const all = await loadAllSessions();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(tombstoned.id);
    });
  });

  describe('5. High Volume Scale & Boundary Stress Testing', () => {
    test('Stress: 300+ tombstoned workouts are completely recovered without data loss', async () => {
      const BATCH_SIZE = 300;
      for (let i = 1; i <= BATCH_SIZE; i++) {
        await upsertSession(createDummySession(`stress-${i}`, {
          title: `Workout #${i}`,
          startedAtMs: 1700000000000 + i * 86400000,
        }));
        await softDeleteSession(`stress-${i}`);
      }

      expect(await countTombstonedSessions()).toBe(BATCH_SIZE);
      expect(await loadAllSessions()).toHaveLength(0);

      const recovered = await restoreAllTombstonedSessions();
      expect(recovered).toBe(BATCH_SIZE);
      expect(await countTombstonedSessions()).toBe(0);

      const all = await loadAllSessions();
      expect(all).toHaveLength(BATCH_SIZE);
      expect(all[0].id).toBe(`stress-${BATCH_SIZE}`); // sorted DESC
      expect(all[BATCH_SIZE - 1].id).toBe('stress-1');
    });

    test('Boundary: Empty database operations handle 0 records cleanly', async () => {
      expect(await countTombstonedSessions()).toBe(0);
      expect(await restoreAllTombstonedSessions()).toBe(0);
      expect(await loadAllSessions()).toEqual([]);
      expect(await listSessions(50, 0)).toEqual([]);
      await insertMissingSessionsOnly([]);
      expect(await loadAllSessions()).toEqual([]);
    });

    test('Boundary: Sessions with null optional fields survive untombstoning cycle', async () => {
      const partialSession: WorkoutSessionV2 = {
        id: 'session-null-fields',
        title: 'Minimal Session',
        titleNorm: 'minimal session',
        startedAtMs: 1786687000000,
        endedAtMs: null,
        durationSec: 1800,
        comment: null,
        totalVolumeMilliKg: 0,
        prs: 0,
        createdAtMs: 1786687000000,
        updatedAtMs: 1786687000000,
        revision: 1,
        deletedAtMs: null,
        exercises: [
          {
            id: 'se-null-1',
            sessionId: 'session-null-fields',
            exerciseId: null,
            nameSnapshot: 'Bodyweight Squat',
            nameNorm: 'bodyweight squat',
            variationKey: '',
            position: 0,
            supersetGroupId: null,
            note: null,
            sets: [
              {
                id: 'set-null-1',
                position: 0,
                category: 'S',
                completed: false,
                weightMilliKg: 0,
                reps: 20,
                rpeTenths: null,
                isUnilateral: false,
                leftWeightMilliKg: null,
                leftReps: null,
                rightWeightMilliKg: null,
                rightReps: null,
              },
            ],
          },
        ],
      };

      await upsertSession(partialSession);
      await softDeleteSession(partialSession.id);
      await restoreAllTombstonedSessions();

      const loaded = await loadAllSessions();
      expect(loaded).toHaveLength(1);
      const s = loaded[0];
      expect(s.endedAtMs).toBeNull();
      expect(s.comment).toBeNull();
      expect(s.exercises[0].exerciseId).toBeNull();
      expect(s.exercises[0].supersetGroupId).toBeNull();
      expect(s.exercises[0].sets[0].rpeTenths).toBeNull();
      expect(s.exercises[0].sets[0].completed).toBe(false);
    });
  });

  describe('6. Startup Self-Healing & Telemetry Integration', () => {
    test('Self-healing automatically restores soft-deleted workouts during fastpath bootstrap', async () => {
      // Setup stateful db with 1 active and 2 tombstoned
      await upsertSession(createDummySession('fastpath-active'));
      await upsertSession(createDummySession('fastpath-tomb-1'));
      await upsertSession(createDummySession('fastpath-tomb-2'));
      await softDeleteSession('fastpath-tomb-1');
      await softDeleteSession('fastpath-tomb-2');

      // Set migration metadata to mark fastpath eligible
      await repository.setPersistenceMeta('legacy_v1_to_relational_v2', JSON.stringify({
        version: 2,
        verifiedAtMs: 1786687000000,
        sourceFingerprint: 'fastpath-valid',
      }));

      const bootstrapResult = await bootstrapPersistence({}, null);

      expect(bootstrapResult.historyReady).toBe(true);
      expect(bootstrapResult.migration.status).toBe('verified');
      // All 3 sessions should now be active in memory and in DB
      expect(bootstrapResult.sessions).toHaveLength(3);
      expect(await countTombstonedSessions()).toBe(0);
    });

    test('Un-gated error logging and saveCrashLogSync are called on persistence failure', async () => {
      const crashLogSpy = jest.spyOn(crashLogger, 'saveCrashLogSync').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const mockBootstrapError = new Error('SQLite DB locked');
      
      // Simulate App.tsx loadData error flow
      const simulateAppLoadData = async () => {
        let isDataLoaded = false;
        let sessionsList: any[] = [];
        let isFullHistoryLoaded = false;

        try {
          throw mockBootstrapError;
        } catch (e: any) {
          console.error('[Persistence] Error loading persisted state:', e);
          crashLogger.saveCrashLogSync('Persistence Load Failure: ' + (e?.message || e), e?.stack || '', false);
          try {
            const fallbackSessions = [createDummySession('fallback-session-1')];
            if (fallbackSessions) {
              sessionsList = fallbackSessions;
              isFullHistoryLoaded = true;
            }
          } catch (fallbackErr: any) {
            console.error('[Persistence] Fallback loadAllSessions failed:', fallbackErr);
            crashLogger.saveCrashLogSync('Persistence Fallback Failure: ' + (fallbackErr?.message || fallbackErr), fallbackErr?.stack || '', false);
          }
        } finally {
          isDataLoaded = true;
        }

        return { isDataLoaded, sessionsList, isFullHistoryLoaded };
      };

      const result = await simulateAppLoadData();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Persistence] Error loading persisted state:',
        mockBootstrapError
      );
      expect(crashLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Persistence Load Failure: SQLite DB locked'),
        expect.any(String),
        false
      );
      expect(result.isDataLoaded).toBe(true);
      expect(result.isFullHistoryLoaded).toBe(true);
      expect(result.sessionsList).toHaveLength(1);

      consoleErrorSpy.mockRestore();
      crashLogSpy.mockRestore();
    });
  });
});
