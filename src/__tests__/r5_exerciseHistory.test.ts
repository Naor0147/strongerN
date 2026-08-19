import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  buildExerciseSessionHistory,
  ExerciseHistorySession,
  ExerciseHistorySet,
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

describe('R5 Exercise History Breakdown & Virtualization', () => {
  describe('buildExerciseSessionHistory engine', () => {
    it('returns empty array for invalid or empty inputs', () => {
      expect(buildExerciseSessionHistory('', [])).toEqual([]);
      expect(buildExerciseSessionHistory('Bench Press', null as any)).toEqual([]);
      expect(buildExerciseSessionHistory('Bench Press', undefined as any)).toEqual([]);
      expect(buildExerciseSessionHistory('Bench Press', [])).toEqual([]);
      expect(buildExerciseSessionHistory(null as any, [{ id: '1' }])).toEqual([]);
    });

    it('filters sessions matching target exercise case-insensitively and trimmed', () => {
      const sessions = [
        {
          id: 'sess-1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Push Day',
          exercises: [{ name: '  Bench Press  ', setsDetails: [{ weightKg: 100, reps: 5, completed: true }] }],
        },
        {
          id: 'sess-2',
          datetime: '2026-01-02T10:00:00Z',
          title: 'Leg Day',
          exercises: [{ name: 'Squat', setsDetails: [{ weightKg: 140, reps: 5, completed: true }] }],
        },
      ];
      const result = buildExerciseSessionHistory('bench press', sessions);
      expect(result).toHaveLength(1);
      expect(result[0].workoutTitle).toBe('Push Day');
      expect(result[0].sets).toHaveLength(1);
    });

    it('matches exercises with nameSnapshot when name is absent', () => {
      const sessions = [
        {
          id: 'sess-snapshot',
          datetime: '2026-01-05T10:00:00Z',
          title: 'Chest Focus',
          exercises: [{ nameSnapshot: 'Incline Bench Press', sets: [{ weightKg: 80, reps: 8, completed: true }] }],
        },
      ];
      const result = buildExerciseSessionHistory('incline bench press', sessions);
      expect(result).toHaveLength(1);
      expect(result[0].workoutTitle).toBe('Chest Focus');
      expect(result[0].sets[0].weightKg).toBe(80);
    });

    it('sorts output descending (newest first) and computes chronological PR flags accurately', () => {
      const sessions = [
        {
          id: 'sess-3',
          datetime: '2026-03-01T10:00:00Z',
          title: 'Workout 3',
          exercises: [{ name: 'Overhead Press', setsDetails: [{ weightKg: 60, reps: 5, completed: true }] }], // 1RM ~70kg (lower than sess-2)
        },
        {
          id: 'sess-1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Workout 1',
          exercises: [{ name: 'Overhead Press', setsDetails: [{ weightKg: 50, reps: 5, completed: true }] }], // 1RM ~58kg -> PR 1RM & PR Weight
        },
        {
          id: 'sess-2',
          datetime: '2026-02-01T10:00:00Z',
          title: 'Workout 2',
          exercises: [{ name: 'Overhead Press', setsDetails: [{ weightKg: 70, reps: 5, completed: true }] }], // 1RM ~81kg -> PR 1RM & PR Weight
        },
      ];

      const result = buildExerciseSessionHistory('Overhead Press', sessions);
      expect(result).toHaveLength(3);
      // Newest first
      expect(result[0].id).toBe('sess-3');
      expect(result[0].isPr1RM).toBe(false);
      expect(result[0].isPrWeight).toBe(false);

      expect(result[1].id).toBe('sess-2');
      expect(result[1].isPr1RM).toBe(true);
      expect(result[1].isPrWeight).toBe(true);

      expect(result[2].id).toBe('sess-1');
      expect(result[2].isPr1RM).toBe(true);
      expect(result[2].isPrWeight).toBe(true);
    });

    it('ignores incomplete sets when computing best1RM, bestSet, and PR flags', () => {
      const sessions = [
        {
          id: 'sess-1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Chest Day',
          exercises: [
            {
              name: 'Incline Dumbbell Press',
              setsDetails: [
                { weightKg: 30, reps: 10, completed: true },
                { weightKg: 50, reps: 10, completed: false }, // Incomplete heavy set
              ],
            },
          ],
        },
      ];

      const result = buildExerciseSessionHistory('Incline Dumbbell Press', sessions);
      expect(result[0].completedSetsCount).toBe(1);
      expect(result[0].bestSet?.weightKg).toBe(30);
      expect(result[0].best1RM).toBeLessThan(50);
    });

    it('falls back to first set when no sets are completed', () => {
      const sessions = [
        {
          id: 'sess-uncompleted',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Failed Session',
          exercises: [
            {
              name: 'Deadlift',
              setsDetails: [
                { weightKg: 100, reps: 5, completed: false },
              ],
            },
          ],
        },
      ];

      const result = buildExerciseSessionHistory('Deadlift', sessions);
      expect(result[0].completedSetsCount).toBe(0);
      expect(result[0].bestSet?.weightKg).toBe(100);
      expect(result[0].isPr1RM).toBe(false);
      expect(result[0].isPrWeight).toBe(false);
    });

    it('preserves unilateral fields and defaults category to S when omitted', () => {
      const sessions = [
        {
          id: 'sess-1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Arms',
          exercises: [
            {
              name: 'Dumbbell Curl',
              setsDetails: [
                {
                  weightKg: 16,
                  reps: 12,
                  completed: true,
                  category: 'D',
                  isUnilateral: true,
                  leftWeightKg: 16,
                  leftReps: 12,
                  rightWeightKg: 16,
                  rightReps: 12,
                  rpe: 9,
                },
                {
                  weightKg: 14,
                  reps: 10,
                  completed: true,
                  // category omitted -> should default to 'S'
                },
              ],
            },
          ],
        },
      ];

      const result = buildExerciseSessionHistory('Dumbbell Curl', sessions);
      const set1 = result[0].sets[0];
      expect(set1.category).toBe('D');
      expect(set1.isUnilateral).toBe(true);
      expect(set1.leftWeightKg).toBe(16);
      expect(set1.rightWeightKg).toBe(16);
      expect(set1.rpe).toBe(9);

      const set2 = result[0].sets[1];
      expect(set2.category).toBe('S');
    });
  });

  describe('ExerciseInsightsModal History Tab UI Integration', () => {
    const mockSessions = [
      {
        id: 'sess-pr',
        datetime: '2026-02-15T10:00:00Z',
        title: 'Push Power',
        exercises: [
          {
            name: 'Bench Press',
            setsDetails: [
              { weightKg: 100, reps: 5, completed: true, category: 'S' },
              { weightKg: 105, reps: 3, completed: true, category: 'S' },
            ],
          },
        ],
      },
    ];

    it('renders virtualized history session cards with PR badge and expands set details on press', () => {
      const { getByText, getAllByText } = render(
        React.createElement(ExerciseInsightsModal, {
          visible: true,
          exerciseName: 'Bench Press',
          sessions: mockSessions as any,
          onClose: jest.fn(),
        })
      );

      // Switch to History tab
      const historyTab = getByText(/History|היסטוריה/i);
      fireEvent.press(historyTab);

      // Verify session card renders
      expect(getByText('Push Power')).toBeTruthy();
      expect(getByText('PR 1RM')).toBeTruthy();
      expect(getByText('MAX WT')).toBeTruthy();

      // Tap card to expand details
      fireEvent.press(getByText('Push Power'));

      // Verify set rows are visible
      expect(getAllByText(/105/).length).toBeGreaterThanOrEqual(1);
      expect(getAllByText(/100/).length).toBeGreaterThanOrEqual(1);
    });

    it('renders unilateral details and RPE in expanded set rows', () => {
      const unilateralSessions = [
        {
          id: 'sess-uni',
          datetime: '2026-03-01T10:00:00Z',
          title: 'Unilateral Focus',
          exercises: [
            {
              name: 'Bulgarian Split Squat',
              setsDetails: [
                {
                  weightKg: 24,
                  reps: 8,
                  completed: true,
                  category: 'D',
                  isUnilateral: true,
                  leftWeightKg: 24,
                  leftReps: 8,
                  rightWeightKg: 24,
                  rightReps: 8,
                  rpe: 8.5,
                },
              ],
            },
          ],
        },
      ];

      const { getByText } = render(
        React.createElement(ExerciseInsightsModal, {
          visible: true,
          exerciseName: 'Bulgarian Split Squat',
          sessions: unilateralSessions as any,
          onClose: jest.fn(),
        })
      );

      const historyTab = getByText(/History|היסטוריה/i);
      fireEvent.press(historyTab);

      expect(getByText('Unilateral Focus')).toBeTruthy();

      // Expand accordion
      fireEvent.press(getByText('Unilateral Focus'));

      // Check category badge, unilateral text, RPE
      expect(getByText('D')).toBeTruthy();
      expect(getByText(/L: 24kg/i)).toBeTruthy();
      expect(getByText(/@8.5/i)).toBeTruthy();
    });

    it('renders empty history fallback when no session history matches', () => {
      const { getByText } = render(
        React.createElement(ExerciseInsightsModal, {
          visible: true,
          exerciseName: 'NonExistent Exercise',
          sessions: mockSessions as any,
          onClose: jest.fn(),
        })
      );

      const historyTab = getByText(/History|היסטוריה/i);
      fireEvent.press(historyTab);

      expect(getByText(/No training history found/i)).toBeTruthy();
    });
  });
});
