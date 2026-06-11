// __tests__/csvImporter.test.ts
import { importStrongCSV, normalizeExerciseName, findMatchingExercise, guessMuscleGroup, guessEquipment } from '../utils/csvImporter';
import { Exercise, WorkoutSession } from '../data/mockData';

const mockExercises: Exercise[] = [
  { id: 'ex-1', name: 'Back Squat', muscleGroup: 'Quads', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-2', name: 'Bench Press', muscleGroup: 'Chest', allTimeSets: 0, equipment: 'Barbell' },
  { id: 'ex-3', name: 'Pull-ups', muscleGroup: 'Back', allTimeSets: 0, equipment: 'Bodyweight' },
  { id: 'ex-4', name: 'Leg Extension', muscleGroup: 'Quads', allTimeSets: 0, equipment: 'Machine' },
  { id: 'ex-5', name: 'Calf Raises', muscleGroup: 'Calves', allTimeSets: 0, equipment: 'Machine' },
];

describe('Strong CSV Importer', () => {
  describe('normalizeExerciseName', () => {
    it('should normalize uppercase, lowercase, spaces, and punctuation', () => {
      expect(normalizeExerciseName('Bench Press')).toBe('benchpress');
      expect(normalizeExerciseName('bench-press')).toBe('benchpress');
      expect(normalizeExerciseName('  Bench   Press  ')).toBe('benchpress');
    });

    it('should remove common equipment suffixes/parentheses', () => {
      expect(normalizeExerciseName('Leg Extension (Machine)')).toBe('legextension');
      expect(normalizeExerciseName('Squat (Barbell)')).toBe('squat');
      expect(normalizeExerciseName('Chest Press (Band)')).toBe('chestpress');
    });

    it('should strip trailing s for plurals', () => {
      expect(normalizeExerciseName('Pull-ups')).toBe('pullup');
      expect(normalizeExerciseName('Calf Raises')).toBe('calfraise');
      expect(normalizeExerciseName('Leg Curls')).toBe('legcurl');
    });

    it('should preserve press/class/abs endings', () => {
      expect(normalizeExerciseName('Bench Press')).toBe('benchpress');
      expect(normalizeExerciseName('Abs')).toBe('abs');
    });
  });

  describe('findMatchingExercise', () => {
    it('should match exact and lowercase names', () => {
      const match = findMatchingExercise('bench press', mockExercises);
      expect(match).not.toBeNull();
      expect(match?.name).toBe('Bench Press');
    });

    it('should match with synonyms', () => {
      const match = findMatchingExercise('pullups', mockExercises);
      expect(match).not.toBeNull();
      expect(match?.name).toBe('Pull-ups');
    });

    it('should match normalized names', () => {
      const match = findMatchingExercise('Leg Extension (Machine)', mockExercises);
      expect(match).not.toBeNull();
      expect(match?.name).toBe('Leg Extension');
    });

    it('should return null if no match found', () => {
      const match = findMatchingExercise('Bicep Curl', mockExercises);
      expect(match).toBeNull();
    });
  });

  describe('guessMuscleGroup and guessEquipment', () => {
    it('should guess muscle group based on exercise name', () => {
      expect(guessMuscleGroup('Dumbbell Incline Chest Fly')).toBe('Chest');
      expect(guessMuscleGroup('EZ Bar Bicep Curl')).toBe('Biceps');
      expect(guessMuscleGroup('Hanging Leg Raise')).toBe('Core');
      expect(guessMuscleGroup('Lying Leg Curl')).toBe('Hamstrings');
    });

    it('should guess equipment based on exercise name', () => {
      expect(guessEquipment('EZ Barbell Bicep Curl')).toBe('Barbell');
      expect(guessEquipment('Incline Dumbbell Fly')).toBe('Dumbbell');
      expect(guessEquipment('Chest Press (Machine)')).toBe('Machine');
      expect(guessEquipment('Pull Up')).toBe('Bodyweight');
    });
  });

  describe('importStrongCSV', () => {
    const csvContent = `"Workout #";"Date";"Workout Name";"Duration (sec)";"Exercise Name";"Set Order";"Weight (kg)";"Reps";"RPE";"Distance (meters)";"Seconds";"Notes";"Workout Notes"
"1";"2021-09-11 20:51:38";"Evening Workout";"4626";"Leg Press";"1";"50.0";"10";"";"";"";"";""
"1";"2021-09-11 20:51:38";"Evening Workout";"4626";"Leg Press";"2";"80.0";"10";"8.5";"";"";"";""
"1";"2021-09-11 20:51:38";"Evening Workout";"4626";"Leg Extension (Machine)";"1";"30.0";"10";"";"";"";"";""
"1";"2021-09-11 20:51:38";"Evening Workout";"4626";"Hip Adductor (Machine)";"1";"40.0";"10";"";"";"";"";""
"1";"2021-09-11 20:51:38";"Evening Workout";"4626";"Hip Adductor (Machine)";"Note";"";"";"";"";"";"Sit deep";""
`;

    it('should parse CSV correctly, resolve existing exercises, create new ones, and build sessions', () => {
      const result = importStrongCSV(csvContent, mockExercises);

      expect(result.importedSessions.length).toBe(1);
      const session = result.importedSessions[0];

      expect(session.title).toBe('Evening Workout');
      expect(session.durationMinutes).toBe(77); // 4626 sec = ~77 mins
      expect(session.exercises.length).toBe(3); // Leg Press, Leg Extension, Hip Adductor

      // Check resolved exercise (Leg Extension (Machine) -> Leg Extension)
      const legExtSet = session.exercises.find(e => e.name === 'Leg Extension');
      expect(legExtSet).toBeDefined();
      expect(legExtSet?.setsDetails?.length).toBe(1);

      // Check new created exercise (Hip Adductor (Machine) -> Quads/Glutes Machine)
      const hipAddSet = session.exercises.find(e => e.name === 'Hip Adductor (Machine)');
      expect(hipAddSet).toBeDefined();
      expect(result.addedExercises.length).toBe(2); // Leg Press & Hip Adductor (Machine)
      
      const newHipAdd = result.addedExercises.find(e => e.name === 'Hip Adductor (Machine)');
      expect(newHipAdd).toBeDefined();
      expect(newHipAdd?.notes).toBe('Sit deep'); // Extracted from Note row

      // Check set details
      const legPressSet = session.exercises.find(e => e.name === 'Leg Press');
      expect(legPressSet?.setsDetails?.length).toBe(2);
      expect(legPressSet?.setsDetails?.[1].weight).toBe(80.0);
      expect(legPressSet?.setsDetails?.[1].rpe).toBe(8.5);
      expect(legPressSet?.bestWeight).toBe(80.0);
      expect(legPressSet?.bestReps).toBe(10);
    });

    it('should support deduplication of sessions', () => {
      const existingSession: WorkoutSession = {
        id: 'session-existing',
        title: 'Evening Workout',
        datetime: new Date('2021-09-11 20:51:38'.replace(' ', 'T')),
        exercises: [],
        durationMinutes: 45,
        totalVolumeKg: 1000,
        prs: 0,
      };

      const result = importStrongCSV(csvContent, mockExercises, [existingSession]);
      // Should not import the duplicate workout
      expect(result.importedSessions.length).toBe(0);
    });
  });
});
