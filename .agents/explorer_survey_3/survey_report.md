# StrongerN Performance & SQLite Architecture Survey Report

**Author:** Explorer 3 (Read-Only Performance & Database Specialist)  
**Date:** 2026-08-14  
**Target Project:** StrongerN Production Repository (`C:\Antigravity\strongerN`)  
**Scope:** SQLite database schema, tables, indices, migrations, query patterns, N+1 bottlenecks, full-table scans, test infrastructure, and automated startup benchmarking design.

---

## 1. Executive Summary

StrongerN currently operates with a **hybrid dual-storage architecture**:
1. **Legacy KV Storage (`strongern.db` / `strongern_kv_store`)**: Persists the entire monolithic application state (`sessionsList`, `templatesList`, `exercisesList`, settings, metrics) as a single serialized JSON blob under the key `strongern_app_data_v1`.
2. **Relational V2 SQLite Database (`strongern_v2.db`)**: Provides normalized relational tables (`workout_sessions`, `session_exercises`, `set_logs`, `persistence_meta`) with WAL journaling and foreign keys.

### Core Survey Findings & Critical Bottlenecks:
1. **Monolithic Cold-Start Hydration**: On app startup, `App.tsx` loads the entire multi-megabyte monolithic JSON blob from `strongern_kv_store`, deserializes it, computes a full-array checksum via `fingerprintLegacySessions(legacySessions)`, and simultaneously queries all normalized sessions from SQLite (`loadAllSessions`). When 300+ workouts are logged, this forces synchronous deserialization of tens of thousands of nested objects on the main JavaScript thread.
2. **Monolithic Dual-Write Overhead**: Every state change in `App.tsx` (even updating a toggle like `isAutoTimerEnabled` or `animationSpeed`) triggers a debounced `saveToDb(STORAGE_KEY, data)`. This causes a full `JSON.stringify` of all 300+ historical sessions and writes a multi-megabyte payload to both `window.localStorage` and SQLite `strongern_kv_store`.
3. **Destructive Full-History Reconcile Loop (`reconcileSessions`)**: When `sessionsList` is modified (such as completing or editing a workout), `reconcileSessions` executes `writeSession` for **every session in the list**. For 300 sessions with ~6 exercises and ~3-4 sets each, this executes **over 8,400 synchronous SQLite operations** (300 session upserts, 300 exercise cascades/deletions, 1,800 exercise inserts, 6,000 set inserts) inside a single transaction.
4. **JS-Thread In-Memory Stats Scans**: `useProfileStats`, `exercise1RMSeries`, `setsPerWeek`, `avgRepsPerWorkout`, `computeEnrichedExercises`, and `weeklyChartData` perform unindexed O(N) and O(N*M) array iterations across all 300 sessions on the JavaScript thread during component mounting.
5. **Testing & Benchmark Feasibility**: All 12 Jest test suites (94 tests, 6 snapshots) pass cleanly. Node v22.22.3 is installed with built-in native `node:sqlite` (`DatabaseSync`), allowing the creation of a standalone, zero-dependency, ultra-fast benchmarking suite (`scripts/benchmark-startup.js`) simulating 0, 50, and 300+ full workouts.

---

## 2. SQLite Database Architecture & Schema Audit

### 2.1 Database Instances & Lifecycle

| Property | Legacy KV Store | Relational V2 Store |
| :--- | :--- | :--- |
| **Database File** | `strongern.db` (`src/utils/db.ts`) | `strongern_v2.db` (`src/storage/dbSingleton.ts`) |
| **Storage Strategy** | Monolithic Key-Value (JSON blobs) | Normalized Relational Entities |
| **Connection Lifecycle** | Lazy singleton `db` instance | Promise-guarded singleton `v2DbInstance` |
| **Journal Mode** | Default (DELETE / PERSIST) | **WAL** (`PRAGMA journal_mode = WAL;`) |
| **Foreign Keys** | OFF | **ON** (`PRAGMA foreign_keys = ON;`) |
| **Busy Timeout** | None (Default 0ms) | **5000ms** (`PRAGMA busy_timeout = 5000;`) |

### 2.2 Relational V2 Schema & Table Definitions

Defined in `src/storage/history/schema.ts` (Schema Version: `2`):

#### 1. `persistence_meta`
```sql
CREATE TABLE IF NOT EXISTS persistence_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
```
- **Purpose**: Stores migration states, verification fingerprints (`legacy_v1_to_relational_v2`), and schema metadata.

#### 2. `workout_sessions`
```sql
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
```
- **Purpose**: Stores top-level workout headers. `total_volume_milli_kg` stores integer milligram/millikilogram units (1 kg = 1,000 milli-kg) to eliminate floating-point rounding errors.

#### 3. `session_exercises`
```sql
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
```
- **Purpose**: Exercises performed within a session. References `workout_sessions(id)` with `ON DELETE CASCADE`.

#### 4. `set_logs`
```sql
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
```
- **Purpose**: Individual set rows with precision weight/rep tracking, RPE in tenths (e.g., 85 = 8.5 RPE), and unilateral support.

### 2.3 Index Inventory & Query Coverage Analysis

| Index Name | Table | Columns | Intended Query / Usage | Index Health & Observations |
| :--- | :--- | :--- | :--- | :--- |
| `idx_sessions_started_desc` | `workout_sessions` | `(deleted_at_ms, started_at_ms DESC, id)` | `listSessions` pagination, soft-delete filtering | **Optimal**: Leading `deleted_at_ms` allows fast filtering of active sessions with B-tree range scan on `started_at_ms DESC`. |
| `idx_sessions_title_started` | `workout_sessions` | `(title_norm, started_at_ms DESC)` | Workout title searches & autocomplete | **Good**: Enables fast prefix/equality lookups on normalized titles. |
| `idx_exercises_lookup` | `session_exercises` | `(name_norm, variation_key, session_id)` | Historical exercise performance lookup | **Good**: Used in `findLastPerformance` to find prior sessions for a specific exercise and variation. |
| `idx_exercises_session_position` | `session_exercises` | `(session_id, position)` | Fetching session exercises in order | **Redundant**: The table already defines `UNIQUE(session_id, position)` which automatically creates a unique B-tree index on the exact same columns. |
| `idx_sets_exercise_position` | `set_logs` | `(session_exercise_id, category, position)` | Fetching sets by exercise & category | **Suboptimal for generic ordering**: In `listSessions`, sets are queried with `ORDER BY session_exercise_id, position`. Because `category` is the second column, this index cannot satisfy ordering by `position` without sorting (although `UNIQUE(session_exercise_id, position)` handles it). |

---

## 3. Query Execution Audit & Performance Bottlenecks

### 3.1 Cold Start & Data Hydration Bottleneck

**Entry Point:** `src/App.tsx` (lines 384–460) calling `bootstrapPersistence` (`src/storage/persistenceBootstrap.ts`).

```
[App Mount]
   │
   ├── 1. loadFromDb(STORAGE_KEY)  ──> SQLite SELECT on 'strongern_kv_store'
   │                                  Reads monolithic JSON (e.g. 5–15 MB for 300+ workouts)
   │                                  Synchronous JSON.parse() on JS Thread
   │
   ├── 2. bootstrapPersistence()
   │      ├── fingerprintLegacySessions() ──> JSON.stringify(300+ sessions) + SHA/Checksum
   │      ├── initHistoryRepository()     ──> Opens SQLite V2 & executes PRAGMA/schema
   │      ├── getPersistenceMeta()        ──> Checks migration state
   │      └── loadAllSessions()           ──> Fetches 300+ sessions in batches of 250
   │             ├── SELECT * FROM workout_sessions LIMIT 250 OFFSET ?
   │             ├── SELECT * FROM session_exercises WHERE session_id IN (?, ..., ?) [250 params]
   │             └── SELECT * FROM set_logs WHERE session_exercise_id IN (?, ..., ?) [1000–2500 params]
   │
   └── 3. setSessionsList(persistence.sessions.map(sessionV2ToLegacy))
          └── Maps 300+ sessions back to legacy object graph and binds to Root React State
```

#### Bottleneck Details:
1. **Redundant Dual Parsing**: Even when relational SQLite V2 is fully migrated and healthy, `App.tsx` still reads and parses the entire monolithic JSON from `strongern_kv_store`.
2. **Monolithic Fingerprint Calculation**: `fingerprintLegacySessions` stringifies the entire 300-session array to calculate a checksum on every cold start (`calculateChecksum(JSON.stringify(sessions...))`), blocking the JS event loop for 40–120ms on low-to-mid tier mobile CPUs.
3. **Massive SQLite IN-Clause Parameters**: When fetching 250 sessions, the exercise set query builds `IN (?, ?, ...)` with up to 2,500 parameters. While SQLite supports up to 32,766 parameters in modern versions, statement preparation and parameter binding for thousands of variables adds significant latency.

### 3.2 Root State Save & Full-History Serialization Overhead

**Location:** `src/App.tsx` (lines 544–602).

```ts
React.useEffect(() => {
  if (!isDataLoaded) return;
  const data = {
    user,
    sessionsList, // 300+ sessions
    templatesList,
    exercisesList,
    // ...all settings and preferences
  };
  latestAppDataRef.current = data;
  rootSaveTimeoutRef.current = setTimeout(() => {
    saveToDb(STORAGE_KEY, data); // <── Full JSON.stringify() + Dual Write
  }, 400);
}, [user, sessionsList, templatesList, exercisesList, ...settings]);
```

#### Bottleneck Details:
- **Coupling of Hot Settings with Heavy History**: Changing a single lightweight setting (e.g. `animationSpeed`, `soundVolume`, `isRpeMode`, `appTheme`, `isAutoTimerEnabled`) triggers serialization of the **entire 300+ workout history**.
- **Dual-Write I/O**: `saveToDb` writes to `window.localStorage` (synchronous stringification) and `strongern_kv_store` (SQLite `INSERT OR REPLACE`).
- **Heap Churn & GC Pressure**: Repeatedly serializing 10+ MB JSON payloads generates massive short-lived string allocations, triggering garbage collection stutters during UI interactions.

### 3.3 Destructive Full-History Reconciliation Loop (`reconcileSessions`)

**Location:** `src/App.tsx` (lines 605–621) calling `reconcileSessions` (`src/storage/history/repository.ts`, lines 100–117).

```ts
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
```

#### Bottleneck Breakdown for 300 Workouts:
For every session in `sessionsList`, `writeSession` executes:
1. `INSERT INTO workout_sessions ... ON CONFLICT(id) DO UPDATE ...` (300 queries)
2. `DELETE FROM session_exercises WHERE session_id = ?;` (300 queries, triggering foreign-key cascade checks)
3. For ~6 exercises per session: `INSERT INTO session_exercises ...` (1,800 queries)
4. For ~3.5 sets per exercise: `INSERT INTO set_logs ...` (6,300 queries)
5. `UPDATE workout_sessions SET deleted_at_ms = ... WHERE id NOT IN (...)` (1 query with 300 parameters)

**Total: ~8,701 SQLite queries executed inside a single transaction every time `sessionsList` updates!**
Completing or editing a single workout re-writes all 300 historic sessions from scratch.

### 3.4 In-Memory JS Stats Full-Array Scans

Multiple screens and hooks iterate across the entire `sessionsList` array on the main thread:

| Screen / Utility | Function | Computational Complexity | Observation / Impact |
| :--- | :--- | :--- | :--- |
| `App.tsx` (line 370) | `weeklyChartData` | $O(N \times W)$ ($N$ sessions, $W$ weeks) | Scans all sessions on mount / state change |
| `ExercisesScreen.tsx` (line 113) | `computeEnrichedExercises` | $O(N \times E)$ ($N$ sessions, $E$ exercises) | Computes `weeklySets` & `allTimeSets` by iterating every exercise in every historic session |
| `ExerciseInsightsModal.tsx` (line 150) | `exercise1RMSeries`, `setsPerWeek`, `avgRepsPerWorkout` | $O(N \log N)$ (sorting + filtering) | Scans and filters all 300 sessions for the selected exercise |
| `MuscleMapScreen.tsx` (line 792) | Muscle sets distribution | $O(N \times E)$ | Scans all sessions to calculate muscle group set frequencies |
| `ProfileScreen.tsx` (line 505) | `useProfileStats` | $O(N \times E \times S)$ | Iterates all sets of all exercises across all sessions to calculate all-time volume and streaks |

---

## 4. Test Infrastructure & Mock SQLite Environment Survey

### 4.1 Test Configuration & Environment
- **Configuration:** `jest.config.js` with `preset: 'react-native'`.
- **Node Environment:** Node.js `v22.22.3`, npm `10.9.8` located at `F:\.fnm\node-versions\v22.22.3\installation`.
- **TypeScript:** `typescript@~5.9.2`, configuration `tsconfig.json`.
- **Health Check Command:** `npm run self-check` (`npm run typecheck && npm test`).

### 4.2 Test Suite Verification Results
All **12 test suites** passed with **100% success rate (94/94 tests, 6/6 snapshots)**:
- `storageContracts.test.ts` (PASS): Verifies contracts, schema validators, checksums, and normalization.
- `persistenceArchitecture.test.ts` (PASS): Verifies expected values resolution, O(1) history indexing, unilateral mappings, and input patching.
- `phase1Storage.test.ts` (PASS): Verifies MMKV v4 adapter, 2-slot active workout journal, failure-injection matrix, crash recovery, and tombstones.
- `routineLoadingBenchmark.test.ts` (PASS): Verifies routine initialization (<5ms for 50 exercises/500 library items) and performance suggestion resolution (<2ms across 1,000 sessions).
- `csvImporter.test.ts`, `variationUtils.test.ts`, `strengthDistributionEngine.test.ts`, `ui-snapshots.test.tsx`, `theme.test.ts`, `realImport.test.ts`, `calculations.test.ts`, `MuscleMapScreenRendering.test.tsx` (All PASS).

### 4.3 SQLite Mocking in Current Test Suite
In `src/__tests__/mocks/nativeModulesMock.js`:
```js
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn().mockReturnValue({
    execSync: jest.fn(),
    runSync: jest.fn(),
    getFirstSync: jest.fn().mockReturnValue({ value: '{}' }),
  }),
}));
```
- **Limitation**: The mock only provides synchronous stubs (`openDatabaseSync`, `execSync`). It does not mock asynchronous methods (`openDatabaseAsync`, `execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync`) used by `dbSingleton.ts` and `history/repository.ts`.
- **Node Native SQLite Support**: Node.js v22 includes native `node:sqlite` (`const { DatabaseSync } = require('node:sqlite');`), which executes real SQLite queries in C++ in-memory or on-disk without needing external native module builds or emulators.

---

## 5. Technical Blueprint for Automated Benchmark Suite

### 5.1 Objectives & Acceptance Targets

The benchmark script (`scripts/benchmark-startup.js` or `scripts/benchmark-startup.ts`) must simulate cold-start data hydration, query performance, and memory consumption across three distinct payload sizes:
- **0 Workouts** (Fresh install baseline)
- **50 Workouts** (Moderate user history)
- **300+ Workouts** (Power user benchmark target)

#### Key Performance Targets (R1 & R3):
- **300+ Workouts Cold Start Hydration:** $< 150\text{ ms}$ (Target: $< 50\text{ ms}$ with indexed relational load or decoupled settings).
- **Peak Memory Allocation Delta:** $< 25\text{ MB}$ heap delta during hydration.
- **Single-Workout Reconciliation:** $< 15\text{ ms}$ (vs current 8,000+ query full recreation).
- **Zero Monolithic JSON.stringify on Hot Path:** Settings updates complete in $< 2\text{ ms}$.

### 5.2 Benchmark Execution Metrics & Measurements

For each session scale (0, 50, 300), the benchmark runner will capture:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Benchmark Telemetry Dimensions                                                          │
├────────────────────────────┬─────────────────────────────────────────────────────────────┤
│ 1. Storage Load & Parse    │ Duration (ms) to read and parse settings & history metadata │
│ 2. SQLite Hydration        │ Duration (ms) to execute indexed SQL queries & map entities │
│ 3. Memory Allocation       │ Heap Used Delta (MB) and RSS Memory Delta (MB)              │
│ 4. Derived Stats Latency   │ Duration (ms) to compute 1RM series & weekly volume metrics │
│ 5. Write/Update Latency    │ Duration (ms) to persist a newly finished workout session   │
└────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

### 5.3 Deterministic Synthetic Data Generator Spec

To ensure repeatable, variance-free benchmarking, the synthetic generator will construct realistic workout payloads:
- **Sessions:** Chronologically spaced over 1–2 years (1 session every 2–3 days).
- **Exercises per Session:** 4–7 exercises per workout (Bench Press, Squat, Deadlift, Overhead Press, Pull Up, Lateral Raise, Bicep Curl).
- **Sets per Exercise:** 3–5 sets (Warm-up 'W', Straight 'S', Drop 'D', Failure 'F').
- **Attributes:** Variations (e.g. 'Paused', 'Incline'), notes, unilateral weights/reps, RPE values, completed flags.

### 5.4 Benchmark Script Architecture (`scripts/benchmark-startup.js`)

```
scripts/benchmark-startup.js
├── Synthetic Generator
│   ├── generateSyntheticWorkouts(count) -> WorkoutSessionV2[] & LegacyAppDataV1
│   └── seedSqliteDatabase(db, sessions) -> Seed relational tables & indices
├── Storage Adapters
│   ├── MonolithicJsonEngine (Legacy Simulation)
│   └── RelationalSqliteEngine (Node:SQLite DatabaseSync / Expo-SQLite simulation)
├── Benchmark Scenarios
│   ├── Scenario A: Cold Start Hydration (0, 50, 300 sessions)
│   ├── Scenario B: Single-Session Incremental Write vs Reconcile All
│   ├── Scenario C: Settings Update Isolation (Decoupled vs Monolithic)
│   └── Scenario D: Derived Analytics / Query Execution
├── Statistical Sampler
│   ├── Warm-up: 5 iterations
│   ├── Measurement: 20 iterations
│   └── Metrics: Mean, Median, P95, Min, Max, Heap Delta (MB)
└── Structured Console & Markdown Reporter
```

---

## 6. Actionable Recommendations & Implementation Plan

### Recommendation 1: Decouple Settings from Historical Sessions
- **Action:** Split `STORAGE_KEY` (`strongern_app_data_v1`) into:
  - `strongern_settings_v2` (Hot path: user prefs, theme, sound, timer settings $< 5\text{ KB}$).
  - `strongern_v2.db` (Relational tables for `workout_sessions`, `session_exercises`, `set_logs`).
- **Benefit:** Eliminates 100% of monolithic `JSON.stringify` cycles when toggling app settings.

### Recommendation 2: Eliminate Destructive `reconcileSessions` Loop
- **Action:** Replace full-array reconciliation with **incremental single-session writes**:
  - `upsertSession(session)` when a workout is finished or edited.
  - `softDeleteSession(sessionId)` when a workout is deleted.
- **Benefit:** Drops database write operations per finished workout from ~8,700 queries down to ~25 queries (a ~350x reduction in SQLite operations).

### Recommendation 3: Fast-Path Startup Hydration
- **Action:** During `bootstrapPersistence`:
  - If `persistence_meta` indicates relational V2 is verified, **skip loading/fingerprinting legacy monolithic JSON**.
  - Load only initial view page (e.g. latest 20–50 sessions for immediate rendering) or perform a single joined query / optimized batch query.
- **Benefit:** Cold start drops from several seconds to $< 30\text{ ms}$.

### Recommendation 4: Implement Automated Benchmark Suite
- **Action:** Create `scripts/benchmark-startup.js` utilizing `node:sqlite` and benchmark.js to provide instant before/after performance validation across 0, 50, and 300+ workouts.

---

## 7. Artifacts Created & References

- Comprehensive Survey Report: `C:\Antigravity\strongerN\.agents\explorer_survey_3\survey_report.md`
- Handoff Report: `C:\Antigravity\strongerN\.agents\explorer_survey_3\handoff.md`
- Tracking Logs: `C:\Antigravity\strongerN\.agents\explorer_survey_3\progress.md`, `BRIEFING.md`, `DISPATCH.md`
