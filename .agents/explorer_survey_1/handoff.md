# Handoff Report — Explorer 1 (Storage & Hydration Layer Survey)

## 1. Observation
- **App Entry Point & Boot Lifecycle**:
  - `src/App.tsx:384-518`: `loadData()` calls `initDb()`, `getSecureItem('theme_overrides')`, `loadFromDb('strongern_app_data_v1')`, `loadFromDb('strongern_active_workout_state')`, and `bootstrapPersistence(parsed, legacyActiveWorkout)`.
  - `src/utils/db.ts:71-102`: `loadFromDb(key)` executes `SELECT value FROM strongern_kv_store WHERE key = ?;` and performs synchronous `JSON.parse(row.value)` on the entire monolithic legacy state.
- **Bootstrap & Migration Pipeline**:
  - `src/storage/persistenceBootstrap.ts:31-33`: `fingerprintLegacySessions` executes `calculateChecksum(JSON.stringify(sessions, ...))` on the 300+ session array.
  - `src/storage/persistenceBootstrap.ts:35-42, 87`: Unconditionally calls `sessions = await loadAllSessions();` even when the migration is already verified (`previousFingerprint === sourceFingerprint`).
  - `src/storage/history/repository.ts:147-209`: `listSessions()` executes 3 queries per page across `workout_sessions`, `session_exercises`, and `set_logs`, and constructs in-memory Map indexes (`setsByExercise`, `exercisesBySession`).
- **State Save & Reconciliation Thrashing**:
  - `src/App.tsx:545-602`: The root `useEffect` listens to 35+ state variables and debounces `saveToDb(STORAGE_KEY, data)` by 400ms, serializing all 300+ workouts into `strongern_kv_store` whenever any setting changes.
  - `src/App.tsx:605-621`: A second `useEffect` listens to `sessionsList` and debounces `reconcileSessions(normalized)` by 250ms, issuing bulk SQLite transactions across all sessions.
- **Active Workout Draft Storage**:
  - `src/storage/adapters/mmkvAdapter.ts:62-104`: Initializes MMKV v4 (`strongern-hot-path`).
  - `src/storage/activeWorkoutSnapshot.ts:86-199`: Implements two-slot A/B journaling with monotonic sequence increments, checksum verification, and head pointer updates.
- **Verification Baseline**:
  - `npm test`: 12 test suites, 94 tests passed cleanly in 9.57s.
  - `npm run typecheck` (`tsc --noEmit`): 0 TypeScript errors.

---

## 2. Logic Chain
1. **Observation**: On cold start (`App.tsx:398`), `loadFromDb('strongern_app_data_v1')` reads the multi-megabyte string from `strongern_kv_store` and executes `JSON.parse`.
   **Inference**: For 300+ workouts, synchronously deserializing 1–5MB of JSON on the JS thread blocks UI rendering for 100–300ms.
2. **Observation**: `bootstrapPersistence` (`persistenceBootstrap.ts:31-33`) immediately runs `JSON.stringify(sessions)` and `calculateChecksum()` on the parsed sessions.
   **Inference**: This causes redundant serialization and CPU character hashing immediately after deserialization.
3. **Observation**: `bootstrapPersistence` (`persistenceBootstrap.ts:87`) calls `loadAllSessions()`, which queries `workout_sessions`, `session_exercises`, and `set_logs` in pages of 250.
   **Inference**: 300 sessions generate >7,500 rows across 3 tables, mapping and reconstructing in-memory JS Maps synchronously during startup.
4. **Observation**: `App.tsx:416` converts these 300 objects back to legacy format (`sessions.map(sessionV2ToLegacy)`) and sets React root state.
   **Inference**: Storing 300 full workout trees in React state triggers extensive memory allocation and re-renders across all tabs.
5. **Observation**: `App.tsx:545-602` debounces `saveToDb(STORAGE_KEY, data)` on every setting change, bundling all 300 sessions into a monolithic payload.
   **Inference**: Monolithic state save creates persistent JS thread lag and dual-write thrashing during normal app interactions.

---

## 3. Caveats
- Storage performance on low-end physical Android hardware may exhibit higher I/O latencies compared to development workstations.
- Web environment uses `localStorage` fallback where synchronous SQLite is unavailable; any optimization must maintain web compatibility.
- Backward compatibility with legacy backups (`src/utils/backupManager.ts`) and CSV imports (`src/utils/csvImporter.ts`) must be preserved.

---

## 4. Conclusion
Cold start with 300+ workouts is severely bottlenecked by dual monolithic/relational deserialization, redundant stringify-checksum fingerprinting, and synchronous full-table relational reconstruction.
**Key Actionable Recommendations**:
1. Decouple settings and user state into a lightweight compact key (`strongern_settings_v2`), eliminating monolithic JSON parsing of workout history on boot.
2. Bypass legacy session loading and checksumming once relational SQLite V2 is initialized and verified.
3. Implement windowed hydration (loading only the latest 20–30 sessions on boot) with SQLite aggregate queries for profile statistics.
4. Eliminate full-history stringification on settings updates and decouple active workout draft persistence.

---

## 5. Verification Method
1. **TypeScript Typecheck**:
   ```powershell
   $env:PATH = "C:\Users\NAORA\AppData\Roaming\fnm\node-versions\v22.22.3\installation;$env:PATH"; npm run typecheck
   ```
2. **Unit Tests**:
   ```powershell
   $env:PATH = "C:\Users\NAORA\AppData\Roaming\fnm\node-versions\v22.22.3\installation;$env:PATH"; npm test
   ```
3. **File Inspection**:
   - `C:\Antigravity\strongerN\.agents\explorer_survey_1\survey_report.md`
   - `C:\Antigravity\strongerN\src\storage\persistenceBootstrap.ts`
   - `C:\Antigravity\strongerN\src\App.tsx` (lines 384–621)
