// src/storage/keys.ts
// Centralized storage key definitions for StrongerN Zero-Loss Persistence architecture.

export const STORAGE_KEYS = {
  // Legacy KV Store & LocalStorage keys
  LEGACY_APP_DATA_V1: 'strongern_app_data_v1',
  LEGACY_ACTIVE_WORKOUT_V1: 'strongern_active_workout_state',
  LEGACY_AUTH_V1: 'strongern_auth_v1',

  // Active Workout Snapshot A/B Slots (MMKV / Durable Fallback)
  ACTIVE_DRAFT_HEAD: 'strongern_active_draft_head',
  ACTIVE_DRAFT_SLOT_A: 'strongern_active_draft_slot_a',
  ACTIVE_DRAFT_SLOT_B: 'strongern_active_draft_slot_b',
  ACTIVE_DRAFT_FINISH_JOURNAL: 'strongern_finish_journal',
  ACTIVE_DRAFT_INPUT_PATCH: 'strongern_active_input_patch',

  // Settings & Small Preferences (Hot Path)
  SETTINGS_COMPACT_V2: 'strongern_settings_v2',

  // Migration & Storage Metadata
  MIGRATION_STATE_V2: 'strongern_migration_state_v2',
  STORAGE_HEALTH_STATE: 'strongern_health_state',

  // Instant Cache (Synchronous MMKV Frame 0 Hydration)
  INSTANT_AUTH_CACHE: 'strongern_instant_auth_v1',
  INSTANT_APP_DATA_CACHE: 'strongern_instant_app_data_v1',
  INSTANT_RECENT_SESSIONS: 'strongern_instant_recent_sessions_v1',
  INSTANT_TOTAL_SESSIONS_COUNT: 'strongern_instant_total_sessions_count_v1',
  INSTANT_PROFILE_SUMMARIES: 'strongern_instant_profile_summaries_v1',
  INSTANT_LIFETIME_STATS: 'strongern_instant_lifetime_stats_v1',

  // Database Names
  LEGACY_SQLITE_DB: 'strongern.db',
  RELATIONAL_V2_DB: 'strongern_v2.db',
  LEGACY_TABLE_NAME: 'strongern_kv_store',
} as const;
