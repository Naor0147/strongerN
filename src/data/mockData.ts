// data/mockData.ts — All mock data and TypeScript interfaces

// ─────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────

export interface User {
  name: string;
  avatarUri?: string;
  totalWorkouts: number;
  isPro: boolean;
}

export interface ChartDataPoint {
  weekLabel: string;
  count: number;
}

export interface SetDetail {
  weight: number;
  reps: number;
  completed: boolean;
  rpe?: number;
  category?: 'W' | 'S' | 'D' | 'F';
}

export interface ExerciseSet {
  name: string;
  sets: number;
  bestWeight: number;
  bestReps: number;
  rpe?: number;
  setsDetails?: SetDetail[];
}

export interface WorkoutSession {
  id: string;
  title: string;
  datetime: Date;
  comment?: string;
  exercises: ExerciseSet[];
  durationMinutes: number;
  totalVolumeKg: number;
  prs: number;
}

export interface Template {
  id: string;
  name: string;
  exercises: string[];
  lastUsed: Date;
  folder?: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  imageUri?: string;
  weeklySets: number;
  notes?: string;
  equipment?: string;
}

export interface MeasureHistoryEntry {
  date: string;
  value: number;
}

export interface MeasureItem {
  id: string;
  label: string;
  lastValue?: string;
  history?: MeasureHistoryEntry[];
}

export interface ProgramDay {
  dayNumber: number;
  workoutName: string;
  exercises: string[];
}

export interface TrainingProgram {
  id: string;
  name: string;
  weeks: number;
  description: string;
  days: ProgramDay[];
}

// ─────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────

export const mockUser: User = {
  name: 'Alex Morgan',
  totalWorkouts: 142,
  isPro: true,
};

export const mockChartData: ChartDataPoint[] = [
  { weekLabel: 'Apr 7',  count: 3 },
  { weekLabel: 'Apr 14', count: 5 },
  { weekLabel: 'Apr 21', count: 2 },
  { weekLabel: 'Apr 28', count: 6 },
  { weekLabel: 'May 5',  count: 4 },
  { weekLabel: 'May 12', count: 3 },
  { weekLabel: 'May 19', count: 5 },
  { weekLabel: 'May 26', count: 4 },
];

export const mockSessions: WorkoutSession[] = [
  {
    id: 'session-1',
    title: 'Upper Body Power',
    datetime: new Date('2026-05-28T09:00:00'),
    comment: 'Felt strong today, new PR on bench!',
    exercises: [
      { name: 'Bench Press', sets: 4, bestWeight: 100, bestReps: 5, rpe: 8 },
      { name: 'Overhead Press', sets: 3, bestWeight: 65, bestReps: 6, rpe: 7.5 },
      { name: 'Pull-ups', sets: 4, bestWeight: 20, bestReps: 8, rpe: 8.5 },
    ],
    durationMinutes: 62,
    totalVolumeKg: 4850,
    prs: 2,
  },
  {
    id: 'session-2',
    title: 'Lower Body Strength',
    datetime: new Date('2026-05-26T18:30:00'),
    exercises: [
      { name: 'Back Squat', sets: 5, bestWeight: 120, bestReps: 5, rpe: 9 },
      { name: 'Romanian Deadlift', sets: 3, bestWeight: 100, bestReps: 8 },
      { name: 'Leg Press', sets: 4, bestWeight: 200, bestReps: 10 },
      { name: 'Calf Raises', sets: 3, bestWeight: 80, bestReps: 15 },
    ],
    durationMinutes: 75,
    totalVolumeKg: 7200,
    prs: 1,
  },
  {
    id: 'session-3',
    title: 'Push Day',
    datetime: new Date('2026-05-23T07:45:00'),
    comment: 'Shoulders were a bit tight',
    exercises: [
      { name: 'Incline Bench Press', sets: 4, bestWeight: 85, bestReps: 8, rpe: 8 },
      { name: 'Cable Fly', sets: 3, bestWeight: 25, bestReps: 12 },
      { name: 'Lateral Raise', sets: 4, bestWeight: 15, bestReps: 15, rpe: 7 },
      { name: 'Tricep Dips', sets: 3, bestWeight: 0, bestReps: 12 },
    ],
    durationMinutes: 55,
    totalVolumeKg: 3600,
    prs: 0,
  },
  {
    id: 'session-4',
    title: 'Pull Day',
    datetime: new Date('2026-05-21T19:00:00'),
    exercises: [
      { name: 'Deadlift', sets: 4, bestWeight: 160, bestReps: 3, rpe: 9.5 },
      { name: 'Barbell Row', sets: 4, bestWeight: 90, bestReps: 6, rpe: 8 },
      { name: 'Lat Pulldown', sets: 3, bestWeight: 75, bestReps: 10 },
    ],
    durationMinutes: 68,
    totalVolumeKg: 5500,
    prs: 1,
  },
  {
    id: 'session-5',
    title: 'Full Body Hypertrophy',
    datetime: new Date('2026-04-29T10:15:00'),
    comment: 'Great pump throughout!',
    exercises: [
      { name: 'Goblet Squat', sets: 3, bestWeight: 32, bestReps: 12 },
      { name: 'Dumbbell Press', sets: 4, bestWeight: 36, bestReps: 10, rpe: 7.5 },
      { name: 'Seated Row', sets: 3, bestWeight: 65, bestReps: 10 },
      { name: 'Hip Thrust', sets: 4, bestWeight: 110, bestReps: 12, rpe: 8 },
    ],
    durationMinutes: 58,
    totalVolumeKg: 4200,
    prs: 0,
  },
  {
    id: 'session-6',
    title: 'Arm Specialization',
    datetime: new Date('2026-04-24T17:00:00'),
    exercises: [
      { name: 'EZ Bar Curl', sets: 4, bestWeight: 40, bestReps: 10, rpe: 8 },
      { name: 'Hammer Curl', sets: 3, bestWeight: 18, bestReps: 12 },
      { name: 'Skull Crushers', sets: 4, bestWeight: 35, bestReps: 10, rpe: 7.5 },
      { name: 'Cable Pushdown', sets: 3, bestWeight: 30, bestReps: 15 },
    ],
    durationMinutes: 48,
    totalVolumeKg: 2900,
    prs: 0,
  },
  {
    id: 'session-7',
    title: 'Leg Conditioning',
    datetime: new Date('2026-04-22T08:00:00'),
    comment: 'High volume, moderate weights',
    exercises: [
      { name: 'Front Squat', sets: 4, bestWeight: 85, bestReps: 6, rpe: 8 },
      { name: 'Hack Squat', sets: 3, bestWeight: 140, bestReps: 10 },
      { name: 'Leg Curl', sets: 4, bestWeight: 50, bestReps: 12 },
    ],
    durationMinutes: 70,
    totalVolumeKg: 5800,
    prs: 0,
  },
];

export const mockTemplates: Template[] = [
  {
    id: 'tpl-1',
    name: 'Upper Power',
    exercises: ['Bench Press', 'Overhead Press', 'Pull-ups', 'Barbell Row', 'Face Pull'],
    lastUsed: new Date('2026-05-28T09:00:00'),
    folder: 'Bulking Splits',
  },
  {
    id: 'tpl-2',
    name: 'Lower Power',
    exercises: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raises', 'Nordic Curl'],
    lastUsed: new Date('2026-05-26T18:30:00'),
    folder: 'Bulking Splits',
  },
  {
    id: 'tpl-3',
    name: 'Push Day',
    exercises: ['Incline Bench Press', 'Cable Fly', 'Lateral Raise', 'Tricep Dips', 'Rear Delt Fly'],
    lastUsed: new Date('2026-05-23T07:45:00'),
    folder: 'Bulking Splits',
  },
  {
    id: 'tpl-4',
    name: 'Pull Day',
    exercises: ['Deadlift', 'Barbell Row', 'Lat Pulldown', 'Face Pull', 'Bicep Curl'],
    lastUsed: new Date('2026-05-21T19:00:00'),
    folder: 'Bulking Splits',
  },
  {
    id: 'tpl-5',
    name: 'Full Body',
    exercises: ['Goblet Squat', 'Dumbbell Press', 'Seated Row', 'Hip Thrust', 'Plank'],
    lastUsed: new Date('2026-04-29T10:15:00'),
    folder: 'Home Workouts',
  },
  {
    id: 'tpl-6',
    name: 'Arm Specialization',
    exercises: ['EZ Bar Curl', 'Hammer Curl', 'Skull Crushers', 'Cable Pushdown', 'Concentration Curl'],
    lastUsed: new Date('2026-04-24T17:00:00'),
    folder: 'Travel',
  },
];

export const mockPrograms: TrainingProgram[] = [
  {
    id: 'prog-ppl',
    name: '6-Week Push/Pull/Legs',
    weeks: 6,
    description: 'A classic PPL routine designed to optimize muscle growth and recovery. Highlights 3 dynamic workouts per week.',
    days: [
      { dayNumber: 1, workoutName: 'Push Day', exercises: ['Incline Bench Press', 'Cable Fly', 'Lateral Raise', 'Tricep Dips', 'Rear Delt Fly'] },
      { dayNumber: 2, workoutName: 'Pull Day', exercises: ['Deadlift', 'Barbell Row', 'Lat Pulldown', 'Face Pull', 'Bicep Curl'] },
      { dayNumber: 3, workoutName: 'Lower Power', exercises: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raises', 'Nordic Curl'] },
    ]
  },
  {
    id: 'prog-531',
    name: '5/3/1 Powerlifting',
    weeks: 4,
    description: 'An advanced powerlifting program focusing on the big compound lifts. Focuses on squat, bench press, deadlift, and overhead press.',
    days: [
      { dayNumber: 1, workoutName: 'Bench Press Focus', exercises: ['Bench Press', 'Overhead Press', 'Tricep Dips', 'Lateral Raise'] },
      { dayNumber: 2, workoutName: 'Deadlift Focus', exercises: ['Deadlift', 'Barbell Row', 'Pull-ups', 'Face Pull'] },
      { dayNumber: 3, workoutName: 'Squat Focus', exercises: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raises'] },
      { dayNumber: 4, workoutName: 'Military Press Focus', exercises: ['Overhead Press', 'Bench Press', 'Lat Pulldown', 'Bicep Curl'] },
    ]
  }
];

export const mockExercises: Exercise[] = [
  { id: 'ex-1',  name: 'Arnold Press',         muscleGroup: 'Shoulders',  weeklySets: 9,  equipment: 'Dumbbell' },
  { id: 'ex-2',  name: 'Back Squat',            muscleGroup: 'Quads',      weeklySets: 15, equipment: 'Barbell' },
  { id: 'ex-3',  name: 'Barbell Row',           muscleGroup: 'Back',       weeklySets: 12, equipment: 'Barbell' },
  { id: 'ex-4',  name: 'Bench Press',           muscleGroup: 'Chest',      weeklySets: 16, equipment: 'Barbell' },
  { id: 'ex-5',  name: 'Cable Fly',             muscleGroup: 'Chest',      weeklySets: 9,  equipment: 'Cables' },
  { id: 'ex-6',  name: 'Cable Pushdown',        muscleGroup: 'Triceps',    weeklySets: 9,  equipment: 'Cables' },
  { id: 'ex-7',  name: 'Deadlift',              muscleGroup: 'Back',       weeklySets: 10, equipment: 'Barbell' },
  { id: 'ex-8',  name: 'EZ Bar Curl',           muscleGroup: 'Biceps',     weeklySets: 12, equipment: 'Barbell' },
  { id: 'ex-9',  name: 'Face Pull',             muscleGroup: 'Rear Delts', weeklySets: 12, equipment: 'Cables' },
  { id: 'ex-10', name: 'Front Squat',           muscleGroup: 'Quads',      weeklySets: 8,  equipment: 'Barbell' },
  { id: 'ex-11', name: 'Goblet Squat',          muscleGroup: 'Quads',      weeklySets: 6,  equipment: 'Dumbbell' },
  { id: 'ex-12', name: 'Hack Squat',            muscleGroup: 'Quads',      weeklySets: 6,  equipment: 'Machine' },
  { id: 'ex-13', name: 'Hip Thrust',            muscleGroup: 'Glutes',     weeklySets: 12, equipment: 'Barbell' },
  { id: 'ex-14', name: 'Incline Bench Press',   muscleGroup: 'Chest',      weeklySets: 12, equipment: 'Barbell' },
  { id: 'ex-15', name: 'Lateral Raise',         muscleGroup: 'Shoulders',  weeklySets: 15, equipment: 'Dumbbell' },
  { id: 'ex-16', name: 'Leg Curl',              muscleGroup: 'Hamstrings', weeklySets: 9,  equipment: 'Machine' },
  { id: 'ex-17', name: 'Leg Press',             muscleGroup: 'Quads',      weeklySets: 6,  equipment: 'Machine' },
  { id: 'ex-18', name: 'Nordic Curl',           muscleGroup: 'Hamstrings', weeklySets: 6,  equipment: 'Bodyweight' },
  { id: 'ex-19', name: 'Overhead Press',        muscleGroup: 'Shoulders',  weeklySets: 12, equipment: 'Barbell' },
  { id: 'ex-20', name: 'Pull-ups',              muscleGroup: 'Back',       weeklySets: 12, equipment: 'Bodyweight' },
  { id: 'ex-21', name: 'Romanian Deadlift',     muscleGroup: 'Hamstrings', weeklySets: 9,  equipment: 'Barbell' },
  { id: 'ex-22', name: 'Seated Row',            muscleGroup: 'Back',       weeklySets: 9,  equipment: 'Cables' },
  { id: 'ex-23', name: 'Skull Crushers',        muscleGroup: 'Triceps',    weeklySets: 9,  equipment: 'Barbell' },
  { id: 'ex-24', name: 'Tricep Dips',           muscleGroup: 'Triceps',    weeklySets: 6,  equipment: 'Bodyweight' },
  // Missing Referenced Exercises (Used in sessions, templates, and programs)
  { id: 'ex-25', name: 'Calf Raises',           muscleGroup: 'Calves',     weeklySets: 6,  equipment: 'Machine' },
  { id: 'ex-26', name: 'Dumbbell Press',         muscleGroup: 'Chest',      weeklySets: 8,  equipment: 'Dumbbell' },
  { id: 'ex-27', name: 'Hammer Curl',           muscleGroup: 'Biceps',     weeklySets: 8,  equipment: 'Dumbbell' },
  { id: 'ex-28', name: 'Lat Pulldown',          muscleGroup: 'Back',       weeklySets: 9,  equipment: 'Cables' },
  { id: 'ex-29', name: 'Concentration Curl',    muscleGroup: 'Biceps',     weeklySets: 6,  equipment: 'Dumbbell' },
  { id: 'ex-30', name: 'Rear Delt Fly',         muscleGroup: 'Rear Delts', weeklySets: 8,  equipment: 'Dumbbell' },
  { id: 'ex-31', name: 'Plank',                  muscleGroup: 'Core',       weeklySets: 6,  equipment: 'Bodyweight' },
  { id: 'ex-32', name: 'Bicep Curl',             muscleGroup: 'Biceps',     weeklySets: 9,  equipment: 'Dumbbell' },
  // Popular Chest Movements
  { id: 'ex-33', name: 'Decline Bench Press',   muscleGroup: 'Chest',      weeklySets: 6,  equipment: 'Barbell' },
  { id: 'ex-34', name: 'Push-ups',              muscleGroup: 'Chest',      weeklySets: 8,  equipment: 'Bodyweight' },
  { id: 'ex-35', name: 'Pec Dec Fly',            muscleGroup: 'Chest',      weeklySets: 8,  equipment: 'Machine' },
  { id: 'ex-36', name: 'Chest Press (Machine)',  muscleGroup: 'Chest',      weeklySets: 6,  equipment: 'Machine' },
  // Popular Back Movements
  { id: 'ex-37', name: 'Dumbbell Row',           muscleGroup: 'Back',       weeklySets: 8,  equipment: 'Dumbbell' },
  { id: 'ex-38', name: 'T-Bar Row',              muscleGroup: 'Back',       weeklySets: 6,  equipment: 'Barbell' },
  { id: 'ex-39', name: 'Chin-ups',              muscleGroup: 'Back',       weeklySets: 8,  equipment: 'Bodyweight' },
  { id: 'ex-40', name: 'Hyperextensions',        muscleGroup: 'Back',       weeklySets: 6,  equipment: 'Bodyweight' },
  // Popular Shoulder Movements
  { id: 'ex-41', name: 'Dumbbell Shoulder Press',muscleGroup: 'Shoulders',  weeklySets: 9,  equipment: 'Dumbbell' },
  { id: 'ex-42', name: 'Cable Lateral Raise',   muscleGroup: 'Shoulders',  weeklySets: 8,  equipment: 'Cables' },
  { id: 'ex-43', name: 'Reverse Pec Dec Fly',   muscleGroup: 'Rear Delts', weeklySets: 8,  equipment: 'Machine' },
  { id: 'ex-44', name: 'Barbell Shrugs',         muscleGroup: 'Shoulders',  weeklySets: 6,  equipment: 'Barbell' },
  // Popular Arm Movements
  { id: 'ex-45', name: 'Incline Dumbbell Curl',  muscleGroup: 'Biceps',     weeklySets: 8,  equipment: 'Dumbbell' },
  { id: 'ex-46', name: 'Preacher Curl',          muscleGroup: 'Biceps',     weeklySets: 6,  equipment: 'Barbell' },
  { id: 'ex-47', name: 'Cable Bicep Curl',       muscleGroup: 'Biceps',     weeklySets: 6,  equipment: 'Cables' },
  { id: 'ex-48', name: 'Overhead Tricep Ext',    muscleGroup: 'Triceps',    weeklySets: 8,  equipment: 'Dumbbell' },
  { id: 'ex-49', name: 'Close-Grip Bench Press', muscleGroup: 'Triceps',    weeklySets: 8,  equipment: 'Barbell' },
  { id: 'ex-50', name: 'Diamond Push-ups',       muscleGroup: 'Triceps',    weeklySets: 6,  equipment: 'Bodyweight' },
  // Popular Lower Body Movements
  { id: 'ex-51', name: 'Bulgarian Split Squat', muscleGroup: 'Quads',      weeklySets: 8,  equipment: 'Dumbbell' },
  { id: 'ex-52', name: 'Leg Extension',          muscleGroup: 'Quads',      weeklySets: 8,  equipment: 'Machine' },
  { id: 'ex-53', name: 'Lying Leg Curl',         muscleGroup: 'Hamstrings', weeklySets: 8,  equipment: 'Machine' },
  { id: 'ex-54', name: 'Seated Leg Curl',        muscleGroup: 'Hamstrings', weeklySets: 6,  equipment: 'Machine' },
  { id: 'ex-55', name: 'Seated Calf Raise',      muscleGroup: 'Calves',     weeklySets: 6,  equipment: 'Machine' },
  { id: 'ex-56', name: 'Glute Kickback',         muscleGroup: 'Glutes',     weeklySets: 6,  equipment: 'Cables' },
  // Popular Core Movements
  { id: 'ex-57', name: 'Hanging Leg Raise',      muscleGroup: 'Core',       weeklySets: 8,  equipment: 'Bodyweight' },
  { id: 'ex-58', name: 'Ab Wheel Rollout',       muscleGroup: 'Core',       weeklySets: 6,  equipment: 'Other' },
  { id: 'ex-59', name: 'Cable Crunch',           muscleGroup: 'Core',       weeklySets: 8,  equipment: 'Cables' },
  { id: 'ex-60', name: 'Russian Twist',          muscleGroup: 'Core',       weeklySets: 6,  equipment: 'Bodyweight' },
  // Forearm Movements
  { id: 'ex-61', name: 'Barbell Wrist Curl',     muscleGroup: 'Forearms',   weeklySets: 6,  equipment: 'Barbell' },
  { id: 'ex-62', name: 'Dumbbell Wrist Curl',    muscleGroup: 'Forearms',   weeklySets: 6,  equipment: 'Dumbbell' },
  { id: 'ex-63', name: 'Reverse Barbell Curl',   muscleGroup: 'Forearms',   weeklySets: 8,  equipment: 'Barbell' },
  { id: 'ex-64', name: 'Wrist Roller',           muscleGroup: 'Forearms',   weeklySets: 4,  equipment: 'Other' },
  { id: 'ex-65', name: 'Behind-the-Back Curl',   muscleGroup: 'Forearms',   weeklySets: 6,  equipment: 'Barbell' },
  // Additional Popular Movements
  { id: 'ex-66', name: 'Sumo Deadlift',          muscleGroup: 'Back',       weeklySets: 8,  equipment: 'Barbell' },
  { id: 'ex-67', name: 'Dips',                   muscleGroup: 'Triceps',    weeklySets: 8,  equipment: 'Bodyweight' },
  { id: 'ex-68', name: 'Incline Dumbbell Fly',   muscleGroup: 'Chest',      weeklySets: 8,  equipment: 'Dumbbell' },
  { id: 'ex-69', name: 'Close-Grip Lat Pulldown',muscleGroup: 'Back',       weeklySets: 8,  equipment: 'Cables' },
  { id: 'ex-70', name: 'Hammer Strength Row',    muscleGroup: 'Back',       weeklySets: 8,  equipment: 'Machine' },
];

export const mockPrimaryMetrics: MeasureItem[] = [
  {
    id: 'metric-1',
    label: 'Weight',
    lastValue: '82.4 kg',
    history: [
      { date: '2026-05-10', value: 84.2 },
      { date: '2026-05-15', value: 83.8 },
      { date: '2026-05-20', value: 83.1 },
      { date: '2026-05-25', value: 82.7 },
      { date: '2026-05-30', value: 82.4 }
    ]
  },
  {
    id: 'metric-2',
    label: 'Body fat %',
    lastValue: '14.2%',
    history: [
      { date: '2026-05-10', value: 15.1 },
      { date: '2026-05-15', value: 14.8 },
      { date: '2026-05-20', value: 14.6 },
      { date: '2026-05-25', value: 14.4 },
      { date: '2026-05-30', value: 14.2 }
    ]
  },
  {
    id: 'metric-3',
    label: 'Caloric intake',
    lastValue: '2,800 kcal',
    history: [
      { date: '2026-05-10', value: 2750 },
      { date: '2026-05-15', value: 2800 },
      { date: '2026-05-20', value: 2900 },
      { date: '2026-05-25', value: 2800 },
      { date: '2026-05-30', value: 2800 }
    ]
  },
];

export const mockBodyPartMetrics: MeasureItem[] = [
  { id: 'bp-1',  label: 'Neck', lastValue: '38.5 cm', history: [{ date: '2026-05-30', value: 38.5 }] },
  { id: 'bp-2',  label: 'Shoulders', lastValue: '122.0 cm', history: [{ date: '2026-05-30', value: 122.0 }] },
  { id: 'bp-3',  label: 'Chest', lastValue: '108.5 cm', history: [{ date: '2026-05-30', value: 108.5 }] },
  { id: 'bp-4',  label: 'Left bicep', lastValue: '39.2 cm', history: [{ date: '2026-05-30', value: 39.2 }] },
  { id: 'bp-5',  label: 'Right bicep', lastValue: '39.4 cm', history: [{ date: '2026-05-30', value: 39.4 }] },
  { id: 'bp-6',  label: 'Waist', lastValue: '84.0 cm', history: [{ date: '2026-05-30', value: 84.0 }] },
  { id: 'bp-7',  label: 'Hips', lastValue: '98.0 cm', history: [{ date: '2026-05-30', value: 98.0 }] },
  { id: 'bp-8',  label: 'Left thigh', lastValue: '61.0 cm', history: [{ date: '2026-05-30', value: 61.0 }] },
  { id: 'bp-9',  label: 'Right thigh', lastValue: '61.2 cm', history: [{ date: '2026-05-30', value: 61.2 }] },
  { id: 'bp-10', label: 'Left calf', lastValue: '38.0 cm', history: [{ date: '2026-05-30', value: 38.0 }] },
  { id: 'bp-11', label: 'Right calf', lastValue: '38.1 cm', history: [{ date: '2026-05-30', value: 38.1 }] },
];
