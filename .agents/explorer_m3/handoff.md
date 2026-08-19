# Handoff Report: Milestone 3 Investigation (R10: Hardcode Cleanup, i18n, Version Bump & APK Build Pipeline)

## 1. Observation

### 1.1 Current App Versioning
- **`app.json` (lines 9 & 24)**:
  ```json
  "version": "1.0.1.87",
  ...
  "android": {
    "package": "com.naor.strongern",
    "versionCode": 142,
  ```
- **`src/utils/i18n.ts` (lines 345 & 1299)**:
  - English (`en.profile.version` line 345):
    ```ts
    version: 'Version 1.0.1.87  ·  AMOLED Optimized (Tap version to unlock developer tools)',
    ```
  - Hebrew (`he.profile.version` line 1299):
    ```ts
    version: 'v1.0.1.87  ·  מותאם ל-AMOLED (גע בגרסה כדי לפתוח כלי מפתחים)',
    ```
- **Target Next Version**:
  - `app.json` `version`: `"1.0.1.88"`
  - `app.json` `android.versionCode`: `143`
  - `src/utils/i18n.ts` `en.profile.version`: `'Version 1.0.1.88  ·  AMOLED Optimized (Tap version to unlock developer tools)'`
  - `src/utils/i18n.ts` `he.profile.version`: `'v1.0.1.88  ·  מותאם ל-AMOLED (גע בגרסה כדי לפתוח כלי מפתחים)'`

### 1.2 Hardcoded Colors & Tokens Survey
Directly observed hex literals and non-token styling across targeted components:

1. **`src/screens/ExerciseInsightsModal.tsx`**:
   - Line 972: `backgroundColor: 'rgba(79, 142, 247, 0.15)'` (should be `colors.accentGlow` or `colors.accent + '20'`).
2. **`src/components/layout/ActiveWorkoutModal.tsx`**:
   - Lines 596–602 (Plate calculator colors):
     ```ts
     { size: 25, color: '#EF4444', textColor: '#FFFFFF' },
     { size: 20, color: '#3B82F6', textColor: '#FFFFFF' },
     { size: 15, color: '#FBBF24', textColor: '#0D0F14' },
     { size: 10, color: '#10B981', textColor: '#FFFFFF' },
     { size: 5,  color: '#EEF1F6', textColor: '#0D0F14' },
     { size: 2.5, color: '#374151', textColor: '#FFFFFF' },
     { size: 1.25, color: '#6B7280', textColor: '#FFFFFF' },
     ```
   - Lines 620–623 (Superset palette):
     ```ts
     '#4F8EF7', // Electric Blue
     '#38BDF8', // Neon Sky Blue
     '#6366F1', // Sporty Indigo
     '#22D97A', // Emerald Green
     ```
     Should reference `[colors.accent, colors.highlight, colors.gold, colors.success]`.
   - Line 1275: `<Ionicons name="checkmark" size={20} color="#0D0F14" />` (should use `colors.bg`).
3. **`src/components/layout/AnimatedCheckmark.tsx`**:
   - Line 21: `<Ionicons name="checkmark" size={14} color="#0D0F14" />` (should use `colors.bg`).
4. **`src/components/layout/activeWorkoutStyles.ts`**:
   - Line 702: `backgroundColor: '#4A5568'`
   - Line 711: `backgroundColor: '#2D3748'`
   - Line 1018: `color: '#0D0F14'` (should use `colors.bg` / `colors.textInverse`).
5. **`src/components/layout/SwipeableRow.tsx`**:
   - Lines 322, 325: `color="#FFF"` (should use `colors.textPrimary`).

### 1.3 Hardcoded Strings & Missing i18n Keys
1. **`src/screens/ExerciseInsightsModal.tsx`**:
   - Line 529: Calls `i18n.t('exerciseInsights.percentileHint', { defaultValue: 'Set bodyweight & gender in Profile to unlock strength percentiles' })` — key `percentileHint` is missing from `src/utils/i18n.ts` in both `en` (line 524) and `he` (line 1499).
   - Lines 87–99: `getSecondaryMuscles(primary)` returns hardcoded English strings (`'Shoulders, Triceps'`, `'Biceps, Rear Delts'`, etc.).
   - Line 348: `currentExercise.isUnilateral ? 'UNILATERAL' : 'BILATERAL'` is hardcoded uppercase English.
   - Line 340: `'Other'` in `(currentExercise.equipment || 'Other').toUpperCase()`.
   - Lines 698 & 701: `reps` and `kg` in history set rows.
2. **`src/utils/i18n.ts`**:
   - Missing `exerciseInsights.percentileHint` in EN:
     `percentileHint: 'Set bodyweight & gender in Profile to unlock strength percentiles',`
   - Missing `exerciseInsights.percentileHint` in HE:
     `percentileHint: 'הגדר משקל גוף ומין בפרופיל כדי לפתוח אחוזוני כוח',`

### 1.4 Test Runner Environment & Commands
- **Environment Requirement**: PowerShell on Windows requires initializing Node/npm via `fnm env --shell powershell | Out-String | Invoke-Expression`.
- **Typecheck Command**:
  `fnm env --shell powershell | Out-String | Invoke-Expression; npm run typecheck`
  - Result: 0 errors (`tsc --noEmit` cleanly passed).
- **Unit Test Command**:
  `fnm env --shell powershell | Out-String | Invoke-Expression; npm test`
  - Result: 38 test suites passed, 319 tests passed (including `src/__tests__/finalChallengerVerification.test.tsx` verifying version alignment).
- **Standalone Build Script**:
  - `cmd /c build-apk.bat --auto` invokes `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-apk.ps1 --auto`.
  - Automatically checks `app.json`, configures Gradle (arm64-v8a target), builds release APK via `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a -x lintVitalRelease -x lintVitalAnalyzeRelease`, and if ADB device connected, installs cleanly.

---

## 2. Logic Chain

1. **Observation 1.1** shows current app version is `1.0.1.87` with versionCode `142` in `app.json` and matching translation strings in `src/utils/i18n.ts`.
2. Following the user rules in `AGENTS.md` ("Every time you make any change or complete a task, increment the app version in `app.json` and in the translation keys `profile.version` in `src/utils/i18n.ts` (both English and Hebrew)"), the next production version must be `1.0.1.88` with versionCode `143`.
3. Unit test `finalChallengerVerification.test.tsx` enforces strict equality between `app.json` version and the strings `'Version ' + appVersion` in EN and `'v' + appVersion` in HE. Synchronizing all three locations is mandatory for tests to pass.
4. **Observation 1.2 & 1.3** identify all hardcoded colors, literal string constants, and missing translation keys across `ExerciseInsightsModal.tsx`, `ActiveWorkoutModal.tsx`, and associated styles/sub-components.
5. In accordance with the `ui-ux-design-pro-max` AMOLED rule (`colors.bg` `#0D0F14`, token compliance), replacing raw hex values like `'#0D0F14'`, `'rgba(79, 142, 247, 0.15)'`, `'#4A5568'` with semantic tokens (`colors.bg`, `colors.accentGlow`, `colors.surfaceHigh`, etc.) ensures design system compliance.
6. Adding `percentileHint` and other missing keys to `src/utils/i18n.ts` ensures complete internationalization across EN and HE without relying on unlocalized fallbacks.
7. **Observation 1.4** verifies that `npm run typecheck` and `npm test` execute cleanly and defines the exact invocation required in Windows PowerShell.

---

## 3. Caveats

- `build-apk.bat --auto` compiles the Android release APK using the local Android SDK and Gradle cache. When testing on CI or non-Android environments, ensure `ANDROID_HOME` and JDK 19 are available (they are configured on this local machine).
- As specified in `AGENTS.md`, `npm run e2e` tests must NOT be run during this routine release pipeline to prevent token depletion and emulator timeouts.
- No other caveats.

---

## 4. Conclusion

The release pipeline for Milestone 3 (R10) is fully defined and verified:
1. Complete R5 (ExerciseInsightsModal) and R7 (ActiveWorkoutModal) implementations.
2. Clean up hardcoded hex colors and literal strings in target files.
3. Add missing i18n keys to `src/utils/i18n.ts`.
4. Bump version to `1.0.1.88` (versionCode `143`) in `app.json` and `src/utils/i18n.ts`.
5. Verify with `npm run typecheck` and `npm test`.
6. Run `cmd /c build-apk.bat --auto`.
7. Run `graphify update .`.
8. Git stage, commit, and push to `master`.

---

## 5. Verification Method

### 5.1 Verification Commands
Run in PowerShell from project root `c:\Antigravity\strongerN`:

```powershell
# 1. Typecheck
fnm env --shell powershell | Out-String | Invoke-Expression; npm run typecheck

# 2. Jest Unit Tests
fnm env --shell powershell | Out-String | Invoke-Expression; npm test

# 3. Release APK Build
cmd /c build-apk.bat --auto

# 4. Knowledge Graph Update
graphify update .

# 5. Git Status & Commit/Push Check
git status
```

### 5.2 Files to Inspect
- `app.json` (lines 9 & 24)
- `src/utils/i18n.ts` (lines 345, 544, 1299, 1519)
- `src/screens/ExerciseInsightsModal.tsx`
- `src/components/layout/ActiveWorkoutModal.tsx`
