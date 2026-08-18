# Comprehensive Survey Report: Cloud Sync, Backup/Restore, & Reconcile Logic Hardening
**Author**: Explorer 2 (Teamwork Investigation Subagent)  
**Date**: 2026-08-18  
**Scope**: StrongerN Workout History Recovery & Hardening Project (`c:\Antigravity\strongerN`)  
**Target Milestone**: Milestone 2 (Cloud Sync & Reconcile Hardening) + Milestone 3 (Developer Diagnostics & Recovery)

---

## 1. Executive Summary & Root Cause Synthesis

An exhaustive static and dynamic survey of the StrongerN codebase was conducted to investigate workout history loss, silent data poisoning, and cloud synchronization vulnerabilities. The investigation identified **three critical defect vectors** responsible for workout history truncation and data loss:

1. **Destructive Reconcile Soft-Deletion Bug**:  
   In `src/storage/history/repository.ts:100-118`, the `reconcileSessions(sessions)` function treats the input `sessions` array as the exclusive, exhaustive set of valid workouts. Any session in SQLite not present in the input array is soft-deleted (`UPDATE workout_sessions SET deleted_at_ms = ? WHERE deleted_at_ms IS NULL AND id NOT IN (...)`). Because `applyBackupData` (`src/App.tsx:1340`) and `handleGoogleLogin` (`src/App.tsx:990`) call `reconcileSessions`, restoring a partial/stale backup or logging into Google Drive when only a partial set is present permanently tombstones all other historical local sessions (e.g. 300+ workouts).

2. **Auto-Sync Cloud Poisoning Vulnerability**:  
   In `src/App.tsx:836-908`, the Google Drive auto-sync `useEffect` fires whenever state dependencies change. While `isDataLoaded` is checked, `isFullHistoryLoaded` is **never checked**. When the app starts, `sessionsList` is initialized on Frame 0 from the MMKV instant cache, which caps recent sessions at 20 (`src/storage/instantCache.ts:166`). If any state change occurs before or during SQLite hydration, or if SQLite hydration encounters an error, the auto-sync debouncer uploads the 20-workout preview to Google Drive, completely overwriting the user's remote cloud backup.

3. **Absence of Tombstone Recovery & Diagnostic Safeguards**:  
   There is currently no API or UI mechanism in `repository.ts` or `ProfileScreen.tsx` to un-tombstone sessions (`deleted_at_ms IS NOT NULL`). Workouts that were soft-deleted by previous reconcile bugs remain hidden in SQLite while raw rows still exist on disk.

---

## 2. Complete Inventory of Sync, Backup, & Storage Files

| File Path | Primary Responsibility | Critical Functions & Line Numbers | Vulnerability Rating |
|---|---|---|---|
| `src/storage/history/repository.ts` | Relational SQLite persistence & write queue | `reconcileSessions` (L100-118)<br>`insertMissingSessionsOnly` (L350-362)<br>`softDeleteSession` (L129-137)<br>`loadAllSessions` (L156-245)<br>`countSessions` (L330-336)<br>`countAllRawSessions` (L338-342) | **CRITICAL** (Destructive reconcile logic) |
| `src/App.tsx` | Main application coordinator, sync lifecycle, & restore handlers | Frame 0 `sessionsList` init (L353)<br>`loadData` startup (L500-668)<br>Auto-Sync `useEffect` (L836-908)<br>`handleGoogleLogin` (L927-1114)<br>`handleCloudSync` (L1220-1257)<br>`handleExportBackup` (L1260-1296)<br>`applyBackupData` (L1324-1396)<br>`handleRestoreBackup` (L1402-1416)<br>`handleWipeAllData` (L1615-1639) | **CRITICAL** (Un-gated auto-sync, reconcile on restore, partial export) |
| `src/utils/googleDrive.ts` | Google Drive REST API integration | `fetchUserProfile` (L29)<br>`findBackupFile` (L52)<br>`downloadBackupFile` (L76)<br>`createBackupFile` (L96)<br>`updateBackupFile` (L138) | **SAFE** (Clean HTTP transport) |
| `src/utils/backupManager.ts` | File-based JSON backup export, picker, & validation | `exportBackupToFile` (L68)<br>`pickAndReadBackupFile` (L120)<br>`validateBackup` (L164)<br>`buildBackupData` (L224) | **SAFE** (Payload validator handles v1 & v2) |
| `src/storage/instantCache.ts` | Synchronous Frame 0 MMKV cache | `getCachedRecentSessions` (L125)<br>`setCachedRecentSessions` (L163, caps to 20)<br>`getCachedTotalSessionsCount` (L143)<br>`setCachedTotalSessionsCount` (L153) | **SAFE** (Cache layer correctly decouples Frame 0) |
| `src/storage/persistenceBootstrap.ts` | Startup migration & fast-path coordinator | `bootstrapPersistence` (L69-256)<br>Fast-path hydration (L107-137)<br>Legacy migration (L138-175) | **SAFE** (Uses `insertMissingSessionsOnly` for self-healing) |
| `src/screens/ProfileScreen.tsx` | Profile, settings, cloud sync, & developer options UI | `handleConnectWithToken` (L571)<br>`handleImportFromFile` (L749)<br>`handleImportSubmit` (L771)<br>Developer tools UI (L2303-2380) | **MODERATE** (Needs diagnostic & repair panel) |
| `src/screens/LoginScreen.tsx` | Onboarding & login restore UI | `handleRestoreFile` (L310)<br>`handleGoogleConnectWithToken` (L358) | **SAFE** (Delegates to App.tsx callbacks) |

---

## 3. Deep-Dive Investigation of Vulnerabilities & Call Chains

### 3.1 The `reconcileSessions` Destructive Soft-Deletion Mechanism

#### Code Analysis (`src/storage/history/repository.ts:100-118`):
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

#### The Problem:
`reconcileSessions` enforces a full-state synchronization model where the caller's list is assumed to be an absolute truth. Any session already in the SQLite database whose ID is not in `ids` receives `deleted_at_ms = Date.now()`.

#### Impact on Backup Restore Flow:
1. User has 300 valid workout sessions stored in SQLite over years of usage.
2. User imports an older backup file (e.g. from 6 months ago, containing 120 sessions) or a partial backup.
3. In `src/App.tsx:1325` (`applyBackupData`):
   ```typescript
   if (parsed.sessionsList) {
     const restoredSessions = parsed.sessionsList.map((s: any) => ({
       ...s,
       datetime: new Date(s.datetime)
     }));
     setSessionsList(restoredSessions);
     if (historyRepositoryReadyRef.current) {
       reconcileSessions(restoredSessions.map((s: any, idx: number) => legacySessionToV2(s, idx))).catch((err) => {
         console.error('[HistoryRepository] Backup restore reconciliation failed:', err);
       });
     }
   }
   ```
4. `reconcileSessions` is executed with only the 120 restored sessions.
5. The remaining 180 newer sessions in SQLite are soft-deleted (`deleted_at_ms = now`).
6. Because `loadAllSessions()` filters by `WHERE deleted_at_ms IS NULL`, on subsequent launches or queries, those 180 workouts are completely invisible to the user.

#### Impact on Google Drive Sync Flow:
In `src/App.tsx:969-994` (`handleGoogleLogin`):
```typescript
const localSessions = sessionsList || [];
const remoteSessions = backupData.sessionsList || [];
const mergedSessions = [...localSessions];
remoteSessions.forEach((rs: any) => {
  if (!mergedSessions.some(ls => ls.id === rs.id)) {
    mergedSessions.push({ ...rs, datetime: new Date(rs.datetime) });
  }
});
...
reconcileSessions(mergedSessions.map((s: any, idx: number) => legacySessionToV2(s, idx)));
```
If `sessionsList` in memory only had 20 cached preview sessions, and remote Google Drive had 10 sessions, `mergedSessions` has ~30 sessions. Calling `reconcileSessions` soft-deletes the other 270+ workouts stored in SQLite!

---

### 3.2 Google Drive Auto-Sync Premature Upload Vulnerability

#### Code Analysis (`src/App.tsx:836-908`):
```typescript
React.useEffect(() => {
  if (!isDataLoaded) return;
  
  if (isInitialLoadRef.current) {
    isInitialLoadRef.current = false;
    return;
  }

  if (!googleUser || !googleUser.accessToken) return;

  const delayDebounceFn = setTimeout(async () => {
    console.log('[Auto-Sync] Commencing automatic Google Drive backup update...');
    try {
      const nowStr = new Date().toISOString();
      const backupData = {
        user,
        sessionsList, // <-- In-memory state
        templatesList,
        exercisesList,
        primaryMetricsList,
        bodyPartMetricsList,
        isAutoTimerEnabled,
        timestamp: nowStr,
        lastSynced: nowStr,
      };
      ...
      await googleDrive.updateBackupFile(googleUser.accessToken!, fileId, backupData);
    } catch (e: any) { ... }
  }, 2000);

  return () => clearTimeout(delayDebounceFn);
}, [user, sessionsList, templatesList, exercisesList, primaryMetricsList, bodyPartMetricsList, isAutoTimerEnabled, googleUser]);
```

#### Detailed Execution Failure Timeline:
1. **Frame 0**: `sessionsList` is initialized from MMKV instant cache (`initialRecentSessions`, capped at 20 items by `setCachedRecentSessions`).
2. **Frame 1**: `loadData()` starts asynchronously in a `useEffect` to hydrate full history from SQLite.
3. `isDataLoaded` is initially `false`. When `loadData()` completes (or reaches its `finally` block), `isDataLoaded` is set to `true`.
4. `isInitialLoadRef.current` is consumed and toggled to `false`.
5. **The Trap**: If SQLite hydration failed or was delayed, or if the user modified any profile setting, timer setting, or workout name before `isFullHistoryLoaded` became `true`, the dependency array triggers the auto-sync `useEffect`.
6. Since `isInitialLoadRef.current` is `false`, `isDataLoaded` is `true`, and `googleUser.accessToken` is present, the 2000ms timer starts.
7. Auto-sync packages `sessionsList` (which only contains the 20 preview items!) and sends an `updateBackupFile` request to Google Drive.
8. **Result**: The remote cloud backup file (which previously contained the user's entire multi-year history of 300+ workouts) is overwritten by a 20-workout file. Cloud history is poisoned.

---

### 3.3 Manual Sync & Backup Export Vulnerabilities

#### `handleCloudSync` (`src/App.tsx:1220-1257`):
```typescript
const handleCloudSync = async () => {
  if (!googleUser || !googleUser.accessToken) return false;
  try {
    const nowStr = new Date().toISOString();
    const backupData = {
      user,
      sessionsList, // <-- No isFullHistoryLoaded verification!
      ...
    };
    ...
    await googleDrive.updateBackupFile(googleUser.accessToken, fileId, backupData);
    return true;
  } ...
};
```
If the user taps "Sync Now" in Profile before full history is hydrated or if full history failed to load, it uploads whatever partial list is in memory.

#### `handleExportBackup` (`src/App.tsx:1260-1296`):
```typescript
const handleExportBackup = async (): Promise<boolean> => {
  const backupData = buildBackupData({
    username: user.name,
    user,
    sessionsList, // <-- May be partial preview list!
    ...
  });
  return exportBackupToFile(backupData);
};
```
If the user taps "Export Backup" while `!isFullHistoryLoaded`, the exported `.json` file contains only the 20 preview workouts.

---

## 4. Architectural Fix & Hardening Design (Milestone 2 & 3)

### 4.1 Safe Merge-Only Logic in `repository.ts`

To guarantee that no local workout can ever be deleted or tombstoned by backup restore or cloud sync, we must replace `reconcileSessions` with **merge-only semantics**:

#### 1. Enhanced `insertMissingSessionsOnly` / `mergeSessionsSafe`:
```typescript
/**
 * Safely inserts missing sessions into SQLite and un-deletes any existing
 * sessions that were previously soft-deleted, WITHOUT deleting any existing local workouts.
 */
export function insertMissingSessionsOnly(sessions: WorkoutSessionV2[]): Promise<void> {
  return enqueueWrite(async () => {
    const db = await requireDb();
    await transaction(db, async () => {
      const existingIds = await getAllSessionIds();
      for (const session of sessions) {
        if (!existingIds.has(session.id)) {
          await writeSession(db, session);
        } else {
          // If session exists but was soft-deleted, un-delete it if the restored copy is active
          if (session.deletedAtMs === null) {
            await db.runAsync(
              'UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ? WHERE id = ? AND deleted_at_ms IS NOT NULL;',
              [Date.now(), session.id]
            );
          }
        }
      }
    });
  });
}
```

#### 2. Tombstone Recovery Function (`restoreAllTombstonedSessions`):
```typescript
/**
 * Un-deletes all soft-deleted sessions in SQLite (clearing deleted_at_ms).
 * Returns the count of recovered sessions.
 */
export function restoreAllTombstonedSessions(): Promise<number> {
  return enqueueWrite(async () => {
    const db = await requireDb();
    const result = await db.runAsync(
      'UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ? WHERE deleted_at_ms IS NOT NULL;',
      [Date.now()]
    );
    return result.changes ?? 0;
  });
}

/**
 * Counts all soft-deleted / tombstoned sessions currently in SQLite.
 */
export async function countTombstonedSessions(): Promise<number> {
  const db = await requireDb();
  const row: any = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;'
  );
  return Number(row?.count ?? 0);
}
```

#### 3. Restrict `reconcileSessions`:
`reconcileSessions` must NEVER be called by `applyBackupData` or `handleGoogleLogin`. The ONLY allowed call site for clearing sessions is `handleWipeAllData` when the user explicitly triggers a full factory reset.

---

### 4.2 Hardening `App.tsx` Flows

#### 1. Hardening Auto-Sync (`App.tsx:836-908`):
```typescript
React.useEffect(() => {
  // CRITICAL GATE: Auto-sync must NEVER run if full history is not confirmed loaded
  if (!isDataLoaded || !isFullHistoryLoaded) return;
  
  if (isInitialLoadRef.current) {
    isInitialLoadRef.current = false;
    return;
  }

  if (!googleUser || !googleUser.accessToken) return;

  // SAFETY CHECK: Prevent empty or suspicious upload if user had workouts
  if (sessionsList.length === 0 && (user.totalWorkouts || 0) > 0) {
    console.warn('[Auto-Sync] Blocked upload: sessionsList is empty but totalWorkouts > 0');
    return;
  }

  const delayDebounceFn = setTimeout(async () => {
    ...
  }, 2000);

  return () => clearTimeout(delayDebounceFn);
}, [user, sessionsList, templatesList, exercisesList, primaryMetricsList, bodyPartMetricsList, isAutoTimerEnabled, googleUser, isDataLoaded, isFullHistoryLoaded]);
```

#### 2. Hardening Manual Cloud Sync (`handleCloudSync`):
```typescript
const handleCloudSync = async () => {
  if (!googleUser || !googleUser.accessToken) return false;
  if (!isFullHistoryLoaded) {
    console.warn('[CloudSync] Sync blocked: Full history not loaded yet');
    return false;
  }
  ...
};
```

#### 3. Hardening Backup Restore (`applyBackupData` at `App.tsx:1324-1396`):
```typescript
const applyBackupData = async (parsed: any): Promise<boolean> => {
  try {
    ...
    if (parsed.sessionsList) {
      const restoredSessions = parsed.sessionsList.map((s: any) => ({
        ...s,
        datetime: new Date(s.datetime)
      }));
      
      if (historyRepositoryReadyRef.current) {
        const v2Restored = restoredSessions.map((s: any, idx: number) => legacySessionToV2(s, idx));
        // SAFE MERGE: Insert missing sessions without deleting local workouts!
        await insertMissingSessionsOnly(v2Restored);
        
        // Reload complete unified history from SQLite
        const fullSessions = await loadAllSessions();
        const fullLegacy = fullSessions.map(sessionV2ToLegacy);
        setSessionsList(fullLegacy);
        setCachedRecentSessions(fullLegacy, fullLegacy.length);
        setIsFullHistoryLoaded(true);
        setUser(prev => ({ ...prev, totalWorkouts: fullLegacy.length }));
      } else {
        // Fallback for web / SQLite-unavailable environments
        const local = sessionsList || [];
        const merged = [...local];
        restoredSessions.forEach(rs => {
          if (!merged.some(ls => ls.id === rs.id)) merged.push(rs);
        });
        merged.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
        setSessionsList(merged);
        setCachedRecentSessions(merged, merged.length);
        setIsFullHistoryLoaded(true);
      }
    }
    ...
    return true;
  } catch (e) {
    console.warn('Error applying backup data', e);
    return false;
  }
};
```

#### 4. Hardening Google Login Sync (`handleGoogleLogin` at `App.tsx:969-1060`):
```typescript
if (accessToken && fileId) {
  try {
    const backupData = await googleDrive.downloadBackupFile(accessToken, fileId);
    if (backupData) {
      backupFoundAndMerged = true;
      const remoteSessions = backupData.sessionsList || [];
      
      if (historyRepositoryReadyRef.current) {
        const v2Remote = remoteSessions.map((s: any, idx: number) => legacySessionToV2(s, idx));
        // SAFE MERGE: insert remote into SQLite
        await insertMissingSessionsOnly(v2Remote);
        
        // Reload unified full history
        const fullSessions = await loadAllSessions();
        const fullLegacy = fullSessions.map(sessionV2ToLegacy);
        setSessionsList(fullLegacy);
        setCachedRecentSessions(fullLegacy, fullLegacy.length);
        setIsFullHistoryLoaded(true);
      }
      ...
    }
  } ...
}
```

---

### 4.3 Developer Diagnostic & History Recovery Panel (Milestone 3 / R3)

#### Data Points to Expose:
1. **Active SQLite Sessions**: `countSessions()` (where `deleted_at_ms IS NULL`)
2. **Total Raw Sessions**: `countAllRawSessions()` (all rows in `workout_sessions`)
3. **Tombstoned Sessions**: `countTombstonedSessions()` (`deleted_at_ms IS NOT NULL`)
4. **MMKV Recent Cache Count**: `getCachedRecentSessions()?.length ?? 0`
5. **MMKV Total Cached Count**: `getCachedTotalSessionsCount() ?? 0`
6. **Database Health Mode**: `getStorageHealthState().mode`

#### Recovery Action ("Repair Workout History"):
- Tapping button triggers:
  1. `const recoveredCount = await restoreAllTombstonedSessions();`
  2. `const fullSessions = await loadAllSessions();`
  3. `const fullLegacy = fullSessions.map(sessionV2ToLegacy);`
  4. `setSessionsList(fullLegacy);`
  5. `setCachedRecentSessions(fullLegacy, fullLegacy.length);`
  6. `setUser(prev => ({ ...prev, totalWorkouts: fullLegacy.length }));`
  7. `setIsFullHistoryLoaded(true);`
  8. Haptic feedback + Alert displaying:  
     `"Recovery Complete: Restored ${recoveredCount} tombstoned workouts. Total active workouts: ${fullLegacy.length}."`

---

## 5. Automated Regression Test Specifications (R4)

To ensure this defect can never regress, the following automated unit/integration tests must be implemented:

1. **`test('Auto-sync never triggers upload when isFullHistoryLoaded is false')`**:
   - Initialize state with `isDataLoaded = true`, `isFullHistoryLoaded = false`, `sessionsList` containing 20 preview items.
   - Advance timers by 2500ms.
   - Assert `googleDrive.updateBackupFile` and `googleDrive.createBackupFile` were **NOT** called.

2. **`test('Restoring a partial backup never deletes or tombstones existing local SQLite sessions')`**:
   - Seed SQLite database with 300 distinct mock sessions.
   - Simulate importing a backup file with only 50 sessions (some overlapping, some new).
   - Execute `applyBackupData` with the safe merge logic.
   - Query `loadAllSessions()` and `countSessions()`.
   - Assert all 300 original sessions remain active + any new sessions from backup were added (total >= 300).
   - Assert `countTombstonedSessions() === 0`.

3. **`test('restoreAllTombstonedSessions recovers all previously soft-deleted sessions')`**:
   - Seed SQLite database with 100 sessions where 40 have `deleted_at_ms = 1786687000000`.
   - Assert `countSessions() === 60` and `countTombstonedSessions() === 40`.
   - Call `restoreAllTombstonedSessions()`.
   - Assert return value is 40.
   - Assert `countSessions() === 100` and `countTombstonedSessions() === 0`.

---

## 6. Verification Method & Commands

- **Unit & Integration Tests**:  
  `$env:PATH = "F:\.fnm\node-versions\v22.22.3\installation;" + $env:PATH; npm test`
- **TypeScript Compilation Check**:  
  `$env:PATH = "F:\.fnm\node-versions\v22.22.3\installation;" + $env:PATH; npm run typecheck`
- **Standalone Release Build**:  
  `cmd /c build-apk.bat --auto`
