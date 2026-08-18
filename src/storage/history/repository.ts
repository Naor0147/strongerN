import { SQLiteDatabase } from 'expo-sqlite';
import { WorkoutSessionV2, SessionExerciseV2, SetLogV2, SetCategoryV2 } from '../contracts/types';
import { validateWorkoutSessionV2 } from '../contracts/validators';
import { getV2Database } from '../dbSingleton';
import { ensureHistorySchema } from './schema';
import { normalizeLookupKey } from './legacySessionMapper';

let initialized = false;
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
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
    await requireDb();
    return true;
  } catch (error) {
    console.error('[HistoryRepository] Initialization failed:', error);
    return false;
  }
}

export function upsertSession(session: WorkoutSessionV2): Promise<void> {
  return enqueueWrite(async () => {
    const db = await requireDb();
    await transaction(db, () => writeSession(db, session));
  });
}

export function reconcileSessions(sessions: WorkoutSessionV2[]): Promise<void> {
  return enqueueWrite(async () => {
    const db = await requireDb();
    await transaction(db, async () => {
      for (const session of sessions) await writeSession(db, session);
      const ids = sessions.map((session) => session.id);
      const now = Date.now();
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
  });
}

export function bulkImportSessions(sessions: WorkoutSessionV2[]): Promise<void> {
  return enqueueWrite(async () => {
    const db = await requireDb();
    await transaction(db, async () => {
      for (const session of sessions) await writeSession(db, session);
    });
  });
}

export function softDeleteSession(sessionId: string): Promise<void> {
  return enqueueWrite(async () => {
    const db = await requireDb();
    await db.runAsync(
      'UPDATE workout_sessions SET deleted_at_ms = ?, updated_at_ms = ?, revision = revision + 1 WHERE id = ?;',
      [Date.now(), Date.now(), sessionId]
    );
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

export async function loadAllSessions(): Promise<WorkoutSessionV2[]> {
  const db = await requireDb();
  
  const [sessionRows, exerciseRows, setRows]: [any[], any[], any[]] = await Promise.all([
    db.getAllAsync(
      `SELECT id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment,
              total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms
       FROM workout_sessions
       WHERE deleted_at_ms IS NULL
       ORDER BY started_at_ms DESC, id DESC;`
    ),
    db.getAllAsync(
      `SELECT se.id, se.session_id, se.exercise_id, se.name_snapshot, se.name_norm,
              se.variation_key, se.position, se.superset_group_id, se.note
       FROM session_exercises se
       JOIN workout_sessions ws ON ws.id = se.session_id
       WHERE ws.deleted_at_ms IS NULL
       ORDER BY se.session_id, se.position;`
    ),
    db.getAllAsync(
      `SELECT sl.id, sl.session_exercise_id, sl.position, sl.category, sl.completed,
              sl.weight_milli_kg, sl.reps, sl.rpe_tenths, sl.is_unilateral,
              sl.left_weight_milli_kg, sl.left_reps, sl.right_weight_milli_kg, sl.right_reps
       FROM set_logs sl
       JOIN session_exercises se ON se.id = sl.session_exercise_id
       JOIN workout_sessions ws ON ws.id = se.session_id
       WHERE ws.deleted_at_ms IS NULL
       ORDER BY sl.session_exercise_id, sl.position;`
    ),
  ]);

  if (sessionRows.length === 0) return [];

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

export async function listSessions(limit = 100, offset = 0): Promise<WorkoutSessionV2[]> {
  const db = await requireDb();
  const sessionRows: any[] = await db.getAllAsync(
    `SELECT * FROM workout_sessions WHERE deleted_at_ms IS NULL
     ORDER BY started_at_ms DESC, id DESC LIMIT ? OFFSET ?;`,
    [Math.max(1, Math.min(limit, 500)), Math.max(0, offset)]
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

export async function countSessions(): Promise<number> {
  const db = await requireDb();
  const row: any = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NULL;'
  );
  return Number(row?.count ?? 0);
}

export async function countAllRawSessions(): Promise<number> {
  const db = await requireDb();
  const row: any = await db.getFirstAsync('SELECT COUNT(*) AS count FROM workout_sessions;');
  return Number(row?.count ?? 0);
}

export async function getAllSessionIds(): Promise<Set<string>> {
  const db = await requireDb();
  const rows: any[] = await db.getAllAsync('SELECT id FROM workout_sessions;');
  return new Set(rows.map((r) => String(r.id)));
}

export function insertMissingSessionsOnly(sessions: WorkoutSessionV2[]): Promise<void> {
  return enqueueWrite(async () => {
    const db = await requireDb();
    await transaction(db, async () => {
      const existingIds = await getAllSessionIds();
      for (const session of sessions) {
        if (!existingIds.has(session.id)) {
          await writeSession(db, session);
        }
      }
    });
  });
}

export async function findLastPerformance(
  exerciseName: string,
  variationKey = '',
  category: SetCategoryV2 = 'S',
  positionInCategory = 0
): Promise<SetLogV2 | null> {
  const db = await requireDb();
  const exerciseRow: any = await db.getFirstAsync(
    `SELECT DISTINCT se.id FROM session_exercises se
     JOIN workout_sessions ws ON ws.id = se.session_id
     JOIN set_logs sl ON sl.session_exercise_id = se.id
     WHERE ws.deleted_at_ms IS NULL AND se.name_norm = ? AND se.variation_key = ?
       AND sl.category = ? AND sl.completed = 1
     ORDER BY ws.started_at_ms DESC, ws.id DESC, se.position ASC LIMIT 1;`,
    [normalizeLookupKey(exerciseName), normalizeLookupKey(variationKey), category]
  );
  if (!exerciseRow) return null;
  const rows: any[] = await db.getAllAsync(
    `SELECT * FROM set_logs WHERE session_exercise_id = ? AND category = ? AND completed = 1
     ORDER BY position ASC;`,
    [exerciseRow.id, category]
  );
  if (rows.length === 0) return null;
  return mapSetRow(rows[Math.min(Math.max(0, positionInCategory), rows.length - 1)]);
}

export async function setPersistenceMeta(key: string, value: string): Promise<void> {
  const db = await requireDb();
  await db.runAsync(
    `INSERT INTO persistence_meta(key, value, updated_at_ms) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at_ms=excluded.updated_at_ms;`,
    [key, value, Date.now()]
  );
}

export async function getPersistenceMeta(key: string): Promise<string | null> {
  const db = await requireDb();
  const row: any = await db.getFirstAsync('SELECT value FROM persistence_meta WHERE key = ?;', [key]);
  return typeof row?.value === 'string' ? row.value : null;
}
