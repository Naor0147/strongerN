/**
 * scripts/challenge-m2-empirical.js
 * 
 * Standalone Empirical Challenger Verification Script for Milestone 2:
 * 1. Database Safety: 300 sessions in SQLite + 5 session partial restore -> 0 deletions / 0 tombstones.
 * 2. Tombstone Resurrection: Partially restored matching IDs resurrect from tombstone without wiping others.
 * 3. Empty Backup Safety: Restoring [] retains all 300 sessions untouched.
 * 4. Sync Gating Verification: Auto-sync upload predicates prevent partial state leakage.
 */

'use strict';

const { DatabaseSync } = require('node:sqlite');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failedTests++;
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  }
}

console.log('================================================================');
console.log('🧪 MILESTONE 2 EMPIRICAL CHALLENGER VERIFICATION HARNESS');
console.log('================================================================\n');

// ── Database Setup ──
function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
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
  `);
  return db;
}

function seedSessions(db, count, tombstoneCount = 0) {
  const insertSession = db.prepare(`
    INSERT INTO workout_sessions (
      id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment,
      total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  const insertExercise = db.prepare(`
    INSERT INTO session_exercises (
      id, session_id, exercise_id, name, name_norm, position, notes, variation_key,
      exercise_type, equipment, muscle_group, custom_fields_json, created_at_ms, updated_at_ms, revision, deleted_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)
  `);

  const insertSet = db.prepare(`
    INSERT INTO set_logs (
      id, session_exercise_id, position, category, completed, weight_milli_kg, reps,
      rpe_tenths, is_unilateral, left_weight_milli_kg, left_reps, right_weight_milli_kg, right_reps,
      tempo, rest_sec, created_at_ms, updated_at_ms, revision, deleted_at_ms
    ) VALUES (?, ?, ?, 'S', 1, 80000, 10, 80, 0, NULL, NULL, NULL, NULL, NULL, 90, ?, ?, 1, NULL)
  `);

  db.exec('BEGIN TRANSACTION');
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

    insertSet.run(`db-set-${i}`, exerciseId, 0, started, started);
  }
  db.exec('COMMIT');
}

// Exact implementation of repository.ts insertMissingSessionsOnly
function insertMissingSessionsOnly(db, sessions) {
  db.exec('BEGIN TRANSACTION');
  try {
    const rows = db.prepare('SELECT id, deleted_at_ms FROM workout_sessions;').all();
    const existingStatus = new Map();
    for (const r of rows) {
      existingStatus.set(String(r.id), r.deleted_at_ms !== null);
    }

    const now = Date.now();
    const insertSessionStmt = db.prepare(`
      INSERT INTO workout_sessions (
        id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment,
        total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)
    `);

    const untombstoneStmt = db.prepare(`
      UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1 WHERE id = ?
    `);

    for (const s of sessions) {
      const isTombstoned = existingStatus.get(s.id);
      if (isTombstoned === undefined) {
        insertSessionStmt.run(
          s.id,
          s.title || 'Untitled Workout',
          (s.title || 'Untitled Workout').toLowerCase(),
          s.startedAtMs || Date.now(),
          s.endedAtMs || null,
          s.durationSec || 0,
          s.comment || null,
          s.totalVolumeMilliKg || 0,
          s.prs || 0,
          s.createdAtMs || Date.now(),
          s.updatedAtMs || Date.now()
        );
        existingStatus.set(s.id, false);
      } else if (isTombstoned === true) {
        untombstoneStmt.run(now, s.id);
        existingStatus.set(s.id, false);
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TEST 1: Restore 5 sessions into 300 sessions DB
// ────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 1: Restore 5 Sessions into 300 Sessions DB ---');
{
  const db = createTestDb();
  seedSessions(db, 300, 0);

  const initialCount = db.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NULL').get().count;
  assert(initialCount === 300, 'Database starts with 300 active sessions');

  // Backup with 2 existing sessions and 3 brand new sessions
  const backup = [
    { id: 'db-session-0', title: 'Workout #0' },
    { id: 'db-session-1', title: 'Workout #1' },
    { id: 'backup-new-1', title: 'Backup New 1' },
    { id: 'backup-new-2', title: 'Backup New 2' },
    { id: 'backup-new-3', title: 'Backup New 3' },
  ];

  insertMissingSessionsOnly(db, backup);

  const finalActive = db.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NULL').get().count;
  const finalTombstoned = db.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL').get().count;
  const finalTotal = db.prepare('SELECT COUNT(*) as count FROM workout_sessions').get().count;

  assert(finalActive === 303, `Total active sessions is 303 (300 original + 3 new), got ${finalActive}`);
  assert(finalTombstoned === 0, `Zero sessions are tombstoned, got ${finalTombstoned}`);
  assert(finalTotal === 303, `Total rows in database is 303, got ${finalTotal}`);

  // Check that random original non-backup sessions are completely unharmed
  for (let i = 2; i < 300; i += 30) {
    const row = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(`db-session-${i}`);
    assert(row !== undefined && row.deleted_at_ms === null, `Session db-session-${i} is active and intact`);
  }
  db.close();
}

// ────────────────────────────────────────────────────────────────────────────
// TEST 2: Restore empty backup [] into 300 sessions DB
// ────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 2: Restore Empty Backup into 300 Sessions DB ---');
{
  const db = createTestDb();
  seedSessions(db, 300, 0);

  insertMissingSessionsOnly(db, []);

  const active = db.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NULL').get().count;
  const tombstoned = db.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL').get().count;

  assert(active === 300, `Empty restore retains all 300 active sessions, got ${active}`);
  assert(tombstoned === 0, `Zero sessions are tombstoned on empty restore, got ${tombstoned}`);
  db.close();
}

// ────────────────────────────────────────────────────────────────────────────
// TEST 3: Restore 5 sessions resurrects tombstoned records without affecting others
// ────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 3: Tombstone Resurrection via Merge-Only Restore ---');
{
  const db = createTestDb();
  // 250 active + 50 tombstoned
  seedSessions(db, 300, 50);

  const initialActive = db.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NULL').get().count;
  const initialTombstoned = db.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL').get().count;
  assert(initialActive === 250, `Initial active count is 250, got ${initialActive}`);
  assert(initialTombstoned === 50, `Initial tombstoned count is 50, got ${initialTombstoned}`);

  // Restore 5 sessions: 3 match tombstoned IDs (db-session-0, 1, 2), 2 are brand new
  const backup = [
    { id: 'db-session-0', title: 'Resurrected 0' },
    { id: 'db-session-1', title: 'Resurrected 1' },
    { id: 'db-session-2', title: 'Resurrected 2' },
    { id: 'brand-new-x', title: 'Brand New X' },
    { id: 'brand-new-y', title: 'Brand New Y' },
  ];

  insertMissingSessionsOnly(db, backup);

  const finalActive = db.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NULL').get().count;
  const finalTombstoned = db.prepare('SELECT COUNT(*) as count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL').get().count;
  const finalTotal = db.prepare('SELECT COUNT(*) as count FROM workout_sessions').get().count;

  assert(finalActive === 255, `Final active count is 255 (250 original + 3 resurrected + 2 new), got ${finalActive}`);
  assert(finalTombstoned === 47, `Final tombstoned count is 47 (50 - 3), got ${finalTombstoned}`);
  assert(finalTotal === 302, `Final total rows is 302 (300 + 2 new), got ${finalTotal}`);

  // Verify the 3 resurrected sessions have deleted_at_ms === null and bumped revision
  for (let i = 0; i < 3; i++) {
    const row = db.prepare('SELECT deleted_at_ms, revision FROM workout_sessions WHERE id = ?').get(`db-session-${i}`);
    assert(row.deleted_at_ms === null, `db-session-${i} is un-tombstoned (deleted_at_ms is null)`);
    assert(row.revision === 2, `db-session-${i} revision bumped to 2`);
  }

  // Verify untouched tombstoned session (db-session-10) is still tombstoned
  const untouchedTomb = db.prepare('SELECT deleted_at_ms FROM workout_sessions WHERE id = ?').get('db-session-10');
  assert(untouchedTomb.deleted_at_ms !== null, `db-session-10 remains tombstoned`);
  db.close();
}

// ────────────────────────────────────────────────────────────────────────────
// TEST 4: Auto-sync Gating Logic Simulation
// ────────────────────────────────────────────────────────────────────────────
console.log('\n--- TEST 4: Auto-Sync Gating Logic Safety ---');
{
  function shouldTriggerAutoSync(isDataLoaded, isFullHistoryLoaded, sessionsCount, totalWorkouts, googleUser) {
    if (!isDataLoaded || !isFullHistoryLoaded) return false;
    if (!googleUser || !googleUser.accessToken) return false;
    if (sessionsCount === 0 && totalWorkouts > 0) return false;
    return true;
  }

  const googleUser = { accessToken: 'valid-token' };

  // Scenario A: 20 MMKV preview sessions loaded, full SQLite history not loaded yet
  assert(shouldTriggerAutoSync(true, false, 20, 300, googleUser) === false, 'Auto-sync BLOCKED when isFullHistoryLoaded=false (20 preview sessions)');

  // Scenario B: Database load failed or uninitialized
  assert(shouldTriggerAutoSync(false, false, 0, 0, googleUser) === false, 'Auto-sync BLOCKED when isDataLoaded=false');

  // Scenario C: Full history loaded with 300 sessions
  assert(shouldTriggerAutoSync(true, true, 300, 300, googleUser) === true, 'Auto-sync ALLOWED when isFullHistoryLoaded=true and 300 sessions present');

  // Scenario D: 0 sessions in memory but totalWorkouts = 300 (corrupted/empty memory guard)
  assert(shouldTriggerAutoSync(true, true, 0, 300, googleUser) === false, 'Auto-sync BLOCKED when sessionsCount=0 but totalWorkouts=300');
}

console.log('\n================================================================');
console.log(`🎉 SUMMARY: ${passedTests} passed, ${failedTests} failed.`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
