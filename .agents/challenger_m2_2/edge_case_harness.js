'use strict';

const { DatabaseSync } = require('node:sqlite');
const assert = require('node:assert');

console.log('--- STARTING EDGE CASE & ADVERSARIAL STRESS HARNESS ---');

const db = new DatabaseSync(':memory:');

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE workout_sessions (
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

  CREATE TABLE session_exercises (
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

  CREATE TABLE set_logs (
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
`);

// 1. Insert Active Session (Parameterized matching production repository.ts)
db.prepare(`
  INSERT INTO workout_sessions (
    id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment,
    total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`).run(
  'sess-active', 'Active Session', 'active session', 1700000000000, null, 1800, 'Multi-line\nComment\nSpecial chars & < > "', 150000, 0, 1700000000000, 1700001800000, 1, null
);

// 2. Insert Deleted Session (Soft Deleted)
db.prepare(`
  INSERT INTO workout_sessions (
    id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment,
    total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`).run(
  'sess-deleted', 'Deleted Session', 'deleted session', 1690000000000, 1690003600000, 3600, null, 250000, 1, 1690000000000, 1690003600000, 2, 1690004000000
);

// 3. Insert Exercises for Active Session
db.prepare(`
  INSERT INTO session_exercises (
    id, session_id, exercise_id, name_snapshot, name_norm, variation_key,
    position, superset_group_id, note
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
`).run('ex-act-0', 'sess-active', null, 'Dips (Chest & Triceps)', 'dips (chest & triceps)', '', 0, null, 'Multi-line\nNote\nFocus on lockout');

db.prepare(`
  INSERT INTO session_exercises (
    id, session_id, exercise_id, name_snapshot, name_norm, variation_key,
    position, superset_group_id, note
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
`).run('ex-act-1', 'sess-active', 'cat-pullup', 'Weighted Pull-Up', 'weighted pull-up', 'neutral-grip', 1, 'superset-1', null);

// 4. Insert Exercises for Deleted Session
db.prepare(`
  INSERT INTO session_exercises (
    id, session_id, exercise_id, name_snapshot, name_norm, variation_key,
    position, superset_group_id, note
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
`).run('ex-del-0', 'sess-deleted', 'cat-squat', 'Squat', 'squat', '', 0, null, 'Should never appear in hydration');

// 5. Insert Sets for Active Session
const insertSetStmt = db.prepare(`
  INSERT INTO set_logs (
    id, session_exercise_id, position, category, completed, weight_milli_kg, reps,
    rpe_tenths, is_unilateral, left_weight_milli_kg, left_reps,
    right_weight_milli_kg, right_reps
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`);

// Set 0: Bodyweight 0kg, Reps 10, category 'W' (warmup)
insertSetStmt.run('set-act-0-0', 'ex-act-0', 0, 'W', 1, 0, 10, 50, 0, null, null, null, null);

// Set 1: Weighted 20kg (20000milliKg), Reps 8, category 'S', RPE 8.0 (80)
insertSetStmt.run('set-act-0-1', 'ex-act-0', 1, 'S', 1, 20000, 8, 80, 0, null, null, null, null);

// Set 2: Unilateral Dumbbell Rows 32.5kg (32500milliKg), Reps 12L / 11R, category 'D' (drop set), RPE 9.5 (95)
insertSetStmt.run('set-act-1-0', 'ex-act-1', 0, 'D', 1, 32500, 12, 95, 1, 32500, 12, 32500, 11);

// Set 3: Failure Set, category 'F', 0 reps (failed attempt)
insertSetStmt.run('set-act-1-1', 'ex-act-1', 1, 'F', 1, 40000, 0, 100, 0, null, null, null, null);

// 6. Insert Sets for Deleted Session
insertSetStmt.run('set-del-0-0', 'ex-del-0', 0, 'S', 1, 140000, 5, 90, 0, null, null, null, null);

// Hydrate using exact repository queries
const sessionRows = db.prepare(`
  SELECT id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment,
         total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms
  FROM workout_sessions
  WHERE deleted_at_ms IS NULL
  ORDER BY started_at_ms DESC, id DESC;
`).all();

const exerciseRows = db.prepare(`
  SELECT se.id, se.session_id, se.exercise_id, se.name_snapshot, se.name_norm,
         se.variation_key, se.position, se.superset_group_id, se.note
  FROM session_exercises se
  JOIN workout_sessions ws ON ws.id = se.session_id
  WHERE ws.deleted_at_ms IS NULL
  ORDER BY se.session_id, se.position;
`).all();

const setRows = db.prepare(`
  SELECT sl.id, sl.session_exercise_id, sl.position, sl.category, sl.completed,
         sl.weight_milli_kg, sl.reps, sl.rpe_tenths, sl.is_unilateral,
         sl.left_weight_milli_kg, sl.left_reps, sl.right_weight_milli_kg, sl.right_reps
  FROM set_logs sl
  JOIN session_exercises se ON se.id = sl.session_exercise_id
  JOIN workout_sessions ws ON ws.id = se.session_id
  WHERE ws.deleted_at_ms IS NULL
  ORDER BY sl.session_exercise_id, sl.position;
`).all();

function mapSetRow(row) {
  return {
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
  };
}

const setsByExercise = new Map();
for (let i = 0; i < setRows.length; i++) {
  const row = setRows[i];
  let list = setsByExercise.get(row.session_exercise_id);
  if (!list) { list = []; setsByExercise.set(row.session_exercise_id, list); }
  list.push(mapSetRow(row));
}

const exercisesBySession = new Map();
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
    variationKey: row.variation_key,
    position: row.position,
    supersetGroupId: row.superset_group_id ?? null,
    note: row.note ?? null,
    sets: setsByExercise.get(row.id) ?? [],
  });
}

const sessions = new Array(sessionRows.length);
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

// ── VERIFICATIONS ─────────────────────────────────────────────────────────────
console.log('1. Checking Soft-Deleted Session Filtering...');
assert.strictEqual(sessions.length, 1, 'Only active session must be returned');
assert.strictEqual(sessions[0].id, 'sess-active');
assert.strictEqual(exerciseRows.length, 2, 'Only active session exercises must be queried');
assert.strictEqual(setRows.length, 4, 'Only active session sets must be queried');
console.log('  -> PASS: Soft-deleted session, exercises, and sets correctly omitted.');

console.log('2. Checking Active Session Envelope & Nullable Fields...');
const s = sessions[0];
assert.strictEqual(s.endedAtMs, null, 'endedAtMs must be preserved as null');
assert.strictEqual(s.comment, 'Multi-line\nComment\nSpecial chars & < > "', 'Multi-line comment must be preserved');
assert.strictEqual(s.prs, 0, 'PRS must be 0');
console.log('  -> PASS: Session envelope verified.');

console.log('3. Checking Exercise & Set Reconstruction...');
const ex0 = s.exercises[0];
assert.strictEqual(ex0.exerciseId, null, 'exerciseId null preserved');
assert.strictEqual(ex0.note, 'Multi-line\nNote\nFocus on lockout', 'Multi-line note preserved');
assert.strictEqual(ex0.sets.length, 2);

// Check Warmup Set (W)
const setW = ex0.sets[0];
assert.strictEqual(setW.category, 'W', 'is_warmup category W preserved');
assert.strictEqual(setW.weightMilliKg, 0, 'Zero weight preserved');
assert.strictEqual(setW.reps, 10, 'Reps preserved');
assert.strictEqual(setW.rpeTenths, 50, 'RPE 5.0 (50) preserved');
assert.strictEqual(setW.isUnilateral, false, 'isUnilateral false');

// Check Drop Set (D) & Unilateral
const ex1 = s.exercises[1];
const setD = ex1.sets[0];
assert.strictEqual(setD.category, 'D', 'is_drop_set category D preserved');
assert.strictEqual(setD.isUnilateral, true, 'isUnilateral true preserved');
assert.strictEqual(setD.weightMilliKg, 32500, '32.5kg = 32500 milliKg preserved');
assert.strictEqual(setD.leftReps, 12, 'Left reps 12 preserved');
assert.strictEqual(setD.rightReps, 11, 'Right reps 11 preserved');
assert.strictEqual(setD.rpeTenths, 95, 'RPE 9.5 (95) preserved');

// Check Failure Set (F) & 0 Reps
const setF = ex1.sets[1];
assert.strictEqual(setF.category, 'F', 'is_failure category F preserved');
assert.strictEqual(setF.reps, 0, '0 reps failed attempt preserved');
assert.strictEqual(setF.rpeTenths, 100, 'RPE 10.0 (100) preserved');

console.log('  -> PASS: All exercise and set flags verified with 100% integrity.');

console.log('\n--- ALL EDGE CASE TESTS COMPLETED SUCCESSFULLY ---');
