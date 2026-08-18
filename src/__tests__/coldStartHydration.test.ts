// src/__tests__/coldStartHydration.test.ts
// Unit tests for Milestone 2: Fast-Path Persistence Bootstrap, SQLite V2 Hydration, and Query Optimization.

import { bootstrapPersistence } from '../storage/persistenceBootstrap';
import { legacySessionToV2, sessionV2ToLegacy } from '../storage/history/legacySessionMapper';
import { calculateChecksum } from '../storage/contracts/validators';
import { WorkoutSessionV2 } from '../storage/contracts/types';
import * as repository from '../storage/history/repository';
import { initMMKVAdapter, setInjectedStorageAdapter, SynchronousStorageAdapter } from '../storage/adapters/mmkvAdapter';

class TestMemoryAdapter implements SynchronousStorageAdapter {
  private data = new Map<string, string>();
  isAvailable = () => true;
  isNative = () => true;
  getString = (key: string) => this.data.get(key) ?? null;
  setString = (key: string, value: string) => { this.data.set(key, value); return true; };
  removeItem = (key: string) => { this.data.delete(key); return true; };
}

describe('Milestone 2 - Cold Start & SQLite Hydration Optimization', () => {
  let mockAdapter: TestMemoryAdapter;

  beforeEach(() => {
    mockAdapter = new TestMemoryAdapter();
    setInjectedStorageAdapter(mockAdapter);
    initMMKVAdapter();
  });

  afterEach(() => {
    setInjectedStorageAdapter(null);
    jest.restoreAllMocks();
  });

  describe('Fast-Path Hydration Bypass', () => {
    test('bypasses legacy session fingerprinting and loads from SQLite V2 when migration is marked ready', async () => {
      const mockV2Sessions: WorkoutSessionV2[] = [
        {
          id: 'v2-session-1',
          title: 'Heavy Bench Day',
          titleNorm: 'heavy bench day',
          startedAtMs: 1786687000000,
          endedAtMs: 1786690600000,
          durationSec: 3600,
          comment: 'Felt strong',
          totalVolumeMilliKg: 15000000,
          prs: 2,
          createdAtMs: 1786687000000,
          updatedAtMs: 1786690600000,
          revision: 1,
          deletedAtMs: null,
          exercises: [
            {
              id: 'ex-1',
              sessionId: 'v2-session-1',
              exerciseId: 'catalog-bench',
              nameSnapshot: 'Barbell Bench Press',
              nameNorm: 'barbell bench press',
              variationKey: 'paused',
              position: 0,
              supersetGroupId: null,
              note: 'Focus on leg drive',
              sets: [
                {
                  id: 'set-1',
                  position: 0,
                  category: 'S',
                  completed: true,
                  weightMilliKg: 100000,
                  reps: 8,
                  rpeTenths: 85,
                  isUnilateral: false,
                  leftWeightMilliKg: null,
                  leftReps: null,
                  rightWeightMilliKg: null,
                  rightReps: null,
                },
              ],
            },
          ],
        },
      ];

      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
      jest.spyOn(repository, 'getPersistenceMeta').mockResolvedValue(JSON.stringify({
        version: 2,
        sourceFingerprint: 'mock-verified-fingerprint',
        sourceCount: 1,
        verifiedAtMs: 1786687000000,
      }));
      const loadAllSpy = jest.spyOn(repository, 'loadAllSessions').mockResolvedValue(mockV2Sessions);
      const upsertSpy = jest.spyOn(repository, 'upsertSession').mockResolvedValue();

      // Legacy payload contains empty or stale sessions that should NOT trigger migration loop
      const legacyRaw = {
        user: { name: 'Test User' },
        sessionsList: [{ id: 'old-1', title: 'Old Legacy', datetime: '2025-01-01T00:00:00Z', exercises: [] }],
      };

      const result = await bootstrapPersistence(legacyRaw, null);

      expect(result.historyReady).toBe(true);
      expect(result.migration.status).toBe('verified');
      expect(result.migration.sourceFingerprint).toBe('mock-verified-fingerprint');
      expect(loadAllSpy).toHaveBeenCalledTimes(1);
      // upsertSession should NOT be called during fast-path
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(result.sessions).toEqual(mockV2Sessions);
    });

    test('executes full migration path on first-run or unmigrated legacy database', async () => {
      const legacyRaw = {
        user: { name: 'Migrating Athlete' },
        sessionsList: [
          {
            id: 'legacy-sess-1',
            title: 'Initial Workout',
            datetime: '2026-08-01T10:00:00Z',
            durationMinutes: 60,
            totalVolumeKg: 5000,
            prs: 1,
            exercises: [
              {
                name: 'Squat',
                variation: '',
                sets: 1,
                bestWeight: 120,
                bestReps: 5,
                setsDetails: [
                  { weight: 120, reps: 5, completed: true, category: 'S', isUnilateral: false },
                ],
              },
            ],
          },
        ],
      };

      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
      // No metadata stored in SQLite yet
      jest.spyOn(repository, 'getPersistenceMeta').mockResolvedValue(null);
      const setMetaSpy = jest.spyOn(repository, 'setPersistenceMeta').mockResolvedValue();
      const upsertSpy = jest.spyOn(repository, 'upsertSession').mockResolvedValue();
      
      const expectedNormalized = legacySessionToV2(legacyRaw.sessionsList[0], 0);
      jest.spyOn(repository, 'loadAllSessions').mockResolvedValue([expectedNormalized]);

      const result = await bootstrapPersistence(legacyRaw, null);

      expect(result.historyReady).toBe(true);
      expect(result.migration.status).toBe('verified');
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(setMetaSpy).toHaveBeenCalledWith('legacy_v1_to_relational_v2', expect.stringContaining('"version":2'));
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].title).toBe('Initial Workout');
    });

    test('falls back safely to legacy mapping when relational SQLite is unavailable', async () => {
      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(false);

      const legacyRaw = {
        sessionsList: [
          {
            id: 'fallback-sess',
            title: 'Fallback Session',
            datetime: '2026-08-02T10:00:00Z',
            exercises: [],
          },
        ],
      };

      const result = await bootstrapPersistence(legacyRaw, null);

      expect(result.historyReady).toBe(false);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].title).toBe('Fallback Session');
      expect(result.migration.status).toBe('verified');
    });
  });

  describe('Object & Schema Preservation', () => {
    test('preserves 100% fidelity across V2 and legacy representations', () => {
      const v2Session: WorkoutSessionV2 = {
        id: 'sess-fidelity-1',
        title: 'Full Body A',
        titleNorm: 'full body a',
        startedAtMs: 1786687000000,
        endedAtMs: 1786691500000,
        durationSec: 4500,
        comment: 'Target hit',
        totalVolumeMilliKg: 8500000,
        prs: 3,
        createdAtMs: 1786687000000,
        updatedAtMs: 1786691500000,
        revision: 2,
        deletedAtMs: null,
        exercises: [
          {
            id: 'ex-1',
            sessionId: 'sess-fidelity-1',
            exerciseId: 'cat-db-1',
            nameSnapshot: 'Dumbbell Incline Press',
            nameNorm: 'dumbbell incline press',
            variationKey: '30 deg',
            position: 0,
            supersetGroupId: 'ss-1',
            note: 'Slow eccentric',
            sets: [
              {
                id: 'set-1',
                position: 0,
                category: 'W',
                completed: true,
                weightMilliKg: 20000,
                reps: 12,
                rpeTenths: 60,
                isUnilateral: true,
                leftWeightMilliKg: 20000,
                leftReps: 12,
                rightWeightMilliKg: 20000,
                rightReps: 12,
              },
              {
                id: 'set-2',
                position: 1,
                category: 'S',
                completed: true,
                weightMilliKg: 34000,
                reps: 8,
                rpeTenths: 90,
                isUnilateral: false,
                leftWeightMilliKg: null,
                leftReps: null,
                rightWeightMilliKg: null,
                rightReps: null,
              },
            ],
          },
        ],
      };

      const legacy = sessionV2ToLegacy(v2Session);
      expect(legacy.id).toBe('sess-fidelity-1');
      expect(legacy.title).toBe('Full Body A');
      expect(legacy.durationMinutes).toBe(75);
      expect(legacy.totalVolumeKg).toBe(8500);
      expect(legacy.prs).toBe(3);
      expect(legacy.exercises[0].name).toBe('Dumbbell Incline Press');
      expect(legacy.exercises[0].variation).toBe('30 deg');
      expect(legacy.exercises[0].setsDetails?.[0].isUnilateral).toBe(true);
      expect(legacy.exercises[0].setsDetails?.[0].leftWeight).toBe(20);
      expect(legacy.exercises[0].setsDetails?.[1].weight).toBe(34);
      expect(legacy.exercises[0].setsDetails?.[1].rpe).toBe(9.0);

      const roundTrip = legacySessionToV2(legacy);
      expect(roundTrip.id).toBe(v2Session.id);
      expect(roundTrip.title).toBe(v2Session.title);
      expect(roundTrip.durationSec).toBe(v2Session.durationSec);
      expect(roundTrip.totalVolumeMilliKg).toBe(v2Session.totalVolumeMilliKg);
      expect(roundTrip.exercises[0].sets[1].weightMilliKg).toBe(34000);
    });

    test('self-healing fast-path does NOT resurrect soft-deleted sessions when raw table already contains them', async () => {
      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
      jest.spyOn(repository, 'getPersistenceMeta').mockResolvedValue(JSON.stringify({
        version: 2,
        sourceFingerprint: 'migrated-fp',
        sourceCount: 2,
        verifiedAtMs: 1786687000000,
      }));

      // 1 active session in SQLite V2 (the 2nd session was soft-deleted)
      const activeV2Sessions = [
        {
          id: 'sess-active-1',
          userId: null,
          routineId: null,
          title: 'Active Workout',
          titleNorm: 'active workout',
          startedAtMs: 1786686000000,
          endedAtMs: 1786689600000,
          durationSec: 3600,
          totalVolumeMilliKg: 4000000,
          prs: 0,
          prCount: 0,
          comment: '',
          createdAtMs: 1786686000000,
          updatedAtMs: 1786686000000,
          revision: 1,
          deletedAtMs: null,
          exercises: [],
        },
      ];
      jest.spyOn(repository, 'loadAllSessions').mockResolvedValue(activeV2Sessions as any);

      // Raw SQLite count is 2 (1 active + 1 soft-deleted)
      const rawCountSpy = jest.spyOn(repository, 'countAllRawSessions').mockResolvedValue(2);
      const insertMissingSpy = jest.spyOn(repository, 'insertMissingSessionsOnly').mockResolvedValue();

      // Legacy payload still has 2 sessions (including the one the user soft-deleted)
      const legacyRaw = {
        user: { name: 'Test User' },
        sessionsList: [
          { id: 'sess-active-1', title: 'Active Workout', datetime: '2026-08-01T10:00:00Z', exercises: [] },
          { id: 'sess-deleted-2', title: 'Deleted Workout', datetime: '2026-08-02T10:00:00Z', exercises: [] },
        ],
      };

      const result = await bootstrapPersistence(legacyRaw, null);

      expect(result.historyReady).toBe(true);
      expect(result.migration.status).toBe('verified');
      // Because rawCount (2) >= legacyRaw.sessionsList.length (2), no missing sessions are inserted!
      expect(rawCountSpy).toHaveBeenCalled();
      expect(insertMissingSpy).not.toHaveBeenCalled();
      expect(result.sessions).toEqual(activeV2Sessions);
      expect(result.sessions.length).toBe(1); // Deleted workout remains deleted
    });
  });
});
