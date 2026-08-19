## 2026-08-19T18:09:03Z
You are Worker M2 focusing on Milestone 2 (R7: Premium Animation Polish at 120 FPS).
Working directory: c:\Antigravity\strongerN\.agents\worker_m2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Read:
- c:\Antigravity\strongerN\.agents\ORIGINAL_REQUEST.md
- c:\Antigravity\strongerN\.agents\orchestrator_3\PROJECT.md
- c:\Antigravity\strongerN\.agents\explorer_m2\handoff.md
- c:\Antigravity\strongerN\src\components\layout\ActiveWorkoutModal.tsx
- c:\Antigravity\strongerN\src\theme.ts

Your File Ownership (Exclusive):
- `src/components/layout/ActiveWorkoutModal.tsx`
- `src/__tests__/r7_animationPolish.test.ts`

Tasks:
1. In `src/components/layout/ActiveWorkoutModal.tsx`:
   - Eliminate legacy `RN.Animated` (`slideAnim`, `sheetTranslateY`, `<RN.Animated.View>`) and JS-thread `PanResponder` touch listeners.
   - Migrate modal presentation and dismissal to Reanimated 3 UI-thread worklets (`useSharedValue`, `useAnimatedStyle`, `withTiming`, `runOnJS`, `globalAnimation`, `getScaledDuration`).
   - Migrate bottom sheet sub-menus (exercise menu, timer pickers, workout menu) to Reanimated UI-thread animated styles and worklets with `animationType="none"` and transparent backdrops.
   - Ensure zero JS-thread jank, 120 FPS smoothness, instant mode support (`globalAnimation.speed === 0`), and clean unmounts.
   - Clean up any raw hex colors in plate calculations / superset palettes to use tokens or proper constants.
2. Create `src/__tests__/r7_animationPolish.test.ts` with comprehensive static guardrails, lifecycle, instant animation, and high-frequency stability tests based on Explorer M2's blueprint.
3. Run tests and typecheck using:
   `fnm env --shell powershell | Out-String | Invoke-Expression; npm test -- --testPathPattern=r7_animationPolish`
   `fnm env --shell powershell | Out-String | Invoke-Expression; npm run typecheck`
4. Document all changes and verification results in `c:\Antigravity\strongerN\.agents\worker_m2\handoff.md` and `progress.md`.
5. Send a message to parent when completed.
