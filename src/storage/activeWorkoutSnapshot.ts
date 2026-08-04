// src/storage/activeWorkoutSnapshot.ts
// Atomic Slot A / Slot B active workout draft snapshot store with head pointer, monotonic sequence, and crash-safe tombstone clear.

import { mmkvStorageAdapter, DurableStorageUnavailableError } from './adapters/mmkvAdapter';
import { STORAGE_KEYS } from './keys';
import { ActiveWorkoutDraftV2 } from './contracts/types';
import {
  calculateChecksum,
  validateActiveWorkoutDraftV2,
  normalizeActiveWorkoutDraftV2,
} from './contracts/validators';
import { applyActiveInputPatch, clearActiveInputPatch } from './activeInputPatch';

export interface DraftEnvelope {
  schemaVersion: 2;
  kind: 'draft' | 'tombstone';
  draftId: string;
  sequence: number;
  revision: number;
  writtenAtMs: number;
  payloadChecksum: string;
  payload: ActiveWorkoutDraftV2 | null;
}

/**
 * Computes payload checksum cleanly.
 */
export function computePayloadChecksum(payload: ActiveWorkoutDraftV2 | null): string {
  if (!payload) return calculateChecksum('null');
  const cleanPayload = { ...payload, payloadChecksum: '' };
  return calculateChecksum(JSON.stringify(cleanPayload));
}

/**
 * Strictly validates draft envelope format, checksums, sequence, timestamps, and payload agreement.
 */
export function parseAndValidateEnvelope(rawStr: string | null): DraftEnvelope | null {
  if (!rawStr || typeof rawStr !== 'string' || !rawStr.trim()) return null;

  try {
    const env = JSON.parse(rawStr);
    if (!env || typeof env !== 'object' || Array.isArray(env)) return null;

    if (env.schemaVersion !== 2) return null;
    if (env.kind !== 'draft' && env.kind !== 'tombstone') return null;

    if (typeof env.sequence !== 'number' || !Number.isInteger(env.sequence) || env.sequence < 1) return null;
    if (typeof env.revision !== 'number' || !Number.isInteger(env.revision) || env.revision < 0) return null;
    if (typeof env.writtenAtMs !== 'number' || !Number.isInteger(env.writtenAtMs) || env.writtenAtMs < 0) return null;

    if (typeof env.payloadChecksum !== 'string' || !env.payloadChecksum.trim()) return null;

    if (env.kind === 'tombstone') {
      if (env.draftId !== 'tombstone' || env.revision < 1) return null;
      if (env.payload !== null) return null;
      const expectedChecksum = calculateChecksum('null');
      if (env.payloadChecksum !== expectedChecksum) return null;
      return env as DraftEnvelope;
    }

    // kind === 'draft'
    if (typeof env.draftId !== 'string' || !env.draftId.trim()) return null;
    if (!env.payload || typeof env.payload !== 'object') return null;

    const computedChecksum = computePayloadChecksum(env.payload);
    if (env.payloadChecksum !== computedChecksum) return null;

    if (env.payload.draftId !== env.draftId || env.payload.revision !== env.revision) return null;

    const payloadValidation = validateActiveWorkoutDraftV2(env.payload);
    if (!payloadValidation.success) return null;

    return env as DraftEnvelope;
  } catch {
    return null;
  }
}

type JournalCandidate = { slotName: 'slot_a' | 'slot_b'; env: DraftEnvelope };

function compareCandidates(a: JournalCandidate, b: JournalCandidate, head: string | null): number {
  if (a.env.sequence !== b.env.sequence) return b.env.sequence - a.env.sequence;
  if (a.env.writtenAtMs !== b.env.writtenAtMs) return b.env.writtenAtMs - a.env.writtenAtMs;
  if (a.slotName === head) return -1;
  if (b.slotName === head) return 1;
  return a.slotName.localeCompare(b.slotName);
}

function readJournal(): { head: string | null; candidates: JournalCandidate[] } {
  const head = mmkvStorageAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD);
  const slotAEnv = parseAndValidateEnvelope(mmkvStorageAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_A));
  const slotBEnv = parseAndValidateEnvelope(mmkvStorageAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B));
  const candidates: JournalCandidate[] = [];
  if (slotAEnv) candidates.push({ slotName: 'slot_a', env: slotAEnv });
  if (slotBEnv) candidates.push({ slotName: 'slot_b', env: slotBEnv });
  candidates.sort((a, b) => compareCandidates(a, b, head));
  return { head, candidates };
}

function nextJournalPosition(): {
  sequence: number;
  revision: number;
  targetSlotKey: string;
  targetSlotName: 'slot_a' | 'slot_b';
} {
  const { head, candidates } = readJournal();
  const latest = candidates[0];
  const occupiedSlot = latest?.slotName ?? (head === 'slot_a' || head === 'slot_b' ? head : 'slot_b');
  const targetSlotName = occupiedSlot === 'slot_a' ? 'slot_b' : 'slot_a';
  return {
    sequence: (latest?.env.sequence ?? 0) + 1,
    revision: (latest?.env.revision ?? 0) + 1,
    targetSlotKey: targetSlotName === 'slot_a'
      ? STORAGE_KEYS.ACTIVE_DRAFT_SLOT_A
      : STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B,
    targetSlotName,
  };
}

export function hasActiveWorkoutJournalRecord(): boolean {
  if (!mmkvStorageAdapter.isAvailable()) return false;
  return readJournal().candidates.length > 0;
}

export function saveActiveWorkoutDraft(draft: ActiveWorkoutDraftV2): boolean {
  if (!mmkvStorageAdapter.isAvailable()) {
    throw new DurableStorageUnavailableError('Storage adapter unavailable during saveActiveWorkoutDraft');
  }

  const position = nextJournalPosition();
  const now = Date.now();
  const normalizedDraft = normalizeActiveWorkoutDraftV2({
    ...draft,
    revision: Math.max(draft.revision || 1, position.revision),
    writtenAtMs: now,
  });
  const checksum = computePayloadChecksum(normalizedDraft);

  const payloadWithChecksum: ActiveWorkoutDraftV2 = {
    ...normalizedDraft,
    payloadChecksum: checksum,
  };

  const envelope: DraftEnvelope = {
    schemaVersion: 2,
    kind: 'draft',
    draftId: normalizedDraft.draftId,
    sequence: position.sequence,
    revision: normalizedDraft.revision,
    writtenAtMs: now,
    payloadChecksum: checksum,
    payload: payloadWithChecksum,
  };

  const serializedEnvelope = JSON.stringify(envelope);

  // 1. Write to inactive slot
  const writeSuccess = mmkvStorageAdapter.setString(position.targetSlotKey, serializedEnvelope);
  if (!writeSuccess) {
    throw new DurableStorageUnavailableError(`Failed to write active workout snapshot to slot ${position.targetSlotName}`);
  }

  // 2. Read back & verify checksum & envelope validity
  const readBackStr = mmkvStorageAdapter.getString(position.targetSlotKey);
  const readBackEnvelope = parseAndValidateEnvelope(readBackStr);

  if (!readBackEnvelope || readBackEnvelope.sequence !== position.sequence || readBackEnvelope.payloadChecksum !== checksum) {
    throw new DurableStorageUnavailableError(`Read-back verification failed for active workout slot ${position.targetSlotName}`);
  }

  // The head is only a hint. The verified slot is already durable and restore scans both.
  try {
    mmkvStorageAdapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD, position.targetSlotName);
  } catch (error) {
    console.warn('[ActiveWorkoutSnapshot] Head pointer update failed; verified slot remains recoverable.', error);
  }

  return true;
}

export function restoreActiveWorkoutDraft(): ActiveWorkoutDraftV2 | null {
  if (!mmkvStorageAdapter.isAvailable()) {
    throw new DurableStorageUnavailableError('Storage adapter unavailable during restoreActiveWorkoutDraft');
  }

  const { candidates } = readJournal();

  if (candidates.length === 0) {
    return null;
  }

  const bestCandidate = candidates[0].env;

  // Tombstone check: if newest valid envelope is tombstone, active workout is cleared!
  if (bestCandidate.kind === 'tombstone') {
    return null;
  }

  return bestCandidate.payload ? applyActiveInputPatch(bestCandidate.payload) : null;
}

export function clearActiveWorkoutDraft(): boolean {
  if (!mmkvStorageAdapter.isAvailable()) {
    throw new DurableStorageUnavailableError('Storage adapter unavailable during clearActiveWorkoutDraft');
  }

  const position = nextJournalPosition();

  const tombstoneEnvelope: DraftEnvelope = {
    schemaVersion: 2,
    kind: 'tombstone',
    draftId: 'tombstone',
    sequence: position.sequence,
    revision: position.revision,
    writtenAtMs: Date.now(),
    payloadChecksum: calculateChecksum('null'),
    payload: null,
  };

  const serialized = JSON.stringify(tombstoneEnvelope);

  mmkvStorageAdapter.setString(position.targetSlotKey, serialized);
  const verified = parseAndValidateEnvelope(mmkvStorageAdapter.getString(position.targetSlotKey));
  if (!verified || verified.kind !== 'tombstone' || verified.sequence !== position.sequence) {
    throw new DurableStorageUnavailableError('Tombstone read-back verification failed');
  }
  try {
    mmkvStorageAdapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD, position.targetSlotName);
  } catch (error) {
    console.warn('[ActiveWorkoutSnapshot] Tombstone head update failed; tombstone remains recoverable.', error);
  }
  try { clearActiveInputPatch(); } catch {}
  return true;
}
