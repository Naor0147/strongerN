// src/storage/contracts/validators.ts
// Runtime validators and normalizers for zero-loss persistence contracts.
// Preserves numeric 0, empty string notes, completed status, exact input strings, and exact timestamps (including timestamp 0).

import {
  SetLogV2,
  SessionExerciseV2,
  WorkoutSessionV2,
  ActiveWorkoutDraftV2,
  ActiveExerciseDraftV2,
  ActiveSetDraftV2,
  SetCategoryV2,
  LegacyAppDataV1,
  LegacyActiveWorkoutV1,
  ValidationResult,
  IdGenerator,
} from './types';

/**
 * Creates a deterministic ID generator based on a string seed or entity index.
 */
export function createDeterministicIdGenerator(namespace: string): IdGenerator {
  return (prefix: string, seed?: string | number) => {
    const rawSeed = seed !== undefined ? String(seed) : '0';
    let hash = 5381;
    const key = `${namespace}:${prefix}:${rawSeed}`;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 33) ^ key.charCodeAt(i);
    }
    const hex = (hash >>> 0).toString(16).padStart(8, '0');
    return `${prefix}-${hex}`;
  };
}

/**
 * Default fallback ID generator derived strictly from entity properties (deterministic, no Date.now()).
 */
export const defaultDeterministicIdGenerator: IdGenerator = (prefix: string, seed?: string | number) => {
  const s = seed !== undefined ? String(seed) : 'default';
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 33) ^ s.charCodeAt(i);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `${prefix}-${hex}`;
};

/**
 * Strict finite float parser. Rejects strings with trailing non-numeric characters (e.g. "12abc").
 */
export function parseStrictFloat(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return isFinite(val) ? val : null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Strict integer parser. Rejects floats and strings with non-digit characters (e.g. "12.5", "12abc").
 */
export function parseStrictInt(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return Number.isInteger(val) && val >= 0 ? val : null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

/**
 * Parses numeric weight to milli-kilograms (integer).
 * 60.5 kg -> 60500 milli-kg. 0 kg -> 0 milli-kg.
 * Returns 0 for empty or invalid, explicitly preserving 0.
 */
export function weightToMilliKg(val: any): number {
  const parsed = parseStrictFloat(val);
  if (parsed === null || parsed < 0) return 0;
  return Math.round(parsed * 1000);
}

/**
 * Converts milli-kilograms to display string.
 * 60500 -> "60.5", 0 -> "0".
 */
export function milliKgToWeightString(milliKg: number | null | undefined): string {
  if (milliKg === null || milliKg === undefined) return '';
  const kg = milliKg / 1000;
  return Number(kg.toFixed(3)).toString();
}

/**
 * Parses integer reps using strict integer parsing. Preserves 0.
 */
export function parseReps(val: any): number {
  const parsed = parseStrictInt(val);
  if (parsed === null) return 0;
  return parsed;
}

/**
 * Parses RPE into integer tenths (e.g., 8.5 RPE -> 85).
 * Returns null if not provided or invalid.
 */
export function parseRpeTenths(val: any): number | null {
  const parsed = parseStrictFloat(val);
  if (parsed === null || parsed < 0 || parsed > 10) return null;
  return Math.round(parsed * 10);
}

/**
 * Normalizes set category to 'W' | 'S' | 'D' | 'F'. Defaults to 'S'.
 */
export function normalizeSetCategory(cat: any): SetCategoryV2 {
  if (cat === 'W' || cat === 'S' || cat === 'D' || cat === 'F') {
    return cat;
  }
  return 'S';
}

/**
 * Normalizes set log from legacy or partial input with hierarchical seed pathing.
 */
export function normalizeSetLogV2(
  rawSet: any,
  position: number,
  idGen: IdGenerator = defaultDeterministicIdGenerator,
  parentSeed: string = 'set'
): SetLogV2 {
  const isUnilateral = Boolean(rawSet?.isUnilateral);

  const mainWeightMilliKg = weightToMilliKg(rawSet?.weight ?? rawSet?.weightKg);
  const mainReps = parseReps(rawSet?.reps);

  let leftWeightMilliKg: number | null = null;
  let leftReps: number | null = null;
  let rightWeightMilliKg: number | null = null;
  let rightReps: number | null = null;

  if (isUnilateral) {
    leftWeightMilliKg = rawSet?.leftWeight !== undefined && rawSet?.leftWeight !== null && rawSet?.leftWeight !== ''
      ? weightToMilliKg(rawSet.leftWeight)
      : mainWeightMilliKg;
    leftReps = rawSet?.leftReps !== undefined && rawSet?.leftReps !== null && rawSet?.leftReps !== ''
      ? parseReps(rawSet.leftReps)
      : mainReps;

    rightWeightMilliKg = rawSet?.rightWeight !== undefined && rawSet?.rightWeight !== null && rawSet?.rightWeight !== ''
      ? weightToMilliKg(rawSet.rightWeight)
      : mainWeightMilliKg;
    rightReps = rawSet?.rightReps !== undefined && rawSet?.rightReps !== null && rawSet?.rightReps !== ''
      ? parseReps(rawSet.rightReps)
      : mainReps;
  }

  const setSeed = rawSet?.id || `${parentSeed}:set:${position}:${mainWeightMilliKg}:${mainReps}`;

  return {
    id: rawSet?.id || idGen('set', setSeed),
    position,
    category: normalizeSetCategory(rawSet?.category),
    completed: Boolean(rawSet?.completed),
    weightMilliKg: mainWeightMilliKg,
    reps: mainReps,
    rpeTenths: parseRpeTenths(rawSet?.rpe),
    isUnilateral,
    leftWeightMilliKg,
    leftReps,
    rightWeightMilliKg,
    rightReps,
  };
}

/**
 * Normalizes active set draft with hierarchical seed pathing.
 */
export function normalizeActiveSetDraftV2(
  raw: any,
  position: number,
  idGen: IdGenerator = defaultDeterministicIdGenerator,
  parentSeed: string = 'active-set'
): ActiveSetDraftV2 {
  const setSeed = raw?.id || `${parentSeed}:set:${position}`;
  return {
    id: raw?.id || idGen('active-set', setSeed),
    category: normalizeSetCategory(raw?.category),
    completed: Boolean(raw?.completed),
    weightInput: raw?.weightInput !== undefined ? String(raw.weightInput) : (raw?.weight !== undefined && raw?.weight !== null ? String(raw.weight) : ''),
    repsInput: raw?.repsInput !== undefined ? String(raw.repsInput) : (raw?.reps !== undefined && raw?.reps !== null ? String(raw.reps) : ''),
    rpeInput: raw?.rpeInput !== undefined ? String(raw.rpeInput) : (raw?.rpe !== undefined && raw?.rpe !== null ? String(raw.rpe) : ''),
    isUnilateral: Boolean(raw?.isUnilateral),
    leftWeightInput: raw?.leftWeightInput !== undefined ? String(raw.leftWeightInput) : (raw?.leftWeight !== undefined && raw?.leftWeight !== null ? String(raw.leftWeight) : ''),
    leftRepsInput: raw?.leftRepsInput !== undefined ? String(raw.leftRepsInput) : (raw?.leftReps !== undefined && raw?.leftReps !== null ? String(raw.leftReps) : ''),
    rightWeightInput: raw?.rightWeightInput !== undefined ? String(raw.rightWeightInput) : (raw?.rightWeight !== undefined && raw?.rightWeight !== null ? String(raw.rightWeight) : ''),
    rightRepsInput: raw?.rightRepsInput !== undefined ? String(raw.rightRepsInput) : (raw?.rightReps !== undefined && raw?.rightReps !== null ? String(raw.rightReps) : ''),
    suggestedWeight: raw?.suggestedWeight !== undefined ? String(raw.suggestedWeight) : '',
    suggestedReps: raw?.suggestedReps !== undefined ? String(raw.suggestedReps) : '',
    suggestedLeftWeight: raw?.suggestedLeftWeight !== undefined ? String(raw.suggestedLeftWeight) : '',
    suggestedLeftReps: raw?.suggestedLeftReps !== undefined ? String(raw.suggestedLeftReps) : '',
    suggestedRightWeight: raw?.suggestedRightWeight !== undefined ? String(raw.suggestedRightWeight) : '',
    suggestedRightReps: raw?.suggestedRightReps !== undefined ? String(raw.suggestedRightReps) : '',
  };
}

/**
 * Normalizes active exercise draft with hierarchical seed pathing.
 */
export function normalizeActiveExerciseDraftV2(
  raw: any,
  position: number,
  idGen: IdGenerator = defaultDeterministicIdGenerator,
  parentSeed: string = 'active-ex'
): ActiveExerciseDraftV2 {
  let rawSets: any[] = [];
  if (Array.isArray(raw?.setsDetails)) {
    rawSets = raw.setsDetails;
  } else if (Array.isArray(raw?.sets)) {
    rawSets = raw.sets;
  } else if (typeof raw?.sets === 'number' && raw.sets > 0) {
    rawSets = Array.from({ length: raw.sets }).map(() => ({
      category: 'S',
      completed: false,
    }));
  }

  const name = (raw?.name || '').trim();
  const exerciseSeed = raw?.id || `${parentSeed}:ex:${position}:${name}`;
  const exerciseId = raw?.id || idGen('active-ex', exerciseSeed);

  return {
    id: exerciseId,
    exerciseId: raw?.exerciseId || null,
    name,
    variationKey: (raw?.variation || raw?.variationKey || '').trim(),
    supersetGroupId: raw?.superSetGroupId || raw?.supersetGroupId || null,
    note: raw?.note !== undefined && raw?.note !== null ? String(raw.note) : '',
    showNote: raw?.showNote !== undefined ? Boolean(raw.showNote) : true,
    isNoteLocked: Boolean(raw?.isNoteLocked),
    autoTimer: typeof raw?.autoTimer === 'number' ? raw.autoTimer : null,
    sets: rawSets.map((s: any, idx: number) => normalizeActiveSetDraftV2(s, idx, idGen, exerciseSeed)),
  };
}

/**
 * Normalizes active workout draft envelope with hierarchical seed pathing.
 */
export function normalizeActiveWorkoutDraftV2(
  raw: any,
  idGen: IdGenerator = defaultDeterministicIdGenerator
): ActiveWorkoutDraftV2 {
  let startedAtMs: number | null = null;

  if (raw?.startTime !== undefined && raw?.startTime !== null && raw?.startTime !== '') {
    const parsed = new Date(raw.startTime).getTime();
    if (!isNaN(parsed) && parsed >= 0) {
      startedAtMs = parsed;
    }
  }

  if (startedAtMs === null && typeof raw?.startedAtMs === 'number' && !isNaN(raw.startedAtMs) && raw.startedAtMs >= 0) {
    startedAtMs = raw.startedAtMs;
  }

  const workoutName = raw?.workoutName || raw?.title || 'Workout';
  const draftSeed = raw?.draftId || `draft:${workoutName}:${startedAtMs !== null ? startedAtMs : 'none'}`;
  const draftId = raw?.draftId || idGen('draft', draftSeed);

  const exercises = Array.isArray(raw?.workoutExercises)
    ? raw.workoutExercises.map((ex: any, idx: number) => normalizeActiveExerciseDraftV2(ex, idx, idGen, draftSeed))
    : (Array.isArray(raw?.exercises) ? raw.exercises.map((ex: any, idx: number) => normalizeActiveExerciseDraftV2(ex, idx, idGen, draftSeed)) : []);

  return {
    schemaVersion: 2,
    draftId,
    revision: typeof raw?.revision === 'number' ? raw.revision : 1,
    writtenAtMs: typeof raw?.writtenAtMs === 'number' ? raw.writtenAtMs : 0,
    payloadChecksum: raw?.payloadChecksum || '',
    isWorkoutActive: raw?.isWorkoutActive !== false && (Boolean(raw?.workoutName) || startedAtMs !== null || exercises.length > 0),
    workoutName,
    startedAtMs,
    comment: raw?.comment || '',
    isWorkoutModalVisible: raw?.isWorkoutModalVisible !== undefined ? Boolean(raw.isWorkoutModalVisible) : true,
    editingSessionId: raw?.editingSessionId || null,
    restTimerDeadlineMs: typeof raw?.restTimerDeadlineMs === 'number' ? raw.restTimerDeadlineMs : null,
    restTimerDurationSec: typeof raw?.restTimerDurationSec === 'number' ? raw.restTimerDurationSec : null,
    exercises,
  };
}

/**
 * Calculates a simple fast string checksum (DJB2 variant).
 */
export function calculateChecksum(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// ── Structurally Strict & Exhaustive Runtime Validators ────────────────────────────────

export function validateLegacyAppDataV1(raw: unknown): ValidationResult<LegacyAppDataV1> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { success: false, error: 'Root: LegacyAppDataV1 must be a non-null object' };
  }
  const obj = raw as Record<string, any>;
  if (obj.sessionsList !== undefined) {
    if (!Array.isArray(obj.sessionsList)) {
      return { success: false, error: 'sessionsList: must be an array' };
    }
    for (let i = 0; i < obj.sessionsList.length; i++) {
      const sess = obj.sessionsList[i];
      if (!sess || typeof sess !== 'object' || Array.isArray(sess)) {
        return { success: false, error: `sessionsList[${i}]: must be a non-null object` };
      }
    }
  }
  if (obj.exercisesList !== undefined) {
    if (!Array.isArray(obj.exercisesList)) {
      return { success: false, error: 'exercisesList: must be an array' };
    }
    for (let i = 0; i < obj.exercisesList.length; i++) {
      const ex = obj.exercisesList[i];
      if (!ex || typeof ex !== 'object' || Array.isArray(ex)) {
        return { success: false, error: `exercisesList[${i}]: must be a non-null object` };
      }
    }
  }
  if (obj.templatesList !== undefined && !Array.isArray(obj.templatesList)) {
    return { success: false, error: 'templatesList: must be an array' };
  }
  return { success: true, data: obj as LegacyAppDataV1 };
}

export function validateLegacyActiveWorkoutV1(raw: unknown): ValidationResult<LegacyActiveWorkoutV1> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { success: false, error: 'Root: LegacyActiveWorkoutV1 must be a non-null object' };
  }
  const obj = raw as Record<string, any>;
  if (obj.workoutExercises !== undefined) {
    if (!Array.isArray(obj.workoutExercises)) {
      return { success: false, error: 'workoutExercises: must be an array' };
    }
    for (let i = 0; i < obj.workoutExercises.length; i++) {
      const ex = obj.workoutExercises[i];
      if (!ex || typeof ex !== 'object' || Array.isArray(ex)) {
        return { success: false, error: `workoutExercises[${i}]: must be a non-null object` };
      }
      if (typeof ex.name !== 'string' || !ex.name.trim()) {
        return { success: false, error: `workoutExercises[${i}].name: must be a non-empty string` };
      }
    }
  }
  return { success: true, data: obj as LegacyActiveWorkoutV1 };
}

export function validateActiveWorkoutDraftV2(raw: unknown): ValidationResult<ActiveWorkoutDraftV2> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { success: false, error: 'Root: ActiveWorkoutDraftV2 must be a non-null object' };
  }
  const obj = raw as Record<string, any>;

  if (obj.schemaVersion !== 2) {
    return { success: false, error: `schemaVersion: expected 2, got ${obj.schemaVersion}` };
  }
  if (typeof obj.draftId !== 'string' || !obj.draftId.trim()) {
    return { success: false, error: 'draftId: must be a non-empty string' };
  }
  if (typeof obj.revision !== 'number' || !Number.isInteger(obj.revision) || obj.revision < 1) {
    return { success: false, error: `revision: expected integer >= 1, got ${obj.revision}` };
  }
  if (typeof obj.writtenAtMs !== 'number' || !Number.isInteger(obj.writtenAtMs) || obj.writtenAtMs < 0) {
    return { success: false, error: `writtenAtMs: expected non-negative integer, got ${obj.writtenAtMs}` };
  }
  if (typeof obj.payloadChecksum !== 'string') {
    return { success: false, error: 'payloadChecksum: must be a string' };
  }
  if (typeof obj.isWorkoutActive !== 'boolean') {
    return { success: false, error: `isWorkoutActive: expected boolean, got ${typeof obj.isWorkoutActive}` };
  }
  if (typeof obj.workoutName !== 'string') {
    return { success: false, error: `workoutName: expected string, got ${typeof obj.workoutName}` };
  }
  if (obj.startedAtMs !== null && (typeof obj.startedAtMs !== 'number' || !Number.isInteger(obj.startedAtMs) || obj.startedAtMs < 0)) {
    return { success: false, error: `startedAtMs: expected null or non-negative integer, got ${obj.startedAtMs}` };
  }
  if (typeof obj.comment !== 'string') {
    return { success: false, error: 'comment: expected string' };
  }
  if (typeof obj.isWorkoutModalVisible !== 'boolean') {
    return { success: false, error: `isWorkoutModalVisible: expected boolean, got ${typeof obj.isWorkoutModalVisible}` };
  }
  if (obj.editingSessionId !== null && typeof obj.editingSessionId !== 'string') {
    return { success: false, error: 'editingSessionId: expected null or string' };
  }
  if (obj.restTimerDeadlineMs !== null && (typeof obj.restTimerDeadlineMs !== 'number' || !Number.isInteger(obj.restTimerDeadlineMs) || obj.restTimerDeadlineMs < 0)) {
    return { success: false, error: 'restTimerDeadlineMs: expected null or non-negative integer' };
  }
  if (obj.restTimerDurationSec !== null && (typeof obj.restTimerDurationSec !== 'number' || !Number.isInteger(obj.restTimerDurationSec) || obj.restTimerDurationSec < 0)) {
    return { success: false, error: 'restTimerDurationSec: expected null or non-negative integer' };
  }
  if (!Array.isArray(obj.exercises)) {
    return { success: false, error: 'exercises: must be an array' };
  }

  const seenIds = new Set<string>();
  seenIds.add(obj.draftId);

  for (let i = 0; i < obj.exercises.length; i++) {
    const ex = obj.exercises[i];
    if (!ex || typeof ex !== 'object' || Array.isArray(ex)) {
      return { success: false, error: `exercises[${i}]: must be a non-null object` };
    }
    if (typeof ex.id !== 'string' || !ex.id.trim()) {
      return { success: false, error: `exercises[${i}].id: must be a non-empty string` };
    }
    if (seenIds.has(ex.id)) {
      return { success: false, error: `exercises[${i}].id: duplicate ID "${ex.id}" detected` };
    }
    seenIds.add(ex.id);

    if (ex.exerciseId !== null && typeof ex.exerciseId !== 'string') {
      return { success: false, error: `exercises[${i}].exerciseId: expected null or string` };
    }
    if (typeof ex.name !== 'string' || !ex.name.trim()) {
      return { success: false, error: `exercises[${i}].name: must be a non-empty string` };
    }
    if (typeof ex.variationKey !== 'string') {
      return { success: false, error: `exercises[${i}].variationKey: expected string` };
    }
    if (ex.supersetGroupId !== null && typeof ex.supersetGroupId !== 'string') {
      return { success: false, error: `exercises[${i}].supersetGroupId: expected null or string` };
    }
    if (typeof ex.note !== 'string') {
      return { success: false, error: `exercises[${i}].note: expected string` };
    }
    if (typeof ex.showNote !== 'boolean') {
      return { success: false, error: `exercises[${i}].showNote: expected boolean` };
    }
    if (typeof ex.isNoteLocked !== 'boolean') {
      return { success: false, error: `exercises[${i}].isNoteLocked: expected boolean` };
    }
    if (ex.autoTimer !== null && (typeof ex.autoTimer !== 'number' || !Number.isInteger(ex.autoTimer) || ex.autoTimer < 0)) {
      return { success: false, error: `exercises[${i}].autoTimer: expected null or non-negative integer` };
    }
    if (!Array.isArray(ex.sets)) {
      return { success: false, error: `exercises[${i}].sets: must be an array` };
    }

    for (let j = 0; j < ex.sets.length; j++) {
      const s = ex.sets[j];
      if (!s || typeof s !== 'object' || Array.isArray(s)) {
        return { success: false, error: `exercises[${i}].sets[${j}]: must be a non-null object` };
      }
      if (typeof s.id !== 'string' || !s.id.trim()) {
        return { success: false, error: `exercises[${i}].sets[${j}].id: must be a non-empty string` };
      }
      if (seenIds.has(s.id)) {
        return { success: false, error: `exercises[${i}].sets[${j}].id: duplicate ID "${s.id}" detected` };
      }
      seenIds.add(s.id);

      if (s.category !== 'W' && s.category !== 'S' && s.category !== 'D' && s.category !== 'F') {
        return { success: false, error: `exercises[${i}].sets[${j}].category: invalid category "${s.category}"` };
      }
      if (typeof s.completed !== 'boolean') {
        return { success: false, error: `exercises[${i}].sets[${j}].completed: expected boolean` };
      }
      if (typeof s.weightInput !== 'string') {
        return { success: false, error: `exercises[${i}].sets[${j}].weightInput: must be string` };
      }
      if (typeof s.repsInput !== 'string') {
        return { success: false, error: `exercises[${i}].sets[${j}].repsInput: must be string` };
      }
      if (typeof s.rpeInput !== 'string') {
        return { success: false, error: `exercises[${i}].sets[${j}].rpeInput: must be string` };
      }
      if (typeof s.isUnilateral !== 'boolean') {
        return { success: false, error: `exercises[${i}].sets[${j}].isUnilateral: expected boolean` };
      }
      if (typeof s.leftWeightInput !== 'string' || typeof s.leftRepsInput !== 'string' || typeof s.rightWeightInput !== 'string' || typeof s.rightRepsInput !== 'string') {
        return { success: false, error: `exercises[${i}].sets[${j}]: unilateral side input fields must be strings` };
      }
      if (typeof s.suggestedWeight !== 'string' || typeof s.suggestedReps !== 'string' || typeof s.suggestedLeftWeight !== 'string' || typeof s.suggestedLeftReps !== 'string' || typeof s.suggestedRightWeight !== 'string' || typeof s.suggestedRightReps !== 'string') {
        return { success: false, error: `exercises[${i}].sets[${j}]: suggestion fields must be strings` };
      }
    }
  }

  return { success: true, data: obj as ActiveWorkoutDraftV2 };
}

export function validateWorkoutSessionV2(raw: unknown): ValidationResult<WorkoutSessionV2> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { success: false, error: 'Root: WorkoutSessionV2 must be a non-null object' };
  }
  const obj = raw as Record<string, any>;

  if (typeof obj.id !== 'string' || !obj.id.trim()) {
    return { success: false, error: 'id: must be a non-empty string' };
  }
  if (typeof obj.title !== 'string') {
    return { success: false, error: 'title: must be a string' };
  }
  if (typeof obj.titleNorm !== 'string') {
    return { success: false, error: 'titleNorm: must be a string' };
  }
  if (typeof obj.startedAtMs !== 'number' || !Number.isInteger(obj.startedAtMs) || obj.startedAtMs < 0) {
    return { success: false, error: `startedAtMs: expected non-negative integer, got ${obj.startedAtMs}` };
  }
  if (obj.endedAtMs !== null && (typeof obj.endedAtMs !== 'number' || !Number.isInteger(obj.endedAtMs) || obj.endedAtMs < 0)) {
    return { success: false, error: `endedAtMs: expected null or non-negative integer, got ${obj.endedAtMs}` };
  }
  if (typeof obj.durationSec !== 'number' || !Number.isInteger(obj.durationSec) || obj.durationSec < 0) {
    return { success: false, error: `durationSec: expected non-negative integer, got ${obj.durationSec}` };
  }
  if (obj.comment !== null && typeof obj.comment !== 'string') {
    return { success: false, error: 'comment: expected null or string' };
  }
  if (typeof obj.totalVolumeMilliKg !== 'number' || !Number.isInteger(obj.totalVolumeMilliKg) || obj.totalVolumeMilliKg < 0) {
    return { success: false, error: `totalVolumeMilliKg: expected non-negative integer, got ${obj.totalVolumeMilliKg}` };
  }
  if (typeof obj.prs !== 'number' || !Number.isInteger(obj.prs) || obj.prs < 0) {
    return { success: false, error: `prs: expected non-negative integer, got ${obj.prs}` };
  }
  if (typeof obj.createdAtMs !== 'number' || !Number.isInteger(obj.createdAtMs) || obj.createdAtMs < 0) {
    return { success: false, error: `createdAtMs: expected non-negative integer, got ${obj.createdAtMs}` };
  }
  if (typeof obj.updatedAtMs !== 'number' || !Number.isInteger(obj.updatedAtMs) || obj.updatedAtMs < 0) {
    return { success: false, error: `updatedAtMs: expected non-negative integer, got ${obj.updatedAtMs}` };
  }
  if (typeof obj.revision !== 'number' || !Number.isInteger(obj.revision) || obj.revision < 1) {
    return { success: false, error: `revision: expected integer >= 1, got ${obj.revision}` };
  }
  if (obj.deletedAtMs !== null && (typeof obj.deletedAtMs !== 'number' || !Number.isInteger(obj.deletedAtMs) || obj.deletedAtMs < 0)) {
    return { success: false, error: `deletedAtMs: expected null or non-negative integer, got ${obj.deletedAtMs}` };
  }
  if (!Array.isArray(obj.exercises)) {
    return { success: false, error: 'exercises: must be an array' };
  }

  const seenIds = new Set<string>();
  seenIds.add(obj.id);

  for (let i = 0; i < obj.exercises.length; i++) {
    const ex = obj.exercises[i];
    if (!ex || typeof ex !== 'object' || Array.isArray(ex)) {
      return { success: false, error: `exercises[${i}]: must be a non-null object` };
    }
    if (typeof ex.id !== 'string' || !ex.id.trim()) {
      return { success: false, error: `exercises[${i}].id: must be a non-empty string` };
    }
    if (seenIds.has(ex.id)) {
      return { success: false, error: `exercises[${i}].id: duplicate ID "${ex.id}" detected` };
    }
    seenIds.add(ex.id);

    if (ex.sessionId !== obj.id) {
      return { success: false, error: `exercises[${i}].sessionId: expected "${obj.id}", got "${ex.sessionId}"` };
    }
    if (ex.exerciseId !== null && typeof ex.exerciseId !== 'string') {
      return { success: false, error: `exercises[${i}].exerciseId: expected null or string` };
    }
    if (typeof ex.nameSnapshot !== 'string' || !ex.nameSnapshot.trim()) {
      return { success: false, error: `exercises[${i}].nameSnapshot: must be a non-empty string` };
    }
    if (typeof ex.nameNorm !== 'string') {
      return { success: false, error: `exercises[${i}].nameNorm: must be a string` };
    }
    if (typeof ex.variationKey !== 'string') {
      return { success: false, error: `exercises[${i}].variationKey: must be a string` };
    }
    if (typeof ex.position !== 'number' || ex.position !== i) {
      return { success: false, error: `exercises[${i}].position: expected ${i}, got ${ex.position}` };
    }
    if (ex.supersetGroupId !== null && typeof ex.supersetGroupId !== 'string') {
      return { success: false, error: `exercises[${i}].supersetGroupId: expected null or string` };
    }
    if (ex.note !== null && typeof ex.note !== 'string') {
      return { success: false, error: `exercises[${i}].note: expected null or string` };
    }
    if (!Array.isArray(ex.sets)) {
      return { success: false, error: `exercises[${i}].sets: must be an array` };
    }

    for (let j = 0; j < ex.sets.length; j++) {
      const s = ex.sets[j];
      if (!s || typeof s !== 'object' || Array.isArray(s)) {
        return { success: false, error: `exercises[${i}].sets[${j}]: must be a non-null object` };
      }
      if (typeof s.id !== 'string' || !s.id.trim()) {
        return { success: false, error: `exercises[${i}].sets[${j}].id: must be a non-empty string` };
      }
      if (seenIds.has(s.id)) {
        return { success: false, error: `exercises[${i}].sets[${j}].id: duplicate ID "${s.id}" detected` };
      }
      seenIds.add(s.id);

      if (typeof s.position !== 'number' || s.position !== j) {
        return { success: false, error: `exercises[${i}].sets[${j}].position: expected ${j}, got ${s.position}` };
      }
      if (s.category !== 'W' && s.category !== 'S' && s.category !== 'D' && s.category !== 'F') {
        return { success: false, error: `exercises[${i}].sets[${j}].category: invalid category "${s.category}"` };
      }
      if (typeof s.completed !== 'boolean') {
        return { success: false, error: `exercises[${i}].sets[${j}].completed: expected boolean` };
      }
      if (typeof s.weightMilliKg !== 'number' || !Number.isInteger(s.weightMilliKg) || s.weightMilliKg < 0) {
        return { success: false, error: `exercises[${i}].sets[${j}].weightMilliKg: expected non-negative integer` };
      }
      if (typeof s.reps !== 'number' || !Number.isInteger(s.reps) || s.reps < 0) {
        return { success: false, error: `exercises[${i}].sets[${j}].reps: expected non-negative integer` };
      }
      if (s.rpeTenths !== null && (typeof s.rpeTenths !== 'number' || !Number.isInteger(s.rpeTenths) || s.rpeTenths < 0 || s.rpeTenths > 100)) {
        return { success: false, error: `exercises[${i}].sets[${j}].rpeTenths: expected null or integer between 0 and 100` };
      }
      if (typeof s.isUnilateral !== 'boolean') {
        return { success: false, error: `exercises[${i}].sets[${j}].isUnilateral: expected boolean` };
      }
      if (s.leftWeightMilliKg !== null && (typeof s.leftWeightMilliKg !== 'number' || !Number.isInteger(s.leftWeightMilliKg) || s.leftWeightMilliKg < 0)) {
        return { success: false, error: `exercises[${i}].sets[${j}].leftWeightMilliKg: expected null or non-negative integer` };
      }
      if (s.leftReps !== null && (typeof s.leftReps !== 'number' || !Number.isInteger(s.leftReps) || s.leftReps < 0)) {
        return { success: false, error: `exercises[${i}].sets[${j}].leftReps: expected null or non-negative integer` };
      }
      if (s.rightWeightMilliKg !== null && (typeof s.rightWeightMilliKg !== 'number' || !Number.isInteger(s.rightWeightMilliKg) || s.rightWeightMilliKg < 0)) {
        return { success: false, error: `exercises[${i}].sets[${j}].rightWeightMilliKg: expected null or non-negative integer` };
      }
      if (s.rightReps !== null && (typeof s.rightReps !== 'number' || !Number.isInteger(s.rightReps) || s.rightReps < 0)) {
        return { success: false, error: `exercises[${i}].sets[${j}].rightReps: expected null or non-negative integer` };
      }
    }
  }

  return { success: true, data: obj as WorkoutSessionV2 };
}
