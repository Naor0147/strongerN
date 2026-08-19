## 2026-08-19T14:15:37Z
You are Worker 3 (teamwork_preview_worker) for Milestone 3: 120 FPS UI-Thread Entry & Chart Animations (R3).
Your working directory is: c:\Antigravity\strongerN\.agents\worker_m3_animations
Project root: c:\Antigravity\strongerN
Original request record: c:\Antigravity\strongerN\.agents\ORIGINAL_REQUEST.md

Read:
- `c:\Antigravity\strongerN\.agents\ORIGINAL_REQUEST.md`
- `c:\Antigravity\strongerN\.agents\explorer_r3_animations\report.md`
- `c:\Antigravity\strongerN\AGENTS.md` and `.agents/rules/`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You EXCLUSIVELY own:
- `src/screens/LoginScreen.tsx`
- `src/components/ui/BarChart.tsx`
- `src/components/ui/StatCard.tsx`
(Do NOT modify `App.tsx`, `crashLogger.ts`, or `i18n.ts` as Worker 2 is working on them).

Tasks for Milestone 3:
1. Login Entrance Animation (`src/screens/LoginScreen.tsx`):
   - Replace monolithic single-view slide with a 4-tier 50ms Reanimated UI-thread worklet stagger:
     1. Logo (0ms delay)
     2. Title & Tagline (50ms delay)
     3. Auth Card & Buttons (100ms delay)
     4. Footer / Terms / DataInfoCard (150ms delay)
   - Ensure `globalAnimation.speed === 0` (instant mode) and scaled durations work correctly.
   - Gate initial animation trigger to execute smoothly after layout/mount commit.
2. Profile BarChart Animation (`src/components/ui/BarChart.tsx`):
   - Migrate from legacy `Animated` with `useNativeDriver: false` to Reanimated UI-thread worklets (`useSharedValue`, `useAnimatedStyle`, `withDelay`, `withTiming`).
   - Run opacity and bar scale transforms strictly on the UI thread.
3. StatCard Optimization (`src/components/ui/StatCard.tsx`):
   - Eliminate the JS-thread `requestAnimationFrame` + `setDisplayVal` re-render loop that causes 300-600 React re-renders per second on Profile screen mount.
   - Use Reanimated UI-thread entrance worklet and direct formatted values without JS-thread re-render spam.
4. Verification:
   - Run `npm run typecheck` to verify 0 errors.
   - Run `npm test` to verify all tests pass.

When complete, write your changes and verification report to `c:\Antigravity\strongerN\.agents\worker_m3_animations\handoff.md` and send a message.
