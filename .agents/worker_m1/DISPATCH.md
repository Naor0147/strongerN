## 2026-08-18T19:47:01Z
You are Worker 1 for Milestone 1 of the StrongerN workout history recovery project.
Read ORIGINAL_REQUEST.md at: c:\Antigravity\strongerN\.agents\ORIGINAL_REQUEST.md
Read PROJECT.md at: c:\Antigravity\strongerN\PROJECT.md
Read survey findings at: c:\Antigravity\strongerN\.agents\explorer_1_survey\survey_report.md

Your working directory is: c:\Antigravity\strongerN\.agents\worker_m1\

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Exclusively Owned Files:
1. `src/storage/history/repository.ts`
2. `src/storage/persistenceBootstrap.ts`
3. `src/App.tsx` (persistence error logging in `loadData()`)

Task Instructions:
1. In `src/storage/history/repository.ts`:
   - Implement and export `countTombstonedSessions(): Promise<number>` (counts rows WHERE deleted_at_ms IS NOT NULL).
   - Implement and export `restoreAllTombstonedSessions(): Promise<number>` (or `recoverTombstonedSessions(): Promise<number>`) running transactional `UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1 WHERE deleted_at_ms IS NOT NULL;` returning number of rows affected.
   - Implement and export `getDatabaseDiagnostics(): Promise<DatabaseDiagnostics>` returning `{ isReady, activeSessionsCount, tombstonedSessionsCount, rawTotalSessionsCount, cachedRecentCount, cachedTotalCount }`.
   - Update `insertMissingSessionsOnly(sessions: WorkoutSessionV2[])`: When inserting missing sessions, if a session with that ID already exists but is tombstoned (`deleted_at_ms IS NOT NULL`), restore it (`deleted_at_ms = NULL`).
2. In `src/storage/persistenceBootstrap.ts`:
   - In `bootstrapPersistence()`: After SQLite database check / migration, check if tombstoned sessions exist (`countTombstonedSessions() > 0`). If tombstoned sessions are detected, execute `restoreAllTombstonedSessions()` to self-heal and re-load sessions so that on startup, the full 300+ session history is instantly recovered.
3. In `src/App.tsx`:
   - In `loadData()`: Ensure errors during `bootstrapPersistence()` or `loadAllSessions()` are logged via `console.error` and `saveCrashLogSync('Persistence Load Failure: ' + (e?.message || e), e?.stack || '', false)`, removing the silencing `if (__DEV__) console.warn`.
4. Verification:
   - Run `npm test` to ensure all unit tests pass.
   - Run `npm run typecheck` to ensure 0 TypeScript errors.

Write your changes report to c:\Antigravity\strongerN\.agents\worker_m1\changes.md and create handoff.md. Send a message to parent when done with test results.
