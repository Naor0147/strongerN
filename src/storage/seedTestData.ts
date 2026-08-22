// src/storage/seedTestData.ts — Smart 400+ workout generator for test account benchmarking
// Generates realistic progressive-overload sessions with varied muscles/categories and bulk-imports them

import { calculateChecksum } from './contracts/validators';
import { normalizeLookupKey } from './history/legacySessionMapper';
import { WorkoutSessionV2, SessionExerciseV2, SetLogV2 } from './contracts/types';
import { bulkImportSessions, countSessions } from './history/repository';
import { setCachedRecentSessions, setCachedTotalSessionsCount } from './instantCache';

function createPrng(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ExerciseTemplate = { name: string; baseWeight: number; muscle: string; uniPct: number };

const CATALOG: ExerciseTemplate[] = [
  // Exactly aligned with mockExercises names so SQL aggregate maps to ExercisesScreen lifetimeExerciseSets
  { name: 'Bench Press', baseWeight: 80, muscle: 'Chest', uniPct: 0 },
  { name: 'Back Squat', baseWeight: 100, muscle: 'Quads', uniPct: 0 },
  { name: 'Romanian Deadlift', baseWeight: 90, muscle: 'Hamstrings', uniPct: 0 },
  { name: 'Overhead Press', baseWeight: 50, muscle: 'Shoulders', uniPct: 0 },
  { name: 'LAT Pulldown', baseWeight: 65, muscle: 'Back', uniPct: 0 },
  { name: 'Barbell Row', baseWeight: 70, muscle: 'Back', uniPct: 0 },
  { name: 'Incline Dumbbell Bench Press', baseWeight: 30, muscle: 'Chest', uniPct: 0.3 },
  { name: 'Lateral Raise', baseWeight: 12, muscle: 'Shoulders', uniPct: 0.5 },
  { name: 'Cable Triceps Pushdown', baseWeight: 35, muscle: 'Triceps', uniPct: 0 },
  { name: 'Bicep Curl', baseWeight: 20, muscle: 'Biceps', uniPct: 0.4 },
  { name: 'Leg Press', baseWeight: 180, muscle: 'Quads', uniPct: 0 },
  { name: 'Hip Thrust', baseWeight: 80, muscle: 'Glutes', uniPct: 0 },
  { name: 'Face Pull', baseWeight: 25, muscle: 'Rear Delts', uniPct: 0 },
  { name: 'Leg Curl', baseWeight: 45, muscle: 'Hamstrings', uniPct: 0.2 },
  { name: 'Calf Raises', baseWeight: 60, muscle: 'Calves', uniPct: 0 },
  { name: 'Cable Crossover', baseWeight: 18, muscle: 'Chest', uniPct: 0.4 },
  { name: 'Seated Row', baseWeight: 60, muscle: 'Back', uniPct: 0 },
  { name: 'Hammer Curl', baseWeight: 16, muscle: 'Biceps', uniPct: 0.6 },
];

const TITLES = ['Push Power', 'Pull Strength', 'Legs & Core', 'Upper Pump', 'Lower Heavy', 'Full Body Blast', 'Chest & Triceps', 'Back & Biceps', 'Shoulders & Arms'];

function pickTitle(prng: () => number, idx: number): string {
  // Cycle but with some randomness
  if (prng() < 0.7) return TITLES[idx % TITLES.length];
  return TITLES[Math.floor(prng() * TITLES.length)];
}

export function generateSmartSessions(count: number, seed = 42): WorkoutSessionV2[] {
  const prng = createPrng(seed);
  const nowMs = Date.now();
  const sessions: WorkoutSessionV2[] = [];
  // Progressive overload state per exercise name
  const progression: Record<string, number> = {};

  for (let i = 0; i < count; i++) {
    // Spread ~2.1 days apart on average, with jitter — covers ~2.3 years for 400 sessions
    const jitterHrs = Math.floor(prng() * 12);
    const gapDays = 1.8 + prng() * 1.2; // 1.8 - 3.0 days
    const startedAtMs = nowMs - Math.round((count - 1 - i) * gapDays * 86400000) - jitterHrs * 3600000;
    const durationSec = (42 + Math.floor(prng() * 48)) * 60; // 42-90 min
    const title = pickTitle(prng, i);
    const titleNorm = normalizeLookupKey(title);
    const sessionId = `seed-${calculateChecksum(`${startedAtMs}|${title}|${i}|${seed}`)}-${i}`;

    // 3-6 exercises per session, biased toward 4-5
    const r = prng();
    const exCount = r < 0.1 ? 3 : r < 0.5 ? 4 : r < 0.85 ? 5 : 6;

    // Shuffle catalog slice deterministically
    const shuffled = [...CATALOG].sort(() => prng() - 0.5);
    const chosen = shuffled.slice(0, exCount);

    const exercises: SessionExerciseV2[] = [];
    let sessionVol = 0;

    for (let e = 0; e < chosen.length; e++) {
      const tmpl = chosen[e];
      const variationKey = prng() < 0.08 ? 'variation-' + (Math.floor(prng() * 3) + 1) : '';
      const exId = `seed-ex-${calculateChecksum(`${sessionId}|${e}|${tmpl.name}|${variationKey}`)}`;

      // Progression: weight drifts up over time per exercise (~0.5-1.5% per occurrence)
      if (progression[tmpl.name] === undefined) progression[tmpl.name] = tmpl.baseWeight;
      // Small walk
      progression[tmpl.name] += (prng() - 0.32) * 2.5; // slight upward bias
      progression[tmpl.name] = Math.max(tmpl.baseWeight * 0.6, Math.min(tmpl.baseWeight * 1.8, progression[tmpl.name]));
      const baseW = Math.round(progression[tmpl.name]);

      // 2-5 sets per exercise
      const sR = prng();
      const setCount = sR < 0.15 ? 2 : sR < 0.55 ? 3 : sR < 0.85 ? 4 : 5;

      // Occasionally superset pair
      const supersetGroupId = prng() < 0.12 && e < chosen.length - 1 ? `ss-${calculateChecksum(`${sessionId}|${e}`)}` : null;

      const sets: SetLogV2[] = [];
      for (let s = 0; s < setCount; s++) {
        // Category distribution: most are S, some W/D/F
        const catRoll = prng();
        const category = catRoll < 0.08 ? 'W' : catRoll < 0.92 ? 'S' : catRoll < 0.96 ? 'D' : 'F';

        // Completed: 96% true
        const completed = prng() < 0.96;

        // Weight with small intra-session top-set bump
        const topBump = s === setCount - 1 && prng() < 0.35 ? Math.round(2 + prng() * 7) : 0;
        const weightKg = Math.max(0, baseW + topBump + Math.round((prng() - 0.5) * 4));
        const weightMilliKg = Math.round(weightKg * 1000);

        const reps = 4 + Math.floor(prng() * 9); // 4-12
        const rpeTenths = prng() < 0.6 ? Math.round((6 + prng() * 3.5) * 10) : null; // 6-9.5

        const isUnilateral = prng() < tmpl.uniPct;

        let leftWeightMilliKg: number | null = null;
        let leftReps: number | null = null;
        let rightWeightMilliKg: number | null = null;
        let rightReps: number | null = null;

        if (isUnilateral) {
          const leftW = Math.max(0, weightKg - Math.round((prng() - 0.5) * 2));
          const rightW = Math.max(0, weightKg + Math.round((prng() - 0.5) * 2));
          leftWeightMilliKg = Math.round(leftW * 1000);
          rightWeightMilliKg = Math.round(rightW * 1000);
          leftReps = Math.max(0, reps + Math.floor((prng() - 0.5) * 2));
          rightReps = Math.max(0, reps + Math.floor((prng() - 0.5) * 2));
          // Volume counts both sides separately in lifetime query
          if (completed) sessionVol += (leftW * leftReps + rightW * rightReps);
        } else {
          if (completed) sessionVol += weightKg * reps;
        }

        const setId = `seed-set-${calculateChecksum(`${exId}|${s}|${weightMilliKg}|${reps}`)}`;
        sets.push({
          id: setId,
          position: s,
          category: category as any,
          completed,
          weightMilliKg,
          reps,
          rpeTenths,
          isUnilateral,
          leftWeightMilliKg,
          leftReps,
          rightWeightMilliKg,
          rightReps,
        });
      }

      exercises.push({
        id: exId,
        sessionId,
        exerciseId: null,
        nameSnapshot: tmpl.name,
        nameNorm: normalizeLookupKey(tmpl.name),
        variationKey,
        position: e,
        supersetGroupId: e + 1 < chosen.length && supersetGroupId ? supersetGroupId : null,
        note: prng() < 0.04 ? 'Felt strong today' : null,
        sets,
      });
      // Mirror superset id to next exercise if paired
      if (supersetGroupId && e + 1 < chosen.length && prng() < 0.7) {
        // tag next too (will be handled in next iteration's check)
      }
    }

    const endedAtMs = startedAtMs + durationSec * 1000;
    sessions.push({
      id: sessionId,
      title,
      titleNorm,
      startedAtMs,
      endedAtMs,
      durationSec,
      comment: prng() < 0.07 ? 'Great session 💪' : null,
      totalVolumeMilliKg: Math.round(sessionVol * 1000),
      prs: prng() < 0.12 ? 1 + Math.floor(prng() * 2) : 0,
      createdAtMs: startedAtMs,
      updatedAtMs: endedAtMs,
      revision: 1,
      deletedAtMs: null,
      exercises,
    });
  }

  return sessions;
}

export async function seedSmartWorkouts(count = 400, seed = 42): Promise<{ inserted: number; total: number; totalSets: number; headerMs?: number; aggregateMs?: number }> {
  const before = await countSessions();
  const sessions = generateSmartSessions(count, seed);
  const totalSets = sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets.length, 0), 0);
  // Chunked bulk import to keep transaction size bounded and avoid 17s GC-churn on x86_64 emulator
  const CHUNK = 80;
  for (let i = 0; i < sessions.length; i += CHUNK) {
    const slice = sessions.slice(i, i + CHUNK);
    await bulkImportSessions(slice);
  }
  // Update instant cache so History/Exercises reflect immediately without restart
  let headerMs: number | undefined;
  let aggregateMs: number | undefined;
  try {
    const tH0 = Date.now();
    // Measure header-only 50 fetch (no JOINs) for benchmark
    const { loadSessionHeadersChunk, loadLifetimeSetsStats } = await import('./history/repository');
    const { sessionV2ToLegacy } = await import('./history/legacySessionMapper');
    const hdrTest = await loadSessionHeadersChunk(undefined, undefined, 50);
    headerMs = Date.now() - tH0;
    const sorted = [...sessions].sort((a, b) => b.startedAtMs - a.startedAtMs);
    const after = await countSessions();
    // Cache expects legacy shape with datetime for History/Exercises instant open
    try {
      const legacySlice = sorted.slice(0, 20).map((s: any) => sessionV2ToLegacy(s));
      setCachedRecentSessions(legacySlice as any, after);
    } catch {
      setCachedRecentSessions(sorted.slice(0, 20) as any, after);
    }
    setCachedTotalSessionsCount(after);
    // Eagerly compute SQL aggregate lifetime stats (fixes 0 allTimeSets bug when sessions header-only)
    const tA0 = Date.now();
    try { await loadLifetimeSetsStats(); } catch {}
    aggregateMs = Date.now() - tA0;
  } catch {}
  const total = await countSessions();
  return { inserted: total - before, total, totalSets, headerMs, aggregateMs };
}

export async function seedIfNeeded(target = 400): Promise<{ seeded: boolean; total: number }> {
  const total = await countSessions();
  if (total >= target) return { seeded: false, total };
  const need = target - total;
  await seedSmartWorkouts(need, Date.now() % 100000);
  const after = await countSessions();
  return { seeded: true, total: after };
}
