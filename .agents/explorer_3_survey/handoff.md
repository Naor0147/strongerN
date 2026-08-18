# Handoff Report: Explorer 3 Survey (UI Diagnostics, Tokens, i18n & Tests)

**Author**: Explorer 3  
**Target**: Parent / Implementers (Milestones 3 & 4)  
**Date**: 2026-08-18  
**Handoff Type**: Hard (Investigation & Architecture Survey Complete)  

---

## 1. Observation

1. **Settings & Developer Options Navigation (`src/screens/ProfileScreen.tsx`)**:
   - `ProfileScreen.tsx` manages a Settings Modal with subviews controlled by `settingsView: 'menu' | 'account' | 'data' | 'workout' | 'sounds' | 'appearance' | 'about' | 'developer'` (Line 278).
   - Developer tools unlock via `isDeveloperModeEnabled` (passed from `App.tsx`) or via 3 taps on the version row (`handleVersionPress`, Lines 257–274).
   - Developer settings section is rendered at Lines 2303–2703 (under `settingsView === 'about'`).
   - Crash Logs view is rendered as a subview at Lines 2271–2275: `<DeveloperCrashLogsView onBack={() => setSettingsView('about')} />`.
2. **Database & Schema Queries (`src/storage/history/repository.ts` & `src/storage/history/schema.ts`)**:
   - `workout_sessions` table (schema Line 26) contains `deleted_at_ms INTEGER`.
   - `countSessions()` (Line 330) queries `WHERE deleted_at_ms IS NULL` (active sessions).
   - `countAllRawSessions()` (Line 338) queries total raw rows.
   - `reconcileSessions(sessions)` (Lines 100–118) executes `UPDATE workout_sessions SET deleted_at_ms = ? WHERE deleted_at_ms IS NULL AND id NOT IN (${placeholders});`, which actively tombstones local workouts if invoked with partial/stale arrays.
   - `insertMissingSessionsOnly(sessions)` (Line 350) is safe and non-destructive.
3. **UI/UX Design Tokens (`src/theme.ts` & `UI_UX_README.md`)**:
   - Backgrounds: `colors.bg = '#0D0F14'` (Pure AMOLED black).
   - Containers: `colors.surface = '#161B24'`, `colors.surface2 = '#1E2633'`, `colors.surfaceHigh = '#242E3E'`.
   - Accents: `colors.accent = '#4F8EF7'` (Electric Blue), `colors.highlight = '#38BDF8'` (Sky Blue), `colors.error = '#F0506E'` (Neon Red).
   - Components: `Card.tsx`, `StatCard.tsx`, `SectionLabel.tsx`, Inter/Rubik typography, 4pt spacing grid, `shadow.card`, `rippleTokens.surface`.
4. **Localization & Versioning (`src/utils/i18n.ts` & `app.json`)**:
   - `app.json`: `"version": "1.0.1.77"`, `"versionCode": 132`.
   - `src/utils/i18n.ts`: Line 344 (EN) and Line 1279 (HE) contain version string `1.0.1.77`.
   - All profile strings are split under `translations.en.profile` and `translations.he.profile`.
5. **Auto-Sync & Backup Flow (`src/App.tsx`)**:
   - Auto-sync `useEffect` (Line 836) checks `!isDataLoaded` but does NOT check `!isFullHistoryLoaded`, creating a data-poisoning vulnerability where preview caches (20 workouts) overwrite Google Drive backups.
   - `handleGoogleLogin` (Line 990) and `applyBackupData` (Line 1340) call `reconcileSessions`, causing local workouts to be tombstoned when restoring partial backups.
6. **Test Harness**:
   - Node at `C:\Users\NAORA\AppData\Roaming\fnm\node-versions\v22.22.3\installation\node.exe`.
   - Running `$env:PATH = "C:\Users\NAORA\AppData\Roaming\fnm\node-versions\v22.22.3\installation;$env:PATH"; npm test` runs 18 test suites / 150 tests cleanly in 4.65s.
   - Running `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.

---

## 2. Logic Chain

1. **Root Cause of Missing History in UI**: Workouts are not physically deleted; they are tombstoned in SQLite with `deleted_at_ms != NULL` due to `reconcileSessions` being triggered with partial session arrays during sync/restore.
2. **Recovery Mechanism**: Adding `restoreAllTombstonedSessions()` (`UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1 WHERE deleted_at_ms IS NOT NULL;`) restores all hidden workouts without data loss.
3. **Telemetry & Real-Time Inspection**:
   - Active count = `SELECT COUNT(*) FROM workout_sessions WHERE deleted_at_ms IS NULL;`
   - Tombstoned count = `SELECT COUNT(*) FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;`
   - Raw total = `SELECT COUNT(*) FROM workout_sessions;`
   - MMKV Cache count = `getCachedRecentSessions()?.length ?? 0`.
   - Querying these together in `getDatabaseDiagnostics()` and presenting them in a 2x2 `<StatCard>` grid inside `<DeveloperDiagnosticsView>` provides complete transparency and 1-tap repair.
4. **Hardening Against Data Poisoning**:
   - Adding `if (!isFullHistoryLoaded) return;` to the auto-sync effect in `App.tsx` guarantees that Google Drive will never be updated with a 20-item preview cache.
   - Replacing `reconcileSessions` with `insertMissingSessionsOnly` in `applyBackupData` and `handleGoogleLogin` guarantees that local workouts will never be deleted/tombstoned during restore operations.
5. **Testing & Quality Assurance**:
   - Automated regression tests in `src/__tests__/historyRecoveryRegression.test.ts` will verify these 3 invariants programmatically, preventing regressions in future releases.

---

## 3. Caveats

- In web mode or when SQLite is unavailable, the app operates in legacy fallback mode (`healthState = 'legacy_safe_mode'`). The diagnostic view handles this gracefully by displaying the health mode from `getStorageHealthState()`.
- The diagnostic telemetry queries run asynchronously on the SQLite database; during repair execution, `writeQueue` serialization ensures no concurrent write collisions occur.

---

## 4. Conclusion

The plan for Milestones 3 & 4 is completely specified:
- **Milestone 3 (UI Diagnostics & Repair)**: Add `countDeletedSessions()`, `restoreAllTombstonedSessions()`, `getDatabaseDiagnostics()` in `repository.ts`; build `src/screens/DeveloperDiagnosticsView.tsx` with AMOLED tokens and StatCards; wire `'diagnostics'` subview in `ProfileScreen.tsx`; add EN/HE i18n keys.
- **Milestone 4 (Sync & Restore Hardening + Tests)**: Guard auto-sync with `isFullHistoryLoaded`; replace `reconcileSessions` with `insertMissingSessionsOnly`; bump version to `1.0.1.78` in `app.json` and `i18n.ts`; add `historyRecoveryRegression.test.ts`.

---

## 5. Verification Method

To verify the test suite and typechecks independently:

1. **Run Unit Tests**:
   ```powershell
   $env:PATH = "C:\Users\NAORA\AppData\Roaming\fnm\node-versions\v22.22.3\installation;$env:PATH"
   npm test
   ```
   *Expected: All 18 test suites (150 tests) pass.*

2. **Run TypeScript Check**:
   ```powershell
   $env:PATH = "C:\Users\NAORA\AppData\Roaming\fnm\node-versions\v22.22.3\installation;$env:PATH"
   npm run typecheck
   ```
   *Expected: 0 errors.*

3. **Verify Files Created / Inspected**:
   - Survey Report: `c:\Antigravity\strongerN\.agents\explorer_3_survey\survey_report.md`
   - Design System: `c:\Antigravity\strongerN\src\theme.ts`
   - Settings Screen: `c:\Antigravity\strongerN\src\screens\ProfileScreen.tsx`
   - Repository: `c:\Antigravity\strongerN\src\storage\history\repository.ts`
   - Translations: `c:\Antigravity\strongerN\src\utils\i18n.ts`
