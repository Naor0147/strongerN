# StrongerN State Management & Persistence Survey Report

## 1. Executive Summary

This report presents an in-depth architectural survey of state management and persistence mechanisms across StrongerN (`c:\Antigravity\strongerN`). The investigation traced every step of the data lifecycle—from high-frequency keystrokes and set completions during active workouts, to routine setting changes, workout finalization, history edits, and cold start hydration.

### Key Takeaways
1. **Monolithic Serialization Bottleneck**: In `src/App.tsx`, 35+ disparate state variables (including user settings, audio volume, theme colors, routine templates, custom exercises, body metrics, and the entire `sessionsList` containing 300+ historical workout sessions) are bundled into a single monolithic JSON payload (`strongern_app_data_v1`). Every routine state change (such as toggling a sound or sliding animation speed) schedules a debounced `JSON.stringify` of the full 300-session history into the legacy SQLite key-value store (`strongern_kv_store`).
2. **Full Relational History Re-write on Every Session Change**: In `src/App.tsx`, an effect monitoring `sessionsList` schedules `reconcileSessions(normalized)` whenever `sessionsList` changes. For 300 sessions, `reconcileSessions` executes 8,000–10,000 SQL statements in a single transaction (inserting every session, deleting all session exercises, inserting exercises and set logs), causing severe I/O thrashing and UI thread latency.
3. **Dual-Write Redundancy**: The app currently operates three distinct persistence layers in parallel:
   - **Legacy SQLite KV Store** (`strongern.db` / `strongern_kv_store` via `src/utils/db.ts`)
   - **Relational Normalized SQLite** (`strongern_v2.db` via `src/storage/history/repository.ts`)
   - **Hot-Path MMKV** (`strongern-hot-path` via `src/storage/adapters/mmkvAdapter.ts` and `src/storage/activeWorkoutSnapshot.ts`)
4. **Active Workout Draft vs. Settings Coupling**: While active workout draft snapshots are successfully captured in MMKV Slot A/B (`strongern_active_draft_slot_a` / `_b`), active workout state is still dual-written to `strongern_kv_store`. Settings and routine preferences are entirely unpartitioned and coupled to the 300-session history payload.
5. **Decoupling Strategy**: Isolating settings into `strongern_settings_v2` (MMKV/compact KV), removing `sessionsList` from the monolithic `strongern_app_data_v1` payload, restricting `reconcileSessions` strictly to migrations/imports, and relying on single-session transactional writes (`upsertSession`) will completely eliminate serialization lag and accelerate cold start data hydration.

---

## 2. Current State Management Architecture & Data Flow

### 2.1 State Hierarchy & Distribution

```
App.tsx (Root Component & Orchestrator)
 │
 ├── Root State (useState hooks)
 │    ├── user: { name, totalWorkouts, isPro, avatarUri }
 │    ├── sessionsList: WorkoutSession[] (300+ items with nested exercises & sets)
 │    ├── templatesList: Template[]
 │    ├── exercisesList: Exercise[] (system + user custom)
 │    ├── primaryMetricsList / bodyPartMetricsList: Metric[]
 │    ├── Settings & Modular Toggles (isAutoTimerEnabled, soundSetCompleted, appTheme, etc.)
 │    └── googleUser / authState
 │
 ├── useActiveWorkoutStore (Zustand: src/state/activeWorkoutStore.ts)
 │    ├── isWorkoutActive: boolean
 │    ├── workoutName: string
 │    ├── startTime: Date
 │    ├── workoutExercises: ActiveExercise[]
 │    ├── isWorkoutModalVisible: boolean
 │    ├── activeWorkoutComment: string
 │    └── editingSessionId: string | null
 │
 ├── ActiveWorkoutModal (src/components/layout/ActiveWorkoutModal.tsx)
 │    ├── useActiveExercisesState (src/hooks/useActiveExercisesState.ts)
 │    │    └── activeExercises: ActiveExercise[] (local rapid-edit state)
 │    ├── useRestTimerState (src/hooks/useRestTimerState.ts)
 │    └── useWorkoutModalControls (src/hooks/useWorkoutModalControls.ts)
 │
 └── In-Memory Event & Fast Input Stores
      ├── activeInputStore (src/utils/activeInputStore.ts) -> active input field coordinates
      ├── keyboardValueStore (src/utils/keyboardValueStore.ts) -> active keystroke buffer
      └── restTimerEmitter (src/components/layout/restTimerEmitter.ts) -> timer ticks
```

---

## 3. State Persistence Architecture & Storage Engines

The application currently interfaces with 5 distinct storage mechanisms:

| Storage Layer | Engine | Primary Files | Storage Keys / Targets | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Legacy KV SQLite** | `expo-sqlite` (`strongern.db`) | `src/utils/db.ts` | Table: `strongern_kv_store`<br>Key: `strongern_app_data_v1`<br>Key: `strongern_active_workout_state` | Monolithic JSON blob store for legacy app data & active workout backup. |
| **Relational SQLite (V2)** | `expo-sqlite` (`strongern_v2.db`, WAL mode) | `src/storage/history/repository.ts`<br>`src/storage/dbSingleton.ts`<br>`src/storage/history/schema.ts` | Tables: `workout_sessions`, `session_exercises`, `set_logs`, `persistence_meta` | Normalized relational workout history with indexed queries. |
| **Hot-Path MMKV (V2)** | `react-native-mmkv` (`strongern-hot-path`) | `src/storage/adapters/mmkvAdapter.ts`<br>`src/storage/activeWorkoutSnapshot.ts`<br>`src/storage/activeInputPatch.ts` | `strongern_active_draft_head`<br>`strongern_active_draft_slot_a`<br>`strongern_active_draft_slot_b`<br>`strongern_active_draft_input_patch` | Synchronous, crash-safe active workout journaling and hot input patch. |
| **SecureStore** | `expo-secure-store` | `src/utils/secureStore.ts` | `google_oauth_token`<br>`theme_overrides` | Sensitive credentials and theme overrides. |
| **AuthStore** | KV via `db.ts` | `src/utils/authStore.ts` | `strongern_auth_v1` | User onboarding and auth profile metadata. |

---

## 4. Detailed Step-by-Step State Flow Traces

### Trace 1: Active Workout In-Progress Updates

When a workout is actively being performed:

```
[User Keystroke / Numeric Input]
      │
      ▼
1. CustomWorkoutKeyboard.tsx -> updates keyboardValueStore & tempInputValueRef.current
      │
      ▼ (Fast input patch)
2. saveActiveInputPatch() [activeInputPatch.ts:21] -> MMKV (STORAGE_KEYS.ACTIVE_DRAFT_INPUT_PATCH)
      │
      ▼ [Focus change / Set Completion]
3. toggleSetComplete() / updateSetField() [useActiveExercisesState.ts:81-160]
      │
      ▼
4. setActiveExercises() [useActiveExercisesState.ts:64]
      │
      ▼
5. onActiveExercisesCommit() -> commitActiveExercisesToParent() [ActiveWorkoutModal.tsx:234]
      │
      ▼
6. onUpdateActiveExercises prop -> setWorkoutExercisesAndRef() [App.tsx:1544]
      │
      ├───► A. setWorkoutExercises() [activeWorkoutStore.ts:88]
      │          └── commitPatch() [activeWorkoutStore.ts:50]
      │               └── saveActiveWorkoutDraft() [activeWorkoutSnapshot.ts:144]
      │                    └── Serializes ActiveWorkoutDraftV2, computes checksum,
      │                        writes to MMKV Slot A/B (strongern_active_draft_slot_a/b)
      │
      └───► B. saveActiveWorkoutState(false) [App.tsx:1973]
                 └── saveToDb('strongern_active_workout_state', freshState) [db.ts:40]
                      └── JSON.stringify(freshState) -> SQLite strongern_kv_store
```

### Trace 2: Finishing a Workout

When the user taps "Finish Workout":

```
[User taps "Finish Workout"]
      │
      ▼
1. handleFinishWorkout() [App.tsx:1779]
      │
      ├── 2. Aggregates completed sets, calculates duration, totalVolumeKg, PRs
      │
      ├── 3. Creates newSession (or updates existing session if editingSessionIdRef.current)
      │      updatedSessions = [newSession, ...sessionsListRef.current]
      │
      ├── 4. Relational Single Write:
      │      await upsertSession(legacySessionToV2(durableSession)) [repository.ts:93]
      │      └── Writes 1 session + exercises + sets to strongern_v2.db
      │
      ├── 5. Draft Tombstone & Cleanup:
      │      endActiveWorkout() -> clearActiveWorkoutDraft() (MMKV Tombstone envelope)
      │      deleteFromDb('strongern_active_workout_state') (SQLite KV)
      │
      ├── 6. Updates React State:
      │      setSessionsList(updatedSessions) [App.tsx:1892]
      │      setUser(nextUser) [App.tsx:1893]
      │      setCompletionData(...) -> shows celebratory completion modal
      │
      ▼ [CASCADING SIDE EFFECTS TRIGGERED BY setSessionsList]
      │
      ├──► Side Effect 1 (Root Monolithic Save): [App.tsx:545-602]
      │      useEffect triggered on `sessionsList`. Debounced 400ms.
      │      Bundles all 300+ sessions + all settings + exercises + metrics into `data`.
      │      Calls `saveToDb('strongern_app_data_v1', data)`:
      │      --> JSON.stringify(data) [multi-megabyte string]
      │      --> window.localStorage.setItem(...)
      │      --> SQLite: INSERT OR REPLACE INTO strongern_kv_store ('strongern_app_data_v1', ...)
      │
      ├──► Side Effect 2 (Full History Relational Re-sync): [App.tsx:605-621]
      │      useEffect triggered on `sessionsList`. Debounced 250ms.
      │      Maps 300 sessions via legacySessionToV2.
      │      Calls `reconcileSessions(normalized)` [repository.ts:100]:
      │      --> Loop 300 sessions: writeSession(db, session)
      │      --> 8,000–10,000 SQL statements in a single transaction!
      │
      ├──► Side Effect 3 (Google Drive Cloud Auto-Sync): [App.tsx:638-710]
      │      useEffect triggered on `sessionsList`. Debounced 2000ms.
      │      Serializes all 300 sessions and uploads to Google Drive.
      │
      └──► Side Effect 4 (Derived Computations):
             useMemo recalculations in App.tsx (dynamicWeeklyChartData, weeklyMuscleSets)
             useProfileStats, exerciseStats across active screens.
```

### Trace 3: Editing / Resuming a Past Workout

1. User taps session in `HistoryScreen` or `WorkoutScreen` -> `handleResumeWorkout(session)` in `App.tsx:1734`.
2. Maps past session exercises to active workout structure.
3. Calls `beginActiveWorkout({ workoutName, startTime, workoutExercises, isWorkoutModalVisible: true, activeWorkoutComment, editingSessionId: session.id })`.
4. User edits exercises/sets in `ActiveWorkoutModal`.
5. Finishing triggers `handleFinishWorkout` which replaces the session in `sessionsList` by `editingSessionIdRef.current` and triggers the same side-effect cascades as Trace 2.

### Trace 4: Routine State Updates (Settings, Theme, Sounds, Metrics, Templates)

```
[User modifies setting: e.g. toggles sound, changes accent color, edits template, logs metric]
      │
      ▼
1. React state setter called in App.tsx:
   (setSoundSetCompleted, setAppThemeState, setTemplatesList, setPrimaryMetricsList, etc.)
      │
      ▼
2. App.tsx Root Save useEffect triggers [App.tsx:545-602]
   (Because it depends on all 35+ state variables: [user, sessionsList, templatesList, ...])
      │
      ▼
3. Bundles entire state object:
   const data = {
     user,
     sessionsList, // <--- 300+ full workout sessions included!
     templatesList,
     exercisesList,
     primaryMetricsList,
     bodyPartMetricsList,
     ...settings
   };
      │
      ▼ (Debounced 400ms)
4. saveToDb('strongern_app_data_v1', data) [db.ts:40]
   --> const serialized = JSON.stringify(data); // Heavy blocking stringification
   --> SQLite: INSERT OR REPLACE INTO strongern_kv_store ('strongern_app_data_v1', serialized)
```

### Trace 5: Cold Start / Hydration Flow

```
[App Mount]
      │
      ▼
1. initDb() [db.ts:12] -> opens strongern.db (strongern_kv_store table)
      │
      ▼
2. loadFromDb('strongern_app_data_v1') [App.tsx:398]
   --> SELECT value FROM strongern_kv_store WHERE key = 'strongern_app_data_v1'
   --> JSON.parse(row.value) [Entire 300-session history parsed synchronously into memory]
      │
      ▼
3. loadFromDb('strongern_active_workout_state') [App.tsx:399]
   --> JSON.parse(row.value)
      │
      ▼
4. bootstrapPersistence(parsed, legacyActiveWorkout) [persistenceBootstrap.ts:44]
   ├── initMMKVAdapter() [mmkvAdapter.ts:62]
   ├── initHistoryRepository() [repository.ts:83] -> opens strongern_v2.db (WAL, schema version check)
   ├── validateLegacyAppDataV1(legacyAppRaw) [validators.ts] -> recursively validates all 300 sessions
   ├── fingerprintLegacySessions(legacySessions) -> JSON.stringify(sessions) + calculateChecksum
   ├── If fingerprint differs from persistence_meta:
   │     loop upsertSession(legacySessionToV2) for all 300 sessions
   │     setPersistenceMeta(...)
   ├── loadAllSessions() [persistenceBootstrap.ts:35]
   │     countSessions()
   │     listSessions(250, offset) -> 3 queries (sessions, session_exercises, set_logs)
   │     reconstructs 300 WorkoutSessionV2 objects
   └── restoreActiveWorkoutDraft() [activeWorkoutSnapshot.ts:201]
         reads MMKV Slot A / Slot B, validates envelope checksum, applies hot input patch
      │
      ▼
5. setSessionsList(persistence.sessions.map(sessionV2ToLegacy)) [App.tsx:416]
   --> Maps 300 sessions from V2 back to legacy format
   --> Sets sessionsList in React state
      │
      ▼
6. useActiveWorkoutStore.getState().hydrate(persistence.activeDraft) [App.tsx:507]
   setIsWorkoutRestored(true)
   setIsDataLoaded(true)
```

---

## 5. Coupling Analysis: Active Draft & Settings vs. Historical Sessions

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                COUPLING & SERIALIZATION MATRIX                        │
├─────────────────────────┬──────────────────────┬───────────────────────────────────────┤
│ Domain                  │ Persistence Engine   │ Coupling to 300+ Session Logs         │
├─────────────────────────┼──────────────────────┼───────────────────────────────────────┤
│ **Active Workout Draft**│ MMKV Slot A/B (V2) & │ **Storage Layer**: Decoupled in MMKV. │
│                         │ SQLite KV (V1)       │ **App Layer**: Coupled during start   │
│                         │                      │ (indexes 300 sessions for suggestions)│
│                         │                      │ and finish (triggers full history     │
│                         │                      │ re-write and monolithic JSON save).   │
├─────────────────────────┼──────────────────────┼───────────────────────────────────────┤
│ **Settings & Toggles**  │ Monolithic KV Store  │ **100% Coupled**: Any toggle change   │
│ (Theme, Sounds, Speed,  │ (`strongern_app_     │ triggers `saveToDb(STORAGE_KEY)`      │
│  Toggles, Preferences)  │  data_v1`)           │ which stringifies all 300 sessions.   │
├─────────────────────────┼──────────────────────┼───────────────────────────────────────┤
│ **Templates & Folders** │ Monolithic KV Store  │ **100% Coupled**: Stored in same      │
│                         │ (`strongern_app_     │ monolithic JSON payload as sessions.  │
│                         │  data_v1`)           │                                       │
├─────────────────────────┼──────────────────────┼───────────────────────────────────────┤
│ **Exercises & Library** │ Monolithic KV Store  │ **100% Coupled**: Stored in same      │
│                         │ (`strongern_app_     │ monolithic JSON payload as sessions.  │
│                         │  data_v1`)           │                                       │
├─────────────────────────┼──────────────────────┼───────────────────────────────────────┤
│ **Body Part Metrics**   │ Monolithic KV Store  │ **100% Coupled**: Stored in same      │
│                         │ (`strongern_app_     │ monolithic JSON payload as sessions.  │
│                         │  data_v1`)           │                                       │
└─────────────────────────┴──────────────────────┴───────────────────────────────────────┘
```

---

## 6. Identified Bottlenecks & Root Causes

### Bottleneck 1: Monolithic Root State Save (`src/App.tsx:545-602`)
- **Location**: `src/App.tsx` lines 545–602
- **Trigger**: Any change to `user`, `sessionsList`, `templatesList`, `exercisesList`, `primaryMetricsList`, `bodyPartMetricsList`, `isAutoTimerEnabled`, `googleUser`, `animationSpeed`, `lastSynced`, `foldersList`, `activeProgramId`, `programStartDate`, `isHealthSyncEnabled`, `isLiveHeartRateEnabled`, `isProgramsEnabled`, `isHistoryEnabled`, `isMusclesEnabled`, `soundSetCompleted`, `soundWorkoutFinished`, `soundTimerCompleted`, `customSounds`, `soundVolume`, `defaultRestDuration`, `showAchievementBadges`, `showSummaryWidgets`, `showWeeklyTonnage`, `showWorkoutsChart`, `showHighlights`, `showHypertrophyGoal`, `enableRoutineFolders`, `isDeveloperModeEnabled`, `isProgressiveOverloadEnabled`, `isAutoFinishSetEnabled`, `isRpeMode`, `appTheme`, `customAccentColor`.
- **Root Cause**: `sessionsList` is part of `data`. Serializing 300 sessions produces a ~2MB–10MB JSON string on every minor UI adjustment.

### Bottleneck 2: Full History Relational Re-write (`src/App.tsx:605-621` & `repository.ts:100`)
- **Location**: `src/App.tsx` lines 605–621 & `src/storage/history/repository.ts` lines 100–118
- **Trigger**: Any update to `sessionsList` (e.g. logging a workout, editing a past workout, deleting a workout, or restoring a backup).
- **Root Cause**: `reconcileSessions` iterates over all sessions in `sessionsList` (`for (const session of sessions) await writeSession(db, session)`), deleting and re-inserting all exercises and sets. For 300 sessions, this runs ~8,000–10,000 SQL statements.

### Bottleneck 3: Dual-Write Redundancy
- **Location**: `src/App.tsx` lines 1878–1886 and 1973–2000
- **Root Cause**: An active workout draft is written to MMKV (`saveActiveWorkoutDraft`) and simultaneously stringified to SQLite KV (`saveToDb('strongern_active_workout_state')`). When finishing a workout, the session is written to `strongern_v2.db` via `upsertSession`, and then immediately re-written via monolithic `saveToDb(STORAGE_KEY)` and full `reconcileSessions`.

### Bottleneck 4: Cold Start Full-Table Deserialization & Fingerprinting
- **Location**: `src/storage/persistenceBootstrap.ts` lines 31–87 & `src/App.tsx` lines 398–416
- **Root Cause**: On cold start, the app loads and parses the giant monolithic JSON from `strongern_kv_store`, stringifies all sessions again to compute `fingerprintLegacySessions`, loads all 300 sessions from `strongern_v2.db` via `loadAllSessions()` (3 paginated SQL queries with JS tree reconstruction), maps all 300 sessions back to legacy format, and sets `sessionsList`, which immediately queues another full save.

---

## 7. Architectural Decoupling & Optimization Recommendations

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          TARGET OPTIMIZED PERSISTENCE TOPOLOGY                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   [User Preferences & Settings] ──────► MMKV (strongern_settings_v2)                   │
│   - theme, audio, toggles, speed        (instantaneous synchronous read/write < 1ms)   │
│                                                                                        │
│   [Templates, Library & Metrics] ─────► Dedicated KV Partition                         │
│   - templates, exercises, metrics       (isolated from session history)                │
│                                                                                        │
│   [Active Workout Draft] ─────────────► MMKV Snapshot Slot A / Slot B                  │
│   - hot input patch, crash recovery     (pure MMKV, remove legacy KV dual-write)       │
│                                                                                        │
│   [Historical Workout Sessions] ──────► SQLite strongern_v2.db (WAL Mode)              │
│   - 300+ sessions, exercises, sets      - Finish/Edit: upsertSession(singleSession)    │
│                                         - Delete: softDeleteSession(sessionId)         │
│                                         - Reconcile: strictly on CSV/Drive import      │
│                                         - Cold start: fast indexed load / hydration    │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommendation 1: Decouple Settings & Library from Historical Sessions
1. **Partition Settings**: Route routine settings (theme, sounds, volume, animation speed, toggles, badges) to `STORAGE_KEYS.SETTINGS_COMPACT_V2` (`strongern_settings_v2`) in MMKV.
2. **Partition Library & Metrics**: Store templates, custom exercises, routine folders, and body metrics in a separate metadata partition (`strongern_library_v2` / `strongern_templates_v2`).
3. **Remove `sessionsList` from `strongern_app_data_v1`**: The monolithic `data` object saved by `App.tsx` must NOT include `sessionsList`.

### Recommendation 2: Eliminate Redundant Full-History Reconciliation
1. Remove the `useEffect` in `App.tsx` (lines 605–621) that automatically calls `reconcileSessions(normalized)` on any `sessionsList` change.
2. When finishing or editing a workout, `handleFinishWorkout` already calls `await upsertSession(legacySessionToV2(durableSession))`, which updates only the single affected session (1 session, ~5 exercises, ~20 sets).
3. `reconcileSessions` should be reserved strictly for bulk operations: initial V1-to-V2 database migration, CSV file imports (`handleImportStrongCSV`), and Google Drive cloud restores (`handleGoogleLogin` / `downloadBackupFile`).

### Recommendation 3: Pure MMKV Active Workout Journaling (Eliminate KV Dual-Write)
1. Stop dual-writing the active workout state to SQLite KV `strongern_active_workout_state` in `App.tsx:1973-2000` during in-flight workouts.
2. MMKV Slot A / Slot B with monotonic sequence numbers, checksum validation, and crash-safe tombstones (`activeWorkoutSnapshot.ts`) already guarantees zero data loss and crash recovery.

### Recommendation 4: Streamlined Cold Start Hydration
1. On app launch, read settings from MMKV (<1ms).
2. Restore active workout draft from MMKV (<1ms).
3. If `strongern_v2.db` is ready and `persistence_meta` indicates migration is verified, skip the monolithic legacy JSON load/parse of sessions and load sessions directly from `strongern_v2.db`.
4. Avoid mapping all 300 sessions between V2 and legacy formats repeatedly.

---

## 8. Concrete File & Function Reference Table

| Component / Function | File Path | Lines | Current Role / Issue |
| :--- | :--- | :--- | :--- |
| `saveToDb` | `src/utils/db.ts` | 40–69 | Synchronously writes to localStorage and executes SQLite `INSERT OR REPLACE INTO strongern_kv_store`. |
| `loadFromDb` | `src/utils/db.ts` | 71–102 | Synchronously loads and `JSON.parse`s KV entries. |
| Root Save `useEffect` | `src/App.tsx` | 545–602 | Monolithic save effect triggered on 35+ state changes; serializes full 300-session history. |
| History Reconcile `useEffect` | `src/App.tsx` | 605–621 | Re-writes all 300 sessions to SQLite relational tables on any `sessionsList` change. |
| `bootstrapPersistence` | `src/storage/persistenceBootstrap.ts` | 44–137 | Handles migration fingerprinting, relational session loading, and active draft restoration. |
| `reconcileSessions` | `src/storage/history/repository.ts` | 100–118 | Loops through all sessions in a transaction, deleting and re-inserting exercises and sets. |
| `upsertSession` | `src/storage/history/repository.ts` | 93–98 | Transactional insert/update of a single normalized session (fast). |
| `listSessions` | `src/storage/history/repository.ts` | 147–209 | Paginated session query reconstructing session exercises and set logs. |
| `saveActiveWorkoutDraft` | `src/storage/activeWorkoutSnapshot.ts` | 144–199 | Writes draft to alternating MMKV Slot A/B with monotonic sequence and checksum validation. |
| `clearActiveWorkoutDraft` | `src/storage/activeWorkoutSnapshot.ts` | 222–256 | Writes crash-safe tombstone envelope to MMKV. |
| `commitPatch` | `src/state/activeWorkoutStore.ts` | 50–63 | Zustand store patch commit calling MMKV snapshot save. |
| `handleFinishWorkout` | `src/App.tsx` | 1779–1905 | Aggregates workout stats, calls `upsertSession`, clears draft, and updates `sessionsList`. |
| `handleStartWorkout` | `src/App.tsx` | 1564–1732 | Maps exercises and resolves expected set suggestions using history index. |
| `resolveLastPerformanceSuggestion`| `src/storage/expectedValues.ts` | 51–114 | Resolves performance suggestions for active sets from history. |
| `useActiveExercisesState` | `src/hooks/useActiveExercisesState.ts` | 42–565 | Manages active workout set fields, completion toggling, and exercise additions. |
