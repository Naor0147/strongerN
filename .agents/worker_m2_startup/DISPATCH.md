## 2026-08-19T14:15:37Z

You are Worker 2 (teamwork_preview_worker) for Milestone 2: Startup Pipeline & Render De-Bottlenecking (R2).
Your working directory is: c:\Antigravity\strongerN\.agents\worker_m2_startup
Project root: c:\Antigravity\strongerN
Original request record: c:\Antigravity\strongerN\.agents\ORIGINAL_REQUEST.md

Read:
- `c:\Antigravity\strongerN\.agents\ORIGINAL_REQUEST.md`
- `c:\Antigravity\strongerN\.agents\explorer_r2_startup\report.md`
- `c:\Antigravity\strongerN\AGENTS.md` and `.agents/rules/`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You EXCLUSIVELY own:
- `src/App.tsx`
- `src/utils/crashLogger.ts`
- `src/utils/i18n.ts`
- `src/utils/notifications.ts`
- `src/utils/foregroundNotification.ts`
- Any related storage/store helper files.
(Do NOT modify `LoginScreen.tsx`, `BarChart.tsx`, or `StatCard.tsx` as Worker 3 is working on them).

Tasks for Milestone 2:
1. Screen Laziness & Code Splitting:
   - In `src/App.tsx`, convert `HistoryScreen`, `WorkoutScreen`, `ExercisesScreen`, `MuscleMapScreen`, `MeasureScreen`, `ActiveWorkoutModal`, `WatchCompanionSimulator` to `React.lazy` imports. Keep `ProfileScreen` and `LoginScreen` eager.
   - Add `TabFallback` with `#0D0F14` AMOLED background.
   - Wrap tab screens in `React.Suspense fallback={<TabFallback />}`.
   - Conditionally mount `MeasureModalSheet` and `ActiveWorkoutModal` only when active/visible.
2. Synchronous Render Pass Removal:
   - In `App.tsx` / `instantCache.ts`, streamline Frame 0 initial data so heavy `JSON.parse` operations across full session histories do not block the first render.
   - Use pre-computed summaries for `dynamicWeeklyChartData` and `weeklyMuscleSets` during Frame 0.
3. Startup Cascade Batching:
   - Batch the 41 separate `setState` calls in `loadData()` into a single atomic update/store action or consolidated state dispatch.
   - Memoize `historyScreenElement` with `React.useMemo` to prevent recreation on every render.
4. Startup Task Deferral:
   - In `src/utils/crashLogger.ts`: replace synchronous SQLite logging on `console.error`/warnings with an in-memory queue flushed asynchronously (via `InteractionManager.runAfterInteractions` or debounced timer). Keep synchronous write strictly for fatal uncaught exceptions (`isFatal === true`).
   - In `src/App.tsx` / `notifications.ts`: wrap `initNotifications()`, `initSounds()`, and non-critical startup tasks in `InteractionManager.runAfterInteractions()`.
5. Verification:
   - Run `npm run typecheck` to verify 0 errors.
   - Run `npm test` to verify all tests pass.

When complete, write your changes and verification report to `c:\Antigravity\strongerN\.agents\worker_m2_startup\handoff.md` and send a message.
