# Project: StrongerN Workout History Recovery & Sync Hardening

## Architecture
- **Storage Layer**:
  - `src/storage/dbSingleton.ts`: Native SQLite database connection (`strongern_v2.db`) with WAL mode, foreign keys, and busy timeout.
  - `src/storage/history/schema.ts`: Relational schema (`workout_sessions`, `session_exercises`, `set_logs`) with `deleted_at_ms`.
  - `src/storage/history/repository.ts`: SQLite transaction repository for session loading, querying, upserting, soft-deleting, untombstoning, and diagnostics.
  - `src/storage/instantCache.ts`: Synchronous MMKV cache for Frame 0 instant UI hydration (capped at 20 preview sessions).
  - `src/storage/persistenceBootstrap.ts`: Fastpath migration and startup orchestration with automatic tombstone recovery.
- **Application State & Sync Layer**:
  - `src/App.tsx`: Top-level state (`sessionsList`, `isDataLoaded`, `isFullHistoryLoaded`), Google Drive auto-sync effect (gated), Google Drive manual sync (`handleCloudSync`), backup export/import (`handleExportBackup`, `applyBackupData`), and error handling (`loadData`).
  - `src/services/googleDrive.ts`: Google Drive REST API integration.
  - `src/utils/crashLogger.ts`: SQLite & FileSystem persistent crash and error logger.
- **Presentation Layer**:
  - `src/screens/ProfileScreen.tsx`: Profile & settings screen with Developer Options routing to diagnostics.
  - `src/components/DeveloperDiagnosticsView.tsx`: Developer diagnostic & repair panel displaying live SQLite and MMKV stats and 1-tap repair action.
  - `src/theme.ts`: AMOLED dark design system tokens (`colors.bg = #0D0F14`, `colors.surface = #161B24`, `colors.accent = #4F8EF7`).
  - `src/utils/i18n.ts`: English and Hebrew localization dictionaries.

## Code Layout
- `src/storage/history/repository.ts` — SQLite session CRUD, diagnostic counting, and untombstoning
- `src/storage/persistenceBootstrap.ts` — Startup bootstrap & self-healing
- `src/App.tsx` — History hydration, cloud sync gating, safe backup restore, and error telemetry
- `src/components/DeveloperDiagnosticsView.tsx` — Diagnostic & repair UI component
- `src/screens/ProfileScreen.tsx` — Settings view routing for diagnostics panel
- `src/utils/i18n.ts` — Translation strings for diagnostics and versioning
- `app.json` — App version bump (`1.0.1.78`, `versionCode: 133`)
- `src/__tests__/historyRecoveryRegression.test.ts` — Automated regression test suite

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | SQLite Diagnostics & Untombstone API | Add `countTombstonedSessions()`, `restoreAllTombstonedSessions()`, and `getDatabaseDiagnostics()` to repository | M1 | Survey (E1, E2, E3) [DONE] |
| 2 | Safe Merge-Only Import | Enhance `insertMissingSessionsOnly()` to restore tombstoned sessions if imported actively | M1 | Survey (E1, E2) [DONE] |
| 3 | Startup Self-Healing | Automatically detect and restore tombstoned sessions during `bootstrapPersistence` | M1 | Survey (E1, E2) [DONE] |
| 4 | Un-gated Error Telemetry | Log persistence and hydration failures to `console.error` and `saveCrashLogSync` | M1 | Survey (E1) [DONE] |
| 5 | Cloud Auto-Sync Gating | Block Google Drive auto-sync uploads until `isFullHistoryLoaded` is true | M2 | Survey (E1, E2) [DONE] |
| 6 | Cloud Manual Sync & Export Gating | Block or warn on manual sync/export if full history is not yet loaded | M2 | Survey (E2) [DONE] |
| 7 | Safe Restore Replacement | Replace destructive `reconcileSessions` with `insertMissingSessionsOnly` in `applyBackupData` and `handleGoogleLogin` | M2 | Survey (E1, E2) [DONE] |
| 8 | Developer Diagnostic Panel | Implement `<DeveloperDiagnosticsView>` showing SQLite active/tombstoned/raw rows and MMKV cache count | M3 | Survey (E3) |
| 9 | 1-Tap Workout History Repair | Add interactive repair action in UI to untombstone sessions, rehydrate state, and update cache | M3 | Survey (E1, E3) |
| 10 | AMOLED UI/UX & i18n | Style diagnostic UI with AMOLED dark tokens and add EN/HE translations in `i18n.ts` | M3 | Survey (E3) |
| 11 | Automated Regression Suite | Regression tests for sync gating, safe restore, and untombstoning repair in `historyRecoveryRegression.test.ts` | M4 | Survey (E3) |
| 12 | Version Bump & Release APK | Bump version to `1.0.1.78` (code 133), update graphify, run typecheck, test suite, and build release APK via `build-apk.bat --auto` | M4 | Survey (E3) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | History Load & Recovery Engine | Implement repository recovery functions (`countTombstonedSessions`, `restoreAllTombstonedSessions`, `getDatabaseDiagnostics`), enhance `insertMissingSessionsOnly`, un-gate error logging, and add bootstrap self-healing | none | DONE |
| 2 | Cloud Sync & Reconcile Hardening | Gate auto-sync, manual sync, and backup export with `isFullHistoryLoaded`. Replace `reconcileSessions` with `insertMissingSessionsOnly` in `handleGoogleLogin` and `applyBackupData` | M1 | DONE |
| 3 | Diagnostic & Repair UI Panel | Create `DeveloperDiagnosticsView.tsx`, wire into `ProfileScreen.tsx`, implement 1-tap repair, apply AMOLED design tokens, and add i18n strings | M1 | IN_PROGRESS |
| 4 | Regression Testing & Release Verification | Add `historyRecoveryRegression.test.ts`, increment version, run graphify update, verify typecheck & tests, build standalone APK, and commit to master | M1, M2, M3 | PLANNED |

## Interface Contracts
### `src/storage/history/repository.ts` ↔ Application & UI
```ts
export interface DatabaseDiagnostics {
  isReady: boolean;
  activeSessionsCount: number;
  tombstonedSessionsCount: number;
  rawTotalSessionsCount: number;
  cachedRecentCount: number;
  cachedTotalCount: number;
}

export function countTombstonedSessions(): Promise<number>;
export function restoreAllTombstonedSessions(): Promise<number>;
export function getDatabaseDiagnostics(): Promise<DatabaseDiagnostics>;
export function insertMissingSessionsOnly(sessions: WorkoutSessionV2[]): Promise<void>;
```

### `src/components/DeveloperDiagnosticsView.tsx` ↔ `src/screens/ProfileScreen.tsx`
```ts
interface DeveloperDiagnosticsViewProps {
  onBack: () => void;
  onRefreshSessions?: () => Promise<void> | void;
  isHebrew?: boolean;
}
```
