# Original User Request

## Initial Request — 2026-08-18T19:42:18Z

Fix the silent workout history load failure in StrongerN, recover soft-deleted or truncated local workouts (restoring full 300+ workout history), harden cloud sync against data poisoning, and add a developer diagnostic/repair panel.

Working directory: c:\Antigravity\strongerN
Integrity mode: development

## Requirements

### R1. Root Cause Diagnosis & History Recovery
- Ensure full workout history (300+ sessions) is reliably loaded from local SQLite storage upon startup, surfacing un-gated error logs if initialization fails.
- Provide automatic or one-click recovery for soft-deleted/tombstoned sessions (`deleted_at_ms`) caused by previous sync or reconcile bugs.

### R2. Cloud Sync & Reconcile Hardening
- Prevent Google Drive auto-sync from uploading preview/partial workout state before full history is confirmed loaded (`isFullHistoryLoaded`).
- Replace destructive reconcile logic (`reconcileSessions`) in backup restore flows with safe merge-only logic (`insertMissingSessionsOnly`) so stale/partial backups cannot delete local workouts.

### R3. Diagnostic & Repair UI Panel
- Provide a developer diagnostic panel showing active vs raw session counts, MMKV cache count, and database health status, with a one-tap repair action to restore tombstoned workouts.
- Comply with AMOLED dark theme tokens and design system.

### R4. Automated Testing & Release Verification
- Add automated regression tests covering: (1) sync upload prevention before full load, (2) merge-only restore safety against stale backups, (3) soft-delete repair execution.
- Maintain app version increment in `app.json` and `src/utils/i18n.ts`, typecheck (`npm run typecheck`), test suite (`npm test`), and standalone release APK build (`build-apk.bat --auto`).

## Acceptance Criteria

### Data Safety & Recovery
- [ ] User's full workout history (300+ sessions) displays in the history list and stats after launch/repair.
- [ ] No local workouts are deleted or tombstoned when restoring a partial or empty backup.
- [ ] Auto-sync upload never triggers when only 20 preview sessions are loaded in memory.

### UI & Diagnostics
- [ ] Developer Options panel displays accurate SQLite row counts (active, deleted, total) and MMKV cached counts.
- [ ] Tapping "Repair workout history" cleanses tombstones and reloads active sessions without data corruption.

### Verification & Release
- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm test` passes all unit and regression tests.
- [ ] Standalone release APK builds cleanly via `build-apk.bat --auto`.
