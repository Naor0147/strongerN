/**
 * sessionMerge.ts
 *
 * Deterministic, pure merging and deduplication of workout session chunks.
 */

import { WorkoutSessionV2 } from '../contracts/types';

export function mergeSessionChunks(
  existing: WorkoutSessionV2[],
  incoming: WorkoutSessionV2[]
): WorkoutSessionV2[] {
  if ((!existing || existing.length === 0) && (!incoming || incoming.length === 0)) {
    return [];
  }
  if (!existing || existing.length === 0) {
    return [...incoming].sort((a, b) => (b.endedAtMs ?? b.startedAtMs) - (a.endedAtMs ?? a.startedAtMs));
  }
  if (!incoming || incoming.length === 0) {
    return [...existing].sort((a, b) => (b.endedAtMs ?? b.startedAtMs) - (a.endedAtMs ?? a.startedAtMs));
  }

  const map = new Map<string, WorkoutSessionV2>();

  // Add existing
  for (let i = 0; i < existing.length; i++) {
    const s = existing[i];
    if (s && s.id) {
      map.set(s.id, s);
    }
  }

  // Merge incoming (overwrite if newer updated_at_ms or not yet present)
  for (let i = 0; i < incoming.length; i++) {
    const s = incoming[i];
    if (s && s.id) {
      const prev = map.get(s.id);
      if (!prev || s.updatedAtMs >= prev.updatedAtMs) {
        map.set(s.id, s);
      }
    }
  }

  const merged = Array.from(map.values());
  return merged.sort((a, b) => {
    const timeA = a.endedAtMs ?? a.startedAtMs;
    const timeB = b.endedAtMs ?? b.startedAtMs;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return b.id.localeCompare(a.id);
  });
}

export function mergeLegacySessionChunks(
  existing: any[],
  incoming: any[]
): any[] {
  if ((!existing || existing.length === 0) && (!incoming || incoming.length === 0)) {
    return [];
  }
  if (!existing || existing.length === 0) {
    return [...incoming].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
  }
  if (!incoming || incoming.length === 0) {
    return [...existing].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
  }

  const map = new Map<string, any>();

  for (let i = 0; i < existing.length; i++) {
    const s = existing[i];
    if (s && s.id) {
      map.set(s.id, s);
    }
  }

  for (let i = 0; i < incoming.length; i++) {
    const s = incoming[i];
    if (s && s.id) {
      map.set(s.id, s);
    }
  }

  const merged = Array.from(map.values());
  return merged.sort((a, b) => {
    const timeA = new Date(a.datetime).getTime();
    const timeB = new Date(b.datetime).getTime();
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return String(b.id).localeCompare(String(a.id));
  });
}
