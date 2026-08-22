// utils/backupManager.ts
// Handles all file-based backup export and restore operations.
// Uses expo-file-system for native file I/O and expo-document-picker for file selection.
// On web: falls back to browser download / file input.

import { Platform, Alert, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import i18n from './i18n';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

const BACKUP_VERSION = 'strongern_backup_v2';

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
  foldersList?: string[];
  activeProgramId?: string | null;
  programStartDate?: string | null;
  lastSynced?: string | null;
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
    isProgressiveOverloadEnabled?: boolean;
    isAutoFinishSetEnabled?: boolean;
    isRpeMode?: boolean;
    showHypertrophyGoal?: boolean;
    [key: string]: any;
  };
}

export interface BackupStats {
  sessions: number;
  templates: number;
  exercises: number;
  metrics: number;
  hasSettings: boolean;
}

/**
 * Sanitize a username for use in a filename.
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 30);
}

/**
 * Build the canonical backup filename for a user.
 * Includes time to avoid same-day collisions.
 */
function buildBackupFilename(username: string): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toISOString().split('T')[1].slice(0, 8).replace(/:/g, ''); // HHMMSS
  const safeName = sanitizeFilename(username || 'User');
  return `strongern_backup_${safeName}_${date}_${time}.json`;
}

export function getBackupStats(data: BackupData | any): BackupStats {
  const d = data as any;
  return {
    sessions: Array.isArray(d?.sessionsList) ? d.sessionsList.length : 0,
    templates: Array.isArray(d?.templatesList) ? d.templatesList.length : 0,
    exercises: Array.isArray(d?.exercisesList) ? d.exercisesList.length : 0,
    metrics: (Array.isArray(d?.primaryMetricsList) ? d.primaryMetricsList.length : 0) + (Array.isArray(d?.bodyPartMetricsList) ? d.bodyPartMetricsList.length : 0),
    hasSettings: Boolean(d?.settings && Object.keys(d.settings).length > 0),
  };
}

export async function copyBackupJsonToClipboard(backupData: BackupData): Promise<boolean> {
  try {
    const json = JSON.stringify(backupData, null, 2);
    await Clipboard.setStringAsync(json);
    return true;
  } catch (e) {
    console.error('[BackupManager] copy to clipboard failed', e);
    return false;
  }
}

/**
 * Export a full backup to a file on the device and open native share sheet.
 * On native: writes to FileSystem.documentDirectory and opens native share sheet via expo-sharing.
 * On web: triggers a browser download.
 *
 * @returns true if file was written/shared (user dismissing share sheet still counts as success), false on failure
 */
export async function exportBackupToFile(backupData: BackupData): Promise<boolean> {
  let json: string;
  try {
    json = JSON.stringify(backupData, null, 2);
  } catch (e: any) {
    console.error('[BackupManager] JSON stringify failed:', e);
    Alert.alert(i18n.t('backup.invalidBackup'), e?.message || 'Failed to serialize backup data.');
    return false;
  }
  const filename = buildBackupFilename(backupData.username);

  if (Platform.OS === 'web') {
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
      try {
        await Clipboard.setStringAsync(json);
        Alert.alert(i18n.t('common.success'), i18n.t('backup.copiedToClipboardFallback') || 'Backup copied to clipboard.');
        return true;
      } catch {}
      return false;
    }
  }

  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!baseDir) {
    console.error('[BackupManager] No writable directory available');
    try {
      await Clipboard.setStringAsync(json);
      Alert.alert(i18n.t('common.success'), i18n.t('backup.copiedToClipboardFallback') || 'Backup copied to clipboard.');
      return true;
    } catch {}
    return false;
  }

  const filePath = `${baseDir}${filename}`;

  // Step 1: write file to local app storage
  try {
    await FileSystem.writeAsStringAsync(filePath, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (e: any) {
    console.error('[BackupManager] File write failed:', e);
    try {
      await Clipboard.setStringAsync(json);
      Alert.alert(i18n.t('common.error'), i18n.t('backup.noWriteClipboardFallback') || 'Failed to write file, but backup was copied to clipboard.');
      return true;
    } catch {}
    Alert.alert(i18n.t('profile.exportFailed'), e?.message || i18n.t('profile.exportFailedMsg'));
    return false;
  }

  // Step 2: Open native share sheet via expo-sharing (passes raw file:// URI)
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      // NOTE: Do NOT use FileSystem.getContentUriAsync on Android here.
      // expo-sharing's native module (SharingModule.kt) validates uri.scheme == 'file'
      // and converts it internally via SharingFileProvider.
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: `Share ${filename}`,
        UTI: 'public.json',
      });
      return true;
    }
  } catch (e: any) {
    // User dismissing or cancelling share sheet is considered a normal exit
    if (e?.message?.includes('cancel') || e?.message?.includes('dismiss')) {
      return true;
    }
    console.warn('[BackupManager] Sharing.shareAsync failed:', e);
  }

  // Fallback: Copy JSON payload to clipboard if share sheet was unavailable
  try {
    await Clipboard.setStringAsync(json);
    Alert.alert(i18n.t('common.success'), i18n.t('backup.copiedToClipboardFallback') || 'Backup JSON copied to clipboard.');
    return true;
  } catch {}
  return true;
}

/**
 * Save backup file directly to a user-selected folder on the device (Android SAF, Web download, iOS Share sheet).
 */
export async function saveBackupToDevice(backupData: BackupData): Promise<{ success: boolean; cancelled?: boolean; filename: string }> {
  let json: string;
  try {
    json = JSON.stringify(backupData, null, 2);
  } catch (e: any) {
    console.error('[BackupManager] JSON stringify failed:', e);
    return { success: false, filename: '' };
  }
  const filename = buildBackupFilename(backupData.username);

  // Web: direct download
  if (Platform.OS === 'web') {
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
      return { success: true, filename };
    } catch {
      return { success: false, filename };
    }
  }

  // Android: StorageAccessFramework directory picker
  if (Platform.OS === 'android' && (FileSystem as any).StorageAccessFramework) {
    try {
      const permissions = await (FileSystem as any).StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) {
        return { success: false, cancelled: true, filename };
      }
      const rawName = filename.replace(/\.json$/i, '');
      const createdUri = await (FileSystem as any).StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        rawName,
        'application/json'
      );
      await FileSystem.writeAsStringAsync(createdUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return { success: true, filename };
    } catch (safErr) {
      console.warn('[BackupManager] SAF direct save failed, falling back to exportBackupToFile', safErr);
      const ok = await exportBackupToFile(backupData);
      return { success: ok, filename };
    }
  }

  // iOS & other native: export file and open share sheet (allows Save to Files)
  const ok = await exportBackupToFile(backupData);
  return { success: ok, filename };
}

/**
 * Export CSV spreadsheet to a file and open native share sheet.
 */
export async function exportCsvToFile(csvText: string, username: string = 'User'): Promise<boolean> {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toISOString().split('T')[1].slice(0, 8).replace(/:/g, '');
  const safeName = sanitizeFilename(username || 'User');
  const filename = `strongern_workouts_${safeName}_${date}_${time}.csv`;

  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }

  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!baseDir) return false;

  const filePath = `${baseDir}${filename}`;
  try {
    await FileSystem.writeAsStringAsync(filePath, csvText, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (e) {
    console.error('[BackupManager] CSV file write failed:', e);
    return false;
  }

  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: `Share ${filename}`,
        UTI: 'public.comma-separated-values-text',
      });
      return true;
    }
  } catch (e: any) {
    if (e?.message?.includes('cancel') || e?.message?.includes('dismiss')) return true;
  }
  return true;
}

/**
 * Save CSV spreadsheet directly to device storage.
 */
export async function saveCsvToDevice(csvText: string, username: string = 'User'): Promise<{ success: boolean; cancelled?: boolean; filename: string }> {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toISOString().split('T')[1].slice(0, 8).replace(/:/g, '');
  const safeName = sanitizeFilename(username || 'User');
  const filename = `strongern_workouts_${safeName}_${date}_${time}.csv`;

  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true, filename };
    } catch {
      return { success: false, filename };
    }
  }

  if (Platform.OS === 'android' && (FileSystem as any).StorageAccessFramework) {
    try {
      const permissions = await (FileSystem as any).StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) {
        return { success: false, cancelled: true, filename };
      }
      const rawName = filename.replace(/\.csv$/i, '');
      const createdUri = await (FileSystem as any).StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        rawName,
        'text/csv'
      );
      await FileSystem.writeAsStringAsync(createdUri, csvText, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return { success: true, filename };
    } catch (safErr) {
      console.warn('[BackupManager] SAF direct CSV save failed, falling back to exportCsvToFile', safErr);
      const ok = await exportCsvToFile(csvText, username);
      return { success: ok, filename };
    }
  }

  const ok = await exportCsvToFile(csvText, username);
  return { success: ok, filename };
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
      multiple: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null; // User cancelled
    }

    const asset = result.assets[0];
    const fileUri = asset.uri;

    // Guard against absurdly large files (>30 MB) that would OOM
    if (asset.size && asset.size > 30 * 1024 * 1024) {
      Alert.alert(i18n.t('backup.invalidFile'), 'File too large (>30 MB). Please use a smaller backup.');
      return null;
    }

    let content = '';
    if (Platform.OS === 'web') {
      const response = await fetch(fileUri);
      content = await response.text();
    } else {
      // asset.uri may be content:// on Android; copyToCacheDirectory already copies to cache, but be defensive
      let readUri = fileUri;
      // If it's a content uri and FileSystem can't read it, try to use the cached file path (expo-document-picker already copies)
      try {
        content = await FileSystem.readAsStringAsync(readUri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch (readErr: any) {
        console.warn('[BackupManager] Direct read failed, trying fallback', readErr);
        // Try alternative: fetch via blob for content URIs (Android SAF)
        try {
          const resp = await fetch(readUri);
          content = await resp.text();
        } catch (fetchErr) {
          throw readErr;
        }
      }
    }

    if (!content || !content.trim()) {
      Alert.alert(i18n.t('backup.invalidFile'), i18n.t('backup.fileEmpty'));
      return null;
    }

    // Strip UTF-8 BOM if present (common when exported from Windows editors)
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (syntaxErr) {
      Alert.alert(i18n.t('backup.invalidFile'), i18n.t('backup.fileNotJson'));
      return null;
    }

    return validateBackup(parsed);
  } catch (e: any) {
    console.error('[BackupManager] pickAndReadBackupFile error:', e);
    if (e instanceof SyntaxError) {
      Alert.alert(i18n.t('backup.invalidFile'), i18n.t('backup.fileNotJson'));
    } else if (e?.message) {
      Alert.alert(i18n.t('backup.invalidFile'), e.message);
    }
    return null;
  }
}

/**
 * Validate a JSON string (paste flow) and return BackupData or null.
 * Shows localized Alerts on failure, matching pickAndReadBackupFile behaviour.
 */
export function parseAndValidateBackupJson(jsonStr: string): BackupData | null {
  const trimmed = (jsonStr || '').trim();
  if (!trimmed) {
    Alert.alert(i18n.t('common.error'), i18n.t('profile.pasteBackupFirst'));
    return null;
  }
  if (trimmed.length > 30 * 1024 * 1024) {
    Alert.alert(i18n.t('backup.invalidFile'), 'Payload too large (>30 MB).');
    return null;
  }
  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    Alert.alert(i18n.t('backup.invalidFile'), i18n.t('backup.fileNotJson'));
    return null;
  }
  return validateBackup(parsed);
}

function sanitizeSessionsList(list: any): any[] {
  if (!Array.isArray(list)) return [];
  return list.filter((s: any) => s && typeof s === 'object' && s.id && s.datetime).map((s: any) => {
    // Ensure datetime is parseable; if invalid, coerce to now so legacySessionToV2 won't crash
    const d = new Date(s.datetime);
    if (isNaN(d.getTime())) {
      return { ...s, datetime: new Date().toISOString() };
    }
    return s;
  });
}

/**
 * Validate a parsed backup object and normalize it to BackupData.
 * Handles both v2 format and the legacy v1 format (plain object from handleExportBackup).
 */
export function validateBackup(parsed: any): BackupData | null {
  if (!parsed || typeof parsed !== 'object') {
    Alert.alert(i18n.t('backup.invalidBackup'), i18n.t('backup.invalidBackupData'));
    return null;
  }

  // v2 format — newest, with nested settings
  if (parsed.version === BACKUP_VERSION) {
    if (!parsed.user) {
      Alert.alert(i18n.t('backup.invalidBackup'), i18n.t('backup.missingUserData'));
      return null;
    }
    const s = parsed.settings || {};
    const normalized: BackupData = {
      version: BACKUP_VERSION,
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      username: parsed.username || parsed.user?.name || 'User',
      user: parsed.user,
      sessionsList: sanitizeSessionsList(parsed.sessionsList),
      templatesList: Array.isArray(parsed.templatesList) ? parsed.templatesList : [],
      exercisesList: Array.isArray(parsed.exercisesList) ? parsed.exercisesList : [],
      primaryMetricsList: Array.isArray(parsed.primaryMetricsList) ? parsed.primaryMetricsList : [],
      bodyPartMetricsList: Array.isArray(parsed.bodyPartMetricsList) ? parsed.bodyPartMetricsList : [],
      foldersList: Array.isArray(parsed.foldersList) ? parsed.foldersList : undefined,
      activeProgramId: parsed.activeProgramId !== undefined ? parsed.activeProgramId : undefined,
      programStartDate: parsed.programStartDate !== undefined ? parsed.programStartDate : undefined,
      lastSynced: parsed.lastSynced ?? parsed.exportedAt ?? undefined,
      settings: {
        isAutoTimerEnabled: s.isAutoTimerEnabled ?? true,
        defaultRestDuration: s.defaultRestDuration ?? 90,
        soundSetCompleted: s.soundSetCompleted ?? 'satisfying-click',
        soundWorkoutFinished: s.soundWorkoutFinished ?? 'fanfare',
        soundTimerCompleted: s.soundTimerCompleted ?? 'beep',
        soundVolume: s.soundVolume ?? 0.8,
        isPlateCalculatorEnabled: s.isPlateCalculatorEnabled ?? false,
        isProgramsEnabled: s.isProgramsEnabled ?? false,
        isHistoryEnabled: s.isHistoryEnabled ?? true,
        isMusclesEnabled: s.isMusclesEnabled ?? true,
        enableRoutineFolders: s.enableRoutineFolders ?? false,
        showAchievementBadges: s.showAchievementBadges ?? false,
        showSummaryWidgets: s.showSummaryWidgets ?? false,
        showWeeklyTonnage: s.showWeeklyTonnage ?? false,
        showWorkoutsChart: s.showWorkoutsChart ?? true,
        showHighlights: s.showHighlights ?? false,
        animationSpeed: s.animationSpeed ?? 1,
        isProgressiveOverloadEnabled: s.isProgressiveOverloadEnabled ?? false,
        isAutoFinishSetEnabled: s.isAutoFinishSetEnabled ?? true,
        isRpeMode: s.isRpeMode ?? true,
        showHypertrophyGoal: s.showHypertrophyGoal ?? false,
        customAccentColor: s.customAccentColor ?? '#4F8EF7',
        appTheme: s.appTheme ?? 'default',
        // Preserve any extra custom keys (future-proof)
        ...Object.fromEntries(Object.entries(s).filter(([k]) => !['isAutoTimerEnabled','defaultRestDuration','soundSetCompleted','soundWorkoutFinished','soundTimerCompleted','soundVolume','isPlateCalculatorEnabled','isProgramsEnabled','isHistoryEnabled','isMusclesEnabled','enableRoutineFolders','showAchievementBadges','showSummaryWidgets','showWeeklyTonnage','showWorkoutsChart','showHighlights','animationSpeed','isProgressiveOverloadEnabled','isAutoFinishSetEnabled','isRpeMode','showHypertrophyGoal','customAccentColor','appTheme'].includes(k))),
      },
    };
    return normalized;
  }

  // Legacy v1 format (produced by old handleExportBackup): has user, sessionsList etc. at root
  if (parsed.user && (parsed.sessionsList !== undefined || parsed.exercisesList !== undefined)) {
    const username = parsed.user?.name || parsed.username || 'User';
    const flat = parsed.settings ? { ...parsed, ...parsed.settings } : parsed;
    const src = flat;
    const extraLegacy = parsed.settings
      ? Object.fromEntries(Object.entries(parsed.settings).filter(([k]) => !['isAutoTimerEnabled','defaultRestDuration','soundSetCompleted','soundWorkoutFinished','soundTimerCompleted','soundVolume','isPlateCalculatorEnabled','isProgramsEnabled','isHistoryEnabled','isMusclesEnabled','enableRoutineFolders','showAchievementBadges','showSummaryWidgets','showWeeklyTonnage','showWorkoutsChart','showHighlights','animationSpeed','isProgressiveOverloadEnabled','isAutoFinishSetEnabled','isRpeMode','showHypertrophyGoal','customAccentColor','appTheme'].includes(k)))
      : {};
    return {
      version: BACKUP_VERSION,
      exportedAt: parsed.exportedAt || parsed.exportTimestamp || parsed.timestamp || new Date().toISOString(),
      username,
      user: parsed.user,
      sessionsList: sanitizeSessionsList(parsed.sessionsList),
      templatesList: Array.isArray(parsed.templatesList) ? parsed.templatesList : [],
      exercisesList: Array.isArray(parsed.exercisesList) ? parsed.exercisesList : [],
      primaryMetricsList: Array.isArray(parsed.primaryMetricsList) ? parsed.primaryMetricsList : [],
      bodyPartMetricsList: Array.isArray(parsed.bodyPartMetricsList) ? parsed.bodyPartMetricsList : [],
      foldersList: Array.isArray(parsed.foldersList) ? parsed.foldersList : Array.isArray((parsed as any).foldersList) ? (parsed as any).foldersList : undefined,
      activeProgramId: parsed.activeProgramId !== undefined ? parsed.activeProgramId : undefined,
      programStartDate: parsed.programStartDate !== undefined ? parsed.programStartDate : undefined,
      lastSynced: parsed.lastSynced ?? parsed.timestamp ?? undefined,
      settings: {
        isAutoTimerEnabled: src.isAutoTimerEnabled ?? true,
        defaultRestDuration: src.defaultRestDuration ?? 90,
        soundSetCompleted: src.soundSetCompleted ?? 'satisfying-click',
        soundWorkoutFinished: src.soundWorkoutFinished ?? 'fanfare',
        soundTimerCompleted: src.soundTimerCompleted ?? 'beep',
        soundVolume: src.soundVolume ?? 0.8,
        isPlateCalculatorEnabled: src.isPlateCalculatorEnabled ?? false,
        isProgramsEnabled: src.isProgramsEnabled ?? false,
        isHistoryEnabled: src.isHistoryEnabled ?? true,
        isMusclesEnabled: src.isMusclesEnabled ?? true,
        enableRoutineFolders: src.enableRoutineFolders ?? false,
        showAchievementBadges: src.showAchievementBadges ?? false,
        showSummaryWidgets: src.showSummaryWidgets ?? false,
        showWeeklyTonnage: src.showWeeklyTonnage ?? false,
        showWorkoutsChart: src.showWorkoutsChart ?? true,
        showHighlights: src.showHighlights ?? false,
        animationSpeed: src.animationSpeed ?? 1,
        isProgressiveOverloadEnabled: src.isProgressiveOverloadEnabled ?? false,
        isAutoFinishSetEnabled: src.isAutoFinishSetEnabled ?? true,
        isRpeMode: src.isRpeMode ?? true,
        showHypertrophyGoal: src.showHypertrophyGoal ?? false,
        customAccentColor: src.customAccentColor ?? '#4F8EF7',
        appTheme: src.appTheme ?? 'default',
        ...extraLegacy,
      },
    };
  }

  Alert.alert(
    i18n.t('backup.unrecognizedFormat'),
    i18n.t('backup.unrecognizedFormatMsg')
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
  foldersList?: string[];
  activeProgramId?: string | null;
  programStartDate?: string | null;
  lastSynced?: string | null;
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
    foldersList: params.foldersList,
    activeProgramId: params.activeProgramId,
    programStartDate: params.programStartDate,
    lastSynced: params.lastSynced,
    settings: params.settings,
  };
}
