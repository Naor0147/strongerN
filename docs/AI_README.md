# strongerN — AI & Developer Architecture Guide

Welcome, AI Agent or Developer! This document is a comprehensive guide to the **strongerN** fitness tracker codebase. It outlines the project structure, design system, data model, screen hierarchy, and development guidelines to help you understand, maintain, and extend the application seamlessly.

---

## 🚀 1. Project Overview

`strongerN` is a high-fidelity, premium, battery-efficient (AMOLED-first) fitness tracking mobile application built using:
- **React Native** & **Expo SDK 56** (with TypeScript)
- **React Navigation** v7 (Bottom Tabs)
- **Expo Fonts** (`Inter` Google Font family)
- **Expo Status Bar** & **Linear Gradients**
- **React Native SVG** (for charting and graphical representations)
- **Expo Audio** (`expo-audio`) for offline UI notification sound alerts
- **Expo SQLite** (`expo-sqlite`) for local-first relational database persistence
- **Expo Secure Store** (`expo-secure-store`) for secure credentials and Google access token storage

The architecture is highly modular, separating UI visual blocks from layouts, business screens, and typed mock data, while strictly respecting a centralized token-based design system.

---

## 📁 2. File Directory Architecture

The repository is structured logically to enforce clean separation of concerns:

```text
strongerN/
├── .expo/                   # Expo dev server configuration
├── assets/                  # Fonts, static assets, splash screens, and offline sounds (assets/sounds/)
├── data/
│   └── mockData.ts          # TypeScript interfaces & comprehensive fitness mock data
├── components/
│   ├── layout/              # High-level layouts, navigation, and banners
│   │   ├── ActiveWorkoutBar.tsx # Animated, persistent bottom tracking widget
│   │   ├── BottomTabBar.tsx     # Custom glassmorphic tab-bar navigation
│   │   └── ScreenHeader.tsx     # Reusable header component for all screens
│   └── ui/                  # Reusable atomic design-system primitives
│       ├── Avatar.tsx       # Profile image / monogram container
│       ├── Badge.tsx        # Gym status / PR indicator badge
│       ├── BarChart.tsx     # Custom SVG layout charting weekly metrics
│       ├── Card.tsx         # Layout wrapper with high-contrast surfaces
│       ├── IconButton.tsx   # Rounded button wrapper for vector icons
│       ├── PressableRow.tsx # List items with active states & ripples
│       ├── SectionLabel.tsx # Custom typography label with side accents
│       ├── StatCard.tsx     # Key-value data visualizer
│       └── StatRow.tsx      # Multi-column grid rows for sets / weights
├── screens/                 # High-level feature-based screens
│   ├── WorkoutScreen.tsx    # Session template creator and starter
│   ├── ExercisesScreen.tsx  # Muscle-grouped exercise database and search
│   ├── HistoryScreen.tsx    # List of past gym sessions, comments, and stats
│   ├── MeasureScreen.tsx    # Body part measurement & stats tracker
│   └── ProfileScreen.tsx    # Personal records, workout frequency charts, & settings
├── theme.ts                 # Central Design Token System (Aesthetic base)
├── App.tsx                  # Root component (fonts, routing, and provider setup)
├── index.ts                 # Expo entry point
├── package.json             # Scripts & dependencies
├── tsconfig.json            # Strict TypeScript configuration
└── AGENTS.md / CLAUDE.md    # Developer constraints & versioning rule checks
```

---

## 🎨 3. Design Tokens (`theme.ts`)

The application implements a premium, dark-mode, high-contrast palette specifically optimized for AMOLED screens (such as flagship Android and iOS displays) to save battery and look modern.

### Colors
- **Main Background (`bg`)**: `#0D0F14` (Near-pure black for battery efficiency).
- **Surface Elevation Layers**:
  - `surface`: `#161B24` (Standard card backgrounds).
  - `surface2`: `#1E2633` (For pressed/hover states).
  - `surfaceHigh`: `#242E3E` (High-contrast pills or elevated details).
- **Accents**:
  - `accent`: `#4F8EF7` (Electric Blue: primary CTAs, progress bars, highlights).
  - `highlight`: `#7C5CFC` (Electric Violet: Personal records, high achievements, badges).
- **Status & Alerts**:
  - `gold`: `#F5C842` (PRs / streaks / trophies).
  - `success`: `#22D97A` (Completed indicators).
  - `error`: `#F0506E` (Deletion/critical errors).
- **Muscle Coding System**: Muscle groups are color-coded in `colors.muscle`:
  - Chest (`#F5504A`), Back (`#4F8EF7`), Quads (`#22D97A`), Hamstrings (`#F5C842`), Shoulders (`#C35CFC`), Biceps (`#FC7C5C`), Triceps (`#5CFCE0`), Glutes (`#FC5CB8`), Rear Delts (`#5CB8FC`).

### Typography (`font`)
Utilizes the **Inter** font family loaded dynamically in `App.tsx`:
- `font.regular` (`Inter_400Regular`)
- `font.medium` (`Inter_500Medium`)
- `font.semibold` (`Inter_600SemiBold`)
- `font.bold` (`Inter_700Bold`)
- Scaled sizes: `xs: 11`, `sm: 13`, `md: 15`, `base: 16`, `lg: 19`, `xl: 24`, `xxl: 30`, `hero: 38`.

### Spacing & Layout Constraints
- **Spacing Grid**: Multiples of 4 (`xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 24`, `xxl: 32`, `xxxl: 48`).
- **Border Radius (`radius`)**: Generous, premium rounding (`xs: 6`, `sm: 10`, `md: 16`, `lg: 24`, `xl: 32`).
- **Shadow / Elevation**: Custom Android `elevation` and iOS `shadowOffset` templates.
- **Ripples (Android)**: Factory methods `ripple.surface`, `ripple.accent`, and `ripple.borderless` to ensure high-fidelity tap feedback.

---

## 📊 4. Core Data Models (`data/mockData.ts`)

Every component is highly type-safe. Ensure you import or reference these interfaces for all data structures:

```typescript
export interface User {
  name: string;
  avatarUri?: string;
  totalWorkouts: number;
  isPro: boolean;
}

export interface ChartDataPoint {
  weekLabel: string;
  count: number;
}

export interface ExerciseSet {
  name: string;
  sets: number;
  bestWeight: number;
  bestReps: number;
  rpe?: number; // Rate of Perceived Exertion (1-10 scale)
}

export interface WorkoutSession {
  id: string;
  title: string;
  datetime: Date;
  comment?: string;
  exercises: ExerciseSet[];
  durationMinutes: number;
  totalVolumeKg: number;
  prs: number;
}

export interface Template {
  id: string;
  name: string;
  exercises: string[];
  lastUsed: Date;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  imageUri?: string;
  weeklySets: number;
}

export interface MeasureItem {
  id: string;
  label: string;
  lastValue?: string;
}
```

---

## 🧭 5. Screen Hierarchy & Navigation

The primary app layout consists of a `BottomTabNavigator` created with `@react-navigation/bottom-tabs`. 

1. **Profile Screen**: Lists user card, primary metrics, active streak, and the weekly workout custom SVG bar chart.
2. **History Screen**: Logs past workouts with total volume, time elapsed, PR counts, lists of exercise sets, and custom user comments.
3. **Workout Screen**: Lets users launch a blank workout or select templates (e.g. Upper Power, Push, Pull, Arm Spec) to begin tracking.
4. **Exercises Screen**: Features search filtering and muscle group tabs with custom badge pill filters.
5. **Measure Screen**: Tracks overall primary metrics (weight, body fat %, calorie targets) and individual body part sizes (chest, thighs, biceps, waist).

### Sticky Workout Bar
In `App.tsx`, the tab navigator is custom-wrapped. A persistent `ActiveWorkoutBar` is rendered right above the custom `BottomTabBar` to simulate a workout session currently in progress, displaying live time elapsed (calculated relative to a dynamic start timestamp).

---

## 🛠️ 6. Guidelines for AI & Developers

When editing or adding new features, you **MUST** strictly adhere to the following rules:

### ⚠️ Expo Version Compliance & Audio
- **Expo SDK 56** is in use. Refer strictly to `https://docs.expo.dev/versions/v56.0.0/` for documentation.
- **Audio Alerts (`expo-audio`)**: Playback is managed imperatively via `createAudioPlayer` in `utils/soundPlayer.ts`. Point only to locally synthesized assets in `assets/sounds/` to support offline operation. Remember to release player instances (`player.release()`) on ended playback status updates to prevent native memory leaks.
- Do **NOT** use deprecated React Native or Expo packages (such as `expo-av`).

### ☁️ Environment & Platform Authentication
- **Google OAuth Client ID**: Avoid hardcoding Client IDs in the UI. Read from `process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID` with standard fallback.
- **Deep Linking Scheme**: Configured with `scheme: "strongern"` in `app.json`. To test Native Google OAuth callback redirects, ensure your callback URI is set to `strongern://oauth-callback` and registered in your Google Console.
- **Simulation/Sandbox Mode**: High-level platform integrations (such as HealthKit/Health Connect and watchOS watch faces) are visually simulated inside the app codebase. Keep these clearly marked as `(Simulated)` to establish accurate expectations.

### 💅 Style System Rules
- **No Ad-Hoc Hardcoded Values**: Do not hardcode colors (e.g. `#fff`, `#333`, `#4F8EF7`) or spacing sizes inside screens or components. Always import `colors`, `font`, `spacing`, `radius`, `shadow`, or `animation` from `./theme`.
- **Contrast Ratios**: Maintain high contrast ratios for premium readability in light or dark environments.
- **Ripples and Taps**: All pressable components (`Pressable`) must utilize `android_ripple` using the `ripple` helper configuration, and use subtle opacity shifts or background scaling for iOS users.

### 📐 Layout Practices
- Leverage `SafeAreaView` from `react-native-safe-area-context` to safely render around device cutouts (notably notches and dynamic islands on modern smartphones).
- Ensure scrolls use `ScrollView` or `FlatList` with `contentContainerStyle` optimized for safe spacing at the bottom so elements are not clipped by the persistent Bottom Tab Bar and Active Workout Tracker.

---

## 🏃 7. Development & Running Commands

The following scripts are defined in the project:

- **Start Expo Server**: `npm run start` or `npm start`
- **Start Android Emulator**: `npm run android`
- **Start iOS Simulator**: `npm run ios`
- **Start Web Client**: `npm run web`

For easy local environment launch, use the custom `run-server.bat` batch script in the root directory.
