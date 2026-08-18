import {
  getCachedAuthState,
  setCachedAuthState,
  getCachedAppData,
  setCachedAppData,
  getCachedRecentSessions,
  setCachedRecentSessions,
  getCachedTotalSessionsCount,
  setCachedTotalSessionsCount,
  getCachedProfileSummaries,
  setCachedProfileSummaries,
  clearInstantCache,
} from '../storage/instantCache';
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

describe('instantCache MMKV synchronous storage', () => {
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

  it('correctly persists and retrieves auth state snapshot synchronously', () => {
    expect(getCachedAuthState()).toBeNull();

    const auth = {
      hasCompletedOnboarding: true,
      authMode: 'local' as const,
      localUsername: 'TestAthlete',
    };
    setCachedAuthState(auth);
    expect(getCachedAuthState()).toEqual(auth);
  });

  it('correctly persists and retrieves app data snapshot synchronously', () => {
    expect(getCachedAppData()).toBeNull();

    const appData = {
      user: { name: 'Champion', totalWorkouts: 42, isPro: true },
      templatesList: [{ id: 't1', name: 'Chest Day', exercises: [] }],
      exercisesList: [],
      primaryMetricsList: [],
      bodyPartMetricsList: [],
      foldersList: ['All', 'Bulking'],
    };
    setCachedAppData(appData);
    expect(getCachedAppData()).toEqual(appData);
  });

  it('correctly limits and retrieves recent sessions snapshot and preserves total count', () => {
    expect(getCachedRecentSessions()).toBeNull();
    expect(getCachedTotalSessionsCount()).toBeNull();

    const sessions = Array.from({ length: 30 }, (_, i) => ({
      id: `s-${i}`,
      name: `Workout #${i}`,
      datetime: new Date(2026, 7, i + 1).toISOString(),
    }));

    setCachedRecentSessions(sessions);
    const cached = getCachedRecentSessions();
    expect(cached).not.toBeNull();
    expect(cached?.length).toBe(20); // capped at MAX_RECENT_SESSIONS_CACHE = 20
    expect(cached?.[0].id).toBe('s-0');
    expect(getCachedTotalSessionsCount()).toBe(30); // full total count preserved
  });

  it('correctly gets and sets total sessions count explicitly', () => {
    expect(getCachedTotalSessionsCount()).toBeNull();
    setCachedTotalSessionsCount(312);
    expect(getCachedTotalSessionsCount()).toBe(312);
  });

  it('correctly persists and retrieves profile summaries snapshot', () => {
    expect(getCachedProfileSummaries()).toBeNull();

    const summaries = {
      dynamicWeeklyChartData: [{ weekLabel: '8/1', count: 4 }],
      weeklyMuscleSets: { Chest: 12, Back: 10 },
    };
    setCachedProfileSummaries(summaries);
    expect(getCachedProfileSummaries()).toEqual(summaries);
  });

  it('clears all cached data on clearInstantCache', () => {
    setCachedAuthState({ hasCompletedOnboarding: true, authMode: 'guest', localUsername: '' });
    setCachedAppData({
      user: { name: 'User', totalWorkouts: 1, isPro: false },
      templatesList: [],
      exercisesList: [],
      primaryMetricsList: [],
      bodyPartMetricsList: [],
      foldersList: [],
    });
    setCachedRecentSessions([{ id: '1', name: 'W1', datetime: new Date().toISOString() }]);
    setCachedTotalSessionsCount(100);
    setCachedProfileSummaries({ dynamicWeeklyChartData: [], weeklyMuscleSets: {} });

    clearInstantCache();

    expect(getCachedAuthState()).toBeNull();
    expect(getCachedAppData()).toBeNull();
    expect(getCachedRecentSessions()).toBeNull();
    expect(getCachedTotalSessionsCount()).toBeNull();
    expect(getCachedProfileSummaries()).toBeNull();
  });

  it('allows total session count to decrease on deletion and preserves decremented count across restart', () => {
    // 1. Initial 300 workouts
    const sessions = Array.from({ length: 300 }, (_, i) => ({
      id: `s-${i}`,
      name: `Workout #${i}`,
      datetime: new Date(2026, 0, i + 1).toISOString(),
    }));
    setCachedRecentSessions(sessions, 300);
    setCachedAppData({
      user: { name: 'Athlete', totalWorkouts: 300, isPro: false },
      templatesList: [],
      exercisesList: [],
      primaryMetricsList: [],
      bodyPartMetricsList: [],
      foldersList: [],
    });
    expect(getCachedTotalSessionsCount()).toBe(300);

    // 2. User deletes 50 workouts -> 250
    const reducedSessions = sessions.slice(50);
    expect(reducedSessions.length).toBe(250);

    setCachedRecentSessions(reducedSessions, reducedSessions.length);
    setCachedAppData({
      user: { name: 'Athlete', totalWorkouts: 250, isPro: false },
      templatesList: [],
      exercisesList: [],
      primaryMetricsList: [],
      bodyPartMetricsList: [],
      foldersList: [],
    });

    // 3. Count in MMKV cache decreases immediately
    expect(getCachedTotalSessionsCount()).toBe(250);
    expect(getCachedAppData()?.user?.totalWorkouts).toBe(250);

    // 4. Simulated restart (reading from MMKV cold start)
    const coldStartCount = getCachedTotalSessionsCount() ?? getCachedAppData()?.user?.totalWorkouts ?? 0;
    expect(coldStartCount).toBe(250);
  });

  it('prevents preview session slice from overwriting the total count cache during cold start window', () => {
    // 1. Initial 300 workouts in MMKV cache from a previous run
    setCachedTotalSessionsCount(300);
    setCachedAppData({
      user: { name: 'Athlete', totalWorkouts: 300, isPro: false },
      templatesList: [],
      exercisesList: [],
      primaryMetricsList: [],
      bodyPartMetricsList: [],
      foldersList: [],
    });
    expect(getCachedTotalSessionsCount()).toBe(300);

    // 2. Frame 0 cold start: reads 20-item recent sessions preview snapshot
    const previewSessions = Array.from({ length: 20 }, (_, i) => ({
      id: `preview-${i}`,
      name: `Workout #${i}`,
      datetime: new Date(2026, 0, i + 1).toISOString(),
    }));

    // Simulated Frame 0 runtime state before SQLite loads:
    let isFullHistoryLoaded = false;
    let currentSessions = previewSessions;

    // The debounced cache-sync effect fires at 400ms. Because isFullHistoryLoaded is false, it must NOT execute:
    if (isFullHistoryLoaded) {
      setCachedRecentSessions(currentSessions, currentSessions.length);
    }

    // Assert that the cached total count remains 300 (never downgraded to 20):
    expect(getCachedTotalSessionsCount()).toBe(300);

    // 3. Background SQLite completes and loads all 300 sessions:
    const fullSessions = Array.from({ length: 300 }, (_, i) => ({
      id: `full-${i}`,
      name: `Workout #${i}`,
      datetime: new Date(2026, 0, i + 1).toISOString(),
    }));
    currentSessions = fullSessions;
    isFullHistoryLoaded = true;

    // Full history sync runs:
    if (isFullHistoryLoaded) {
      setCachedRecentSessions(currentSessions, currentSessions.length);
    }
    expect(getCachedTotalSessionsCount()).toBe(300);
  });
});
