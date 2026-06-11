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
  exercisesDetails?: {
    name: string;
    superSetGroupId?: string;
    sets: {
      weight: string;
      reps: string;
      category?: 'W' | 'S' | 'D' | 'F';
      isUnilateral?: boolean;
      leftWeight?: string;
      leftReps?: string;
      rightWeight?: string;
      rightReps?: string;
    }[];
  }[];
  lastUsed: Date;
  folder?: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  imageUri?: string;
  allTimeSets: number;
  notes?: string;
  equipment?: string;
  isUnilateral?: boolean;
  weeklySets?: number;
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

// Helpers for relative dates to keep demo data current
const getRelativeDate = (daysAgo: number, hours: number = 9, minutes: number = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

const getRelativeDateString = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

export const mockUser: User = {
  name: 'Alex Morgan',
  totalWorkouts: 7,
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
    datetime: getRelativeDate(9, 9, 0),
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
    datetime: getRelativeDate(11, 18, 30),
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
    datetime: getRelativeDate(14, 7, 45),
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
    datetime: getRelativeDate(16, 19, 0),
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
    datetime: getRelativeDate(38, 10, 15),
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
    datetime: getRelativeDate(43, 17, 0),
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
    datetime: getRelativeDate(45, 8, 0),
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
    lastUsed: getRelativeDate(9, 9, 0),
    folder: 'Bulking Splits',
  },
  {
    id: 'tpl-2',
    name: 'Lower Power',
    exercises: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raises', 'Nordic Curl'],
    lastUsed: getRelativeDate(11, 18, 30),
    folder: 'Bulking Splits',
  },
  {
    id: 'tpl-3',
    name: 'Push Day',
    exercises: ['Incline Bench Press', 'Cable Fly', 'Lateral Raise', 'Tricep Dips', 'Rear Delt Fly'],
    lastUsed: getRelativeDate(14, 7, 45),
    folder: 'Bulking Splits',
  },
  {
    id: 'tpl-4',
    name: 'Pull Day',
    exercises: ['Deadlift', 'Barbell Row', 'Lat Pulldown', 'Face Pull', 'Bicep Curl'],
    lastUsed: getRelativeDate(16, 19, 0),
    folder: 'Bulking Splits',
  },
  {
    id: 'tpl-5',
    name: 'Full Body',
    exercises: ['Goblet Squat', 'Dumbbell Press', 'Seated Row', 'Hip Thrust', 'Plank'],
    lastUsed: getRelativeDate(38, 10, 15),
    folder: 'Home Workouts',
  },
  {
    id: 'tpl-6',
    name: 'Arm Specialization',
    exercises: ['EZ Bar Curl', 'Hammer Curl', 'Skull Crushers', 'Cable Pushdown', 'Concentration Curl'],
    lastUsed: getRelativeDate(43, 17, 0),
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
  { id: 'ex-1', name: 'Ab Wheel', muscleGroup: 'Core', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-2', name: 'Ab Wheel Rollout', muscleGroup: 'Core', allTimeSets: 6, equipment: 'Other' },
  { id: 'ex-3', name: 'Arnold Press', muscleGroup: 'Shoulders', allTimeSets: 9, equipment: 'Dumbbell' },
  { id: 'ex-4', name: 'Assisted Sissy Squat', muscleGroup: 'Quads', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-5', name: 'Back Extension', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-6', name: 'Back Squat', muscleGroup: 'Quads', allTimeSets: 15, equipment: 'Barbell' },
  { id: 'ex-7', name: 'Band Chest Fly', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-8', name: 'Band Chest Press', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-9', name: 'Band Underhand Lat Pulldown', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-10', name: 'Barbell Bicep Curl', muscleGroup: 'Biceps', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-11', name: 'Barbell Hip Thrust', muscleGroup: 'Glutes', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-12', name: 'Barbell Overhead Press', muscleGroup: 'Shoulders', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-13', name: 'Barbell Preacher Curl', muscleGroup: 'Biceps', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-14', name: 'Barbell Reverse Curl', muscleGroup: 'Biceps', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-15', name: 'Barbell Romanian Deadlift', muscleGroup: 'Hamstrings', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-16', name: 'Barbell Row', muscleGroup: 'Back', allTimeSets: 12, equipment: 'Barbell' },
  { id: 'ex-17', name: 'Barbell Shrugs', muscleGroup: 'Shoulders', allTimeSets: 6, equipment: 'Barbell' },
  { id: 'ex-18', name: 'Barbell Skullcrusher', muscleGroup: 'Triceps', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-19', name: 'Barbell Stiff Leg Deadlift', muscleGroup: 'Hamstrings', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-20', name: 'Barbell Triceps Extension', muscleGroup: 'Triceps', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-21', name: 'Barbell Upright Row', muscleGroup: 'Shoulders', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-22', name: 'Barbell Wrist Curl', muscleGroup: 'Forearms', allTimeSets: 6, equipment: 'Barbell' },
  { id: 'ex-23', name: 'Bayesian Cable Curl', muscleGroup: 'Biceps', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-24', name: 'Behind The Back Bicep Curl', muscleGroup: 'Biceps', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-25', name: 'Behind-the-back Curl', muscleGroup: 'Forearms', allTimeSets: 6, equipment: 'Barbell' },
  { id: 'ex-26', name: 'Bench Press', muscleGroup: 'Chest', allTimeSets: 16, equipment: 'Barbell' },
  { id: 'ex-27', name: 'Bent Over Barbell Rear Delt Raise', muscleGroup: 'Rear Delts', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-28', name: 'Bicep Curl', muscleGroup: 'Biceps', allTimeSets: 9, equipment: 'Dumbbell' },
  { id: 'ex-29', name: 'Boxing', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-30', name: 'Bulgarian Split Squat', muscleGroup: 'Quads', allTimeSets: 8, equipment: 'Dumbbell' },
  { id: 'ex-31', name: 'Cable Bicep Curl', muscleGroup: 'Biceps', allTimeSets: 6, equipment: 'Cables' },
  { id: 'ex-32', name: 'Cable Crossover', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-33', name: 'Cable Crunch', muscleGroup: 'Core', allTimeSets: 8, equipment: 'Cables' },
  { id: 'ex-34', name: 'Cable Face Pull', muscleGroup: 'Rear Delts', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-35', name: 'Cable Fly', muscleGroup: 'Chest', allTimeSets: 9, equipment: 'Cables' },
  { id: 'ex-36', name: 'Cable Lat Pulldown', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-37', name: 'Cable Lateral Raise', muscleGroup: 'Shoulders', allTimeSets: 8, equipment: 'Cables' },
  { id: 'ex-38', name: 'Cable Leg Sidekick', muscleGroup: 'Glutes', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-39', name: 'Cable Pushdown', muscleGroup: 'Triceps', allTimeSets: 9, equipment: 'Cables' },
  { id: 'ex-40', name: 'Cable Reverse Curl', muscleGroup: 'Biceps', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-41', name: 'Cable Reverse Fly', muscleGroup: 'Rear Delts', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-42', name: 'Cable Seated Row', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-43', name: 'Cable Triceps Extension', muscleGroup: 'Triceps', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-44', name: 'Cable Triceps Pushdown', muscleGroup: 'Triceps', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-45', name: 'Calf Press On Leg Press', muscleGroup: 'Calves', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-46', name: 'Calf Press On Seated Leg Press', muscleGroup: 'Calves', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-47', name: 'Calf Raises', muscleGroup: 'Calves', allTimeSets: 6, equipment: 'Machine' },
  { id: 'ex-48', name: 'Chest Dip', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Bodyweight' },
  { id: 'ex-49', name: 'Chest Fly', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-50', name: 'Chest Press', muscleGroup: 'Chest', allTimeSets: 6, equipment: 'Machine' },
  { id: 'ex-51', name: 'Chin-Up', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Bodyweight' },
  { id: 'ex-52', name: 'Chin-ups', muscleGroup: 'Back', allTimeSets: 8, equipment: 'Bodyweight' },
  { id: 'ex-53', name: 'Close-grip Bench Press', muscleGroup: 'Triceps', allTimeSets: 8, equipment: 'Barbell' },
  { id: 'ex-54', name: 'Close-grip LAT Pulldown', muscleGroup: 'Back', allTimeSets: 8, equipment: 'Cables' },
  { id: 'ex-55', name: 'Concentration Curl', muscleGroup: 'Biceps', allTimeSets: 6, equipment: 'Dumbbell' },
  { id: 'ex-56', name: 'Cross Body Cable Triceps Extension', muscleGroup: 'Triceps', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-57', name: 'Deadlift', muscleGroup: 'Back', allTimeSets: 10, equipment: 'Barbell' },
  { id: 'ex-58', name: 'Decline Ab Crunch', muscleGroup: 'Core', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-59', name: 'Decline Bench Press', muscleGroup: 'Chest', allTimeSets: 6, equipment: 'Barbell' },
  { id: 'ex-60', name: 'Decline Push-Up', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Bodyweight' },
  { id: 'ex-61', name: 'Deficit Barbell Row', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-62', name: 'Deficit Underhand Barbell Row', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-63', name: 'Diamond Push-ups', muscleGroup: 'Triceps', allTimeSets: 6, equipment: 'Bodyweight' },
  { id: 'ex-64', name: 'Dips', muscleGroup: 'Triceps', allTimeSets: 8, equipment: 'Bodyweight' },
  { id: 'ex-65', name: 'Dumbbell Bench Press', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-66', name: 'Dumbbell Bicep Curl', muscleGroup: 'Biceps', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-67', name: 'Dumbbell Hammer Curl', muscleGroup: 'Biceps', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-68', name: 'Dumbbell Lateral Raise', muscleGroup: 'Shoulders', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-69', name: 'Dumbbell Lunge', muscleGroup: 'Quads', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-70', name: 'Dumbbell Press', muscleGroup: 'Chest', allTimeSets: 8, equipment: 'Dumbbell' },
  { id: 'ex-71', name: 'Dumbbell Pullover', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-72', name: 'Dumbbell Romanian Deadlift', muscleGroup: 'Hamstrings', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-73', name: 'Dumbbell Row', muscleGroup: 'Back', allTimeSets: 8, equipment: 'Dumbbell' },
  { id: 'ex-74', name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', allTimeSets: 9, equipment: 'Dumbbell' },
  { id: 'ex-75', name: 'Dumbbell Shrug', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-76', name: 'Dumbbell Skullcrusher', muscleGroup: 'Triceps', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-77', name: 'Dumbbell Wrist Curl', muscleGroup: 'Forearms', allTimeSets: 6, equipment: 'Dumbbell' },
  { id: 'ex-78', name: 'Egyptian Lateral Raise', muscleGroup: 'Shoulders', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-79', name: 'EZ Bar Curl', muscleGroup: 'Biceps', allTimeSets: 12, equipment: 'Barbell' },
  { id: 'ex-80', name: 'Face Pull', muscleGroup: 'Rear Delts', allTimeSets: 12, equipment: 'Cables' },
  { id: 'ex-81', name: 'Farmer Walk With Fat Grip', muscleGroup: 'Forearms', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-82', name: 'Front Squat', muscleGroup: 'Quads', allTimeSets: 8, equipment: 'Barbell' },
  { id: 'ex-83', name: 'Glute Hyperextension', muscleGroup: 'Glutes', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-84', name: 'Glute Kickback', muscleGroup: 'Glutes', allTimeSets: 6, equipment: 'Cables' },
  { id: 'ex-85', name: 'Goblet Squat', muscleGroup: 'Quads', allTimeSets: 6, equipment: 'Dumbbell' },
  { id: 'ex-86', name: 'Hack Squat', muscleGroup: 'Quads', allTimeSets: 6, equipment: 'Machine' },
  { id: 'ex-87', name: 'Hammer Curl', muscleGroup: 'Biceps', allTimeSets: 8, equipment: 'Dumbbell' },
  { id: 'ex-88', name: 'Hammer Strength Row', muscleGroup: 'Back', allTimeSets: 8, equipment: 'Machine' },
  { id: 'ex-89', name: 'Hanging Leg Raise', muscleGroup: 'Core', allTimeSets: 8, equipment: 'Bodyweight' },
  { id: 'ex-90', name: 'High Chest Fly For Lower Chest', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-91', name: 'High To Low Chest Fly', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-92', name: 'Hip Abductor', muscleGroup: 'Glutes', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-93', name: 'Hip Adductor', muscleGroup: 'Glutes', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-94', name: 'Hip Thrust', muscleGroup: 'Glutes', allTimeSets: 12, equipment: 'Barbell' },
  { id: 'ex-95', name: 'Hyperextensions', muscleGroup: 'Back', allTimeSets: 6, equipment: 'Bodyweight' },
  { id: 'ex-96', name: 'Incline Barbell Bench Press', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-97', name: 'Incline Bench Press', muscleGroup: 'Chest', allTimeSets: 12, equipment: 'Barbell' },
  { id: 'ex-98', name: 'Incline Bicep Curl', muscleGroup: 'Biceps', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-99', name: 'Incline Chest Press', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-100', name: 'Incline Dumbbell Bench Press', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-101', name: 'Incline Dumbbell Curl', muscleGroup: 'Biceps', allTimeSets: 8, equipment: 'Dumbbell' },
  { id: 'ex-102', name: 'Incline Dumbbell Fly', muscleGroup: 'Chest', allTimeSets: 8, equipment: 'Dumbbell' },
  { id: 'ex-103', name: 'Incline Dumbbell Row', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-104', name: 'Incline Shrug', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-105', name: 'Iso-Lateral Row', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-106', name: 'Jpg Lat Pulldown', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-107', name: 'Jpg Triceps Pushdown', muscleGroup: 'Triceps', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-108', name: 'LAT Pulldown', muscleGroup: 'Back', allTimeSets: 9, equipment: 'Cables' },
  { id: 'ex-109', name: 'LAT Pulldown Cable 2 Balls', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-110', name: 'LAT Pulldown Close Grip', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-111', name: 'Lat-Focused Cable Row', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-112', name: 'Lateral Raise', muscleGroup: 'Shoulders', allTimeSets: 15, equipment: 'Dumbbell' },
  { id: 'ex-113', name: 'Leg Curl', muscleGroup: 'Hamstrings', allTimeSets: 9, equipment: 'Machine' },
  { id: 'ex-114', name: 'Leg Extension', muscleGroup: 'Quads', allTimeSets: 8, equipment: 'Machine' },
  { id: 'ex-115', name: 'Leg Press', muscleGroup: 'Quads', allTimeSets: 6, equipment: 'Machine' },
  { id: 'ex-116', name: 'Low Cable Chest Fly', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-117', name: 'Low To High Chest Fly', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-118', name: 'Lying Incline Bench Dumbbell Row Traps Focus', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-119', name: 'Lying Leg Curl', muscleGroup: 'Hamstrings', allTimeSets: 8, equipment: 'Machine' },
  { id: 'ex-120', name: 'Machine Lateral Raise', muscleGroup: 'Shoulders', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-121', name: 'Machine Pullover', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-122', name: 'Machine Reverse Curl', muscleGroup: 'Biceps', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-123', name: 'Machine Seated Row', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-124', name: 'Machine Wrist Curl', muscleGroup: 'Forearms', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-125', name: 'Middle Cable Chest Fly With Bench', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-126', name: 'Nordic Curl', muscleGroup: 'Hamstrings', allTimeSets: 6, equipment: 'Bodyweight' },
  { id: 'ex-127', name: 'Overhead Press', muscleGroup: 'Shoulders', allTimeSets: 12, equipment: 'Barbell' },
  { id: 'ex-128', name: 'Overhead Tricep Ext', muscleGroup: 'Triceps', allTimeSets: 8, equipment: 'Dumbbell' },
  { id: 'ex-129', name: 'Pec Dec Fly', muscleGroup: 'Chest', allTimeSets: 8, equipment: 'Machine' },
  { id: 'ex-130', name: 'Pec Deck Fly', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-131', name: 'Pin-Loaded Chest Press', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-132', name: 'Plank', muscleGroup: 'Core', allTimeSets: 6, equipment: 'Bodyweight' },
  { id: 'ex-133', name: 'Plate-Loaded Chest Press', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-134', name: 'Plate-Loaded Lat Pulldown', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-135', name: 'Plate-Loaded Leg Extension', muscleGroup: 'Quads', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-136', name: 'Preacher Curl', muscleGroup: 'Biceps', allTimeSets: 6, equipment: 'Barbell' },
  { id: 'ex-137', name: 'Pull-Up', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Bodyweight' },
  { id: 'ex-138', name: 'Pull-ups', muscleGroup: 'Back', allTimeSets: 12, equipment: 'Bodyweight' },
  { id: 'ex-139', name: 'Push-ups', muscleGroup: 'Chest', allTimeSets: 8, equipment: 'Bodyweight' },
  { id: 'ex-140', name: 'Rear Delt Fly', muscleGroup: 'Rear Delts', allTimeSets: 8, equipment: 'Dumbbell' },
  { id: 'ex-141', name: 'Rear Delt Fly Machine', muscleGroup: 'Shoulders', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-142', name: 'Reverse Barbell Curl', muscleGroup: 'Forearms', allTimeSets: 8, equipment: 'Barbell' },
  { id: 'ex-143', name: 'Reverse Grip Concentration Curl', muscleGroup: 'Biceps', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-144', name: 'Reverse Nordic Curl', muscleGroup: 'Quads', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-145', name: 'Reverse Pec Dec Fly', muscleGroup: 'Rear Delts', allTimeSets: 8, equipment: 'Machine' },
  { id: 'ex-146', name: 'Reverse Seated Wrist Curl', muscleGroup: 'Forearms', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-147', name: 'Reverse Wrist Curl', muscleGroup: 'Forearms', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-148', name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', allTimeSets: 9, equipment: 'Barbell' },
  { id: 'ex-149', name: 'Russian Twist', muscleGroup: 'Core', allTimeSets: 6, equipment: 'Bodyweight' },
  { id: 'ex-150', name: 'Seated Bent Over Dumbbell Row', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-151', name: 'Seated Bicep Curl', muscleGroup: 'Biceps', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-152', name: 'Seated Calf Raise', muscleGroup: 'Calves', allTimeSets: 6, equipment: 'Machine' },
  { id: 'ex-153', name: 'Seated Dumbbell Lateral Raise', muscleGroup: 'Shoulders', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-154', name: 'Seated Dumbbell Lateral Raise Partials', muscleGroup: 'Shoulders', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-155', name: 'Seated Dumbbell Overhead Press', muscleGroup: 'Shoulders', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-156', name: 'Seated Dumbbell Wrist Curl', muscleGroup: 'Forearms', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-157', name: 'Seated Leg Curl', muscleGroup: 'Hamstrings', allTimeSets: 6, equipment: 'Machine' },
  { id: 'ex-158', name: 'Seated Leg Press', muscleGroup: 'Quads', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-159', name: 'Seated Row', muscleGroup: 'Back', allTimeSets: 9, equipment: 'Cables' },
  { id: 'ex-160', name: 'Seated Shoulder Press', muscleGroup: 'Shoulders', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-161', name: 'Seated Shrug', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-162', name: 'Shoulder Press', muscleGroup: 'Shoulders', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-163', name: 'Single Arm Cable Triceps Extension', muscleGroup: 'Triceps', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-164', name: 'Single Arm Dumbbell Row', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-165', name: 'Single Arm Dumbbell Triceps Extension', muscleGroup: 'Triceps', allTimeSets: 0, equipment: 'Dumbbell' },
  { id: 'ex-166', name: 'Single Arm Front Raise', muscleGroup: 'Shoulders', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-167', name: 'Single Arm Lat Pulldown', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Cables' },
  { id: 'ex-168', name: 'Single Arm Shoulder Press', muscleGroup: 'Shoulders', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-169', name: 'Single Arm Wrist Curl', muscleGroup: 'Forearms', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-170', name: 'Single Leg Calf Press On Seated Leg Press', muscleGroup: 'Calves', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-171', name: 'Single Leg Lunge On Chair', muscleGroup: 'Quads', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-172', name: 'Sissy Squat On Leg Press', muscleGroup: 'Quads', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-173', name: 'Skull Crushers', muscleGroup: 'Triceps', allTimeSets: 9, equipment: 'Barbell' },
  { id: 'ex-174', name: 'Smith Machine Incline Bench Press', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-175', name: 'Smith Machine Sissy Squat', muscleGroup: 'Quads', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-176', name: 'Smith Machine Squat', muscleGroup: 'Quads', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-177', name: 'Smith Machine Standing Calf Raise', muscleGroup: 'Calves', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-178', name: 'Squat', muscleGroup: 'Quads', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-179', name: 'Standing Calf Raise', muscleGroup: 'Calves', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-180', name: 'Sumo Deadlift', muscleGroup: 'Back', allTimeSets: 8, equipment: 'Barbell' },
  { id: 'ex-181', name: 'T-bar Row', muscleGroup: 'Back', allTimeSets: 6, equipment: 'Barbell' },
  { id: 'ex-182', name: 'T-Bar Row', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-183', name: 'T-Bar Shrug', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-184', name: 'Thoracic Extension', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-185', name: 'Towel Bicep Curl', muscleGroup: 'Biceps', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-186', name: 'Trap Bar Shrug', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-187', name: 'Tricep Dips', muscleGroup: 'Triceps', allTimeSets: 6, equipment: 'Bodyweight' },
  { id: 'ex-188', name: 'Triceps Extension', muscleGroup: 'Triceps', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-189', name: 'Triceps Overhead Extension', muscleGroup: 'Triceps', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-190', name: 'Underhand Barbell Row', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-191', name: 'Warm-Up', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-192', name: 'Weighted Single Leg Glute Bridge', muscleGroup: 'Glutes', allTimeSets: 0, equipment: 'Other' },
  { id: 'ex-193', name: 'Wide Grip Pull-Up', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Bodyweight' },
  { id: 'ex-194', name: 'Wrist Curl', muscleGroup: 'Forearms', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-195', name: 'Wrist Roller', muscleGroup: 'Forearms', allTimeSets: 4, equipment: 'Other' },
];

export const mockPrimaryMetrics: MeasureItem[] = [
  {
    id: 'metric-1',
    label: 'Weight',
    lastValue: '82.4 kg',
    history: [
      { date: getRelativeDateString(27), value: 84.2 },
      { date: getRelativeDateString(22), value: 83.8 },
      { date: getRelativeDateString(17), value: 83.1 },
      { date: getRelativeDateString(12), value: 82.7 },
      { date: getRelativeDateString(7), value: 82.4 }
    ]
  },
  {
    id: 'metric-2',
    label: 'Body fat %',
    lastValue: '14.2%',
    history: [
      { date: getRelativeDateString(27), value: 15.1 },
      { date: getRelativeDateString(22), value: 14.8 },
      { date: getRelativeDateString(17), value: 14.6 },
      { date: getRelativeDateString(12), value: 14.4 },
      { date: getRelativeDateString(7), value: 14.2 }
    ]
  },
  {
    id: 'metric-3',
    label: 'Caloric intake',
    lastValue: '2,800 kcal',
    history: [
      { date: getRelativeDateString(27), value: 2750 },
      { date: getRelativeDateString(22), value: 2800 },
      { date: getRelativeDateString(17), value: 2900 },
      { date: getRelativeDateString(12), value: 2800 },
      { date: getRelativeDateString(7), value: 2800 }
    ]
  },
];

export const mockBodyPartMetrics: MeasureItem[] = [
  { id: 'bp-1',  label: 'Neck', lastValue: '38.5 cm', history: [{ date: getRelativeDateString(7), value: 38.5 }] },
  { id: 'bp-2',  label: 'Shoulders', lastValue: '122.0 cm', history: [{ date: getRelativeDateString(7), value: 122.0 }] },
  { id: 'bp-3',  label: 'Chest', lastValue: '108.5 cm', history: [{ date: getRelativeDateString(7), value: 108.5 }] },
  { id: 'bp-4',  label: 'Left bicep', lastValue: '39.2 cm', history: [{ date: getRelativeDateString(7), value: 39.2 }] },
  { id: 'bp-5',  label: 'Right bicep', lastValue: '39.4 cm', history: [{ date: getRelativeDateString(7), value: 39.4 }] },
  { id: 'bp-6',  label: 'Waist', lastValue: '84.0 cm', history: [{ date: getRelativeDateString(7), value: 84.0 }] },
  { id: 'bp-7',  label: 'Hips', lastValue: '98.0 cm', history: [{ date: getRelativeDateString(7), value: 98.0 }] },
  { id: 'bp-8',  label: 'Left thigh', lastValue: '61.0 cm', history: [{ date: getRelativeDateString(7), value: 61.0 }] },
  { id: 'bp-9',  label: 'Right thigh', lastValue: '61.2 cm', history: [{ date: getRelativeDateString(7), value: 61.2 }] },
  { id: 'bp-10', label: 'Left calf', lastValue: '38.0 cm', history: [{ date: getRelativeDateString(7), value: 38.0 }] },
  { id: 'bp-11', label: 'Right calf', lastValue: '38.1 cm', history: [{ date: getRelativeDateString(7), value: 38.1 }] },
];
