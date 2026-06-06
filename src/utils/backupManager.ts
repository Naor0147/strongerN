// utils/backupManager.ts
// Handles all file-based backup export and restore operations.
// Uses expo-file-system for native file I/O and expo-document-picker for file selection.
// On web: falls back to browser download / file input.

import { Platform, Alert, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

export const BACKUP_VERSION = 'strongern_backup_v2';

export interface BackupData {
  version: string;
  exportedAt: string;
  username: string;
  user: any;
  sessionsList: any[];
  templatesList: any[];
  exercisesList: any[];
  primaryMetricsList: any[];
  bodyPartMetricsList: any[];
  settings: {
    isAutoTimerEnabled: boolean;
    defaultRestDuration: number;
    soundSetCompleted: string;
    soundWorkoutFinished: string;
    soundTimerCompleted: string;
    soundVolume: number;
    isPlateCalculatorEnabled: boolean;
    isProgramsEnabled: boolean;
    isHistoryEnabled: boolean;
    isMusclesEnabled: boolean;
    enableRoutineFolders: boolean;
    showAchievementBadges: boolean;
    showSummaryWidgets: boolean;
    showWeeklyTonnage: boolean;
    showWorkoutsChart: boolean;
    showHighlights: boolean;
    animationSpeed: number;
    [key: string]: any;
  };
}

/**
 * Sanitize a username for use in a filename.
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 30);
}

/**
 * Build the canonical backup filename for a user.
 */
export function buildBackupFilename(username: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const safeName = sanitizeFilename(username || 'User');
  return `strongern_backup_${safeName}_${date}.json`;
}

/**
 * Export a full backup to a file on the device.
 * On native: writes to FileSystem.documentDirectory and opens native share sheet.
 * On web: triggers a browser download.
 *
 * @returns true if export succeeded, false otherwise
 */
export async function exportBackupToFile(backupData: BackupData): Promise<boolean> {
  const json = JSON.stringify(backupData, null, 2);
  const filename = buildBackupFilename(backupData.username);

  if (Platform.OS === 'web') {
    // Web: trigger browser download
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      console.error('[BackupManager] Web download failed:', e);
      return false;
    }
  }

  // Native: write to documentDirectory
  try {
    const filePath = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(filePath, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Open native share sheet so the user can send it to Files, email, etc.
    await Share.share({
      title: `${filename}`,
      url: filePath,
      message: `strongerN backup — ${backupData.exportedAt}`,
    });

    return true;
  } catch (e: any) {
    console.error('[BackupManager] Native export failed:', e);
    // Share.share throws if user dismisses — that's fine, file was still written
    if (e?.message?.includes('cancel') || e?.message?.includes('dismiss')) {
      return true; // File written, user just cancelled the share sheet
    }
    return false;
  }
}

/**
 * Open the device file picker and let the user select a .json backup file.
 * Returns the parsed BackupData if successful, or null if cancelled / invalid.
 */
export async function pickAndReadBackupFile(): Promise<BackupData | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null; // User cancelled
    }

    const asset = result.assets[0];
    const fileUri = asset.uri;

    let content = '';
    if (Platform.OS === 'web') {
      const response = await fetch(fileUri);
      content = await response.text();
    } else {
      content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }

    if (!content || !content.trim()) {
      Alert.alert('Invalid File', 'The selected file is empty.');
      return null;
    }

    const parsed = JSON.parse(content);
    return validateBackup(parsed);
  } catch (e: any) {
    console.error('[BackupManager] pickAndReadBackupFile error:', e);
    if (e instanceof SyntaxError) {
      Alert.alert('Invalid File', 'The selected file is not valid JSON. Make sure you pick a strongerN backup file.');
    }
    return null;
  }
}

/**
 * Validate a parsed backup object and normalize it to BackupData.
 * Handles both v2 format and the legacy v1 format (plain object from handleExportBackup).
 */
export function validateBackup(parsed: any): BackupData | null {
  if (!parsed || typeof parsed !== 'object') {
    Alert.alert('Invalid Backup', 'The file does not contain valid backup data.');
    return null;
  }

  // v2 format
  if (parsed.version === BACKUP_VERSION) {
    if (!parsed.user) {
      Alert.alert('Invalid Backup', 'Backup file is missing user data.');
      return null;
    }
    return parsed as BackupData;
  }

  // Legacy v1 format (produced by old handleExportBackup): has user, sessionsList etc. at root
  if (parsed.user && (parsed.sessionsList !== undefined || parsed.exercisesList !== undefined)) {
    const username = parsed.user?.name || 'User';
    return {
      version: BACKUP_VERSION,
      exportedAt: parsed.exportTimestamp || parsed.timestamp || new Date().toISOString(),
      username,
      user: parsed.user,
      sessionsList: parsed.sessionsList || [],
      templatesList: parsed.templatesList || [],
      exercisesList: parsed.exercisesList || [],
      primaryMetricsList: parsed.primaryMetricsList || [],
      bodyPartMetricsList: parsed.bodyPartMetricsList || [],
      settings: {
        isAutoTimerEnabled: parsed.isAutoTimerEnabled ?? true,
        defaultRestDuration: parsed.defaultRestDuration ?? 90,
        soundSetCompleted: parsed.soundSetCompleted ?? 'chime',
        soundWorkoutFinished: parsed.soundWorkoutFinished ?? 'fanfare',
        soundTimerCompleted: parsed.soundTimerCompleted ?? 'beep',
        soundVolume: parsed.soundVolume ?? 0.8,
        isPlateCalculatorEnabled: parsed.isPlateCalculatorEnabled ?? false,
        isProgramsEnabled: parsed.isProgramsEnabled ?? false,
        isHistoryEnabled: parsed.isHistoryEnabled ?? true,
        isMusclesEnabled: parsed.isMusclesEnabled ?? true,
        enableRoutineFolders: parsed.enableRoutineFolders ?? false,
        showAchievementBadges: parsed.showAchievementBadges ?? false,
        showSummaryWidgets: parsed.showSummaryWidgets ?? false,
        showWeeklyTonnage: parsed.showWeeklyTonnage ?? false,
        showWorkoutsChart: parsed.showWorkoutsChart ?? true,
        showHighlights: parsed.showHighlights ?? false,
        animationSpeed: parsed.animationSpeed ?? 1,
      },
    };
  }

  Alert.alert(
    'Unrecognized Format',
    'This file does not appear to be a strongerN backup. Please select a file exported from strongerN.'
  );
  return null;
}

/**
 * Build a BackupData object from the app's current state.
 */
export function buildBackupData(params: {
  username: string;
  user: any;
  sessionsList: any[];
  templatesList: any[];
  exercisesList: any[];
  primaryMetricsList: any[];
  bodyPartMetricsList: any[];
  settings: any;
}): BackupData {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    username: params.username,
    user: params.user,
    sessionsList: params.sessionsList,
    templatesList: params.templatesList,
    exercisesList: params.exercisesList,
    primaryMetricsList: params.primaryMetricsList,
    bodyPartMetricsList: params.bodyPartMetricsList,
    settings: params.settings,
  };
}
