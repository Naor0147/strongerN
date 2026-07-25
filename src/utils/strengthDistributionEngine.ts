import strengthDatasetRaw from '../data/strengthDistributions.json';

export interface BodyweightBracket {
  minKg: number;
  maxKg: number;
  sampleSize: number;
  confidence: 'high' | 'moderate' | 'low' | 'interpolated_no_data' | 'estimated_population';
  values: number[];
}

export interface GenderGrid {
  gender: 'male' | 'female';
  ageGroup?: string;
  brackets: BodyweightBracket[];
}

export interface ExerciseEntry {
  id: string;
  name: string;
  category: 'barbell' | 'dumbbell' | 'kettlebell' | 'bodyweight' | 'machine';
  primaryMuscles: string[];
  sourceType: string;
  sourceAttribution: string;
  grids: GenderGrid[];
}

export interface StrengthDataset {
  version: string;
  generatedAt: string;
  dataRangeStart: string;
  dataRangeEnd: string;
  quantileAnchors: number[];
  populationModel?: string;
  exercises: ExerciseEntry[];
}

const dataset = strengthDatasetRaw as unknown as StrengthDataset;

// Fast lookup map by ID and clean normalized names
const exerciseMap = new Map<string, ExerciseEntry>();

dataset.exercises.forEach((ex) => {
  exerciseMap.set(ex.id.toLowerCase(), ex);
  exerciseMap.set(ex.name.toLowerCase(), ex);
});

// Name alias map for common exercise names/variants in the app
const ALIAS_MAP: Record<string, string> = {
  'bench press': 'barbell-bench-press',
  'barbell bench press': 'barbell-bench-press',
  'squat': 'barbell-squat',
  'back squat': 'barbell-squat',
  'barbell back squat': 'barbell-squat',
  'deadlift': 'barbell-deadlift',
  'barbell deadlift': 'barbell-deadlift',
  'overhead press': 'barbell-overhead-press',
  'ohp': 'barbell-overhead-press',
  'barbell overhead press': 'barbell-overhead-press',
  'barbell row': 'barbell-row',
  'bent over row': 'barbell-row',
  'incline bench press': 'barbell-incline-bench-press',
  'incline bench': 'barbell-incline-bench-press',
  'front squat': 'barbell-front-squat',
  'hip thrust': 'barbell-hip-thrust',
  'romanian deadlift': 'barbell-romanian-deadlift',
  'rdl': 'barbell-romanian-deadlift',
  'bicep curl': 'dumbbell-biceps-curl',
  'biceps curl': 'dumbbell-biceps-curl',
  'dumbbell curl': 'dumbbell-biceps-curl',
  'dumbbell bench press': 'dumbbell-bench-press',
  'dumbbell shoulder press': 'dumbbell-shoulder-press',
  'pull-up': 'weighted-pull-up',
  'pull up': 'weighted-pull-up',
  'chin-up': 'weighted-pull-up',
  'chin up': 'weighted-pull-up',
  'dip': 'weighted-dip',
  'dips': 'weighted-dip',
  'leg press': 'leg-press-machine',
  'kettlebell swing': 'kettlebell-swing',
  'push up': 'push-ups',
  'push-up': 'push-ups',
  'push ups': 'push-ups',
};

/**
 * Finds matching ExerciseEntry by string name/slug
 */
export function findExerciseEntry(name: string): ExerciseEntry | undefined {
  if (!name) return undefined;
  const clean = name.toLowerCase().trim();

  if (exerciseMap.has(clean)) {
    return exerciseMap.get(clean);
  }

  if (ALIAS_MAP[clean] && exerciseMap.has(ALIAS_MAP[clean])) {
    return exerciseMap.get(ALIAS_MAP[clean]);
  }

  // Fuzzy partial match
  for (const [key, entry] of exerciseMap.entries()) {
    if (clean.includes(key) || key.includes(clean)) {
      return entry;
    }
  }

  return undefined;
}

/**
 * PCHIP / Monotonic Interpolation of 1RM weight -> percentile (0.01 to 0.99)
 */
function interpolatePercentile(
  weightKg: number,
  weights: number[],
  anchors: number[]
): number {
  if (weightKg <= 0 || weights.length === 0) return 0.5;

  // Deduplicate and filter non-increasing weights
  const xPoints: number[] = [];
  const yPoints: number[] = [];

  for (let i = 0; i < weights.length; i++) {
    if (i === 0 || weights[i] > xPoints[xPoints.length - 1]) {
      xPoints.push(weights[i]);
      yPoints.push(anchors[i]);
    }
  }

  if (xPoints.length === 0) return 0.5;

  // Below lowest quantile (P1)
  if (weightKg <= xPoints[0]) {
    const p1 = yPoints[0];
    const ratio = Math.max(0.1, weightKg / xPoints[0]);
    return Math.max(0.01, (p1 * ratio) / 100);
  }

  // Above highest quantile (P99)
  const n = xPoints.length;
  if (weightKg >= xPoints[n - 1]) {
    const maxP = yPoints[n - 1];
    const diff = weightKg - xPoints[n - 1];
    const bonus = Math.min(0.9, diff * 0.05);
    return Math.min(0.99, (maxP + bonus) / 100);
  }

  // Find bounding interval
  let idx = 0;
  for (let i = 0; i < n - 1; i++) {
    if (weightKg >= xPoints[i] && weightKg <= xPoints[i + 1]) {
      idx = i;
      break;
    }
  }

  const x0 = xPoints[idx];
  const x1 = xPoints[idx + 1];
  const y0 = yPoints[idx];
  const y1 = yPoints[idx + 1];

  const t = (weightKg - x0) / (x1 - x0);
  const interpolatedP = y0 + t * (y1 - y0);

  return Math.min(0.99, Math.max(0.01, interpolatedP / 100));
}

/**
 * Finds the appropriate GenderGrid given gender and optional ageGroup
 */
function findGenderGrid(
  entry: ExerciseEntry,
  gender: 'male' | 'female',
  ageGroup: string = '18-29'
): GenderGrid | undefined {
  // First attempt: exact gender + exact ageGroup match
  let matched = entry.grids.find((g) => g.gender === gender && g.ageGroup === ageGroup);

  // Second attempt: exact gender + default adult age group '18-29' or '30-39'
  if (!matched) {
    matched = entry.grids.find(
      (g) => g.gender === gender && (g.ageGroup === '18-29' || g.ageGroup === '30-39')
    );
  }

  // Third attempt: any matching gender grid
  if (!matched) {
    matched = entry.grids.find((g) => g.gender === gender);
  }

  // Fallback: first available grid
  return matched || entry.grids[0];
}

/**
 * Main engine function to compute population strength percentile for any 1RM weight.
 */
export function getExercisePercentile(
  exerciseName: string,
  weightKg: number,
  userBodyweightKg: number = 75,
  gender: 'male' | 'female' = 'male',
  ageGroup: string = '18-29'
): number {
  if (weightKg <= 0) return 0.5;

  const entry = findExerciseEntry(exerciseName);

  // Fallback heuristic if exercise is not found in database
  if (!entry) {
    const mean = 70;
    const sd = 15;
    const z = (weightKg - mean) / sd;
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    const p =
      d *
      t *
      (0.31938153 +
        t *
          (-0.356563782 +
            t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    const cdf = z >= 0 ? 1 - p : p;
    return Math.min(0.99, Math.max(0.01, cdf));
  }

  const genderGrid = findGenderGrid(entry, gender, ageGroup);
  if (!genderGrid || !genderGrid.brackets || genderGrid.brackets.length === 0) {
    return 0.5;
  }

  const bw = Math.max(40, userBodyweightKg);

  // Find exact bodyweight bracket
  let bracket = genderGrid.brackets.find(
    (b) => bw >= b.minKg && bw < b.maxKg
  );

  if (!bracket) {
    if (bw < genderGrid.brackets[0].minKg) {
      bracket = genderGrid.brackets[0];
    } else {
      bracket = genderGrid.brackets[genderGrid.brackets.length - 1];
    }
  }

  return interpolatePercentile(
    weightKg,
    bracket.values,
    dataset.quantileAnchors
  );
}

export interface DistributionBins {
  p5: number;   // Beginner
  p20: number;  // Novice
  p50: number;  // Intermediate
  p80: number;  // Advanced
  p95: number;  // Elite
  unit: string;
}

/**
 * Retrieves representative 1RM weights for Beginner (P5), Novice (P20), Intermediate (P50), Advanced (P80), and Elite (P95)
 */
export function getDistributionHistogramBins(
  exerciseName: string,
  userBodyweightKg: number = 75,
  gender: 'male' | 'female' = 'male',
  ageGroup: string = '18-29'
): DistributionBins {
  const entry = findExerciseEntry(exerciseName);

  if (!entry) {
    return { p5: 45, p20: 58, p50: 70, p80: 83, p95: 95, unit: 'kg' };
  }

  const genderGrid = findGenderGrid(entry, gender, ageGroup);
  const bw = Math.max(40, userBodyweightKg);
  let bracket = genderGrid?.brackets.find((b) => bw >= b.minKg && bw < b.maxKg);
  if (!bracket && genderGrid && genderGrid.brackets.length > 0) {
    bracket = genderGrid.brackets[Math.floor(genderGrid.brackets.length / 2)];
  }

  if (!bracket) {
    return { p5: 45, p20: 58, p50: 70, p80: 83, p95: 95, unit: 'kg' };
  }

  // Anchor indices: dataset.quantileAnchors is [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99]
  const vals = bracket.values;

  return {
    p5: Math.round(vals[1] || 45),
    p20: Math.round(vals[3] || 58),
    p50: Math.round(vals[6] || 70),
    p80: Math.round(vals[9] || 83),
    p95: Math.round(vals[11] || 95),
    unit: 'kg',
  };
}
