## 2026-08-18T20:05:00Z
You are Worker 3 for Milestone 3 of the StrongerN workout history recovery project.
Read ORIGINAL_REQUEST.md at: c:\Antigravity\strongerN\.agents\ORIGINAL_REQUEST.md
Read PROJECT.md at: c:\Antigravity\strongerN\PROJECT.md
Read survey findings at: c:\Antigravity\strongerN\.agents\explorer_3_survey\survey_report.md

Your working directory is: c:\Antigravity\strongerN\.agents\worker_m3\

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Exclusively Owned Files:
1. `src/components/DeveloperDiagnosticsView.tsx` (create new component)
2. `src/screens/ProfileScreen.tsx` (wire diagnostics view under Developer Options)
3. `src/utils/i18n.ts` (add diagnostic panel & repair translations for EN and HE)
4. `src/App.tsx` (pass `handleRefreshSessions` / reload callback if needed to ProfileScreen)

Task Instructions:
1. In `src/utils/i18n.ts`:
   - Add translation keys under `developer.diagnostics` in both English and Hebrew:
     - title: 'Database & Sync Diagnostics' / 'אבחון מסד נתונים וסנכרון'
     - sqliteStatus: 'SQLite Status' / 'סטטוס SQLite'
     - activeWorkouts: 'Active Workouts' / 'אימונים פעילים'
     - tombstonedWorkouts: 'Tombstoned Workouts' / 'אימונים מסומנים למחיקה'
     - rawTotalRows: 'Total SQLite Rows' / 'סה"כ שורות ב-SQLite'
     - mmkvCacheCount: 'MMKV Instant Cache' / 'מטמון מהיר MMKV'
     - isFullHistoryLoaded: 'Full History Hydrated' / 'היסטוריה מלאה נטענה'
     - repairButton: 'Repair Workout History' / 'שחזר היסטוריית אימונים'
     - repairing: 'Repairing...' / 'משחזר...'
     - repairSuccess: 'Repaired {count} workouts successfully' / 'שוחזרו {count} אימונים בהצלחה'
     - refresh: 'Refresh' / 'רענן'
     - noTombstones: 'All workouts are active. No repair needed.' / 'כל האימונים פעילים. אין צורך בשחזור.'
2. In `src/components/DeveloperDiagnosticsView.tsx`:
   - Build a diagnostic panel component displaying:
     - Real-time SQLite statistics from `getDatabaseDiagnostics()`.
     - Active vs Tombstoned vs Raw Total counts with visual color indicators.
     - MMKV cache count and status.
     - One-tap "Repair Workout History" button that:
       - Calls `restoreAllTombstonedSessions()`
       - Triggers history reload callback
       - Shows feedback alert with the count of recovered workouts
     - AMOLED-compliant styling using `src/theme.ts` (`colors.bg = #0D0F14`, `colors.surface = #161B24`, `colors.accent = #4F8EF7`, `colors.success = #22C55E`, `colors.error = #EF4444`, `ripple.surface`, typography, haptics).
3. In `src/screens/ProfileScreen.tsx`:
   - Wire `<DeveloperDiagnosticsView>` when `settingsView === 'diagnostics'`.
   - Add a menu entry "Database & Diagnostics" in the Developer Options section of ProfileScreen.
4. In `src/App.tsx`:
   - Pass a session reload callback to `ProfileScreen` if needed, so repair immediately re-populates `sessionsList` and updates MMKV cache.
5. Verification:
   - Run `npm run typecheck` (0 errors).
   - Run `npm test` (all tests pass).

Write your changes report to c:\Antigravity\strongerN\.agents\worker_m3\changes.md and create handoff.md. Send a message to parent when done with test results.
