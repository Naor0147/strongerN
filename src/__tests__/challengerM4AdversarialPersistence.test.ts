// src/__tests__/challengerM4AdversarialPersistence.test.ts
// Adversarial test suite attacking extreme boundary inputs during SQLite-to-MMKV fallback synchronization.

import * as repository from '../storage/history/repository';
import * as dbSingleton from '../storage/dbSingleton';
import { legacySessionToV2, normalizeLookupKey } from '../storage/history/legacySessionMapper';
import {
  saveActiveWorkoutDraft,
  restoreActiveWorkoutDraft,
  clearActiveWorkoutDraft,
} from '../storage/activeWorkoutSnapshot';
import {
  initMMKVAdapter,
  setInjectedStorageAdapter,
  SynchronousStorageAdapter,
} from '../storage/adapters/mmkvAdapter';
import {
  normalizeActiveWorkoutDraftV2,
  validateWorkoutSessionV2,
  weightToMilliKg,
  parseReps,
} from '../storage/contracts/validators';
import { STORAGE_KEYS } from '../storage/keys';
import { WorkoutSessionV2, ActiveWorkoutDraftV2 } from '../storage/contracts/types';

class MockSynchronousStorageAdapter implements SynchronousStorageAdapter {
  private store = new Map<string, string>();
  isAvailable = () => true;
  isNative = () => true;
  getString = (key: string) => this.store.get(key) ?? null;
  setString = (key: string, value: string) => {
    this.store.set(key, value);
    return true;
  };
  removeItem = (key: string) => {
    this.store.delete(key);
    return true;
  };
  clear = () => this.store.clear();
}

describe('Adversarial Persistence & Boundary Synchronization Suite', () => {
  let mockAdapter: MockSynchronousStorageAdapter;

  beforeEach(() => {
    mockAdapter = new MockSynchronousStorageAdapter();
    setInjectedStorageAdapter(mockAdapter);
    initMMKVAdapter();
    repository.clearFallbackRepositoryForTests();
    jest.spyOn(dbSingleton, 'getV2Database').mockResolvedValue(null); // Force MMKV/in-memory fallback adapter
  });

  afterEach(() => {
    setInjectedStorageAdapter(null);
    jest.restoreAllMocks();
  });

  describe('1. Unicode, Surrogate Pairs & RTL Text Boundary Resilience', () => {
    test('Preserves Unicode surrogate pairs, emojis, and Hebrew text in active workout drafts', () => {
      const draft: ActiveWorkoutDraftV2 = {
        schemaVersion: 2,
        draftId: 'draft-emoji-1',
        revision: 1,
        writtenAtMs: Date.now(),
        payloadChecksum: '',
        isWorkoutActive: true,
        workoutName: 'אימון חזה ורגליים 🏋️‍♂️🔥',
        startedAtMs: Date.now(),
        comment: 'הערות אימון: סט אחרון עד כשל 🦾💯 (Surrogate \uD83D\uDCAA)',
        isWorkoutModalVisible: true,
        editingSessionId: null,
        restTimerDeadlineMs: null,
        restTimerDurationSec: 90,
        exercises: [
          {
            id: 'ex-unicode-1',
            exerciseId: 'ex-bench',
            name: 'לחיצת חזה במוט 🏋️',
            variationKey: 'רוחב אחיזה רגיל',
            supersetGroupId: null,
            note: 'דגש על שליטה בירידה 📉\nשבירת שיא אישי 🏆',
            showNote: true,
            isNoteLocked: false,
            autoTimer: 120,
            sets: [
              {
                id: 'set-unicode-1',
                category: 'S',
                completed: true,
                weightInput: '102.5',
                repsInput: '6',
                rpeInput: '9.5',
                isUnilateral: false,
                leftWeightInput: '',
                leftRepsInput: '',
                rightWeightInput: '',
                rightRepsInput: '',
                suggestedWeight: '',
                suggestedReps: '',
                suggestedLeftWeight: '',
                suggestedLeftReps: '',
                suggestedRightWeight: '',
                suggestedRightReps: '',
              },
            ],
          },
        ],
      };

      expect(() => saveActiveWorkoutDraft(draft)).not.toThrow();
      const restored = restoreActiveWorkoutDraft();
      expect(restored).not.toBeNull();
      expect(restored?.workoutName).toBe('אימון חזה ורגליים 🏋️‍♂️🔥');
      expect(restored?.comment).toBe('הערות אימון: סט אחרון עד כשל 🦾💯 (Surrogate \uD83D\uDCAA)');
      expect(restored?.exercises[0].name).toBe('לחיצת חזה במוט 🏋️');
      expect(restored?.exercises[0].note).toBe('דגש על שליטה בירידה 📉\nשבירת שיא אישי 🏆');
    });

    test('Preserves complex Unicode and quotes in history sessions during MMKV fallback upsert', async () => {
      const session: WorkoutSessionV2 = {
        id: 'sess-unicode-1',
        title: 'אימון גב ויד קדמית "Power" & \'Grip\' 🧗‍♂️',
        titleNorm: normalizeLookupKey('אימון גב ויד קדמית "Power" & \'Grip\' 🧗‍♂️'),
        startedAtMs: 1786687000000,
        endedAtMs: 1786691000000,
        durationSec: 4000,
        comment: 'ציטוט: "Never give up!" & <special_chars> & 🪢',
        totalVolumeMilliKg: 7500000,
        prs: 2,
        createdAtMs: 1786687000000,
        updatedAtMs: 1786691000000,
        revision: 1,
        deletedAtMs: null,
        exercises: [
          {
            id: 'ex-sess-1',
            sessionId: 'sess-unicode-1',
            exerciseId: 'lat-pull',
            nameSnapshot: 'פולי עליון לפנים 🚣',
            nameNorm: normalizeLookupKey('פולי עליון לפנים 🚣'),
            variationKey: 'אחיזה רחבה',
            position: 0,
            supersetGroupId: null,
            note: 'סופר-סט עם חתירה ב-T Bar 🏋️‍♀️',
            sets: [
              {
                id: 'set-sess-1',
                position: 0,
                category: 'S',
                completed: true,
                weightMilliKg: 70000,
                reps: 10,
                rpeTenths: 85,
                isUnilateral: false,
                leftWeightMilliKg: null,
                leftReps: null,
                rightWeightMilliKg: null,
                rightReps: null,
              },
            ],
          },
        ],
      };

      await repository.upsertSession(session);

      const all = await repository.loadAllSessions();
      expect(all).toHaveLength(1);
      expect(all[0].title).toBe('אימון גב ויד קדמית "Power" & \'Grip\' 🧗‍♂️');
      expect(all[0].comment).toBe('ציטוט: "Never give up!" & <special_chars> & 🪢');
      expect(all[0].exercises[0].nameSnapshot).toBe('פולי עליון לפנים 🚣');
    });
  });

  describe('2. Negative & Invalid Values Sanitization in Legacy Mapper & Validators', () => {
    test('Safely handles negative weights, negative reps, and NaN timestamps in legacySessionToV2', () => {
      const malformedLegacy = {
        id: 'legacy-malformed-1',
        title: null,
        datetime: 'invalid-date-string-xyz',
        durationMinutes: -45,
        totalVolumeKg: -100,
        prs: -3,
        exercises: [
          {
            name: 'Bench Press',
            setsDetails: [
              {
                weight: -80,
                reps: -10,
                rpe: 15, // Out of range RPE > 10
                completed: 'yes' as any, // Not boolean
              },
              {
                weight: NaN,
                reps: null,
                rpe: -2,
                completed: false,
              },
            ],
          },
        ],
      };

      const normalizedV2 = legacySessionToV2(malformedLegacy, 0);

      expect(normalizedV2.title).toBe('Workout');
      expect(normalizedV2.startedAtMs).toBeGreaterThan(0);
      expect(normalizedV2.durationSec).toBe(0);
      expect(normalizedV2.totalVolumeMilliKg).toBe(0);
      expect(normalizedV2.prs).toBe(0);

      const set1 = normalizedV2.exercises[0].sets[0];
      expect(set1.weightMilliKg).toBe(0);
      expect(set1.reps).toBe(0);
      expect(set1.rpeTenths).toBeNull(); // Rejects out-of-range RPE
      expect(set1.completed).toBe(true);

      const set2 = normalizedV2.exercises[0].sets[1];
      expect(set2.weightMilliKg).toBe(0);
      expect(set2.reps).toBe(0);
      expect(set2.rpeTenths).toBeNull();
      expect(set2.completed).toBe(false);

      // Validate that normalized session strictly complies with V2 schema
      const validation = validateWorkoutSessionV2(normalizedV2);
      expect(validation.success).toBe(true);
    });

    test('parseStrictFloat and parseStrictInt reject boundary anomalies', () => {
      expect(weightToMilliKg(-50)).toBe(0);
      expect(weightToMilliKg(Infinity)).toBe(0);
      expect(weightToMilliKg(-Infinity)).toBe(0);
      expect(weightToMilliKg(NaN)).toBe(0);

      expect(parseReps(-12)).toBe(0);
      expect(parseReps(Infinity)).toBe(0);
      expect(parseReps(NaN)).toBe(0);
    });
  });

  describe('3. Journal Corruption & Slot Recovery Resilience', () => {
    test('Recovers valid older slot when newer slot envelope is corrupted by disk fault', () => {
      const now = Date.now();
      const validDraftA: ActiveWorkoutDraftV2 = normalizeActiveWorkoutDraftV2({
        draftId: 'draft-a',
        workoutName: 'Valid Older Workout',
        startTime: new Date(now - 60000).toISOString(),
        revision: 2,
        exercises: [{ name: 'Squat', sets: [{ weight: '100', reps: '5' }] }],
      });

      saveActiveWorkoutDraft(validDraftA);

      // Verify slot A was written
      const slotAVal = mockAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_A);
      expect(slotAVal).not.toBeNull();

      // Now inject corrupted JSON into slot B with a higher sequence number
      mockAdapter.setString(
        STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B,
        '{"schemaVersion":2,"kind":"draft","sequence":999,"corruptedJson'
      );
      mockAdapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD, 'slot_b');

      // Attempt restore: should bypass corrupt slot B and cleanly restore valid slot A
      const restored = restoreActiveWorkoutDraft();
      expect(restored).not.toBeNull();
      expect(restored?.workoutName).toBe('Valid Older Workout');
      expect(restored?.exercises[0].name).toBe('Squat');
    });

    test('Handles clearActiveWorkoutDraft tombstone properly across fallback reloads', () => {
      const draft = normalizeActiveWorkoutDraftV2({
        workoutName: 'Temporary Workout',
        startTime: new Date().toISOString(),
      });

      saveActiveWorkoutDraft(draft);
      expect(restoreActiveWorkoutDraft()).not.toBeNull();

      clearActiveWorkoutDraft();
      expect(restoreActiveWorkoutDraft()).toBeNull();
    });
  });
});
