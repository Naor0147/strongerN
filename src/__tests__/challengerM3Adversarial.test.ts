// src/__tests__/challengerM3Adversarial.test.ts
// Empirical Challenger Stress & Adversarial Test Suite for Milestone 3 (State Save Decoupling & Delta Writes - R2)

import {
  initMMKVAdapter,
  setInjectedStorageAdapter,
  SynchronousStorageAdapter,
  DurableStorageUnavailableError,
} from '../storage/adapters/mmkvAdapter';
import {
  loadCompactSettings,
  saveCompactSettings,
  clearCompactSettings,
} from '../storage/compactSettings';
import { STORAGE_KEYS } from '../storage/keys';
import { AppSettingsCompactV2, WorkoutSessionV2 } from '../storage/contracts/types';
import * as repository from '../storage/history/repository';
import * as dbSingleton from '../storage/dbSingleton';
import { bootstrapPersistence } from '../storage/persistenceBootstrap';
import { buildBackupData } from '../utils/backupManager';
import { legacySessionToV2 } from '../storage/history/legacySessionMapper';

class MockMemoryStorageAdapter implements SynchronousStorageAdapter {
  readonly store = new Map<string, string>();
  available = true;
  native = true;
  shouldThrowOnGet = false;
  shouldThrowOnSet = false;
  shouldThrowOnRemove = false;

  isAvailable = () => this.available;
  isNative = () => this.native;

  getString = (key: string) => {
    if (this.shouldThrowOnGet) {
      throw new DurableStorageUnavailableError('Simulated MMKV read crash');
    }
    return this.store.get(key) ?? null;
  };

  setString = (key: string, value: string) => {
    if (this.shouldThrowOnSet) {
      throw new DurableStorageUnavailableError('Simulated MMKV write crash');
    }
    this.store.set(key, value);
    return true;
  };

  removeItem = (key: string) => {
    if (this.shouldThrowOnRemove) {
      throw new DurableStorageUnavailableError('Simulated MMKV remove crash');
    }
    this.store.delete(key);
    return true;
  };
}

class MockSqliteDb {
  inTransaction = false;
  tables = {
    workout_sessions: new Map<string, any>(),
    session_exercises: new Map<string, any>(),
    set_logs: new Map<string, any>(),
    persistence_meta: new Map<string, any>(),
  };
  savepointTables: any = null;
  failNextRun = false;

  async execAsync(sql: string) {
    if (sql.includes('BEGIN')) {
      this.inTransaction = true;
      this.savepointTables = {
        workout_sessions: new Map(this.tables.workout_sessions),
        session_exercises: new Map(this.tables.session_exercises),
        set_logs: new Map(this.tables.set_logs),
      };
    } else if (sql.includes('COMMIT')) {
      this.inTransaction = false;
      this.savepointTables = null;
    } else if (sql.includes('ROLLBACK')) {
      this.inTransaction = false;
      if (this.savepointTables) {
        this.tables.workout_sessions = new Map(this.savepointTables.workout_sessions);
        this.tables.session_exercises = new Map(this.savepointTables.session_exercises);
        this.tables.set_logs = new Map(this.savepointTables.set_logs);
        this.savepointTables = null;
      }
    }
  }

  async runAsync(sql: string, params: any[] = []) {
    if (this.failNextRun) {
      this.failNextRun = false;
      throw new Error('Simulated SQLite disk write failure');
    }

    if (sql.includes('INSERT INTO workout_sessions')) {
      const [id, title, titleNorm, startedAtMs, endedAtMs, durationSec, comment, totalVolumeMilliKg, prs, createdAtMs, updatedAtMs, revision, deletedAtMs] = params;
      this.tables.workout_sessions.set(id, {
        id,
        title,
        title_norm: titleNorm,
        started_at_ms: startedAtMs,
        ended_at_ms: endedAtMs,
        duration_sec: durationSec,
        comment,
        total_volume_milli_kg: totalVolumeMilliKg,
        prs,
        created_at_ms: createdAtMs,
        updated_at_ms: updatedAtMs,
        revision,
        deleted_at_ms: deletedAtMs,
      });
    } else if (sql.includes('DELETE FROM session_exercises WHERE session_id = ?')) {
      const sessionId = params[0];
      const exIdsToDelete: string[] = [];
      for (const [exId, ex] of this.tables.session_exercises) {
        if (ex.session_id === sessionId) exIdsToDelete.push(exId);
      }
      for (const exId of exIdsToDelete) {
        this.tables.session_exercises.delete(exId);
        const setIdsToDelete: string[] = [];
        for (const [sId, set] of this.tables.set_logs) {
          if (set.session_exercise_id === exId) setIdsToDelete.push(sId);
        }
        for (const sId of setIdsToDelete) this.tables.set_logs.delete(sId);
      }
    } else if (sql.includes('INSERT INTO session_exercises')) {
      const [id, sessionId, exerciseId, nameSnapshot, nameNorm, variationKey, position, supersetGroupId, note] = params;
      this.tables.session_exercises.set(id, {
        id,
        session_id: sessionId,
        exercise_id: exerciseId,
        name_snapshot: nameSnapshot,
        name_norm: nameNorm,
        variation_key: variationKey,
        position,
        superset_group_id: supersetGroupId,
        note,
      });
    } else if (sql.includes('INSERT INTO set_logs')) {
      const [id, sessionExerciseId, position, category, completed, weightMilliKg, reps, rpeTenths, isUnilateral, leftWeightMilliKg, leftReps, rightWeightMilliKg, rightReps] = params;
      this.tables.set_logs.set(id, {
        id,
        session_exercise_id: sessionExerciseId,
        position,
        category,
        completed,
        weight_milli_kg: weightMilliKg,
        reps,
        rpe_tenths: rpeTenths,
        is_unilateral: isUnilateral,
        left_weight_milli_kg: leftWeightMilliKg,
        leftReps: leftReps,
        right_weight_milli_kg: rightWeightMilliKg,
        right_reps: rightReps,
      });
    } else if (sql.includes('UPDATE workout_sessions SET deleted_at_ms =')) {
      const [deletedAtMs, updatedAtMs, sessionId] = params;
      const sess = this.tables.workout_sessions.get(sessionId);
      if (sess) {
        sess.deleted_at_ms = deletedAtMs;
        sess.updated_at_ms = updatedAtMs;
        sess.revision += 1;
      }
    }
  }

  async getAllAsync(sql: string, params: any[] = []) {
    if (sql.includes('FROM workout_sessions')) {
      return Array.from(this.tables.workout_sessions.values())
        .filter((s) => s.deleted_at_ms === null)
        .sort((a, b) => b.started_at_ms - a.started_at_ms);
    }
    if (sql.includes('FROM session_exercises')) {
      return Array.from(this.tables.session_exercises.values());
    }
    if (sql.includes('FROM set_logs')) {
      return Array.from(this.tables.set_logs.values());
    }
    return [];
  }

  async getFirstAsync(sql: string, params: any[] = []) {
    if (sql.includes('COUNT(*)')) {
      const count = Array.from(this.tables.workout_sessions.values()).filter((s) => s.deleted_at_ms === null).length;
      return { count };
    }
    return null;
  }
}

describe('Milestone 3 Challenger - Empirical Adversarial Test Suite', () => {
  let mockAdapter: MockMemoryStorageAdapter;
  let mockSqlite: MockSqliteDb;

  beforeEach(() => {
    mockAdapter = new MockMemoryStorageAdapter();
    setInjectedStorageAdapter(mockAdapter);
    initMMKVAdapter();

    mockSqlite = new MockSqliteDb();
    jest.spyOn(dbSingleton, 'getV2Database').mockResolvedValue(mockSqlite as any);

    jest.clearAllMocks();
  });

  afterEach(() => {
    setInjectedStorageAdapter(null);
    jest.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: Compact Settings Concurrency, Merging & Fallback Resilience
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 1: Compact Settings Stress & Fallback Resilience', () => {
    test('1.1 High-frequency rapid sequential mutations maintain data integrity across distinct keys', () => {
      const keysToMutate: Array<Partial<AppSettingsCompactV2>> = [
        { isAutoTimerEnabled: true },
        { defaultRestDuration: 45 },
        { appTheme: 'nord' },
        { customAccentColor: '#7C5CFC' },
        { soundVolume: 0.3 },
        { soundSetCompleted: 'beep' },
        { isProgressiveOverloadEnabled: true },
        { isRpeMode: false },
        { animationSpeed: 1.5 },
        { showAchievementBadges: true },
        { showHighlights: false },
        { isAutoFinishSetEnabled: true },
        { defaultRestDuration: 90 },
        { soundVolume: 0.8 },
        { appTheme: 'crimson' },
        { isRpeMode: true },
      ];

      for (const mutation of keysToMutate) {
        const success = saveCompactSettings(mutation);
        expect(success).toBe(true);
      }

      const finalSettings = loadCompactSettings();
      expect(finalSettings).not.toBeNull();
      expect(finalSettings?.isAutoTimerEnabled).toBe(true);
      expect(finalSettings?.defaultRestDuration).toBe(90);
      expect(finalSettings?.appTheme).toBe('crimson');
      expect(finalSettings?.customAccentColor).toBe('#7C5CFC');
      expect(finalSettings?.soundVolume).toBe(0.8);
      expect(finalSettings?.soundSetCompleted).toBe('beep');
      expect(finalSettings?.isProgressiveOverloadEnabled).toBe(true);
      expect(finalSettings?.isRpeMode).toBe(true);
      expect(finalSettings?.animationSpeed).toBe(1.5);
      expect(finalSettings?.showAchievementBadges).toBe(true);
      expect(finalSettings?.showHighlights).toBe(false);
      expect(finalSettings?.isAutoFinishSetEnabled).toBe(true);
    });

    test('1.2 Asynchronous concurrent updates resolve with all non-overlapping fields preserved', async () => {
      const writeTasks = [
        Promise.resolve().then(() => saveCompactSettings({ defaultRestDuration: 120 })),
        Promise.resolve().then(() => saveCompactSettings({ appTheme: 'emerald' })),
        Promise.resolve().then(() => saveCompactSettings({ soundVolume: 0.95 })),
        Promise.resolve().then(() => saveCompactSettings({ customAccentColor: '#00F0FF' })),
        Promise.resolve().then(() => saveCompactSettings({ isAutoTimerEnabled: false })),
      ];

      const results = await Promise.all(writeTasks);
      expect(results.every((r) => r === true)).toBe(true);

      const loaded = loadCompactSettings();
      expect(loaded).not.toBeNull();
      expect(loaded?.defaultRestDuration).toBe(120);
      expect(loaded?.appTheme).toBe('emerald');
      expect(loaded?.soundVolume).toBe(0.95);
      expect(loaded?.customAccentColor).toBe('#00F0FF');
      expect(loaded?.isAutoTimerEnabled).toBe(false);
    });

    test('1.3 Adversarial storage values (corrupt, array, number, boolean, empty) fail gracefully without throwing', () => {
      const adversarialValues = [
        '{ malformed json %$#@',
        '[1, 2, 3]',
        '"just a string"',
        '12345',
        'true',
        'null',
        '',
        '   ',
      ];

      for (const badVal of adversarialValues) {
        mockAdapter.setString(STORAGE_KEYS.SETTINGS_COMPACT_V2, badVal);
        expect(loadCompactSettings()).toBeNull();
      }
    });

    test('1.4 Uninitialized / unavailable storage adapter returns safe defaults without throwing', () => {
      mockAdapter.available = false;

      expect(loadCompactSettings()).toBeNull();
      expect(saveCompactSettings({ appTheme: 'amoled' })).toBe(false);
      expect(clearCompactSettings()).toBe(false);
    });

    test('1.5 Exception thrown inside MMKV adapter is caught and handled safely', () => {
      mockAdapter.shouldThrowOnGet = true;
      expect(loadCompactSettings()).toBeNull();

      mockAdapter.shouldThrowOnGet = false;
      mockAdapter.shouldThrowOnSet = true;
      expect(saveCompactSettings({ defaultRestDuration: 60 })).toBe(false);

      mockAdapter.shouldThrowOnSet = false;
      mockAdapter.shouldThrowOnRemove = true;
      expect(clearCompactSettings()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: Relational History Repository & Single-Session Delta Writes
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 2: Single-Session Delta Operations & Queue Reliability', () => {
    test('2.1 Single session upsert, update, soft delete, and undelete lifecycle on repository', async () => {
      // 1. Insert Session S1
      const s1 = createMockSession('session-alpha', 1, 10);
      await repository.upsertSession(s1);

      let loaded = await repository.loadAllSessions();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('session-alpha');
      expect(loaded[0].exercises[0].sets[0].reps).toBe(10);
      expect(await repository.countSessions()).toBe(1);

      // 2. Mutate / Update Session S1 (reps = 12, revision = 2)
      const s1Updated = createMockSession('session-alpha', 2, 12);
      await repository.upsertSession(s1Updated);

      loaded = await repository.loadAllSessions();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].revision).toBe(2);
      expect(loaded[0].exercises[0].sets[0].reps).toBe(12);

      // 3. Soft Delete Session S1
      await repository.softDeleteSession('session-alpha');

      loaded = await repository.loadAllSessions();
      expect(loaded).toHaveLength(0);
      expect(await repository.countSessions()).toBe(0);

      // 4. Re-upsert / Undelete Session S1 (revision = 3)
      const s1Revived = createMockSession('session-alpha', 3, 14);
      await repository.upsertSession(s1Revived);

      loaded = await repository.loadAllSessions();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('session-alpha');
      expect(loaded[0].revision).toBe(3);
      expect(loaded[0].exercises[0].sets[0].reps).toBe(14);
      expect(await repository.countSessions()).toBe(1);
    });

    test('2.2 Write queue maintains continuity and processes subsequent operations when an error occurs', async () => {
      const executedOps: string[] = [];

      // Valid op1
      const op1 = repository.upsertSession(createMockSession('valid-1')).then(() => {
        executedOps.push('op1');
      });

      // Invalid op2 (validation failure in writeSession)
      const invalidSession = {
        id: '',
        title: '',
      } as any;

      const op2 = repository.upsertSession(invalidSession).catch((err) => {
        executedOps.push('op2-failed');
        return err;
      });

      // Valid op3
      const op3 = repository.upsertSession(createMockSession('valid-2')).then(() => {
        executedOps.push('op3');
      });

      await Promise.all([op1, op2, op3]);

      expect(executedOps).toContain('op1');
      expect(executedOps).toContain('op2-failed');
      expect(executedOps).toContain('op3');

      // Both valid sessions should be loaded
      const loaded = await repository.loadAllSessions();
      const ids = loaded.map((s) => s.id);
      expect(ids).toContain('valid-1');
      expect(ids).toContain('valid-2');
      expect(ids).not.toContain('');
    });

    test('2.3 Transaction rollback on SQLite write failure prevents orphaned rows', async () => {
      // 1. Write an initial valid session
      const validS1 = createMockSession('session-atomic', 1, 10);
      await repository.upsertSession(validS1);

      let loaded = await repository.loadAllSessions();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].exercises[0].sets[0].reps).toBe(10);

      // 2. Trigger SQLite write failure during transaction
      mockSqlite.failNextRun = true;
      const mutatingS1 = createMockSession('session-atomic', 2, 99);
      
      await expect(repository.upsertSession(mutatingS1)).rejects.toThrow('Simulated SQLite disk write failure');

      // 3. Verify previous state was completely preserved by transaction rollback
      loaded = await repository.loadAllSessions();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].exercises[0].sets[0].reps).toBe(10);
    });

    test('2.4 Rapid sequential write storm (30 delta operations) maintains exact relational consistency', async () => {
      const operations: Promise<void>[] = [];

      for (let i = 0; i < 20; i++) {
        operations.push(repository.upsertSession(createMockSession(`storm-${i}`, 1, 8 + (i % 5))));
      }

      for (let i = 0; i < 10; i += 2) {
        operations.push(repository.softDeleteSession(`storm-${i}`));
      }

      await Promise.all(operations);

      const loaded = await repository.loadAllSessions();
      // Out of 20 upserted, 5 were soft-deleted (0, 2, 4, 6, 8) -> 15 remain
      expect(loaded).toHaveLength(15);
      expect(await repository.countSessions()).toBe(15);

      // Verify none of the deleted ones are present
      const loadedIds = new Set(loaded.map((s) => s.id));
      expect(loadedIds.has('storm-0')).toBe(false);
      expect(loadedIds.has('storm-2')).toBe(false);
      expect(loadedIds.has('storm-1')).toBe(true);
      expect(loadedIds.has('storm-3')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: Full Decoupling & Backup Assembly Integration
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 3: Full Decoupling & Backup Aggregation', () => {
    test('3.1 Decoupled settings and sessions assemble correctly into complete on-demand backup', () => {
      saveCompactSettings({
        appTheme: 'amoled',
        soundVolume: 0.85,
        defaultRestDuration: 100,
        isAutoTimerEnabled: true,
        customAccentColor: '#4F8EF7',
      });

      const decoupledSessions = [
        {
          id: 'sess-100',
          title: 'Upper Hypertrophy',
          datetime: new Date('2026-08-14T08:00:00Z'),
          durationMinutes: 65,
          totalVolumeKg: 7200,
          prs: 2,
          exercises: [],
        },
      ];

      const backup = buildBackupData({
        username: 'PowerAthlete',
        user: { name: 'PowerAthlete', isPro: true, totalWorkouts: 1 },
        sessionsList: decoupledSessions,
        templatesList: [{ id: 't1', name: 'Upper Body' }],
        exercisesList: [{ id: 'e1', name: 'Bench Press' }],
        primaryMetricsList: [{ id: 'm1', label: 'Weight', lastValue: '80' }],
        bodyPartMetricsList: [],
        settings: loadCompactSettings() || {},
      });

      expect(backup.version).toBe('strongern_backup_v2');
      expect(backup.username).toBe('PowerAthlete');
      expect(backup.sessionsList).toHaveLength(1);
      expect(backup.settings.appTheme).toBe('amoled');
      expect(backup.settings.soundVolume).toBe(0.85);
      expect(backup.settings.defaultRestDuration).toBe(100);
      expect(backup.settings.customAccentColor).toBe('#4F8EF7');
      expect(backup.settings.isAutoTimerEnabled).toBe(true);
    });

    test('3.2 bootstrapPersistence preserves fast-path when settings exist in MMKV and relational DB is verified', async () => {
      saveCompactSettings({
        appTheme: 'nord',
        defaultRestDuration: 90,
        isProgressiveOverloadEnabled: true,
      });

      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
      jest.spyOn(repository, 'getPersistenceMeta').mockResolvedValue(JSON.stringify({
        version: 2,
        sourceFingerprint: 'fast-path-fp',
        verifiedAtMs: 1786687000000,
      }));
      jest.spyOn(repository, 'loadAllSessions').mockResolvedValue([createMockSession('fast-1')]);

      const result = await bootstrapPersistence({ user: { name: 'FastUser' } }, null);

      expect(result.historyReady).toBe(true);
      expect(result.migration.status).toBe('verified');
      expect(result.settings?.appTheme).toBe('nord');
      expect(result.settings?.defaultRestDuration).toBe(90);
      expect(result.sessions).toHaveLength(1);
    });
  });
});

function createMockSession(id: string, revision = 1, setReps = 10): WorkoutSessionV2 {
  return {
    id,
    title: `Workout ${id}`,
    titleNorm: `workout ${id}`,
    startedAtMs: 1786687000000,
    endedAtMs: 1786690600000,
    durationSec: 3600,
    comment: 'Delta test comment',
    totalVolumeMilliKg: 5000000,
    prs: 1,
    createdAtMs: 1786687000000,
    updatedAtMs: 1786690600000,
    revision,
    deletedAtMs: null,
    exercises: [
      {
        id: `ex-${id}-1`,
        sessionId: id,
        exerciseId: 'cat-bench',
        nameSnapshot: 'Barbell Bench Press',
        nameNorm: 'barbell bench press',
        variationKey: 'paused',
        position: 0,
        supersetGroupId: null,
        note: 'Felt good',
        sets: [
          {
            id: `set-${id}-1-1`,
            position: 0,
            category: 'S',
            completed: true,
            weightMilliKg: 100000,
            reps: setReps,
            rpeTenths: 85,
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
}
