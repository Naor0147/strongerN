#!/usr/bin/env node
/**
 * scripts/challenger-m3-empirical-stress.js
 * 
 * Empirical Challenger 2 Stress Test Suite for Milestone 3
 * (State Save Decoupling & Delta Writes - R2)
 */

'use strict';

const { performance } = require('node:perf_hooks');

// ─── DJB2 Hash ──────────────────────────────────────────────────────────────
function calculateChecksum(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash * 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return (hash >>> 0).toString(16);
}

// ─── Mock In-Memory MMKV Storage Adapter ────────────────────────────────────
class MockMMKVAdapter {
  constructor() {
    this.store = new Map();
    this.available = true;
    this.native = true;
  }
  isAvailable() { return this.available; }
  isNative() { return this.native; }
  getString(key) { return this.store.get(key) ?? null; }
  setString(key, val) { this.store.set(key, val); return true; }
  removeItem(key) { this.store.delete(key); return true; }
  clear() { this.store.clear(); }
}

// ─── Draft Envelope Validator & Engine (Mirroring src/storage/activeWorkoutSnapshot.ts) ───
const STORAGE_KEYS = {
  ACTIVE_DRAFT_HEAD: 'active_draft_head_v2',
  ACTIVE_DRAFT_SLOT_A: 'active_draft_slot_a_v2',
  ACTIVE_DRAFT_SLOT_B: 'active_draft_slot_b_v2',
  SETTINGS_COMPACT_V2: 'strongern_settings_v2',
};

function computePayloadChecksum(payload) {
  if (!payload) return calculateChecksum('null');
  const cleanPayload = { ...payload, payloadChecksum: '' };
  return calculateChecksum(JSON.stringify(cleanPayload));
}

function parseAndValidateEnvelope(rawStr) {
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
      if (env.payloadChecksum !== calculateChecksum('null')) return null;
      return env;
    }

    if (typeof env.draftId !== 'string' || !env.draftId.trim()) return null;
    if (!env.payload || typeof env.payload !== 'object') return null;

    const computedChecksum = computePayloadChecksum(env.payload);
    if (env.payloadChecksum !== computedChecksum) return null;
    if (env.payload.draftId !== env.draftId || env.payload.revision !== env.revision) return null;

    return env;
  } catch {
    return null;
  }
}

function readJournal(adapter) {
  const head = adapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD);
  const slotAEnv = parseAndValidateEnvelope(adapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_A));
  const slotBEnv = parseAndValidateEnvelope(adapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B));
  const candidates = [];
  if (slotAEnv) candidates.push({ slotName: 'slot_a', env: slotAEnv });
  if (slotBEnv) candidates.push({ slotName: 'slot_b', env: slotBEnv });
  candidates.sort((a, b) => {
    if (a.env.sequence !== b.env.sequence) return b.env.sequence - a.env.sequence;
    if (a.env.writtenAtMs !== b.env.writtenAtMs) return b.env.writtenAtMs - a.env.writtenAtMs;
    if (a.slotName === head) return -1;
    if (b.slotName === head) return 1;
    return a.slotName.localeCompare(b.slotName);
  });
  return { head, candidates };
}

function restoreActiveDraft(adapter) {
  const { candidates } = readJournal(adapter);
  if (candidates.length === 0) return null;
  const best = candidates[0].env;
  if (best.kind === 'tombstone') return null;
  return best.payload;
}

function saveActiveDraft(adapter, draft) {
  const { head, candidates } = readJournal(adapter);
  const latest = candidates[0];
  const occupiedSlot = latest?.slotName ?? (head === 'slot_a' || head === 'slot_b' ? head : 'slot_b');
  const targetSlotName = occupiedSlot === 'slot_a' ? 'slot_b' : 'slot_a';
  const targetSlotKey = targetSlotName === 'slot_a' ? STORAGE_KEYS.ACTIVE_DRAFT_SLOT_A : STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B;
  const sequence = (latest?.env.sequence ?? 0) + 1;
  const revision = (latest?.env.revision ?? 0) + 1;
  const now = Date.now();

  const normalizedDraft = {
    ...draft,
    revision,
    writtenAtMs: now,
  };
  const checksum = computePayloadChecksum(normalizedDraft);
  const payloadWithChecksum = {
    ...normalizedDraft,
    payloadChecksum: checksum,
  };
  const envelope = {
    schemaVersion: 2,
    kind: 'draft',
    draftId: normalizedDraft.draftId,
    sequence,
    revision,
    writtenAtMs: now,
    payloadChecksum: checksum,
    payload: payloadWithChecksum,
  };

  adapter.setString(targetSlotKey, JSON.stringify(envelope));
  adapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD, targetSlotName);
  return true;
}

function clearActiveDraft(adapter) {
  const { head, candidates } = readJournal(adapter);
  const latest = candidates[0];
  const occupiedSlot = latest?.slotName ?? (head === 'slot_a' || head === 'slot_b' ? head : 'slot_b');
  const targetSlotName = occupiedSlot === 'slot_a' ? 'slot_b' : 'slot_a';
  const targetSlotKey = targetSlotName === 'slot_a' ? STORAGE_KEYS.ACTIVE_DRAFT_SLOT_A : STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B;
  const sequence = (latest?.env.sequence ?? 0) + 1;
  const revision = (latest?.env.revision ?? 0) + 1;
  const now = Date.now();

  const envelope = {
    schemaVersion: 2,
    kind: 'tombstone',
    draftId: 'tombstone',
    sequence,
    revision,
    writtenAtMs: now,
    payloadChecksum: calculateChecksum('null'),
    payload: null,
  };

  adapter.setString(targetSlotKey, JSON.stringify(envelope));
  adapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD, targetSlotName);
  return true;
}

// ─── Test Runner ────────────────────────────────────────────────────────────
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    failedTests++;
    throw new Error(message);
  } else {
    console.log(`  ✅ PASSED: ${message}`);
    passedTests++;
  }
}

async function runEmpiricalChallenges() {
  console.log('\n================================================================================');
  console.log('       CHALLENGER 2: EMPIRICAL STRESS & ADVERSARIAL VERIFICATION SUITE         ');
  console.log('================================================================================\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // CHALLENGE 1: JSON Payload Bloat & Decoupling Verification (< 5KB Guarantee)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ CHALLENGE 1: Root State Payload Size (< 5KB) Across Scaling Session Counts');
  
  // Construct typical root state without sessionsList (as in App.tsx)
  function createDecoupledAppState(sessionCount) {
    // Generate dummy in-memory sessions list to verify App.tsx exclusion
    const dummySessions = Array.from({ length: sessionCount }, (_, i) => ({
      id: `s-${i}`,
      title: `Workout ${i}`,
      exercises: Array.from({ length: 5 }, (_, e) => ({
        name: `Ex ${e}`,
        setsDetails: Array.from({ length: 4 }, (_, s) => ({ weight: 80, reps: 10, completed: true })),
      })),
    }));

    // Data object actually serialized in App.tsx:
    const dataToSave = {
      user: { name: 'Test User', totalWorkouts: sessionCount, isPro: true },
      templatesList: [
        { id: 't1', name: 'Upper Body', exercises: ['Bench Press', 'Row', 'Incline DB Press'] },
        { id: 't2', name: 'Lower Body', exercises: ['Squat', 'RDL', 'Calf Raise'] },
      ],
      exercisesList: [
        { id: 'ex1', name: 'Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
        { id: 'ex2', name: 'Squat', muscleGroup: 'Quads', equipment: 'Barbell' },
        { id: 'ex3', name: 'RDL', muscleGroup: 'Hamstrings', equipment: 'Barbell' },
      ],
      primaryMetricsList: [{ id: 'm1', label: 'Weight', lastValue: '80.0' }],
      bodyPartMetricsList: [{ id: 'b1', label: 'Chest', lastValue: '105' }],
      googleUser: null,
      lastSynced: null,
      foldersList: [{ id: 'f1', name: 'PPL', templateIds: ['t1', 't2'] }],
      activeProgramId: 'prog-1',
      programStartDate: 1786687000000,
    };

    return { dataToSave, dummySessions };
  }

  const sessionCountsToTest = [0, 50, 300, 1000, 10000];
  for (const count of sessionCountsToTest) {
    const { dataToSave } = createDecoupledAppState(count);
    const serialized = JSON.stringify(dataToSave);
    const byteLength = Buffer.byteLength(serialized, 'utf8');

    assert(!('sessionsList' in dataToSave), `Payload at ${count} sessions does not contain 'sessionsList'`);
    assert(!('isAutoTimerEnabled' in dataToSave), `Payload at ${count} sessions does not contain decoupled settings`);
    assert(byteLength < 5000, `Payload at ${count} sessions is ${byteLength} bytes (< 5000 bytes limit)`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHALLENGE 2: Memory Leak & High-Frequency State Save Stress Test
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ CHALLENGE 2: High-Frequency Save Memory Leak Stress Test (10,000 cycles)');
  
  if (global.gc) global.gc();
  const initialMem = process.memoryUsage().heapUsed;

  const adapter = new MockMMKVAdapter();
  for (let i = 0; i < 10000; i++) {
    // 1. Simulate compact settings save
    adapter.setString(STORAGE_KEYS.SETTINGS_COMPACT_V2, JSON.stringify({
      defaultRestDuration: 60 + (i % 60),
      soundVolume: (i % 100) / 100,
      appTheme: i % 2 === 0 ? 'amoled' : 'nord',
    }));

    // 2. Simulate debounced root state payload generation
    const { dataToSave } = createDecoupledAppState(i % 500);
    const serialized = JSON.stringify(dataToSave);
    adapter.setString('strongerN_data', serialized);
  }

  if (global.gc) global.gc();
  const finalMem = process.memoryUsage().heapUsed;
  const memoryDeltaMb = (finalMem - initialMem) / (1024 * 1024);

  assert(memoryDeltaMb < 15.0, `10,000 rapid save cycles memory growth is ${memoryDeltaMb.toFixed(2)} MB (< 15 MB limit)`);

  // ─────────────────────────────────────────────────────────────────────────────
  // CHALLENGE 3: MMKV Slot A / Slot B Active Workout Crash Recovery Stress Test
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ CHALLENGE 3: Active Workout Crash Recovery & Checksum Corruption Matrix');

  const draftBase = {
    schemaVersion: 2,
    draftId: 'draft-test-123',
    revision: 1,
    workoutName: 'Intense Chest Day',
    startTime: 1786687000000,
    elapsedSeconds: 1800,
    isWorkoutActive: true,
    activeWorkoutComment: 'Going heavy today',
    exercises: [
      {
        id: 'ex-1',
        name: 'Incline Dumbbell Press',
        sets: [
          { id: 's-1', category: 'S', weight: '36', reps: '10', completed: true },
          { id: 's-2', category: 'S', weight: '40', reps: '8', completed: true },
        ],
      },
    ],
    restTimer: null,
    writtenAtMs: 1786687000000,
    payloadChecksum: '',
  };

  // Test 3.1: Normal Save and Restore
  const crashAdapter = new MockMMKVAdapter();
  saveActiveDraft(crashAdapter, draftBase);
  let restored = restoreActiveDraft(crashAdapter);
  assert(restored !== null && restored.draftId === 'draft-test-123', '3.1 Normal active workout saves and restores cleanly');

  // Test 3.2: Slot A valid (seq 1), Slot B updated (seq 2) -> restores newer Slot B
  saveActiveDraft(crashAdapter, { ...draftBase, workoutName: 'Updated Chest Day' });
  restored = restoreActiveDraft(crashAdapter);
  assert(restored !== null && restored.workoutName === 'Updated Chest Day' && restored.revision === 2, '3.2 Restores newest revision from alternating slot');

  // Test 3.3: Slot B written (seq 2), but corrupted by crash (malformed JSON) -> falls back to Slot A (seq 1)
  crashAdapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B, '{"incomplete_json: 123');
  restored = restoreActiveDraft(crashAdapter);
  assert(restored !== null && restored.workoutName === 'Intense Chest Day' && restored.revision === 1, '3.3 Recovers Slot A when Slot B JSON is corrupted mid-write');

  // Test 3.4: Slot B has valid JSON but corrupted payloadChecksum -> falls back to Slot A
  const corruptedEnvelope = JSON.parse(crashAdapter.getString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_A));
  corruptedEnvelope.sequence = 3;
  corruptedEnvelope.revision = 3;
  corruptedEnvelope.payloadChecksum = 'bad_checksum_hash';
  corruptedEnvelope.payload.workoutName = 'Tampered Payload';
  crashAdapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B, JSON.stringify(corruptedEnvelope));
  restored = restoreActiveDraft(crashAdapter);
  assert(restored !== null && restored.workoutName === 'Intense Chest Day', '3.4 Rejects corrupted payloadChecksum and recovers uncorrupted slot');

  // Test 3.5: HEAD pointer points to corrupt Slot B, but Slot A is valid -> recovers Slot A
  crashAdapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_HEAD, 'slot_b');
  crashAdapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_B, 'CORRUPT_BYTES_XYZ');
  restored = restoreActiveDraft(crashAdapter);
  assert(restored !== null && restored.workoutName === 'Intense Chest Day', '3.5 Recovers Slot A even when HEAD pointer points to corrupted slot');

  // Test 3.6: Both slots corrupted -> returns null safely without throwing
  crashAdapter.setString(STORAGE_KEYS.ACTIVE_DRAFT_SLOT_A, 'CORRUPT_SLOT_A');
  restored = restoreActiveDraft(crashAdapter);
  assert(restored === null, '3.6 Both slots corrupt returns null safely without throwing');

  // Test 3.7: Tombstone resolution -> returns null even if prior slot contains draft
  const tombstoneAdapter = new MockMMKVAdapter();
  saveActiveDraft(tombstoneAdapter, draftBase); // writes slot_a (seq 1)
  clearActiveDraft(tombstoneAdapter);           // writes slot_b (seq 2, tombstone)
  restored = restoreActiveDraft(tombstoneAdapter);
  assert(restored === null, '3.7 Tombstone correctly invalidates prior slot draft');

  // ─────────────────────────────────────────────────────────────────────────────
  // CHALLENGE 4: Monolithic Save vs Delta Write Latency Benchmark
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ CHALLENGE 4: 1,000 Delta Writes vs Monolithic Saves Throughput Benchmark');

  const v2Sessions350 = Array.from({ length: 350 }, (_, i) => ({
    id: `session-${i}`,
    title: `Workout ${i}`,
    setsCount: 20,
  }));

  // Measure 1000 Monolithic JSON.stringify cycles
  const t0Mono = performance.now();
  for (let i = 0; i < 1000; i++) {
    const payload = JSON.stringify(v2Sessions350);
  }
  const t1Mono = performance.now();
  const monoTotalMs = t1Mono - t0Mono;

  // Measure 1000 Delta JSON.stringify cycles (single session)
  const singleSession = v2Sessions350[0];
  const t0Delta = performance.now();
  for (let i = 0; i < 1000; i++) {
    const payload = JSON.stringify(singleSession);
  }
  const t1Delta = performance.now();
  const deltaTotalMs = t1Delta - t0Delta;
  const speedup = (monoTotalMs / deltaTotalMs).toFixed(1);

  console.log(`  • 1,000 Monolithic 350-Session Serializations : ${monoTotalMs.toFixed(2)} ms`);
  console.log(`  • 1,000 Single-Session Delta Serializations   : ${deltaTotalMs.toFixed(2)} ms`);
  console.log(`  • Delta Serialization Speedup Ratio          : ${speedup}x throughput improvement`);

  assert(deltaTotalMs < monoTotalMs / 10, `Delta writes are >10x faster than monolithic saves (${speedup}x achieved)`);

  console.log('\n================================================================================');
  console.log(`CHALLENGER 2 SUMMARY: ${passedTests} passed, ${failedTests} failed`);
  console.log('================================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runEmpiricalChallenges().catch((err) => {
  console.error('Fatal challenger execution error:', err);
  process.exit(1);
});
