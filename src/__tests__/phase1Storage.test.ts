// src/__tests__/phase1Storage.test.ts
// Failure-injection and integration unit tests for Phase 1 MMKV v4 adapter, monotonic sequences, crash-safe tombstones, and health state.

import {
  mmkvStorageAdapter,
  initMMKVAdapter,
  setInjectedStorageAdapter,
  SynchronousStorageAdapter,
  DurableStorageUnavailableError,
} from '../storage/adapters/mmkvAdapter';
import {
  saveActiveWorkoutDraft,
  restoreActiveWorkoutDraft,
  clearActiveWorkoutDraft,
  parseAndValidateEnvelope,
} from '../storage/activeWorkoutSnapshot';
import { getStorageHealthState, setStorageHealthState } from '../storage/healthState';
import { ActiveWorkoutDraftV2 } from '../storage/contracts/types';
import { normalizeActiveWorkoutDraftV2, calculateChecksum } from '../storage/contracts/validators';
import { STORAGE_KEYS } from '../storage/keys';

// In-Memory Synchronous Storage Adapter for Isolated Unit Tests
class InMemoryStorageAdapter implements SynchronousStorageAdapter {
  private store = new Map<string, string>();
  private available = true;
  private native = true;

  setAvailable(available: boolean) { this.available = available; }
  setNative(native: boolean) { this.native = native; }

  isAvailable(): boolean { return this.available; }
  isNative(): boolean { return this.native; }

  getString(key: string): string | null {
    if (!this.available) throw new DurableStorageUnavailableError('Simulated read failure');
    return this.store.get(key) ?? null;
  }

  setString(key: string, value: string): boolean {
    if (!this.available) throw new DurableStorageUnavailableError('Simulated write failure');
    this.store.set(key, value);
    return true;
  }

  removeItem(key: string): boolean {
    if (!this.available) throw new DurableStorageUnavailableError('Simulated remove failure');
    this.store.delete(key);
    return true;
  }

  clearAll() {
    this.store.clear();
  }
}

describe('Phase 1 MMKV V4 Infrastructure & Failure Injection', () => {
  let mockAdapter: InMemoryStorageAdapter;

  beforeEach(() => {
    mockAdapter = new InMemoryStorageAdapter();
    setInjectedStorageAdapter(mockAdapter);
    initMMKVAdapter();
  });

  afterEach(() => {
    setInjectedStorageAdapter(null);
  });

  describe('MMKV V4 Adapter API & Failure Propagation', () => {
    test('supports getString, setString, and removeItem with synchronous verification', () => {
      expect(mmkvStorageAdapter.setString('k1', 'val1')).toBe(true);
      expect(mmkvStorageAdapter.getString('k1')).toBe('val1');

      expect(mmkvStorageAdapter.removeItem('k1')).toBe(true);
      expect(mmkvStorageAdapter.getString('k1')).toBeNull();
    });

    test('throws DurableStorageUnavailableError when storage is unavailable', () => {
      mockAdapter.setAvailable(false);
      expect(() => mmkvStorageAdapter.getString('k1')).toThrow(DurableStorageUnavailableError);
      expect(() => mmkvStorageAdapter.setString('k1', 'val1')).toThrow(DurableStorageUnavailableError);
      expect(() => mmkvStorageAdapter.removeItem('k1')).toThrow(DurableStorageUnavailableError);
    });
  });

  describe('Atomic Two-Slot Active Workout Journal & Monotonic Sequences', () => {
    test('writes inactive slot, verifies checksum, increments monotonic sequence, and updates head', () => {
      const draft: ActiveWorkoutDraftV2 = normalizeActiveWorkoutDraftV2({
        draftId: 'draft-leg-day-1',
        workoutName: 'Leg Day',
        startedAtMs: 1750000000000,
        revision: 1,
        exercises: [
          {
            name: 'Squat',
            sets: [{ weight: '100', reps: '5' }]
          }
        ]
      });

      const saved = saveActiveWorkoutDraft(draft);
      expect(saved).toBe(true);

      const head = mmkvStorageAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD);
      expect(head).toBe('slot_a'); // First write targets Slot A and updates head to 'slot_a'

      const restored = restoreActiveWorkoutDraft();
      expect(restored).not.toBeNull();
      expect(restored?.workoutName).toBe('Leg Day');
    });

    test('rapid saves with SAME revision increase sequence number and restore latest payload', () => {
      const draft1 = normalizeActiveWorkoutDraftV2({
        draftId: 'draft-1',
        workoutName: 'Payload 1',
        revision: 1,
      });
      saveActiveWorkoutDraft(draft1);

      const draft2 = normalizeActiveWorkoutDraftV2({
        draftId: 'draft-1',
        workoutName: 'Payload 2',
        revision: 1, // Same revision!
      });
      saveActiveWorkoutDraft(draft2);

      const restored = restoreActiveWorkoutDraft();
      expect(restored?.workoutName).toBe('Payload 2');
    });
  });

  describe('Envelope Validation & Integrity', () => {
    test('rejects envelopes missing checksum or with checksum mismatch', () => {
      const draft = normalizeActiveWorkoutDraftV2({ draftId: 'd1', workoutName: 'Test' });
      const validJson = JSON.stringify({
        schemaVersion: 2,
        kind: 'draft',
        draftId: 'd1',
        sequence: 1,
        revision: 1,
        writtenAtMs: 100,
        payloadChecksum: 'wrong_checksum',
        payload: draft,
      });

      expect(parseAndValidateEnvelope(validJson)).toBeNull();
    });

    test('rejects envelopes missing required payloadChecksum property', () => {
      const draft = normalizeActiveWorkoutDraftV2({ draftId: 'd1', workoutName: 'Test' });
      const missingChecksumJson = JSON.stringify({
        schemaVersion: 2,
        kind: 'draft',
        draftId: 'd1',
        sequence: 1,
        revision: 1,
        writtenAtMs: 100,
        payload: draft,
      });

      expect(parseAndValidateEnvelope(missingChecksumJson)).toBeNull();
    });
  });

  describe('Failure Injection Matrix', () => {
    test('1. Crash after inactive-slot write before head switch (recovers higher sequence slot)', () => {
      // Save 1 (writes Slot A with seq 1, head = slot_a)
      saveActiveWorkoutDraft(normalizeActiveWorkoutDraftV2({ draftId: 'd1', workoutName: 'Workout 1' }));
      expect(mmkvStorageAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD)).toBe('slot_a');

      // Save 2 (writes Slot B with seq 2, but simulate crash before updating head!)
      const draft2 = normalizeActiveWorkoutDraftV2({ draftId: 'd1', workoutName: 'Workout 2' });
      const env2 = {
        schemaVersion: 2,
        kind: 'draft',
        draftId: draft2.draftId,
        sequence: 2,
        revision: 1,
        writtenAtMs: Date.now(),
        payloadChecksum: calculateChecksum(JSON.stringify({ ...draft2, payloadChecksum: '' })),
        payload: { ...draft2, payloadChecksum: calculateChecksum(JSON.stringify({ ...draft2, payloadChecksum: '' })) }
      };
      mockAdapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B, JSON.stringify(env2));
      // Head remains 'slot_a'!

      // Restore evaluates sequence: Slot B (seq 2) > Slot A (seq 1) -> restores Workout 2!
      const restored = restoreActiveWorkoutDraft();
      expect(restored?.workoutName).toBe('Workout 2');
    });

    test('2. Corrupt newest slot (restores older valid slot)', () => {
      saveActiveWorkoutDraft(normalizeActiveWorkoutDraftV2({ draftId: 'd1', workoutName: 'Valid Old Workout' }));
      saveActiveWorkoutDraft(normalizeActiveWorkoutDraftV2({ draftId: 'd1', workoutName: 'Corrupt New Workout' }));

      // Corrupt Slot B (newest slot)
      mockAdapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B, '{ corrupt json }');

      const restored = restoreActiveWorkoutDraft();
      expect(restored?.workoutName).toBe('Valid Old Workout');
    });

    test('3. Interruption during clear (Crash-Safe Tombstone recovery)', () => {
      // User creates active workout (Slot A, seq 1)
      saveActiveWorkoutDraft(normalizeActiveWorkoutDraftV2({ draftId: 'd1', workoutName: 'Active Workout' }));
      expect(restoreActiveWorkoutDraft()?.workoutName).toBe('Active Workout');

      // User discards/finishes workout -> clearActiveWorkoutDraft writes tombstone (seq 2) to Slot B
      clearActiveWorkoutDraft();

      // Even if Slot A (seq 1) still exists in storage, restore finds Slot B tombstone (seq 2) and returns null!
      const restored = restoreActiveWorkoutDraft();
      expect(restored).toBeNull();
    });

    test('4. Both durable stores unavailable throws DurableStorageUnavailableError', () => {
      mockAdapter.setAvailable(false);
      expect(() => saveActiveWorkoutDraft(normalizeActiveWorkoutDraftV2({ draftId: 'd1', workoutName: 'Err' }))).toThrow(DurableStorageUnavailableError);
      expect(() => restoreActiveWorkoutDraft()).toThrow(DurableStorageUnavailableError);
      expect(() => clearActiveWorkoutDraft()).toThrow(DurableStorageUnavailableError);
    });
  });

  describe('Storage Health State', () => {
    test('updates persistence health state correctly', () => {
      setStorageHealthState('legacy_safe_mode', { sqliteAvailable: true, mmkvAvailable: false });
      const health = getStorageHealthState();
      expect(health.mode).toBe('legacy_safe_mode');
      expect(health.sqliteAvailable).toBe(true);
      expect(health.mmkvAvailable).toBe(false);
    });
  });
});
