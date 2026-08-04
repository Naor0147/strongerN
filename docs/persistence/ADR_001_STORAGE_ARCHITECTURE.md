# ADR 001: Zero-Loss Persistence & React State Storage Architecture

## Context & Motivation
StrongerN v1.0.1.61 currently persists data as two single monolithic JSON blobs (`strongern_app_data_v1` and `strongern_active_workout_state`) in an SQLite key-value table (`strongern_kv_store` in `strongern.db`) or browser `localStorage`.
This monolithic design has several drawbacks:
- Keystrokes during an active workout trigger JSON serializations of the entire state tree.
- App state background changes trigger un-awaited asynchronous DB flushes.
- Large workout history causes slow startup times and memory bloat.

Previous attempts (commits `b9ab09e` through `44ca7a1`) attempted to refactor this architecture but failed due to module-scope MMKV startup crashes, volatile in-memory fallbacks, hydration race conditions, auth state resetting, and competing database handles.

## Architecture Decisions

### 1. Layered Storage System
- **Hot Path Layer**: `react-native-mmkv` with lazy initialization via a guarded bootstrap adapter (`src/storage/adapters/mmkvAdapter.ts`). Holds the active workout draft snapshot (Slot A / Slot B envelope) and small settings.
- **Durable Relational Layer**: `expo-sqlite` database (`strongern_v2.db`) in WAL mode, `foreign_keys=ON`, `busy_timeout=5000`. Serves as canonical relational storage for completed session history, exercises, templates, tombstones, and migration metadata.
- **Fallback / Legacy Layer**: `strongern_kv_store` in `strongern.db`. If MMKV native module fails to load, systems automatically fall back to `strongern_kv_store`, never to volatile memory.

### 2. State & Persistence Guarantees
- **Write-First / Dual-Boundary**: No acknowledged workout mutation exists only in React memory. Mutations persist to the storage layer before publishing to Zustand UI state.
- **Hydration Write Barrier**: Stores are locked against write-back to storage until migration discovery, validation, and store hydration complete cleanly.
- **Atomic Finish Flow**: Finishing a workout is idempotent and journaled via `FinishJournal`. Sessions, exercises, and sets are transactionally committed to SQLite before the active draft is cleared.
- **Deterministic Migration**: Identical source inputs produce byte-identical IDs, checksums, and records. Migration never deletes legacy V1 data.

### 3. Expected Values Engine
- Resolves expected weight/reps from the single most recent completed historical session for exact exercise + variation.
- Does not mix fields across different sets or sessions.
- Default for exercises without history is numeric `0/0` (no 60kg / 10 reps fallbacks).
