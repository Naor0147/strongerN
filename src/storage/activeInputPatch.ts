import { ActiveWorkoutDraftV2 } from './contracts/types';
import { calculateChecksum } from './contracts/validators';
import { mmkvStorageAdapter } from './adapters/mmkvAdapter';
import { STORAGE_KEYS } from './keys';

export type PersistedInputField = 'weight' | 'reps' | 'rpe' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps';

interface ActiveInputPatchEnvelope {
  schemaVersion: 1;
  exerciseId: string;
  setId: string;
  field: PersistedInputField;
  value: string;
  writtenAtMs: number;
  checksum: string;
}
function checksumForPatch(patch: Omit<ActiveInputPatchEnvelope, 'checksum'>): string {
  return calculateChecksum(JSON.stringify(patch));
}

export function saveActiveInputPatch(
  exerciseId: string,
  setId: string,
  field: PersistedInputField,
  value: string
): void {
  const payload = {
    schemaVersion: 1 as const,
    exerciseId,
    setId,
    field,
    value: String(value),
    writtenAtMs: Date.now(),
  };
  const envelope: ActiveInputPatchEnvelope = { ...payload, checksum: checksumForPatch(payload) };
  mmkvStorageAdapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_INPUT_PATCH, JSON.stringify(envelope));
}

export function clearActiveInputPatch(): void {
  if (!mmkvStorageAdapter.isAvailable()) return;
  mmkvStorageAdapter.removeItem(STORAGE_KEYS.ACTIVE_DRAFT_INPUT_PATCH);
}

function readActiveInputPatch(): ActiveInputPatchEnvelope | null {
  const raw = mmkvStorageAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_INPUT_PATCH);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ActiveInputPatchEnvelope;
    if (parsed.schemaVersion !== 1 || !parsed.exerciseId || !parsed.setId) return null;
    if (!['weight', 'reps', 'rpe', 'leftWeight', 'leftReps', 'rightWeight', 'rightReps'].includes(parsed.field)) return null;
    const { checksum, ...payload } = parsed;
    if (!checksum || checksum !== checksumForPatch(payload)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function applyActiveInputPatch(draft: ActiveWorkoutDraftV2): ActiveWorkoutDraftV2 {
  const patch = readActiveInputPatch();
  if (!patch) return draft;
  const exerciseIndex = draft.exercises.findIndex((exercise) => exercise.id === patch.exerciseId);
  if (exerciseIndex < 0) return draft;
  const setIndex = draft.exercises[exerciseIndex].sets.findIndex((set) => set.id === patch.setId);
  if (setIndex < 0) return draft;
  const fieldMap = {
    weight: 'weightInput',
    reps: 'repsInput',
    rpe: 'rpeInput',
    leftWeight: 'leftWeightInput',
    leftReps: 'leftRepsInput',
    rightWeight: 'rightWeightInput',
    rightReps: 'rightRepsInput',
  } as const;
  const exercises = [...draft.exercises];
  const exercise = { ...exercises[exerciseIndex] };
  const sets = [...exercise.sets];
  sets[setIndex] = { ...sets[setIndex], [fieldMap[patch.field]]: patch.value };
  exercise.sets = sets;
  exercises[exerciseIndex] = exercise;
  return { ...draft, exercises };
}
