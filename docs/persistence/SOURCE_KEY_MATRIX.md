# Source & Storage Key Matrix

## Key Inventory & Data Ownership

| Key / Location | Storage Provider | Precedence | Data Ownership | Content Schema | Retention & Dual-Write Policy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `strongern_app_data_v1` | `strongern.db` (`strongern_kv_store`) / `localStorage` | Source of truth for V1 users; compatibility projection for V2 dual-write. | Root App state (`App.tsx`) | JSON blob: `user`, `sessionsList`, `templatesList`, `exercisesList`, `primaryMetricsList`, `bodyPartMetricsList`, settings toggles, sound settings, theme. | Preserved indefinitely during rollout. Written by dual-write projection after V2 domain commits. |
| `strongern_active_workout_state` | `strongern.db` (`strongern_kv_store`) / `localStorage` | Hot draft backup for V1; compatibility projection for V2. | `ActiveWorkoutModal` / `useActiveWorkoutStore` | JSON blob: `isWorkoutActive`, `workoutName`, `startTime`, `comment`, `isWorkoutModalVisible`, `workoutExercises`. | Dual-written during active workout; cleared only on finish/discard. |
| `strongern_auth_v1` | `strongern.db` (`strongern_kv_store`) / `localStorage` | Independent authentication state | `authStore.ts` | JSON blob: `hasCompletedOnboarding`, `authMode` (`guest` \| `local` \| `google`), `localUsername`, `googleProfile`. | Fully isolated from data migration; never modified by migration errors. |
| `google_oauth_token` | `SecureStore` (Keychain / KeyStore) | Auth credentials | `authStore.ts` / `googleDrive.ts` | Encrypted string token. | Loaded at runtime for Google Drive sync. |
| `theme_overrides` | `SecureStore` (Keychain / KeyStore) | Theme customization | `theme.ts` | JSON string of color overrides. | Loaded at startup. |
| `strongern_active_draft_v2_slot_a` / `slot_b` | MMKV / SQLite Fallback | Primary V2 Hot Path | `useActiveWorkoutStore` | `ActiveWorkoutDraftV2` envelope (slot A/B dual slot). | Hot path active workout draft. |
| `strongern_v2.db` | SQLite (`strongern_v2.db`) | Primary V2 History & Relational Data | `src/storage/repositories/` | Relational tables: `workout_sessions`, `session_exercises`, `set_logs`, `schema_migrations`, `migration_items`, `sync_tombstones`. | Canonical relational database for completed sessions and exercises. |
| `strongern_backup.json` | Google Drive API (v3) | Remote Backup | `googleDrive.ts` | Backup manifest (`BackupManifestV3` or legacy v1/v2 format). | Remote cloud sync file; preserved with exact filename `strongern_backup.json`. |
