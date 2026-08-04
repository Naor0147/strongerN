# Postmortem Analysis: Failed Persistence Refactor (Commits b9ab09e .. 44ca7a1)

## Overview
Commits `b9ab09e` through `44ca7a1` (versions `v1.0.1.63` through `v1.0.1.75`) attempted to implement MMKV storage, relational SQLite history, and Zustand store decomposition. The changes were reverted due to severe runtime defects including Android black screens, data loss, auth fallback to guest mode, and unmigrated history.

## Discovered Failure Modes

### 1. Module-Scope Native MMKV Startup Crashes
- **Symptom**: Black screen locks on Android launch.
- **Root Cause**: `new MMKV()` was invoked at top-level module evaluation scope before native binary autolinking and Nitro JSI bindings finished initializing.
- **Preventative Invariant**: MMKV is initialized lazily inside a guarded adapter (`src/storage/adapters/mmkvAdapter.ts`).

### 2. Silent Volatile In-Memory Fallback
- **Symptom**: User data disappeared after app restart.
- **Root Cause**: When MMKV initialization failed on native, code fell back to an in-memory `Map` while reporting `success: true`.
- **Preventative Invariant**: Failed MMKV initialization falls back directly to durable SQLite KV storage (`strongern_kv_store`), never to volatile memory.

### 3. Hydration Race & Store Defaults Overwriting Legacy Data
- **Symptom**: Existing user history was wiped or reset to default state.
- **Root Cause**: Default-initialized Zustand stores began auto-persisting empty state to disk before migration had discovered or imported legacy data.
- **Preventative Invariant**: Write barrier blocks store serialization until migration verification is complete.

### 4. Coupling Auth State to Data Migration
- **Symptom**: Logged-in users were logged out and marked as guest users.
- **Root Cause**: Onboarding/auth checks were executed after or inside data migration; any migration error reset auth to default guest state.
- **Preventative Invariant**: `loadAuthState()` is executed independently first. Migration never modifies authentication state.

### 5. Uncoordinated Multiple SQLite Connections
- **Symptom**: Locked database files, incomplete session lists, and history discovery failures.
- **Root Cause**: Multiple modules opened separate `SQLite.openDatabaseAsync` instances without shared WAL mode or transaction locking.
- **Preventative Invariant**: Single singleton database connection manager owning database lifecycle and migrations.

### 6. Ambiguous Cloud Sync Precedence
- **Symptom**: Stale cloud data restored over newer local data.
- **Root Cause**: Cloud sync lacked deterministic revision checksum comparison between local V1/V2 and cloud payloads.
- **Preventative Invariant**: Cloud restore validates manifest checksums and revision timestamps before overwriting local data.
