# Project: StrongerN Performance & Cold Start Optimization

## Architecture
StrongerN is an offline-first, AMOLED React Native / Expo workout tracker.
- **Storage Tier 1 (Hot Path / In-Flight)**: MMKV (`strongern-hot-path`) for active workout snapshots (Slot A/B journaling with checksum and monotonic sequence) and compact settings (`strongern_settings_v2`).
- **Storage Tier 2 (Relational Database)**: SQLite `strongern_v2.db` with WAL mode, foreign keys, and normalized schema (`persistence_meta`, `workout_sessions`, `session_exercises`, `set_logs`) with multi-column indices for high-speed indexing and incremental delta writes.
- **Storage Tier 3 (Legacy & Web Fallback)**: SQLite `strongern.db` KV store (`strongern_kv_store`) and `window.localStorage` for web compatibility and one-time migration of legacy user records.

```
Cold Start Flow (Optimized):
[App Launch]
    │
    ├── [1] Load Compact Settings (MMKV / strongern_settings_v2) ──── < 2ms
    ├── [2] Restore In-Flight Active Draft (MMKV Slot A/B) ────────── < 2ms
    ├── [3] Initialize SQLite v2 Singleton (WAL + Pragmas) ─────────── < 15ms
    ├── [4] Fast-Path Hydration from SQLite v2 (300+ sessions) ──────── < 60ms
    │       (Bypass monolithic JSON.parse & redundant checksumming)
    └── [5] Root State Ready ──────────────────────────────────────── Total < 100ms (Target < 150ms)
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Automated Benchmarking Suite | `scripts/benchmark-startup.js` simulating 0, 50, 300+ workouts measuring storage, SQLite query, heap delta, and startup time | M1 | Survey (Explorer 3) |
| 2 | Baseline Performance Measurement | Capture pre-optimization baseline metrics across 0, 50, 300+ sessions | M1 | Survey (Explorer 3) |
| 3 | Fast-Path Database Hydration | Streamline `bootstrapPersistence` and `loadAllSessions` to bypass monolithic legacy JSON stringify/parse cycles | M2 | Survey (Explorer 1) |
| 4 | Query & Index Optimization | Ensure optimized indexes and batch query hydration for `workout_sessions`, `session_exercises`, `set_logs` (<150ms for 300+ sessions) | M2 | Survey (Explorer 1 & 3) |
| 5 | Compact Settings Partitioning | Decouple 35+ settings/toggles into MMKV compact store (`strongern_settings_v2`) | M3 | Survey (Explorer 2) |
| 6 | Eliminate Monolithic Root Save | Remove full `sessionsList` serialization from `App.tsx` state update effect | M3 | Survey (Explorer 2) |
| 7 | Incremental Delta Session Writes | Replace destructive 8,700-query `reconcileSessions` loop with single-session `upsertSession` & `softDeleteSession` | M3 | Survey (Explorer 2 & 3) |
| 8 | Active Draft Isolation | Keep active workout drafts strictly on MMKV A/B slots without secondary SQLite KV thrashing | M3 | Survey (Explorer 2) |
| 9 | Regression & Type Safety Verification | Verify `npm run typecheck` (0 errors) and `npm test` (100% pass) | M4 | Survey (Explorer 1, 2, 3) |
| 10 | Post-Optimization Benchmark Validation | Validate cold start data hydration <150ms for 300+ workouts | M4 | Survey (Explorer 3) |
| 11 | Version Bump & Release APK | Bump version in `app.json` & `src/utils/i18n.ts`, update graphify, compile release APK via `build-apk.bat --auto`, commit & push to master | M4 | Project Rules |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Benchmarking Suite (R3) | Implement `scripts/benchmark-startup.js` and record baseline cold-start metrics for 0, 50, 300+ sessions | None | DONE |
| M2 | Cold Start & SQLite Hydration (R1) | Optimize `persistenceBootstrap.ts`, query batching, fast-path bypass of monolithic legacy JSON parsing, and sub-150ms 300+ session hydration | M1 | DONE |
| M3 | State Save Decoupling & Delta Writes (R2) | Decouple settings into MMKV `strongern_settings_v2`, eliminate monolithic `sessionsList` JSON stringify in `App.tsx`, remove full `reconcileSessions` thrashing, enforce incremental delta writes | M2 | DONE |
| M4 | Comprehensive Verification, APK & Master Push (R4) | Run full test suite, typechecks, benchmark verification, app version bump, graphify update, release APK build, and git push to master | M3 | IN_PROGRESS |

## Interface Contracts
### Compact Settings Store (`src/storage/adapters/mmkvAdapter.ts` & `src/storage/keys.ts`)
- Key: `SETTINGS_COMPACT_V2` (`'strongern_settings_v2'`)
- API:
  - `saveCompactSettings(settings: Partial<AppSettings>): void`
  - `loadCompactSettings(): AppSettings | null`

### Relational History Repository (`src/storage/history/repository.ts`)
- Single Session Upsert: `upsertSession(session: WorkoutSessionV2): Promise<void>`
- Single Session Delete: `softDeleteSession(sessionId: string): Promise<void>`
- Bulk Import (Explicit CSV / Cloud Restore only): `bulkImportSessions(sessions: WorkoutSessionV2[]): Promise<void>`
- Fast Hydration: `loadAllSessions(): Promise<WorkoutSessionV2[]>`

### Persistence Bootstrap (`src/storage/persistenceBootstrap.ts`)
- `bootstrapPersistence(legacyData, legacyActiveWorkout)`: Fast-path bypass when `strongern_v2.db` is initialized and verified. Return `{ sessions: WorkoutSessionV2[], activeWorkout, settings }`.

## Code Layout
- `src/App.tsx`: Root component, bootstrap lifecycle, UI state, decoupled settings and session handlers.
- `src/storage/persistenceBootstrap.ts`: Fast-path persistence bootstrapping and migration verification.
- `src/storage/history/`: Relational SQLite V2 schema, repository, queries, and migrations.
- `src/storage/adapters/`: MMKV and localStorage adapters.
- `src/utils/db.ts`: Legacy KV store utilities and backward compatibility layer.
- `scripts/benchmark-startup.js`: Node 22 native SQLite startup and hydration benchmark script.
