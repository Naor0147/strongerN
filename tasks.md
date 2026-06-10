# StrongerN — Tasks Tracker

## 2. Navigation & State Management
- [x] **Initial Route** — Already implemented (initialRouteName="Profile").

- [ ] Implemented - Need check: **Workout State Persistence** — Switched from web-only localStorage to cross-platform db.ts, added AppState listener for background save, added async restore on app load.

## 3. UI & UX Refinements

- [ ] Implemented - Need check: **Workout Panel Target** — Made entire Quick Start card clickable with ripple feedback, removed separate button as tap target.
- [ ] Implemented - Need check: **Exercise Reordering Consistency** — Unified drag handle styling and active drag state between RoutineEditorModal and WorkoutScreen (DraggableList).
- [ ] Implemented - Need check: **Checkbox Design** — Changed set completion checkbox from circle (borderRadius: 10) to squircle (borderRadius: 6).
- [ ] Implemented - Need check: **Color Bleed Bug** — Added overflow: 'hidden' to Card component, added errorGlow theme token, updated categoryFailure to use consistent glow color.

## 4. Core Fitness Features

- [ ] Implemented - Need check: **Unilateral Sets Support** — Added isUnilateral flag to SetRecord, L/R rows in set box, unified checkbox, long-press ADD SET to add unilateral, volume calculation updated.
- [ ] Implemented - Need check: **RPE / RIR Toggle** — Added isRpeMode state, settings toggle in ProfileScreen, updated CustomWorkoutKeyboard to show RPE/RIR options, updated inline display.

## 5. Timer, Notifications & Background Tasks

- [ ] Implemented - Need check: **Timer Sub-menu** — Added timer sub-menu with -30, -10, Stop (red), +10, +30 buttons. Clicking active timer shows sub-menu instead of stopping.
- [ ] Implemented - Need check: **Audio Constraints** — Added 3-second timeout for native sounds, added 3-second timeout for web custom sounds.
- [ ] Implemented - Need check: **Background Timer & Notifications** — Added persistent notification showing workout name, exercise, and elapsed time when app is backgrounded. Timer-end sound plays via notification.

## 6. Localization (Hebrew) & Theming

- [ ] Implemented - Need check: **Hebrew i18n Hot-Reload** — Added switchLanguage function with listener-based re-render, removed restart requirement.
- [ ] Implemented - Need check: **Hebrew Layout & Typography** — Added RTL font helpers (getRTLFont) to theme.ts, added Rubik font variants for Hebrew text.
- [ ] Implemented - Need check: **Developer Theme Tool** — Added visual color picker grid with 24 colors, kept hex input as secondary option, updated preview swatch to use rounded square.

## 7. Performance & Cross-Platform Fixes

- [ ] Implemented - Need check: **Exercise Page Optimization** — Memoized ExerciseRow callbacks (onPress, onMenuPress, muscleColor, toggleExpand), wrapped filter handlers with useCallback.
- [ ] Implemented - Need check: **Android Muscle Map Bug** — Added overflow: 'hidden' to svgCard, added collapsable={false} to Animated.View for Android SVG rendering.
