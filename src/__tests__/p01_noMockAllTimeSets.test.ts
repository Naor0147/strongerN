jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

import { mockExercises } from '../data/mockData';
import { computeEnrichedExercises } from '../screens/ExercisesScreen';

describe('P0 Production Data Integrity & Mock Removal', () => {
  it('every seeded exercise in mockExercises has allTimeSets === 0 or undefined', () => {
    expect(mockExercises.length).toBeGreaterThan(0);
    mockExercises.forEach((ex) => {
      expect(ex.allTimeSets ?? 0).toBe(0);
    });
  });

  it('mockData module does not export mockExerciseHistory', () => {
    const mockDataModule = require('../data/mockData');
    expect(mockDataModule.mockExerciseHistory).toBeUndefined();
  });

  it('computeEnrichedExercises returns 0 sets when sessions list is empty', () => {
    const enriched = computeEnrichedExercises(mockExercises.slice(0, 5), []);
    enriched.forEach((ex) => {
      expect(ex.allTimeSets).toBe(0);
      expect(ex.weeklySets).toBe(0);
    });
  });

  it('computeEnrichedExercises aggregates sets accurately from sessions', () => {
    const testSessions = [
      {
        id: 's1',
        datetime: new Date().toISOString(),
        exercises: [
          {
            name: mockExercises[0].name,
            sets: 3,
          },
        ],
      },
      {
        id: 's2',
        datetime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        exercises: [
          {
            name: mockExercises[0].name,
            setsDetails: [{ reps: 10, weightKg: 50 }, { reps: 8, weightKg: 55 }],
          },
        ],
      },
    ];

    const enriched = computeEnrichedExercises([mockExercises[0]], testSessions);
    expect(enriched[0].allTimeSets).toBe(5); // 3 from s1 + 2 from s2
    expect(enriched[0].weeklySets).toBe(3); // only s1 is within 7 days
  });
});
