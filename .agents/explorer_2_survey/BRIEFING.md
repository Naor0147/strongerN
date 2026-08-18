# BRIEFING — 2026-08-18T19:46:35Z

## Mission
Investigate Cloud Sync (Google Drive), backup/export/restore, and reconcile logic to harden against data poisoning and design safe merge-only logic.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\Antigravity\strongerN\.agents\explorer_2_survey
- Original parent: b5551d07-52c4-4055-8613-600492c7c86c
- Milestone: Milestone 2 & Survey (Cloud Sync & Reconcile Hardening)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement code changes
- Provide precise file paths, line numbers, function signatures, and recommended architectural fixes
- Write comprehensive survey report to `survey_report.md` and `handoff.md`

## Current Parent
- Conversation ID: b5551d07-52c4-4055-8613-600492c7c86c
- Updated: 2026-08-18T19:46:35Z

## Investigation State
- **Explored paths**: `src/storage/history/repository.ts`, `src/storage/history/schema.ts`, `src/storage/history/legacySessionMapper.ts`, `src/storage/instantCache.ts`, `src/storage/persistenceBootstrap.ts`, `src/App.tsx`, `src/utils/googleDrive.ts`, `src/utils/backupManager.ts`, `src/screens/ProfileScreen.tsx`, `src/screens/LoginScreen.tsx`, `src/screens/DeveloperCrashLogsView.tsx`.
- **Key findings**:
  1. `reconcileSessions` (`repository.ts:100-118`) soft-deletes any local session not in the restored array via `UPDATE workout_sessions SET deleted_at_ms = now WHERE id NOT IN (...)`. Called in `applyBackupData` (`App.tsx:1340`) and `handleGoogleLogin` (`App.tsx:990`).
  2. Google Drive auto-sync (`App.tsx:836-908`) lacks `isFullHistoryLoaded` check. It uploads the 20-item instant cache preview if state updates occur prior to full SQLite load, poisoning remote cloud backups.
  3. No tombstone recovery function exists in `repository.ts` to un-delete soft-deleted sessions.
- **Unexplored areas**: None for survey scope.

## Key Decisions Made
- Designed safe merge-only logic replacing `reconcileSessions` with `insertMissingSessionsOnly` and complete SQLite re-hydration.
- Designed `restoreAllTombstonedSessions` and `countTombstonedSessions` for developer diagnostic and repair panel.
- Documented automated regression test specifications.

## Artifact Index
- `survey_report.md` — Comprehensive survey and analysis of Cloud Sync, Backup/Restore, Reconcile logic, and safe merge design.
- `handoff.md` — 5-component handoff report.
- `progress.md` — Progress tracker.
- `DISPATCH.md` — User / orchestrator dispatch record.
