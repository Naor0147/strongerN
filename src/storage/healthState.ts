// src/storage/healthState.ts
// Storage health state tracking and diagnostic mode definitions.

export type PersistenceHealthMode =
  | 'booting'
  | 'ready'
  | 'legacy_safe_mode'
  | 'migration_required'
  | 'migration_failed_readonly';

export interface StorageHealthState {
  mode: PersistenceHealthMode;
  mmkvAvailable: boolean;
  sqliteAvailable: boolean;
  lastError: string | null;
  timestampMs: number;
}

let currentHealth: StorageHealthState = {
  mode: 'booting',
  mmkvAvailable: false,
  sqliteAvailable: false,
  lastError: null,
  timestampMs: Date.now(),
};

export function getStorageHealthState(): StorageHealthState {
  return { ...currentHealth };
}

export function setStorageHealthState(
  mode: PersistenceHealthMode,
  details?: Partial<Omit<StorageHealthState, 'mode' | 'timestampMs'>>
): void {
  currentHealth = {
    ...currentHealth,
    mode,
    mmkvAvailable: details?.mmkvAvailable ?? currentHealth.mmkvAvailable,
    sqliteAvailable: details?.sqliteAvailable ?? currentHealth.sqliteAvailable,
    lastError: details?.lastError ?? currentHealth.lastError,
    timestampMs: Date.now(),
  };
  console.log(`[StorageHealth] State changed to: ${mode}`, currentHealth);
}
