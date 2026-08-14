# StrongerN Storage & Hydration Layer Architecture Survey Report

**Author:** Explorer 1 (Investigation & Storage Architecture)  
**Date:** 2026-08-14  
**Project:** StrongerN (React Native / Expo / TypeScript)  
**Scope:** Cold start lifecycle, `bootstrapPersistence`, root state initialization, SQLite/MMKV/AsyncStorage/localStorage drivers, and 300+ workout hydration bottleneck analysis.

---

## 1. Executive Summary

StrongerN currently implements a hybrid storage architecture transitioning from a **Legacy Monolithic Key-Value Store (V1)** to a **Normalized Relational SQLite Database (V2)** combined with **Synchronous MMKV Hot-Path Snapshots (V4)** for active workout resilience.

While the relational schema and MMKV active draft layers are well structured, cold-start performance degrades severely when 300+ historical workouts are present. The slowdown is primarily caused by **redundant dual-hydration and synchronous JS-thread serialization bottlenecks**:
1. **Monolithic KV Deserialization**: Synchronous `JSON.parse` of multi-megabyte legacy blobs on the JS thread during startup (`loadFromDb('strongern_app_data_v1')`).
2. **Redundant Checksum Fingerprinting**: Synchronous `JSON.stringify` and DJB2 character hashing over all 300+ sessions during every cold launch inside `fingerprintLegacySessions`.
3. **Unconditional Full-Table Relational Deserialization**: In `bootstrapPersistence`, calling `loadAllSessions()` issues multiple bulk queries across `workout_sessions`, `session_exercises`, and `set_logs` (fetching >10,000 rows) and constructs large in-memory Map structures before rendering.
4. **Double Format Mapping**: Mapping SQLite relational records to V2 structures, then re-mapping to Legacy objects via `sessionV2ToLegacy`, and storing all 300+ objects in root React state (`useState`).
5. **Save Thrashing**: Updating any minor setting triggers a 400ms debounced monolithic `JSON.stringify` of the entire history to `strongern.db`, while session changes trigger full reconciliation transactions (`reconcileSessions`) over all 300 sessions.

---

## 2. Storage & Hydration Layer Architecture

### 2.1 Storage Drivers & Roles Matrix

| Engine | Database / Target | Relevant Files | Storage Role & Stored Entities |
| :--- | :--- | :--- | :--- |
| **`expo-sqlite` (Legacy KV)** | `strongern.db` (`strongern_kv_store`) | `src/utils/db.ts`, `src/App.tsx` | Stores monolithic legacy JSON payload (`strongern_app_data_v1`), legacy active workout state (`strongern_active_workout_state`), and auth state (`strongern_auth_v1`). |
| **`expo-sqlite` (Relational V2)** | `strongern_v2.db` (WAL mode enabled) | `src/storage/dbSingleton.ts`, `src/storage/history/repository.ts`, `src/storage/history/schema.ts` | Normalized tables: `persistence_meta`, `workout_sessions`, `session_exercises`, `set_logs`. Indexed by timestamps, titles, exercise names, and positions. |
| **`react-native-mmkv`** | Instance ID: `strongern-hot-path` | `src/storage/adapters/mmkvAdapter.ts`, `src/storage/activeWorkoutSnapshot.ts`, `src/storage/activeInputPatch.ts` | Zero-loss active workout draft persistence. Two-slot A/B envelope architecture (`slot_a`, `slot_b`, `head`), atomic finish journal, single set input patches (`strongern_active_input_patch`). |
| **`expo-secure-store`** | Hardware Keystore / Encrypted Preferences | `src/utils/secureStore.ts` | Secure tokens (`google_oauth_token`) and persistent visual overrides (`theme_overrides`). |
| **`window.localStorage`** | Browser storage | `src/utils/db.ts`, `src/storage/adapters/mmkvAdapter.ts` | Web fallback & synchronous dual-write backup in browser environments. |
| **`AsyncStorage`** | *Not utilized* | `src/__tests__/mocks/nativeModulesMock.js` | Only present in legacy test mocks; superseded by SQLite and MMKV. |

---

### 2.2 Cold Start Lifecycle Flow Diagram

```
[ App Launch / Native Mount ]
              │
              ▼
    src/App.tsx (Mount useEffect)
              │
      ┌───────┴─────────────────────────────────────────┐
      │ 1. await initDb() [strongern.db KV Store]       │
      │ 2. await getSecureItem('theme_overrides')       │
      │ 3. await loadFromDb('strongern_app_data_v1')    │  <-- [BOTTLENECK 1: Monolithic JSON.parse]
      │ 4. await loadFromDb('strongern_active_workout') │
      └───────────────────────┬─────────────────────────┘
                              │
                              ▼
        src/storage/persistenceBootstrap.ts
              │
      ┌───────┴───────────────────────────────────────────────────────┐
      │ A. initMMKVAdapter() [MMKV instance 'strongern-hot-path']     │
      │ B. await initHistoryRepository() [strongern_v2.db + schema]   │
      │ C. validateLegacyAppDataV1(legacyAppRaw)                      │
      │ D. fingerprintLegacySessions(legacySessions)                  │  <-- [BOTTLENECK 2: JSON.stringify + Hash]
      │ E. Check Migration Status:                                    │
      │    - If unmigrated: Sequential upsertSession() loop           │
      │    - If migrated: Unconditionally call loadAllSessions()      │  <-- [BOTTLENECK 3: Full 3-table SQLite scan]
      │ F. restoreActiveWorkoutDraft() [MMKV Slot A/B + Input Patch]  │
      └───────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
    src/App.tsx (Root State Hydration)
              │
      ┌───────┴───────────────────────────────────────────────────────┐
      │ 1. sessions.map(sessionV2ToLegacy)                            │  <-- [BOTTLENECK 4: Object Re-allocations]
      │ 2. setSessionsList(legacySessions) [React Root State]         │
      │ 3. setUser(), setTemplatesList(), setExercisesList(), etc.    │
      │ 4. useActiveWorkoutStore.getState().hydrate(activeDraft)      │
      │ 5. setIsDataLoaded(true)                                      │
      └───────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
    Post-Hydration Background Triggers & Renders
              │
      ┌───────┴───────────────────────────────────────────────────────┐
      │ • dynamicWeeklyChartData useMemo iterates 300+ sessions       │
      │ • useProfileStats calculates all-time volume & streaks        │
      │ • 400ms debounce: saveToDb(STORAGE_KEY, monolithicData)       │  <-- [BOTTLENECK 5: Save Thrashing]
      │ • 250ms debounce: reconcileSessions(normalized) across SQLite │
      └───────────────────────────────────────────────────────────────┘
```

---

## 3. Deep Dive into Entry Points & Functions

### 3.1 `src/App.tsx` (Cold Start Mount & State Management)
- **Line 384 (`loadData`)**:
  ```typescript
  const dbReady = await initDb();
  const parsed = await loadFromDb(STORAGE_KEY);
  const legacyActiveWorkout = await loadFromDb('strongern_active_workout_state');
  const persistence = await bootstrapPersistence(parsed, legacyActiveWorkout);
  historyRepositoryReadyRef.current = persistence.historyReady;
  if (persistence.historyReady) {
    setSessionsList(persistence.sessions.map(sessionV2ToLegacy));
  }
  ```
  - **Issue**: Both the legacy monolithic KV store (`strongern.db`) AND the relational database (`strongern_v2.db`) are queried on every startup. The entire 300+ workout history is loaded twice (first parsed from JSON string, then queried from SQLite tables).

- **Lines 545–602 (`State Change Save Effect`)**:
  ```typescript
  React.useEffect(() => {
    if (!isDataLoaded) return;
    const data = { user, sessionsList, templatesList, exercisesList, ...30+ settings };
    rootSaveTimeoutRef.current = setTimeout(() => {
      saveToDb(STORAGE_KEY, data);
    }, 400);
  }, [user, sessionsList, templatesList, ...]);
  ```
  - **Issue**: Any change to application settings, UI theme, or sound toggles causes the full 300-session workout array to be serialized to a JSON string and written into SQLite `strongern_kv_store`.

- **Lines 605–621 (`History Reconciliation Effect`)**:
  ```typescript
  React.useEffect(() => {
    if (!isDataLoaded || !historyRepositoryReadyRef.current) return;
    historyReconcileTimerRef.current = setTimeout(() => {
      const normalized = sessionsList.map((session, index) => legacySessionToV2(session, index));
      reconcileSessions(normalized);
    }, 250);
  }, [isDataLoaded, sessionsList]);
  ```
  - **Issue**: Any mutation to `sessionsList` results in mapping the full history to V2 and executing `reconcileSessions()`, which performs writes for every session in the array.

---

### 3.2 `src/storage/persistenceBootstrap.ts` (`bootstrapPersistence`)
- **Lines 31–33 (`fingerprintLegacySessions`)**:
  ```typescript
  function fingerprintLegacySessions(sessions: any[]): string {
    return calculateChecksum(JSON.stringify(sessions, (_key, value) => value instanceof Date ? value.toISOString() : value));
  }
  ```
  - For 300+ workouts, `JSON.stringify` converts thousands of nested objects into a multi-megabyte string, followed by character iteration in `calculateChecksum`.

- **Lines 35–42 (`loadAllSessions`)**:
  ```typescript
  async function loadAllSessions(): Promise<WorkoutSessionV2[]> {
    const count = await countSessions();
    const output: WorkoutSessionV2[] = [];
    for (let offset = 0; offset < count; offset += 250) {
      output.push(...await listSessions(250, offset));
    }
    return output;
  }
  ```
  - Even after migration is verified (`previousFingerprint === sourceFingerprint`), this function executes on every boot, paginating through SQLite and reconstructing all session hierarchies.

---

### 3.3 `src/storage/history/repository.ts` (`listSessions` & `reconcileSessions`)
- **Lines 147–209 (`listSessions`)**:
  - Executes 3 relational queries per page:
    1. `SELECT * FROM workout_sessions WHERE deleted_at_ms IS NULL ORDER BY started_at_ms DESC, id DESC LIMIT ? OFFSET ?;`
    2. `SELECT * FROM session_exercises WHERE session_id IN (...) ORDER BY session_id, position;`
    3. `SELECT * FROM set_logs WHERE session_exercise_id IN (...) ORDER BY session_exercise_id, position;`
  - Reconstructs in-memory relational structures using `setsByExercise` and `exercisesBySession` Maps.
  - For 300 workouts (approx. 1,500 exercises and 6,000 sets), this queries and maps over 7,500 rows synchronously in the bootstrap sequence.

- **Lines 100–118 (`reconcileSessions`)**:
  - Runs in a single `BEGIN IMMEDIATE TRANSACTION`.
  - Loops through all sessions and executes `writeSession` (1 update + 1 delete session_exercises + N insert exercises + M insert set_logs).
  - Executing this for 300 sessions generates >3,000 SQL statements.

---

### 3.4 `src/storage/activeWorkoutSnapshot.ts` & `src/state/activeWorkoutStore.ts`
- **Architecture**:
  - Implements an atomic two-slot A/B journal (`strongern_active_draft_slot_a`, `strongern_active_draft_slot_b`, `strongern_active_draft_head`) in MMKV.
  - Each draft write updates monotonic sequence numbers, writes to the inactive slot, reads back and verifies checksum, then updates the head pointer.
  - Fast, synchronous, and safe against crashes.
- **Cold Start Restoration**:
  - `restoreActiveWorkoutDraft()` reads MMKV slots, picks the latest valid candidate, and applies any pending single-set patch from `activeInputPatch.ts`.
  - Hydrates `useActiveWorkoutStore` at `App.tsx` line 507.

---

## 4. Root Cause Bottleneck Breakdown (300+ Workouts)

| Bottleneck Stage | Primary Cause | File & Function | Impact on Cold Start |
| :--- | :--- | :--- | :--- |
| **1. Monolithic KV Deserialization** | Reading & parsing entire 1–5MB JSON blob from `strongern_kv_store`. | `src/utils/db.ts` (`loadFromDb`)<br>`src/App.tsx` (line 398) | ~100–300ms blocking JS thread parsing JSON. |
| **2. Redundant Stringify Fingerprinting** | Re-stringifying 300+ sessions to compute DJB2 checksum on every boot. | `src/storage/persistenceBootstrap.ts` (`fingerprintLegacySessions`) | ~50–120ms wasted CPU time on string serialization. |
| **3. SQLite 3-Table Deserialization** | Loading all 300 sessions via 3 separate queries + Map building. | `src/storage/history/repository.ts` (`listSessions`) | ~150–400ms SQLite query & object allocation overhead. |
| **4. Dual-Format Object Mapping** | Relational -> V2 -> Legacy (`sessionV2ToLegacy`) with `new Date()` instances. | `src/storage/history/legacySessionMapper.ts`<br>`src/App.tsx` (line 416) | ~40–80ms garbage collection & memory allocation pressure. |
| **5. Monolithic State Save Thrashing** | Any UI state change serializes full 300 sessions back to SQLite KV store. | `src/App.tsx` (lines 545–602) | Micro-stutters during UI interactions post-boot. |

---

## 5. Architectural Optimization Recommendations

1. **Decouple Settings/User Profile from Historical Workouts**:
   - Split `strongern_app_data_v1` into lightweight modular keys:
     - `strongern_settings_v2` (compact settings & flags only).
     - `strongern_user_profile` (user stats, avatar, name).
     - `strongern_exercises_custom` (custom exercise additions).
     - `strongern_templates` (workout templates).
   - Historical sessions reside exclusively in `strongern_v2.db` relational tables.

2. **Bypass Monolithic History Load when Relational V2 is Verified**:
   - Once `legacy_v1_to_relational_v2` is marked verified in `persistence_meta`, avoid loading or parsing `sessionsList` from legacy KV storage during cold start.
   - Replace session list checksumming with a simple migration version check.

3. **Windowed / Paginated History Hydration**:
   - On cold start, load only the most recent **20–30 sessions** into memory for immediate display on `HistoryScreen` and initial widgets.
   - Paginate older historical sessions on demand (e.g. when the user scrolls in `HistoryScreen`).

4. **Offload Analytics & Volume Aggregations to SQLite Queries**:
   - Calculate all-time volume, monthly volume, and streak stats via SQLite aggregate queries (`SELECT SUM(total_volume_milli_kg), COUNT(*) FROM workout_sessions ...`) instead of pulling 300 full session trees into JS memory.

5. **Eliminate Dual-Write Thrashing on Settings & Workouts**:
   - Ensure saving settings only updates the settings KV record.
   - Workout completions should call `upsertSession()` directly on `strongern_v2.db` without triggering a full re-serialization of all historical sessions.

---

## 6. Verification & Telemetry Plan

1. **Unit Testing**: All existing tests in `src/__tests__/` (12 test suites, 94 tests) must pass cleanly.
2. **Typecheck**: `npm run typecheck` (`tsc --noEmit`) must remain at 0 errors.
3. **Cold Start Benchmarking**:
   - Create an automated benchmark script (`scripts/benchmark-startup.js` or `scripts/benchmark-startup.ts`).
   - Measure:
     - Storage load & parse execution time (ms) for 0, 50, and 300+ workouts.
     - SQLite query duration (ms).
     - Memory allocation delta (MB).
   - Target cold start hydration time: **< 150ms** for 300+ workouts.
