// utils/csvImporter.ts
// Utility to parse Strong app exported CSV files, resolve exercises with deduplication, and reconstruct sessions.

import { Exercise, WorkoutSession, SetDetail, ExerciseSet } from '../data/mockData';

export interface CSVImportResult {
  importedSessions: WorkoutSession[];
  addedExercises: Exercise[];
}

// Map of common synonyms to unify exercise names
const SYNONYM_MAP: Record<string, string> = {
  'squat': 'Back Squat',
  'squats': 'Back Squat',
  'barbell squat': 'Back Squat',
  'squat barbell': 'Back Squat',
  'dips': 'Tricep Dips',
  'dip': 'Tricep Dips',
  'chest dip': 'Tricep Dips',
  'chest dips': 'Tricep Dips',
  'pullups': 'Pull-ups',
  'pullup': 'Pull-ups',
  'chinups': 'Chin-ups',
  'chinup': 'Chin-ups',
  'seated row': 'Seated Row',
  'cable row': 'Seated Row',
  'lat pulldowns': 'Lat Pulldown',
  'calves raises': 'Calf Raises',
  'calf raise': 'Calf Raises',
  'back extensions': 'Hyperextensions',
  'back extension': 'Hyperextensions',
  'lying leg curl': 'Leg Curl',
  'seated leg curl': 'Leg Curl',
  'seated leg curl (machine)': 'Leg Curl',
  'leg extension (machine)': 'Leg Extension',
  'seated leg press (machine)': 'Leg Press',
};

/**
 * Normalizes an exercise name to allow similarity matching and prevent duplicates.
 */
export function normalizeExerciseName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Remove brackets/parentheses and their content (e.g. "(Machine)", "(Barbell)")
  normalized = normalized.replace(/\s*\([^)]*\)/g, '');
  normalized = normalized.replace(/\s*\[[^\]]*\]/g, '');

  // Replace hyphens, dashes, slashes, backslashes with spaces
  normalized = normalized.replace(/[-_/\\]/g, ' ');

  // Remove common equipment and modifier words
  const wordsToRemove = [
    'machine', 'barbell', 'dumbbell', 'cable', 'cables', 'band', 'bands',
    'single arm', 'one arm', 'underhand', 'overhand', 'seated', 'standing',
    'lying', 'assisted', 'weighted', 'bodyweight', 'smith'
  ];

  let words = normalized.split(/\s+/);
  words = words.filter(word => !wordsToRemove.includes(word));
  normalized = words.join(' ');

  // Normalize plurals (except words like press, class, abs)
  if (normalized.endsWith('s')) {
    if (!normalized.endsWith('press') && !normalized.endsWith('class') && !normalized.endsWith('abs')) {
      normalized = normalized.slice(0, -1);
    }
  }

  // Remove spaces for absolute comparison
  normalized = normalized.replace(/\s+/g, '');

  return normalized;
}

/**
 * Checks for a match in the existing exercise library.
 */
export function findMatchingExercise(rawName: string, exercisesList: Exercise[]): Exercise | null {
  const nameLower = rawName.toLowerCase().trim();

  // 1. Direct exact or lowercase match
  let match = exercisesList.find(e => e.name.toLowerCase().trim() === nameLower);
  if (match) return match;

  // 2. Synonym map match
  const synonymName = SYNONYM_MAP[nameLower];
  if (synonymName) {
    match = exercisesList.find(e => e.name.toLowerCase().trim() === synonymName.toLowerCase());
    if (match) return match;
  }

  // 3. Normalized name match
  const normRaw = normalizeExerciseName(nameLower);
  match = exercisesList.find(e => normalizeExerciseName(e.name) === normRaw);
  if (match) return match;

  return null;
}

/**
 * Guess the primary muscle group of an exercise based on its name keywords.
 */
export function guessMuscleGroup(name: string): string {
  const n = name.toLowerCase();
  
  // 1. Specific multi-word keywords first
  if (n.includes('leg curl')) return 'Hamstrings';
  if (n.includes('hip thrust')) return 'Glutes';
  
  // 2. Clear muscle group direct mentions
  if (n.includes('tricep')) return 'Triceps';
  if (n.includes('bicep')) return 'Biceps';
  if (n.includes('shoulder') || n.includes('delt')) return 'Shoulders';
  if (n.includes('chest') || n.includes('pectoral')) return 'Chest';
  if (n.includes('back')) return 'Back';
  if (n.includes('glute')) return 'Glutes';
  if (n.includes('hamstring')) return 'Hamstrings';
  if (n.includes('quad')) return 'Quads';
  if (n.includes('calf') || n.includes('calves')) return 'Calves';
  if (n.includes('forearm') || n.includes('wrist')) return 'Forearms';
  if (n.includes('abs') || n.includes('core') || n.includes('crunch')) return 'Core';

  // 3. Specific exercise names/types
  if (n.includes('bench') || n.includes('pushup') || n.includes('fly')) return 'Chest';
  if (n.includes('row') || n.includes('pullup') || n.includes('pull up') || n.includes('pulldown') || n.includes('chinup') || n.includes('chin up') || n.includes('deadlift') || n.includes('shrug')) return 'Back';
  if (n.includes('overhead press') || n.includes('military press') || n.includes('lateral raise') || n.includes('arnold')) return 'Shoulders';
  if (n.includes('curl')) return 'Biceps'; // general curl
  if (n.includes('pushdown') || n.includes('skull')) return 'Triceps';
  
  if (n.includes('squat') || n.includes('leg press') || n.includes('extension') || n.includes('lunge')) return 'Quads';
  if (n.includes('romanian') || n.includes('rdl')) return 'Hamstrings';
  if (n.includes('hip') || n.includes('adductor') || n.includes('abductor') || n.includes('kickback')) return 'Glutes';
  if (n.includes('plank') || n.includes('twist') || n.includes('situp') || n.includes('sit up') || n.includes('leg raise') || n.includes('knee raise')) return 'Core';

  return 'Chest'; // Default fallback
}



/**
 * Guess the equipment type based on the exercise name.
 */
export function guessEquipment(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('barbell') || n.includes('smith')) return 'Barbell';
  if (n.includes('dumbbell') || n.includes('db')) return 'Dumbbell';
  if (n.includes('machine') || n.includes('press') || n.includes('curl') || n.includes('extension') || n.includes('hack') || n.includes('seated') || n.includes('pec dec')) {
    if (n.includes('cable')) return 'Cables';
    return 'Machine';
  }
  if (n.includes('cable') || n.includes('cables') || n.includes('pushdown') || n.includes('pulldown')) return 'Cables';
  if (n.includes('band') || n.includes('bands')) return 'Other';
  if (n.includes('bodyweight') || n.includes('pullup') || n.includes('pull-up') || n.includes('pull up') || n.includes('chinup') || n.includes('chin-up') || n.includes('chin up') || n.includes('dip') || n.includes('dips') || n.includes('pushup') || n.includes('push-up') || n.includes('push up')) return 'Bodyweight';
  return 'Other';
}


/**
 * Splits a CSV line while respecting quotes and commas/semicolons.
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result.map(val => {
    if (val.startsWith('"') && val.endsWith('"')) {
      return val.slice(1, -1);
    }
    return val;
  });
}

/**
 * Main parser and importer function.
 */
export function importStrongCSV(
  csvText: string,
  existingExercises: Exercise[],
  existingSessions: WorkoutSession[] = []
): CSVImportResult {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) {
    return { importedSessions: [], addedExercises: [] };
  }

  // Detect delimiter
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  
  // Parse headers
  const headers = parseCSVLine(headerLine, delimiter);
  
  const colIndex = {
    workoutNum: headers.findIndex(h => h.toLowerCase().includes('workout #') || h.toLowerCase() === 'workout'),
    date: headers.findIndex(h => h.toLowerCase().includes('date')),
    workoutName: headers.findIndex(h => h.toLowerCase().includes('workout name') || h.toLowerCase() === 'workout_name'),
    duration: headers.findIndex(h => h.toLowerCase().includes('duration')),
    exerciseName: headers.findIndex(h => h.toLowerCase().includes('exercise name') || h.toLowerCase() === 'exercise_name'),
    setOrder: headers.findIndex(h => h.toLowerCase().includes('set order') || h.toLowerCase() === 'set_order'),
    weight: headers.findIndex(h => h.toLowerCase().includes('weight')),
    reps: headers.findIndex(h => h.toLowerCase().includes('reps')),
    rpe: headers.findIndex(h => h.toLowerCase().includes('rpe')),
    notes: headers.findIndex(h => h.toLowerCase().trim() === 'notes'),
    workoutNotes: headers.findIndex(h => h.toLowerCase().includes('workout notes') || h.toLowerCase() === 'workout_notes'),
  };

  // Required columns check
  if (colIndex.date === -1 || colIndex.exerciseName === -1 || colIndex.setOrder === -1) {
    throw new Error('Invalid CSV structure: Required columns (Date, Exercise Name, Set Order) are missing.');
  }

  // Group lines by Workout (Date + Workout #)
  const workoutGroups = new Map<string, string[][]>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], delimiter);
    if (cols.length < 3) continue;

    const wNum = colIndex.workoutNum !== -1 ? cols[colIndex.workoutNum] : '1';
    const dateVal = cols[colIndex.date] || '';
    if (!dateVal) continue;

    const key = `${dateVal}_${wNum}`;
    if (!workoutGroups.has(key)) {
      workoutGroups.set(key, []);
    }
    workoutGroups.get(key)!.push(cols);
  }

  const addedExercises: Exercise[] = [];
  const importedSessions: WorkoutSession[] = [];
  
  // Create a mutable copy of existing exercises for quick local matching
  const currentExercisesPool = [...existingExercises];

  // Process each workout group
  for (const [key, rows] of workoutGroups.entries()) {
    if (rows.length === 0) continue;

    const firstRow = rows[0];
    const dateStr = firstRow[colIndex.date];
    const sessionDate = new Date(dateStr.replace(' ', 'T')); // Standardize date parsing
    const title = (colIndex.workoutName !== -1 ? firstRow[colIndex.workoutName] : '') || 'Evening Workout';
    
    // Deduplicate sessions: skip if session already exists
    const isDuplicateSession = existingSessions.some(
      s => Math.abs(new Date(s.datetime).getTime() - sessionDate.getTime()) < 60000 && s.title === title
    );
    if (isDuplicateSession) {
      continue;
    }

    const durationSec = colIndex.duration !== -1 ? parseInt(firstRow[colIndex.duration], 10) : 0;
    const durationMinutes = isNaN(durationSec) ? 45 : Math.round(durationSec / 60) || 45;
    const comment = (colIndex.workoutNotes !== -1 ? firstRow[colIndex.workoutNotes] : '') || undefined;

    // Group sets by Exercise Name
    const exerciseRowsMap = new Map<string, string[][]>();
    for (const r of rows) {
      const exName = r[colIndex.exerciseName];
      if (!exName) continue;
      if (!exerciseRowsMap.has(exName)) {
        exerciseRowsMap.set(exName, []);
      }
      exerciseRowsMap.get(exName)!.push(r);
    }

    const exerciseSetsList: ExerciseSet[] = [];
    let totalVolumeKg = 0;

    for (const [rawExName, exRows] of exerciseRowsMap.entries()) {
      // Find or create exercise
      let matchedEx = findMatchingExercise(rawExName, currentExercisesPool);
      
      if (!matchedEx) {
        // Create new Exercise object
        const newExId = `ex-custom-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        matchedEx = {
          id: newExId,
          name: rawExName.trim(),
          muscleGroup: guessMuscleGroup(rawExName),
          equipment: guessEquipment(rawExName),
          allTimeSets: 0,
        };
        currentExercisesPool.push(matchedEx);
        addedExercises.push(matchedEx);
      }

      const setsDetails: SetDetail[] = [];
      let maxWeight = 0;
      let maxReps = 0;

      // Extract set notes if any
      let exerciseNote: string | undefined = undefined;

      for (const r of exRows) {
        const setOrder = r[colIndex.setOrder];
        const notes = colIndex.notes !== -1 ? r[colIndex.notes] : '';

        // Handle Note-only rows
        if (setOrder.toLowerCase() === 'note') {
          if (notes) {
            exerciseNote = notes;
            // Also update the exercise definition notes if empty
            if (matchedEx && !matchedEx.notes) {
              matchedEx.notes = notes;
            }
          }
          continue;
        }

        const weight = colIndex.weight !== -1 ? parseFloat(r[colIndex.weight]) : 0;
        const reps = colIndex.reps !== -1 ? parseInt(r[colIndex.reps], 10) : 0;
        const rpeStr = colIndex.rpe !== -1 ? r[colIndex.rpe] : '';
        const rpe = rpeStr ? parseFloat(rpeStr) : undefined;

        if (isNaN(weight) || isNaN(reps)) continue;

        // Determine category: 'W' (Warmup), 'D' (Drop set), 'F' (Failure), 'S' (Standard)
        let category: 'W' | 'S' | 'D' | 'F' = 'S';
        const setOrderUpper = setOrder.toUpperCase();
        if (setOrderUpper === 'W') category = 'W';
        else if (setOrderUpper === 'D') category = 'D';
        else if (setOrderUpper === 'F') category = 'F';

        setsDetails.push({
          weight,
          reps,
          completed: true,
          rpe,
          category,
        });

        if (weight > maxWeight) {
          maxWeight = weight;
          maxReps = reps;
        } else if (weight === maxWeight && reps > maxReps) {
          maxReps = reps;
        }

        totalVolumeKg += weight * reps;
      }

      if (setsDetails.length > 0) {
        exerciseSetsList.push({
          name: matchedEx.name,
          sets: setsDetails.length,
          bestWeight: maxWeight,
          bestReps: maxReps,
          setsDetails,
        });
        
        // Accumulate all-time sets statistic onto the matched exercise
        matchedEx.allTimeSets = (matchedEx.allTimeSets || 0) + setsDetails.length;
      }
    }

    if (exerciseSetsList.length > 0) {
      importedSessions.push({
        id: `session-import-${key}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title,
        datetime: sessionDate,
        comment,
        exercises: exerciseSetsList,
        durationMinutes,
        totalVolumeKg,
        prs: 0, // Set default or calculate later
      });
    }
  }

  return {
    importedSessions,
    addedExercises,
  };
}
