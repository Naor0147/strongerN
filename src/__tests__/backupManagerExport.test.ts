// src/__tests__/backupManagerExport.test.ts
// Verifies file export, device folder save, CSV generation, clipboard copy, and JSON validation.

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import {
  buildBackupData,
  exportBackupToFile,
  saveBackupToDevice,
  exportCsvToFile,
  saveCsvToDevice,
  copyBackupJsonToClipboard,
  parseAndValidateBackupJson,
  validateBackup,
  getBackupStats,
  BackupData,
} from '../utils/backupManager';

describe('Backup Manager Export & Storage Suite', () => {
  const sampleBackupData: BackupData = {
    version: 'strongern_backup_v2',
    exportedAt: '2026-08-22T14:17:04.000Z',
    username: 'NAOR_BITTON',
    user: {
      name: 'NAOR_BITTON',
      totalWorkouts: 42,
      isPro: false,
    },
    sessionsList: [
      {
        id: 'sess-1',
        title: 'Push Day A',
        datetime: '2026-08-20T10:00:00.000Z',
        durationMinutes: 55,
        totalVolumeKg: 4500,
        prs: 2,
        exercises: [
          { name: 'Bench Press (Barbell)', sets: 4, bestWeight: 100, bestReps: 6 },
        ],
      },
    ],
    templatesList: [
      { id: 'tmpl-1', name: 'Push Focus', exercises: [] },
    ],
    exercisesList: [
      { id: 'ex-1', name: 'Bench Press (Barbell)', muscleGroup: 'Chest', equipment: 'Barbell' },
    ],
    primaryMetricsList: [],
    bodyPartMetricsList: [],
    settings: {
      isAutoTimerEnabled: true,
      defaultRestDuration: 90,
      soundSetCompleted: 'satisfying-click',
      soundWorkoutFinished: 'fanfare',
      soundTimerCompleted: 'beep',
      soundVolume: 0.8,
      isPlateCalculatorEnabled: false,
      isProgramsEnabled: true,
      isHistoryEnabled: true,
      isMusclesEnabled: true,
      enableRoutineFolders: true,
      showAchievementBadges: true,
      showSummaryWidgets: true,
      showWeeklyTonnage: true,
      showWorkoutsChart: true,
      showHighlights: true,
      animationSpeed: 1,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportBackupToFile', () => {
    test('writes file and calls Sharing.shareAsync with file:// path without error', async () => {
      const ok = await exportBackupToFile(sampleBackupData);
      expect(ok).toBe(true);

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^file:\/\/.*strongern_backup_NAOR_BITTON_.*\.json$/),
        expect.stringContaining('"version": "strongern_backup_v2"'),
        expect.objectContaining({ encoding: 'utf8' })
      );

      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^file:\/\/.*strongern_backup_NAOR_BITTON_.*\.json$/),
        expect.objectContaining({
          mimeType: 'application/json',
          UTI: 'public.json',
        })
      );
    });

    test('falls back gracefully to clipboard if sharing throws', async () => {
      (Sharing.shareAsync as jest.Mock).mockRejectedValueOnce(new Error('Sharing unavailable'));
      const ok = await exportBackupToFile(sampleBackupData);
      expect(ok).toBe(true);
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('"version": "strongern_backup_v2"')
      );
    });
  });

  describe('saveBackupToDevice', () => {
    test('uses StorageAccessFramework to create and write file', async () => {
      const res = await saveBackupToDevice(sampleBackupData);
      expect(res.success).toBe(true);
      expect(res.filename).toMatch(/^strongern_backup_NAOR_BITTON_.*\.json$/);
    });
  });

  describe('CSV Export Functions', () => {
    const csvContent = 'Session ID,Date,Title,Duration (min),Volume (kg),PRs,Exercise Name,Sets,Best Weight (kg),Best Reps\n"sess-1","2026-08-20T10:00:00.000Z","Push Day A",55,4500,2,"Bench Press",4,100,6\n';

    test('exportCsvToFile writes .csv file and triggers native share', async () => {
      const ok = await exportCsvToFile(csvContent, 'NAOR_BITTON');
      expect(ok).toBe(true);

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^file:\/\/.*strongern_workouts_NAOR_BITTON_.*\.csv$/),
        csvContent,
        expect.objectContaining({ encoding: 'utf8' })
      );

      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^file:\/\/.*strongern_workouts_NAOR_BITTON_.*\.csv$/),
        expect.objectContaining({
          mimeType: 'text/csv',
          UTI: 'public.comma-separated-values-text',
        })
      );
    });

    test('saveCsvToDevice creates CSV via SAF', async () => {
      const res = await saveCsvToDevice(csvContent, 'NAOR_BITTON');
      expect(res.success).toBe(true);
      expect(res.filename).toMatch(/^strongern_workouts_NAOR_BITTON_.*\.csv$/);
    });
  });

  describe('copyBackupJsonToClipboard', () => {
    test('copies formatted JSON string to clipboard', async () => {
      const ok = await copyBackupJsonToClipboard(sampleBackupData);
      expect(ok).toBe(true);
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('"username": "NAOR_BITTON"')
      );
    });
  });

  describe('Backup Stats & Validation', () => {
    test('computes accurate backup statistics', () => {
      const stats = getBackupStats(sampleBackupData);
      expect(stats.sessions).toBe(1);
      expect(stats.templates).toBe(1);
      expect(stats.exercises).toBe(1);
      expect(stats.hasSettings).toBe(true);
    });

    test('validates and normalizes valid JSON string', () => {
      const jsonStr = JSON.stringify(sampleBackupData);
      const validated = parseAndValidateBackupJson(jsonStr);
      expect(validated).not.toBeNull();
      expect(validated?.version).toBe('strongern_backup_v2');
      expect(validated?.username).toBe('NAOR_BITTON');
      expect(validated?.sessionsList).toHaveLength(1);
    });

    test('handles legacy v1 backup payload correctly', () => {
      const legacyBackup = {
        user: { name: 'Alex' },
        sessionsList: [
          { id: 's1', title: 'Legs', datetime: '2026-08-19T10:00:00.000Z', exercises: [] },
        ],
        exercisesList: [],
        templatesList: [],
        primaryMetricsList: [],
        bodyPartMetricsList: [],
        isAutoTimerEnabled: false,
      };

      const normalized = validateBackup(legacyBackup);
      expect(normalized).not.toBeNull();
      expect(normalized?.version).toBe('strongern_backup_v2');
      expect(normalized?.username).toBe('Alex');
      expect(normalized?.settings.isAutoTimerEnabled).toBe(false);
    });
  });
});
