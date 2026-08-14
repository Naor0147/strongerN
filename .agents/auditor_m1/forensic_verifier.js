// .agents/auditor_m1/forensic_verifier.js
// Independent Forensic Instrumentation & Verification Harness

const { DatabaseSync, StatementSync } = require('node:sqlite');
const { performance } = require('node:perf_hooks');
const benchmarkModule = require('../../scripts/benchmark-startup.js');

console.log('================================================================');
console.log('   FORENSIC AUDIT: INSTRUMENTATION & INTEGRITY TRACING          ');
console.log('================================================================\n');

// 1. Trace Database Operations
let sqliteExecCount = 0;
let sqlitePrepareCount = 0;
let sqliteRunCount = 0;
let sqliteAllCount = 0;
let sqliteGetCount = 0;
let totalRowsFetched = 0;

const origExec = DatabaseSync.prototype.exec;
DatabaseSync.prototype.exec = function(sql) {
  sqliteExecCount++;
  return origExec.apply(this, arguments);
};

const origPrepare = DatabaseSync.prototype.prepare;
DatabaseSync.prototype.prepare = function(sql) {
  sqlitePrepareCount++;
  const stmt = origPrepare.apply(this, arguments);
  const origRun = stmt.run;
  const origAll = stmt.all;
  const origGet = stmt.get;

  stmt.run = function() {
    sqliteRunCount++;
    return origRun.apply(this, arguments);
  };
  stmt.all = function() {
    sqliteAllCount++;
    const res = origAll.apply(this, arguments);
    totalRowsFetched += (res ? res.length : 0);
    return res;
  };
  stmt.get = function() {
    sqliteGetCount++;
    return origGet.apply(this, arguments);
  };
  return stmt;
};

// 2. Test Synthetic Data Generation Authenticity
console.log('--- TEST 1: Synthetic Session Generator Fidelity ---');
const sessions0 = benchmarkModule.generateRealisticSessions(0);
const sessions10 = benchmarkModule.generateRealisticSessions(10, 100);
const sessions50 = benchmarkModule.generateRealisticSessions(50, 200);

console.log(`0 sessions generated: length = ${sessions0.length}`);
console.log(`10 sessions generated: length = ${sessions10.length}`);
console.log(`50 sessions generated: length = ${sessions50.length}`);

if (sessions0.length !== 0 || sessions10.length !== 10 || sessions50.length !== 50) {
  console.error('FAIL: Generator length mismatch');
  process.exit(1);
}

// Check deep structure of session 0
const s0 = sessions10[0];
console.log(`Sample Session 0 ID: ${s0.id}, Title: "${s0.title}", startedAt: ${new Date(s0.startedAtMs).toISOString()}`);
console.log(`Exercises in Session 0: ${s0.exercises.length}`);
console.log(`First Exercise: ${s0.exercises[0].nameSnapshot}, Sets: ${s0.exercises[0].sets.length}`);
console.log(`First Set: weight=${s0.exercises[0].sets[0].weightMilliKg}mg, reps=${s0.exercises[0].sets[0].reps}`);

// Verify uniqueness of IDs
const sessionIds = new Set(sessions50.map(s => s.id));
const exerciseIds = new Set();
const setIds = new Set();
for (const s of sessions50) {
  for (const e of s.exercises) {
    exerciseIds.add(e.id);
    for (const st of e.sets) {
      setIds.add(st.id);
    }
  }
}
console.log(`Unique Sessions: ${sessionIds.size} / 50`);
console.log(`Unique Exercises: ${exerciseIds.size}`);
console.log(`Unique Sets: ${setIds.size}`);

if (sessionIds.size !== 50) {
  console.error('FAIL: Duplicate session IDs detected!');
  process.exit(1);
}

// 3. Test Database Seeding & Schema Verification
console.log('\n--- TEST 2: Real SQLite Table Operations & Query Tracking ---');
const { db, legacyData, serializedLegacy, rawByteSize } = benchmarkModule.setupBenchmarkDatabases(sessions10);

console.log(`Database seeded with 10 sessions.`);
console.log(`SQLite Stats during setup:`);
console.log(`  Exec calls (DDL/Pragmas/Transactions): ${sqliteExecCount}`);
console.log(`  Prepare calls: ${sqlitePrepareCount}`);
console.log(`  Run calls (INSERTs): ${sqliteRunCount}`);
console.log(`  Legacy payload raw byte size: ${rawByteSize} bytes`);

// Verify SQLite contains the exact data
const expectedExercises10 = sessions10.reduce((acc, s) => acc + s.exercises.length, 0);
const expectedSets10 = sessions10.reduce((acc, s) => acc + s.exercises.reduce((a, e) => a + e.sets.length, 0), 0);

const countSessions = db.prepare('SELECT count(*) as cnt FROM workout_sessions').get().cnt;
const countExercises = db.prepare('SELECT count(*) as cnt FROM session_exercises').get().cnt;
const countSets = db.prepare('SELECT count(*) as cnt FROM set_logs').get().cnt;
const kvRow = db.prepare('SELECT key, length(value) as len FROM strongern_kv_store WHERE key = ?').get('strongerN_data');

console.log(`Verification Queries:`);
console.log(`  workout_sessions count: ${countSessions} (expected: 10)`);
console.log(`  session_exercises count: ${countExercises} (expected: ${expectedExercises10})`);
console.log(`  set_logs count: ${countSets} (expected: ${expectedSets10})`);
console.log(`  strongern_kv_store entry size: ${kvRow.len} bytes`);

if (countSessions !== 10 || countExercises !== expectedExercises10 || countSets !== expectedSets10) {
  console.error('FAIL: SQLite table counts do not match in-memory data structures!');
  process.exit(1);
}

// 4. Test Strategies Execution
console.log('\n--- TEST 3: Strategy Execution & Dynamic Measurement ---');
sqliteAllCount = 0;
sqliteGetCount = 0;
totalRowsFetched = 0;

const resA = benchmarkModule.benchmarkStrategyA(db);
console.log(`Strategy A result:`);
console.log(`  Storage load: ${resA.storageLoadMs.toFixed(3)}ms, Parse: ${resA.parseExecutionMs.toFixed(3)}ms, Query/Hydrate: ${resA.queryHydrationMs.toFixed(3)}ms, Total: ${resA.mountReadyMs.toFixed(3)}ms`);
console.log(`  Session count: ${resA.sessionCount}, Exercises: ${resA.exerciseCount}, Sets: ${resA.setCount}`);

const resB = benchmarkModule.benchmarkStrategyB(db);
console.log(`Strategy B result:`);
console.log(`  Storage load: ${resB.storageLoadMs.toFixed(3)}ms, Query/Hydrate: ${resB.queryHydrationMs.toFixed(3)}ms, Total: ${resB.mountReadyMs.toFixed(3)}ms`);
console.log(`  Session count: ${resB.sessionCount}, Exercises: ${resB.exerciseCount}, Sets: ${resB.setCount}`);

const resC = benchmarkModule.benchmarkStrategyC(db);
console.log(`Strategy C result:`);
console.log(`  Storage load: ${resC.storageLoadMs.toFixed(3)}ms, Query/Hydrate: ${resC.queryHydrationMs.toFixed(3)}ms, Total: ${resC.mountReadyMs.toFixed(3)}ms`);
console.log(`  Session count: ${resC.sessionCount}, Exercises: ${resC.exerciseCount}, Sets: ${resC.setCount}`);

console.log(`\nSQLite Query Activity during Strategy Executions:`);
console.log(`  Total SELECT .all() calls: ${sqliteAllCount}`);
console.log(`  Total SELECT .get() calls: ${sqliteGetCount}`);
console.log(`  Total rows fetched across queries: ${totalRowsFetched}`);

// 5. Test Interactive State Save Benchmark
console.log('\n--- TEST 4: Interactive State Save Verification ---');
const mutRes = benchmarkModule.benchmarkInteractiveStateSave(sessions10);
console.log(`Interactive State Save results:`);
console.log(`  Legacy Save Mean: ${mutRes.legacySave.mean}ms (p95: ${mutRes.legacySave.p95}ms)`);
console.log(`  Delta Save Mean: ${mutRes.deltaSave.mean}ms (p95: ${mutRes.deltaSave.p95}ms)`);

console.log('\n================================================================');
console.log('   FORENSIC VERIFICATION COMPLETE: ALL INTEGRITY CHECKS PASSED  ');
console.log('================================================================');
