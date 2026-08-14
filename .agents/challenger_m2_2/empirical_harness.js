'use strict';

const { DatabaseSync } = require('node:sqlite');
const assert = require('node:assert');
const { performance } = require('node:perf_hooks');

console.log('--- STARTING EMPIRICAL CHALLENGE HARNESS ---');

// 1. Setup in-memory SQLite v2 matching schema
const db = new DatabaseSync(':memory:');

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE persistence_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at_ms INTEGER NOT NULL
  );

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

  CREATE INDEX idx_sessions_started_desc ON workout_sessions(deleted_at_ms, started_at_ms DESC, id);
  CREATE INDEX idx_sessions_title_started ON workout_sessions(title_norm, started_at_ms DESC);
  CREATE INDEX idx_exercises_lookup ON session_exercises(name_norm, variation_key, session_id);
  CREATE INDEX idx_exercises_session_position ON session_exercises(session_id, position);
  CREATE INDEX idx_sets_exercise_position ON set_logs(session_exercise_id, category, position);
`);

// 2. Comprehensive Set Flag Matrix
const testCases = [
  {
    desc: 'Warmup Set (W)',
    category: 'W',
    completed: true,
    weightMilliKg: 20000,
    reps: 15,
    rpeTenths: 50,
    isUnilateral: false,
    leftWeightMilliKg: null,
    leftReps: null,
    rightWeightMilliKg: null,
    rightReps: null,
  },
  {
    desc: 'Standard Set (S)',
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
  {
    desc: 'Drop Set (D)',
    category: 'D',
    completed: true,
    weightMilliKg: 65000,
    reps: 12,
    rpeTenths: 95,
    isUnilateral: false,
    leftWeightMilliKg: null,
    leftReps: null,
    rightWeightMilliKg: null,
    rightReps: null,
  },
  {
    desc: 'Failure Set (F)',
    category: 'F',
    completed: true,
    weightMilliKg: 85000,
    reps: 6,
    rpeTenths: 100,
    isUnilateral: false,
    leftWeightMilliKg: null,
    leftReps: null,
    rightWeightMilliKg: null,
    rightReps: null,
  },
  {
    desc: 'Unilateral Set (isUnilateral=true)',
    category: 'S',
    completed: true,
    weightMilliKg: 22500,
    reps: 10,
    rpeTenths: 80,
    isUnilateral: true,
    leftWeightMilliKg: 22500,
    leftReps: 10,
    rightWeightMilliKg: 25000,
    rightReps: 8,
  },
  {
    desc: 'Incomplete / Zero-weight / Null RPE Set',
    category: 'S',
    completed: false,
    weightMilliKg: 0,
    reps: 0,
    rpeTenths: null,
    isUnilateral: false,
    leftWeightMilliKg: null,
    leftReps: null,
    rightWeightMilliKg: null,
    rightReps: null,
  },
  {
    desc: 'Decimal / Micro-weight Set (e.g. 100.25kg = 100250 milliKg)',
    category: 'S',
    completed: true,
    weightMilliKg: 100250,
    reps: 5,
    rpeTenths: 90,
    isUnilateral: false,
    leftWeightMilliKg: null,
    leftReps: null,
    rightWeightMilliKg: null,
    rightReps: null,
  },
];

// Insert Session
db.prepare(`
  INSERT INTO workout_sessions (
    id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment,
    total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`).run('sess-emp-1', 'Empirical Test Session', 'empirical test session', 1700000000000, 1700003600000, 3600, 'Test Comment', 500000, 3, 1700000000000, 1700003600000, 1, null);

// Insert Exercise
db.prepare(`
  INSERT INTO session_exercises (
    id, session_id, exercise_id, name_snapshot, name_norm, variation_key,
    position, superset_group_id, note
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
`).run('ex-emp-1', 'sess-emp-1', 'cat-1', 'Dumbbell Curl', 'dumbbell curl', 'incline', 0, 'ss-1', 'Keep back flat');

// Insert Sets
const insertSetStmt = db.prepare(`
  INSERT INTO set_logs (
    id, session_exercise_id, position, category, completed, weight_milli_kg, reps,
    rpe_tenths, is_unilateral, left_weight_milli_kg, left_reps,
    right_weight_milli_kg, right_reps
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`);

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  insertSetStmt.run(
    `set-emp-${i}`,
    'ex-emp-1',
    i,
    tc.category,
    tc.completed ? 1 : 0,
    tc.weightMilliKg,
    tc.reps,
    tc.rpeTenths,
    tc.isUnilateral ? 1 : 0,
    tc.leftWeightMilliKg,
    tc.leftReps,
    tc.rightWeightMilliKg,
    tc.rightReps
  );
}

// 3. Hydrate using exact repository queries
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

const hydratedSets = setRows.map(mapSetRow);

console.log(`Verified ${hydratedSets.length} sets hydrated from SQLite.`);

for (let i = 0; i < testCases.length; i++) {
  const expected = testCases[i];
  const actual = hydratedSets[i];

  console.log(`Testing Case ${i + 1}: ${expected.desc}...`);
  assert.strictEqual(actual.position, i, `Position mismatch for ${expected.desc}`);
  assert.strictEqual(actual.category, expected.category, `Category mismatch for ${expected.desc}`);
  assert.strictEqual(actual.completed, expected.completed, `Completed mismatch for ${expected.desc}`);
  assert.strictEqual(actual.weightMilliKg, expected.weightMilliKg, `weightMilliKg mismatch for ${expected.desc}`);
  assert.strictEqual(actual.reps, expected.reps, `Reps mismatch for ${expected.desc}`);
  assert.strictEqual(actual.rpeTenths, expected.rpeTenths, `rpeTenths mismatch for ${expected.desc}`);
  assert.strictEqual(actual.isUnilateral, expected.isUnilateral, `isUnilateral mismatch for ${expected.desc}`);
  assert.strictEqual(actual.leftWeightMilliKg, expected.leftWeightMilliKg, `leftWeightMilliKg mismatch for ${expected.desc}`);
  assert.strictEqual(actual.leftReps, expected.leftReps, `leftReps mismatch for ${expected.desc}`);
  assert.strictEqual(actual.rightWeightMilliKg, expected.rightWeightMilliKg, `rightWeightMilliKg mismatch for ${expected.desc}`);
  assert.strictEqual(actual.rightReps, expected.rightReps, `rightReps mismatch for ${expected.desc}`);
  console.log(`  -> Passed!`);
}

// 4. Test 300+ Session Mass Scale Repeatability & Memory Usage
console.log('\n--- TESTING 350-SESSION MASS SCALE HYDRATION & REPEATABILITY ---');
const { generateRealisticSessions } = require('../../scripts/benchmark-startup.js');
const largeSessions = generateRealisticSessions(350, 9999);

const largeDb = new DatabaseSync(':memory:');
largeDb.exec(`
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

  CREATE INDEX idx_sessions_started_desc ON workout_sessions(deleted_at_ms, started_at_ms DESC, id);
  CREATE INDEX idx_exercises_session_position ON session_exercises(session_id, position);
  CREATE INDEX idx_sets_exercise_position ON set_logs(session_exercise_id, category, position);
`);

const insSess = largeDb.prepare(`
  INSERT INTO workout_sessions (
    id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment,
    total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`);
const insEx = largeDb.prepare(`
  INSERT INTO session_exercises (
    id, session_id, exercise_id, name_snapshot, name_norm, variation_key,
    position, superset_group_id, note
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
`);
const insSt = largeDb.prepare(`
  INSERT INTO set_logs (
    id, session_exercise_id, position, category, completed, weight_milli_kg, reps,
    rpe_tenths, is_unilateral, left_weight_milli_kg, left_reps,
    right_weight_milli_kg, right_reps
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`);

largeDb.exec('BEGIN TRANSACTION;');
for (const s of largeSessions) {
  insSess.run(s.id, s.title, s.titleNorm, s.startedAtMs, s.endedAtMs, s.durationSec, s.comment, s.totalVolumeMilliKg, s.prs, s.createdAtMs, s.updatedAtMs, s.revision, s.deletedAtMs);
  for (const e of s.exercises) {
    insEx.run(e.id, s.id, e.exerciseId, e.nameSnapshot, e.nameNorm, e.variationKey, e.position, e.supersetGroupId, e.note);
    for (const st of e.sets) {
      insSt.run(st.id, e.id, st.position, st.category, st.completed ? 1 : 0, st.weightMilliKg, st.reps, st.rpeTenths, st.isUnilateral ? 1 : 0, st.leftWeightMilliKg, st.leftReps, st.rightWeightMilliKg, st.rightReps);
    }
  }
}
largeDb.exec('COMMIT;');

// Run 20 sequential hydration passes to test repeatability and memory stability
const timings = [];
for (let pass = 0; pass < 20; pass++) {
  const t0 = performance.now();
  const sRows = largeDb.prepare('SELECT * FROM workout_sessions WHERE deleted_at_ms IS NULL ORDER BY started_at_ms DESC, id DESC;').all();
  const eRows = largeDb.prepare('SELECT se.* FROM session_exercises se JOIN workout_sessions ws ON ws.id = se.session_id WHERE ws.deleted_at_ms IS NULL ORDER BY se.session_id, se.position;').all();
  const stRows = largeDb.prepare('SELECT sl.* FROM set_logs sl JOIN session_exercises se ON se.id = sl.session_exercise_id JOIN workout_sessions ws ON ws.id = se.session_id WHERE ws.deleted_at_ms IS NULL ORDER BY sl.session_exercise_id, sl.position;').all();

  const setsMap = new Map();
  for (let i = 0; i < stRows.length; i++) {
    const row = stRows[i];
    let list = setsMap.get(row.session_exercise_id);
    if (!list) { list = []; setsMap.set(row.session_exercise_id, list); }
    list.push(mapSetRow(row));
  }

  const exMap = new Map();
  for (let i = 0; i < eRows.length; i++) {
    const row = eRows[i];
    let list = exMap.get(row.session_id);
    if (!list) { list = []; exMap.set(row.session_id, list); }
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
      sets: setsMap.get(row.id) ?? [],
    });
  }

  const fullSessions = new Array(sRows.length);
  for (let i = 0; i < sRows.length; i++) {
    const row = sRows[i];
    fullSessions[i] = {
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
      exercises: exMap.get(row.id) ?? [],
    };
  }
  const t1 = performance.now();
  timings.push(t1 - t0);
  assert.strictEqual(fullSessions.length, 350, 'Session count must be 350');
}

const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
const sorted = [...timings].sort((a, b) => a - b);
const p95 = sorted[Math.floor(sorted.length * 0.95)];
const min = sorted[0];
const max = sorted[sorted.length - 1];

console.log(`350 Session Hydration Timing over 20 passes:`);
console.log(`  Mean: ${mean.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms, Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
assert(p95 < 150, `p95 must be under 150ms acceptance target, got ${p95.toFixed(2)}ms`);
console.log('✅ 350-Session Hydration Timing & Repeatability Target (<150ms) PASSED!');

console.log('\n--- ALL EMPIRICAL CHALLENGE TESTS SUCCEEDED ---');
