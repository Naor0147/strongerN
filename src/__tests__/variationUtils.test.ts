import { normalizeTag, isValidTag, addVariationToExercise, removeVariationFromExercise, getSessionsForExerciseVariation } from '../utils/variationUtils';
import { WorkoutSession } from '../data/mockData';

describe('variationUtils Safety & Resilience Tests', () => {
  describe('normalizeTag', () => {
    it('normalizes valid strings', () => {
      expect(normalizeTag('  incline   press  ')).toBe('Incline Press');
      expect(normalizeTag('DUMBBELL')).toBe('Dumbbell');
    });

    it('handles empty and whitespace strings safely', () => {
      expect(normalizeTag('')).toBe('');
      expect(normalizeTag('   ')).toBe('');
    });

    it('handles non-string inputs safely without throwing TypeError', () => {
      expect(normalizeTag(null as any)).toBe('');
      expect(normalizeTag(undefined as any)).toBe('');
      expect(normalizeTag(123 as any)).toBe('');
      expect(normalizeTag(true as any)).toBe('');
      expect(normalizeTag({ tag: 'incline' } as any)).toBe('');
    });
  });

  describe('isValidTag', () => {
    it('validates normalized length', () => {
      expect(isValidTag('Incline')).toBe(true);
      expect(isValidTag('')).toBe(false);
      expect(isValidTag('a'.repeat(45))).toBe(false);
    });
  });

  describe('getSessionsForExerciseVariation schema resilience', () => {
    const mockSessions: any[] = [
      {
        id: 's1',
        datetime: '2026-01-01T10:00:00Z',
        exercises: [
          { name: 'Bench Press', variation: undefined },
        ],
      },
      {
        id: 's2',
        datetime: '2026-01-02T10:00:00Z',
        exercises: [
          { name: 'Bench Press', variation: 'Incline' },
        ],
      },
      // Atypical session with null name, number variation, boolean variation
      {
        id: 's-corrupt1',
        datetime: '2026-01-03T10:00:00Z',
        exercises: [
          { name: null, variation: 123 },
          { name: 'Bench Press', variation: true },
          { name: 456, variation: null },
          null,
        ],
      },
    ];

    it('does not throw on corrupt session data and returns expected matches', () => {
      expect(() => {
        const base = getSessionsForExerciseVariation('Bench Press', undefined, undefined, mockSessions);
        expect(base.length).toBeGreaterThanOrEqual(1);
        expect(base[0].id).toBe('s1');
      }).not.toThrow();

      expect(() => {
        const incline = getSessionsForExerciseVariation('Bench Press', 'Incline', undefined, mockSessions);
        expect(incline.length).toBe(1);
        expect(incline[0].id).toBe('s2');
      }).not.toThrow();
    });

    it('returns empty array when exerciseName or sessions are invalid', () => {
      expect(getSessionsForExerciseVariation('' as any, 'Incline', undefined, mockSessions)).toEqual([]);
      expect(getSessionsForExerciseVariation(null as any, 'Incline', undefined, mockSessions)).toEqual([]);
      expect(getSessionsForExerciseVariation('Bench Press', 'Incline', undefined, null as any)).toEqual([]);
      expect(getSessionsForExerciseVariation('Bench Press', 'Incline', undefined, [] as any)).toEqual([]);
    });

    it('correctly implements First Tag Inheritance rule', () => {
      const singleBaseSession: any[] = [
        {
          id: 'base-only',
          datetime: '2026-01-01T10:00:00Z',
          exercises: [{ name: 'Squat', variation: '' }],
        },
      ];

      // First tag assigned to exercise with no prior tag history inherits base sessions
      const inherited = getSessionsForExerciseVariation('Squat', 'Pause', undefined, singleBaseSession);
      expect(inherited.length).toBe(1);
      expect(inherited[0].id).toBe('base-only');
    });
  });
});
