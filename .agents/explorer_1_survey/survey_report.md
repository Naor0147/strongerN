# Survey Report — Workout History Recovery & Root Cause Analysis

**Author**: Explorer 1 (`explorer_1_survey`)  
**Date**: 2026-08-18  
**Scope**: StrongerN Workout History, SQLite Schema, State Hydration, Google Drive Auto-Sync, and Tombstoning Mechanics.

---

## 1. Executive Summary

An in-depth investigation was conducted into the silent failure of workout history loading, the phenomenon of truncated workout counts (e.g. 20 sessions visible instead of 300+), and soft-deletion tombstoning in StrongerN.

### Key Discoveries:
1. **Intact SQLite Data**: Tombstoned workout sessions are NOT destroyed. The relational SQLite database (`strongern_v2.db`) retains the rows for `workout_sessions`, `session_exercises`, and `set_logs`. The sessions are invisible solely because `deleted_at_ms` was populated with a timestamp rather than being `NULL`.
2. **Dual-Fault Root Cause**:
   - **Fault A (Premature Cloud Sync)**: In `src/App.tsx`, the auto-sync effect triggers when `isDataLoaded` becomes `true` (which occurs synchronously on Frame 0 from MMKV cache). The auto-sync effect lacked the `if (!isFullHistoryLoaded) return;` check. Consequently, if any state update fired before the asynchronous SQLite database finished hydrating, the 20-item MMKV preview was uploaded to Google Drive as the authoritative backup.
   - **Fault B (Destructive Reconcile)**: When Google Drive sync or backup restore (`applyBackupData`) ran, it invoked `reconcileSessions()`. `reconcileSessions()` in `src/storage/history/repository.ts` issues `UPDATE workout_sessions SET deleted_at_ms = ? WHERE deleted_at_ms IS NULL AND id NOT IN (...)`. When supplied with the 20-session preview from Google Drive, SQLite immediately soft-deleted/tombstoned the remaining 280+ sessions.
3. **Silent Error Gating**: In `src/App.tsx`, `loadData()` caught errors in `bootstrapPersistence()` and `loadAllSessions()`, but logged them using `if (__DEV__) console.warn(...)`. In standalone release APK builds, errors during SQLite opening or session mapping are swallowed with zero telemetry, leaving the user permanently stuck in Frame 0 preview mode with `isFullHistoryLoaded = false`.

---

## 2. Storage & Lifecycle Architecture

### 2.1 File Map
- **`src/storage/keys.ts`**: Defines storage keys and DB names (`strongern.db`, `strongern_v2.db`, `strongern_instant_recent_sessions_v1`, etc.).
- **`src/storage/instantCache.ts`**: Synchronous MMKV cache holding Frame 0 data:
  - `getCachedRecentSessions()` / `setCachedRecentSessions(sessions, totalCount)` (slices at 20 items: `sessions.slice(0, 20)`).
  - `getCachedTotalSessionsCount()` / `setCachedTotalSessionsCount()`.
- **`src/storage/dbSingleton.ts`**: Manages the `SQLiteDatabase` connection for `strongern_v2.db` via Expo SQLite (`openDatabaseAsync`) with `PRAGMA journal_mode = WAL; foreign_keys = ON; busy_timeout = 5000;`.
- **`src/storage/history/schema.ts`**: Defines relational schema (v2) with `workout_sessions`, `session_exercises`, and `set_logs`, with indexes on `(deleted_at_ms, started_at_ms DESC, id)`.
- **`src/storage/history/repository.ts`**: Database repository with transactional queries (`loadAllSessions`, `listSessions`, `upsertSession`, `softDeleteSession`, `reconcileSessions`, `insertMissingSessionsOnly`, `countSessions`, `countAllRawSessions`).
- **`src/storage/persistenceBootstrap.ts`**: Startup bootstrap orchestrator (`bootstrapPersistence`) coordinating MMKV, SQLite V2 migrations, fast-path load, and health state.
- **`src/App.tsx`**: Central application component controlling React state (`sessionsList`, `isDataLoaded`, `isFullHistoryLoaded`), mount hydration, debounced SQLite/MMKV persistence, Google Drive sync, and backup restore.
- **`src/utils/crashLogger.ts`**: Error persistence capturing `console.error` and unhandled rejections into SQLite (`strongern_crashes.db`) and FileSystem JSON (`strongern_crash_logs.json`).

---

## 3. Root Cause Investigation & Evidence Chain

### 3.1 Root Cause 1: Premature Cloud Auto-Sync
- **Location**: `src/App.tsx:836–860`
- **Observed Code**:
  ```ts
  React.useEffect(() => {
    if (!isDataLoaded) return;
    
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    if (!googleUser || !googleUser.accessToken) return;

    const delayDebounceFn = setTimeout(async () => {
      ...
      const backupData = {
        user,
        sessionsList, // <--- SESSIONS LIST IN MEMORY
        ...
      };
      await googleDrive.updateBackupFile(googleUser.accessToken!, fileId, backupData);
  ```
- **Vulnerability**: `isDataLoaded` is initialized on line 260 as `React.useState(() => Boolean(initialAppData))`. If MMKV has cached app data, `isDataLoaded` is `true` on Frame 0, but `isFullHistoryLoaded` is `false` (line 261).
- **Failure Flow**:
  1. `sessionsList` is initialized to `initialRecentSessions` (max 20 sessions).
  2. Any hook trigger (e.g. auth check, template update, timer toggle) fires the auto-sync effect.
  3. After 2000ms debounce, `backupData` containing only the 20 preview sessions is written to Google Drive, replacing the full remote backup.

### 3.2 Root Cause 2: Destructive `reconcileSessions` Execution
- **Location**: `src/storage/history/repository.ts:100–118`
- **Observed Code**:
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
- **Invocation Locations**:
  - `src/App.tsx:990` (`handleGoogleDriveSync`)
  - `src/App.tsx:1340` (`applyBackupData` / file restore)
  - `src/App.tsx:1628` (`handleWipeAllData`)
- **Failure Flow**:
  1. Google Drive contains the poisoned 20-session backup (or the user restores a partial backup file).
  2. `handleGoogleDriveSync` or `applyBackupData` downloads the backup with 20 items.
  3. `reconcileSessions(restoredSessions)` is executed.
  4. The query `UPDATE workout_sessions SET deleted_at_ms = ? WHERE deleted_at_ms IS NULL AND id NOT IN (...)` runs against SQLite with the 20 IDs.
  5. The remaining 280+ sessions in SQLite are given a non-null `deleted_at_ms` value.
  6. Subsequent queries (`loadAllSessions()`, `listSessions()`, `countSessions()`) filter `WHERE deleted_at_ms IS NULL`, rendering those 280+ workouts invisible.

### 3.3 Root Cause 3: Silent Error Gating During Persistence Hydration
- **Location**: `src/App.tsx:649–665`
- **Observed Code**:
  ```ts
  } catch (e) {
    if (__DEV__) console.warn('Error loading persisted state', e);
    try {
      const fallbackSessions = await loadAllSessions();
      if (fallbackSessions) {
        const mapped = fallbackSessions.map(sessionV2ToLegacy);
        setSessionsList(mapped);
        setCachedRecentSessions(mapped, mapped.length);
        setUser(prev => ({ ...prev, totalWorkouts: mapped.length }));
        setIsFullHistoryLoaded(true);
      }
    } catch (fallbackErr) {
      if (__DEV__) console.warn('Fallback loadAllSessions failed', fallbackErr);
    }
  } finally {
    setIsDataLoaded(true);
  }
  ```
- **Vulnerability**:
  - All errors in `loadData()` are gated by `if (__DEV__) console.warn(...)`.
  - In production builds (`__DEV__ === false`), `console.warn` is silenced. Furthermore, `crashLogger.ts` only hooks `console.error` (line 297), so these errors are never written to `strongern_crashes.db` or shown in the Developer Crash Logs.
  - `setIsDataLoaded(true)` in `finally` permits auto-sync to trigger even if history loading failed.

---

## 4. SQLite Schema & Tombstone Analysis

### 4.1 Relational Integrity
- **Table**: `workout_sessions`
  - `id`: Text Primary Key
  - `deleted_at_ms`: Integer (Epoch MS timestamp if deleted; `NULL` if active)
- **Table**: `session_exercises`
  - `session_id`: References `workout_sessions(id) ON DELETE CASCADE`
- **Table**: `set_logs`
  - `session_exercise_id`: References `session_exercises(id) ON DELETE CASCADE`

### 4.2 Impact of Soft Deletion on Child Data
Because soft deletion updates `workout_sessions.deleted_at_ms` rather than executing SQL `DELETE`, child tables `session_exercises` and `set_logs` remain completely untouched.
- `session_exercises` rows are intact.
- `set_logs` rows (weights, reps, RPE, unilateral flags) are intact.
- PR calculations and history mappings remain recoverable simply by executing:
  ```sql
  UPDATE workout_sessions
  SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1
  WHERE deleted_at_ms IS NOT NULL;
  ```

---

## 5. Recovery Strategy & Proposed Architectural Fixes

### 5.1 Fix Component 1: Cloud Sync Guarding
In `src/App.tsx:837`:
```ts
// Auto-sync state changes to Google Drive
React.useEffect(() => {
  // CRITICAL: Block auto-sync upload until full history is confirmed loaded.
  if (!isDataLoaded || !isFullHistoryLoaded) return;
  
  if (isInitialLoadRef.current) {
    isInitialLoadRef.current = false;
    return;
  }
  ...
```

### 5.2 Fix Component 2: Safe Merge-Only Restore & Sync Logic
Replace destructive `reconcileSessions` calls in `handleGoogleDriveSync` and `applyBackupData` with `insertMissingSessionsOnly` or safe merge:
1. In `src/App.tsx:989-993` (`handleGoogleDriveSync`):
   ```ts
   if (historyRepositoryReadyRef.current) {
     insertMissingSessionsOnly(mergedSessions.map((s: any, idx: number) => legacySessionToV2(s, idx))).catch((err) => {
       console.error('[HistoryRepository] Google Drive sync session insert failed:', err);
     });
   }
   ```
2. In `src/App.tsx:1339-1343` (`applyBackupData`):
   ```ts
   if (historyRepositoryReadyRef.current) {
     insertMissingSessionsOnly(restoredSessions.map((s: any, idx: number) => legacySessionToV2(s, idx))).catch((err) => {
       console.error('[HistoryRepository] Backup restore session insert failed:', err);
     });
   }
   ```

### 5.3 Fix Component 3: Atomic Repository Recovery Methods
In `src/storage/history/repository.ts`, export dedicated count and untombstone helpers:
```ts
export async function countTombstonedSessions(): Promise<number> {
  const db = await requireDb();
  const row: any = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;'
  );
  return Number(row?.count ?? 0);
}

export function recoverTombstonedSessions(): Promise<number> {
  return enqueueWrite(async () => {
    const db = await requireDb();
    const now = Date.now();
    const result: any = await db.runAsync(
      'UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1 WHERE deleted_at_ms IS NOT NULL;',
      [now]
    );
    return Number(result?.changes ?? 0);
  });
}
```

### 5.4 Fix Component 4: Startup Self-Healing in Persistence Bootstrap
In `src/storage/persistenceBootstrap.ts`:
If relational SQLite is verified, query `countTombstonedSessions()`. If tombstoned sessions exist and total raw rows exceeds active sessions, automatically untombstone them or heal missing records:
```ts
const tombstoned = await countTombstonedSessions();
if (tombstoned > 0) {
  await recoverTombstonedSessions();
  sessions = await loadAllSessions();
}
```

### 5.5 Fix Component 5: Un-gated Error Logging to Crash Logger
In `src/App.tsx:650` and `src/App.tsx:661`:
Replace `if (__DEV__) console.warn` with:
```ts
console.error('[Persistence] Error loading persisted state:', e);
saveCrashLogSync(`Persistence Load Failure: ${e?.message || e}`, e?.stack || '', false);
```

### 5.6 Fix Component 6: Developer Diagnostic & Repair UI Panel
In `src/screens/ProfileScreen.tsx` / `DeveloperCrashLogsView.tsx`:
Add a Developer Diagnostic card showing:
- SQLite Health Status (`ready`, `legacy_safe_mode`, etc.)
- Active Sessions Count (`countSessions()`)
- Tombstoned Sessions Count (`countTombstonedSessions()`)
- Raw Total SQLite Rows (`countAllRawSessions()`)
- MMKV Cached Recent Sessions Count
- Action button: **"Repair Workout History"** (calls `recoverTombstonedSessions()`, reloads `sessionsList`, updates MMKV cache, displays success alert with recovered count).
- AMOLED pure black design token compliance (`colors.bg`, `colors.surface`, `colors.accent`, `colors.success`, `ripple.surface`).

---

## 6. Comprehensive Verification & Testing Plan

1. **Unit & Adversarial Tests**:
   - `__tests__/instantCache.test.ts`: Verify `setCachedRecentSessions` slices to 20 without data loss.
   - `__tests__/coldStartHydration.test.ts` & `persistenceArchitecture.test.ts`: Test migration, fastpath, and self-healing.
   - New Regression Tests:
     - Verify auto-sync is blocked when `isFullHistoryLoaded` is `false`.
     - Verify `insertMissingSessionsOnly` preserves local database rows when restoring a 1-session or empty backup.
     - Verify `recoverTombstonedSessions()` restores tombstoned rows with exercises and set logs.
2. **Build Verification**:
   - Run `npm run typecheck`
   - Run `npm test`
   - Build standalone release APK: `cmd /c build-apk.bat --auto`
