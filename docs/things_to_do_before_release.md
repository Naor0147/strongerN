# 📋 Things to Do Before Release — strongerN

This document serves as our pre-release checklist. All necessary tasks, modifications, asset bundling, and testing procedures have been implemented and verified.

---

## 🛠️ Code & Configuration Checklist

### [x] 1. Clean Up Initial Production State (Blank Slate)
* **Goal:** Ensure a new user gets a clean, empty workout tracker instead of developer/tester logs.
* **Resolution:** Initialized states to clean defaults in `App.tsx` (Guest User, empty sessions, empty templates, empty metric histories), keeping the default exercises library. The onboarding banner continues to let users import the demo database with one click.

### [x] 2. Remove Hardcoded Developer Credentials & Tokens
* **Goal:** Secure the codebase from credential leaks.
* **Resolution:** Deleted the unused `googleEmail` state containing developer email from `ProfileScreen.tsx`. Configured `googleClientId` in `ProfileScreen.tsx` to read dynamically from environment variables (`process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID`) with the developer fallback.

### [x] 3. Bundle Audio Assets Locally (Ensure Offline Support)
* **Goal:** Play sound alerts without relying on internet connectivity.
* **Resolution:** Synthesized local wave chimes (`set_completed.wav`, `timer_completed.wav`, `workout_completed.wav`) directly inside `assets/sounds/` and rewrote `utils/soundPlayer.ts` to load them locally.

### [x] 4. Label Mocked/Simulated Native Features in UI
* **Goal:** Prevent user disappointment and App Store rejection over missing functionalities.
* **Resolution:** Renamed settings labels to "Native Health Integration (Simulated)" and "LIVE ACTIVITY SIMULATOR" in `ProfileScreen.tsx` and `DynamicIslandSimulator.tsx`, setting expectations for a sandbox build.

### [x] 5. Align Design Guidelines
* **Goal:** Sync developer docs with actual UI implementation.
* **Resolution:** Updated `design-system/strongern/MASTER.md` to reflect AMOLED backgrounds (`#0D0F14`), electric blue accents (`#4F8EF7`), and the Inter font family.

---

## 📱 Build & Platform Settings Checklist

### [x] 6. Resolve Deprecation Warnings & Native OAuth Redirect
* **Goal:** Ensure compatibility and smooth native callback flows.
* **Resolution:**
  * Replaced the deprecated `expo-av` library with the modern `expo-audio` library, uninstalled `expo-av`, and updated mock configurations so tests pass.
  * Registered deep-link scheme `"scheme": "strongern"` in `app.json`.
  * Implemented dual-platform redirection callback in `ProfileScreen.tsx` (using Web popup on Web, and native deep linking listener + system browser redirect on iOS/Android).

---

## 🧪 Quality Assurance & Verification

### [x] 7. Run Verification Pipeline
* **Resolution:**
  * Verified types: `npx tsc --noEmit` compiles with zero errors.
  * Verified unit tests: `npm test` runs and passes all 11 assertions.
  * Verified styling contrast and touch targets.
