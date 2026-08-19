# Original User Request

## 2026-08-19T13:56:22Z

# StrongerN — 120 FPS Entry + Lightweight APK Optimization

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full multi-agent team (Profiler, Bundle Optimization, Startup Core, Animation Architect, QA/Validation)

Optimize StrongerN (React Native / Expo Android app) to achieve 120 FPS entry-to-interactive performance and reduce the standalone release APK (arm64) size from 32.1 MB down to ≤ 20 MB (stretch target: 17 MB), with zero visual or functional regressions.

Working directory: c:\Antigravity\strongerN
Integrity mode: development

## Requirements

### R1. Lossless Bundle & Asset Optimization (APK ≤ 20 MB)
- Eliminate font bloat by replacing wildcard/index font package imports (`@expo-google-fonts/inter`, `@expo/vector-icons`) with direct per-variant module imports, targeting exactly 9 TTFs in the final APK.
- Enable R8 full mode minification and resource shrinking (`enableMinifyInReleaseBuilds=true`, `enableShrinkResourcesInReleaseBuilds=true`) in `android/app/build.gradle` / `gradle.properties` with bulletproof `proguard-rules.pro` keeps for React Native autolinking, MMKV, NotifyKit, and Expo SecureStore.
- Enable Hermes bundle compression (`enableBundleCompression=true`) in `android/app/build.gradle`.
- Losslessly compress `StorngNLogo.png` and remove dead unused assets (`assets/logos/` [17 files], `assets/logos_v2/`, `assets/photos/Bodyfront.png|BodyBack.png`, `assets/sounds/*.mp3`).

### R2. Startup Pipeline & Render De-Bottlenecking
- Implement code-splitting using `React.lazy` and `Suspense` for all non-initial tab screens, keeping only `Profile` eager.
- Remove synchronous MMKV / storage reads and `JSON.parse` operations from the render pass (`App.tsx`), hydrating asynchronously so frame 0 renders immediately.
- Batch the `loadData()` startup cascade (~30 `setState` calls) into a single store update/transaction. Memoize `historyScreenElement`.
- Defer non-critical startup work (async queue for `crashLogger` SQLite logging, deferred foreground notification registration, on-demand language dictionaries).

### R3. 120 FPS UI-Thread Entry & Chart Animations
- Stagger the login entrance animation (`LoginScreen.tsx`) into per-element entrances (logo → title → inputs → button) with 40–60 ms stagger on the Reanimated UI thread, maintaining existing speed/instant toggles.
- Migrate Profile chart animations (`BarChart.tsx`, `StatCard`) from JS-thread `Animated` (`useNativeDriver: false`) to Reanimated UI-thread worklets (`withTiming`/`withDelay`).
- Gate login and heavy entrance animations until after the first frame commit / hydration completes to prevent animation frame drops during startup.

### R4. Automated Benchmarking, Guardrails & Production Release Protocol
- Capture baseline cold-start timings, Perfetto trace slices, and APK size census before applying changes.
- Ensure all tests pass (`npm test`, `npm run typecheck`, `npm run lint`).
- After completing tasks, auto-increment app version in `app.json` and `src/utils/i18n.ts`, run `cmd /c build-apk.bat --auto`, run `graphify update .`, and commit/push to `master`.

## Acceptance Criteria

### Performance & Frame Rate
- [ ] Median cold-start time (`adb shell am start -W com.naor.strongern`) improves by ≥ 30% from baseline.
- [ ] No JS-thread long tasks > 8.3 ms during the login entrance animation and Profile screen entry (120 FPS budget).
- [ ] Zero UI freezes or frame drops during startup hydration and chart rendering.

### APK Size & Bundle Census
- [ ] Final standalone release APK (arm64) size is ≤ 20.0 MB.
- [ ] APK uncompressed font census contains exactly 9 TTF files (Inter & Rubik 400/500/600/700 + Ionicons).
- [ ] Unused static image files and unreferenced mp3 assets removed from the bundle.

### Quality & Functional Parity
- [ ] Release APK compiles cleanly with R8 enabled and installs via `build-apk.bat --auto`.
- [ ] MMKV, NotifyKit, Expo SecureStore, and all native bridges function without runtime reflection errors.
- [ ] Full functional parity: Login flow, Workout execution & rest timer, History, Measurement sheet, Sounds/Haptics, Language switching (EN ↔ HE), and Deep linking (`strongern://`).
- [ ] `npm test` and `npm run typecheck` pass with zero errors.
- [ ] Regression guard test added for APK font census.

## 2026-08-19T21:04:48Z

Complete remaining production launch milestones for StrongerN (R5 Exercise History Breakdown & Virtualization, R7 Reanimated 120 FPS Polish, and R10 Hardcode & i18n Cleanup + Version Bump + Release APK Build).

Working directory: c:\Antigravity\strongerN
Integrity mode: development

## Requirements

### R1. Exercise History Breakdown & Virtualization (R5)
- Finish integrating `src/utils/exerciseHistory.ts` into `src/screens/ExerciseInsightsModal.tsx`.
- Replace the legacy session map in the History tab with a performant virtualized `FlatList` displaying session cards, PR badges, and collapsible set details.
- Add unit test in `src/__tests__/r5_exerciseHistory.test.ts`.

### R2. Premium Animation Polish at 120 FPS (R7)
- In `src/components/layout/ActiveWorkoutModal.tsx`, migrate remaining slide/fade modal animations to Reanimated UI-thread worklets (`useSharedValue`, `useAnimatedStyle`, `withTiming`).
- Ensure no JS-thread jank during modal presentation, dismiss, or active set toggles.
- Add unit test in `src/__tests__/r7_animationPolish.test.ts`.

### R3. Hardcode Cleanup, i18n, Version Bump & APK Build (R10)
- Audit hardcoded strings and colors to ensure token and i18n (EN+HE) compliance.
- Increment app version in `app.json` and in translation keys `profile.version` in `src/utils/i18n.ts` (both English and Hebrew).
- Run `npm test` and `npm run typecheck` to verify zero errors.
- Build release standalone APK via `cmd /c build-apk.bat --auto`.
- Commit and push all milestones to `master` and update the knowledge graph with `graphify update .`.

## Acceptance Criteria
- [ ] `npm test` passes 100% across all suites.
- [ ] `npm run typecheck` passes with 0 errors.
- [ ] Standalone release APK builds and installs cleanly via `build-apk.bat --auto`.
- [ ] Version incremented and reported at the end.
- [ ] Changes pushed to `master` and graph updated via `graphify update .`.

