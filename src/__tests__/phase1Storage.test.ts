// src/__tests__/phase1Storage.test.ts
// Unit tests for Phase 1 storage infrastructure, MMKV adapter fallback, two-slot active draft journal, and health state.

import { mmkvStorageAdapter, initMMKVAdapter } from '../storage/adapters/mmkvAdapter';
import {
  saveActiveWorkoutDraft,
  restoreActiveWorkoutDraft,
  clearActiveWorkoutDraft,
} from '../storage/activeWorkoutSnapshot';
import { getStorageHealthState, setStorageHealthState } from '../storage/healthState';
import { ActiveWorkoutDraftV2 } from '../storage/contracts/types';
import { normalizeActiveWorkoutDraftV2, calculateChecksum } from '../storage/contracts/validators';
import { STORAGE_KEYS } from '../storage/keys';

describe('Phase 1 Storage Infrastructure & Active Draft Journal', () => {
  beforeEach(async () => {
    await initMMKVAdapter();
    await clearActiveWorkoutDraft();
  });

  describe('MMKV Adapter & Fallback', () => {
    test('initializes cleanly and supports getString / setString / removeItem', async () => {
      await mmkvStorageAdapter.setString('test_key_1', 'hello_world');
      const val = await mmkvStorageAdapter.getString('test_key_1');
      expect(val).toBe('hello_world');

      await mmkvStorageAdapter.removeItem('test_key_1');
      const removed = await mmkvStorageAdapter.getString('test_key_1');
      expect(removed).toBeNull();
    });

    test('reports status diagnostics', () => {
      const status = mmkvStorageAdapter.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(typeof status.isNativeMMKV).toBe('boolean');
    });
  });

  describe('Atomic Two-Slot Active Workout Journal (Slot A / Slot B)', () => {
    test('writes inactive slot, verifies checksum, and switches head pointer', async () => {
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

      const saved = await saveActiveWorkoutDraft(draft);
      expect(saved).toBe(true);

      const head = await mmkvStorageAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD);
      expect(head).toBe('slot_a'); // First write targets Slot A and updates head to 'slot_a'

      const restored = await restoreActiveWorkoutDraft();
      expect(restored).not.toBeNull();
      expect(restored?.workoutName).toBe('Leg Day');
      expect(restored?.exercises.length).toBe(1);
    });

    test('replaces opposite slot on second write and increments head', async () => {
      const draft1 = normalizeActiveWorkoutDraftV2({
        draftId: 'draft-1',
        workoutName: 'Rev 1',
        revision: 1,
      });
      await saveActiveWorkoutDraft(draft1);
      expect(await mmkvStorageAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD)).toBe('slot_a');

      const draft2 = normalizeActiveWorkoutDraftV2({
        draftId: 'draft-1',
        workoutName: 'Rev 2',
        revision: 2,
      });
      await saveActiveWorkoutDraft(draft2);
      expect(await mmkvStorageAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD)).toBe('slot_b');

      const restored = await restoreActiveWorkoutDraft();
      expect(restored?.workoutName).toBe('Rev 2');
      expect(restored?.revision).toBe(2);
    });

    test('recovers valid slot when head slot is corrupted', async () => {
      // Write valid revision 1 to Slot A (head = slot_a)
      const draft1 = normalizeActiveWorkoutDraftV2({
        draftId: 'draft-corrupt-test',
        workoutName: 'Valid Rev 1',
        revision: 1,
      });
      await saveActiveWorkoutDraft(draft1);

      // Write valid revision 2 to Slot B (head = slot_b)
      const draft2 = normalizeActiveWorkoutDraftV2({
        draftId: 'draft-corrupt-test',
        workoutName: 'Valid Rev 2',
        revision: 2,
      });
      await saveActiveWorkoutDraft(draft2);

      // Corrupt Slot B payload in storage
      await mmkvStorageAdapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B, 'corrupted_json_garbage');

      // Restore should recover Slot A (Valid Rev 1)
      const restored = await restoreActiveWorkoutDraft();
      expect(restored).not.toBeNull();
      expect(restored?.workoutName).toBe('Valid Rev 1');
      expect(restored?.revision).toBe(1);
    });

    test('clears active draft slots and head pointer on clearActiveWorkoutDraft', async () => {
      const draft = normalizeActiveWorkoutDraftV2({
        draftId: 'draft-clear-test',
        workoutName: 'To Clear',
      });
      await saveActiveWorkoutDraft(draft);

      await clearActiveWorkoutDraft();

      const restored = await restoreActiveWorkoutDraft();
      expect(restored).toBeNull();
      expect(await mmkvStorageAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD)).toBeNull();
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
