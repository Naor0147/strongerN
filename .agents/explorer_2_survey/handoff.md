# Handoff Report: Cloud Sync, Backup/Restore, & Reconcile Survey (Explorer 2)

**Agent**: Explorer 2  
**Mission**: Investigate Cloud Sync (Google Drive), backup/export/restore, and reconcile logic  
**Handoff Type**: Hard Handoff (Investigation Complete)  
**Report Artifact**: `c:\Antigravity\strongerN\.agents\explorer_2_survey\survey_report.md`  

---

## 1. Observation

1. **`reconcileSessions` executes destructive soft-deletes in SQLite**:
   - Location: `src/storage/history/repository.ts:100-118`
   - Code:
     ```typescript
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
   - Invocations in `src/App.tsx`:
     - Line 1340 (`applyBackupData`): `reconcileSessions(restoredSessions...)`
     - Line 990 (`handleGoogleLogin`): `reconcileSessions(mergedSessions...)`
     - Line 1628 (`handleWipeAllData`): `reconcileSessions([])`

2. **Google Drive Auto-Sync lacks `isFullHistoryLoaded` gate**:
   - Location: `src/App.tsx:836-908`
   - The effect checks `if (!isDataLoaded) return;` and `if (isInitialLoadRef.current) ...`, but **does not check** `isFullHistoryLoaded`.
   - On Frame 0, `sessionsList` is initialized from MMKV preview cache (`initialRecentSessions`, line 353), which is capped at 20 items by `setCachedRecentSessions` (`src/storage/instantCache.ts:166`).
   - If any state update fires before or during SQLite load, or if SQLite load fails, auto-sync uploads the 20-item preview list to Google Drive, overwriting the 300+ workout remote backup.

3. **Manual Cloud Sync & Export Vulnerabilities**:
   - `handleCloudSync` (`src/App.tsx:1220-1257`) and `handleExportBackup` (`src/App.tsx:1260-1296`) serialize in-memory `sessionsList` without checking `isFullHistoryLoaded`.

4. **No Tombstone Recovery Functionality in SQLite**:
   - Currently, `repository.ts` has `softDeleteSession` (L129-137) but no function to un-delete sessions (`UPDATE workout_sessions SET deleted_at_ms = NULL`).

---

## 2. Logic Chain

1. **Destructive Restore Causality**:
   - Observation 1 demonstrates that `reconcileSessions` marks all SQLite sessions not present in the input array with `deleted_at_ms = now`.
   - Observation 1 also shows that when a user restores a partial backup (e.g. 50 workouts), `applyBackupData` passes only those 50 workouts into `reconcileSessions`.
   - In SQLite, the query `UPDATE workout_sessions SET deleted_at_ms = now WHERE id NOT IN (...)` soft-deletes the remaining 250+ workouts.
   - On subsequent launches, `loadAllSessions()` queries `WHERE deleted_at_ms IS NULL`, rendering all 250+ older workouts invisible to the user.

2. **Auto-Sync Cloud Poisoning Causality**:
   - Observation 2 demonstrates that on Frame 0, `sessionsList` contains at most 20 items from MMKV instant cache.
   - When `isDataLoaded` becomes `true`, `isInitialLoadRef.current` toggles to `false`.
   - Any state change (e.g., toggling a timer, editing an exercise, or auto-sync timer triggering) executes `delayDebounceFn` (2000ms).
   - Because `isFullHistoryLoaded` is not required, `sessionsList` (20 items) is uploaded to Google Drive via `updateBackupFile`.
   - The user's cloud backup is now permanently reduced to 20 workouts.

3. **Safe Merge-Only Solution**:
   - Replacing `reconcileSessions` with `insertMissingSessionsOnly` in `applyBackupData` and `handleGoogleLogin` guarantees existing local sessions are never updated with `deleted_at_ms`.
   - Adding `if (!isFullHistoryLoaded) return;` to the auto-sync hook and `handleCloudSync` ensures partial preview state is never uploaded to Google Drive.
   - Adding `restoreAllTombstonedSessions()` provides a one-click repair mechanism to restore any workouts previously tombstoned by `reconcileSessions`.

---

## 3. Caveats

1. **`handleWipeAllData` Intentional Wipe**:
   - When a user explicitly taps "Wipe All Data" in Profile, clearing all local workouts is the intended behavior. `handleWipeAllData` (`src/App.tsx:1615-1639`) can retain a direct delete/clear operation, but should be isolated from restore and sync code paths.
2. **Web Fallback Mode**:
   - When running on Web where SQLite is unavailable, persistence falls back to JSON/MMKV. The merge-only logic must gracefully support both SQLite relational mode and the memory/fallback mode.

---

## 4. Conclusion

The root causes of workout history loss in StrongerN are:
1. Destructive `reconcileSessions` calls during backup restore and Google login.
2. Premature auto-sync uploads of 20-session MMKV preview state prior to full SQLite hydration.

**Prescribed Architectural Fix for Milestone 2 & 3**:
1. **`src/storage/history/repository.ts`**:
   - Enhance `insertMissingSessionsOnly` to un-delete existing tombstoned sessions when active versions are imported.
   - Add `restoreAllTombstonedSessions(): Promise<number>` and `countTombstonedSessions(): Promise<number>`.
2. **`src/App.tsx`**:
   - Guard Auto-Sync and `handleCloudSync` with `isFullHistoryLoaded`.
   - Replace `reconcileSessions` in `applyBackupData` and `handleGoogleLogin` with `insertMissingSessionsOnly` followed by `loadAllSessions()` re-hydration.
3. **`src/screens/ProfileScreen.tsx`**:
   - Expose SQLite diagnostic stats (active, raw, tombstoned, MMKV cached) and a "Repair Workout History" button in Developer Options.

---

## 5. Verification Method

- **Unit & Integration Test Suite**:  
  `$env:PATH = "F:\.fnm\node-versions\v22.22.3\installation;" + $env:PATH; npm test`  
  (All 18 suites / 150 tests currently pass)
- **TypeScript Static Verification**:  
  `$env:PATH = "F:\.fnm\node-versions\v22.22.3\installation;" + $env:PATH; npm run typecheck`  
  (Passes with 0 errors)
- **Key Files to Inspect**:
  - `src/storage/history/repository.ts` (L100-118, L350-362)
  - `src/App.tsx` (L836-908, L969-994, L1220-1257, L1324-1396)
  - `src/storage/instantCache.ts` (L163-171)
  - `src/screens/ProfileScreen.tsx` (L2303-2380)
