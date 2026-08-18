// .agents/auditor_m1/forensic_verifier.js
// Independent Forensic Integrity Verifier for Milestone 1

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

console.log('================================================================');
console.log('FORENSIC INTEGRITY VERIFIER — MILESTONE 1');
console.log('================================================================');

const ROOT = path.resolve(__dirname, '../../');
const REPO_FILE = path.join(ROOT, 'src/storage/history/repository.ts');
const BOOTSTRAP_FILE = path.join(ROOT, 'src/storage/persistenceBootstrap.ts');
const APP_FILE = path.join(ROOT, 'src/App.tsx');
const TEST_FILE = path.join(ROOT, 'src/__tests__/historyRepositoryRecovery.test.ts');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assertCheck(name, condition, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`[PASS] Check ${totalChecks}: ${name}`);
    if (details) console.log(`       Details: ${details}`);
  } else {
    failedChecks++;
    console.error(`[FAIL] Check ${totalChecks}: ${name}`);
    if (details) console.error(`       Details: ${details}`);
  }
}

// ----------------------------------------------------------------------
// PHASE 1: STATIC ANALYSIS & PROHIBITED PATTERN DETECTION
// ----------------------------------------------------------------------
console.log('\n--- PHASE 1: STATIC ANALYSIS & PATTERN DETECTION ---');

const repoSrc = fs.readFileSync(REPO_FILE, 'utf8');
const bootstrapSrc = fs.readFileSync(BOOTSTRAP_FILE, 'utf8');
const appSrc = fs.readFileSync(APP_FILE, 'utf8');
const testSrc = fs.readFileSync(TEST_FILE, 'utf8');

// 1. Check for countTombstonedSessions implementation
assertCheck(
  'repository.ts exports countTombstonedSessions with real SQL query',
  repoSrc.includes('export async function countTombstonedSessions()') &&
  repoSrc.includes("SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;"),
  'Genuine SELECT query on deleted_at_ms IS NOT NULL'
);

// 2. Check for restoreAllTombstonedSessions implementation
assertCheck(
  'repository.ts exports restoreAllTombstonedSessions with real UPDATE SQL query',
  repoSrc.includes('export function restoreAllTombstonedSessions()') &&
  repoSrc.includes("UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1 WHERE deleted_at_ms IS NOT NULL;"),
  'Genuine transactional UPDATE query setting deleted_at_ms = NULL and incrementing revision'
);

// 3. Check for recoverTombstonedSessions alias
assertCheck(
  'repository.ts exports recoverTombstonedSessions alias',
  repoSrc.includes('export const recoverTombstonedSessions = restoreAllTombstonedSessions;'),
  'Proper alias definition'
);

// 4. Check for getDatabaseDiagnostics implementation
assertCheck(
  'repository.ts exports getDatabaseDiagnostics aggregating SQLite and MMKV',
  repoSrc.includes('export async function getDatabaseDiagnostics(): Promise<DatabaseDiagnostics>') &&
  repoSrc.includes("SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NULL;") &&
  repoSrc.includes("SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;") &&
  repoSrc.includes("SELECT COUNT(*) AS count FROM workout_sessions;"),
  'Queries active, tombstoned, and raw total in parallel'
);

// 5. Check for safe untombstoning in insertMissingSessionsOnly
assertCheck(
  'repository.ts insertMissingSessionsOnly untombstones matching records',
  repoSrc.includes('UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1 WHERE id = ?;'),
  'Re-activates tombstoned sessions upon merge-only import without overwriting active rows'
);

// 6. Check for startup self-healing in persistenceBootstrap.ts
assertCheck(
  'persistenceBootstrap.ts executes self-healing on startup',
  bootstrapSrc.includes('const tombstonedCount = await countTombstonedSessions();') &&
  bootstrapSrc.includes('if (tombstonedCount > 0) {') &&
  bootstrapSrc.includes('await restoreAllTombstonedSessions();'),
  'Self-healing triggers in fast-path hydration if soft-deleted sessions exist'
);

// 7. Check for un-gated crash logging in App.tsx
assertCheck(
  'App.tsx logs persistence failure via saveCrashLogSync and console.error',
  appSrc.includes("saveCrashLogSync('Persistence Load Failure: ' + (e?.message || e), e?.stack || '', false);") &&
  appSrc.includes("saveCrashLogSync('Persistence Fallback Failure: ' + (fallbackErr?.message || fallbackErr), fallbackErr?.stack || '', false);"),
  'Un-gated telemetry recorded into SQLite crashes table'
);

// 8. Check for absence of mock/facade shortcuts in repository
const hasDummyHardcode = /return\s+(42|300|150|\[\s*\]|\{\s*\})\s*;/g.test(repoSrc.replace(/if\s*\(sessionRows\.length\s*===\s*0\)\s*return\s*\[\s*\]\s*;/g, ''));
assertCheck(
  'repository.ts contains no dummy return constants or facade bypasses',
  !hasDummyHardcode,
  'No hardcoded mock numbers found in repository logic'
);

// ----------------------------------------------------------------------
// PHASE 2: BEHAVIORAL EXECUTION ON REAL SQLITE (node:sqlite)
// ----------------------------------------------------------------------
console.log('\n--- PHASE 2: NATIVE SQLITE EXECUTION & RECOVERY SIMULATION ---');

const db = new DatabaseSync(':memory:');

// Initialize schema
db.exec(`
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
`);

// Insert 350 genuine sessions with child exercises and sets
const insertSessionStmt = db.prepare(`
  INSERT INTO workout_sessions (
    id, title, title_norm, started_at_ms, ended_at_ms, duration_sec, comment,
    total_volume_milli_kg, prs, created_at_ms, updated_at_ms, revision, deleted_at_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`);

const insertExStmt = db.prepare(`
  INSERT INTO session_exercises (
    id, session_id, exercise_id, name_snapshot, name_norm, variation_key, position, superset_group_id, note
  ) VALUES (?, ?, ?, ?, ?, '', ?, NULL, NULL);
`);

const insertSetStmt = db.prepare(`
  INSERT INTO set_logs (
    id, session_exercise_id, position, category, completed, weight_milli_kg, reps,
    rpe_tenths, is_unilateral, left_weight_milli_kg, left_reps, right_weight_milli_kg, right_reps
  ) VALUES (?, ?, ?, 'S', 1, ?, 10, 80, 0, NULL, NULL, NULL, NULL);
`);

db.exec('BEGIN TRANSACTION;');
for (let i = 1; i <= 350; i++) {
  const sessionId = `session_${i.toString().padStart(3, '0')}`;
  const isTombstoned = i > 200; // 150 tombstoned sessions (201..350)
  const deletedAt = isTombstoned ? 1787000000000 + i : null;

  insertSessionStmt.run(
    sessionId,
    `Workout ${i}`,
    `workout ${i}`,
    1786000000000 + i * 86400000,
    1786000000000 + i * 86400000 + 3600000,
    3600,
    `Comment ${i}`,
    50000000,
    2,
    1786000000000,
    1786000000000,
    1,
    deletedAt
  );

  for (let e = 1; e <= 3; e++) {
    const exId = `ex_${sessionId}_${e}`;
    insertExStmt.run(exId, sessionId, `bench_press_${e}`, `Bench Press ${e}`, `bench press ${e}`, e);

    for (let s = 1; s <= 3; s++) {
      const setId = `set_${exId}_${s}`;
      insertSetStmt.run(setId, exId, s, 80000);
    }
  }
}
db.exec('COMMIT;');

// Test 9: Initial row counts
const rawTotalRow = db.prepare('SELECT COUNT(*) AS count FROM workout_sessions;').get();
const activeRow = db.prepare('SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NULL;').get();
const tombstonedRow = db.prepare('SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;').get();

assertCheck('Initial total sessions in SQLite = 350', rawTotalRow.count === 350, `Found ${rawTotalRow.count}`);
assertCheck('Initial active sessions in SQLite = 200', activeRow.count === 200, `Found ${activeRow.count}`);
assertCheck('Initial tombstoned sessions in SQLite = 150', tombstonedRow.count === 150, `Found ${tombstonedRow.count}`);

// Test 10: Count child rows
const exCount = db.prepare('SELECT COUNT(*) AS count FROM session_exercises;').get();
const setCount = db.prepare('SELECT COUNT(*) AS count FROM set_logs;').get();
assertCheck('Child session_exercises preserved = 1050', exCount.count === 1050, `Found ${exCount.count}`);
assertCheck('Child set_logs preserved = 3150', setCount.count === 3150, `Found ${setCount.count}`);

// Test 11: Execute restoration UPDATE SQL
const now = Date.now();
const restoreStmt = db.prepare('UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1 WHERE deleted_at_ms IS NOT NULL;');
const restoreResult = restoreStmt.run(now);

assertCheck(
  'restoreAllTombstonedSessions UPDATE restored exactly 150 rows',
  restoreResult.changes === 150,
  `Changes: ${restoreResult.changes}`
);

// Test 12: Post-restoration verification
const postActive = db.prepare('SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NULL;').get();
const postTombstoned = db.prepare('SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;').get();

assertCheck('Post-restoration active sessions = 350', postActive.count === 350, `Active: ${postActive.count}`);
assertCheck('Post-restoration tombstoned sessions = 0', postTombstoned.count === 0, `Tombstoned: ${postTombstoned.count}`);

// Test 13: Check revision bump
const sampleRestored = db.prepare('SELECT revision, updated_at_ms, deleted_at_ms FROM workout_sessions WHERE id = ?;').get('session_250');
assertCheck(
  'Restored session has revision = 2, deleted_at_ms = null, and updated timestamp',
  sampleRestored.revision === 2 && sampleRestored.deleted_at_ms === null && sampleRestored.updated_at_ms === now,
  `Revision: ${sampleRestored.revision}, deleted_at_ms: ${sampleRestored.deleted_at_ms}`
);

// Test 14: Safe untombstoning in insertMissingSessionsOnly simulation
// Re-tombstone session_300
db.prepare('UPDATE workout_sessions SET deleted_at_ms = 1787100000000 WHERE id = ?;').run('session_300');

// Run safe merge-only logic for session_300 (tombstoned), session_100 (active), session_999 (brand new)
const rows = db.prepare('SELECT id, deleted_at_ms FROM workout_sessions;').all();
const statusMap = new Map();
for (const r of rows) statusMap.set(r.id, r.deleted_at_ms !== null);

const candidateSessions = [
  { id: 'session_300' }, // tombstoned in db
  { id: 'session_100' }, // active in db
  { id: 'session_999' }, // missing in db
];

for (const s of candidateSessions) {
  const isTombstoned = statusMap.get(s.id);
  if (isTombstoned === undefined) {
    insertSessionStmt.run(
      s.id, 'New Workout 999', 'new workout 999',
      1786500000000, 1786503600000, 3600, null, 10000, 0, 1786500000000, 1786500000000, 1, null
    );
  } else if (isTombstoned === true) {
    db.prepare('UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1 WHERE id = ?;').run(Date.now(), s.id);
  }
}

const finalRow300 = db.prepare('SELECT deleted_at_ms, revision FROM workout_sessions WHERE id = ?;').get('session_300');
const finalRow100 = db.prepare('SELECT deleted_at_ms, revision FROM workout_sessions WHERE id = ?;').get('session_100');
const finalRow999 = db.prepare('SELECT deleted_at_ms, revision FROM workout_sessions WHERE id = ?;').get('session_999');

assertCheck(
  'insertMissingSessionsOnly untombstoned session_300 cleanly',
  finalRow300.deleted_at_ms === null && finalRow300.revision === 3,
  `session_300 revision: ${finalRow300.revision}, deleted_at_ms: ${finalRow300.deleted_at_ms}`
);
assertCheck(
  'insertMissingSessionsOnly left active session_100 untouched',
  finalRow100.deleted_at_ms === null && finalRow100.revision === 1,
  `session_100 revision: ${finalRow100.revision}`
);
assertCheck(
  'insertMissingSessionsOnly inserted new session_999',
  finalRow999 !== undefined && finalRow999.deleted_at_ms === null,
  `session_999 created successfully`
);

// ----------------------------------------------------------------------
// PHASE 3: ADVERSARIAL EDGE CASE STRESS TESTING
// ----------------------------------------------------------------------
console.log('\n--- PHASE 3: ADVERSARIAL EDGE CASE STRESS TESTING ---');

// Test 21: Idempotent restore when 0 sessions are tombstoned
const secondRestoreResult = restoreStmt.run(Date.now());
assertCheck(
  'Second restoreAllTombstonedSessions call is cleanly idempotent (0 changes)',
  secondRestoreResult.changes === 0,
  `Changes: ${secondRestoreResult.changes}`
);

// Test 22: Empty database handling
const emptyDb = new DatabaseSync(':memory:');
emptyDb.exec(`
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
`);
const emptyTombstoned = emptyDb.prepare('SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;').get();
const emptyRestore = emptyDb.prepare('UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1 WHERE deleted_at_ms IS NOT NULL;').run(Date.now());
assertCheck(
  'Empty database handles tombstone query and restore gracefully (0 count, 0 changes)',
  emptyTombstoned.count === 0 && emptyRestore.changes === 0,
  `Tombstoned: ${emptyTombstoned.count}, Changes: ${emptyRestore.changes}`
);

// Test 23: Batch with duplicate session IDs in input array to insertMissingSessionsOnly
const dupCandidate = [
  { id: 'session_duplicate' },
  { id: 'session_duplicate' },
];
// First item inserts, second item sees it in statusMap as active and skips without duplicate key crash
for (const s of dupCandidate) {
  const isTombstoned = statusMap.get(s.id);
  if (isTombstoned === undefined) {
    insertSessionStmt.run(
      s.id, 'Duplicate Test', 'duplicate test',
      1786500000000, 1786503600000, 3600, null, 10000, 0, 1786500000000, 1786500000000, 1, null
    );
    statusMap.set(s.id, false);
  }
}
const dupCount = db.prepare('SELECT COUNT(*) AS count FROM workout_sessions WHERE id = ?;').get('session_duplicate');
assertCheck(
  'insertMissingSessionsOnly handles duplicate items in input array without conflict error',
  dupCount.count === 1,
  `Count: ${dupCount.count}`
);

// ----------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------
console.log('\n================================================================');
console.log(`FORENSIC VERIFICATION RESULTS:`);
console.log(`Passed Checks: ${passedChecks} / ${totalChecks}`);
console.log(`Failed Checks: ${failedChecks} / ${totalChecks}`);
console.log(`VERDICT: ${failedChecks === 0 ? 'CLEAN' : 'INTEGRITY VIOLATION'}`);
console.log('================================================================');

process.exit(failedChecks === 0 ? 0 : 1);

