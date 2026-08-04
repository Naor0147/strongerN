// src/__tests__/storageContracts.test.ts
// Comprehensive unit tests for StrongerN contracts, validators, normalizers, and determinism.

import {
  weightToMilliKg,
  milliKgToWeightString,
  parseReps,
  parseRpeTenths,
  parseStrictFloat,
  parseStrictInt,
  normalizeSetLogV2,
  normalizeActiveSetDraftV2,
  normalizeActiveExerciseDraftV2,
  normalizeActiveWorkoutDraftV2,
  createDeterministicIdGenerator,
  calculateChecksum,
  validateLegacyAppDataV1,
  validateLegacyActiveWorkoutV1,
  validateActiveWorkoutDraftV2,
  validateWorkoutSessionV2,
} from '../storage/contracts/validators';

describe('Storage Contracts & Runtime Validators', () => {
  describe('Strict Non-Partial Numeric Parsing', () => {
    test('rejects strings with trailing non-numeric characters (12abc)', () => {
      expect(parseStrictFloat('12abc')).toBeNull();
      expect(weightToMilliKg('12abc')).toBe(0);

      expect(parseStrictInt('12abc')).toBeNull();
      expect(parseReps('12abc')).toBe(0);

      expect(parseRpeTenths('8.5abc')).toBeNull();
    });

    test('rejects floats when expecting strict integers (12.5 reps)', () => {
      expect(parseStrictInt('12.5')).toBeNull();
      expect(parseReps('12.5')).toBe(0);
    });

    test('accepts valid clean numeric strings and numbers', () => {
      expect(parseStrictFloat('60.5')).toBe(60.5);
      expect(weightToMilliKg('60.5')).toBe(60500);

      expect(parseStrictInt('12')).toBe(12);
      expect(parseReps('12')).toBe(12);
    });

    test('preserves weight 0 and reps 0 accurately', () => {
      expect(weightToMilliKg(0)).toBe(0);
      expect(weightToMilliKg('0')).toBe(0);
      expect(milliKgToWeightString(0)).toBe('0');

      expect(parseReps(0)).toBe(0);
      expect(parseReps('0')).toBe(0);
    });
  });

  describe('Timestamp 0 (Epoch) Preservation', () => {
    test('handles timestamp 0 correctly in date precedence and validation', () => {
      const epochIso = new Date(0).toISOString();

      // Normalize draft with startTime = Epoch (timestamp 0)
      const draft = normalizeActiveWorkoutDraftV2({
        workoutName: 'Epoch Workout',
        startTime: epochIso,
      });

      expect(draft.startedAtMs).toBe(0);
      expect(draft.isWorkoutActive).toBe(true);

      // Validate session with startedAtMs = 0
      const sessionValidation = validateWorkoutSessionV2({
        id: 'sess-epoch',
        title: 'Epoch Session',
        titleNorm: 'epoch session',
        startedAtMs: 0,
        endedAtMs: 1000,
        durationSec: 1,
        comment: null,
        totalVolumeMilliKg: 0,
        prs: 0,
        createdAtMs: 0,
        updatedAtMs: 0,
        revision: 1,
        deletedAtMs: null,
        exercises: [],
      });
      expect(sessionValidation.success).toBe(true);
    });
  });

  describe('Hierarchical Tree ID Uniqueness & Determinism', () => {
    test('generates unique IDs across the entire tree for same-name exercises and repeated/missing-ID sets', () => {
      const idGen = createDeterministicIdGenerator('migration-run-1');

      const rawWorkout = {
        workoutName: 'Leg Day',
        startTime: '2026-08-04T10:00:00.000Z',
        workoutExercises: [
          {
            name: 'Squat',
            sets: [
              { weight: '100', reps: '5' },
              { weight: '100', reps: '5' }
            ]
          },
          {
            name: 'Squat',
            sets: [
              { weight: '100', reps: '5' },
              { weight: '100', reps: '5' }
            ]
          }
        ]
      };

      const normalized = normalizeActiveWorkoutDraftV2(rawWorkout, idGen);

      // Collect all IDs across the normalized tree
      const allIds = [
        normalized.draftId,
        normalized.exercises[0].id,
        normalized.exercises[0].sets[0].id,
        normalized.exercises[0].sets[1].id,
        normalized.exercises[1].id,
        normalized.exercises[1].sets[0].id,
        normalized.exercises[1].sets[1].id,
      ];

      // Assert total count equals 7 and Set size is 7 (all unique!)
      expect(allIds.length).toBe(7);
      expect(new Set(allIds).size).toBe(7);
    });

    test('produces byte-identical output on repeated normalization runs', () => {
      const rawWorkout = {
        workoutName: 'Upper Body',
        startTime: '2026-08-04T11:00:00.000Z',
        workoutExercises: [
          {
            name: 'Bench Press',
            sets: [{ weight: '80', reps: '8' }]
          }
        ]
      };

      const run1 = normalizeActiveWorkoutDraftV2(rawWorkout, createDeterministicIdGenerator('run-x'));
      const run2 = normalizeActiveWorkoutDraftV2(rawWorkout, createDeterministicIdGenerator('run-x'));

      expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
    });
  });

  describe('Recursive & Deep Runtime Validators with Path-Specific Error Diagnostics', () => {
    test('validateActiveWorkoutDraftV2 rejects exercises:[null] with path-specific error', () => {
      const res = validateActiveWorkoutDraftV2({
        schemaVersion: 2,
        draftId: 'd1',
        revision: 1,
        writtenAtMs: 100,
        payloadChecksum: 'abc',
        isWorkoutActive: true,
        workoutName: 'Push Day',
        startedAtMs: null,
        comment: '',
        isWorkoutModalVisible: true,
        editingSessionId: null,
        restTimerDeadlineMs: null,
        restTimerDurationSec: null,
        exercises: [null],
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('exercises[0]: must be a non-null object');
      }
    });

    test('validateActiveWorkoutDraftV2 rejects invalid revision string', () => {
      const res = validateActiveWorkoutDraftV2({
        schemaVersion: 2,
        draftId: 'd1',
        revision: 'invalid-string',
        writtenAtMs: 100,
        payloadChecksum: 'abc',
        isWorkoutActive: true,
        workoutName: 'Push Day',
        startedAtMs: null,
        comment: '',
        isWorkoutModalVisible: true,
        editingSessionId: null,
        restTimerDeadlineMs: null,
        restTimerDurationSec: null,
        exercises: [],
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('revision: expected integer');
      }
    });

    test('validateActiveWorkoutDraftV2 detects duplicate IDs in child tree', () => {
      const res = validateActiveWorkoutDraftV2({
        schemaVersion: 2,
        draftId: 'd1',
        revision: 1,
        writtenAtMs: 100,
        payloadChecksum: 'abc',
        isWorkoutActive: true,
        workoutName: 'Push Day',
        startedAtMs: null,
        comment: '',
        isWorkoutModalVisible: true,
        editingSessionId: null,
        restTimerDeadlineMs: null,
        restTimerDurationSec: null,
        exercises: [
          {
            id: 'same-id',
            exerciseId: null,
            name: 'Squat',
            variationKey: '',
            supersetGroupId: null,
            note: '',
            showNote: true,
            isNoteLocked: false,
            autoTimer: null,
            sets: []
          },
          {
            id: 'same-id',
            exerciseId: null,
            name: 'Leg Press',
            variationKey: '',
            supersetGroupId: null,
            note: '',
            showNote: true,
            isNoteLocked: false,
            autoTimer: null,
            sets: []
          }
        ],
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('exercises[1].id: duplicate ID "same-id" detected');
      }
    });

    test('validateWorkoutSessionV2 rejects malformed numeric history values (e.g. non-integer weightMilliKg or negative reps)', () => {
      const res = validateWorkoutSessionV2({
        id: 'sess-1',
        title: 'Full Body',
        titleNorm: 'full body',
        startedAtMs: 1000,
        endedAtMs: 2000,
        durationSec: 1000,
        comment: null,
        totalVolumeMilliKg: 500000,
        prs: 0,
        createdAtMs: 1000,
        updatedAtMs: 2000,
        revision: 1,
        deletedAtMs: null,
        exercises: [
          {
            id: 'ex-1',
            sessionId: 'sess-1',
            exerciseId: null,
            nameSnapshot: 'Squat',
            nameNorm: 'squat',
            variationKey: '',
            position: 0,
            supersetGroupId: null,
            note: null,
            sets: [
              {
                id: 'set-1',
                position: 0,
                category: 'S',
                completed: true,
                weightMilliKg: 'invalid-string' as any, // Malformed string!
                reps: 5,
                rpeTenths: 80,
                isUnilateral: false,
                leftWeightMilliKg: null,
                leftReps: null,
                rightWeightMilliKg: null,
                rightReps: null
              }
            ]
          }
        ]
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('weightMilliKg: expected non-negative integer');
      }
    });

    test('validateWorkoutSessionV2 validates position hierarchy and duplicate IDs', () => {
      const res = validateWorkoutSessionV2({
        id: 'sess-1',
        title: 'Full Body',
        titleNorm: 'full body',
        startedAtMs: 1000,
        endedAtMs: 2000,
        durationSec: 1000,
        comment: null,
        totalVolumeMilliKg: 500000,
        prs: 0,
        createdAtMs: 1000,
        updatedAtMs: 2000,
        revision: 1,
        deletedAtMs: null,
        exercises: [
          {
            id: 'ex-1',
            sessionId: 'sess-1',
            exerciseId: null,
            nameSnapshot: 'Squat',
            nameNorm: 'squat',
            variationKey: '',
            position: 0,
            supersetGroupId: null,
            note: null,
            sets: [
              {
                id: 'set-1',
                position: 0,
                category: 'S',
                completed: true,
                weightMilliKg: 100000,
                reps: 5,
                rpeTenths: 80,
                isUnilateral: false,
                leftWeightMilliKg: null,
                leftReps: null,
                rightWeightMilliKg: null,
                rightReps: null
              },
              {
                id: 'set-1', // duplicate set ID!
                position: 1,
                category: 'S',
                completed: true,
                weightMilliKg: 100000,
                reps: 5,
                rpeTenths: 80,
                isUnilateral: false,
                leftWeightMilliKg: null,
                leftReps: null,
                rightWeightMilliKg: null,
                rightReps: null
              }
            ]
          }
        ]
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('exercises[0].sets[1].id: duplicate ID "set-1" detected');
      }
    });

    test('validateLegacyAppDataV1 rejects corrupt root elements in arrays', () => {
      expect(validateLegacyAppDataV1({ sessionsList: ['invalid-session-string'] }).success).toBe(false);
      expect(validateLegacyAppDataV1({ exercisesList: [null] }).success).toBe(false);
    });

    test('validateLegacyActiveWorkoutV1 rejects missing or empty exercise names', () => {
      expect(validateLegacyActiveWorkoutV1({ workoutExercises: [{ name: '' }] }).success).toBe(false);
      expect(validateLegacyActiveWorkoutV1({ workoutExercises: [{ name: '   ' }] }).success).toBe(false);
      expect(validateLegacyActiveWorkoutV1({ workoutExercises: [{ name: 'Squat' }] }).success).toBe(true);
    });
  });

  describe('Checksum Computation', () => {
    test('computes deterministic string checksums', () => {
      const c1 = calculateChecksum('StrongerN_V2_TestData');
      const c2 = calculateChecksum('StrongerN_V2_TestData');
      const c3 = calculateChecksum('StrongerN_V2_DifferentData');

      expect(typeof c1).toBe('string');
      expect(c1).toBe(c2);
      expect(c1).not.toBe(c3);
    });
  });
});
