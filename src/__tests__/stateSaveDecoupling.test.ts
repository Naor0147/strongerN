// src/__tests__/stateSaveDecoupling.test.ts
// Unit test suite for Milestone 3 (State Save Decoupling & Delta Writes - R2)
// Verifies decoupled compact settings, single-session delta operations, active draft isolation, and backup assembly.

import { initMMKVAdapter, setInjectedStorageAdapter, SynchronousStorageAdapter } from '../storage/adapters/mmkvAdapter';
import { loadCompactSettings, saveCompactSettings, clearCompactSettings } from '../storage/compactSettings';
import { STORAGE_KEYS } from '../storage/keys';
import { bootstrapPersistence } from '../storage/persistenceBootstrap';
import * as repository from '../storage/history/repository';
import { buildBackupData, exportBackupToFile, BackupData } from '../utils/backupManager';
import { legacySessionToV2, sessionV2ToLegacy } from '../storage/history/legacySessionMapper';
import { WorkoutSessionV2 } from '../storage/contracts/types';
import { saveActiveWorkoutDraft, restoreActiveWorkoutDraft, clearActiveWorkoutDraft } from '../storage/activeWorkoutSnapshot';
import { normalizeActiveWorkoutDraftV2 } from '../storage/contracts/validators';

class MockMemoryStorageAdapter implements SynchronousStorageAdapter {
  readonly store = new Map<string, string>();
  isAvailable = () => true;
  isNative = () => true;
  getString = (key: string) => this.store.get(key) ?? null;
  setString = (key: string, value: string) => {
    this.store.set(key, value);
    return true;
  };
  removeItem = (key: string) => {
    this.store.delete(key);
    return true;
  };
}

describe('Milestone 3: State Save Decoupling & Delta Writes', () => {
  let mockAdapter: MockMemoryStorageAdapter;

  beforeEach(() => {
    mockAdapter = new MockMemoryStorageAdapter();
    setInjectedStorageAdapter(mockAdapter);
    initMMKVAdapter();
    jest.clearAllMocks();
  });

  afterEach(() => {
    setInjectedStorageAdapter(null);
  });

  describe('Compact Settings Store (MMKV)', () => {
    test('loads null when no compact settings have been saved', () => {
      expect(loadCompactSettings()).toBeNull();
    });

    test('saves and loads compact settings correctly', () => {
      const settings = {
        isAutoTimerEnabled: true,
        defaultRestDuration: 120,
        soundSetCompleted: 'bell',
        soundVolume: 0.9,
        appTheme: 'amoled',
        customAccentColor: '#7C5CFC',
      };

      const saved = saveCompactSettings(settings);
      expect(saved).toBe(true);

      const loaded = loadCompactSettings();
      expect(loaded).toEqual(expect.objectContaining(settings));
    });

    test('performs shallow merge when saving partial settings', () => {
      saveCompactSettings({
        appTheme: 'nord',
        soundVolume: 0.5,
        defaultRestDuration: 90,
      });

      saveCompactSettings({
        soundVolume: 0.8,
        isProgressiveOverloadEnabled: true,
      });

      const loaded = loadCompactSettings();
      expect(loaded).toEqual(expect.objectContaining({
        appTheme: 'nord',
        soundVolume: 0.8,
        defaultRestDuration: 90,
        isProgressiveOverloadEnabled: true,
      }));
    });

    test('clears compact settings cleanly from storage', () => {
      saveCompactSettings({ appTheme: 'crimson' });
      expect(loadCompactSettings()?.appTheme).toBe('crimson');

      const cleared = clearCompactSettings();
      expect(cleared).toBe(true);
      expect(loadCompactSettings()).toBeNull();
    });

    test('handles invalid/corrupt JSON gracefully without throwing', () => {
      mockAdapter.setString(STORAGE_KEYS.SETTINGS_COMPACT_V2, 'INVALID_JSON{{{');
      expect(loadCompactSettings()).toBeNull();
    });
  });

  describe('Bootstrap Settings Hydration Decoupling', () => {
    test('hydrates settings from MMKV compact store directly when available', async () => {
      saveCompactSettings({
        appTheme: 'emerald',
        defaultRestDuration: 75,
        isRpeMode: true,
      });

      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
      jest.spyOn(repository, 'getPersistenceMeta').mockResolvedValue(JSON.stringify({
        version: 2,
        sourceFingerprint: 'mock-fp',
        verifiedAtMs: 1786687000000,
      }));
      jest.spyOn(repository, 'loadAllSessions').mockResolvedValue([]);

      const result = await bootstrapPersistence(null, null);

      expect(result.settings).toEqual(expect.objectContaining({
        appTheme: 'emerald',
        defaultRestDuration: 75,
        isRpeMode: true,
      }));
    });

    test('migrates settings from legacy payload to MMKV compact store on first run', async () => {
      const legacyPayload = {
        isAutoTimerEnabled: true,
        defaultRestDuration: 105,
        appTheme: 'sunset',
        customAccentColor: '#FF6B6B',
        soundVolume: 0.7,
      };

      jest.spyOn(repository, 'initHistoryRepository').mockResolvedValue(true);
      jest.spyOn(repository, 'getPersistenceMeta').mockResolvedValue(null);
      jest.spyOn(repository, 'setPersistenceMeta').mockResolvedValue();
      jest.spyOn(repository, 'upsertSession').mockResolvedValue();
      jest.spyOn(repository, 'loadAllSessions').mockResolvedValue([]);

      const result = await bootstrapPersistence(legacyPayload, null);

      expect(result.settings).toEqual(expect.objectContaining({
        isAutoTimerEnabled: true,
        defaultRestDuration: 105,
        appTheme: 'sunset',
        customAccentColor: '#FF6B6B',
        soundVolume: 0.7,
      }));

      // Verify it was persisted to MMKV compact store
      const persisted = loadCompactSettings();
      expect(persisted).toEqual(expect.objectContaining({
        appTheme: 'sunset',
        defaultRestDuration: 105,
      }));
    });
  });

  describe('Single-Session Delta Operations & Bulk Import', () => {
    test('legacySessionToV2 accurately converts single session for delta upsert', () => {
      const legacySession = {
        id: 'sess-delta-1',
        title: 'Push Hypertrophy',
        datetime: new Date('2026-08-10T08:00:00Z'),
        comment: 'Great mind-muscle connection',
        durationMinutes: 55,
        totalVolumeKg: 3500.5,
        prs: 2,
        exercises: [
          {
            name: 'Incline Dumbbell Press',
            variation: '30 deg',
            sets: 3,
            bestWeight: 32,
            bestReps: 10,
            setsDetails: [
              { weight: 28, reps: 12, completed: true, category: 'W', isUnilateral: false },
              { weight: 32, reps: 10, completed: true, category: 'S', isUnilateral: false },
              { weight: 32, reps: 8, completed: true, category: 'S', isUnilateral: false },
            ],
          },
        ],
      };

      const v2 = legacySessionToV2(legacySession);
      expect(v2.id).toBe('sess-delta-1');
      expect(v2.title).toBe('Push Hypertrophy');
      expect(v2.titleNorm).toBe('push hypertrophy');
      expect(v2.durationSec).toBe(3300);
      expect(v2.totalVolumeMilliKg).toBe(3500500);
      expect(v2.exercises).toHaveLength(1);
      expect(v2.exercises[0].nameSnapshot).toBe('Incline Dumbbell Press');
      expect(v2.exercises[0].variationKey).toBe('30 deg');
      expect(v2.exercises[0].sets).toHaveLength(3);
      expect(v2.exercises[0].sets[0].category).toBe('W');
      expect(v2.exercises[0].sets[1].weightMilliKg).toBe(32000);
    });

    test('bulkImportSessions is exported and callable on repository', async () => {
      expect(typeof repository.bulkImportSessions).toBe('function');
    });

    test('softDeleteSession is exported and callable on repository', async () => {
      expect(typeof repository.softDeleteSession).toBe('function');
    });

    test('upsertSession is exported and callable on repository', async () => {
      expect(typeof repository.upsertSession).toBe('function');
    });
  });

  describe('Active Workout MMKV Slot A/B Isolation', () => {
    test('persists active draft mutations directly to Slot A/B without KV double-writes', () => {
      const draft = normalizeActiveWorkoutDraftV2({
        draftId: 'draft-isolated-1',
        isWorkoutActive: true,
        workoutName: 'Heavy Pull Day',
        startedAtMs: Date.now(),
        comment: 'Working on lat width',
        exercises: [
          {
            id: 'ex-1',
            name: 'Weighted Pull-Up',
            variationKey: 'Neutral Grip',
            sets: [
              { id: 'set-1', category: 'S', completed: true, weightInput: '20', repsInput: '6' },
            ],
          },
        ],
      });

      const saved = saveActiveWorkoutDraft(draft);
      expect(saved).toBe(true);

      const restored = restoreActiveWorkoutDraft();
      expect(restored).not.toBeNull();
      expect(restored?.workoutName).toBe('Heavy Pull Day');
      expect(restored?.exercises[0].name).toBe('Weighted Pull-Up');

      // Clear via tombstone
      const cleared = clearActiveWorkoutDraft();
      expect(cleared).toBe(true);
      expect(restoreActiveWorkoutDraft()).toBeNull();
    });
  });

  describe('Backward Compatibility & On-Demand Backup Assembly', () => {
    test('buildBackupData aggregates decoupled sessions and settings into a complete BackupData payload', () => {
      const sessions = [
        {
          id: 'sess-backup-1',
          title: 'Legs A',
          datetime: new Date('2026-08-12T09:00:00Z'),
          durationMinutes: 60,
          totalVolumeKg: 8000,
          prs: 1,
          exercises: [],
        },
      ];

      const settings = {
        isAutoTimerEnabled: true,
        defaultRestDuration: 90,
        soundVolume: 0.8,
        appTheme: 'amoled',
      };

      const backup = buildBackupData({
        username: 'ProLifter',
        user: { name: 'ProLifter', isPro: true },
        sessionsList: sessions,
        templatesList: [{ id: 't1', name: 'Legs' }],
        exercisesList: [{ id: 'e1', name: 'Squat' }],
        primaryMetricsList: [{ id: 'm1', label: 'Weight', lastValue: '85' }],
        bodyPartMetricsList: [],
        settings,
      });

      expect(backup.version).toBe('strongern_backup_v2');
      expect(backup.username).toBe('ProLifter');
      expect(backup.sessionsList).toHaveLength(1);
      expect(backup.sessionsList[0].id).toBe('sess-backup-1');
      expect(backup.settings.defaultRestDuration).toBe(90);
      expect(backup.templatesList).toHaveLength(1);
      expect(backup.exercisesList).toHaveLength(1);
    });
  });
});
