import { SQLiteDatabase } from 'expo-sqlite';
import { WorkoutSessionV2, SessionExerciseV2, SetLogV2, SetCategoryV2 } from '../contracts/types';
import { validateWorkoutSessionV2 } from '../contracts/validators';
import { getV2Database } from '../dbSingleton';
import { ensureHistorySchema } from './schema';
import { normalizeLookupKey } from './legacySessionMapper';
export { normalizeLookupKey };
import { getCachedRecentSessions, getCachedTotalSessionsCount, LifetimeStatsSummary, setCachedLifetimeStats, getCachedLifetimeStats, safeMmkvGet, safeMmkvSet } from '../instantCache';
import { STORAGE_KEYS } from '../keys';

export interface DatabaseDiagnostics {
  isReady: boolean;
  activeSessionsCount: number;
  tombstonedSessionsCount: number;
  rawTotalSessionsCount: number;
  cachedRecentCount: number;
  cachedTotalCount: number;
}

let initialized = false;
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback In-Memory / MMKV / LocalStorage Storage Adapter
// ─────────────────────────────────────────────────────────────────────────────
let fallbackSessionsCache: Map<string, WorkoutSessionV2> | null = null;
let fallbackMetaCache: Map<string, string> | null = null;

function loadFallbackSessionsFromDisk(): Map<string, WorkoutSessionV2> {
  const map = new Map<string, WorkoutSessionV2>();
  try {
    const raw = safeMmkvGet(STORAGE_KEYS.FALLBACK_SESSIONS_V2);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const s of list) {
          if (s && typeof s === 'object' && s.id) {
            map.set(s.id, s);
          }
        }
      }
    }
  } catch (e) {
    console.warn('[HistoryRepository] Error loading fallback sessions:', e);
  }
  return map;
}

export function getFallbackSessions(): Map<string, WorkoutSessionV2> {
  if (!fallbackSessionsCache) {
    fallbackSessionsCache = loadFallbackSessionsFromDisk();
  }
  return fallbackSessionsCache;
}

export function saveFallbackSessions(map: Map<string, WorkoutSessionV2>): void {
  fallbackSessionsCache = map;
  try {
    const arr = Array.from(map.values());
    safeMmkvSet(STORAGE_KEYS.FALLBACK_SESSIONS_V2, JSON.stringify(arr));
  } catch (e) {
    console.warn('[HistoryRepository] Error saving fallback sessions:', e);
  }
}

function getFallbackMetaCache(): Map<string, string> {
  if (!fallbackMetaCache) {
    fallbackMetaCache = new Map<string, string>();
    try {
      const raw = safeMmkvGet(STORAGE_KEYS.FALLBACK_PERSISTENCE_META_V2);
      if (raw) {
        const obj = JSON.parse(raw);
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === 'string') fallbackMetaCache.set(k, v);
        }
      }
    } catch {}
  }
  return fallbackMetaCache;
}

async function getOptionalDb(): Promise<SQLiteDatabase | null> {
  try {
    const db = await getV2Database();
    if (!db) return null;
    if (!initialized) {
      await ensureHistorySchema(db);
      initialized = true;
    }
    return db;
  } catch (e) {
    return null;
  }
}

async function requireDb(): Promise<SQLiteDatabase> {
  const db = await getV2Database();
  if (!db) throw new Error('Normalized history database is unavailable');
  if (!initialized) {
    await ensureHistorySchema(db);
    initialized = true;
  }
  return db;
}

async function transaction<T>(db: SQLiteDatabase, operation: () => Promise<T>): Promise<T> {
  await db.execAsync('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = await operation();
    await db.execAsync('COMMIT;');
    return result;
  } catch (error) {
    try { await db.execAsync('ROLLBACK;'); } catch {}
    throw error;
  }
}

async function writeSession(db: SQLiteDatabase, session: WorkoutSessionV2): Promise<void> {
  const validation = validateWorkoutSessionV2(session);
  if (!validation.success) throw new Error(`Invalid normalized session: ${validation.error}`);

  await db.runAsync(
    `INSERT INTO workout_sessions (
      id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment,
      total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, title_norm=excluded.title_norm, started_at_ms=excluded.started_at_ms,
      ended_at_ms=excluded.ended_at_ms, duration_sec=excluded.duration_sec, comment=excluded.comment,
      total_volume_milli_kg=excluded.total_volume_milli_kg, prs=excluded.prs,
      updated_at_ms=excluded.updated_at_ms, revision=excluded.revision, deleted_at_ms=excluded.deleted_at_ms;`,
    [session.id, session.title, session.titleNorm, session.startedAtMs, session.endedAtMs,
      session.durationSec, session.comment, session.totalVolumeMilliKg, session.prs,
      session.createdAtMs, session.updatedAtMs, session.revision, session.deletedAtMs]
  );
  await db.runAsync('DELETE FROM session_exercises WHERE session_id = ?;', [session.id]);

  for (const exercise of session.exercises) {
    await db.runAsync(
      `INSERT INTO session_exercises (
        id, session_id, exercise_id, name_snapshot, name_norm, variation_key,
        position, superset_group_id, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [exercise.id, session.id, exercise.exerciseId, exercise.nameSnapshot, exercise.nameNorm,
        exercise.variationKey, exercise.position, exercise.supersetGroupId, exercise.note]
    );
    for (const set of exercise.sets) {
      await db.runAsync(
        `INSERT INTO set_logs (
          id, session_exercise_id, position, category, completed, weight_milli_kg, reps,
          rpe_tenths, is_unilateral, left_weight_milli_kg, left_reps,
          right_weight_milli_kg, right_reps
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [set.id, exercise.id, set.position, set.category, set.completed ? 1 : 0,
          set.weightMilliKg, set.reps, set.rpeTenths, set.isUnilateral ? 1 : 0,
          set.leftWeightMilliKg, set.leftReps, set.rightWeightMilliKg, set.rightReps]
      );
    }
  }
}

export async function initHistoryRepository(): Promise<boolean> {
  try {
    const db = await getOptionalDb();
    if (db) return true;
    getFallbackSessions();
    return true;
  } catch (error) {
    console.error('[HistoryRepository] Initialization fallback ready:', error);
    return true;
  }
}

export function upsertSession(session: WorkoutSessionV2): Promise<void> {
  return enqueueWrite(async () => {
    const validation = validateWorkoutSessionV2(session);
    if (!validation.success) throw new Error(`Invalid normalized session: ${validation.error}`);

    // Update fallback memory & storage
    const fallback = getFallbackSessions();
    fallback.set(session.id, session);
    saveFallbackSessions(fallback);

    const db = await getOptionalDb();
    if (db) {
      await transaction(db, () => writeSession(db, session));
    }
  });
}

export function reconcileSessions(sessions: WorkoutSessionV2[]): Promise<void> {
  return enqueueWrite(async () => {
    const fallback = getFallbackSessions();
    const newIds = new Set(sessions.map(s => s.id));
    const now = Date.now();
    for (const session of sessions) {
      fallback.set(session.id, session);
    }
    for (const [id, s] of fallback.entries()) {
      if (!newIds.has(id) && !s.deletedAtMs) {
        s.deletedAtMs = now;
        s.updatedAtMs = now;
        s.revision = (s.revision || 1) + 1;
      }
    }
    saveFallbackSessions(fallback);

    const db = await getOptionalDb();
    if (db) {
      await transaction(db, async () => {
        for (const session of sessions) await writeSession(db, session);
        const ids = sessions.map((session) => session.id);
        if (ids.length === 0) {
          await db.runAsync('UPDATE workout_sessions SET deleted_at_ms = ? WHERE deleted_at_ms IS NULL;', [now]);
        } else {
          const placeholders = ids.map(() => '?').join(',');
          await db.runAsync(
            `UPDATE workout_sessions SET deleted_at_ms = ? WHERE deleted_at_ms IS NULL AND id NOT IN (${placeholders});`,
            [now, ...ids]
          );
        }
      });
    }
  });
}

export function bulkImportSessions(sessions: WorkoutSessionV2[]): Promise<void> {
  return enqueueWrite(async () => {
    for (let i = 0; i < sessions.length; i++) {
      const v = validateWorkoutSessionV2(sessions[i]);
      if (!v.success) throw new Error(`Invalid normalized session at index ${i}: ${v.error}`);
    }

    const fallback = getFallbackSessions();
    for (const s of sessions) {
      fallback.set(s.id, s);
    }
    saveFallbackSessions(fallback);

    const db = await getOptionalDb();
    if (db) {
      if (sessions.length < 60) {
        await transaction(db, async () => {
          for (const session of sessions) await writeSession(db, session);
        });
      } else {
        await bulkImportSessionsBatched(sessions, db);
      }
    }
  });
}

async function bulkImportSessionsBatched(sessions: WorkoutSessionV2[], db: SQLiteDatabase): Promise<void> {
  await transaction(db, async () => {
    // Batch workout_sessions 50 rows per INSERT (50*13=650 <999)
    for (let i = 0; i < sessions.length; i += 50) {
      const chunk = sessions.slice(i, i + 50);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
      const values: any[] = [];
      for (const s of chunk) {
        values.push(s.id, s.title, s.titleNorm, s.startedAtMs, s.endedAtMs, s.durationSec, s.comment, s.totalVolumeMilliKg, s.prs, s.createdAtMs, s.updatedAtMs, s.revision, s.deletedAtMs);
      }
      await db.runAsync(
        `INSERT INTO workout_sessions (id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment, total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms) VALUES ${placeholders} ON CONFLICT(id) DO UPDATE SET title=excluded.title, title_norm=excluded.title_norm, started_at_ms=excluded.started_at_ms, ended_at_ms=excluded.ended_at_ms, duration_sec=excluded.duration_sec, comment=excluded.comment, total_volume_milli_kg=excluded.total_volume_milli_kg, prs=excluded.prs, updated_at_ms=excluded.updated_at_ms, revision=excluded.revision, deleted_at_ms=excluded.deleted_at_ms;`,
        values
      );
    }
    // Collect exercises and sets for batched inserts
    const allEx: any[] = [];
    const allSets: any[] = [];
    const sessionIds: string[] = [];
    for (const s of sessions) {
      sessionIds.push(s.id);
      for (const ex of s.exercises) {
        allEx.push([ex.id, s.id, ex.exerciseId, ex.nameSnapshot, ex.nameNorm, ex.variationKey, ex.position, ex.supersetGroupId, ex.note]);
        for (const st of ex.sets) {
          allSets.push([st.id, ex.id, st.position, st.category, st.completed ? 1 : 0, st.weightMilliKg, st.reps, st.rpeTenths, st.isUnilateral ? 1 : 0, st.leftWeightMilliKg, st.leftReps, st.rightWeightMilliKg, st.rightReps]);
        }
      }
    }
    if (sessionIds.length > 0) {
      // Delete existing exercises for these sessions (seed is new but keep for idempotency, batched)
      for (let i = 0; i < sessionIds.length; i += 180) {
        const chunk = sessionIds.slice(i, i + 180);
        const ph = chunk.map(() => '?').join(',');
        await db.runAsync(`DELETE FROM session_exercises WHERE session_id IN (${ph});`, chunk);
      }
    }
    for (let i = 0; i < allEx.length; i += 90) {
      const chunk = allEx.slice(i, i + 90);
      const ph = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
      const vals = chunk.flat();
      await db.runAsync(`INSERT INTO session_exercises (id, session_id, exercise_id, name_snapshot, name_norm, variation_key, position, superset_group_id, note) VALUES ${ph};`, vals);
    }
    for (let i = 0; i < allSets.length; i += 70) {
      const chunk = allSets.slice(i, i + 70);
      const ph = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
      const vals = chunk.flat();
      await db.runAsync(`INSERT INTO set_logs (id, session_exercise_id, position, category, completed, weight_milli_kg, reps, rpe_tenths, is_unilateral, left_weight_milli_kg, left_reps, right_weight_milli_kg, right_reps) VALUES ${ph};`, vals);
    }
  });
}

export function softDeleteSession(sessionId: string): Promise<void> {
  return enqueueWrite(async () => {
    const fallback = getFallbackSessions();
    const s = fallback.get(sessionId);
    const now = Date.now();
    if (s) {
      s.deletedAtMs = now;
      s.updatedAtMs = now;
      s.revision = (s.revision || 1) + 1;
      saveFallbackSessions(fallback);
    }

    const db = await getOptionalDb();
    if (db) {
      await db.runAsync(
        'UPDATE workout_sessions SET deleted_at_ms = ?, updated_at_ms = ?, revision = revision + 1 WHERE id = ?;',
        [now, now, sessionId]
      );
    }
  });
}

function mapSetRow(row: any): SetLogV2 {
  return {
    id: row.id,
    position: row.position,
    category: row.category as SetCategoryV2,
    completed: row.completed === 1,
    weightMilliKg: row.weight_milli_kg,
    reps: row.reps,
    rpeTenths: row.rpe_tenths ?? null,
    isUnilateral: row.is_unilateral === 1,
    leftWeightMilliKg: row.left_weight_milli_kg ?? null,
    leftReps: row.left_reps ?? null,
    rightWeightMilliKg: row.right_weight_milli_kg ?? null,
    rightReps: row.right_reps ?? null,
  };
}

export function clearFallbackRepositoryForTests(): void {
  fallbackSessionsCache = new Map();
  fallbackMetaCache = new Map();
}

export async function loadAllSessions(): Promise<WorkoutSessionV2[]> {
  const db = await getOptionalDb();
  if (db) {
    const sessionRows: any[] = await db.getAllAsync(
      `SELECT id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment,
              total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms
       FROM workout_sessions
       WHERE deleted_at_ms IS NULL
       ORDER BY started_at_ms DESC, id DESC;`
    );

    if (sessionRows.length === 0) return [];

    const [exerciseRows, setRows]: [any[], any[]] = await Promise.all([
      db.getAllAsync(
        `SELECT se.id, se.session_id, se.exercise_id, se.name_snapshot, se.name_norm,
                se.variation_key, se.position, se.superset_group_id, se.note
         FROM session_exercises se
         JOIN workout_sessions ws ON ws.id = se.session_id
         WHERE ws.deleted_at_ms IS NULL
         ORDER BY se.session_id, se.position;`
      ),
      db.getAllAsync(
        `SELECT sl.* FROM set_logs sl
         JOIN session_exercises se ON se.id = sl.session_exercise_id
         JOIN workout_sessions ws ON ws.id = se.session_id
         WHERE ws.deleted_at_ms IS NULL
         ORDER BY sl.session_exercise_id, sl.position;`
      ),
    ]);

    const setsByExercise = new Map<string, SetLogV2[]>();
    for (let i = 0; i < setRows.length; i++) {
      const row = setRows[i];
      let list = setsByExercise.get(row.session_exercise_id);
      if (!list) {
        list = [];
        setsByExercise.set(row.session_exercise_id, list);
      }
      list.push(mapSetRow(row));
    }

    const exercisesBySession = new Map<string, SessionExerciseV2[]>();
    for (let i = 0; i < exerciseRows.length; i++) {
      const row = exerciseRows[i];
      let list = exercisesBySession.get(row.session_id);
      if (!list) {
        list = [];
        exercisesBySession.set(row.session_id, list);
      }
      list.push({
        id: row.id,
        sessionId: row.session_id,
        exerciseId: row.exercise_id ?? null,
        nameSnapshot: row.name_snapshot,
        nameNorm: row.name_norm,
        variationKey: row.variation_key,
        position: row.position,
        supersetGroupId: row.superset_group_id ?? null,
        note: row.note ?? null,
        sets: setsByExercise.get(row.id) ?? [],
      });
      exercisesBySession.set(row.session_id, list);
    }

    const sessions: WorkoutSessionV2[] = new Array(sessionRows.length);
    for (let i = 0; i < sessionRows.length; i++) {
      const row = sessionRows[i];
      sessions[i] = {
        id: row.id,
        title: row.title,
        titleNorm: row.title_norm,
        startedAtMs: row.started_at_ms,
        endedAtMs: row.ended_at_ms ?? null,
        durationSec: row.duration_sec,
        comment: row.comment ?? null,
        totalVolumeMilliKg: row.total_volume_milli_kg,
        prs: row.prs,
        createdAtMs: row.created_at_ms,
        updatedAtMs: row.updated_at_ms,
        revision: row.revision,
        deletedAtMs: row.deleted_at_ms ?? null,
        exercises: exercisesBySession.get(row.id) ?? [],
      };
    }

    return sessions;
  }

  const fallback = getFallbackSessions();
  const active = Array.from(fallback.values()).filter(s => !s.deletedAtMs);
  active.sort((a, b) => (b.startedAtMs || 0) - (a.startedAtMs || 0) || (b.id < a.id ? -1 : 1));
  return active;
}

export async function loadSessionsChunk(
  offset = 0,
  limit = 30
): Promise<{ sessions: WorkoutSessionV2[]; hasMore: boolean }> {
  const list = await listSessions(limit, offset);
  return {
    sessions: list,
    hasMore: list.length === limit,
  };
}

export async function loadSessionsCursorChunk(
  lastStartedAtMs?: number,
  lastId?: string,
  limit = 30
): Promise<{ sessions: WorkoutSessionV2[]; hasMore: boolean }> {
  const db = await getOptionalDb();
  if (db) {
    let query = `SELECT * FROM workout_sessions WHERE deleted_at_ms IS NULL`;
    const params: any[] = [];

    if (lastStartedAtMs !== undefined && lastId !== undefined) {
      query += ` AND (started_at_ms < ? OR (started_at_ms = ? AND id < ?))`;
      params.push(lastStartedAtMs, lastStartedAtMs, lastId);
    }

    query += ` ORDER BY started_at_ms DESC, id DESC LIMIT ?;`;
    params.push(Math.max(1, Math.min(limit, 5000)));

    const sessionRows: any[] = await db.getAllAsync(query, params);
    if (sessionRows.length === 0) return { sessions: [], hasMore: false };

    const sessionIds = sessionRows.map((row) => row.id);
    const placeholders = sessionIds.map(() => '?').join(',');

    const [exerciseRows, setRows]: [any[], any[]] = await Promise.all([
      db.getAllAsync(
        `SELECT * FROM session_exercises WHERE session_id IN (${placeholders}) ORDER BY session_id, position;`,
        sessionIds
      ),
      db.getAllAsync(
        `SELECT sl.* FROM set_logs sl
         JOIN session_exercises se ON se.id = sl.session_exercise_id
         WHERE se.session_id IN (${placeholders})
         ORDER BY sl.session_exercise_id, sl.position;`,
        sessionIds
      ),
    ]);

    const setsByExercise = new Map<string, SetLogV2[]>();
    for (let i = 0; i < setRows.length; i++) {
      const row = setRows[i];
      let list = setsByExercise.get(row.session_exercise_id);
      if (!list) {
        list = [];
        setsByExercise.set(row.session_exercise_id, list);
      }
      list.push({
        id: row.id,
        position: row.position,
        category: row.category,
        completed: row.completed === 1,
        weightMilliKg: row.weight_milli_kg,
        reps: row.reps,
        rpeTenths: row.rpe_tenths ?? null,
        isUnilateral: row.is_unilateral === 1,
        leftWeightMilliKg: row.left_weight_milli_kg ?? null,
        leftReps: row.left_reps ?? null,
        rightWeightMilliKg: row.right_weight_milli_kg ?? null,
        rightReps: row.right_reps ?? null,
      });
    }

    const exercisesBySession = new Map<string, SessionExerciseV2[]>();
    for (let i = 0; i < exerciseRows.length; i++) {
      const row = exerciseRows[i];
      let list = exercisesBySession.get(row.session_id);
      if (!list) {
        list = [];
        exercisesBySession.set(row.session_id, list);
      }
      list.push({
        id: row.id,
        sessionId: row.session_id,
        exerciseId: row.exercise_id ?? null,
        nameSnapshot: row.name_snapshot,
        nameNorm: row.name_norm,
        variationKey: row.variation_key ?? null,
        position: row.position,
        supersetGroupId: row.superset_group_id ?? null,
        note: row.note ?? null,
        sets: setsByExercise.get(row.id) ?? [],
      });
    }

    const sessions: WorkoutSessionV2[] = sessionRows.map((row) => ({
      id: row.id,
      title: row.title,
      titleNorm: row.title_norm,
      startedAtMs: row.started_at_ms,
      endedAtMs: row.ended_at_ms ?? null,
      durationSec: row.duration_sec,
      comment: row.comment ?? null,
      totalVolumeMilliKg: row.total_volume_milli_kg,
      prs: row.prs,
      createdAtMs: row.created_at_ms,
      updatedAtMs: row.updated_at_ms,
      revision: row.revision,
      deletedAtMs: row.deleted_at_ms ?? null,
      exercises: exercisesBySession.get(row.id) ?? [],
    }));

    return {
      sessions,
      hasMore: sessionRows.length === limit,
    };
  }

  const fallback = getFallbackSessions();
  let allActive = Array.from(fallback.values()).filter(s => !s.deletedAtMs);
  allActive.sort((a, b) => (b.startedAtMs || 0) - (a.startedAtMs || 0) || (b.id < a.id ? -1 : 1));
  if (lastStartedAtMs !== undefined && lastId !== undefined) {
    allActive = allActive.filter(s => (s.startedAtMs < lastStartedAtMs) || (s.startedAtMs === lastStartedAtMs && s.id < lastId));
  }
  const slice = allActive.slice(0, limit);
  return { sessions: slice, hasMore: slice.length === limit };
}

export async function loadSessionHeadersChunk(
  lastStartedAtMs?: number,
  lastId?: string,
  limit = 30
): Promise<{ headers: WorkoutSessionV2[]; hasMore: boolean }> {
  const db = await getOptionalDb();
  if (db) {
    let query = `SELECT id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment, total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms FROM workout_sessions WHERE deleted_at_ms IS NULL`;
    const params: any[] = [];
    if (lastStartedAtMs !== undefined && lastId !== undefined) {
      query += ` AND (started_at_ms < ? OR (started_at_ms = ? AND id < ?))`;
      params.push(lastStartedAtMs, lastStartedAtMs, lastId);
    }
    query += ` ORDER BY started_at_ms DESC, id DESC LIMIT ?;`;
    params.push(Math.max(1, Math.min(limit, 5000)));
    const sessionRows: any[] = await db.getAllAsync(query, params);
    if (sessionRows.length === 0) return { headers: [], hasMore: false };
    const headers: WorkoutSessionV2[] = sessionRows.map((row: any) => ({
      id: row.id,
      title: row.title,
      titleNorm: row.title_norm,
      startedAtMs: row.started_at_ms,
      endedAtMs: row.ended_at_ms ?? null,
      durationSec: row.duration_sec,
      comment: row.comment ?? null,
      totalVolumeMilliKg: row.total_volume_milli_kg,
      prs: row.prs,
      createdAtMs: row.created_at_ms,
      updatedAtMs: row.updated_at_ms,
      revision: row.revision,
      deletedAtMs: row.deleted_at_ms ?? null,
      exercises: [],
    }));
    return { headers, hasMore: sessionRows.length === limit };
  }

  const fallback = getFallbackSessions();
  let allActive = Array.from(fallback.values()).filter(s => !s.deletedAtMs);
  allActive.sort((a, b) => (b.startedAtMs || 0) - (a.startedAtMs || 0) || (b.id < a.id ? -1 : 1));
  if (lastStartedAtMs !== undefined && lastId !== undefined) {
    allActive = allActive.filter(s => (s.startedAtMs < lastStartedAtMs) || (s.startedAtMs === lastStartedAtMs && s.id < lastId));
  }
  const slice = allActive.slice(0, limit);
  const headers = slice.map(s => ({ ...s, exercises: [] }));
  return { headers, hasMore: slice.length === limit };
}

export async function loadSessionDetails(sessionId: string): Promise<WorkoutSessionV2 | null> {
  const db = await getOptionalDb();
  if (db) {
    const row: any = await db.getFirstAsync(`SELECT * FROM workout_sessions WHERE id = ? AND deleted_at_ms IS NULL;`, [sessionId]);
    if (!row) return null;
    const [exerciseRows, setRows]: [any[], any[]] = await Promise.all([
      db.getAllAsync(`SELECT * FROM session_exercises WHERE session_id = ? ORDER BY position;`, [sessionId]),
      db.getAllAsync(`SELECT sl.* FROM set_logs sl JOIN session_exercises se ON se.id = sl.session_exercise_id WHERE se.session_id = ? ORDER BY sl.session_exercise_id, sl.position;`, [sessionId]),
    ]);
    const setsByExercise = new Map<string, SetLogV2[]>();
    for (let i = 0; i < setRows.length; i++) {
      const r = setRows[i];
      let list = setsByExercise.get(r.session_exercise_id);
      if (!list) { list = []; setsByExercise.set(r.session_exercise_id, list); }
      list.push(mapSetRow(r));
    }
    const exercises: SessionExerciseV2[] = exerciseRows.map((r: any) => ({
      id: r.id,
      sessionId: r.session_id,
      exerciseId: r.exercise_id ?? null,
      nameSnapshot: r.name_snapshot,
      nameNorm: r.name_norm,
      variationKey: r.variation_key,
      position: r.position,
      supersetGroupId: r.superset_group_id ?? null,
      note: r.note ?? null,
      sets: setsByExercise.get(r.id) ?? [],
    }));
    return {
      id: row.id,
      title: row.title,
      titleNorm: row.title_norm,
      startedAtMs: row.started_at_ms,
      endedAtMs: row.ended_at_ms ?? null,
      durationSec: row.duration_sec,
      comment: row.comment ?? null,
      totalVolumeMilliKg: row.total_volume_milli_kg,
      prs: row.prs,
      createdAtMs: row.created_at_ms,
      updatedAtMs: row.updated_at_ms,
      revision: row.revision,
      deletedAtMs: row.deleted_at_ms ?? null,
      exercises,
    };
  }

  const fallback = getFallbackSessions();
  const s = fallback.get(sessionId);
  if (s && !s.deletedAtMs) return s;
  return null;
}

export async function loadSessionsByIds(ids: string[]): Promise<WorkoutSessionV2[]> {
  if (!ids || ids.length === 0) return [];
  const cleanIds = ids.filter(Boolean);
  if (cleanIds.length === 0) return [];

  const db = await getOptionalDb();
  if (db) {
    const placeholders = cleanIds.map(() => '?').join(',');
    const sessionRows: any[] = await db.getAllAsync(
      `SELECT * FROM workout_sessions WHERE id IN (${placeholders}) AND deleted_at_ms IS NULL ORDER BY started_at_ms DESC, id DESC;`,
      cleanIds
    );
    if (sessionRows.length === 0) return [];
    const sessionIds = sessionRows.map((r) => r.id);
    const ph = sessionIds.map(() => '?').join(',');
    const [exerciseRows, setRows]: [any[], any[]] = await Promise.all([
      db.getAllAsync(`SELECT * FROM session_exercises WHERE session_id IN (${ph}) ORDER BY session_id, position;`, sessionIds),
      db.getAllAsync(`SELECT sl.* FROM set_logs sl JOIN session_exercises se ON se.id = sl.session_exercise_id WHERE se.session_id IN (${ph}) ORDER BY sl.session_exercise_id, sl.position;`, sessionIds),
    ]);
    const setsByExercise = new Map<string, SetLogV2[]>();
    for (let i = 0; i < setRows.length; i++) {
      const row = setRows[i];
      let list = setsByExercise.get(row.session_exercise_id);
      if (!list) { list = []; setsByExercise.set(row.session_exercise_id, list); }
      list.push(mapSetRow(row));
    }
    const exercisesBySession = new Map<string, SessionExerciseV2[]>();
    for (let i = 0; i < exerciseRows.length; i++) {
      const row = exerciseRows[i];
      let list = exercisesBySession.get(row.session_id);
      if (!list) { list = []; exercisesBySession.set(row.session_id, list); }
      list.push({
        id: row.id,
        sessionId: row.session_id,
        exerciseId: row.exercise_id ?? null,
        nameSnapshot: row.name_snapshot,
        nameNorm: row.name_norm,
        variationKey: row.variation_key ?? null,
        position: row.position,
        supersetGroupId: row.superset_group_id ?? null,
        note: row.note ?? null,
        sets: setsByExercise.get(row.id) ?? [],
      });
    }
    return sessionRows.map((row: any) => ({
      id: row.id,
      title: row.title,
      titleNorm: row.title_norm,
      startedAtMs: row.started_at_ms,
      endedAtMs: row.ended_at_ms ?? null,
      durationSec: row.duration_sec,
      comment: row.comment ?? null,
      totalVolumeMilliKg: row.total_volume_milli_kg,
      prs: row.prs,
      createdAtMs: row.created_at_ms,
      updatedAtMs: row.updated_at_ms,
      revision: row.revision,
      deletedAtMs: row.deleted_at_ms ?? null,
      exercises: exercisesBySession.get(row.id) ?? [],
    }));
  }

  const fallback = getFallbackSessions();
  return cleanIds.map(id => fallback.get(id)).filter(s => s && !s.deletedAtMs) as WorkoutSessionV2[];
}

export async function listSessions(limit = 100, offset = 0): Promise<WorkoutSessionV2[]> {
  const db = await getOptionalDb();
  if (db) {
    const sessionRows: any[] = await db.getAllAsync(
      `SELECT * FROM workout_sessions WHERE deleted_at_ms IS NULL
       ORDER BY started_at_ms DESC, id DESC LIMIT ? OFFSET ?;`,
      [Math.max(1, Math.min(limit, 5000)), Math.max(0, offset)]
    );
    if (sessionRows.length === 0) return [];

    const sessionIds = sessionRows.map((row) => row.id);
    const placeholders = sessionIds.map(() => '?').join(',');

    const [exerciseRows, setRows]: [any[], any[]] = await Promise.all([
      db.getAllAsync(
        `SELECT * FROM session_exercises WHERE session_id IN (${placeholders}) ORDER BY session_id, position;`,
        sessionIds
      ),
      db.getAllAsync(
        `SELECT sl.* FROM set_logs sl
         JOIN session_exercises se ON se.id = sl.session_exercise_id
         WHERE se.session_id IN (${placeholders})
         ORDER BY sl.session_exercise_id, sl.position;`,
        sessionIds
      ),
    ]);

    const setsByExercise = new Map<string, SetLogV2[]>();
    for (let i = 0; i < setRows.length; i++) {
      const row = setRows[i];
      let list = setsByExercise.get(row.session_exercise_id);
      if (!list) {
        list = [];
        setsByExercise.set(row.session_exercise_id, list);
      }
      list.push(mapSetRow(row));
    }
    const exercisesBySession = new Map<string, SessionExerciseV2[]>();
    for (let i = 0; i < exerciseRows.length; i++) {
      const row = exerciseRows[i];
      let list = exercisesBySession.get(row.session_id);
      if (!list) {
        list = [];
        exercisesBySession.set(row.session_id, list);
      }
      list.push({
        id: row.id,
        sessionId: row.session_id,
        exerciseId: row.exercise_id ?? null,
        nameSnapshot: row.name_snapshot,
        nameNorm: row.name_norm,
        variationKey: row.variation_key,
        position: row.position,
        supersetGroupId: row.superset_group_id ?? null,
        note: row.note ?? null,
        sets: setsByExercise.get(row.id) ?? [],
      });
      exercisesBySession.set(row.session_id, list);
    }

    const sessions: WorkoutSessionV2[] = new Array(sessionRows.length);
    for (let i = 0; i < sessionRows.length; i++) {
      const row = sessionRows[i];
      sessions[i] = {
        id: row.id,
        title: row.title,
        titleNorm: row.title_norm,
        startedAtMs: row.started_at_ms,
        endedAtMs: row.ended_at_ms ?? null,
        durationSec: row.duration_sec,
        comment: row.comment ?? null,
        totalVolumeMilliKg: row.total_volume_milli_kg,
        prs: row.prs,
        createdAtMs: row.created_at_ms,
        updatedAtMs: row.updated_at_ms,
        revision: row.revision,
        deletedAtMs: row.deleted_at_ms ?? null,
        exercises: exercisesBySession.get(row.id) ?? [],
      };
    }
    return sessions;
  }

  const fallback = getFallbackSessions();
  const active = Array.from(fallback.values()).filter(s => !s.deletedAtMs);
  active.sort((a, b) => (b.startedAtMs || 0) - (a.startedAtMs || 0) || (b.id < a.id ? -1 : 1));
  return active.slice(offset, offset + limit);
}

export async function countSessions(): Promise<number> {
  const db = await getOptionalDb();
  if (db) {
    try {
      const row: any = await db.getFirstAsync(
        'SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NULL;'
      );
      return Number(row?.count ?? 0);
    } catch {}
  }
  const fallback = getFallbackSessions();
  return Array.from(fallback.values()).filter(s => !s.deletedAtMs).length;
}

export async function countTombstonedSessions(): Promise<number> {
  const db = await getOptionalDb();
  if (db) {
    try {
      const row: any = await db.getFirstAsync(
        'SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;'
      );
      return Number(row?.count ?? 0);
    } catch {}
  }
  const fallback = getFallbackSessions();
  return Array.from(fallback.values()).filter(s => !!s.deletedAtMs).length;
}

export async function countAllRawSessions(): Promise<number> {
  const db = await getOptionalDb();
  if (db) {
    try {
      const row: any = await db.getFirstAsync('SELECT COUNT(*) AS count FROM workout_sessions;');
      return Number(row?.count ?? 0);
    } catch {}
  }
  const fallback = getFallbackSessions();
  return fallback.size;
}

export function restoreAllTombstonedSessions(): Promise<number> {
  return enqueueWrite(async () => {
    let restored = 0;
    const fallback = getFallbackSessions();
    const now = Date.now();
    for (const s of fallback.values()) {
      if (s.deletedAtMs) {
        s.deletedAtMs = null;
        s.updatedAtMs = now;
        s.revision = (s.revision || 1) + 1;
        restored++;
      }
    }
    if (restored > 0) {
      saveFallbackSessions(fallback);
    }

    const db = await getOptionalDb();
    if (db) {
      const result: any = await db.runAsync(
        'UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1 WHERE deleted_at_ms IS NOT NULL;',
        [now]
      );
      return Number(result?.changes ?? 0);
    }
    return restored;
  });
}

export const recoverTombstonedSessions = restoreAllTombstonedSessions;

const exerciseNameToMuscle = (name: string): string => {
  if (!name) return 'Other';
  const n = name.toLowerCase().trim();

  if (n.includes('lateral raise') || n.includes('side delt') || n.includes('overhead press') || n.includes('shoulder press') || n.includes('military press') || n.includes('arnold press') || n.includes('front raise')) return 'Shoulders';
  if (n.includes('rear delt') || n.includes('face pull') || n.includes('reverse fly')) return 'Rear Delts';
  if (n.includes('squat') || n.includes('leg press') || n.includes('quad') || n.includes('hack squat') || n.includes('lunge') || n.includes('leg extension')) return 'Quads';
  if (n.includes('hamstring') || n.includes('nordic') || n.includes('leg curl') || n.includes('romanian') || n.includes('rdl') || n.includes('good morning')) return 'Hamstrings';
  if (n.includes('hip thrust') || n.includes('glute') || n.includes('kickback') || n.includes('abductor')) return 'Glutes';
  if (n.includes('deadlift') || n.includes('row') || n.includes('pull up') || n.includes('pull-up') || n.includes('pullup') || n.includes('lat pulldown') || n.includes('lat pull') || n.includes('chin up') || n.includes('chin-up') || n.includes('shrug') || n.includes('back extension')) return 'Back';
  if (n.includes('bench') || n.includes('chest fly') || n.includes('chest press') || n.includes('pec') || n.includes('pushup') || n.includes('push-up') || n.includes('push up') || n.includes('incline press') || n.includes('decline press') || n.includes('cable crossover')) return 'Chest';
  if (n.includes('bicep') || n.includes('curl') || n.includes('preacher') || n.includes('hammer curl')) return 'Biceps';
  if (n.includes('tricep') || n.includes('pushdown') || n.includes('dip') || n.includes('skull crusher') || n.includes('skullcrusher') || n.includes('close grip') || n.includes('overhead extension')) return 'Triceps';
  if (n.includes('calf') || n.includes('calves')) return 'Calves';
  if (n.includes('forearm') || n.includes('wrist') || n.includes('farmer') || n.includes('roller')) return 'Forearms';
  if (n.includes('ab ') || n.includes('abs') || n.includes('crunch') || n.includes('plank') || n.includes('sit up') || n.includes('sit-up') || n.includes('twist') || n.includes('leg raise') || n.includes('core')) return 'Abs';
  return 'Other';
};

export async function loadLifetimeSetsStats(exerciseMuscleMap?: Record<string, string>): Promise<LifetimeStatsSummary> {
  const db = await getOptionalDb();
  if (db) {
    const rows: any[] = await db.getAllAsync(`
      SELECT 
        se.name_norm,
        se.name_snapshot,
        COUNT(sl.id) AS completed_sets,
        COALESCE(SUM(
          CASE 
            WHEN sl.is_unilateral = 1 THEN 
              ((COALESCE(sl.left_weight_milli_kg, sl.weight_milli_kg, 0) * COALESCE(sl.left_reps, 0)) + 
               (COALESCE(sl.right_weight_milli_kg, sl.weight_milli_kg, 0) * COALESCE(sl.right_reps, 0))) / 1000.0
            ELSE 
              (COALESCE(sl.weight_milli_kg, 0) * COALESCE(sl.reps, 0)) / 1000.0
          END
        ), 0) AS volume_kg,
        COALESCE(MAX(ws.started_at_ms), 0) AS last_performed_ms
      FROM set_logs sl
      JOIN session_exercises se ON se.id = sl.session_exercise_id
      JOIN workout_sessions ws ON ws.id = se.session_id
      WHERE ws.deleted_at_ms IS NULL AND sl.completed = 1
      GROUP BY se.name_norm;
    `);

    const exerciseSets: Record<string, any> = {};
    const muscleSets: Record<string, number> = {};
    const muscleVolumeKg: Record<string, number> = {};
    let totalCompletedSets = 0;
    let totalVolumeKg = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const nameNorm = row.name_norm || normalizeLookupKey(row.name_snapshot || '');
      const count = Number(row.completed_sets || 0);
      const volume = Math.round(Number(row.volume_kg || 0));
      const lastMs = Number(row.last_performed_ms || 0);
      if (!nameNorm || count <= 0) continue;

      exerciseSets[nameNorm] = {
        sets: count,
        volumeKg: volume,
        lastPerformedMs: lastMs,
      };
      totalCompletedSets += count;
      totalVolumeKg += volume;

      const muscle = (exerciseMuscleMap && exerciseMuscleMap[nameNorm])
        ? (exerciseMuscleMap[nameNorm] === 'Core' ? 'Abs' : exerciseMuscleMap[nameNorm])
        : exerciseNameToMuscle(row.name_snapshot || nameNorm);

      muscleSets[muscle] = (muscleSets[muscle] || 0) + count;
      muscleVolumeKg[muscle] = (muscleVolumeKg[muscle] || 0) + volume;
    }

    const summary: LifetimeStatsSummary = {
      totalCompletedSets,
      totalVolumeKg,
      muscleSets,
      muscleVolumeKg,
      exerciseSets,
      lastCalculatedMs: Date.now(),
    };

    setCachedLifetimeStats(summary);
    return summary;
  }

  // Fallback calculation
  const fallback = getFallbackSessions();
  const exerciseSets: Record<string, any> = {};
  const muscleSets: Record<string, number> = {};
  const muscleVolumeKg: Record<string, number> = {};
  let totalCompletedSets = 0;
  let totalVolumeKg = 0;

  for (const s of fallback.values()) {
    if (s.deletedAtMs) continue;
    for (const ex of s.exercises || []) {
      const nameNorm = ex.nameNorm || normalizeLookupKey(ex.nameSnapshot || '');
      if (!nameNorm) continue;
      for (const set of ex.sets || []) {
        if (!set.completed) continue;
        const setWeight = (set.weightMilliKg || 0) / 1000;
        const setReps = set.reps || 0;
        const setVol = set.isUnilateral
          ? (((set.leftWeightMilliKg || set.weightMilliKg || 0) * (set.leftReps || 0)) + ((set.rightWeightMilliKg || set.weightMilliKg || 0) * (set.rightReps || 0))) / 1000
          : setWeight * setReps;

        totalCompletedSets += 1;
        totalVolumeKg += setVol;

        const currentEx = exerciseSets[nameNorm] || { sets: 0, volumeKg: 0, lastPerformedMs: 0 };
        currentEx.sets += 1;
        currentEx.volumeKg += setVol;
        currentEx.lastPerformedMs = Math.max(currentEx.lastPerformedMs, s.startedAtMs || 0);
        exerciseSets[nameNorm] = currentEx;

        const muscle = (exerciseMuscleMap && exerciseMuscleMap[nameNorm])
          ? (exerciseMuscleMap[nameNorm] === 'Core' ? 'Abs' : exerciseMuscleMap[nameNorm])
          : exerciseNameToMuscle(ex.nameSnapshot || nameNorm);

        muscleSets[muscle] = (muscleSets[muscle] || 0) + 1;
        muscleVolumeKg[muscle] = (muscleVolumeKg[muscle] || 0) + setVol;
      }
    }
  }

  const summary: LifetimeStatsSummary = {
    totalCompletedSets,
    totalVolumeKg: Math.round(totalVolumeKg),
    muscleSets,
    muscleVolumeKg,
    exerciseSets,
    lastCalculatedMs: Date.now(),
  };

  setCachedLifetimeStats(summary);
  return summary;
}

export async function loadWeeklyMuscleStats(exerciseMuscleMap?: Record<string, string>): Promise<Record<string, number>> {
  const db = await getOptionalDb();
  if (db) {
    const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const rows: any[] = await db.getAllAsync(`
      SELECT 
        se.name_snapshot AS name_snapshot,
        se.name_norm AS name_norm,
        COUNT(sl.id) AS completed_sets
      FROM set_logs sl
      JOIN session_exercises se ON se.id = sl.session_exercise_id
      JOIN workout_sessions ws ON ws.id = se.session_id
      WHERE ws.deleted_at_ms IS NULL AND sl.completed = 1 AND ws.started_at_ms >= ?
      GROUP BY se.name_norm;
    `, [cutoffMs]);

    const muscleSets: Record<string, number> = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const nameNorm = row.name_norm || normalizeLookupKey(row.name_snapshot || '');
      const count = Number(row.completed_sets || 0);
      if (!nameNorm || count <= 0) continue;
      const muscle = (exerciseMuscleMap && exerciseMuscleMap[nameNorm])
        ? (exerciseMuscleMap[nameNorm] === 'Core' ? 'Abs' : exerciseMuscleMap[nameNorm])
        : exerciseNameToMuscle(row.name_snapshot || nameNorm);
      muscleSets[muscle] = (muscleSets[muscle] || 0) + count;
    }
    return muscleSets;
  }

  // Fallback
  const fallback = getFallbackSessions();
  const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const muscleSets: Record<string, number> = {};

  for (const s of fallback.values()) {
    if (s.deletedAtMs || (s.startedAtMs || 0) < cutoffMs) continue;
    for (const ex of s.exercises || []) {
      const nameNorm = ex.nameNorm || normalizeLookupKey(ex.nameSnapshot || '');
      if (!nameNorm) continue;
      for (const set of ex.sets || []) {
        if (!set.completed) continue;
        const muscle = (exerciseMuscleMap && exerciseMuscleMap[nameNorm])
          ? (exerciseMuscleMap[nameNorm] === 'Core' ? 'Abs' : exerciseMuscleMap[nameNorm])
          : exerciseNameToMuscle(ex.nameSnapshot || nameNorm);
        muscleSets[muscle] = (muscleSets[muscle] || 0) + 1;
      }
    }
  }
  return muscleSets;
}

export async function getDatabaseDiagnostics(): Promise<DatabaseDiagnostics> {
  let isReady = false;
  let activeSessionsCount = 0;
  let tombstonedSessionsCount = 0;
  let rawTotalSessionsCount = 0;

  try {
    const db = await getOptionalDb();
    if (db) {
      isReady = true;
      const [activeRow, tombstonedRow, rawRow]: [any, any, any] = await Promise.all([
        db.getFirstAsync('SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NULL;'),
        db.getFirstAsync('SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;'),
        db.getFirstAsync('SELECT COUNT(*) AS count FROM workout_sessions;'),
      ]);
      activeSessionsCount = Number(activeRow?.count ?? 0);
      tombstonedSessionsCount = Number(tombstonedRow?.count ?? 0);
      rawTotalSessionsCount = Number(rawRow?.count ?? 0);
    }
  } catch (error) {
    console.error('[HistoryRepository] getDatabaseDiagnostics failed:', error);
    isReady = false;
  }

  const cachedRecent = getCachedRecentSessions();
  const cachedRecentCount = Array.isArray(cachedRecent) ? cachedRecent.length : 0;
  const cachedTotal = getCachedTotalSessionsCount();
  const cachedTotalCount = typeof cachedTotal === 'number' ? cachedTotal : cachedRecentCount;

  return {
    isReady,
    activeSessionsCount,
    tombstonedSessionsCount,
    rawTotalSessionsCount,
    cachedRecentCount,
    cachedTotalCount,
  };
}

export async function getAllSessionIds(): Promise<Set<string>> {
  const db = await getOptionalDb();
  if (db) {
    try {
      const rows: any[] = await db.getAllAsync('SELECT id FROM workout_sessions;');
      return new Set(rows.map((r) => String(r.id)));
    } catch {}
  }
  const fallback = getFallbackSessions();
  return new Set(fallback.keys());
}

export function insertMissingSessionsOnly(sessions: WorkoutSessionV2[]): Promise<void> {
  return enqueueWrite(async () => {
    for (let i = 0; i < sessions.length; i++) {
      const v = validateWorkoutSessionV2(sessions[i]);
      if (!v.success) throw new Error(`Invalid normalized session at index ${i}: ${v.error}`);
    }

    const fallback = getFallbackSessions();
    const now = Date.now();
    for (const session of sessions) {
      const existing = fallback.get(session.id);
      if (!existing) {
        fallback.set(session.id, { ...session, deletedAtMs: null });
      } else if (existing.deletedAtMs) {
        existing.deletedAtMs = null;
        existing.updatedAtMs = now;
        existing.revision = (existing.revision || 1) + 1;
      }
    }
    saveFallbackSessions(fallback);

    const db = await getOptionalDb();
    if (db) {
      await transaction(db, async () => {
        const rows: any[] = await db.getAllAsync('SELECT id, deleted_at_ms FROM workout_sessions;');
        const existingStatus = new Map<string, boolean>();
        for (const r of rows) {
          existingStatus.set(String(r.id), r.deleted_at_ms !== null);
        }

        for (const session of sessions) {
          const isTombstoned = existingStatus.get(session.id);
          if (isTombstoned === undefined) {
            await writeSession(db, { ...session, deletedAtMs: null });
            existingStatus.set(session.id, false);
          } else if (isTombstoned === true) {
            await db.runAsync(
              'UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1 WHERE id = ?;',
              [now, session.id]
            );
            existingStatus.set(session.id, false);
          }
        }
      });
    }
  });
}

export async function findLastPerformance(
  exerciseName: string,
  variationKey = '',
  category: SetCategoryV2 = 'S',
  positionInCategory = 0
): Promise<SetLogV2 | null> {
  const db = await getOptionalDb();
  if (db) {
    try {
      const exerciseRow: any = await db.getFirstAsync(
        `SELECT DISTINCT se.id FROM session_exercises se
         JOIN workout_sessions ws ON ws.id = se.session_id
         JOIN set_logs sl ON sl.session_exercise_id = se.id
         WHERE ws.deleted_at_ms IS NULL AND se.name_norm = ? AND se.variation_key = ?
           AND sl.category = ? AND sl.completed = 1
         ORDER BY ws.started_at_ms DESC, ws.id DESC, se.position ASC LIMIT 1;`,
        [normalizeLookupKey(exerciseName), normalizeLookupKey(variationKey), category]
      );
      if (exerciseRow) {
        const rows: any[] = await db.getAllAsync(
          `SELECT * FROM set_logs WHERE session_exercise_id = ? AND category = ? AND completed = 1
           ORDER BY position ASC;`,
          [exerciseRow.id, category]
        );
        if (rows.length > 0) {
          return mapSetRow(rows[Math.min(Math.max(0, positionInCategory), rows.length - 1)]);
        }
      }
    } catch {}
  }

  // Fallback search
  const fallback = getFallbackSessions();
  const nameNorm = normalizeLookupKey(exerciseName);
  const vKey = normalizeLookupKey(variationKey);
  const sorted = Array.from(fallback.values()).filter(s => !s.deletedAtMs).sort((a, b) => (b.startedAtMs || 0) - (a.startedAtMs || 0));

  for (const s of sorted) {
    for (const ex of s.exercises || []) {
      if (ex.nameNorm === nameNorm && (ex.variationKey || '') === vKey) {
        const matchingSets = (ex.sets || []).filter(st => st.category === category && st.completed);
        if (matchingSets.length > 0) {
          return matchingSets[Math.min(Math.max(0, positionInCategory), matchingSets.length - 1)];
        }
      }
    }
  }

  return null;
}

export async function setPersistenceMeta(key: string, value: string): Promise<void> {
  const meta = getFallbackMetaCache();
  meta.set(key, value);
  try {
    const obj: Record<string, string> = {};
    for (const [k, v] of meta.entries()) obj[k] = v;
    safeMmkvSet(STORAGE_KEYS.FALLBACK_PERSISTENCE_META_V2, JSON.stringify(obj));
  } catch {}

  const db = await getOptionalDb();
  if (db) {
    await db.runAsync(
      `INSERT INTO persistence_meta(key, value, updated_at_ms) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at_ms=excluded.updated_at_ms;`,
      [key, value, Date.now()]
    );
  }
}

export async function getPersistenceMeta(key: string): Promise<string | null> {
  const db = await getOptionalDb();
  if (db) {
    try {
      const row: any = await db.getFirstAsync('SELECT value FROM persistence_meta WHERE key = ?;', [key]);
      if (typeof row?.value === 'string') return row.value;
    } catch {}
  }
  const meta = getFallbackMetaCache();
  return meta.get(key) || null;
}
