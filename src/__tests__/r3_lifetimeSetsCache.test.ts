import {
  getCachedLifetimeStats,
  setCachedLifetimeStats,
  clearInstantCache,
  LifetimeStatsSummary,
} from '../storage/instantCache';
import { loadLifetimeSetsStats, upsertSession } from '../storage/history/repository';
import { WorkoutSessionV2 } from '../storage/contracts/types';
import {
  initMMKVAdapter,
  setInjectedStorageAdapter,
  SynchronousStorageAdapter,
} from '../storage/adapters/mmkvAdapter';

class TestMemoryAdapter implements SynchronousStorageAdapter {
  private data = new Map<string, string>();
  isAvailable = () => true;
  isNative = () => true;
  getString = (key: string) => this.data.get(key) ?? null;
  setString = (key: string, value: string) => { this.data.set(key, value); return true; };
  removeItem = (key: string) => { this.data.delete(key); return true; };
}

describe('R3 Lifetime Sets Cache & SQL Query Layer', () => {
  let mockAdapter: TestMemoryAdapter;

  beforeEach(() => {
    mockAdapter = new TestMemoryAdapter();
    setInjectedStorageAdapter(mockAdapter);
    initMMKVAdapter();
    clearInstantCache();
  });

  afterEach(() => {
    setInjectedStorageAdapter(null);
  });

  it('sets and gets cached lifetime stats synchronously from MMKV', () => {
    const mockSummary: LifetimeStatsSummary = {
      totalCompletedSets: 142,
      muscleSets: { Chest: 50, Back: 45, Quads: 47 },
      exerciseSets: { 'bench press': 50, 'lat pulldown': 45, 'barbell squat': 47 },
      lastCalculatedMs: Date.now(),
    };

    setCachedLifetimeStats(mockSummary);
    const cached = getCachedLifetimeStats();
    expect(cached).not.toBeNull();
    expect(cached?.totalCompletedSets).toBe(142);
    expect(cached?.muscleSets['Chest']).toBe(50);
    expect(cached?.exerciseSets['bench press']).toBe(50);
  });

  it('clearInstantCache removes lifetime stats key', () => {
    const mockSummary: LifetimeStatsSummary = {
      totalCompletedSets: 10,
      muscleSets: { Chest: 10 },
      exerciseSets: { 'bench press': 10 },
      lastCalculatedMs: Date.now(),
    };

    setCachedLifetimeStats(mockSummary);
    expect(getCachedLifetimeStats()).not.toBeNull();

    clearInstantCache();
    expect(getCachedLifetimeStats()).toBeNull();
  });

  it('loadLifetimeSetsStats queries SQLite and saves summary in cache', async () => {
    const now = Date.now();
    const testSession: WorkoutSessionV2 = {
      id: `sess-r3-${now}`,
      title: 'Chest & Back Power',
      titleNorm: 'chest & back power',
      startedAtMs: now - 3600000,
      endedAtMs: now,
      durationSec: 3600,
      comment: null,
      totalVolumeMilliKg: 5000000,
      prs: 1,
      createdAtMs: now,
      updatedAtMs: now,
      revision: 1,
      deletedAtMs: null,
      exercises: [
        {
          id: `se-${now}-1`,
          sessionId: `sess-r3-${now}`,
          exerciseId: 'ex-1',
          nameSnapshot: 'Bench Press (Barbell)',
          nameNorm: 'bench press barbell',
          variationKey: '',
          position: 0,
          supersetGroupId: null,
          note: null,
          sets: [
            {
              id: `sl-${now}-1`,
              position: 0,
              category: 'W',
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
            {
              id: `sl-${now}-2`,
              position: 1,
              category: 'W',
              completed: false, // incomplete — must NOT be counted!
              weightMilliKg: 100000,
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

    await upsertSession(testSession);

    const { getV2Database } = require('../storage/dbSingleton');
    const db = await getV2Database();
    if (db && db.getAllAsync) {
      db.getAllAsync.mockResolvedValueOnce([
        {
          name_norm: 'bench press barbell',
          name_snapshot: 'Bench Press (Barbell)',
          completed_sets: 4,
        },
      ]);
    }

    const stats = await loadLifetimeSetsStats();
    expect(stats.totalCompletedSets).toBe(4);
    expect(stats.exerciseSets['bench press barbell']).toBe(4);
    expect(stats.muscleSets['Chest']).toBe(4);

    // Verify it was cached in MMKV
    const cached = getCachedLifetimeStats();
    expect(cached).not.toBeNull();
    expect(cached?.totalCompletedSets).toBe(4);
  });
});
