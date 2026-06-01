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

export interface ExerciseSet {
  name: string;
  sets: number;
  bestWeight: number;
  bestReps: number;
  rpe?: number;
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
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  imageUri?: string;
  weeklySets: number;
}

export interface MeasureItem {
  id: string;
  label: string;
  lastValue?: string;
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
  },
  {
    id: 'tpl-2',
    name: 'Lower Power',
    exercises: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raises', 'Nordic Curl'],
    lastUsed: new Date('2026-05-26T18:30:00'),
  },
  {
    id: 'tpl-3',
    name: 'Push Day',
    exercises: ['Incline Bench Press', 'Cable Fly', 'Lateral Raise', 'Tricep Dips', 'Rear Delt Fly'],
    lastUsed: new Date('2026-05-23T07:45:00'),
  },
  {
    id: 'tpl-4',
    name: 'Pull Day',
    exercises: ['Deadlift', 'Barbell Row', 'Lat Pulldown', 'Face Pull', 'Bicep Curl'],
    lastUsed: new Date('2026-05-21T19:00:00'),
  },
  {
    id: 'tpl-5',
    name: 'Full Body',
    exercises: ['Goblet Squat', 'Dumbbell Press', 'Seated Row', 'Hip Thrust', 'Plank'],
    lastUsed: new Date('2026-04-29T10:15:00'),
  },
  {
    id: 'tpl-6',
    name: 'Arm Specialization',
    exercises: ['EZ Bar Curl', 'Hammer Curl', 'Skull Crushers', 'Cable Pushdown', 'Concentration Curl'],
    lastUsed: new Date('2026-04-24T17:00:00'),
  },
];

export const mockExercises: Exercise[] = [
  { id: 'ex-1',  name: 'Arnold Press',         muscleGroup: 'Shoulders',  weeklySets: 9 },
  { id: 'ex-2',  name: 'Back Squat',            muscleGroup: 'Quads',      weeklySets: 15 },
  { id: 'ex-3',  name: 'Barbell Row',           muscleGroup: 'Back',       weeklySets: 12 },
  { id: 'ex-4',  name: 'Bench Press',           muscleGroup: 'Chest',      weeklySets: 16 },
  { id: 'ex-5',  name: 'Cable Fly',             muscleGroup: 'Chest',      weeklySets: 9 },
  { id: 'ex-6',  name: 'Cable Pushdown',        muscleGroup: 'Triceps',    weeklySets: 9 },
  { id: 'ex-7',  name: 'Deadlift',              muscleGroup: 'Back',       weeklySets: 10 },
  { id: 'ex-8',  name: 'EZ Bar Curl',           muscleGroup: 'Biceps',     weeklySets: 12 },
  { id: 'ex-9',  name: 'Face Pull',             muscleGroup: 'Rear Delts', weeklySets: 12 },
  { id: 'ex-10', name: 'Front Squat',           muscleGroup: 'Quads',      weeklySets: 8 },
  { id: 'ex-11', name: 'Goblet Squat',          muscleGroup: 'Quads',      weeklySets: 6 },
  { id: 'ex-12', name: 'Hack Squat',            muscleGroup: 'Quads',      weeklySets: 6 },
  { id: 'ex-13', name: 'Hip Thrust',            muscleGroup: 'Glutes',     weeklySets: 12 },
  { id: 'ex-14', name: 'Incline Bench Press',   muscleGroup: 'Chest',      weeklySets: 12 },
  { id: 'ex-15', name: 'Lateral Raise',         muscleGroup: 'Shoulders',  weeklySets: 15 },
  { id: 'ex-16', name: 'Leg Curl',              muscleGroup: 'Hamstrings', weeklySets: 9 },
  { id: 'ex-17', name: 'Leg Press',             muscleGroup: 'Quads',      weeklySets: 6 },
  { id: 'ex-18', name: 'Nordic Curl',           muscleGroup: 'Hamstrings', weeklySets: 6 },
  { id: 'ex-19', name: 'Overhead Press',        muscleGroup: 'Shoulders',  weeklySets: 12 },
  { id: 'ex-20', name: 'Pull-ups',              muscleGroup: 'Back',       weeklySets: 12 },
  { id: 'ex-21', name: 'Romanian Deadlift',     muscleGroup: 'Hamstrings', weeklySets: 9 },
  { id: 'ex-22', name: 'Seated Row',            muscleGroup: 'Back',       weeklySets: 9 },
  { id: 'ex-23', name: 'Skull Crushers',        muscleGroup: 'Triceps',    weeklySets: 9 },
  { id: 'ex-24', name: 'Tricep Dips',           muscleGroup: 'Triceps',    weeklySets: 6 },
];

export const mockPrimaryMetrics: MeasureItem[] = [
  { id: 'metric-1', label: 'Weight', lastValue: '82.4 kg' },
  { id: 'metric-2', label: 'Body fat %', lastValue: '14.2%' },
  { id: 'metric-3', label: 'Caloric intake', lastValue: '2,800 kcal' },
];

export const mockBodyPartMetrics: MeasureItem[] = [
  { id: 'bp-1',  label: 'Neck', lastValue: '38.5 cm' },
  { id: 'bp-2',  label: 'Shoulders', lastValue: '122.0 cm' },
  { id: 'bp-3',  label: 'Chest', lastValue: '108.5 cm' },
  { id: 'bp-4',  label: 'Left bicep', lastValue: '39.2 cm' },
  { id: 'bp-5',  label: 'Right bicep', lastValue: '39.4 cm' },
  { id: 'bp-6',  label: 'Waist', lastValue: '84.0 cm' },
  { id: 'bp-7',  label: 'Hips', lastValue: '98.0 cm' },
  { id: 'bp-8',  label: 'Left thigh', lastValue: '61.0 cm' },
  { id: 'bp-9',  label: 'Right thigh', lastValue: '61.2 cm' },
  { id: 'bp-10', label: 'Left calf', lastValue: '38.0 cm' },
  { id: 'bp-11', label: 'Right calf', lastValue: '38.1 cm' },
];
