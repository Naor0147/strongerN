# Explorer 3 Survey Report: Diagnostic Panel, UI/UX Tokens, i18n, & Automated Testing

**Investigator**: Explorer 3  
**Target Project**: StrongerN (Production Workout History Recovery & Hardening)  
**Scope**: Developer Options & Diagnostic Panel, AMOLED Design Tokens, i18n Dictionary, Test Architecture & Safety Regressions (Milestones 3 & 4)  
**Date**: 2026-08-18  

---

## Executive Summary

This investigation analyzed the UI/UX design architecture, Settings & Developer Tools navigation, database telemetry querying, English/Hebrew localization dictionary, and the automated test harness.

Key discoveries:
1. **Developer Options Architecture**: Located in `src/screens/ProfileScreen.tsx` (lines 2270–2705). Developer tools are unlocked via `isDeveloperModeEnabled` (persisted in MMKV compact settings) or by tapping the app version 3 times in the About card (`handleVersionPress`, lines 257–274). Navigation within settings uses `settingsView` (`'menu' | 'account' | 'data' | 'workout' | 'sounds' | 'appearance' | 'about' | 'developer'`).
2. **Diagnostic Panel Placement**: The optimal architecture is a dedicated view `<DeveloperDiagnosticsView>` matching `<DeveloperCrashLogsView>` (lines 2271–2275), navigated from a new card in Developer Options (`settingsView === 'about' -> settingsView = 'diagnostics'`).
3. **Database Statistics & Recovery Engine**: SQLite relational storage in `src/storage/history/repository.ts` already tracks `deleted_at_ms` in `workout_sessions`. Active count is queried with `deleted_at_ms IS NULL`, tombstoned count with `deleted_at_ms IS NOT NULL`, raw rows with `countAllRawSessions()`, and MMKV cache from `src/storage/instantCache.ts`. Adding `countDeletedSessions()`, `restoreAllTombstonedSessions()`, and `getDatabaseDiagnostics()` provides instant querying and safe 1-tap recovery.
4. **AMOLED Design Compliance**: All UI primitives strictly adhere to `src/theme.ts` (`colors.bg = '#0D0F14'`, `colors.surface = '#161B24'`, `colors.accent = '#4F8EF7'`, Inter/Rubik fonts, 4pt spacing grid, `shadow.card`, `rippleTokens.surface`, and `@expo/vector-icons`).
5. **Localization (i18n)**: All strings reside in `src/utils/i18n.ts` (en and he). Version is currently `'1.0.1.77'` (Line 344 in EN, Line 1279 in HE; `app.json` line 9 / `versionCode: 132`).
6. **Testing Architecture**: Jest runner with 18 existing test suites (150 tests) passing in ~4.6s. Global mocks exist in `src/__tests__/mocks/nativeModulesMock.js`. In-memory SQLite & MMKV test harness in `challengerM3Adversarial.test.ts` provides the exact model for adding 3 safety regression suites: (1) sync upload prevention before full load, (2) merge-only restore safety against stale backups, and (3) soft-delete repair execution.

---

## 1. Settings Screens & Developer Options Architecture

### File Locations & Entry Points
- **Main Settings Container**: `src/screens/ProfileScreen.tsx`
  - Settings Modal triggered by Gear icon in header: `setIsSettingsVisible(true)` (Line 848, 1404).
  - Navigation state: `const [settingsView, setSettingsView] = useState<'menu' | 'account' | 'data' | 'workout' | 'sounds' | 'appearance' | 'about' | 'developer'>('menu');` (Line 278).
  - `devToolsTapUnlocked`: Unlocked via 3 rapid taps on the app version row (`handleVersionPress`, lines 257–274).
  - `isDeveloperModeEnabled`: Passed from `App.tsx` (Line 424, 719, 2506), hydrated from MMKV `AppSettingsCompactV2`.
  - Composite flag: `const developerToolsUnlocked = isDeveloperModeEnabled || devToolsTapUnlocked;` (Line 252).

### Current Developer Tools Structure (`ProfileScreen.tsx`)
Inside `settingsView === 'about'` (Lines 2303–2703):
- **Enable Developer Tools Switch** (Lines 2311–2336): Toggles `isDeveloperModeEnabled`.
- **Load Demo Database Action** (Lines 2345–2375): Populates mock workouts in Guest mode.
- **Dynamic Theme Selector** (Lines 2380–2425): Selects presets (`default`, `purple`, `black-white`, `emerald`, `crimson`, `custom`).
- **Custom Accent Color Picker & Hex Input** (Lines 2428–2514).
- **Developer Settings Section** (Lines 2522–2700):
  - Wearable Heart Rate Sync toggle (`isLiveHeartRateEnabled`).
  - Achievement Badges toggle (`showAchievementBadges`).
  - Inspect Session Data (`Alert.alert` with auth tokens and user profile).
  - Trigger Test Error (`throw new Error(...)`).
  - View Crash Logs (`setSettingsView('developer')` -> renders `<DeveloperCrashLogsView onBack={() => setSettingsView('about')} />`).
  - Smartwatch Companion Simulator (`setIsWatchSimulatorVisible(true)`).

### Recommended Diagnostic & Repair Panel Placement
1. Extend `settingsView` union type in `src/screens/ProfileScreen.tsx` to include `'diagnostics'`:
   ```ts
   type SettingsView = 'menu' | 'account' | 'data' | 'workout' | 'sounds' | 'appearance' | 'about' | 'developer' | 'diagnostics';
   ```
2. Add a **"Database Diagnostics & History Repair"** card inside the Developer Options section of `ProfileScreen.tsx` (under `isDeveloperModeEnabled && (`):
   - Icon: `Ionicons name="medkit-outline"` (accent color `#4F8EF7` or highlight `#38BDF8`).
   - Title: `i18n.t('profile.diagnosticsTitle')` ("Database Diagnostics & Repair").
   - Subtitle: `i18n.t('profile.diagnosticsSub')` ("Inspect SQLite tables, MMKV cache, and recover workouts").
   - Action: `setSettingsView('diagnostics')`.
3. In `ProfileScreen.tsx` subview router (around Line 2271):
   ```tsx
   ) : settingsView === 'diagnostics' ? (
     <DeveloperDiagnosticsView
       onBack={() => setSettingsView('about')}
       onRepairComplete={async () => {
         // Reload sessions into parent memory and refresh UI
         if (onReloadSessions) await onReloadSessions();
       }}
     />
   ) : settingsView === 'developer' ? (
     <DeveloperCrashLogsView onBack={() => setSettingsView('about')} />
   ) : ( ... )
   ```
4. Create `src/screens/DeveloperDiagnosticsView.tsx` component.

---

## 2. Database Statistics Querying & Real-Time Telemetry

### SQLite Schema (`src/storage/history/schema.ts`)
The relational database tracks sessions across three tables:
- `workout_sessions`: `id`, `title`, `title_norm`, `started_at_ms`, `ended_at_ms`, `duration_sec`, `comment`, `total_volume_milli_kg`, `prs`, `created_at_ms`, `updated_at_ms`, `revision`, `deleted_at_ms`.
- `session_exercises`: `id`, `session_id`, `exercise_id`, `name_snapshot`, `name_norm`, `variation_key`, `position`, `superset_group_id`, `note`.
- `set_logs`: `id`, `session_exercise_id`, `position`, `category`, `completed`, `weight_milli_kg`, `reps`, `rpe_tenths`, `is_unilateral`, `left_weight_milli_kg`, `left_reps`, `right_weight_milli_kg`, `right_reps`.

### Existing vs. Required Methods in `src/storage/history/repository.ts`

| Metric / Action | Status | SQL / Implementation |
| :--- | :--- | :--- |
| **Active Sessions Count** | Existing (Line 330) | `SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NULL;` |
| **Total SQLite Raw Rows** | Existing (Line 338) | `SELECT COUNT(*) AS count FROM workout_sessions;` |
| **Tombstoned Sessions Count** | **NEW** | `SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;` |
| **Session Exercises Count** | **NEW** | `SELECT COUNT(*) AS count FROM session_exercises;` |
| **Set Logs Count** | **NEW** | `SELECT COUNT(*) AS count FROM set_logs;` |
| **MMKV Recent Cache Count** | From `instantCache.ts` | `getCachedRecentSessions()?.length ?? 0` |
| **MMKV Total Cache Count** | From `instantCache.ts` | `getCachedTotalSessionsCount() ?? 0` |
| **Storage Engine Health** | From `healthState.ts` | `getStorageHealthState()` (`'ready'`, `'legacy_safe_mode'`, `'migration_failed_readonly'`) |
| **Restore Tombstones (Repair)** | **NEW** | `UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1 WHERE deleted_at_ms IS NOT NULL;` |

### Proposed Repository Additions (`src/storage/history/repository.ts`)
```ts
export interface DatabaseDiagnostics {
  activeSessionsCount: number;
  deletedSessionsCount: number;
  totalSessionRows: number;
  exerciseRowsCount: number;
  setRowsCount: number;
  mmkvCachedRecentCount: number;
  mmkvCachedTotalCount: number | null;
  storageHealth: StorageHealthState;
}

export async function countDeletedSessions(): Promise<number> {
  const db = await requireDb();
  const row: any = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;'
  );
  return Number(row?.count ?? 0);
}

export async function getDatabaseDiagnostics(): Promise<DatabaseDiagnostics> {
  const db = await requireDb();
  const [activeRow, deletedRow, totalRow, exRow, setRow] = await Promise.all([
    db.getFirstAsync('SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NULL;') as Promise<any>,
    db.getFirstAsync('SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;') as Promise<any>,
    db.getFirstAsync('SELECT COUNT(*) AS count FROM workout_sessions;') as Promise<any>,
    db.getFirstAsync('SELECT COUNT(*) AS count FROM session_exercises;') as Promise<any>,
    db.getFirstAsync('SELECT COUNT(*) AS count FROM set_logs;') as Promise<any>,
  ]);

  const recentSessions = getCachedRecentSessions();
  const totalCached = getCachedTotalSessionsCount();

  return {
    activeSessionsCount: Number(activeRow?.count ?? 0),
    deletedSessionsCount: Number(deletedRow?.count ?? 0),
    totalSessionRows: Number(totalRow?.count ?? 0),
    exerciseRowsCount: Number(exRow?.count ?? 0),
    setRowsCount: Number(setRow?.count ?? 0),
    mmkvCachedRecentCount: Array.isArray(recentSessions) ? recentSessions.length : 0,
    mmkvCachedTotalCount: totalCached,
    storageHealth: getStorageHealthState(),
  };
}

export function restoreAllTombstonedSessions(): Promise<number> {
  return enqueueWrite(async () => {
    const db = await requireDb();
    return await transaction(db, async () => {
      const row: any = await db.getFirstAsync(
        'SELECT COUNT(*) AS count FROM workout_sessions WHERE deleted_at_ms IS NOT NULL;'
      );
      const count = Number(row?.count ?? 0);
      if (count > 0) {
        const now = Date.now();
        await db.runAsync(
          'UPDATE workout_sessions SET deleted_at_ms = NULL, updated_at_ms = ?, revision = revision + 1 WHERE deleted_at_ms IS NOT NULL;',
          [now]
        );
      }
      return count;
    });
  });
}
```

---

## 3. UI/UX Design System Tokens & AMOLED Dark Theme Rules

The diagnostic panel and all UI modifications must adhere strictly to `src/theme.ts`, `UI_UX_README.md`, and `design-system/strongern/MASTER.md`.

### Core Color Tokens (`src/theme.ts:48–107`)
- **Base Background**: `colors.bg = '#0D0F14'` (Pure AMOLED deep black). Never use gray blocks or bright containers.
- **Card Surfaces**: `colors.surface = '#161B24'`, `colors.surface2 = '#1E2633'` (pressed/active), `colors.surfaceHigh = '#242E3E'` (elevated modals/pills).
- **Borders**: `colors.border = '#252D3A'`, `colors.borderStrong = '#334155'`.
- **Accents**:
  - Primary CTA & Focus: `colors.accent = '#4F8EF7'` (Electric Blue).
  - Secondary / PRs: `colors.highlight = '#38BDF8'` (Neon Sky Blue).
  - Milestones / Badges: `colors.violet = '#7C5CFC'` or `#38BDF8`.
  - Streaks / Trophies: `colors.gold = '#6366F1'`.
  - Success / Active: `colors.success = '#22D97A'` (Emerald Green).
  - Error / Tombstone Warning: `colors.error = '#F0506E'` (Neon Red).
- **Text Palette**:
  - Primary: `colors.textPrimary = '#EEF1F6'` (High contrast Inter).
  - Secondary: `colors.textSecondary = '#8B95A5'`.
  - Muted: `colors.textMuted = '#4E5A6E'`.

### Typography Grid (`src/theme.ts:125–145`)
- English: `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`.
- Hebrew (RTL): `Rubik_400Regular`, `Rubik_500Medium`, `Rubik_600SemiBold`, `Rubik_700Bold`.
- Font sizes: `xs: 11`, `sm: 13`, `md: 15`, `base: 16`, `lg: 19`, `xl: 24`, `xxl: 30`, `hero: 38`.

### Layout & Spacing
- 4pt Grid: `xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 24`, `xxl: 32`, `xxxl: 48`.
- Card Radius: `radius.md = 16`, Pill Radius: `radius.full = 9999`.
- Card Elevation: `shadow.card` (`elevation: 8` on Android, `shadowOpacity: 0.45` on iOS).

### Interaction & Feedback
- Android Tap Ripples: `ripple.surface` (`{ color: '#FFFFFF14', borderless: false }`), `ripple.borderless`.
- Haptics via `expo-haptics`:
  - Card / tab press: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`.
  - Repair action trigger: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)`.
  - Repair success completion: `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`.
- Minimum touch target: 44dp x 44dp.
- Icons: Vector icons only (`@expo/vector-icons` Ionicons); NO native raw emojis in action buttons.

---

## 4. Localization Dictionary & Versioning Analysis

### File Location: `src/utils/i18n.ts`
All app translations are split into `en` and `he` dictionaries loaded via `i18n-js`.

### App Version Locations
1. `app.json`:
   - Line 9: `"version": "1.0.1.77"`
   - Line 24: `"versionCode": 132`
2. `src/utils/i18n.ts`:
   - Line 344 (EN): `version: 'Version 1.0.1.77  ·  AMOLED Optimized (Tap version to unlock developer tools)',`
   - Line 1279 (HE): `version: 'v1.0.1.77  ·  מותאם ל-AMOLED (גע בגרסה כדי לפתוח כלי מפתחים)',`

*When applying changes, version will be incremented to `1.0.1.78` / `versionCode: 133` across all three files.*

### Required Translation Keys to Add (`src/utils/i18n.ts`)

#### English (`translations.en.profile`)
```ts
diagnosticsTitle: 'Database Diagnostics & History Repair',
diagnosticsSub: 'Inspect SQLite tables, MMKV cache, and recover workouts',
activeSessions: 'Active Workouts',
tombstonedSessions: 'Tombstoned (Deleted)',
totalDbRows: 'Total Session Rows',
mmkvCacheCount: 'MMKV Cache Count',
exerciseRecords: 'Exercise Records',
setLogRecords: 'Set Log Records',
storageHealth: 'Storage Health',
repairHistory: 'Repair Workout History',
repairHistoryDesc: 'Restore all soft-deleted / tombstoned workouts back to active history',
repairing: 'Repairing History...',
repairSuccess: 'History Repaired',
repairSuccessMsg: 'Successfully restored {{count}} workouts to your active history.',
noTombstonesFound: 'No tombstoned workouts found. Database is healthy!',
refreshStats: 'Refresh Diagnostics',
sqliteEngine: 'SQLite Relational V2',
mmkvEngine: 'MMKV Native Cache',
healthReady: 'Engine Ready',
healthSafeMode: 'Legacy Safe Mode',
healthError: 'Degraded / Error',
```

#### Hebrew (`translations.he.profile`)
```ts
diagnosticsTitle: 'אבחון מסד נתונים ותיקון היסטוריה',
diagnosticsSub: 'בדיקת טבלאות SQLite, מטמון MMKV ושחזור אימונים',
activeSessions: 'אימונים פעילים',
tombstonedSessions: 'מחוקים זמנית (מצבות)',
totalDbRows: 'סה"כ שורות אימונים',
mmkvCacheCount: 'כמות במטמון MMKV',
exerciseRecords: 'רשומות תרגילים',
setLogRecords: 'רשומות סטים',
storageHealth: 'תקינות מנוע אחסון',
repairHistory: 'שחזר ותקן היסטוריית אימונים',
repairHistoryDesc: 'שחזר את כל האימונים שנמחקו זמנית חזרה להיסטוריה הפעילה',
repairing: 'מתקן היסטוריה...',
repairSuccess: 'ההיסטוריה תוקנה',
repairSuccessMsg: 'שוחזרו בהצלחה {{count}} אימונים להיסטוריה הפעילה שלך.',
noTombstonesFound: 'לא נמצאו אימונים מחוקים זמנית. מסד הנתונים תקין!',
refreshStats: 'רענן נתוני אבחון',
sqliteEngine: 'SQLite יחסי V2',
mmkvEngine: 'מטמון מהיר MMKV',
healthReady: 'מנוע תקין ומוכן',
healthSafeMode: 'מצב בטוח (Legacy)',
healthError: 'מצב שגיאה / לקוי',
```

---

## 5. Test Harness & Regression Test Architecture

### Environment & Test Execution
- Runner: Jest 29.7 (`jest-expo`)
- Node environment: `C:\Users\NAORA\AppData\Roaming\fnm\node-versions\v22.22.3\installation`
- Run command: `$env:PATH = "C:\Users\NAORA\AppData\Roaming\fnm\node-versions\v22.22.3\installation;$env:PATH"; npm test`
- Current Status: **18 test suites passing, 150 unit tests passing, 0 failures (4.65s runtime)**.
- Typecheck: `npm run typecheck` (`tsc --noEmit`) passes with zero errors.

### Existing Test Mocks & Architecture
- Global mocks in `src/__tests__/mocks/nativeModulesMock.js`:
  - `expo-secure-store`, `expo-sqlite`, `expo-audio`, `expo-font`, `@expo/vector-icons`, `expo-linear-gradient`, `react-native-safe-area-context`, `react-native-screens`, `react-native-reanimated`, `expo-file-system/legacy`, `expo-document-picker`.
- In-memory mock database & adapter in `src/__tests__/challengerM3Adversarial.test.ts`:
  - `MockMemoryStorageAdapter` implements `SynchronousStorageAdapter` (MMKV).
  - `MockSqliteDb` implements table maps (`workout_sessions`, `session_exercises`, `set_logs`, `persistence_meta`) with transactional rollback and full SQL statement emulation.

### Recommended Regression Test Structure (`src/__tests__/historyRecoveryRegression.test.ts`)

The new test file will contain 3 focused test suites validating the safety invariants:

#### Suite 1: Sync Upload Prevention Before Full History Load (Requirement R2)
- **Invariant**: Google Drive auto-sync or manual sync must NEVER execute an upload if `isFullHistoryLoaded` is `false`.
- **Test cases**:
  1. `auto-sync debounced effect aborts and does not call googleDrive.updateBackupFile or createBackupFile when isFullHistoryLoaded === false`.
  2. `auto-sync debounced effect proceeds and calls googleDrive.updateBackupFile when isFullHistoryLoaded === true`.
  3. `handleCloudSync returns false with a warning if isFullHistoryLoaded === false, preventing partial overwrites`.

#### Suite 2: Merge-Only Restore Safety Against Stale Backups (Requirement R2)
- **Invariant**: Restoring a partial backup (e.g. 5 workouts) into a local database with 300 workouts must NEVER delete or tombstone the existing 295 local workouts.
- **Test cases**:
  1. `insertMissingSessionsOnly preserves all existing 300 sessions in SQLite with deleted_at_ms === null when receiving 5 sessions`.
  2. `insertMissingSessionsOnly inserts only net-new sessions without mutating or tombstoning non-matching IDs`.
  3. `applyBackupData with merge-only strategy guarantees local session count >= pre-restore count`.

#### Suite 3: Soft-Delete Repair Execution & Telemetry (Requirements R1 & R3)
- **Invariant**: Tombstoned sessions (`deleted_at_ms IS NOT NULL`) are accurately detected in telemetry and fully restored back to active history via `restoreAllTombstonedSessions()`.
- **Test cases**:
  1. `getDatabaseDiagnostics accurately reports active (20), tombstoned (280), and raw total (300) row counts`.
  2. `restoreAllTombstonedSessions resets deleted_at_ms = NULL, increments revision, updates updated_at_ms, and returns exact count of restored workouts (280)`.
  3. `loadAllSessions immediately returns all 300 sessions after repair execution`.
  4. `subsequent countDeletedSessions returns 0`.

---

## 6. Architectural Fixes & Component Structure for Milestones 3 & 4

### Component 1: `DeveloperDiagnosticsView.tsx` (Milestone 3)
- **Path**: `src/screens/DeveloperDiagnosticsView.tsx`
- **Structure**:
  - Header with Back button (`onBack()`).
  - Storage Engine Health Banner (shows status pill, MMKV readiness, SQLite relational engine status).
  - 2x2 Telemetry Grid using `StatCard`:
    - **Active Workouts**: `diagnostics.activeSessionsCount` (Accent Blue `#4F8EF7`, barbell icon).
    - **Tombstoned Workouts**: `diagnostics.deletedSessionsCount` (Neon Red `#F0506E` if > 0 else `#4E5A6E`, trash icon).
    - **Total DB Rows**: `diagnostics.totalSessionRows` (Sky Blue `#38BDF8`, server icon).
    - **MMKV Cache**: `diagnostics.mmkvCachedRecentCount` (Sporty Indigo `#6366F1`, flash icon).
  - Table Record Breakdown: Session Exercises count, Set Logs count.
  - **Repair Action Banner & CTA**:
    - If `deletedSessionsCount > 0`: Warning card with button **"Repair & Recover Workouts"** (`colors.accent` background, ripple, haptic).
    - On press: calls `restoreAllTombstonedSessions()`, triggers haptic success, displays alert/toast with count, and calls `onRepairComplete()`.
    - If `deletedSessionsCount === 0`: Green checkmark card stating database is fully healthy.

### Component 2: `App.tsx` & Auto-Sync Hardening (Milestone 4)
- **Path**: `src/App.tsx`
- **Fix 1 (Line 837)**: Add `isFullHistoryLoaded` guard to auto-sync effect:
  ```ts
  React.useEffect(() => {
    if (!isDataLoaded || !isFullHistoryLoaded) return;
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    if (!googleUser || !googleUser.accessToken) return;
    ...
  }, [..., isFullHistoryLoaded]);
  ```
- **Fix 2 (Line 990 & Line 1340)**: Replace `reconcileSessions` calls during Google Login sync and Backup Restore with non-destructive merge:
  ```ts
  // Instead of reconcileSessions(mergedSessions) which tombstones missing IDs:
  insertMissingSessionsOnly(mergedSessions.map((s, idx) => legacySessionToV2(s, idx)));
  ```
- **Fix 3 (Line 1220)**: Guard `handleCloudSync`:
  ```ts
  if (!isFullHistoryLoaded) {
    console.warn('[App] Skipping manual cloud sync: full history load is not yet confirmed');
    return false;
  }
  ```

---

## Conclusion & Readiness

All architectural components, UI tokens, localization keys, repository functions, and test scenarios are fully scoped with exact file paths and line numbers. The project is ready for immediate implementation of Milestones 3 & 4.
