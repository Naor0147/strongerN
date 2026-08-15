import { buildExerciseHistoryIndex, resolveLastPerformanceSuggestion } from '../storage/expectedValues';
import { legacySessionToV2, sessionV2ToLegacy } from '../storage/history/legacySessionMapper';
import { initMMKVAdapter, setInjectedStorageAdapter, SynchronousStorageAdapter } from '../storage/adapters/mmkvAdapter';
import { normalizeActiveWorkoutDraftV2 } from '../storage/contracts/validators';
import { clearActiveWorkoutDraft, restoreActiveWorkoutDraft, saveActiveWorkoutDraft } from '../storage/activeWorkoutSnapshot';
import { saveActiveInputPatch } from '../storage/activeInputPatch';

class MemoryAdapter implements SynchronousStorageAdapter {
  readonly values = new Map<string, string>();
  isAvailable = () => true;
  isNative = () => true;
  getString = (key: string) => this.values.get(key) ?? null;
  setString = (key: string, value: string) => { this.values.set(key, value); return true; };
  removeItem = (key: string) => { this.values.delete(key); return true; };
}

describe('persistence architecture', () => {
  describe('contextual expected values', () => {
    const sessions = [
      {
        id: 'newest',
        datetime: new Date('2026-08-03T10:00:00Z'),
        exercises: [{
          name: 'Bench Press',
          variation: 'Paused',
          setsDetails: [
            { weight: 82.5, reps: 6, completed: true, category: 'S' },
            { weight: 80, reps: 7, completed: true, category: 'S' },
          ],
        }],
      },
      {
        id: 'older-but-stronger',
        datetime: new Date('2026-07-01T10:00:00Z'),
        exercises: [{
          name: 'Bench Press',
          variation: 'Paused',
          setsDetails: [{ weight: 120, reps: 10, completed: true, category: 'S' }],
        }],
      },
    ];

    test('uses the latest corresponding set when the sample is too small for a safe trend', () => {
      expect(resolveLastPerformanceSuggestion('Bench Press', 'S', 0, sessions, false, 'Paused')).toMatchObject({
        weight: '82.5', reps: '6',
      });
      expect(resolveLastPerformanceSuggestion('Bench Press', 'S', 1, sessions, false, 'Paused')).toMatchObject({
        weight: '80', reps: '7',
      });
    });

    test('uses the last performed set when the new ordinal exceeds the previous session', () => {
      expect(resolveLastPerformanceSuggestion('Bench Press', 'S', 9, sessions, false, 'Paused')).toMatchObject({
        weight: '80', reps: '7',
      });
    });

    test('skips an unfinished latest entry and uses the last completed performance', () => {
      const unfinishedLatest = {
        id: 'unfinished-latest',
        datetime: new Date('2026-08-04T10:00:00Z'),
        exercises: [{
          name: 'Bench Press',
          variation: 'Paused',
          setsDetails: [{ weight: 90, reps: 5, completed: false, category: 'S' }],
        }],
      };
      expect(resolveLastPerformanceSuggestion(
        'Bench Press', 'S', 0, [unfinishedLatest, ...sessions], false, 'Paused'
      )).toMatchObject({ weight: '82.5', reps: '6' });
    });

    test('skips a recent completed set with missing values and uses older valid history', () => {
      const incompleteLatest = {
        datetime: new Date('2026-08-04T10:00:00Z'),
        exercises: [{
          name: 'Bench Press', variation: 'Paused',
          setsDetails: [{ weight: '', reps: '', completed: true, category: 'S' }],
        }],
      };
      expect(resolveLastPerformanceSuggestion(
        'Bench Press', 'S', 0, [incompleteLatest, ...sessions], false, 'Paused'
      )).toMatchObject({ weight: '82.5', reps: '6' });
    });

    test('uses a pre-indexed history without changing the exact result', () => {
      const index = buildExerciseHistoryIndex(sessions);
      expect(resolveLastPerformanceSuggestion(
        'Bench Press', 'S', 1, sessions, false, 'Paused', index
      )).toMatchObject({ weight: '80', reps: '7' });
    });

    test('returns a clean empty target when no matching history exists', () => {
      expect(resolveLastPerformanceSuggestion('Never Logged', 'S', 0, sessions, false)).toMatchObject({
        weight: '', reps: '', leftWeight: '', rightWeight: '', sourceTier: 9,
      });
    });

    test('preserves exact unilateral side values from the latest performance', () => {
      const unilateral = [{
        datetime: new Date('2026-08-04T09:00:00Z'),
        exercises: [{ name: 'Single Arm Row', setsDetails: [{
          weight: 20, reps: 10, completed: true, category: 'S', isUnilateral: true,
          leftWeight: 21, leftReps: 9, rightWeight: 22, rightReps: 8,
        }] }],
      }];
      expect(resolveLastPerformanceSuggestion('Single Arm Row', 'S', 0, unilateral, true)).toMatchObject({
        leftWeight: '21', leftReps: '9', rightWeight: '22', rightReps: '8',
      });
    });

    test('prefers five exact-context sessions over newer global matches without mixing tiers', () => {
      const exactContext = Array.from({ length: 5 }, (_, index) => ({
        datetime: new Date(Date.UTC(2026, 7, 10 - index)).toISOString(),
        title: 'Push Day',
        exercises: [
          { name: 'Shoulder Press', setsDetails: [{ weight: 30, reps: 10, completed: true, category: 'S' }] },
          { name: 'Bench Press', variation: 'Paused', setsDetails: [{ weight: 80 - index * 2.5, reps: 6, completed: true, category: 'S' }] },
        ],
      }));
      const newerGlobal = {
        datetime: new Date(Date.UTC(2026, 7, 15)).toISOString(),
        title: 'Full Body',
        exercises: [{ name: 'Bench Press', variation: 'Paused', setsDetails: [{ weight: 120, reps: 3, completed: true, category: 'S' }] }],
      };
      const suggestion = resolveLastPerformanceSuggestion(
        'Bench Press', 'S', 0, [newerGlobal, ...exactContext], false, 'Paused', undefined,
        { routineName: 'Push Day', exercisePosition: 1, progressiveOverloadEnabled: false }
      );
      expect(suggestion).toMatchObject({ weight: '80', reps: '6', sourceTier: 1, sampleSize: 5 });
    });

    test('never raises weight or reps unless progressive overload is enabled', () => {
      const trending = Array.from({ length: 5 }, (_, index) => ({
        datetime: new Date(Date.UTC(2026, 7, 10 - index)).toISOString(),
        title: 'Push Day',
        exercises: [{
          name: 'Bench Press',
          setsDetails: [{ weight: 100 - index * 2.5, reps: 8 - index, completed: true, category: 'S' }],
        }],
      }));
      const index = buildExerciseHistoryIndex(trending);
      const disabled = resolveLastPerformanceSuggestion(
        'Bench Press', 'S', 0, trending, false, undefined, index,
        { routineName: 'Push Day', exercisePosition: 0, equipment: 'Barbell', progressiveOverloadEnabled: false }
      );
      const enabled = resolveLastPerformanceSuggestion(
        'Bench Press', 'S', 0, trending, false, undefined, index,
        { routineName: 'Push Day', exercisePosition: 0, equipment: 'Barbell', progressiveOverloadEnabled: true }
      );
      expect(Number(disabled.weight)).toBeLessThanOrEqual(100);
      expect(Number(disabled.reps)).toBeLessThanOrEqual(8);
      expect(Number(enabled.weight)).toBe(102.5);
    });

    test('keeps warm-up and drop-set history isolated from working sets', () => {
      const categoryHistory = Array.from({ length: 5 }, (_, index) => ({
        datetime: new Date(Date.UTC(2026, 7, 10 - index)).toISOString(),
        title: 'Push Day',
        exercises: [{ name: 'Bench Press', setsDetails: [
          { weight: 40, reps: 12, completed: true, category: 'W' },
          { weight: 100, reps: 6, completed: true, category: 'S' },
          { weight: 70, reps: 12, completed: true, category: 'D' },
        ] }],
      }));
      const index = buildExerciseHistoryIndex(categoryHistory);
      const context = { routineName: 'Push Day', exercisePosition: 0, progressiveOverloadEnabled: false };
      expect(resolveLastPerformanceSuggestion('Bench Press', 'W', 0, categoryHistory, false, undefined, index, context).weight).toBe('40');
      expect(resolveLastPerformanceSuggestion('Bench Press', 'S', 0, categoryHistory, false, undefined, index, context).weight).toBe('100');
      expect(resolveLastPerformanceSuggestion('Bench Press', 'D', 0, categoryHistory, false, undefined, index, context).weight).toBe('70');
    });

    test('uses template targets only as the tier-nine cold-start fallback', () => {
      expect(resolveLastPerformanceSuggestion(
        'New Exercise', 'S', 0, [], false, undefined, undefined,
        { templateSuggestion: { weight: '20', reps: '12' }, progressiveOverloadEnabled: false }
      )).toMatchObject({ weight: '20', reps: '12', sourceTier: 9, sampleSize: 0 });
    });

    test('recognizes a repeated deload and does not forecast an immediate rebound when progression is off', () => {
      const deloadHistory = [70, 70, 100, 97.5, 95].map((weight, index) => ({
        datetime: new Date(Date.UTC(2026, 7, 10 - index)).toISOString(),
        title: 'Push Day',
        exercises: [{ name: 'Bench Press', setsDetails: [{ weight, reps: 8, completed: true, category: 'S' }] }],
      }));
      const suggestion = resolveLastPerformanceSuggestion(
        'Bench Press', 'S', 0, deloadHistory, false, undefined, undefined,
        { routineName: 'Push Day', exercisePosition: 0, progressiveOverloadEnabled: false }
      );
      expect(Number(suggestion.weight)).toBeLessThanOrEqual(70);
    });
  });

  test('legacy history maps into compact normalized rows and round-trips without losing sets', () => {
    const legacy = {
      id: 'session-1',
      title: 'Push',
      datetime: new Date('2026-08-01T10:00:00Z'),
      durationMinutes: 45,
      totalVolumeKg: 1234.5,
      prs: 1,
      exercises: [{
        name: 'Bench Press',
        sets: 2,
        bestWeight: 80,
        bestReps: 8,
        setsDetails: [
          { weight: 80, reps: 8, completed: true, category: 'S' },
          { weight: 77.5, reps: 9, completed: true, category: 'S' },
        ],
      }],
    };
    const normalized = legacySessionToV2(legacy);
    expect(normalized.totalVolumeMilliKg).toBe(1234500);
    expect(normalized.exercises[0].sets).toHaveLength(2);
    expect(normalized.exercises[0].sets[1].weightMilliKg).toBe(77500);
    const roundTrip = sessionV2ToLegacy(normalized);
    expect(roundTrip.id).toBe('session-1');
    expect(roundTrip.exercises[0].setsDetails).toHaveLength(2);
  });

  test('the tiny input patch preserves the latest digit without forcing a full React render', () => {
    const adapter = new MemoryAdapter();
    setInjectedStorageAdapter(adapter);
    initMMKVAdapter();
    const draft = normalizeActiveWorkoutDraftV2({
      draftId: 'draft-input',
      isWorkoutActive: true,
      workoutName: 'Input Test',
      exercises: [{ id: 'exercise-1', name: 'Squat', sets: [{ id: 'set-1', weight: '10', reps: '5' }] }],
    });
    saveActiveWorkoutDraft(draft);
    saveActiveInputPatch('exercise-1', 'set-1', 'weight', '105');
    expect(restoreActiveWorkoutDraft()?.exercises[0].sets[0].weightInput).toBe('105');
    clearActiveWorkoutDraft();
    expect(restoreActiveWorkoutDraft()).toBeNull();
    setInjectedStorageAdapter(null);
  });
});
