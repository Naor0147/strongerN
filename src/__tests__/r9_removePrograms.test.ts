import * as mockDataModule from '../data/mockData';
import { getNextWorkout } from '../utils/workout';

describe('R9 Clean Removal of Programs Feature', () => {
  it('mockData does not export mockPrograms', () => {
    expect((mockDataModule as any).mockPrograms).toBeUndefined();
    expect((mockDataModule as any).TrainingProgram).toBeUndefined();
  });

  it('getNextWorkout predicts next routine based on templates without program dependency', () => {
    const templates = [
      {
        id: 't1',
        name: 'Push Day',
        exercises: ['Bench Press'],
        lastUsed: new Date('2026-01-01'),
      },
      {
        id: 't2',
        name: 'Pull Day',
        exercises: ['Deadlift'],
        lastUsed: new Date('2026-01-02'),
      },
    ];

    const colors = {
      accent: '#4F8EF7',
      violet: '#38BDF8',
      highlight: '#38BDF8',
    };

    const next = getNextWorkout(null, [], templates, colors);
    expect(next).toBeDefined();
    expect(next.type).toBe('Routine Split');
    expect(next.name).toBe('Push Day');
  });

  it('getNextWorkout falls back to Quick Start if no templates exist', () => {
    const colors = {
      accent: '#4F8EF7',
      violet: '#38BDF8',
      highlight: '#38BDF8',
    };

    const next = getNextWorkout(null, [], [], colors);
    expect(next.type).toBe('Quick Start');
    expect(next.name).toBe('Empty Workout');
  });
});
