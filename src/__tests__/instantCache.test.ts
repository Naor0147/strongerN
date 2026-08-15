import {
  getCachedAuthState,
  setCachedAuthState,
  getCachedAppData,
  setCachedAppData,
  getCachedRecentSessions,
  setCachedRecentSessions,
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
      foldersList: ['All', 'Bulking'],
    };
    setCachedAppData(appData);
    expect(getCachedAppData()).toEqual(appData);
  });

  it('correctly limits and retrieves recent sessions snapshot', () => {
    expect(getCachedRecentSessions()).toBeNull();

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
    setCachedAppData({ user: { name: 'User', totalWorkouts: 1, isPro: false } });
    setCachedRecentSessions([{ id: '1', name: 'W1', datetime: new Date().toISOString() }]);
    setCachedProfileSummaries({ dynamicWeeklyChartData: [], weeklyMuscleSets: {} });

    clearInstantCache();

    expect(getCachedAuthState()).toBeNull();
    expect(getCachedAppData()).toBeNull();
    expect(getCachedRecentSessions()).toBeNull();
    expect(getCachedProfileSummaries()).toBeNull();
  });
});
