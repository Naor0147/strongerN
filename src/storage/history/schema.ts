import { SQLiteDatabase } from 'expo-sqlite';

export const HISTORY_SCHEMA_VERSION = 2;

export async function ensureHistorySchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS persistence_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY NOT NULL,
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
      revision INTEGER NOT NULL,
      deleted_at_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS session_exercises (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
      exercise_id TEXT,
      name_snapshot TEXT NOT NULL,
      name_norm TEXT NOT NULL,
      variation_key TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL,
      superset_group_id TEXT,
      note TEXT,
      UNIQUE(session_id, position)
    );

    CREATE TABLE IF NOT EXISTS set_logs (
      id TEXT PRIMARY KEY NOT NULL,
      session_exercise_id TEXT NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      category TEXT NOT NULL,
      completed INTEGER NOT NULL,
      weight_milli_kg INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      rpe_tenths INTEGER,
      is_unilateral INTEGER NOT NULL,
      left_weight_milli_kg INTEGER,
      left_reps INTEGER,
      right_weight_milli_kg INTEGER,
      right_reps INTEGER,
      UNIQUE(session_exercise_id, position)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_started_desc
      ON workout_sessions(deleted_at_ms, started_at_ms DESC, id);
    CREATE INDEX IF NOT EXISTS idx_sessions_title_started
      ON workout_sessions(title_norm, started_at_ms DESC);
    CREATE INDEX IF NOT EXISTS idx_exercises_lookup
      ON session_exercises(name_norm, variation_key, session_id);
    CREATE INDEX IF NOT EXISTS idx_exercises_session_position
      ON session_exercises(session_id, position);
    CREATE INDEX IF NOT EXISTS idx_sets_exercise_position
      ON set_logs(session_exercise_id, category, position);

    PRAGMA user_version = ${HISTORY_SCHEMA_VERSION};
  `);
}
