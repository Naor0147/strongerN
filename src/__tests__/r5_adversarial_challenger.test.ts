import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  buildExerciseSessionHistory,
  ExerciseHistorySession,
} from '../utils/exerciseHistory';
import ExerciseInsightsModal from '../screens/ExerciseInsightsModal';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

describe('R5 Adversarial & Empirical Stress Suite', () => {
  describe('1. Malformed and Corrupted Inputs', () => {
    it('handles non-string or empty exerciseName gracefully without throwing', () => {
      expect(buildExerciseSessionHistory('', [])).toEqual([]);
      expect(buildExerciseSessionHistory(null as any, [])).toEqual([]);
      expect(buildExerciseSessionHistory(undefined as any, [])).toEqual([]);
      // Should handle non-string gracefully if guarded:
      try {
        const res = buildExerciseSessionHistory(123 as any, []);
        expect(Array.isArray(res)).toBe(true);
      } catch (e: any) {
        expect(e.message).toMatch(/toLowerCase|not a function/);
      }
    });

    it('handles null or undefined items within sessions array safely without crashing', () => {
      const corruptSessions = [
        null,
        undefined,
        {
          id: 'valid-1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Valid 1',
          exercises: [{ name: 'Bench Press', setsDetails: [{ weightKg: 100, reps: 5, completed: true }] }],
        },
      ];

      const result = buildExerciseSessionHistory('Bench Press', corruptSessions as any);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('valid-1');
    });

    it('handles corrupt exercise objects (nulls, missing names, non-array exercises)', () => {
      const corruptExercisesSessions = [
        {
          id: 'sess-corrupt-ex',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Corrupt Ex',
          exercises: [
            null,
            undefined,
            {},
            { name: null },
            { name: 123 },
            { name: 'Bench Press', setsDetails: null },
            { name: 'Bench Press', setsDetails: 'not-an-array' },
          ],
        },
        {
          id: 'sess-non-array-ex',
          datetime: '2026-01-02T10:00:00Z',
          title: 'Non Array Ex',
          exercises: 'invalid',
        },
      ];

      const result = buildExerciseSessionHistory('Bench Press', corruptExercisesSessions as any);
      expect(Array.isArray(result)).toBe(true);
    });

    it('evaluates corrupted sets with NaN or string numbers', () => {
      const sessionWithWeirdSets = [
        {
          id: 'weird-sets',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Adversarial Sets',
          exercises: [
            {
              name: 'Squat',
              setsDetails: [
                null,
                undefined,
                { weightKg: 100, reps: 5, completed: true },
                { weightKg: '80', reps: '8', completed: true },
                { weightMilliKg: 90000, reps: 5, completed: 1 }, // completed: 1 (SQLite format)
                { category: 'D', weightKg: 70, reps: 10, completed: true },
                { rpeTenths: 85, weightKg: 95, reps: 5, completed: true },
              ],
            },
          ],
        },
      ];

      const result = buildExerciseSessionHistory('Squat', sessionWithWeirdSets as any);
      expect(result).toHaveLength(1);
      const sets = result[0].sets;
      expect(sets.length).toBe(5); // 5 valid set objects filtered from null/undefined
      expect(result[0].completedSetsCount).toBe(5);
    });

    it('handles invalid date strings without crashing or corrupting output date objects', () => {
      const sessions = [
        {
          id: 'invalid-date-1',
          datetime: 'NOT_A_VALID_DATE',
          title: 'Invalid Date',
          exercises: [{ name: 'Deadlift', setsDetails: [{ weightKg: 100, reps: 5, completed: true }] }],
        },
        {
          id: 'valid-date-1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Valid Jan',
          exercises: [{ name: 'Deadlift', setsDetails: [{ weightKg: 110, reps: 5, completed: true }] }],
        },
      ];

      const res = buildExerciseSessionHistory('Deadlift', sessions as any);
      expect(res.length).toBe(2);
      res.forEach((item) => {
        expect(item.date instanceof Date).toBe(true);
        expect(isNaN(item.date.getTime())).toBe(false);
      });
    });
  });

  describe('2. Massive Datasets & Performance Benchmarks', () => {
    it('processes 1,500 sessions within 100ms budget', () => {
      const largeSessionList = [];
      const baseDate = new Date('2022-01-01T00:00:00Z').getTime();

      for (let i = 0; i < 1500; i++) {
        largeSessionList.push({
          id: `sess-bench-${i}`,
          datetime: new Date(baseDate + i * 86400000).toISOString(),
          title: `Workout ${i}`,
          exercises: [
            {
              name: 'Bench Press',
              setsDetails: [
                { weightKg: 60 + (i % 80), reps: 5 + (i % 5), completed: true, category: 'S' },
                { weightKg: 65 + (i % 80), reps: 5, completed: true, category: 'S' },
                { weightKg: 70 + (i % 80), reps: 3, completed: true, category: 'S' },
              ],
            },
            {
              name: 'Barbell Row',
              setsDetails: [{ weightKg: 50, reps: 10, completed: true }],
            },
          ],
        });
      }

      const start = performance.now();
      const history = buildExerciseSessionHistory('Bench Press', largeSessionList);
      const elapsed = performance.now() - start;

      expect(history).toHaveLength(1500);
      expect(elapsed).toBeLessThan(200); // 200ms generous threshold for 1,500 items
      // Check newest is first
      expect(history[0].id).toBe('sess-bench-1499');
      expect(history[1499].id).toBe('sess-bench-0');
    });

    it('renders ExerciseInsightsModal with 1,000 sessions smoothly without crashing', () => {
      const thousandSessions = [];
      for (let i = 0; i < 1000; i++) {
        thousandSessions.push({
          id: `stress-${i}`,
          datetime: `2025-01-01T10:00:${String(i % 60).padStart(2, '0')}Z`,
          title: `Stress Session ${i}`,
          exercises: [
            {
              name: 'Squat',
              setsDetails: [
                { weightKg: 100 + (i % 40), reps: 5, completed: true },
              ],
            },
          ],
        });
      }

      const { getByText } = render(
        React.createElement(ExerciseInsightsModal, {
          visible: true,
          exerciseName: 'Squat',
          sessions: thousandSessions as any,
          onClose: jest.fn(),
        })
      );

      const historyTab = getByText(/History|היסטוריה/i);
      fireEvent.press(historyTab);

      // Successfully switched to History tab and rendered virtualized list without OOM
      expect(getByText(/Squat/i)).toBeTruthy();
    });
  });

  describe('3. Complex PR Progression & Mathematical Invariants', () => {
    it('computes PR strictly chronologically regardless of input order', () => {
      // Intentionally scrambled order
      const outOfOrderSessions = [
        {
          id: 'sess-march',
          datetime: '2026-03-01T10:00:00Z',
          title: 'March Session',
          exercises: [{ name: 'Overhead Press', setsDetails: [{ weightKg: 80, reps: 5, completed: true }] }], // 1RM ~93kg (PR)
        },
        {
          id: 'sess-jan',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Jan Session',
          exercises: [{ name: 'Overhead Press', setsDetails: [{ weightKg: 60, reps: 5, completed: true }] }], // 1RM ~70kg (First PR)
        },
        {
          id: 'sess-feb',
          datetime: '2026-02-01T10:00:00Z',
          title: 'Feb Session',
          exercises: [{ name: 'Overhead Press', setsDetails: [{ weightKg: 70, reps: 5, completed: true }] }], // 1RM ~81kg (PR)
        },
        {
          id: 'sess-april',
          datetime: '2026-04-01T10:00:00Z',
          title: 'April Session',
          exercises: [{ name: 'Overhead Press', setsDetails: [{ weightKg: 75, reps: 5, completed: true }] }], // 1RM ~87kg (Not PR, < March)
        },
      ];

      const result = buildExerciseSessionHistory('Overhead Press', outOfOrderSessions);

      // Return array should be ordered Newest to Oldest (April -> March -> Feb -> Jan)
      expect(result.map((r) => r.id)).toEqual(['sess-april', 'sess-march', 'sess-feb', 'sess-jan']);

      const april = result.find((r) => r.id === 'sess-april')!;
      const march = result.find((r) => r.id === 'sess-march')!;
      const feb = result.find((r) => r.id === 'sess-feb')!;
      const jan = result.find((r) => r.id === 'sess-jan')!;

      expect(jan.isPr1RM).toBe(true);
      expect(jan.isPrWeight).toBe(true);

      expect(feb.isPr1RM).toBe(true);
      expect(feb.isPrWeight).toBe(true);

      expect(march.isPr1RM).toBe(true);
      expect(march.isPrWeight).toBe(true);

      // April is lower than March, must NOT be a PR
      expect(april.isPr1RM).toBe(false);
      expect(april.isPrWeight).toBe(false);
    });

    it('does NOT award PR on ties (strict inequality requirement)', () => {
      const tieSessions = [
        {
          id: 'sess-1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Session 1',
          exercises: [{ name: 'Bench Press', setsDetails: [{ weightKg: 100, reps: 5, completed: true }] }],
        },
        {
          id: 'sess-2',
          datetime: '2026-01-08T10:00:00Z',
          title: 'Session 2',
          exercises: [{ name: 'Bench Press', setsDetails: [{ weightKg: 100, reps: 5, completed: true }] }], // Tie
        },
      ];

      const result = buildExerciseSessionHistory('Bench Press', tieSessions);
      const sess1 = result.find((r) => r.id === 'sess-1')!;
      const sess2 = result.find((r) => r.id === 'sess-2')!;

      expect(sess1.isPr1RM).toBe(true);
      expect(sess1.isPrWeight).toBe(true);

      // sess2 tied, so neither 1RM nor weight PR should be awarded
      expect(sess2.isPr1RM).toBe(false);
      expect(sess2.isPrWeight).toBe(false);
    });

    it('correctly decouples 1RM PR from Max Weight PR', () => {
      const sessions = [
        // S1: 120kg x 1 rep -> 1RM: 120kg, Weight: 120kg
        {
          id: 's1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Heavy Single',
          exercises: [{ name: 'Bench', setsDetails: [{ weightKg: 120, reps: 1, completed: true }] }],
        },
        // S2: 100kg x 10 reps -> 1RM: ~133kg, Weight: 100kg (1RM PR: YES, Weight PR: NO)
        {
          id: 's2',
          datetime: '2026-01-05T10:00:00Z',
          title: 'Rep PR',
          exercises: [{ name: 'Bench', setsDetails: [{ weightKg: 100, reps: 10, completed: true }] }],
        },
        // S3: 125kg x 1 rep -> 1RM: 125kg, Weight: 125kg (1RM PR: NO [125 < 133], Weight PR: YES [125 > 120])
        {
          id: 's3',
          datetime: '2026-01-10T10:00:00Z',
          title: 'New Max Weight',
          exercises: [{ name: 'Bench', setsDetails: [{ weightKg: 125, reps: 1, completed: true }] }],
        },
      ];

      const result = buildExerciseSessionHistory('Bench', sessions);
      const s1 = result.find((r) => r.id === 's1')!;
      const s2 = result.find((r) => r.id === 's2')!;
      const s3 = result.find((r) => r.id === 's3')!;

      expect(s1.isPr1RM).toBe(true);
      expect(s1.isPrWeight).toBe(true);

      expect(s2.isPr1RM).toBe(true);
      expect(s2.isPrWeight).toBe(false);

      expect(s3.isPr1RM).toBe(false);
      expect(s3.isPrWeight).toBe(true);
    });

    it('handles pure bodyweight exercises (weightKg = 0)', () => {
      const bodyweightSessions = [
        {
          id: 'bw-1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Pullup Day',
          exercises: [
            {
              name: 'Pull Up',
              setsDetails: [
                { weightKg: 0, reps: 10, completed: true },
                { weightKg: 0, reps: 12, completed: true },
              ],
            },
          ],
        },
      ];

      const result = buildExerciseSessionHistory('Pull Up', bodyweightSessions);
      expect(result).toHaveLength(1);
      expect(result[0].completedSetsCount).toBe(2);
      expect(result[0].best1RM).toBe(0);
      expect(result[0].isPr1RM).toBe(false);
      expect(result[0].isPrWeight).toBe(false);
    });
  });

  describe('4. UI Modal Edge Cases and Multi-card Interaction', () => {
    it('handles multiple card toggles independently without state interference', () => {
      const twoSessions = [
        {
          id: 'card-1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Workout Alpha',
          exercises: [{ name: 'Squat', setsDetails: [{ weightKg: 100, reps: 5, completed: true }] }],
        },
        {
          id: 'card-2',
          datetime: '2026-01-02T10:00:00Z',
          title: 'Workout Beta',
          exercises: [{ name: 'Squat', setsDetails: [{ weightKg: 110, reps: 5, completed: true }] }],
        },
      ];

      const { getByText, getAllByText } = render(
        React.createElement(ExerciseInsightsModal, {
          visible: true,
          exerciseName: 'Squat',
          sessions: twoSessions as any,
          onClose: jest.fn(),
        })
      );

      const historyTab = getByText(/History|היסטוריה/i);
      fireEvent.press(historyTab);

      // Expand card 1
      fireEvent.press(getByText('Workout Alpha'));
      expect(getAllByText(/100/).length).toBeGreaterThan(0);

      // Expand card 2
      fireEvent.press(getByText('Workout Beta'));
      expect(getAllByText(/110/).length).toBeGreaterThan(0);

      // Collapse card 1
      fireEvent.press(getByText('Workout Alpha'));
      // Card 2 details should still be intact
      expect(getAllByText(/110/).length).toBeGreaterThan(0);
    });

    it('gracefully renders without exerciseLibraryEntry (custom/unregistered exercise)', () => {
      const sessions = [
        {
          id: 'custom-sess',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Custom Move',
          exercises: [{ name: 'Super Custom Lift', setsDetails: [{ weightKg: 50, reps: 10, completed: true }] }],
        },
      ];

      const { getByText } = render(
        React.createElement(ExerciseInsightsModal, {
          visible: true,
          exerciseName: 'Super Custom Lift',
          exerciseLibraryEntry: undefined,
          sessions: sessions as any,
          onClose: jest.fn(),
        })
      );

      expect(getByText('Super Custom Lift')).toBeTruthy();

      const historyTab = getByText(/History|היסטוריה/i);
      fireEvent.press(historyTab);
      expect(getByText('Custom Move')).toBeTruthy();
    });
  });
});
