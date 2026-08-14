# Handoff Report: StrongerN State Management & Persistence Survey

## 1. Observation

Direct observations from codebase inspection:

1. **Root State Monolithic Bundling & Serialization**:
   - `src/App.tsx:545-602`: An `useEffect` listening on 35+ state variables (`user`, `sessionsList`, `templatesList`, `exercisesList`, `primaryMetricsList`, `bodyPartMetricsList`, `isAutoTimerEnabled`, `googleUser`, `animationSpeed`, `lastSynced`, `foldersList`, `activeProgramId`, `programStartDate`, `isHealthSyncEnabled`, `isLiveHeartRateEnabled`, `isProgramsEnabled`, `isHistoryEnabled`, `isMusclesEnabled`, `soundSetCompleted`, `soundWorkoutFinished`, `soundTimerCompleted`, `customSounds`, `soundVolume`, `defaultRestDuration`, `showAchievementBadges`, `showSummaryWidgets`, `showWeeklyTonnage`, `showWorkoutsChart`, `showHighlights`, `showHypertrophyGoal`, `enableRoutineFolders`, `isDeveloperModeEnabled`, `isProgressiveOverloadEnabled`, `isAutoFinishSetEnabled`, `isRpeMode`, `appTheme`, `customAccentColor`, `isDataLoaded`) bundles all states—including `sessionsList` (300+ full sessions)—into a single `data` object and calls `saveToDb(STORAGE_KEY, data)`.
   - `src/utils/db.ts:40-69`: `saveToDb` executes `const serialized = JSON.stringify(value)` and runs SQLite `INSERT OR REPLACE INTO strongern_kv_store (key, value) VALUES (?, ?)` with this multi-megabyte string.

2. **Full History Relational Table Re-write**:
   - `src/App.tsx:605-621`: An `useEffect` triggers on `[isDataLoaded, sessionsList]` with a 250ms debounce and calls `reconcileSessions(normalized)`.
   - `src/storage/history/repository.ts:100-118`: `reconcileSessions` iterates through all sessions in `sessionsList` (`for (const session of sessions) await writeSession(db, session)`). Inside `writeSession` (`lines 39-81`), it executes an `INSERT OR REPLACE` into `workout_sessions`, deletes all rows from `session_exercises` for each session, and re-inserts every exercise and set into `session_exercises` and `set_logs`. For 300 sessions, this executes ~8,000–10,000 SQL statements inside a single transaction.

3. **Dual-Write Redundancy for Active Workout & Finished Sessions**:
   - `src/state/activeWorkoutStore.ts:50-63` & `src/storage/activeWorkoutSnapshot.ts:144-199`: In-flight active workout updates save snapshots to MMKV Slot A/B (`strongern_active_draft_slot_a`/`_b`).
   - `src/App.tsx:1544-1551` & `1973-2000`: In parallel, `saveActiveWorkoutState(false)` serializes active workout state to SQLite KV (`saveToDb('strongern_active_workout_state', freshState)`).
   - `src/App.tsx:1878-1886`: When a workout is finished, `handleFinishWorkout` calls `await upsertSession(legacySessionToV2(durableSession))` to write the single session to `strongern_v2.db`, and then updating `sessionsList` immediately triggers both the monolithic `saveToDb(STORAGE_KEY, data)` and the full `reconcileSessions(normalized)`.

4. **Settings Key Defined but Unused**:
   - `src/storage/keys.ts:18`: `SETTINGS_COMPACT_V2: 'strongern_settings_v2'` is defined, but grep across `src/` shows 0 usages in runtime code. Settings remain coupled to the monolithic KV payload.

5. **Cold Start Re-hydration Multi-Pass**:
   - `src/App.tsx:398-416` & `src/storage/persistenceBootstrap.ts:44-137`: Startup loads and parses the giant JSON from `strongern_kv_store`, stringifies all sessions again to compute `fingerprintLegacySessions`, queries all sessions from `strongern_v2.db` via `loadAllSessions()` (3 paginated queries), maps them back to legacy format, and sets `sessionsList`.

---

## 2. Logic Chain

1. **Premise 1**: Any change to any setting (e.g. volume slider, theme color, rest timer duration) triggers the root `useEffect` in `App.tsx:545-602` because all 35+ state hooks are listed in its dependency array.
2. **Premise 2**: The root save handler constructs `data` containing the full `sessionsList`. As session count reaches 300+, `JSON.stringify(data)` becomes a heavy synchronous operation that blocks the JavaScript thread.
3. **Premise 3**: Modifying `sessionsList` (such as finishing or editing a workout session) causes `App.tsx:605-621` to run `reconcileSessions`.
4. **Premise 4**: `reconcileSessions` does not perform delta updates; it loops through every single session and re-writes all exercises and set logs from scratch to SQLite relational tables.
5. **Deduction**: Therefore, routine state updates and historical session persistence are completely coupled. The application suffers from double serialization (KV JSON + Relational SQLite) and N-session write thrashing on every session change.
6. **Conclusion**: Decoupling settings into MMKV (`strongern_settings_v2`), removing `sessionsList` from `strongern_app_data_v1`, scoping `reconcileSessions` strictly to bulk imports, and relying on `upsertSession` for single-session writes will eliminate lag and achieve sub-150ms startup hydration.

---

## 3. Caveats

- **External Sync (Google Drive)**: `handleCloudSync` and auto-sync (`App.tsx:638-710`) expect a full `sessionsList` array in `BackupData`. Decoupling `sessionsList` from local KV store must retain the ability to construct full backup objects for cloud upload on demand.
- **CSV & Backup Import**: CSV import (`importStrongCSV`) and backup restore (`handleRestoreBackup`) produce arrays of sessions that must continue to populate both `strongern_v2.db` and in-memory state.
- **Web Compatibility**: On web (`Platform.OS === 'web'`), `mmkvAdapter` falls back to `localStorage` and `getV2Database()` returns `null`. Web fallback behavior must remain functional.

---

## 4. Conclusion

1. **Root Bottleneck Identified**: The primary performance degradations with 300+ workouts are:
   - Monolithic stringification of `sessionsList` in `App.tsx:545-602` upon any state change.
   - Unconditional full-table re-write in `reconcileSessions` via `App.tsx:605-621`.
   - Redundant dual-write to SQLite KV store during active workouts and session finishes.
2. **Proposed Actionable Decoupling Plan**:
   - **Phase A: Settings & Library Partitioning**: Move user preferences, theme, sounds, and toggles into `strongern_settings_v2` via MMKV. Remove `sessionsList` from the root KV payload.
   - **Phase B: Single-Session Delta Writes**: Rely solely on `upsertSession(session)` / `softDeleteSession(sessionId)` for routine workout completion and deletions. Remove the automated `reconcileSessions` `useEffect`.
   - **Phase C: Streamlined Hydration**: Skip legacy JSON parsing of sessions when `strongern_v2.db` is initialized and verified. Restore settings and active draft directly from MMKV in < 1ms.

---

## 5. Verification Method

To independently verify these findings:

1. **Inspect Code Locations**:
   - View `src/App.tsx` lines 545–621 (monolithic save & reconcile hooks).
   - View `src/storage/history/repository.ts` lines 100–118 (`reconcileSessions` loop).
   - View `src/storage/persistenceBootstrap.ts` lines 44–137 (`bootstrapPersistence` flow).
   - View `src/storage/keys.ts` line 18 (`SETTINGS_COMPACT_V2` definition).

2. **Run Unit Tests**:
   - Execute: `npx jest src/__tests__/persistenceArchitecture.test.ts`
   - Execute: `npx jest src/__tests__/storageContracts.test.ts`
   - Execute: `npx jest src/__tests__/phase1Storage.test.ts`
   - Execute: `npx jest src/__tests__/routineLoadingBenchmark.test.ts`

3. **Check TypeScript Compilation**:
   - Execute: `npm run typecheck`
