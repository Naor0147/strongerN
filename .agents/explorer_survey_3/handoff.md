# Handoff Report — Explorer 3: SQLite Database, Schema, Queries, Tests & Benchmarking

**Agent:** Explorer 3 (Read-Only Performance & SQLite Architecture Specialist)  
**Date:** 2026-08-14  
**Working Directory:** `C:\Antigravity\strongerN\.agents\explorer_survey_3`  
**Parent Agent:** `e501394b-c3e5-462e-971f-3cb8db49351e` (Orchestrator)  
**Handoff Type:** Hard (Task complete)

---

## 1. Observation

1. **Monolithic KV Store vs Relational V2 DB**:
   - `src/utils/db.ts` (lines 8–69): Uses `strongern.db` with table `strongern_kv_store (key TEXT PRIMARY KEY, value TEXT)`. `saveToDb` does `JSON.stringify(value)` and writes both to `window.localStorage` and SQLite table without WAL or transaction pragmas.
   - `src/storage/dbSingleton.ts` (lines 12–39): Manages `strongern_v2.db` with `PRAGMA journal_mode = WAL;`, `PRAGMA foreign_keys = ON;`, `PRAGMA busy_timeout = 5000;`.
   - `src/storage/history/schema.ts` (lines 6–72): Defines relational tables `persistence_meta`, `workout_sessions`, `session_exercises`, and `set_logs`, with indices `idx_sessions_started_desc`, `idx_sessions_title_started`, `idx_exercises_lookup`, `idx_exercises_session_position`, `idx_sets_exercise_position`.

2. **Root State Dual-Write & Serialization**:
   - `src/App.tsx` (lines 545–602): A `useEffect` listening to `[user, sessionsList, templatesList, exercisesList, ...settings]` constructs a massive `data` object including `sessionsList` (300+ workouts) and calls `saveToDb(STORAGE_KEY, data)`. Any settings change serializes the full workout history as a monolithic JSON string.

3. **Destructive Full-History Reconciliation Overhead**:
   - `src/App.tsx` (lines 605–621): `useEffect` on `[isDataLoaded, sessionsList]` calls `reconcileSessions(normalized)` after 250ms debounce.
   - `src/storage/history/repository.ts` (lines 100–117): `reconcileSessions` executes `for (const session of sessions) await writeSession(db, session);`.
   - `src/storage/history/repository.ts` (lines 39–81): `writeSession` executes 1 `INSERT INTO workout_sessions ... ON CONFLICT`, 1 `DELETE FROM session_exercises`, and iterates through all exercises and sets doing single-row `INSERT`s. For 300 workouts (~1,800 exercises, ~6,300 sets), this executes **8,700+ synchronous SQLite queries inside one transaction**.

4. **Cold Start Hydration Bottleneck**:
   - `src/App.tsx` (lines 384–422) & `src/storage/persistenceBootstrap.ts` (lines 44–90): On launch, the app calls `loadFromDb(STORAGE_KEY)` (parsing multi-megabyte JSON), `fingerprintLegacySessions` (stringifying 300 sessions to compute checksum), and `loadAllSessions()` (running batched `SELECT` queries across `workout_sessions`, `session_exercises`, and `set_logs` with up to 2,500 parameters in `IN (...)` clauses).

5. **In-Memory JS-Thread Analytics Scans**:
   - `src/screens/ExercisesScreen.tsx` (lines 113–156): `computeEnrichedExercises` iterates over all sessions and exercises on the JS thread.
   - `src/utils/exerciseStats.ts` (lines 17–148): `setsPerWeek`, `avgRepsPerWorkout`, `lastPerformed`, `totalSetsAllTime` iterate and filter the entire `sessions` array.
   - `src/utils/strength.ts` (lines 47–80): `exercise1RMSeries` sorts and filters all sessions on the JS thread.

6. **Test Suites & Node.js Environment**:
   - Running `npm run typecheck` (`tsc --noEmit`) passes with **0 errors**.
   - Running `npm test` (`jest`) passes **12/12 test suites, 94/94 tests, 6/6 snapshots** in ~2.4s.
   - Node.js `v22.22.3` and npm `10.9.8` are installed at `F:\.fnm\node-versions\v22.22.3\installation`.
   - Node v22 provides native `node:sqlite` (`DatabaseSync`), allowing high-speed in-memory or on-disk SQLite testing and benchmarking without external native dependencies.

---

## 2. Logic Chain

1. **Observation 1 & 2** show that the root React state is coupled with heavy historical session logs. Every minor UI toggle or settings update forces synchronous serialization of all 300 sessions and writes to `strongern_kv_store`.
2. **Observation 3** shows that whenever `sessionsList` changes, `reconcileSessions` deletes and re-inserts all 300 workouts, generating ~8,700 SQLite queries per change.
3. **Observation 4** shows that startup time is gated by dual redundant hydration: reading monolithic JSON from `strongern_kv_store`, stringifying it for fingerprinting, and reading all rows from `strongern_v2.db`.
4. **Observation 5** shows that screen rendering (Profile, History, Exercises, Muscle Map) triggers unindexed full-array scans on the JS thread.
5. **Observation 6** confirms the test environment is healthy and Node 22 native SQLite can be used to construct a fast, repeatable benchmark script (`scripts/benchmark-startup.js`).
6. **Therefore**, the primary performance path requires:
   - Decoupling settings (`strongern_settings_v2`) from heavy workout logs.
   - Replacing full-history reconciliation with incremental single-session writes (`upsertSession`, `softDeleteSession`).
   - Fast-path startup loading bypassing legacy JSON deserialization when SQLite V2 is verified.
   - Automated benchmark script measuring 0, 50, 300+ workouts cold start, SQLite query duration, and memory footprint.

---

## 3. Caveats

1. **Web Platform Fallback**: `window.localStorage` remains the sole persistence layer on web (`Platform.OS === 'web'`). Relational SQLite V2 features operate only on native iOS/Android (and Node simulation).
2. **Migration Backward Compatibility**: Existing users upgrading from legacy versions still require one-time migration from `strongern_app_data_v1` into relational tables, which must be preserved without data loss.
3. **Cloud Backup / Export Manifests**: `backupManager.ts` and Google Drive sync export full JSON backups (`BackupManifestV3`), which will still aggregate session history during export.

---

## 4. Conclusion

1. **Schema & Indexing**: The normalized SQLite schema in `src/storage/history/schema.ts` is well-structured with integer milligram precision and appropriate cascading foreign keys. Minor indexing redundancy exists on `session_exercises(session_id, position)` with the unique constraint.
2. **Bottleneck Root Causes**:
   - Synchronous monolithic `JSON.parse` / `JSON.stringify` on every startup and settings change.
   - Destructive 8,700-query `reconcileSessions` loop executed on session updates.
   - Dual-read hydration on bootstrap.
3. **Automated Benchmarking Blueprint**: A standalone `scripts/benchmark-startup.js` utilizing `node:sqlite` and high-resolution timers (`performance.now()`, `process.memoryUsage()`) can measure 0, 50, and 300+ sessions across storage load, SQLite query hydration, and heap deltas, enforcing the $<150\text{ms}$ startup requirement.

---

## 5. Verification Method

To verify these findings independently:

1. **Run TypeScript Type Check**:
   ```powershell
   $env:PATH = "F:\.fnm\node-versions\v22.22.3\installation;C:\Users\NAORA\AppData\Roaming\npm;" + $env:PATH
   npm run typecheck
   ```
   *Expected Output*: Exit code 0, 0 errors.

2. **Run Full Jest Test Suite**:
   ```powershell
   $env:PATH = "F:\.fnm\node-versions\v22.22.3\installation;C:\Users\NAORA\AppData\Roaming\npm;" + $env:PATH
   npm test
   ```
   *Expected Output*: 12 suites passed, 94 tests passed, 6 snapshots passed.

3. **Inspect Key Source Files**:
   - `src/storage/history/schema.ts` (Relational schema & indices)
   - `src/storage/history/repository.ts` (Lines 100–117: `reconcileSessions` loop)
   - `src/storage/persistenceBootstrap.ts` (Lines 44–90: `bootstrapPersistence` & `fingerprintLegacySessions`)
   - `src/App.tsx` (Lines 384–422: startup hydration, Lines 545–602: monolithic save, Lines 605–621: reconcile hook)
   - `src/utils/db.ts` (Lines 40–69: `saveToDb` monolithic KV write)

4. **Verify Survey Report Artifact**:
   - Inspect `C:\Antigravity\strongerN\.agents\explorer_survey_3\survey_report.md`.
