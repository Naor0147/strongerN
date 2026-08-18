# Plan: StrongerN Workout History Recovery & Sync Hardening

## Overview
Recover the silent workout history load failure, fix tombstoned workouts, harden cloud sync and backup restore, provide a developer diagnostic & repair UI panel, add automated regression tests, update versions, and build the release APK.

## Milestones & Execution Strategy

### Phase 0: Survey & Technical Mapping
- Spawn 3 parallel Explorers to map the codebase:
  1. `explorer_1_survey`: History loading architecture, store initialization, SQLite queries vs MMKV preview cache, `isFullHistoryLoaded` flags, and soft-delete/tombstone mechanics (`deleted_at_ms`).
  2. `explorer_2_survey`: Cloud sync (Google Drive), backup/export/restore flow, `reconcileSessions` vs `insertMissingSessionsOnly`, and auto-sync trigger gating.
  3. `explorer_3_survey`: Developer panel / UI settings, health check query implementation, translation keys (`i18n.ts`), design token alignment, and test suite structure (`npm test`, `npm run typecheck`).
- Merge findings and create `PROJECT.md`.

### Phase 1: Milestone 1 — History Loading Engine & Tombstone Recovery
- Ensure full history (300+ sessions) is loaded unconditionally from SQLite on startup.
- Un-gate error logs if SQLite or store initialization encounters an error.
- Implement automatic startup self-healing or explicit recovery mechanism to untombstone sessions (`deleted_at_ms = null`) where appropriate.
- Worker implementation -> Reviewer verification -> Challenger verification -> Auditor verification -> Gate.

### Phase 2: Milestone 2 — Cloud Sync & Reconcile Hardening
- Prevent Google Drive auto-sync from uploading preview/partial workout state before `isFullHistoryLoaded` is true.
- Replace destructive reconcile logic (`reconcileSessions`) in backup restore flows with safe merge-only logic (`insertMissingSessionsOnly`) so stale/partial backups cannot delete local workouts.
- Worker implementation -> Reviewer verification -> Challenger verification -> Auditor verification -> Gate.

### Phase 3: Milestone 3 — Diagnostic & Repair UI Panel
- Provide developer diagnostic panel displaying SQLite row counts (active, deleted/tombstoned, total) and MMKV cached count.
- Add one-tap repair button ("Repair workout history" / Hebrew equivalent) that untombstones sessions and reloads workout history state.
- Ensure strict compliance with AMOLED dark theme (`colors.bg = #0D0F14`, typography, spacing, ripples).
- Worker implementation -> Reviewer verification -> Challenger verification -> Auditor verification -> Gate.

### Phase 4: Milestone 4 — Automated Regression Tests, Verification & Release APK
- Add automated regression tests:
  1. Sync upload prevention before full load.
  2. Merge-only restore safety against stale backups.
  3. Soft-delete repair execution.
- Increment app version in `app.json` and `src/utils/i18n.ts` (en and he).
- Run `graphify update .`.
- Verify `npm run typecheck` passes with zero errors.
- Verify `npm test` passes with zero errors.
- Run `build-apk.bat --auto` for standalone release APK build.
- Commit and push to master branch.
- Final Gate & Victory Claim.
