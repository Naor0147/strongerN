# 📋 strongerN — Full-Fledged Training App Roadmap

This checklist outlines the roadmap to transform `strongerN` from a high-fidelity template tracker into a **full-fledged, industry-grade training and progression ecosystem**.

---

## 🚀 Epic 1: Core Workout & Exercise Features

- [x] **Super Sets & Giant Sets Implementation**
  - Add logic to group exercises together (e.g., Bench Press superset with Bent Over Rows).
  - Implement dynamic styling and colored link lines in `ActiveWorkoutModal` to signify supersets.
- [x] **Enhanced Exercise Info Views**
  - Expand the exercise info view to display:
    - Primary and secondary muscle groups.
    - Historical Personal Records (PRs).
    - Dynamic exercise progression charts (1RM and volume).
- [x] **Exercise Notes & RPE Tracking**
  - Integrate a context menu on individual exercises to save custom notes.
  - Implement RPE (Rate of Perceived Exertion, scale 1-10) tracking for every set.
- [x] **Interactive Muscle Map Enrichment**
  - Add smooth touch animations that zoom in on a tapped muscle group.
  - Display suggested exercises for the active muscle.
  - Detail weekly volume (sets logged) per muscle group.
- [x] **Rest Timer Customization**
  - Build an automated, custom rest timer that triggers upon ticking off a set.
  - Add quick duration selectors (e.g., 90s, 2m, 3m, +30s).
  - Support background countdown alerts and native push notifications.
- [x] **Persistent Active Workout Lifecycle (State Resilience)**
  - Auto-save the active session state to local storage on every set change or modification.
  - Retain the active session even if the application is fully closed or terminated by the OS.
  - Do not close or discard the active workout until the user explicitly taps "Finish" or "Discard".
  - Implement an **auto-close safety timer** (default: 3 hours) that discards or auto-saves inactive sessions to prevent ghost workouts.

---

## 📅 Epic 2: Workout Programming & Routines

- [x] **Multi-Week Routine Programs**
  - Support creating, scheduling, and subscribing to multi-week routines (e.g., 6-Week Push/Pull/Legs, 5/3/1 Powerlifting).
  - Create a calendar view on the Workout screen showing scheduled routines.
- [x] **Workout Template Folders**
  - Allow users to organize templates into custom directories/folders (e.g., "Bulking Splits", "Home Workouts", "Travel") for streamlined navigation.
- [x] **Set Category Types**
  - Allow labeling sets as:
    - `W` (Warm-up)
    - `S` (Working Set)
    - `D` (Drop Set)
    - `F` (Failure)
  - Color-code set indicators to match the category.
- [x] **Interactive Plate Calculator**
  - Add a helper modal that displays what plates to load onto a barbell (for both 20kg/45lb bars) based on the target weight.

---

## 📊 Epic 3: Advanced Analytics & Progress Tracking

- [x] **One-Rep Max (1RM) Estimations**
  - Automate 1RM calculations for strength-based exercises using Epley/Brzycki formulas.
  - Render a progress chart in the Profile showing estimated 1RM trends.
- [x] **Cumulative Metrics Dashboard**
  - Track total cumulative volume lifted (e.g., "10,000 kg lifted this month").
  - Log active workout frequency streaks and present milestone badges (e.g., "100 workouts logged", "Iron lungs").
- [x] **Interactive Body Measurement Timelines**
  - Map body weight and measurements on interactive charts (`BarChart` or line graphs) to track lean body mass trends.

---

## 🔌 Epic 4: Integrations & Synchronization

- [x] **Dynamic Island & Live Activities (iOS)**
  - Integrate Apple Live Activities to display active timer, current exercise, and rest timer countdown on iOS lock screens and the Dynamic Island.
- [x] **Apple HealthKit & Google Health Connect Integration**
  - Sync completed workouts, active duration, and estimated calories burned to native health systems.
  - Pull active heart-rate telemetry during active sessions if a wearable is connected.
- [x] **Wearable Companion App (WatchOS / WearOS)**
  - Design a lightweight wearable extension for quick set logging, rest timer tracking, and live heart rate monitoring.
- [x] **Local-First SQLite Database Migration**
  - Transition the storage engine from standard `localStorage` string serialization to **Expo SQLite**.
  - Enable robust relational querying, faster load times, and transaction safety.

---

## 📱 Epic 5: Portability & Sharing

- [x] **One-Tap Routine & Workout Sharing**
  - Make it incredibly easy to share workout routines/templates with other users.
  - Export routines as shareable JSON strings, QR codes, or deep links (`strongern://share?routine=...`).
- [x] **Dynamic Social Share Cards**
  - Generate shareable summaries (as stylized AMOLED-colored image cards) showing workout duration, volume, and PR achievements.
- [x] **Standard Import/Export Format**
  - Enable backups in standard formats to import data from other popular workout trackers.

---

## ⚡ Epic 6: Performance & App Size Optimization

- [x] **Asset Size Compression**
  - Audit and compress all png/jpg files under the `assets/` and `assets/photos/` directories using `sharp-cli` or `npx expo-optimize` to reduce native bundle sizes.
  - Migrate static image assets to SVG where applicable.
- [x] **JS Bundle Size & Dependency Audit**
  - Set up `react-native-bundle-visualizer` to identify heavy package dependencies.
  - Implement dynamic code splitting / lazy loading for heavy chart components and backup sub-modules.
- [x] **FlatList & Rendering Performance Tuning**
  - Add optimizations to list-heavy screens (History and Exercises):
    - Set `getItemLayout` for fixed-height list rows to skip dynamic measurement calculations.
    - Set optimal `windowSize`, `maxToRenderPerBatch`, and `removeClippedSubviews` parameters.
- [x] **State & Calculation Memoization**
  - Memoize heavy filter/mapping functions in `App.tsx` (like the weekly muscle volume set calculations and chart mappings) using `useMemo` to prevent UI frame drops on state updates.
  - Use `React.memo` on list cards to skip re-renders if list data has not changed.
- [x] **Hermes Engine Enforcement**
  - Ensure the Hermes JavaScript engine is fully enabled in `app.json` for rapid application startup times and lower RAM overhead.

---

## 🔒 Epic 7: Security & Data Protection

- [x] **Encrypted Storage Integration**
  - Migrate credentials, user access tokens, and cloud sync paths from plaintext Storage to **Expo Secure Store** (`expo-secure-store`).
- [x] **Secure Google Cloud Backups**
  - Audit Google Drive API requests: ensure they are routed strictly over TLS/HTTPS.
  - Clear out access tokens from persistent state upon logout and avoid logging tokens in console statements.
- [x] **Code Obfuscation & Binary Hardening**
  - Configure Proguard rules in the Android configuration to minify and obfuscate native Java/Kotlin modules.
  - Prevent reverse engineering of Javascript files inside the release bundles.
- [x] **App Permission Audit & Hardening**
  - Minimize requested native permissions in `app.json` (ensure only necessary background notifications and network permissions are configured).
- [x] **Offline Data Encryption (Optional)**
  - Integrate SQLCipher/SQLite encryption modules to secure the local database from unauthorized access on rooted/jailbroken devices.

---

## 🧪 Epic 8: Robust Automated Testing System

- [x] **Unit & Hook Testing Foundation**
  - Setup **Jest** and **React Native Testing Library (RNTL)** for Expo SDK 56.
  - Create mocks for native API targets (`AsyncStorage`, `expo-font`, navigation wrappers, secure store).
  - Write tests for core utilities, data formats, and calculation algorithms (e.g., CSV exports, 1RM calculators, and volume trackers).
- [x] **State Transition & Lifecycle Tests**
  - Write integration tests for the primary workout state loop in `App.tsx` (launching template -> modifying sets -> finishing workout -> saving database session).
  - Verify auto-saving logic and state recovery after simulated application terminations.
- [x] **UI Component & Design System Verification**
  - Write snapshot tests for base UI components (`Card`, `StatCard`, `Badge`, `BarChart`) to catch styling regressions.
  - Validate accessibility and tap targets (minimum 44dp) on interactive pressable rows and icon buttons.
- [x] **End-to-End (E2E) Automation (Maestro / Detox)**
  - Set up **Maestro** (recommended for Expo) or **Detox** E2E test suites for black-box mobile flows.
  - Record workflow tests for main user journeys (signing in, completing a full chest workout, verifying profile dashboard updates).
- [x] **Network Sync & Collision Testing**
  - Mock network latencies and failure modes to test Google Drive sync error handling, offline logging backups, and sync conflicts.
- [x] **Continuous Integration (CI/CD) Pipeline**
  - Integrate GitHub Actions workflows to run ESLint, TypeScript compilation checks, Jest suites, and Maestro checks on every pull request.

---

## 🛠️ Epic 9: System Polish & Accessibility

- [x] **Auditory Feedback (Sounds)**
  - Integrate sound alerts/chimes for key events:
    - Rest timer completed.
    - Set checked off.
    - New PR/Workout completion celebration.
- [x] **Tactile Animations & Micro-interactions**
  - Add premium, fluid spring animations for checking sets, timers ticking, and screen transitions to increase gamification.
- [x] **Swipe-to-Delete Gestures**
  - Enable smooth swipe-left gestures to delete sets and exercises in active workout logs.
