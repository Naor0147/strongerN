// src/storage/activeWorkoutSnapshot.ts
// Atomic Slot A / Slot B active workout draft snapshot store with head pointer.
// Preserves active draft durability across process death, power-off, and crash recovery.

import { mmkvStorageAdapter } from './adapters/mmkvAdapter';
import { STORAGE_KEYS } from './keys';
import { ActiveWorkoutDraftV2 } from './contracts/types';
import {
  calculateChecksum,
  validateActiveWorkoutDraftV2,
  normalizeActiveWorkoutDraftV2,
} from './contracts/validators';

export interface DraftEnvelope {
  schemaVersion: 2;
  draftId: string;
  revision: number;
  writtenAtMs: number;
  payloadChecksum: string;
  payload: ActiveWorkoutDraftV2;
}

export function computePayloadChecksum(payload: ActiveWorkoutDraftV2): string {
  const cleanPayload = { ...payload, payloadChecksum: '' };
  return calculateChecksum(JSON.stringify(cleanPayload));
}

export async function saveActiveWorkoutDraft(draft: ActiveWorkoutDraftV2): Promise<boolean> {
  const normalizedDraft = normalizeActiveWorkoutDraftV2(draft);
  const checksum = computePayloadChecksum(normalizedDraft);

  // Read current head pointer ('slot_a' or 'slot_b'). Default to 'slot_b' so first write targets 'slot_a'
  const currentHead = await mmkvStorageAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD);
  const targetSlotKey = currentHead === 'slot_a' ? STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B : STORAGE_KEYS.ACTIVE_DRAFT_SLOT_A;
  const nextHeadName = currentHead === 'slot_a' ? 'slot_b' : 'slot_a';

  const payloadWithChecksum: ActiveWorkoutDraftV2 = {
    ...normalizedDraft,
    payloadChecksum: checksum,
  };

  const envelope: DraftEnvelope = {
    schemaVersion: 2,
    draftId: normalizedDraft.draftId,
    revision: normalizedDraft.revision,
    writtenAtMs: Date.now(),
    payloadChecksum: checksum,
    payload: payloadWithChecksum,
  };

  const serializedEnvelope = JSON.stringify(envelope);

  // 1. Write to inactive slot
  await mmkvStorageAdapter.setString(targetSlotKey, serializedEnvelope);

  // 2. Read back & verify checksum
  const readBackStr = await mmkvStorageAdapter.getString(targetSlotKey);
  if (!readBackStr) {
    console.error(`[ActiveWorkoutSnapshot] Read-back verification failed for slot ${nextHeadName}: empty string`);
    return false;
  }

  try {
    const readBackEnvelope: DraftEnvelope = JSON.parse(readBackStr);
    const readBackChecksum = computePayloadChecksum(readBackEnvelope.payload);

    if (readBackChecksum !== readBackEnvelope.payloadChecksum) {
      console.error(`[ActiveWorkoutSnapshot] Checksum mismatch in slot ${nextHeadName}: expected ${readBackEnvelope.payloadChecksum}, got ${readBackChecksum}`);
      return false;
    }

    const validation = validateActiveWorkoutDraftV2(readBackEnvelope.payload);
    if (!validation.success) {
      console.error(`[ActiveWorkoutSnapshot] Validation failed for slot ${nextHeadName}: ${validation.error}`);
      return false;
    }

    // 3. Verification passed: update head pointer
    await mmkvStorageAdapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD, nextHeadName);
    return true;
  } catch (err) {
    console.error(`[ActiveWorkoutSnapshot] Failed to parse or verify slot ${nextHeadName}:`, err);
    return false;
  }
}

export async function restoreActiveWorkoutDraft(): Promise<ActiveWorkoutDraftV2 | null> {
  const rawSlotA = await mmkvStorageAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_A);
  const rawSlotB = await mmkvStorageAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B);

  const parseAndValidateSlot = (rawStr: string | null): DraftEnvelope | null => {
    if (!rawStr) return null;
    try {
      const envelope: DraftEnvelope = JSON.parse(rawStr);
      if (envelope.schemaVersion !== 2 || !envelope.payload) return null;

      const computedChecksum = computePayloadChecksum(envelope.payload);
      if (envelope.payloadChecksum && computedChecksum !== envelope.payloadChecksum) {
        console.warn('[ActiveWorkoutSnapshot] Slot checksum mismatch during restore');
        return null;
      }

      const validation = validateActiveWorkoutDraftV2(envelope.payload);
      if (!validation.success) {
        console.warn(`[ActiveWorkoutSnapshot] Slot payload invalid: ${validation.error}`);
        return null;
      }

      return envelope;
    } catch {
      return null;
    }
  };

  const slotAEnv = parseAndValidateSlot(rawSlotA);
  const slotBEnv = parseAndValidateSlot(rawSlotB);

  // If both are valid, pick highest revision
  if (slotAEnv && slotBEnv) {
    const chosen = slotAEnv.revision >= slotBEnv.revision ? slotAEnv : slotBEnv;
    return chosen.payload;
  }

  if (slotAEnv) return slotAEnv.payload;
  if (slotBEnv) return slotBEnv.payload;

  console.log('[ActiveWorkoutSnapshot] No valid active draft slot found');
  return null;
}

export async function clearActiveWorkoutDraft(): Promise<boolean> {
  await mmkvStorageAdapter.removeItem(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_A);
  await mmkvStorageAdapter.removeItem(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B);
  await mmkvStorageAdapter.removeItem(STORAGE_KEYS.ACTIVE_DRAFT_HEAD);
  return true;
}
