# Handoff Report — Explorer 1 Survey

**Role**: Explorer 1 (`explorer_1_survey`)  
**Task**: Root Cause Investigation of Workout History Silent Load Failure & Tombstoning  
**Target Milestone**: Milestone 1 (Root Cause Diagnosis & History Recovery)  
**Status**: Hard Handoff (Investigation Complete)

---

## 1. Observation

1. **`src/App.tsx:260-261`**:
   `isDataLoaded` is initialized synchronously via MMKV instant cache (`React.useState(() => Boolean(initialAppData))`), whereas `isFullHistoryLoaded` starts as `false` (`React.useState(false)`).
2. **`src/App.tsx:353`**:
   `sessionsList` is initialized to `initialRecentSessions ?? []`, which is capped at 20 items by `setCachedRecentSessions` (`src/storage/instantCache.ts:166`).
3. **`src/App.tsx:836-860`**:
   The auto-sync Google Drive `useEffect` checks `if (!isDataLoaded) return;`, but completely omits checking `isFullHistoryLoaded`. When triggered, it uploads `backupData = { sessionsList, ... }` containing only the 20 preview items to Google Drive.
4. **`src/storage/history/repository.ts:100-118`**:
   `reconcileSessions(sessions)` executes `UPDATE workout_sessions SET deleted_at_ms = ? WHERE deleted_at_ms IS NULL AND id NOT IN (${placeholders});`. When passed a partial list (e.g. 20 items), it soft-deletes/tombstones all remaining sessions in the SQLite database.
5. **`src/App.tsx:989-993` & `src/App.tsx:1339-1343`**:
   Both `handleGoogleDriveSync` and `applyBackupData` pass the downloaded or restored sessions list into `reconcileSessions()`.
6. **`src/App.tsx:649-663`**:
   In `loadData()`, errors during `bootstrapPersistence` or `loadAllSessions` are caught and logged with `if (__DEV__) console.warn(...)`. In release APK builds (`__DEV__ === false`), persistence errors are completely silenced and not forwarded to `crashLogger.ts`.
7. **`src/storage/history/schema.ts:13-71` & `repository.ts:156-185`**:
   `workout_sessions` table uses `deleted_at_ms INTEGER`. Child tables `session_exercises` and `set_logs` link via `ON DELETE CASCADE`. Soft-deleting a session does not alter or delete child records; all exercises, sets, weights, and reps remain intact in SQLite.

---

## 2. Logic Chain

1. **Observation 1 & 2** establish that on app launch, `sessionsList` contains only 20 preview sessions from MMKV, and `isFullHistoryLoaded` is `false`.
2. **Observation 3** shows that the auto-sync effect does not gate on `isFullHistoryLoaded`. When triggered prior to full asynchronous SQLite hydration, it uploads the 20 preview sessions to Google Drive, overwriting any 300+ session cloud backup with a truncated 20-session backup.
3. **Observation 4 & 5** demonstrate that when Google Drive sync or backup restoration runs, `reconcileSessions()` is invoked with this 20-item list. `reconcileSessions()` executes a SQL update setting `deleted_at_ms = timestamp` on every row in `workout_sessions` whose ID is not in the 20-item list.
4. **Observation 7** confirms that the remaining 280+ workouts are not physically deleted; their rows in `workout_sessions`, `session_exercises`, and `set_logs` are preserved, but they are filtered out of all UI queries because queries include `WHERE deleted_at_ms IS NULL`.
5. **Observation 6** reveals that if SQLite connection or persistence bootstrap fails at runtime, the error is swallowed by `if (__DEV__) console.warn`, leaving the user permanently in preview mode with no crash log telemetry.
6. Therefore, untombstoning workouts requires setting `deleted_at_ms = NULL` on `workout_sessions`, replacing destructive `reconcileSessions` calls with safe `insertMissingSessionsOnly`, guarding cloud auto-sync with `if (!isFullHistoryLoaded) return;`, and un-gating error telemetry.

---

## 3. Caveats

- **External Sync Sources**: If a user previously performed a manual wipe (`handleWipeAllData`), rows were deleted via `reconcileSessions([])` (all set to tombstoned). Untombstoning all rows will restore them; if a user legitimately intended to delete a specific session via `handleDeleteSession`, a global untombstone would restore that single deleted session as well unless tombstone timestamps are distinguished. (In practice, for data recovery of lost history, restoring all tombstoned sessions is the desired safe recovery outcome).
- **Web Platform**: Web uses localStorage fallback and does not use native SQLite (`dbSingleton.ts` returns `null`).

---

## 4. Conclusion

The workout history truncation to 20 sessions is caused by a race condition where Google Drive auto-sync uploads the 20-session MMKV cache (due to missing `isFullHistoryLoaded` guard in `src/App.tsx:837`), followed by `reconcileSessions` in `src/storage/history/repository.ts` marking all other SQLite rows as soft-deleted (`deleted_at_ms = timestamp`).

All 300+ sessions remain fully recoverable in the local SQLite database. The required fix consists of:
1. Adding `if (!isFullHistoryLoaded) return;` to the auto-sync effect in `src/App.tsx`.
2. Replacing `reconcileSessions` in backup restore and cloud sync with `insertMissingSessionsOnly`.
3. Adding `countTombstonedSessions()` and `recoverTombstonedSessions()` to `src/storage/history/repository.ts`.
4. Integrating automatic recovery into `bootstrapPersistence()` and adding a one-tap "Repair Workout History" button in the Developer Options panel with AMOLED styling.
5. Converting silenced `if (__DEV__) console.warn` in `loadData()` to un-gated `console.error` and `saveCrashLogSync`.

---

## 5. Verification Method

To verify the findings and prospective fixes:

1. **Codebase Inspection**:
   - Check `src/App.tsx:837` for `isFullHistoryLoaded` guard.
   - Check `src/storage/history/repository.ts:100-118` for `reconcileSessions` SQL query.
   - Check `src/storage/history/schema.ts:26` for `deleted_at_ms`.
2. **Automated Test Execution**:
   - Run `npm test` to verify existing persistence and hydration test suites pass.
   - Run `npm run typecheck` to verify TypeScript contract alignment.
3. **Database Untombstoning Test**:
   - Insert 50 test sessions, execute `softDeleteSession()` or partial `reconcileSessions()`, verify `countTombstonedSessions()` increases, execute `recoverTombstonedSessions()`, and verify `loadAllSessions()` returns all 50 sessions.
