# 🤖 strongerN — AI Developer Cheat Sheet (readmeAi)

A dense, high-context developer reference for `strongerN`. Read this first before creating features or modifying files.

---

## ⚡ 1. App & Tech Stack Overview
`strongerN` is a premium, battery-efficient (**AMOLED-first**) fitness tracker built for OLED devices.
*   **Core**: React Native, Expo SDK 54/56, TypeScript.
*   **State & Navigation**: Centralized state in [App.tsx](file:///C:/Antigravity/strongerN/src/App.tsx); Tab Navigation (Profile, History, Workout, Exercises, Muscles).
*   **Storage**: SQLite (`expo-sqlite`) for local logs + SecureStore (`expo-secure-store`) for credentials.
*   **Media & Integrations**: Zero-latency local playback via `expo-audio` + Google Drive OAuth sync via deep links (`strongern://oauth-callback`).

---

## 📂 2. Organized Project Structure

All source files reside in the `src/` directory.

```text
src/
├── App.tsx                   # Centralized global state manager, main screen & modal mount point
├── theme.ts                  # Design tokens (colors, font, radius, spacing, ripples, global animations)
├── data/
│   └── mockData.ts           # seed exercise, metric, template, and program structures
├── utils/
│   ├── db.ts & secureStore.ts       # Database & secure storage adapters
│   ├── authStore.ts & googleDrive.ts # Onboarding state & Google Drive backup integration
│   ├── soundPlayer.ts               # Local synthesized audio playback events (expo-audio)
│   └── csvImporter.ts & workout.ts  # CSV/Strong data parser & workout math/1RM calculations
├── screens/
│   ├── LoginScreen.tsx              # Onboarding, login credentials & cloud backup restore flow
│   ├── WorkoutScreen.tsx            # Routines, splits, folder organizing, and programs library
│   ├── ExercisesScreen.tsx          # Searchable, muscle-filtered exercises list with history notes
│   ├── AddExerciseScreen.tsx        # Multi-step wizard to create custom exercises
│   ├── MuscleMapScreen.tsx          # Interactive SVG body map visualizing weekly sets intensity
│   ├── HistoryScreen.tsx            # Scrollable archive log of past sessions
│   └── MeasureScreen.tsx            # Body metrics dimensions manager & line charts
└── components/
    ├── layout/                      # Sheets, headers, tab controllers
    │   ├── BottomTabBar.tsx, ScreenHeader.tsx
    │   ├── ActiveWorkoutBar.tsx (collapsible preview footer) & ActiveWorkoutModal.tsx (active sheet)
    │   └── RoutineEditorModal.tsx (routine customizer sheet)
    └── ui/                          # Atoms & visual components
        ├── Card.tsx, PressableRow.tsx, Badge.tsx, Avatar.tsx, SectionLabel.tsx, IconButton.tsx
        ├── StatCard.tsx, StatRow.tsx, BarChart.tsx (weekly activity SVG bar representation)
        ├── CustomWorkoutKeyboard.tsx, DraggableList.tsx, WatchCompanionSimulator.tsx
        └── RoutineSharingModal.tsx & SocialShareCard.tsx (social achievements exports)
```

---

## 🎨 3. UI/UX Rules (`src/theme.ts`)
*   **AMOLED Theme**: Base background must be pure black (`colors.bg`: `#0D0F14`). Card surfaces use `#161B24`.
*   **Highlights**: Primary CTA: Electric Blue (`#4F8EF7`); PRs: Neon Sky Blue (`#38BDF8`); Milestones: Violet (`#7C5CFC`); Streaks/Trophies: Sporty Indigo (`#6366F1`).
*   **Layout**: Strict 4pt Grid (`xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 24`, `xxl: 32`).
*   **Contrast**: Keep text readability above 4.5:1. Targets must have min touch area of **44dp x 44dp**.

---

## ⚠️ 4. Critical Rules for AI Changes

> [!IMPORTANT]
> **Android Signing Keystore Protection**:
> Never modify or overwrite the developer's personal debug keystore at `C:\Users\NAORA\.android\debug.keystore`. Replacing it will break signature validation and prevent in-place app updates on connected devices.

> [!WARNING]
> **No Emojis as Icons**:
> Do not use raw emojis for action indicators, buttons, or ticks (e.g., `❌` or `✅`). Use SVG vector icons from `@expo/vector-icons` (Lucide or Ionicons). Emojis are reserved strictly for textual badges and content labels.

*   **Offline Mode**: All assets, sounds, and icons must be packaged locally.
*   **Sync AST**: After updating code files, run `graphify update .` to update the codebase index.
