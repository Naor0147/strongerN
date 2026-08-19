import {
  isCompletedSet,
  countCompletedSets,
  countCompletedSetsInExercise,
  countCompletedSetsInSession,
} from '../utils/setCounting';

describe('R1 Canonical Set-Counting Foundation', () => {
  describe('isCompletedSet', () => {
    it('returns true for completed: true', () => {
      expect(isCompletedSet({ completed: true, weightKg: 80, reps: 10 })).toBe(true);
    });

    it('returns true for SQLite integer boolean completed: 1', () => {
      expect(isCompletedSet({ completed: 1, weightKg: 80, reps: 10 })).toBe(true);
    });

    it('returns false for completed: false', () => {
      expect(isCompletedSet({ completed: false, weightKg: 80, reps: 10 })).toBe(false);
    });

    it('returns false for completed: 0', () => {
      expect(isCompletedSet({ completed: 0, weightKg: 80, reps: 10 })).toBe(false);
    });

    it('returns false for missing or non-boolean completed values', () => {
      expect(isCompletedSet({ weightKg: 80, reps: 10 })).toBe(false);
      expect(isCompletedSet({ completed: null })).toBe(false);
      expect(isCompletedSet({ completed: 'true' })).toBe(false);
      expect(isCompletedSet(null)).toBe(false);
      expect(isCompletedSet(undefined)).toBe(false);
      expect(isCompletedSet(123)).toBe(false);
      expect(isCompletedSet('set')).toBe(false);
    });
  });

  describe('countCompletedSets', () => {
    it('accurately counts completed sets in an array', () => {
      const sets = [
        { completed: true, reps: 10 },
        { completed: false, reps: 8 },
        { completed: 1, reps: 12 },
        { completed: 0, reps: 6 },
        { reps: 5 },
      ];
      expect(countCompletedSets(sets)).toBe(2);
    });

    it('handles empty or non-array inputs gracefully', () => {
      expect(countCompletedSets([])).toBe(0);
      expect(countCompletedSets(null)).toBe(0);
      expect(countCompletedSets(undefined)).toBe(0);
    });
  });

  describe('countCompletedSetsInExercise', () => {
    it('prefers setsDetails when available', () => {
      const exercise = {
        name: 'Bench Press',
        sets: 5, // legacy count was 5
        setsDetails: [
          { completed: true, reps: 10 },
          { completed: true, reps: 10 },
          { completed: false, reps: 10 }, // incomplete
        ],
      };
      // Must return 2 (only completed sets), ignoring the stale sets: 5
      expect(countCompletedSetsInExercise(exercise)).toBe(2);
    });

    it('counts completed sets when sets is an array of set objects', () => {
      const exercise = {
        name: 'Squat',
        sets: [
          { completed: true, reps: 5 },
          { completed: false, reps: 5 },
        ],
      };
      expect(countCompletedSetsInExercise(exercise)).toBe(1);
    });

    it('falls back to integer sets when no setsDetails exist (legacy records)', () => {
      const exercise = {
        name: 'Deadlift',
        sets: 3,
      };
      expect(countCompletedSetsInExercise(exercise)).toBe(3);
    });

    it('returns 0 for invalid or empty exercise', () => {
      expect(countCompletedSetsInExercise(null)).toBe(0);
      expect(countCompletedSetsInExercise({})).toBe(0);
      expect(countCompletedSetsInExercise({ sets: -2 })).toBe(0);
    });
  });

  describe('countCompletedSetsInSession', () => {
    it('sums completed sets across all exercises in a session', () => {
      const session = {
        id: 'sess-1',
        datetime: new Date().toISOString(),
        exercises: [
          {
            name: 'Incline Dumbbell Press',
            setsDetails: [
              { completed: true, reps: 12 },
              { completed: true, reps: 10 },
              { completed: false, reps: 8 },
            ],
          },
          {
            name: 'Tricep Pushdown',
            setsDetails: [
              { completed: true, reps: 15 },
              { completed: true, reps: 12 },
              { completed: true, reps: 10 },
            ],
          },
        ],
      };

      expect(countCompletedSetsInSession(session)).toBe(5);
    });

    it('returns 0 for null/undefined session or session with no exercises', () => {
      expect(countCompletedSetsInSession(null)).toBe(0);
      expect(countCompletedSetsInSession({})).toBe(0);
      expect(countCompletedSetsInSession({ exercises: [] })).toBe(0);
    });
  });
});
