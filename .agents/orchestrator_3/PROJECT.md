# Project: StrongerN Final Production Launch (R5, R7, R10)

## Architecture
- React Native / Expo with Reanimated UI-thread animations, TypeScript, Jest, AMOLED-first theme design system (`ui-ux-design-pro-max`).
- Module Boundaries:
  - `src/utils/exerciseHistory.ts` & `src/screens/ExerciseInsightsModal.tsx`
  - `src/components/layout/ActiveWorkoutModal.tsx`
  - `src/utils/i18n.ts` & `app.json`
  - `src/__tests__/r5_exerciseHistory.test.ts` & `src/__tests__/r7_animationPolish.test.ts`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Exercise History Breakdown | Virtualized FlatList with session cards, PR badges, collapsible sets in ExerciseInsightsModal | M1 (R5) | ORIGINAL_REQUEST.md |
| 2 | Exercise History Unit Tests | Comprehensive Jest tests in `r5_exerciseHistory.test.ts` | M1 (R5) | ORIGINAL_REQUEST.md |
| 3 | 120 FPS Reanimated Modal | Migrate remaining slide/fade modal animations in `ActiveWorkoutModal.tsx` to Reanimated worklets (`useSharedValue`, `useAnimatedStyle`, `withTiming`) | M2 (R7) | ORIGINAL_REQUEST.md |
| 4 | Animation Unit Tests | Comprehensive Jest tests in `r7_animationPolish.test.ts` | M2 (R7) | ORIGINAL_REQUEST.md |
| 5 | Hardcode & i18n Audit | Audit colors/tokens and strings across modified files (EN & HE) | M3 (R10) | ORIGINAL_REQUEST.md |
| 6 | Version Bump & Release Build | Bump version in `app.json` & `i18n.ts`, run `npm test`, `npm run typecheck`, run `build-apk.bat --auto`, `graphify update .`, commit & push to master | M3 (R10) | ORIGINAL_REQUEST.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Codebase Survey | Survey ExerciseInsightsModal, ActiveWorkoutModal, tests, i18n | none | DONE |
| M1 | R5 History Breakdown | ExerciseInsightsModal.tsx & r5_exerciseHistory.test.ts | M0 | DONE |
| M2 | R7 Reanimated Modal | ActiveWorkoutModal.tsx & r7_animationPolish.test.ts | M0 | DONE |
| M3 | R10 i18n & Release APK | Hardcode cleanup, version bump, npm test, typecheck, build-apk.bat, graphify, git commit/push | M1, M2 | IN_PROGRESS |

## Code Layout
- `src/screens/ExerciseInsightsModal.tsx` (M1 - Verified)
- `src/utils/exerciseHistory.ts` (M1 - Verified)
- `src/__tests__/r5_exerciseHistory.test.ts` (M1 - Verified)
- `src/components/layout/ActiveWorkoutModal.tsx` (M2 - Verified)
- `src/__tests__/r7_animationPolish.test.ts` (M2 - Verified)
- `app.json` & `src/utils/i18n.ts` (Owned by M3 Worker)
