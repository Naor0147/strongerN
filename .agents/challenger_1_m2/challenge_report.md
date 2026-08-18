# Empirical Challenger Report — Milestone 2: Cloud Sync & Reconcile Hardening

**Challenger:** Challenger 1 (critic, specialist)  
**Target Milestone:** Milestone 2 (Workout History Recovery & Cloud Sync Hardening)  
**Date:** 2026-08-18  
**Verdict:** **APPROVE**

---

## 1. Executive Summary

As Empirical Challenger 1 for Milestone 2, I performed adversarial challenge testing, runtime SQL verification with native in-memory SQLite (`node:sqlite` `DatabaseSync`), and unit/integration stress tests on the code changes delivered for Milestone 2 in StrongerN.

The challenge focused on two core safety mandates:
1. **Auto-Sync Upload Gating Safety**: Proving that Google Drive auto-sync NEVER triggers when only 20 preview sessions are loaded in memory (`isFullHistoryLoaded = false`), preventing cloud data corruption or history truncation.
2. **Safe Restore & Merge Preservation**: Proving that restoring a partial backup (e.g., 5 sessions) into an existing SQLite database with 300 active sessions NEVER deletes or tombstones the other 295 sessions.

Both mandates passed all adversarial tests with zero failures.

---

## 2. Empirical Verification & Challenge Results

### Challenge Dimension 1: Auto-Sync Upload Prevention (`isFullHistoryLoaded = false`)
- **Hypothesis Challenged**: A cold start with 20 MMKV preview sessions (`isDataLoaded = true`, `isFullHistoryLoaded = false`) followed by user state changes or timer ticks might fire the Google Drive upload effect and overwrite the cloud backup with truncated data.
- **Empirical Test Setup**:
  - Simulated `App.tsx` auto-sync lifecycle (`src/__tests__/m2CloudSyncAndRestoreChallenge.test.ts` & `scripts/challenge-m2-empirical.js`).
  - Initial state: `isDataLoaded = true`, `isFullHistoryLoaded = false`, `sessionsList` = 20 preview sessions, `user.totalWorkouts` = 300.
  - Advancing timers by 5,000ms and 10,000ms while modifying `user` profile and settings.
- **Observed Behavior**:
  - `googleDrive.updateBackupFile` calls: **0**
  - `googleDrive.createBackupFile` calls: **0**
  - Auto-sync remained strictly gated by `if (!isDataLoaded || !isFullHistoryLoaded) return;` at `src/App.tsx:840`.
- **Verdict**: **PASS**

### Challenge Dimension 2: Partial Backup Restore into 300 Sessions
- **Hypothesis Challenged**: Restoring a partial backup containing only 5 sessions (2 overlapping + 3 new) into an existing SQLite database with 300 sessions might execute soft-delete/tombstone updates on the remaining 295 sessions.
- **Empirical Test Setup**:
  - Seeded genuine relational SQLite database (`workout_sessions`, `session_exercises`, `set_logs`) with 300 active sessions (>1,200 exercises, >4,500 sets) using Node.js 24 `DatabaseSync`.
  - Executed `insertMissingSessionsOnly` with 5 backup sessions.
  - Direct SQL inspection of `workout_sessions` table before and after.
- **Observed Behavior**:
  - Pre-restore: Active = 300, Tombstoned = 0, Total = 300.
  - Post-restore: Active = **303** (300 original + 3 new), Tombstoned = **0**, Total = **303**.
  - All 298 non-backup original sessions (`db-session-2` through `db-session-299`) remained 100% active (`deleted_at_ms IS NULL`) with all related exercises and sets completely intact.
- **Verdict**: **PASS**

### Challenge Dimension 3: Empty Backup Restore Safety (`[]`)
- **Hypothesis Challenged**: Restoring an empty backup file (`{ sessionsList: [] }`) might wipe or tombstone local sessions.
- **Empirical Test Setup**:
  - Database seeded with 300 active sessions.
  - Executed `insertMissingSessionsOnly([])`.
- **Observed Behavior**:
  - Active sessions count remained **300**.
  - Tombstoned sessions count remained **0**.
- **Verdict**: **PASS**

### Challenge Dimension 4: Tombstone Resurrection via Merge-Only Restore
- **Hypothesis Challenged**: Restoring a backup containing sessions that were previously soft-deleted locally should resurrect those specific sessions without affecting other tombstoned or active sessions.
- **Empirical Test Setup**:
  - Database seeded with 250 active sessions + 50 tombstoned sessions (total 300 rows).
  - Restored 5 sessions (3 matching tombstoned IDs + 2 brand new sessions).
- **Observed Behavior**:
  - Active count increased from 250 to **255** (250 original + 3 resurrected + 2 new).
  - Tombstoned count decreased from 50 to **47** (50 - 3).
  - The 3 resurrected sessions had `deleted_at_ms` reset to `NULL` and `revision` incremented to 2.
  - Untouched tombstoned sessions (e.g. `db-session-10`) remained tombstoned.
- **Verdict**: **PASS**

### Challenge Dimension 5: Manual Cloud Sync & Backup Export Hydration Protection
- **Hypothesis Challenged**: If a user taps "Sync Now" or "Export Backup" while `isFullHistoryLoaded` is false, it might upload or export only 20 preview sessions.
- **Empirical Test Setup**:
  - Simulated `handleCloudSync` and `handleExportBackup` when `isFullHistoryLoaded = false`.
- **Observed Behavior**:
  - Both handlers check `if (!isFullHistoryLoaded)` and call `await loadAllSessions()`, lazily hydrating all 300+ sessions from SQLite before building the payload.
  - If `loadAllSessions()` fails (e.g. database locked), `handleCloudSync` safely returns `false` and aborts upload, never leaking truncated state.
- **Verdict**: **PASS**

---

## 3. Test & Verification Execution Summary

| Test Harness | Scope | Result |
| :--- | :--- | :--- |
| `scripts/challenge-m2-empirical.js` | Standalone native SQLite (`DatabaseSync`) stress & safety harness | **32 / 32 Passed** (0 failures) |
| `src/__tests__/m2CloudSyncAndRestoreChallenge.test.ts` | Jest unit & integration challenge test suite for M2 | **8 / 8 Passed** (0 failures) |
| `src/__tests__/challengerM2CloudSyncAndRestore.test.ts` | Concurrency, cache integrity, and sync guard suite | **11 / 11 Passed** (0 failures) |
| Full Jest Test Suite (`jest --maxWorkers=2`) | All 22 test suites across the repository | **22 / 22 Passed (192 tests, 6 snapshots)** |
| TypeScript Compiler (`tsc --noEmit`) | Strict static type checking | **0 Errors (100% clean)** |

---

## 4. Final Verdict

**Verdict: APPROVE**

Milestone 2 implementation satisfies all cloud sync and restore safety requirements with full empirical proof:
1. Google Drive auto-sync is completely impervious to partial state leakage before full history load.
2. Backup restore operations are strictly non-destructive (safe merge-only), preserving full local 300+ workout history while correctly untombstoning imported sessions.
