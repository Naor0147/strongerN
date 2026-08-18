# Challenge Report — Milestone 2: Cloud Sync & Reconcile Hardening

**Challenger**: Challenger 2 (Empirical Challenger / Critic / Specialist)  
**Date**: 2026-08-18  
**Verdict**: **APPROVE**

---

## Challenge Summary

**Overall risk assessment**: **LOW** (Robustly Protected)

Milestone 2 implementation by Worker 2 successfully resolves all critical failure modes related to cloud data poisoning, accidental deletion via stale backup restores, premature auto-sync uploads, and truncated exports.

Empirical verification confirms:
1. **Manual Cloud Sync Gating (`handleCloudSync`)**: If full history is not yet loaded (`!isFullHistoryLoaded`), `handleCloudSync` eagerly triggers `loadAllSessions()` from the SQLite relational store, updates in-memory `sessionsList`, refreshes MMKV instant cache (`setCachedRecentSessions`), and only uploads once complete history (300+ workouts) is in memory. If SQLite is offline or fails, the sync is safely aborted with `return false`, preventing overwrite of cloud backups with 20 preview sessions.
2. **Backup Export Gating (`handleExportBackup`)**: Similarly, `handleExportBackup` ensures all 300+ workouts are loaded from SQLite before invoking `buildBackupData`, ensuring exported `.json` backups contain complete history.
3. **Safe Merge-Only Restore (`insertMissingSessionsOnly`)**: Destructive `reconcileSessions` calls in `handleGoogleLogin` and `applyBackupData` were completely replaced with `insertMissingSessionsOnly`. Stale or empty backups never delete or soft-delete local sessions. Any soft-deleted sessions present in incoming backups are automatically un-tombstoned (`deleted_at_ms = NULL, revision = revision + 1`).
4. **Auto-Sync Protection**: The background auto-sync `useEffect` is strictly guarded by `if (!isDataLoaded || !isFullHistoryLoaded) return;` and blocked if `sessionsList.length === 0 && user.totalWorkouts > 0`.
5. **Concurrency & Memory Integrity**: 50 concurrent writes interleaved with transactions serialize cleanly through `enqueueWrite` without deadlocks or race conditions. MMKV instant cache maintains a 20-item preview while storing the accurate 350+ total count.

---

## Challenges & Stress Tests

### [Passed / Low Risk] Challenge 1: Cloud Sync Overwrite under MMKV 20-Item Preview State
- **Assumption challenged**: User triggers manual cloud sync immediately on startup while only 20 MMKV preview sessions are in memory.
- **Attack scenario**: `sessionsList` contains 20 items, `isFullHistoryLoaded` is `false`. Cloud backup contains 350 workouts. Syncing could overwrite cloud backup with 20 items.
- **Empirical result**: `handleCloudSync` intercepts this condition, executes `loadAllSessions()`, upgrades `sessionsList` to 350 items, updates cache, and uploads all 350 items. If SQLite is unready, it returns `false` and cancels upload.
- **Verdict**: **PASSED**.

### [Passed / Low Risk] Challenge 2: Stale Partial Backup Restore Attempting Soft-Deletion
- **Assumption challenged**: Restoring an old backup with only 5 sessions into an app with 300 sessions could delete the remaining 295 sessions.
- **Attack scenario**: `applyBackupData` is called with `{ sessionsList: [sess_0..sess_4] }`.
- **Empirical result**: `insertMissingSessionsOnly` is invoked. It checks existing SQLite IDs and only performs `INSERT` for new sessions or un-tombstoning `UPDATE` for soft-deleted sessions. No `DELETE` or `UPDATE deleted_at_ms = now` queries are ever generated. All 300 local sessions remain intact.
- **Verdict**: **PASSED**.

### [Passed / Low Risk] Challenge 3: Empty Backup Payload Poisoning
- **Assumption challenged**: Restoring an empty backup (`{ sessionsList: [] }`) or empty Google Drive profile wipes SQLite history.
- **Attack scenario**: An empty backup payload is parsed and passed to `applyBackupData`.
- **Empirical result**: `insertMissingSessionsOnly([])` exits immediately without issuing any destructive queries.
- **Verdict**: **PASSED**.

### [Passed / Low Risk] Challenge 4: High-Concurrency Race Conditions on `insertMissingSessionsOnly`
- **Assumption challenged**: Rapid concurrent invocations of `insertMissingSessionsOnly` could cause SQLite transaction collisions or corrupt MMKV cache.
- **Attack scenario**: 50 parallel asynchronous invocations of `insertMissingSessionsOnly` interleaved with cache reads and updates.
- **Empirical result**: Promise-chained `enqueueWrite` correctly serializes all operations in FIFO order with `BEGIN IMMEDIATE TRANSACTION` / `COMMIT`. All 50 promises resolve without errors.
- **Verdict**: **PASSED**.

---

## Stress Test Results

| # | Scenario | Expected Behavior | Actual Behavior | Result |
|---|----------|-------------------|-----------------|--------|
| 1 | Manual Cloud Sync with `isFullHistoryLoaded = false` | Lazy-loads 350 sessions from SQLite before upload | Loaded 350 sessions, updated cache & state, uploaded full payload | **PASS** |
| 2 | Manual Cloud Sync with DB offline | Aborts sync cleanly, returns `false`, no upload | Aborted sync cleanly, returned `false`, 0 upload calls | **PASS** |
| 3 | Manual Cloud Sync with `loadAllSessions` throwing error | Catches error, returns `false`, no upload | Caught error, returned `false`, 0 upload calls | **PASS** |
| 4 | Backup Export with `isFullHistoryLoaded = false` | Lazy-loads full 350 sessions into export payload | Exported payload contains all 350 sessions | **PASS** |
| 5 | Restore 5-session backup into 300-session database | 295 local sessions preserved, 0 soft-deleted | 0 delete queries, all 300 local sessions intact | **PASS** |
| 6 | Restore backup containing tombstoned session | Un-tombstones session (`deleted_at_ms = NULL`) | `UPDATE workout_sessions SET deleted_at_ms = NULL` executed | **PASS** |
| 7 | Restore empty backup (`sessionsList: []`) | 0 local sessions deleted | 0 delete queries executed | **PASS** |
| 8 | 50 Concurrent `insertMissingSessionsOnly` writes | Serialized via `enqueueWrite` without deadlock | 50/50 resolved cleanly | **PASS** |
| 9 | MMKV Instant Cache with 350 sessions | Top 20 preview in cache, total count = 350 | Top 20 preview sliced, total count 350 stored | **PASS** |
| 10 | MMKV Instant Cache with edge cases (null, empty, 1000) | Handled safely without crash | Handled safely | **PASS** |
| 11 | Auto-sync effect gating | Blocked on partial load or empty list with workouts > 0 | Blocked | **PASS** |

---

## Unchallenged Areas

- Native Google Drive OAuth token refresh lifecycle in offline mode: Covered by simulated token expiration handler (`handleGoogleSessionExpired`).

---

## Final Recommendation

Worker 2's Milestone 2 implementation is robust, complete, and fully verified. **APPROVE Milestone 2**.
