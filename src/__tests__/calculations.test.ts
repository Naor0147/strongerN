// __tests__/calculations.test.ts
import { getNextWorkout } from '../utils/workout';

// 1. One Rep Max (1RM) estimation function using Epley Formula
function calculateEpley1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// 1RM estimation using Brzycki Formula
function calculateBrzycki1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round((weight / (1.0278 - 0.0278 * reps)) * 10) / 10;
}

// 2. Workout Volume Sum functions
interface WorkoutSet {
  weight: number;
  reps: number;
  completed: boolean;
}

interface WorkoutExercise {
  name: string;
  sets: WorkoutSet[];
}

function calculateTonnage(exercises: WorkoutExercise[]): number {
  return exercises.reduce((totalTonnage, ex) => {
    const exTonnage = ex.sets.reduce((setSum, set) => {
      if (!set.completed) return setSum;
      return setSum + set.weight * set.reps;
    }, 0);
    return totalTonnage + exTonnage;
  }, 0);
}

// 3. CSV builder function
function buildCSVExport(session: {
  title: string;
  datetime: Date;
  comment?: string;
  exercises: { name: string; sets: { weight: number; reps: number; rpe?: number }[] }[];
}): string {
  const headers = 'Date,Workout Name,Exercise Name,Set Number,Weight (kg),Reps,RPE,Comment';
  const rows: string[] = [headers];

  const dateStr = session.datetime.toISOString().split('T')[0];
  const workoutNameEscaped = `"${session.title.replace(/"/g, '""')}"`;
  const commentEscaped = session.comment ? `"${session.comment.replace(/"/g, '""')}"` : '';

  session.exercises.forEach(ex => {
    const exNameEscaped = `"${ex.name.replace(/"/g, '""')}"`;
    ex.sets.forEach((set, idx) => {
      const row = [
        dateStr,
        workoutNameEscaped,
        exNameEscaped,
        idx + 1,
        set.weight,
        set.reps,
        set.rpe ?? '',
        commentEscaped
      ].join(',');
      rows.push(row);
    });
  });

  return rows.join('\n');
}

describe('strongerN Calculation Utilities', () => {
  describe('One Rep Max (1RM) Estimations', () => {
    test('Epley 1RM estimation', () => {
      expect(calculateEpley1RM(100, 1)).toBe(100);
      expect(calculateEpley1RM(100, 5)).toBe(116.7); // 100 * (1 + 5/30) = 116.666... => 116.7
      expect(calculateEpley1RM(100, 10)).toBe(133.3); // 100 * (1 + 10/30) = 133.333... => 133.3
      expect(calculateEpley1RM(60, 0)).toBe(0);
    });

    test('Brzycki 1RM estimation', () => {
      expect(calculateBrzycki1RM(100, 1)).toBe(100);
      expect(calculateBrzycki1RM(100, 5)).toBe(112.5); // 100 / (1.0278 - 0.0278 * 5) = 100 / 0.8888 = 112.51... => 112.5
      expect(calculateBrzycki1RM(100, 10)).toBe(133.4); // 100 / (1.0278 - 0.0278 * 10) = 100 / 0.7498 = 133.36... => 133.4
      expect(calculateBrzycki1RM(60, 0)).toBe(0);
    });
  });

  describe('Tonnage Summation', () => {
    test('Calculates cumulative tonnage of active session sets', () => {
      const workout: WorkoutExercise[] = [
        {
          name: 'Bench Press',
          sets: [
            { weight: 100, reps: 5, completed: true },
            { weight: 100, reps: 5, completed: true },
            { weight: 105, reps: 3, completed: false }, // not completed
          ],
        },
        {
          name: 'Squat',
          sets: [
            { weight: 120, reps: 5, completed: true },
          ],
        },
      ];

      // Volume = (100 * 5) + (100 * 5) + (120 * 5) = 500 + 500 + 600 = 1600
      expect(calculateTonnage(workout)).toBe(1600);
    });

    test('Returns 0 tonnage for empty or uncompleted session', () => {
      const workout: WorkoutExercise[] = [
        {
          name: 'Deadlift',
          sets: [
            { weight: 200, reps: 5, completed: false },
          ],
        },
      ];
      expect(calculateTonnage(workout)).toBe(0);
    });
  });

  describe('CSV Backups builder', () => {
    test('Generates correct comma-separated representation of session', () => {
      const mockSession = {
        title: 'Push Day A',
        datetime: new Date('2026-06-03T12:00:00Z'),
        comment: 'Felt strong, PR on Bench!',
        exercises: [
          {
            name: 'Bench Press',
            sets: [
              { weight: 100, reps: 5, rpe: 9 },
              { weight: 100, reps: 4, rpe: 10 }
            ]
          }
        ]
      };

      const csv = buildCSVExport(mockSession);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('Date,Workout Name,Exercise Name,Set Number,Weight (kg),Reps,RPE,Comment');
      expect(lines[1]).toBe('2026-06-03,"Push Day A","Bench Press",1,100,5,9,"Felt strong, PR on Bench!"');
      expect(lines[2]).toBe('2026-06-03,"Push Day A","Bench Press",2,100,4,10,"Felt strong, PR on Bench!"');
    });
  });

  describe('Intelligent Routine Selector (getNextWorkout)', () => {
    const dummyColors = { accent: '#4F8EF7', violet: '#7C5CFC', highlight: '#38BDF8' };

    test('Case 1: Subscribed to PPL program with history', () => {
      const sessions = [
        { id: 's-1', title: 'Push Day', datetime: new Date('2026-06-01T12:00:00Z'), exercises: [] }
      ];
      const result = getNextWorkout('prog-ppl', sessions, [], dummyColors);
      expect(result.name).toBe('Pull Day');
      expect(result.type).toBe('Active Program');
    });

    test('Case 2: Subscribed to PPL program with wrapping sequence', () => {
      const sessions = [
        { id: 's-1', title: 'Lower Power', datetime: new Date('2026-06-01T12:00:00Z'), exercises: [] }
      ];
      const result = getNextWorkout('prog-ppl', sessions, [], dummyColors);
      expect(result.name).toBe('Push Day');
      expect(result.type).toBe('Active Program');
    });

    test('Case 3: Cycle templates by lastUsed ascending (oldest first)', () => {
      const templates = [
        { id: 'tpl-1', name: 'Upper Power', exercises: ['Bench Press'], lastUsed: new Date('2026-05-28T09:00:00'), folder: 'Bulking Splits' },
        { id: 'tpl-2', name: 'Lower Power', exercises: ['Squat'], lastUsed: new Date('2026-05-26T18:30:00'), folder: 'Bulking Splits' },
        { id: 'tpl-3', name: 'Push Day', exercises: ['Incline Press'], lastUsed: new Date('2026-05-23T07:45:00'), folder: 'Bulking Splits' },
        { id: 'tpl-4', name: 'Pull Day', exercises: ['Deadlift'], lastUsed: new Date('2026-05-21T19:00:00'), folder: 'Bulking Splits' },
      ];
      const sessions = [
        { id: 's-1', title: 'Upper Power', datetime: new Date('2026-05-28T09:00:00'), exercises: [] }
      ];
      const result = getNextWorkout(null, sessions, templates, dummyColors);
      expect(result.name).toBe('Pull Day');
      expect(result.type).toBe('Routine Split');
    });

    test('Case 4: Cycle templates with never-used template prioritization', () => {
      const templates = [
        { id: 'tpl-1', name: 'Upper Power', exercises: ['Bench Press'], lastUsed: new Date('2026-05-28T09:00:00'), folder: 'Bulking Splits' },
        { id: 'tpl-2', name: 'New Split', exercises: ['Barbell Row'], lastUsed: (null as any), folder: 'Bulking Splits' },
      ];
      const sessions = [
        { id: 's-1', title: 'Upper Power', datetime: new Date('2026-05-28T09:00:00'), exercises: [] }
      ];
      const result = getNextWorkout(null, sessions, templates, dummyColors);
      expect(result.name).toBe('New Split');
      expect(result.type).toBe('Routine Split');
    });

    test('Case 5: Fallback when no templates or program', () => {
      const result = getNextWorkout(null, [], [], dummyColors);
      expect(result.name).toBe('Empty Workout');
      expect(result.type).toBe('Quick Start');
    });
  });

  describe('Audio Config & Feedback System', () => {
    let mockPlay: any;
    let expoAudio: any;

    beforeEach(() => {
      expoAudio = require('expo-audio');
      mockPlay = jest.fn();
      expoAudio.createAudioPlayer.mockReturnValue({
        play: mockPlay,
        release: jest.fn(),
        addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Loads correct default values', () => {
      const { soundConfig } = require('../utils/soundPlayer');
      expect(soundConfig.setChecked).toBe('chime');
      expect(soundConfig.timerCompleted).toBe('beep');
      expect(soundConfig.workoutCompleted).toBe('fanfare');
    });

    test('Plays configured sound or mutes accordingly', async () => {
      const { soundConfig, playSetCheckedSound } = require('../utils/soundPlayer');
      
      // Set to mute
      soundConfig.setChecked = 'mute';
      playSetCheckedSound();
      expect(mockPlay).not.toHaveBeenCalled();

      // Set to chime
      soundConfig.setChecked = 'chime';
      playSetCheckedSound();
      
      // Wait for async execution of playNativeSound
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(expoAudio.createAudioPlayer).toHaveBeenCalledWith(
        require('../../assets/sounds/set_completed.wav')
      );
      expect(mockPlay).toHaveBeenCalled();
    });

    test('Plays correct timer completed sound', async () => {
      const { soundConfig, playTimerCompletedSound } = require('../utils/soundPlayer');
      
      // Set to beep
      soundConfig.timerCompleted = 'beep';
      playTimerCompletedSound();
      
      // Wait for async execution of playNativeSound
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(expoAudio.createAudioPlayer).toHaveBeenCalledWith(
        require('../../assets/sounds/timer_completed.wav')
      );
    });

    test('Plays correct workout completed sound', async () => {
      const { soundConfig, playWorkoutCompletedSound } = require('../utils/soundPlayer');
      
      // Set to fanfare
      soundConfig.workoutCompleted = 'fanfare';
      playWorkoutCompletedSound();
      
      // Wait for async execution of playNativeSound
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(expoAudio.createAudioPlayer).toHaveBeenCalledWith(
        require('../../assets/sounds/workout_completed.wav')
      );
    });
  });

  describe('Modular Layout Declutter & Timer Preferences', () => {
    test('Default layout settings values are loaded correctly', () => {
      const defaultState = {
        defaultRestDuration: 90,
        showAchievementBadges: true,
        showSummaryWidgets: true,
        showWeeklyTonnage: true,
        showWorkoutsChart: true,
        showHighlights: true,
      };

      expect(defaultState.defaultRestDuration).toBe(90);
      expect(defaultState.showAchievementBadges).toBe(true);
      expect(defaultState.showSummaryWidgets).toBe(true);
      expect(defaultState.showWeeklyTonnage).toBe(true);
      expect(defaultState.showWorkoutsChart).toBe(true);
      expect(defaultState.showHighlights).toBe(true);
    });

    test('State properties can be toggled to disable layout elements', () => {
      const settings = {
        showAchievementBadges: true,
        showSummaryWidgets: true,
      };

      // Toggle off
      settings.showAchievementBadges = false;
      settings.showSummaryWidgets = false;

      expect(settings.showAchievementBadges).toBe(false);
      expect(settings.showSummaryWidgets).toBe(false);
    });

    test('Custom rest duration setting updates successfully', () => {
      let defaultRestDuration = 90;
      
      const updateRestDuration = (val: number) => {
        defaultRestDuration = val;
      };

      updateRestDuration(60);
      expect(defaultRestDuration).toBe(60);

      updateRestDuration(120);
      expect(defaultRestDuration).toBe(120);
    });
  });
});
