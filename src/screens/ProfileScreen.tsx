// screens/ProfileScreen.tsx
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';

// Required: warm up the browser so Google sign-in opens instantly on Android
WebBrowser.maybeCompleteAuthSession();
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import Animated, { useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as RN from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import i18n, { switchLanguage } from '../utils/i18n';
import { I18nManager } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
const EMPTY_ARRAY: any[] = [];
const EMPTY_OBJECT: Record<string, any> = {};
import { pickAndReadBackupFile } from '../utils/backupManager';
import {
  getCrashLogs,
  deleteCrashLog,
  clearCrashLogs,
  exportCrashLogsToFile,
  copyCrashLogToClipboard,
  CrashLog
} from '../utils/crashLogger';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow, globalAnimation } from '../theme';
import * as googleDrive from '../utils/googleDrive';
import { getNextWorkout } from '../utils/workout';
import {
  User,
  ChartDataPoint,
  Template,
  mockUser,
  mockSessions,
  mockTemplates,
  mockExercises,
  mockPrimaryMetrics,
  mockBodyPartMetrics,
  mockPrograms,
} from '../data/mockData';

import ScreenHeader from '../components/layout/ScreenHeader';
import Card         from '../components/ui/Card';
import Avatar       from '../components/ui/Avatar';
import Badge        from '../components/ui/Badge';
import BarChart     from '../components/ui/BarChart';
import StatCard     from '../components/ui/StatCard';
import SectionLabel from '../components/ui/SectionLabel';
import IconButton   from '../components/ui/IconButton';

interface ProfileScreenProps {
  user:                  User;
  weeklyChartData:       ChartDataPoint[];
  sessions:              any[];
  isAutoTimerEnabled:    boolean;
  setIsAutoTimerEnabled: (val: boolean) => void;
  onMeasurePress:        () => void;
  googleUser:            { email: string; name: string; avatarUri?: string; accessToken?: string; fileId?: string } | null;
  isProgressiveOverloadEnabled?: boolean;
  setIsProgressiveOverloadEnabled?: (val: boolean) => void;
  isAutoFinishSetEnabled?: boolean;
  setIsAutoFinishSetEnabled?: (val: boolean) => void;
  isKeyboardDismissOnNextEnabled?: boolean;
  setIsKeyboardDismissOnNextEnabled?: (val: boolean) => void;
  isRpeMode?: boolean;
  setIsRpeMode?: (val: boolean) => void;
  exerciseNameLanguage?: 'en' | 'he';
  setExerciseNameLanguage?: (val: 'en' | 'he') => void;
  onGoogleLogin:         (email: string, name: string, accessToken?: string, fileId?: string, avatarUri?: string) => Promise<boolean> | boolean;
  onGoogleLogout:        () => void;
  onCloudSync:           () => Promise<boolean> | boolean;
  onUpdateUser?:         (name: string) => void;
  onImportBackup?:       (backupStr: string) => boolean;
  onImportStrongCSV?:    (csvText: string) => { importedCount: number; addedExercisesCount: number };
  onExportBackup?:       () => Promise<boolean>;
  onExportCSV?:          () => string;
  animationSpeed:        number;
  setAnimationSpeed:     (val: number) => void;
  onWipeAllData?:        () => void;
  lastSynced:            string | null;
  weeklyMuscleSets?:     Record<string, number>;
  exercises?:            any[];
  isWatchSimulatorVisible:    boolean;
  setIsWatchSimulatorVisible: (val: boolean) => void;
  isHealthSyncEnabled:        boolean;
  setIsHealthSyncEnabled:    (val: boolean) => void;
  isLiveHeartRateEnabled:     boolean;
  setIsLiveHeartRateEnabled: (val: boolean) => void;
  onStartWorkout?:            (name: string, exerciseNames: string[], exercisesDetails?: any[]) => void;
  templates?:                 Template[];
  activeProgramId?:           string | null;
  isPlateCalculatorEnabled?:  boolean;
  setIsPlateCalculatorEnabled?: (val: boolean) => void;
  isProgramsEnabled?:          boolean;
  setIsProgramsEnabled?:      (val: boolean) => void;
  isHistoryEnabled?:           boolean;
  setIsHistoryEnabled?:       (val: boolean) => void;
  isMusclesEnabled?:           boolean;
  setIsMusclesEnabled?:       (val: boolean) => void;
  soundSetCompleted?:          string;
  setSoundSetCompleted?:      (val: string) => void;
  soundWorkoutFinished?:       string;
  setSoundWorkoutFinished?:   (val: string) => void;
  soundTimerCompleted?:        string;
  setSoundTimerCompleted?:    (val: string) => void;
  customSounds?:               { id: string; name: string; uri: string }[];
  setCustomSounds?:            (val: { id: string; name: string; uri: string }[]) => void;
  soundVolume?:                number;
  setSoundVolume?:             (val: number) => void;
  defaultRestDuration?:        number;
  setDefaultRestDuration?:    (val: number) => void;
  showAchievementBadges?:     boolean;
  setShowAchievementBadges?:  (val: boolean) => void;
  showSummaryWidgets?:        boolean;
  setShowSummaryWidgets?:     (val: boolean) => void;
  showWeeklyTonnage?:         boolean;
  setShowWeeklyTonnage?:      (val: boolean) => void;
  showWorkoutsChart?:         boolean;
  setShowWorkoutsChart?:      (val: boolean) => void;
  showHighlights?:            boolean;
  setShowHighlights?:         (val: boolean) => void;
  enableRoutineFolders?:      boolean;
  setEnableRoutineFolders?:   (val: boolean) => void;
  isDeveloperModeEnabled:     boolean;
  setIsDeveloperModeEnabled: (val: boolean) => void;
  authMode?:                  'guest' | 'local' | 'google';
  onAppLogout?:               () => Promise<void> | void;
  appTheme?:                  string;
  setAppTheme?:               (theme: string) => void;
  customAccentColor?:         string;
  setCustomAccentColor?:     (color: string) => void;
  themeOverrides?:            any;
  onUpdateThemeOverrides?:    (overrides: any) => void;
  onResetTheme?:              () => void;
}

const formatLastSynced = (isoString: string | null): string => {
  if (!isoString) return i18n.t('extras.neverBackedUp');
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return i18n.t('extras.lastSyncedJustNow');
  if (diffMins < 60) return i18n.t('extras.lastSyncedAgo', { time: `${diffMins}m` });
  return i18n.t('extras.lastSyncedDate', { date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) });
};

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  // Get Monday start
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
};

const getWeeklyStreak = (sessionsList: any[]): number => {
  if (!sessionsList || sessionsList.length === 0) return 0;
  
  const weekStarts = new Set<number>();
  sessionsList.forEach(s => {
    const date = new Date(s.datetime);
    if (isNaN(date.getTime())) return;
    const start = getStartOfWeek(date);
    weekStarts.add(start.getTime());
  });

  const now = new Date();
  const currentWeekStart = getStartOfWeek(now).getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  let streak = 0;
  let checkWeek = currentWeekStart;

  if (weekStarts.has(currentWeekStart)) {
    streak = 1;
    checkWeek = currentWeekStart - oneWeekMs;
    while (weekStarts.has(checkWeek)) {
      streak++;
      checkWeek -= oneWeekMs;
    }
  } else {
    const lastWeekStart = currentWeekStart - oneWeekMs;
    if (weekStarts.has(lastWeekStart)) {
      streak = 1;
      checkWeek = lastWeekStart - oneWeekMs;
      while (weekStarts.has(checkWeek)) {
        streak++;
        checkWeek -= oneWeekMs;
      }
    }
  }
  return streak;
};

interface VolumeSliderProps {
  soundVolume: number;
  setSoundVolume: (val: number) => void;
  soundSetCompleted: string;
}

const VolumeSlider: React.FC<VolumeSliderProps> = ({
  soundVolume,
  setSoundVolume,
  soundSetCompleted,
}) => {
  const [sliderWidth, setSliderWidth] = useState(200);
  const [localVolume, setLocalVolume] = useState(soundVolume);
  const [prevSoundVolume, setPrevSoundVolume] = useState(soundVolume);

  if (soundVolume !== prevSoundVolume) {
    setLocalVolume(soundVolume);
    setPrevSoundVolume(soundVolume);
  }

  const startVolumeRef = useRef(0);
  const localVolumeRef = useRef(localVolume);
  localVolumeRef.current = localVolume;

  const setSoundVolumeRef = useRef(setSoundVolume);
  setSoundVolumeRef.current = setSoundVolume;

  const soundSetCompletedRef = useRef(soundSetCompleted);
  soundSetCompletedRef.current = soundSetCompleted;

  const sliderWidthRef = useRef(sliderWidth);
  sliderWidthRef.current = sliderWidth;

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-8, 8])
    .runOnJS(true)
    .onStart((e) => {
      const initialTouchX = e.x;
      const width = sliderWidthRef.current || 200;
      let newVolume = Math.max(0, Math.min(1, initialTouchX / width));
      newVolume = Math.round(newVolume * 20) / 20;
      setLocalVolume(newVolume);
      startVolumeRef.current = newVolume;
    })
    .onUpdate((e) => {
      const width = sliderWidthRef.current || 200;
      const deltaVol = e.translationX / width;
      let newVolume = Math.max(0, Math.min(1, startVolumeRef.current + deltaVol));
      newVolume = Math.round(newVolume * 20) / 20;
      setLocalVolume(newVolume);
    })
    .onEnd(() => {
      const finalVol = localVolumeRef.current;
      if (setSoundVolumeRef.current) {
        setSoundVolumeRef.current(finalVol);
      }
      import('../utils/soundPlayer').then((m) =>
        m.playSoundByKey(soundSetCompletedRef.current)
      );
    });

  return (
    <View style={styles.volumeSliderContainer}>
      <View style={styles.volumeSliderHeader}>
        <Ionicons name="volume-medium-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
        <Text style={styles.settingTitle}>{i18n.t('profile.soundVolume')}</Text>
        <Text style={styles.volumePercentage}>{Math.round(localVolume * 100)}%</Text>
      </View>
      <GestureDetector gesture={panGesture}>
        <View
          style={styles.volSliderTrack}
          onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
        >
        <View style={[styles.volSliderFill, { width: `${localVolume * 100}%`, pointerEvents: 'none' }]} />
        <View style={[styles.volSliderThumb, { left: `${localVolume * 100}%`, pointerEvents: 'none' }]} />
        </View>
      </GestureDetector>
    </View>
  );
};

interface AnimationSpeedSliderProps {
  animationSpeed: number;
  setAnimationSpeed: (val: number) => void;
}

const AnimationSpeedSlider: React.FC<AnimationSpeedSliderProps> = ({
  animationSpeed,
  setAnimationSpeed,
}) => {
  const [sliderWidth, setSliderWidth] = useState(200);
  const [localSpeed, setLocalSpeed] = useState(animationSpeed);
  const [prevAnimationSpeed, setPrevAnimationSpeed] = useState(animationSpeed);

  if (animationSpeed !== prevAnimationSpeed) {
    setLocalSpeed(animationSpeed);
    setPrevAnimationSpeed(animationSpeed);
  }

  const startSpeedRef = useRef(0);
  const localSpeedRef = useRef(localSpeed);
  localSpeedRef.current = localSpeed;

  const setAnimationSpeedRef = useRef(setAnimationSpeed);
  setAnimationSpeedRef.current = setAnimationSpeed;

  const sliderWidthRef = useRef(sliderWidth);
  sliderWidthRef.current = sliderWidth;

  const animPanGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-8, 8])
    .runOnJS(true)
    .onStart((e) => {
      const initialTouchX = e.x;
      const width = sliderWidthRef.current || 200;
      let newSpeed = Math.max(0, Math.min(2, (initialTouchX / width) * 2));
      newSpeed = Math.round(newSpeed * 20) / 20;
      setLocalSpeed(newSpeed);
      startSpeedRef.current = newSpeed;
    })
    .onUpdate((e) => {
      const width = sliderWidthRef.current || 200;
      const deltaSpeed = (e.translationX / width) * 2;
      let newSpeed = Math.max(0, Math.min(2, startSpeedRef.current + deltaSpeed));
      newSpeed = Math.round(newSpeed * 20) / 20;
      setLocalSpeed(newSpeed);
    })
    .onEnd(() => {
      const finalSpeed = localSpeedRef.current;
      if (setAnimationSpeedRef.current) {
        setAnimationSpeedRef.current(finalSpeed);
      }
    });

  return (
    <View style={styles.volumeSliderContainer}>
      <View style={styles.volumeSliderHeader}>
        <Ionicons name="speedometer-outline" size={20} color={colors.highlight} style={{ marginRight: spacing.sm }} />
        <Text style={styles.settingTitle}>{i18n.t('profile.globalAnimSpeed')}</Text>
        <Text style={styles.volumePercentage}>
          {localSpeed === 0 ? i18n.t('profile.instantAnim') : `${localSpeed}x`}
        </Text>
      </View>
      <GestureDetector gesture={animPanGesture}>
        <View
          style={styles.volSliderTrack}
          onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
        >
          <View style={[styles.volSliderFill, { width: `${(localSpeed / 2) * 100}%`, pointerEvents: 'none' }]} />
          <View style={[styles.volSliderThumb, { left: `${(localSpeed / 2) * 100}%`, pointerEvents: 'none' }]} />
        </View>
      </GestureDetector>
    </View>
  );
};

interface ThemeOverrideInputProps {
  overrideKey: string;
  defaultVal: string;
  themeOverrides: any;
  onUpdateThemeOverrides?: (overrides: any) => void;
}

const ThemeOverrideInput: React.FC<ThemeOverrideInputProps> = ({
  overrideKey,
  defaultVal,
  themeOverrides,
  onUpdateThemeOverrides,
}) => {
  const currentVal = (themeOverrides && themeOverrides[overrideKey]) || '';
  const [text, setText] = useState(currentVal);

  useEffect(() => {
    setText(currentVal);
  }, [currentVal]);

  const handleChangeText = (val: string) => {
    let cleanHex = val.replace(/[^#0-9A-Fa-f]/g, '');
    if (cleanHex.length > 0 && !cleanHex.startsWith('#')) {
      cleanHex = '#' + cleanHex;
    }
    setText(cleanHex);

    if (cleanHex === '') {
      if (onUpdateThemeOverrides) {
        onUpdateThemeOverrides({ [overrideKey]: undefined });
      }
    } else if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(cleanHex)) {
      if (onUpdateThemeOverrides) {
        onUpdateThemeOverrides({ [overrideKey]: cleanHex });
      }
    }
  };

  const handleBlur = () => {
    if (text !== '' && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(text)) {
      setText(currentVal);
    }
  };

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
      <TextInput
        style={styles.hexInputSmall}
        placeholder={i18n.t('profile.hexCodePlaceholder', { code: defaultVal })}
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        maxLength={7}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(text) ? text : defaultVal,
          borderColor: colors.border,
          borderWidth: 1,
        }}
      />
    </View>
  );
};

interface DeveloperCrashLogsViewProps {
  onBack: () => void;
}

const DeveloperCrashLogsView: React.FC<DeveloperCrashLogsViewProps> = ({ onBack }) => {
  const [logs, setLogs] = useState<CrashLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    const fetched = await getCrashLogs();
    setLogs(fetched);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleClearAll = async () => {
    Alert.alert(
      i18n.t('profile.wipeLocalData'),
      'Are you sure you want to clear all crash logs?',
      [
        { text: i18n.t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: i18n.t('common.clear') || 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearCrashLogs();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadLogs();
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    const ok = await exportCrashLogsToFile();
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert(i18n.t('profile.exportFailed'), i18n.t('profile.exportFailedMsg'));
    }
  };

  const handleDelete = async (id: string) => {
    await deleteCrashLog(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadLogs();
  };

  const handleCopy = (log: CrashLog) => {
    copyCrashLogToClipboard(log);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Crash log copied to clipboard!');
  };

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const query = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.message.toLowerCase().includes(query) ||
        log.stack.toLowerCase().includes(query)
    );
  }, [logs, searchQuery]);

  return (
    <View style={{ flex: 1 }}>
      {/* Toolbar */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <Pressable
          style={[styles.togglePill, { flex: 1, height: 45, justifyContent: 'center', alignItems: 'center' }]}
          onPress={handleExport}
          android_ripple={rippleTokens.surface}
        >
          <Text style={styles.togglePillText}>{i18n.t('profile.exportLogs')}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.togglePill,
            { flex: 1, height: 45, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.error + '20' }
          ]}
          onPress={handleClearAll}
          android_ripple={rippleTokens.surface}
        >
          <Text style={[styles.togglePillText, { color: colors.error }]}>
            {i18n.t('profile.clearAllLogs')}
          </Text>
        </Pressable>
      </View>

      {/* Search Input */}
      <TextInput
        style={[styles.textInput, { marginBottom: spacing.md, backgroundColor: colors.surface }]}
        placeholder={i18n.t('profile.searchLogsPlaceholder')}
        placeholderTextColor={colors.textMuted}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {filteredLogs.length === 0 ? (
        <Card padding={spacing.lg} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
          <Ionicons name="shield-checkmark-outline" size={32} color={colors.success} style={{ marginBottom: spacing.sm }} />
          <Text style={[styles.settingsMenuDesc, { textAlign: 'center', color: colors.textSecondary }]}>
            {i18n.t('profile.crashLogsEmpty')}
          </Text>
        </Card>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: spacing.md }}>
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <Card key={log.id} padding={spacing.md} style={{ borderColor: colors.border, borderWidth: 1 }}>
                  {/* Header info */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs }}>
                    <View
                      style={{
                        paddingHorizontal: spacing.xs,
                        paddingVertical: 2,
                        borderRadius: radius.xs,
                        backgroundColor: log.fatal ? colors.error + '25' : colors.highlight + '25',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: font.sizes.xs,
                          fontFamily: font.bold,
                          color: log.fatal ? colors.error : colors.highlight,
                        }}
                      >
                        {log.fatal ? i18n.t('profile.fatalCrash') : i18n.t('profile.nonFatalCrash')}
                      </Text>
                    </View>
                    <Text style={{ fontSize: font.sizes.xs, color: colors.textSecondary }}>
                      {new Date(log.timestamp).toLocaleTimeString()} • {log.version}
                    </Text>
                  </View>

                  {/* Error message */}
                  <Text style={{ color: colors.textPrimary, fontFamily: font.bold, fontSize: font.sizes.sm, marginBottom: spacing.xs }} numberOfLines={3}>
                    {log.message}
                  </Text>

                  {/* Actions Row */}
                  <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, alignItems: 'center' }}>
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      onPress={() => handleCopy(log)}
                      android_ripple={rippleTokens.borderless}
                    >
                      <Ionicons name="copy-outline" size={16} color={colors.accent} />
                      <Text style={{ color: colors.accent, fontSize: font.sizes.xs, fontFamily: font.semibold }}>
                        {i18n.t('profile.copyLog')}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      onPress={() => setExpandedLogId(isExpanded ? null : log.id)}
                      android_ripple={rippleTokens.borderless}
                    >
                      <Ionicons name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: font.sizes.xs, fontFamily: font.semibold }}>
                        {isExpanded ? 'Hide Stack' : 'Show Stack'}
                      </Text>
                    </Pressable>

                    <View style={{ flex: 1 }} />

                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      onPress={() => handleDelete(log.id)}
                      android_ripple={rippleTokens.borderless}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                      <Text style={{ color: colors.error, fontSize: font.sizes.xs, fontFamily: font.semibold }}>
                        {i18n.t('profile.deleteLog')}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Stack Trace */}
                  {isExpanded && (
                    <ScrollView
                      nestedScrollEnabled
                      style={{
                        maxHeight: 180,
                        marginTop: spacing.sm,
                        padding: spacing.sm,
                        backgroundColor: colors.bg,
                        borderRadius: radius.xs,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
                          fontSize: 10,
                          color: colors.textSecondary,
                        }}
                      >
                        {log.stack}
                      </Text>
                    </ScrollView>
                  )}
                </Card>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const ProfileScreen: React.FC<ProfileScreenProps> = ({ 
  user, 
  weeklyChartData, 
  sessions,
  isAutoTimerEnabled, 
  setIsAutoTimerEnabled,
  onMeasurePress,
  googleUser,
  isProgressiveOverloadEnabled = false,
  setIsProgressiveOverloadEnabled,
  isAutoFinishSetEnabled = true,
  setIsAutoFinishSetEnabled,
  isKeyboardDismissOnNextEnabled = true,
  setIsKeyboardDismissOnNextEnabled,
  isRpeMode = true,
  setIsRpeMode,
  exerciseNameLanguage = 'en',
  setExerciseNameLanguage,
  onGoogleLogin,
  onGoogleLogout,
  onCloudSync,
  onUpdateUser,
  onImportBackup,
  onImportStrongCSV,
  onExportBackup,
  onExportCSV,
  animationSpeed = 1,
  setAnimationSpeed,
  onWipeAllData,
  lastSynced,
  weeklyMuscleSets = EMPTY_OBJECT,
  exercises = EMPTY_ARRAY,
  isWatchSimulatorVisible,
  setIsWatchSimulatorVisible,
  isHealthSyncEnabled,
  setIsHealthSyncEnabled,
  isLiveHeartRateEnabled,
  setIsLiveHeartRateEnabled,
  onStartWorkout,
  templates = EMPTY_ARRAY,
  activeProgramId = null,
  isPlateCalculatorEnabled = false,
  setIsPlateCalculatorEnabled,
  isProgramsEnabled = false,
  setIsProgramsEnabled,
  isHistoryEnabled = true,
  setIsHistoryEnabled,
  isMusclesEnabled = true,
  setIsMusclesEnabled,
  soundSetCompleted = 'chime',
  setSoundSetCompleted,
  soundWorkoutFinished = 'fanfare',
  setSoundWorkoutFinished,
  soundTimerCompleted = 'beep',
  setSoundTimerCompleted,
  customSounds = EMPTY_ARRAY,
  setCustomSounds,
  soundVolume = 0.8,
  setSoundVolume,
  defaultRestDuration = 90,
  setDefaultRestDuration,
  showAchievementBadges = false,
  setShowAchievementBadges,
  showSummaryWidgets = false,
  setShowSummaryWidgets,
  showWeeklyTonnage = false,
  setShowWeeklyTonnage,
  showWorkoutsChart = true,
  setShowWorkoutsChart,
  showHighlights = false,
  setShowHighlights,
  enableRoutineFolders = false,
  setEnableRoutineFolders,
  isDeveloperModeEnabled = false,
  setIsDeveloperModeEnabled,
  authMode = 'guest',
  onAppLogout,
  appTheme = 'default',
  setAppTheme,
  customAccentColor = '#4F8EF7',
  setCustomAccentColor,
  themeOverrides,
  onUpdateThemeOverrides,
  onResetTheme,
}) => {
  const insets = useSafeAreaInsets();
  // Modals state
  const [isRenameVisible, setIsRenameVisible] = useState(false);
  const [devToolsTapUnlocked, setDevToolsTapUnlocked] = useState(false);
  const developerToolsUnlocked = isDeveloperModeEnabled || devToolsTapUnlocked;

  const versionTapCount = useRef(0);
  const lastVersionTapTime = useRef(0);

  const handleVersionPress = () => {
    const now = Date.now();
    if (now - lastVersionTapTime.current > 2000) {
      versionTapCount.current = 1;
    } else {
      versionTapCount.current += 1;
    }
    lastVersionTapTime.current = now;

    if (versionTapCount.current >= 3) {
      setDevToolsTapUnlocked(true);
      Alert.alert(
        i18n.t('extras.devToolsUnlocked'),
        i18n.t('extras.devToolsUnlockedMsg')
      );
      versionTapCount.current = 0;
    }
  };
  const [isBackupPanelVisible, setIsBackupPanelVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [settingsView, setSettingsView] = useState<'menu' | 'account' | 'data' | 'workout' | 'sounds' | 'appearance' | 'about' | 'developer'>('menu');

  // Form inputs
  const [tempName, setTempName] = useState(user?.name || '');
  const [backupText, setBackupText] = useState('');
  const [pastedBackup, setPastedBackup] = useState('');

  // Sound selector overlay states
  const [isSoundSelectorVisible, setIsSoundSelectorVisible] = useState(false);
  const [activeSoundTrigger, setActiveSoundTrigger] = useState<'setChecked' | 'workoutCompleted' | 'timerCompleted' | null>(null);

  // Timer selector overlay states
  const [isTimerPickerVisible, setIsTimerPickerVisible] = useState(false);
  const [customTimerValue, setCustomTimerValue] = useState(() => defaultRestDuration.toString());



  const handlePickCustomSound = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const fileName = asset.name || 'custom_sound.mp3';
      const fileUri = asset.uri;

      // Copy to document directory for permanent local offline access
      const destUri = `${FileSystem.documentDirectory}${Date.now()}_${fileName}`;
      await FileSystem.copyAsync({
        from: fileUri,
        to: destUri,
      });

      const newSound = {
        id: `custom-${Date.now()}`,
        name: fileName.replace(/\.[^/.]+$/, ""), // Strip extension for clean display
        uri: destUri,
      };

      if (setCustomSounds) {
        setCustomSounds([...customSounds, newSound]);
      }

      // Automatically select the newly imported sound for the active trigger
      handleSelectSound(newSound.id);
      
      Alert.alert(i18n.t('common.success'), i18n.t('profile.customSoundAdded', { name: newSound.name }));
    } catch (error) {
      console.warn('Error picking custom sound:', error);
      Alert.alert(i18n.t('common.error'), i18n.t('profile.failedPickSound'));
    }
  };

  const handleDeleteCustomSound = (soundId: string, e: any) => {
    e.stopPropagation();
    Alert.alert(
      i18n.t('profile.deleteCustomSound'),
      i18n.t('profile.deleteCustomSoundMsg'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const soundToDelete = customSounds.find(s => s.id === soundId);
            if (soundToDelete) {
              try {
                const info = await FileSystem.getInfoAsync(soundToDelete.uri);
                if (info.exists) {
                  await FileSystem.deleteAsync(soundToDelete.uri);
                }
              } catch (err) {
                console.warn('Error deleting custom sound file from filesystem', err);
              }
            }
            if (setCustomSounds) {
              setCustomSounds(customSounds.filter(s => s.id !== soundId));
            }
            // If the deleted sound was selected, revert to default
            if (soundSetCompleted === soundId && setSoundSetCompleted) setSoundSetCompleted('chime');
            if (soundWorkoutFinished === soundId && setSoundWorkoutFinished) setSoundWorkoutFinished('fanfare');
            if (soundTimerCompleted === soundId && setSoundTimerCompleted) setSoundTimerCompleted('beep');
          }
        }
      ]
    );
  };

  const formatSoundName = (soundKey: string) => {
    if (soundKey === 'chime') return i18n.t('extras.soundChime');
    if (soundKey === 'beep') return i18n.t('extras.soundDoubleBeep');
    if (soundKey === 'fanfare') return i18n.t('extras.soundFanfare');
    if (soundKey === 'bell1') return i18n.t('extras.soundBell1');
    if (soundKey === 'bell2') return i18n.t('extras.soundBell2');
    if (soundKey === 'boxing-bell') return i18n.t('extras.soundBoxingBell');
    if (soundKey === 'mute') return i18n.t('extras.soundMute');
    const found = customSounds.find(c => c.id === soundKey);
    return found ? found.name : i18n.t('extras.soundCustom');
  };

  const handleSelectSound = (soundKey: string) => {
    if (activeSoundTrigger === 'setChecked') {
      if (setSoundSetCompleted) setSoundSetCompleted(soundKey);
    } else if (activeSoundTrigger === 'workoutCompleted') {
      if (setSoundWorkoutFinished) setSoundWorkoutFinished(soundKey);
    } else if (activeSoundTrigger === 'timerCompleted') {
      if (setSoundTimerCompleted) setSoundTimerCompleted(soundKey);
    }
    // Preview the sound
    import('../utils/soundPlayer').then(m => m.playSoundByKey(soundKey));
  };

  // Client ID is read from env — never hardcode here. See .env.example
  const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
  const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ANDROID_CLIENT_ID;
  const androidRedirectUri = `com.googleusercontent.apps.${ANDROID_CLIENT_ID.replace('.apps.googleusercontent.com', '')}:/oauth2redirect`;

  // expo-auth-session hook — handles PKCE, redirect URI, and token exchange automatically
  // redirectUri must use the reverse client ID scheme for Android OAuth clients
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    redirectUri: androidRedirectUri,
    scopes: [
      'openid',
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });

  // React to the auth response from Google in Profile Settings
  React.useEffect(() => {
    if (response) {
      if (response.type === 'success') {
        const token = response.authentication?.accessToken;
        if (token) {
          handleConnectWithToken(token);
        } else {
          setIsSyncing(false);
          Alert.alert(i18n.t('login.googleSignInError'), i18n.t('login.noAccessToken'));
        }
      } else if (response.type === 'error') {
        setIsSyncing(false);
        Alert.alert(i18n.t('login.googleSignInError'), i18n.t('extras.oauthError', { error: response.error?.message || 'Unknown error' }));
      } else if (response.type === 'cancel') {
        setIsSyncing(false);
        Alert.alert(i18n.t('login.googleSignInCancelled'), i18n.t('login.googleCancelledMsg'));
      }
    }
  }, [response]);

  // Load animations
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(0);

  React.useEffect(() => {
    const speed = (typeof globalAnimation !== 'undefined' && globalAnimation && typeof globalAnimation.speed === 'number')
      ? globalAnimation.speed
      : 1;

    if (speed === 0) {
      fadeAnim.value = 1;
      return;
    }
    fadeAnim.value = withTiming(1, {
      duration: 450 * speed,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  const handleLoadDemoData = () => {
    if (onImportBackup) {
      const demoBackup = {
        user: {
          ...mockUser,
          totalWorkouts: mockUser.totalWorkouts,
        },
        sessionsList: mockSessions,
        templatesList: mockTemplates,
        exercisesList: mockExercises,
        primaryMetricsList: mockPrimaryMetrics,
        bodyPartMetricsList: mockBodyPartMetrics,
        isAutoTimerEnabled: true,
      };
      const success = onImportBackup(JSON.stringify(demoBackup));
      if (success) {
        Alert.alert(
          i18n.t('extras.demoDataLoaded'),
          i18n.t('extras.demoDataLoadedMsg')
        );
      } else {
        Alert.alert(i18n.t('common.error'), i18n.t('profile.loadDemoFailed'));
      }
    }
  };

  const chartData = useMemo(
    () => (weeklyChartData || []).map(d => ({ label: d.weekLabel, value: d.count })),
    [weeklyChartData]
  );

  const avgPerWeek = useMemo(() => {
    if (!weeklyChartData || weeklyChartData.length === 0) return 0;
    return weeklyChartData.reduce((s, d) => s + d.count, 0) / weeklyChartData.length;
  }, [weeklyChartData]);

  const { allTimeVolume, monthlyVolume, weeklyStreak } = useMemo(() => {
    let allTime = 0;
    let monthly = 0;
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    (sessions || []).forEach(s => {
      const vol = s.totalVolumeKg || 0;
      allTime += vol;
      const sTime = new Date(s.datetime).getTime();
      if (!isNaN(sTime) && sTime >= thirtyDaysAgo) {
        monthly += vol;
      }
    });

    const streak = getWeeklyStreak(sessions || []);

    return {
      allTimeVolume: allTime,
      monthlyVolume: monthly,
      weeklyStreak: streak
    };
  }, [sessions]);

  const milestones = useMemo(() => {
    const totalW = sessions.length;
    const allVol = allTimeVolume;
    const has60m = sessions.some(s => s.durationMinutes >= 60);
    const hasCustom = exercises.some(ex => ex.id.startsWith('ex-custom-'));
    const earlyBird = sessions.some(s => {
      const date = new Date(s.datetime);
      return !isNaN(date.getTime()) && date.getHours() < 8;
    });
    const nightOwl = sessions.some(s => {
      const date = new Date(s.datetime);
      return !isNaN(date.getTime()) && date.getHours() >= 20;
    });

    return [
      {
        id: 'consistency-king',
        title: i18n.t('badges.consistencyKing'),
        description: i18n.t('badges.consistencyKingDesc'),
        icon: 'calendar-outline' as const,
        unlocked: totalW >= 10,
      },
      {
        id: 'century-club',
        title: i18n.t('badges.centuryClub'),
        description: i18n.t('badges.centuryClubDesc'),
        icon: 'trophy-outline' as const,
        unlocked: totalW >= 100,
      },
      {
        id: 'heavy-lifter',
        title: i18n.t('badges.heavyLifter'),
        description: i18n.t('badges.heavyLifterDesc'),
        icon: 'barbell-outline' as const,
        unlocked: allVol >= 10000,
      },
      {
        id: 'titan',
        title: i18n.t('badges.titan'),
        description: i18n.t('badges.titanDesc'),
        icon: 'flame-outline' as const,
        unlocked: allVol >= 50000,
      },
      {
        id: 'iron-lungs',
        title: i18n.t('badges.ironLungs'),
        description: i18n.t('badges.ironLungsDesc'),
        icon: 'stopwatch-outline' as const,
        unlocked: has60m,
      },
      {
        id: 'custom-creator',
        title: i18n.t('badges.customCreator'),
        description: i18n.t('badges.customCreatorDesc'),
        icon: 'hammer-outline' as const,
        unlocked: hasCustom,
      },
      {
        id: 'early-bird',
        title: i18n.t('badges.earlyBird'),
        description: i18n.t('badges.earlyBirdDesc'),
        icon: 'sunny-outline' as const,
        unlocked: earlyBird,
      },
      {
        id: 'night-owl',
        title: i18n.t('badges.nightOwl'),
        description: i18n.t('badges.nightOwlDesc'),
        icon: 'moon-outline' as const,
        unlocked: nightOwl,
      },
    ];
  }, [sessions, allTimeVolume, exercises]);

  // Dynamic PR highlight
  const bestPr = useMemo(() => {
    let topWeight = 0;
    let topReps = 0;
    let topExName = '';
    let topDate = '';
    
    (sessions || []).forEach(session => {
      (session.exercises || []).forEach((ex: any) => {
        if (ex.bestWeight > topWeight) {
          topWeight = ex.bestWeight;
          topReps = ex.bestReps;
          topExName = ex.name;
          const d = new Date(session.datetime);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          topDate = `${monthNames[d.getMonth()]} ${d.getDate()}`;
        }
      });
    });
    
    if (topWeight === 0) return null;
    return { name: topExName, weight: topWeight, reps: topReps, date: topDate };
  }, [sessions]);

  const topPrs = useMemo(() => {
    const list: { name: string; weight: number; reps: number; date: string; rawDate: number }[] = [];
    (sessions || []).forEach(session => {
      (session.exercises || []).forEach((ex: any) => {
        const d = new Date(session.datetime);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateStr = `${monthNames[d.getMonth()]} ${d.getDate()}`;
        list.push({ name: ex.name, weight: ex.bestWeight, reps: ex.bestReps, date: dateStr, rawDate: d.getTime() });
      });
    });
    const unique = new Map<string, typeof list[number]>();
    list.sort((a, b) => b.weight - a.weight).forEach(item => {
      if (!unique.has(item.name)) {
        unique.set(item.name, item);
      }
    });
    const prList = Array.from(unique.values());
    prList.sort((a, b) => b.rawDate - a.rawDate);
    return prList.slice(0, 5);
  }, [sessions]);

  // Intelligent "Smart Quick Start" next workout selection logic
  const nextWorkout = useMemo(() => {
    return getNextWorkout(activeProgramId, sessions, templates, colors);
  }, [activeProgramId, sessions, templates]);

  // Rename submit
  const handleRenameSubmit = () => {
    if (!tempName.trim()) {
      Alert.alert(i18n.t('common.error'), i18n.t('profile.enterName'));
      return;
    }
    if (onUpdateUser) {
      onUpdateUser(tempName.trim());
    }
    setIsRenameVisible(false);
    Alert.alert(i18n.t('common.success'), i18n.t('profile.profileNameUpdated'));
  };

  // Real Google token authentication
  const handleConnectWithToken = async (token: string) => {
    setIsSyncing(true);
    try {
      const profile = await googleDrive.fetchUserProfile(token);
      const fileId = await googleDrive.findBackupFile(token);

      const isRestored = await onGoogleLogin(
        profile.email,
        profile.name,
        token,
        fileId || undefined,
        profile.avatarUri
      );

      setIsSyncing(false);

      if (isRestored) {
        Alert.alert(
          i18n.t('extras.googleCloudRecovery'),
          i18n.t('extras.googleCloudRecoveryMsg', { name: profile.name })
        );
      } else {
        // Run initial cloud sync to save current local state to their Drive!
        await onCloudSync();
        Alert.alert(
          i18n.t('extras.googleAccountConnected'),
          i18n.t('extras.googleAccountConnectedMsg', { email: profile.email })
        );
      }
    } catch (err: any) {
      setIsSyncing(false);
      console.error('[Google Connect Error]', err);
      Alert.alert(i18n.t('profile.connectionFailed'), `Failed to connect: ${err.message || err}`);
    }
  };

  // Google Sign-In via OAuth (standard native picker flow)
  const handleGoogleWebAuth = async () => {
    if (!ANDROID_CLIENT_ID) {
      Alert.alert(
        i18n.t('extras.googleClientIdNotSet'),
        i18n.t('extras.googleClientIdNotSetMsg')
      );
      return;
    }

    if (!request) {
      Alert.alert(i18n.t('profile.googleClientNotReady'), i18n.t('profile.googleClientNotReadyMsg'));
      return;
    }

    setIsSyncing(true);
    try {
      await promptAsync();
    } catch (err: any) {
      console.error('[ProfileScreen] promptAsync error', err);
      setIsSyncing(false);
      Alert.alert(i18n.t('profile.authFailed'), err.message || String(err));
    }
  };



  // File-based export
  const handleExportJson = async () => {
    if (onExportBackup) {
      try {
        const ok = await onExportBackup();
        if (!ok) {
          Alert.alert(i18n.t('profile.exportFailed'), i18n.t('profile.exportFailedMsg'));
        }
        // Success message is shown by the native Share sheet / download trigger
      } catch (e: any) {
        Alert.alert(i18n.t('profile.exportError'), e.message || 'An error occurred during export.');
      }
    }
  };

  const handleExportCsvPress = () => {
    if (onExportCSV) {
      const csv = onExportCSV();
      setBackupText(csv);
      setIsBackupPanelVisible(true);
    }
  };

  const handleExportPress = () => {
    Alert.alert(
      i18n.t('profile.exportBackup'),
      i18n.t('profile.chooseExportFormat'),
      [
        {
          text: i18n.t('profile.backupFileJson'),
          onPress: handleExportJson,
        },
        {
          text: i18n.t('profile.csvSpreadsheet'),
          onPress: handleExportCsvPress,
        },
        {
          text: i18n.t('common.cancel'),
          style: 'cancel',
        },
      ]
    );
  };

  const handleImportPress = () => {
    Alert.alert(
      i18n.t('profile.importRestore'),
      i18n.t('extras.selectImportMethod'),
      [
        {
          text: i18n.t('profile.restoreFromBackup'),
          onPress: handleImportFromFile,
        },
        {
          text: i18n.t('profile.pasteJsonPayload'),
          onPress: () => {
            setPastedBackup('');
            setBackupText('');
            setIsBackupPanelVisible(true);
          },
        },
        {
          text: i18n.t('common.cancel'),
          style: 'cancel',
        },
      ]
    );
  };

  const handleImportStrongCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const fileUri = asset.uri;

      // Read content of picked CSV file
      let csvText = '';
      if (Platform.OS === 'web') {
        const response = await fetch(fileUri);
        csvText = await response.text();
      } else {
        csvText = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      if (!csvText || !csvText.trim()) {
        Alert.alert(i18n.t('common.error'), i18n.t('profile.csvEmpty'));
        return;
      }

      if (onImportStrongCSV) {
        const { importedCount, addedExercisesCount } = onImportStrongCSV(csvText);
        Alert.alert(
          i18n.t('common.success'),
          i18n.t('extras.csvImportSuccess', { count: importedCount })
        );
      } else {
        Alert.alert(i18n.t('common.error'), i18n.t('profile.importNotAvailable'));
      }
    } catch (error: any) {
      console.warn('Error importing Strong CSV:', error);
      Alert.alert(i18n.t('profile.importFailed'), error.message || i18n.t('extras.csvImportFailed'));
    }
  };

  // File-picker-based import
  const handleImportFromFile = async () => {
    try {
      const backupData = await pickAndReadBackupFile();
      if (!backupData) return; // User cancelled or invalid file (alert shown)

      if (onImportBackup) {
        // Convert to legacy string format for existing handler (which calls applyBackupData)
        const ok = onImportBackup(JSON.stringify(backupData));
        if (ok) {
          Alert.alert(
            i18n.t('common.success'),
            i18n.t('extras.restoreSuccessMsg')
          );
        } else {
          Alert.alert(i18n.t('profile.restoreFailed'), i18n.t('profile.restoreFailedMsg'));
        }
      }
    } catch (e: any) {
      Alert.alert(i18n.t('profile.importError'), e.message || i18n.t('extras.importErrorMsg'));
    }
  };

  const handleImportSubmit = () => {
    if (!pastedBackup.trim()) {
      Alert.alert(i18n.t('common.error'), i18n.t('profile.pasteBackupFirst'));
      return;
    }
    if (onImportBackup) {
      const ok = onImportBackup(pastedBackup.trim());
      if (ok) {
        setPastedBackup('');
        setIsBackupPanelVisible(false);
        Alert.alert(i18n.t('common.success'), i18n.t('profile.profileRestored'));
      } else {
        Alert.alert(i18n.t('common.error'), i18n.t('profile.invalidBackupFormat'));
      }
    }
  };

  // Phone switch simulation
  const handlePhoneWipeSimulator = () => {
    Alert.alert(
      i18n.t('profile.wipeAllData'),
      i18n.t('extras.wipeDataWarning'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('profile.wipeLocalData'),
          style: 'destructive',
          onPress: () => {
            try {
              if (onWipeAllData) {
                onWipeAllData();
              } else if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem('strongern_app_data_v1');
              }
              Alert.alert(
                i18n.t('common.success'),
                i18n.t('extras.wipeDataSuccess'),
                [
                  {
                    text: i18n.t('common.ok'),
                    onPress: () => {
                      // Reset transient state
                      onGoogleLogout();
                    }
                  }
                ]
              );
            } catch (e) {
              console.warn(e);
            }
          }
        }
      ]
    );
  };

  const handleAppLogoutConfirm = () => {
    Alert.alert(
      i18n.t('profile.logOutConfirm'),
      i18n.t('profile.logOutConfirmMsg'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('profile.logOut'),
          style: 'destructive',
          onPress: async () => {
            setIsSettingsVisible(false);
            setSettingsView('menu');
            if (onAppLogout) {
              await onAppLogout();
            }
          }
        }
      ]
    );
  };


  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={i18n.t('tabs.profile')}
        actions={[
          {
            icon: 'notifications-outline',
            label: i18n.t('extras.notifications'),
            onPress: () => {
              Alert.alert(i18n.t('profile.gymReminders'), i18n.t('profile.gymRemindersMsg'));
            }
          },
          {
            icon: 'settings-outline',
            label: i18n.t('profile.settingsTitle'),
            onPress: () => {
              setSettingsView('menu');
              setIsSettingsVisible(true);
            },
          },
        ]}
        testID="profile.header"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], width: '100%' }}>
          {/* ── Welcome Empty State / Load Demo Data Card ────────── */}
          {sessions?.length === 0 && !googleUser && authMode === 'guest' && isDeveloperModeEnabled && (
            <Card padding={spacing.lg} style={styles.demoCard}>
              <View style={styles.demoHeader}>
                <View style={[styles.demoIconCircle, { backgroundColor: colors.accent + '22' }]}>
                  <Ionicons name="sparkles" size={20} color={colors.accent} />
                </View>
                <Text style={styles.demoTitle}>{i18n.t('profile.welcomeTitle')}</Text>
              </View>
              <Text style={styles.demoText}>
                {i18n.t('profile.welcomeMsg')}
              </Text>
              <Pressable
                onPress={handleLoadDemoData}
                style={styles.demoBtn}
                android_ripple={rippleTokens.accent}
              >
                <Ionicons name="barbell" size={16} color="#0D0F14" style={{ marginRight: spacing.xs }} />
                <Text style={styles.demoBtnText}>{i18n.t('profile.loadDemoDb')}</Text>
              </Pressable>
            </Card>
          )}

          {/* ── User Hero Card ───────────────────────────────────── */}
        <Card style={styles.heroCard} padding={0} testID="profile.user-card">
          <View style={styles.heroContent}>
            <View style={styles.avatarSection}>
              <Avatar
                initials={getInitials((authMode === 'google' ? googleUser?.name : user?.name) || i18n.t('profile.guestUser'))}
                uri={user?.avatarUri}
                size={64}
                testID="profile.avatar"
              />
            </View>

            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>
                {authMode === 'google' ? (googleUser?.name || i18n.t('profile.googleUser')) : (user?.name || i18n.t('profile.guestUser'))}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.sm, flexWrap: 'wrap' }}>
                <View style={styles.heroMeta}>
                  <Ionicons name="trophy-outline" size={13} color={colors.accent} />
                  <Text style={styles.heroMetaText}>{sessions?.length ?? 0} {i18n.t('profile.workoutsCompleted')}</Text>
                </View>
              </View>
            </View>
          </View>
        </Card>

        {/* ── Smart Quick Start Card ───────────────────────────── */}
        <Pressable
          onPress={() => {
            if (onStartWorkout) {
              onStartWorkout(nextWorkout.name, nextWorkout.exercises, nextWorkout.exercisesDetails);
            }
          }}
          android_ripple={rippleTokens.accent}
          accessibilityLabel={`Start ${nextWorkout.name}`}
          testID="profile.quick-start-card"
          style={({ pressed }) => [
            styles.quickStartCard,
            pressed && { opacity: 0.85 },
          ]}
        >
          <View 
            style={{ padding: spacing.lg, backgroundColor: 'transparent' }}
          >
            <View style={styles.quickStartHeader}>
              <View style={styles.quickStartTitleContainer}>
                <Ionicons name="flash" size={16} color={nextWorkout.badgeColor} style={{ marginRight: spacing.xs }} />
                <Text style={styles.quickStartLabel}>{i18n.t('profile.upNext')}</Text>
              </View>

            </View>
            
            <Text style={styles.quickStartWorkoutName}>{nextWorkout.name}</Text>
            
            {nextWorkout.exercises && nextWorkout.exercises.length > 0 && (
              <Text style={styles.quickStartExercises} numberOfLines={2}>
                {nextWorkout.exercises.join('  ·  ')}
              </Text>
            )}

            <View style={styles.quickStartBtn}>
              <Ionicons name="play" size={16} color="#0D0F14" style={{ marginRight: spacing.xs }} />
              <Text style={styles.quickStartBtnText}>{i18n.t('profile.startWorkout')}</Text>
            </View>
          </View>
        </Pressable>

        {/* ── Dashboard ────────────────────────────────────────── */}

        {/* ── Chart Card ───────────────────────────────────────── */}
        {showWorkoutsChart && (
          <Card padding={spacing.lg} testID="profile.chart-card">
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>{i18n.t('profile.workoutsPerWeek')}</Text>
                <Text style={styles.chartSubtitle}>{i18n.t('profile.last8Weeks')}</Text>
              </View>

            </View>
            <BarChart data={chartData} chartHeight={200} />
          </Card>
        )}

        {/* ── Stats Row (Moved Below Dashboard, Best Week Removed) ────────── */}
        {showSummaryWidgets && (
          <>
            <View style={[styles.statsRow, { marginTop: spacing.md }]}>
              <StatCard
                value={avgPerWeek}
                label={i18n.t('profile.avgPerWeek')}
                decimals={1}
                icon="trending-up-outline"
                iconColor={colors.accent}
                style={{ backgroundColor: 'transparent' }}
                testID="profile.stat-avg-week"
              />
              <View style={styles.statGap} />
              <StatCard
                value={sessions.length}
                label={i18n.t('profile.allTime')}
                icon="barbell-outline"
                iconColor={colors.highlight}
                style={{ backgroundColor: 'transparent' }}
                testID="profile.stat-all-time"
              />
            </View>

            {/* ── Volume and Streak Stats Row ────────────────────── */}
            <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
              <StatCard
                value={weeklyStreak}
                label={i18n.t('profile.weekStreak')}
                icon="flame-outline"
                iconColor={colors.accent}
                style={{ backgroundColor: 'transparent' }}
                testID="profile.stat-streak"
              />
              <View style={styles.statGap} />
              <StatCard
                value={monthlyVolume / 1000}
                decimals={1}
                label={i18n.t('profile.monthVolume')}
                icon="analytics-outline"
                iconColor={colors.highlight}
                style={{ backgroundColor: 'transparent' }}
                testID="profile.stat-month-vol"
              />
              <View style={styles.statGap} />
              <StatCard
                value={allTimeVolume / 1000}
                decimals={1}
                label={i18n.t('profile.allVolume')}
                icon="trophy-outline"
                iconColor={colors.accent}
                style={{ backgroundColor: 'transparent' }}
                testID="profile.stat-all-vol"
              />
            </View>
          </>
        )}



        {/* ── Measurements Section ────────────────────────────── */}
        <SectionLabel
          title={i18n.t('profile.measurements')}
          subtitle={i18n.t('profile.trackProgress')}
          style={[styles.sectionLabel, { marginTop: spacing.xl }]}
        />
        <Card padding={0}>
          <Pressable
            style={styles.settingsQuickRow}
            onPress={onMeasurePress}
            android_ripple={rippleTokens.surface}
            accessibilityLabel="Open measurements"
          >
            <View style={[styles.settingsQuickIcon, { backgroundColor: colors.highlight + '22' }]}>
              <Ionicons name="resize-outline" size={20} color={colors.highlight} />
            </View>
            <View style={styles.measureText}>
              <Text style={styles.measureTitle}>{i18n.t('profile.bodyMeasurements')}</Text>
              <Text style={styles.measureSub}>{i18n.t('profile.logSizeWeight')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>

        {/* ── Personal Records ── */}
        {showHighlights && (
          <>
            <SectionLabel
              title={i18n.t('profile.personalRecords')}
              subtitle={i18n.t('profile.yourTopLifts')}
              style={[styles.sectionLabel, { marginTop: spacing.xl }]}
            />
            {topPrs.length === 0 ? (
              <Card padding={spacing.lg}>
                <Text style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center' }}>
                  {i18n.t('profile.logWorkoutsAchievements')}
                </Text>
              </Card>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xs, paddingBottom: spacing.xs }}
              >
                {topPrs.map((pr) => (
                  <Card 
                    key={`${pr.name}-${pr.date}`} 
                    padding={spacing.md} 
                    style={{ width: 140, borderColor: colors.border, borderWidth: 1, backgroundColor: 'transparent' }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                      <Ionicons name="trophy" size={14} color={colors.gold} />
                      <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, fontFamily: font.bold }}>{pr.date}</Text>
                    </View>
                    <Text style={{ color: colors.textPrimary, fontSize: font.sizes.xs, fontFamily: font.bold, marginBottom: 2 }} numberOfLines={1}>
                      {pr.name}
                    </Text>
                    <Text style={{ color: colors.accent, fontSize: font.sizes.md, fontFamily: font.bold }}>
                      {pr.weight} kg
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: font.sizes.sm, fontFamily: font.medium }}>
                      {i18n.t('profile.forReps', { weight: pr.weight, reps: pr.reps })}
                    </Text>
                  </Card>
                ))}
              </ScrollView>
            )}
          </>
        )}

        {/* ── Volume Trends ── */}
        {showWeeklyTonnage && (
          <>
            <SectionLabel
              title={i18n.t('profile.volumeTrends')}
              subtitle={i18n.t('profile.muscleSetsWeek')}
              style={[styles.sectionLabel, { marginTop: spacing.xl }]}
            />
            <Card padding={spacing.lg}>
              {Object.keys(weeklyMuscleSets || {}).length === 0 ? (
                <Text style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center' }}>
                  {i18n.t('profile.noSetsThisWeek')}
                </Text>
              ) : (
                <View style={{ gap: spacing.md }}>
                  {Object.keys(weeklyMuscleSets).map((muscle) => {
                    const sets = weeklyMuscleSets[muscle] || 0;
                    const maxVal = Math.max(...Object.values(weeklyMuscleSets), 1);
                    const percentage = Math.round((sets / maxVal) * 100);
                    return (
                      <View key={muscle} style={{ gap: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: colors.textPrimary, fontSize: font.sizes.xs, fontFamily: font.semibold }}>
                            {muscle.toUpperCase()}
                          </Text>
                          <Text style={{ color: colors.textSecondary, fontSize: font.sizes.xs, fontFamily: font.bold }}>
                            {sets} {i18n.t('profile.sets')}
                          </Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: colors.surface2, borderRadius: radius.full, overflow: 'hidden' }}>
                          <View 
                            style={{ 
                              height: '100%', 
                              width: `${percentage}%`, 
                              backgroundColor: colors.accent, 
                              borderRadius: radius.full 
                            }} 
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          </>
        )}

        {/* ── Milestone Badges ── */}
        {showAchievementBadges && (
          <>
            <SectionLabel
              title={i18n.t('profile.milestoneBadges')}
              subtitle={i18n.t('profile.earnedAchievements')}
              style={[styles.sectionLabel, { marginTop: spacing.xl }]}
            />
            <View style={styles.badgesGrid}>
              {milestones.map((milestone) => {
                const iconColor = milestone.unlocked ? colors.violet : colors.textMuted;
                const cardStyle = milestone.unlocked
                  ? { borderColor: colors.violet, borderWidth: 1, backgroundColor: colors.violetGlow }
                  : { borderColor: colors.border, borderWidth: 1, opacity: 0.4, backgroundColor: 'transparent' };

                return (
                  <View
                    key={milestone.id}
                    style={[styles.badgeCard, cardStyle]}
                    testID={`profile.badge.${milestone.id}`}
                  >
                    <View style={[styles.badgeIconCircle, { backgroundColor: milestone.unlocked ? colors.violetGlow : 'transparent' }]}>
                      <Ionicons name={milestone.icon} size={20} color={iconColor} />
                    </View>
                    <View style={styles.badgeInfo}>
                      <Text style={[styles.badgeTitle, { color: milestone.unlocked ? colors.textPrimary : colors.textSecondary }]}>
                        {milestone.title}
                      </Text>
                      <Text style={styles.badgeDesc} numberOfLines={1}>
                        {milestone.description}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        </Animated.View>
      </ScrollView>

      {/* Modal A: Profile Rename Sheet */}
      <Modal
        visible={isRenameVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsRenameVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{i18n.t('profile.editName')}</Text>
              <IconButton
                name="close"
                size={22}
                color={colors.textSecondary}
                onPress={() => setIsRenameVisible(false)}
              />
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>{i18n.t('profile.yourName')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={i18n.t('profile.namePlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={tempName}
                onChangeText={setTempName}
                keyboardAppearance="dark"
                maxLength={30}
              />

              <Pressable
                style={styles.submitBtn}
                onPress={handleRenameSubmit}
                android_ripple={rippleTokens.accent}
              >
                <Text style={styles.submitBtnText}>{i18n.t('profile.saveName')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>



      {/* Modal C: Manual Backup Import/Export Text Dashboard */}
      <Modal
        visible={isBackupPanelVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsBackupPanelVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.backupCard]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{i18n.t('profile.manualPortability')}</Text>
              <IconButton
                name="close"
                size={22}
                color={colors.textSecondary}
                onPress={() => setIsBackupPanelVisible(false)}
              />
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {backupText.length > 0 ? (
                <>
                  <Text style={styles.inputLabel}>{i18n.t('profile.dataPackageGenerated')}</Text>
                  <Text style={styles.backupHelperText}>
                    {i18n.t('profile.copyDataMsg')}
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.codeBox]}
                    value={backupText}
                    multiline
                    editable={false}
                    selectTextOnFocus
                  />
                  <Pressable
                    style={styles.submitBtn}
                    onPress={() => {
                      setIsBackupPanelVisible(false);
                      Alert.alert(i18n.t('profile.copied'), i18n.t('profile.copiedMsg'));
                    }}
                    android_ripple={rippleTokens.accent}
                  >
                    <Text style={styles.submitBtnText}>{i18n.t('profile.done')}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>{i18n.t('profile.pasteDataPayload')}</Text>
                  <Text style={styles.backupHelperText}>
                    {i18n.t('profile.pasteDataMsg')}
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.codeBox, { height: 160 }]}
                    placeholder={i18n.t('profile.pasteDataPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={pastedBackup}
                    onChangeText={setPastedBackup}
                    multiline
                    keyboardAppearance="dark"
                  />
                  <Pressable
                    style={[styles.submitBtn, { backgroundColor: colors.success }]}
                    onPress={handleImportSubmit}
                    android_ripple={rippleTokens.accent}
                  >
                    <Text style={styles.submitBtnText}>{i18n.t('profile.importDataPackage')}</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sync Spinner Overlay */}
      {isSyncing && (
        <Modal transparent visible>
          <View style={styles.spinnerBackdrop}>
            <View style={styles.spinnerCard}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.spinnerVal}>{i18n.t('profile.syncingCloud')}</Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal D: Full Settings Sheet */}
      <Modal
        visible={isSettingsVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          if (settingsView === 'menu') {
            setIsSettingsVisible(false);
          } else if (settingsView === 'developer') {
            setSettingsView('about');
          } else {
            setSettingsView('menu');
          }
        }}
      >
        <View style={[styles.safe, { paddingTop: insets.top }]}>
          {/* Settings Header */}
          <View style={styles.settingsHeader}>
            <Pressable
              onPress={() => {
                if (settingsView === 'menu') {
                  setIsSettingsVisible(false);
                } else if (settingsView === 'developer') {
                  setSettingsView('about');
                } else {
                  setSettingsView('menu');
                }
              }}
              style={styles.settingsBack}
              android_ripple={rippleTokens.borderless}
              accessibilityLabel={settingsView === 'menu' ? 'Close settings' : 'Back to settings menu'}
            >
              <Ionicons name={settingsView === 'menu' ? 'chevron-down' : 'chevron-back'} size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.settingsTitle}>
              {settingsView === 'menu' ? i18n.t('profile.settingsTitle') : 
               settingsView === 'account' ? i18n.t('profile.settingsMenuAccount') :
               settingsView === 'data' ? i18n.t('profile.settingsMenuData') :
               settingsView === 'workout' ? i18n.t('profile.settingsMenuWorkout') :
               settingsView === 'appearance' ? i18n.t('profile.settingsMenuAppearance') :
               settingsView === 'developer' ? i18n.t('profile.crashLogsTitle') :
               i18n.t('profile.settingsMenuAbout')}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.settingsContent}
            showsVerticalScrollIndicator={false}
          >
            {settingsView === 'menu' ? (
              /* ═══════════════════════════════════════════════════
                 MAIN MENU — Category Cards
                 ═══════════════════════════════════════════════════ */
              <View style={{ gap: spacing.md }}>
                {/* Account & Profile */}
                <Pressable
                  onPress={() => setSettingsView('account')}
                  android_ripple={rippleTokens.surface}
                  style={styles.settingsMenuCard}
                >
                  <View style={[styles.settingsMenuIconCircle, { backgroundColor: colors.accent + '18' }]}>
                    <Ionicons name="person-circle-outline" size={22} color={colors.accent} />
                  </View>
                  <View style={styles.settingsMenuTextBlock}>
                    <Text style={styles.settingsMenuTitle}>{i18n.t('profile.settingsMenuAccount')}</Text>
                    <Text style={styles.settingsMenuDesc}>{i18n.t('profile.settingsMenuAccountDesc')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>

                {/* Data Management */}
                <Pressable
                  onPress={() => setSettingsView('data')}
                  android_ripple={rippleTokens.surface}
                  style={styles.settingsMenuCard}
                >
                  <View style={[styles.settingsMenuIconCircle, { backgroundColor: colors.violet + '18' }]}>
                    <Ionicons name="cloud-download-outline" size={22} color={colors.violet} />
                  </View>
                  <View style={styles.settingsMenuTextBlock}>
                    <Text style={styles.settingsMenuTitle}>{i18n.t('profile.settingsMenuData')}</Text>
                    <Text style={styles.settingsMenuDesc}>{i18n.t('profile.settingsMenuDataDesc')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>

                {/* Workout Preferences */}
                <Pressable
                  onPress={() => setSettingsView('workout')}
                  android_ripple={rippleTokens.surface}
                  style={styles.settingsMenuCard}
                >
                  <View style={[styles.settingsMenuIconCircle, { backgroundColor: colors.highlight + '18' }]}>
                    <Ionicons name="barbell-outline" size={22} color={colors.highlight} />
                  </View>
                  <View style={styles.settingsMenuTextBlock}>
                    <Text style={styles.settingsMenuTitle}>{i18n.t('profile.settingsMenuWorkout')}</Text>
                    <Text style={styles.settingsMenuDesc}>{i18n.t('profile.settingsMenuWorkoutDesc')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>

                {/* Appearance & Sound */}
                <Pressable
                  onPress={() => setSettingsView('appearance')}
                  android_ripple={rippleTokens.surface}
                  style={styles.settingsMenuCard}
                >
                  <View style={[styles.settingsMenuIconCircle, { backgroundColor: colors.gold + '18' }]}>
                    <Ionicons name="color-palette-outline" size={22} color={colors.gold} />
                  </View>
                  <View style={styles.settingsMenuTextBlock}>
                    <Text style={styles.settingsMenuTitle}>{i18n.t('profile.settingsMenuAppearance')}</Text>
                    <Text style={styles.settingsMenuDesc}>{i18n.t('profile.settingsMenuAppearanceDesc')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>

                {/* About & More */}
                <Pressable
                  onPress={() => setSettingsView('about')}
                  android_ripple={rippleTokens.surface}
                  style={styles.settingsMenuCard}
                >
                  <View style={[styles.settingsMenuIconCircle, { backgroundColor: colors.textSecondary + '18' }]}>
                    <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
                  </View>
                  <View style={styles.settingsMenuTextBlock}>
                    <Text style={styles.settingsMenuTitle}>{i18n.t('profile.settingsMenuAbout')}</Text>
                    <Text style={styles.settingsMenuDesc}>{i18n.t('profile.settingsMenuAboutDesc')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : settingsView === 'account' ? (
              /* ═══════════════════════════════════════════════════
                 ACCOUNT & PROFILE
                 ═══════════════════════════════════════════════════ */
              <>
                <SectionLabel
                  title={i18n.t('profile.accountSync')}
                  style={styles.sectionLabel}
                />
                <Card padding={spacing.lg}>
                  {/* Account Status Info */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons 
                        name={
                          authMode === 'google' 
                            ? "logo-google" 
                            : authMode === 'local'
                            ? "person-circle-outline"
                            : "eye-off-outline"
                        } 
                        size={22} 
                        color={authMode === 'google' ? colors.success : colors.accent} 
                        style={{ marginRight: spacing.sm }} 
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>
                          {authMode === 'google' 
                            ? i18n.t('profile.googleConnected') 
                            : authMode === 'local'
                            ? i18n.t('profile.localProfile')
                            : i18n.t('profile.guestSession')}
                        </Text>
                        <Text style={styles.settingSubtitle}>
                          {authMode === 'google'
                            ? (googleUser?.email || i18n.t('profile.connectedWithGoogle')) + (googleUser?.accessToken ? '' : i18n.t('profile.sessionExpired'))
                            : authMode === 'local'
                            ? i18n.t('profile.loggedInAs', { name: user?.name || i18n.t('profile.localUser') })
                            : i18n.t('profile.workoutsSavedLocally')}
                        </Text>
                      </View>
                    </View>
                    
                    {authMode === 'guest' || authMode === 'local' ? (
                      <Pressable
                        style={styles.inlineLoginBtn}
                        onPress={handleGoogleWebAuth}
                        android_ripple={rippleTokens.surface}
                      >
                        <Text style={styles.inlineLoginBtnText}>
                          {authMode === 'local' ? i18n.t('profile.linkGoogle') : i18n.t('profile.logIn')}
                        </Text>
                      </Pressable>
                    ) : googleUser && !googleUser.accessToken ? (
                      <Pressable
                        style={[styles.inlineLoginBtn, { backgroundColor: '#FF9F0A' }]}
                        onPress={handleGoogleWebAuth}
                        android_ripple={rippleTokens.surface}
                      >
                        <Text style={[styles.inlineLoginBtnText, { color: '#0D0F14' }]}>{i18n.t('profile.reconnect')}</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.connectedBadge}>
                        <Text style={styles.connectedBadgeText}>{i18n.t('profile.activeStatus')}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.settingDivider} />

                  <Pressable
                    style={styles.settingRow}
                    onPress={() => {
                      setTempName(user?.name || '');
                      setIsRenameVisible(true);
                    }}
                    android_ripple={rippleTokens.surface}
                  >
                    <View style={styles.settingInfo}>
                      <Ionicons name="create-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.editDisplayName')}</Text>
                        <Text style={styles.settingSubtitle}>
                          {i18n.t('profile.changeProfileName')}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>

                  <View style={styles.settingDivider} />

                  {/* Log Out Action */}
                  <Pressable
                    style={styles.settingRow}
                    onPress={handleAppLogoutConfirm}
                    android_ripple={rippleTokens.surface}
                  >
                    <View style={styles.settingInfo}>
                      <Ionicons name="log-out-outline" size={20} color={colors.error} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.settingTitle, { color: colors.error }]}>{i18n.t('profile.logOut')}</Text>
                        <Text style={styles.settingSubtitle}>
                          {i18n.t('profile.logOutDesc')}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                </Card>
              </>
            ) : settingsView === 'data' ? (
              /* ═══════════════════════════════════════════════════
                 DATA MANAGEMENT
                 ═══════════════════════════════════════════════════ */
              <>
                <SectionLabel
                  title={i18n.t('profile.settingsMenuData')}
                  style={styles.sectionLabel}
                />
                <Card padding={spacing.md}>
                  {/* Export row */}
                  <Pressable
                    style={styles.settingRow}
                    onPress={handleExportPress}
                    android_ripple={rippleTokens.surface}
                    accessibilityLabel="Export workouts and settings data"
                  >
                    <View style={styles.settingInfo}>
                      <View style={[styles.backupIconCircle, { backgroundColor: colors.accent + '22' }]}>
                        <Ionicons name="cloud-download-outline" size={20} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.exportData')}</Text>
                        <Text style={styles.settingSubtitle}>
                          {i18n.t('profile.exportDataDesc')}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>

                  <View style={styles.settingDivider} />

                  {/* Import / Restore row */}
                  <Pressable
                    style={styles.settingRow}
                    onPress={handleImportPress}
                    android_ripple={rippleTokens.surface}
                    accessibilityLabel="Import or restore workouts and settings data"
                  >
                    <View style={styles.settingInfo}>
                      <View style={[styles.backupIconCircle, { backgroundColor: colors.violet + '22' }]}>
                        <Ionicons name="folder-open-outline" size={20} color={colors.violet} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.importRestoreData')}</Text>
                        <Text style={styles.settingSubtitle}>
                          {i18n.t('profile.importRestoreDesc')}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>

                  <View style={styles.settingDivider} />

                  {/* Import Strong CSV row */}
                  <Pressable
                    style={styles.settingRow}
                    onPress={handleImportStrongCSV}
                    android_ripple={rippleTokens.surface}
                    testID="profile.importStrongCSV"
                    accessibilityLabel="Import Strong App CSV file"
                  >
                    <View style={styles.settingInfo}>
                      <View style={[styles.backupIconCircle, { backgroundColor: colors.violet + '22' }]}>
                        <Ionicons name="document-attach-outline" size={20} color={colors.violet} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.importStrongCsv')}</Text>
                        <Text style={styles.settingSubtitle}>
                          {i18n.t('profile.importStrongCsvDesc')}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>

                  <View style={styles.settingDivider} />

                  <Pressable
                    onPress={handlePhoneWipeSimulator}
                    style={styles.wipeSimBtn}
                    android_ripple={rippleTokens.surface}
                  >
                    <Ionicons name="refresh" size={14} color={colors.textSecondary} />
                    <Text style={styles.wipeSimBtnText}>{i18n.t('profile.phoneSwitchSim')}</Text>
                  </Pressable>
                </Card>
              </>
            ) : settingsView === 'workout' ? (
              /* ═══════════════════════════════════════════════════
                 WORKOUT PREFERENCES
                 ═══════════════════════════════════════════════════ */
              <>
                <SectionLabel
                  title={i18n.t('profile.workoutPreferences')}
                  style={styles.sectionLabel}
                />
                <Card padding={spacing.lg}>
                  {/* Auto Rest Timer */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons name="alarm-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.autoRestTimer')}</Text>
                        <Text style={styles.settingSubtitle} numberOfLines={2}>
                          {i18n.t('profile.autoRestTimerDesc')}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.togglePill,
                        isAutoTimerEnabled && styles.togglePillActive
                      ]}
                      onPress={() => setIsAutoTimerEnabled(!isAutoTimerEnabled)}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={[
                        styles.togglePillText,
                        isAutoTimerEnabled && styles.togglePillTextActive
                      ]}>
                        {isAutoTimerEnabled ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.settingDivider} />

                  {/* Default Rest Duration Picker */}
                  <Pressable
                    style={styles.settingRow}
                    onPress={() => setIsTimerPickerVisible(true)}
                    android_ripple={rippleTokens.surface}
                    accessibilityLabel="Default Auto-Timer Duration selection"
                  >
                    <View style={styles.settingInfo}>
                      <Ionicons name="hourglass-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.defaultRestDuration')}</Text>
                        <Text style={styles.settingSubtitle}>
                          {i18n.t('profile.defaultRestDurationDesc')}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={{ color: colors.textSecondary, fontSize: font.sizes.sm, fontFamily: font.semibold }}>
                        {defaultRestDuration}s
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </View>
                  </Pressable>

                  <View style={styles.settingDivider} />

                  {/* Progressive Overload */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons name="trending-up-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.progressiveOverload')}</Text>
                        <Text style={styles.settingSubtitle} numberOfLines={2}>
                          {i18n.t('profile.progressiveOverloadDesc')}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.togglePill,
                        isProgressiveOverloadEnabled && styles.togglePillActive
                      ]}
                      onPress={() => setIsProgressiveOverloadEnabled && setIsProgressiveOverloadEnabled(!isProgressiveOverloadEnabled)}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={[
                        styles.togglePillText,
                        isProgressiveOverloadEnabled && styles.togglePillTextActive
                      ]}>
                        {isProgressiveOverloadEnabled ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.settingDivider} />

                  {/* Auto-Finish Set */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons name="checkmark-circle-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.autoFinishSet')}</Text>
                        <Text style={styles.settingSubtitle} numberOfLines={2}>
                          {i18n.t('profile.autoFinishSetDesc')}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.togglePill,
                        isAutoFinishSetEnabled && styles.togglePillActive
                      ]}
                      onPress={() => setIsAutoFinishSetEnabled && setIsAutoFinishSetEnabled(!isAutoFinishSetEnabled)}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={[
                        styles.togglePillText,
                        isAutoFinishSetEnabled && styles.togglePillTextActive
                      ]}>
                        {isAutoFinishSetEnabled ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.settingDivider} />

                  {/* Keyboard Dismiss on Next */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons name="keypad-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.keyboardDismiss')}</Text>
                        <Text style={styles.settingSubtitle} numberOfLines={2}>
                          {i18n.t('profile.keyboardDismissDesc')}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.togglePill,
                        isKeyboardDismissOnNextEnabled && styles.togglePillActive
                      ]}
                      onPress={() => setIsKeyboardDismissOnNextEnabled && setIsKeyboardDismissOnNextEnabled(!isKeyboardDismissOnNextEnabled)}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={[
                        styles.togglePillText,
                        isKeyboardDismissOnNextEnabled && styles.togglePillTextActive
                      ]}>
                        {isKeyboardDismissOnNextEnabled ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.settingDivider} />

                  {/* RPE / RIR Toggle */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons name="speedometer-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.rpeRirMode')}</Text>
                        <Text style={styles.settingSubtitle} numberOfLines={2}>
                          {isRpeMode ? i18n.t('profile.showingRpe') : i18n.t('profile.showingRir')}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.togglePill,
                        styles.togglePillSegmented,
                      ]}
                      onPress={() => setIsRpeMode && setIsRpeMode(!isRpeMode)}
                      android_ripple={rippleTokens.surface}
                    >
                      <View style={[
                        styles.togglePillSegment,
                        isRpeMode && styles.togglePillSegmentActive,
                      ]}>
                        <Text style={[
                          styles.togglePillText,
                          isRpeMode && styles.togglePillTextActive,
                        ]}>
                          RPE
                        </Text>
                      </View>
                      <View style={[
                        styles.togglePillSegment,
                        !isRpeMode && styles.togglePillSegmentActive,
                      ]}>
                        <Text style={[
                          styles.togglePillText,
                          !isRpeMode && styles.togglePillTextActive,
                        ]}>
                          RIR
                        </Text>
                      </View>
                    </Pressable>
                  </View>

                  <View style={styles.settingDivider} />

                  {/* Exercise Display Language Toggle */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons name="language-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('extras.exerciseDisplayLang')}</Text>
                        <Text style={styles.settingSubtitle} numberOfLines={2}>
                          {i18n.t('extras.exerciseDisplayLangDesc')}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.surface2,
                        borderRadius: radius.xs,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingVertical: spacing.xs + 2,
                        paddingHorizontal: spacing.md,
                        columnGap: spacing.xs,
                        marginLeft: spacing.md,
                      }}
                      onPress={() => setExerciseNameLanguage && setExerciseNameLanguage(exerciseNameLanguage === 'en' ? 'he' : 'en')}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={{
                        color: colors.accent,
                        fontSize: font.sizes.sm,
                        fontFamily: font.bold,
                        letterSpacing: 0.5,
                      }}>
                        {exerciseNameLanguage === 'en' ? 'ENG' : 'HEB'}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                    </Pressable>
                  </View>

                  <View style={styles.settingDivider} />

                  {/* Features & Modules Toggles */}
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={[styles.settingTitle, { fontSize: font.sizes.md, fontFamily: font.bold, marginBottom: spacing.xs, color: colors.textSecondary }]}>{i18n.t('profile.enabledModules')}</Text>
                    
                    {/* Plate Calculator */}
                    <View style={styles.settingRow}>
                      <View style={styles.settingInfo}>
                        <Ionicons name="disc-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.settingTitle}>{i18n.t('profile.plateCalculator')}</Text>
                          <Text style={styles.settingSubtitle}>{i18n.t('profile.plateCalculatorDesc')}</Text>
                        </View>
                      </View>
                      <Pressable
                        style={[
                          styles.togglePill,
                          isPlateCalculatorEnabled && styles.togglePillActive
                        ]}
                        onPress={() => setIsPlateCalculatorEnabled && setIsPlateCalculatorEnabled(!isPlateCalculatorEnabled)}
                        android_ripple={rippleTokens.surface}
                      >
                        <Text style={[
                          styles.togglePillText,
                          isPlateCalculatorEnabled && styles.togglePillTextActive
                        ]}>
                          {isPlateCalculatorEnabled ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.settingDivider} />

                    {/* Training Programs */}
                    <View style={styles.settingRow}>
                      <View style={styles.settingInfo}>
                        <Ionicons name="ribbon-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.settingTitle}>{i18n.t('profile.trainingPrograms')}</Text>
                          <Text style={styles.settingSubtitle}>{i18n.t('profile.trainingProgramsDesc')}</Text>
                        </View>
                      </View>
                      <Pressable
                        style={[
                          styles.togglePill,
                          isProgramsEnabled && styles.togglePillActive
                        ]}
                        onPress={() => setIsProgramsEnabled && setIsProgramsEnabled(!isProgramsEnabled)}
                        android_ripple={rippleTokens.surface}
                      >
                        <Text style={[
                          styles.togglePillText,
                          isProgramsEnabled && styles.togglePillTextActive
                        ]}>
                          {isProgramsEnabled ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.settingDivider} />

                    {/* Workout History Tab */}
                    <View style={styles.settingRow}>
                      <View style={styles.settingInfo}>
                        <Ionicons name="time-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.settingTitle}>{i18n.t('profile.workoutHistoryTab')}</Text>
                          <Text style={styles.settingSubtitle}>{i18n.t('profile.workoutHistoryTabDesc')}</Text>
                        </View>
                      </View>
                      <Pressable
                        style={[
                          styles.togglePill,
                          isHistoryEnabled && styles.togglePillActive
                        ]}
                        onPress={() => setIsHistoryEnabled && setIsHistoryEnabled(!isHistoryEnabled)}
                        android_ripple={rippleTokens.surface}
                      >
                        <Text style={[
                          styles.togglePillText,
                          isHistoryEnabled && styles.togglePillTextActive
                        ]}>
                          {isHistoryEnabled ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.settingDivider} />

                    {/* Muscle Map Tab */}
                    <View style={styles.settingRow}>
                      <View style={styles.settingInfo}>
                        <Ionicons name="body-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.settingTitle}>{i18n.t('profile.muscleMapTab')}</Text>
                          <Text style={styles.settingSubtitle}>{i18n.t('profile.muscleMapTabDesc')}</Text>
                        </View>
                      </View>
                      <Pressable
                        style={[
                          styles.togglePill,
                          isMusclesEnabled && styles.togglePillActive
                        ]}
                        onPress={() => setIsMusclesEnabled && setIsMusclesEnabled(!isMusclesEnabled)}
                        android_ripple={rippleTokens.surface}
                      >
                        <Text style={[
                          styles.togglePillText,
                          isMusclesEnabled && styles.togglePillTextActive
                        ]}>
                          {isMusclesEnabled ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </Card>
              </>
            ) : settingsView === 'appearance' ? (
              /* ═══════════════════════════════════════════════════
                 APPEARANCE & SOUND
                 ═══════════════════════════════════════════════════ */
              <>
                <SectionLabel
                  title={i18n.t('profile.appearanceInteraction')}
                  style={styles.sectionLabel}
                />
                <Card padding={spacing.lg}>
                  {/* Language Toggle */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons name="language-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.settingTitle, { fontFamily: I18nManager.isRTL ? 'Rubik_600SemiBold' : font.semibold }]}>{i18n.t('settings.language')}</Text>
                        <Text style={[styles.settingSubtitle, { fontFamily: I18nManager.isRTL ? 'Rubik_400Regular' : font.regular }]} numberOfLines={1}>
                          {I18nManager.isRTL ? i18n.t('settings.hebrew') : i18n.t('settings.english')}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={styles.togglePill}
                      onPress={() => {
                        const newLocale = I18nManager.isRTL ? 'en' : 'he';
                        switchLanguage(newLocale);
                      }}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={[styles.togglePillText, { fontFamily: I18nManager.isRTL ? 'Rubik_700Bold' : font.bold }]}>
                        {I18nManager.isRTL ? i18n.t('settings.english') : i18n.t('settings.hebrew')}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.settingDivider} />

                  {/* Global Animation Speed (Smooth Draggable Slider) */}
                  <AnimationSpeedSlider
                    animationSpeed={animationSpeed}
                    setAnimationSpeed={setAnimationSpeed}
                  />

                  <View style={styles.settingDivider} />

                  {/* Volume Slider Row */}
                  <VolumeSlider
                    soundVolume={soundVolume}
                    setSoundVolume={setSoundVolume || (() => {})}
                    soundSetCompleted={soundSetCompleted}
                  />

                  <View style={styles.settingDivider} />

                  {/* Sound dropdowns */}
                  <Pressable
                    style={styles.settingRow}
                    onPress={() => {
                      setActiveSoundTrigger('setChecked');
                      setIsSoundSelectorVisible(true);
                    }}
                    android_ripple={rippleTokens.surface}
                    accessibilityLabel="Set Completed sound trigger selection"
                  >
                    <View style={styles.settingInfo}>
                      <Ionicons name="volume-high-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.setCompleted')}</Text>
                        <Text style={styles.settingSubtitle}>
                          {i18n.t('profile.setCompletedDesc')}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={{ color: colors.textSecondary, fontSize: font.sizes.sm, fontFamily: font.semibold }}>
                        {formatSoundName(soundSetCompleted)}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </View>
                  </Pressable>

                  <View style={styles.settingDivider} />

                  <Pressable
                    style={styles.settingRow}
                    onPress={() => {
                      setActiveSoundTrigger('workoutCompleted');
                      setIsSoundSelectorVisible(true);
                    }}
                    android_ripple={rippleTokens.surface}
                    accessibilityLabel="Workout Finished sound trigger selection"
                  >
                    <View style={styles.settingInfo}>
                      <Ionicons name="trophy-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.workoutFinished')}</Text>
                        <Text style={styles.settingSubtitle}>
                          {i18n.t('profile.workoutFinishedDesc')}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={{ color: colors.textSecondary, fontSize: font.sizes.sm, fontFamily: font.semibold }}>
                        {formatSoundName(soundWorkoutFinished)}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </View>
                  </Pressable>

                  <View style={styles.settingDivider} />

                  <Pressable
                    style={styles.settingRow}
                    onPress={() => {
                      setActiveSoundTrigger('timerCompleted');
                      setIsSoundSelectorVisible(true);
                    }}
                    android_ripple={rippleTokens.surface}
                    accessibilityLabel="Timer Completed sound trigger selection"
                  >
                    <View style={styles.settingInfo}>
                      <Ionicons name="alarm-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.timerCompleted')}</Text>
                        <Text style={styles.settingSubtitle}>
                          {i18n.t('profile.timerCompletedDesc')}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={{ color: colors.textSecondary, fontSize: font.sizes.sm, fontFamily: font.semibold }}>
                        {formatSoundName(soundTimerCompleted)}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </View>
                  </Pressable>

                  <View style={styles.settingDivider} />

                  {/* Layout visibility toggles header */}
                  <Text style={[styles.settingTitle, { fontSize: font.sizes.md, fontFamily: font.bold, marginTop: spacing.md, marginBottom: spacing.xs, color: colors.textSecondary }]}>{i18n.t('profile.visibleDashboardWidgets')}</Text>

                  {/* Summary Data Widgets */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons name="stats-chart-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.summaryDataWidgets')}</Text>
                        <Text style={styles.settingSubtitle}>{i18n.t('profile.summaryDataWidgetsDesc')}</Text>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.togglePill,
                        showSummaryWidgets && styles.togglePillActive
                      ]}
                      onPress={() => setShowSummaryWidgets && setShowSummaryWidgets(!showSummaryWidgets)}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={[
                        styles.togglePillText,
                        showSummaryWidgets && styles.togglePillTextActive
                      ]}>
                        {showSummaryWidgets ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.settingDivider} />

                  {/* Weekly Tonnage */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons name="barbell-outline" size={20} color={colors.highlight} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.weeklyTonnage')}</Text>
                        <Text style={styles.settingSubtitle}>{i18n.t('profile.weeklyTonnageDesc')}</Text>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.togglePill,
                        showWeeklyTonnage && styles.togglePillActive
                      ]}
                      onPress={() => setShowWeeklyTonnage && setShowWeeklyTonnage(!showWeeklyTonnage)}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={[
                        styles.togglePillText,
                        showWeeklyTonnage && styles.togglePillTextActive
                      ]}>
                        {showWeeklyTonnage ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.settingDivider} />

                  {/* Workouts Chart */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons name="trending-up-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.workoutsChart')}</Text>
                        <Text style={styles.settingSubtitle}>{i18n.t('profile.workoutsChartDesc')}</Text>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.togglePill,
                        showWorkoutsChart && styles.togglePillActive
                      ]}
                      onPress={() => setShowWorkoutsChart && setShowWorkoutsChart(!showWorkoutsChart)}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={[
                        styles.togglePillText,
                        showWorkoutsChart && styles.togglePillTextActive
                      ]}>
                        {showWorkoutsChart ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.settingDivider} />

                  {/* Personal Records */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons name="trophy-outline" size={20} color={colors.gold} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.prSection')}</Text>
                        <Text style={styles.settingSubtitle}>{i18n.t('profile.prSectionDesc')}</Text>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.togglePill,
                        showHighlights && styles.togglePillActive
                      ]}
                      onPress={() => setShowHighlights && setShowHighlights(!showHighlights)}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={[
                        styles.togglePillText,
                        showHighlights && styles.togglePillTextActive
                      ]}>
                        {showHighlights ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.settingDivider} />

                  {/* Routine Folders */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons name="folder-outline" size={20} color={colors.violet} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>{i18n.t('profile.routineFolders')}</Text>
                        <Text style={styles.settingSubtitle}>{i18n.t('profile.routineFoldersDesc')}</Text>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.togglePill,
                        enableRoutineFolders && styles.togglePillActive
                      ]}
                      onPress={() => setEnableRoutineFolders && setEnableRoutineFolders(!enableRoutineFolders)}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={[
                        styles.togglePillText,
                        enableRoutineFolders && styles.togglePillTextActive
                      ]}>
                        {enableRoutineFolders ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              </>
            ) : settingsView === 'developer' ? (
              /* ═══════════════════════════════════════════════════
                 CRASH LOGS DEVELOPER SUBVIEW
                 ═══════════════════════════════════════════════════ */
              <DeveloperCrashLogsView onBack={() => setSettingsView('about')} />
            ) : (
              /* ═══════════════════════════════════════════════════
                 ABOUT & DEVELOPER OPTIONS
                 ═══════════════════════════════════════════════════ */
              <>
                {/* ── ABOUT ────────────────────────────────────── */}
                <SectionLabel
                  title={i18n.t('profile.about')}
                  style={styles.sectionLabel}
                />
                <Card padding={spacing.lg}>
                  <Pressable
                    onPress={handleVersionPress}
                    style={styles.aboutRow}
                    android_ripple={rippleTokens.surface}
                  >
                    <View style={[styles.aboutIconBox, { backgroundColor: colors.accent + '22' }]}>
                      <Ionicons name="barbell-outline" size={20} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.aboutAppName}>strongerN</Text>
                      <Text style={styles.aboutVersion}>{i18n.t('profile.version')}</Text>
                    </View>
                  </Pressable>
                </Card>

                {/* ── DEVELOPER OPTIONS (Conditionally Shown) ──── */}
                {developerToolsUnlocked && (
                  <>
                    <SectionLabel
                      title={i18n.t('profile.developerOptions')}
                      subtitle={i18n.t('profile.developerOptionsSub')}
                      style={[styles.sectionLabel, { marginTop: spacing.xl }]}
                    />
                    <Card padding={spacing.lg}>
                      <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                          <Ionicons name="construct-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>{i18n.t('profile.enableDevTools')}</Text>
                            <Text style={styles.settingSubtitle}>
                              {i18n.t('profile.enableDevToolsDesc')}
                            </Text>
                          </View>
                        </View>
                        <Pressable
                          style={[
                            styles.togglePill,
                            isDeveloperModeEnabled && styles.togglePillActive
                          ]}
                          onPress={() => setIsDeveloperModeEnabled(!isDeveloperModeEnabled)}
                          android_ripple={rippleTokens.surface}
                        >
                          <Text style={[
                            styles.togglePillText,
                            isDeveloperModeEnabled && styles.togglePillTextActive
                          ]}>
                            {isDeveloperModeEnabled ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                          </Text>
                        </Pressable>
                      </View>

                      {isDeveloperModeEnabled && (
                        <>
                          <View style={styles.settingDivider} />
                          <Text style={[styles.settingSubtitle, { marginVertical: spacing.md, color: colors.textSecondary }]}>
                            {i18n.t('profile.devSettingsDesc')}
                          </Text>
                          {authMode === 'guest' ? (
                            <Pressable
                              style={styles.settingRow}
                              onPress={handleLoadDemoData}
                              android_ripple={rippleTokens.surface}
                              accessibilityLabel="Load demo database"
                            >
                              <View style={styles.settingInfo}>
                                <Ionicons name="code-slash-outline" size={20} color={colors.highlight} style={{ marginRight: spacing.sm }} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.settingTitle, { color: colors.textSecondary }]}>{i18n.t('profile.loadDemoDbSetting')}</Text>
                                  <Text style={styles.settingSubtitle}>
                                    {i18n.t('profile.loadDemoDbDesc')}
                                  </Text>
                                </View>
                              </View>
                              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                            </Pressable>
                          ) : (
                            <View style={[styles.settingRow, { opacity: 0.45 }]}>
                              <View style={styles.settingInfo}>
                                <Ionicons name="code-slash-outline" size={20} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.settingTitle, { color: colors.textMuted }]}>{i18n.t('profile.loadDemoDbSetting')}</Text>
                                  <Text style={styles.settingSubtitle}>
                                    {i18n.t('profile.onlyGuestAccounts')}
                                  </Text>
                                </View>
                              </View>
                              <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
                            </View>
                          )}

                          <View style={styles.settingDivider} />

                          {/* Theme selection UI */}
                          <Text style={[styles.settingTitle, { fontSize: font.sizes.md, fontFamily: font.bold, marginTop: spacing.md, marginBottom: spacing.xs, color: colors.textSecondary }]}>
                            {i18n.t('profile.appThemeColor')}
                          </Text>
                          <Text style={[styles.settingSubtitle, { marginBottom: spacing.md }]}>
                            {i18n.t('profile.changeThemeColor')}
                          </Text>

                          <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md, flexWrap: 'wrap' }}>
                            {[
                              { id: 'default', label: i18n.t('profile.defaultColor'), accent: '#4F8EF7', preview: ['#4F8EF7', '#38BDF8', '#161B24'] },
                              { id: 'purple', label: i18n.t('profile.purpleColor'), accent: '#7C5CFC', preview: ['#7C5CFC', '#A855F7', '#120E1A'] },
                              { id: 'black-white', label: i18n.t('profile.monoColor'), accent: '#FFFFFF', preview: ['#FFFFFF', '#E2E8F0', '#0D0D0D'] },
                              { id: 'emerald', label: i18n.t('profile.emeraldColor'), accent: '#22D97A', preview: ['#22D97A', '#34D399', '#0C120E'] },
                              { id: 'crimson', label: i18n.t('profile.crimsonColor'), accent: '#EF4444', preview: ['#EF4444', '#F87171', '#140A0C'] },
                              { id: 'custom', label: i18n.t('profile.customColor'), accent: customAccentColor, preview: [customAccentColor, customAccentColor, '#161B24'] },
                            ].map((t) => {
                              const isSelected = appTheme === t.id;
                              return (
                                <Pressable
                                  key={t.id}
                                  style={[
                                    styles.themeCard,
                                    { minWidth: '29%', flex: 1 },
                                    isSelected && { borderColor: t.accent, borderWidth: 2 }
                                  ]}
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    if (setAppTheme) setAppTheme(t.id);
                                  }}
                                  android_ripple={rippleTokens.surface}
                                >
                                  <View style={{ flexDirection: 'row', gap: 4, marginBottom: spacing.xs }}>
                                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.preview[0] }} />
                                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.preview[1] }} />
                                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.preview[2], borderColor: colors.border, borderWidth: 1 }} />
                                  </View>
                                  <Text style={[
                                    styles.themeCardLabel,
                                    isSelected && { color: t.accent, fontFamily: font.bold }
                                  ]}>
                                    {t.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          {/* Custom Theme Color Picker Input and Presets */}
                          {appTheme === 'custom' && (
                            <View style={{ backgroundColor: colors.surfaceHigh, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md }}>
                              <Text style={[styles.settingTitle, { fontSize: font.sizes.sm, fontFamily: font.semibold, color: colors.textSecondary, marginBottom: spacing.sm }]}>
                                {i18n.t('profile.configureCustomColor')}
                              </Text>

                              {/* Quick color preset selector */}
                              <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, flexWrap: 'wrap' }}>
                                {[
                                  { label: i18n.t('profile.emeraldColor'), value: '#10B981' },
                                  { label: i18n.t('profile.sunsetColor'), value: '#F97316' },
                                  { label: i18n.t('profile.hotPinkColor'), value: '#EC4899' },
                                  { label: i18n.t('profile.crimsonColor'), value: '#EF4444' },
                                  { label: i18n.t('profile.yellowColor'), value: '#EAB308' },
                                ].map((preset) => (
                                  <Pressable
                                    key={preset.value}
                                    style={[styles.colorPresetItem, { borderColor: customAccentColor === preset.value ? preset.value : 'transparent' }]}
                                    onPress={() => {
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                      if (setCustomAccentColor) setCustomAccentColor(preset.value);
                                    }}
                                    android_ripple={rippleTokens.surface}
                                  >
                                    <View style={[styles.colorPresetDot, { backgroundColor: preset.value }]} />
                                    <Text style={styles.colorPresetLabel}>
                                      {preset.label}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>

                              {/* Visual Color Picker Grid */}
                              <Text style={[styles.settingTitle, { fontSize: font.sizes.xs, fontFamily: font.semibold, color: colors.textSecondary, marginBottom: spacing.sm }]}>
                                {i18n.t('profile.pickColor')}
                              </Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
                                {[
                                  '#4F8EF7', '#38BDF8', '#06B6D4', '#10B981',
                                  '#22C55E', '#84CC16', '#EAB308', '#F59E0B',
                                  '#F97316', '#EF4444', '#EC4899', '#D946EF',
                                  '#A855F7', '#7C5CFC', '#6366F1', '#8B5CF6',
                                  '#F43F5E', '#E11D48', '#BE123C', '#9F1239',
                                  '#FFFFFF', '#E2E8F0', '#94A3B8', '#64748B',
                                ].map((color) => {
                                  const isSelected = customAccentColor === color;
                                  return (
                                    <Pressable
                                      key={color}
                                      style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 8,
                                        backgroundColor: color,
                                        borderWidth: isSelected ? 3 : 1,
                                        borderColor: isSelected ? colors.textPrimary : colors.border,
                                      }}
                                      onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        if (setCustomAccentColor) setCustomAccentColor(color);
                                      }}
                                      android_ripple={rippleTokens.borderless}
                                    />
                                  );
                                })}
                              </View>

                              {/* Hex Input (collapsible) */}
                              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                                <TextInput
                                  style={styles.hexInput}
                                  placeholder={i18n.t('profile.hexPlaceholder')}
                                  placeholderTextColor={colors.textMuted}
                                  value={customAccentColor}
                                  onChangeText={(text) => {
                                    const cleanHex = text.replace(/[^#0-9A-Fa-f]/g, '');
                                    if (setCustomAccentColor) {
                                      setCustomAccentColor(cleanHex);
                                    }
                                  }}
                                  maxLength={7}
                                />
                                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: customAccentColor.startsWith('#') && customAccentColor.length === 7 ? customAccentColor : colors.accent, borderColor: colors.border, borderWidth: 1 }} />
                              </View>
                            </View>
                          )}

                          {/* Advanced Theme Overrides */}
                          <Text style={[styles.settingTitle, { fontSize: font.sizes.md, fontFamily: font.bold, marginTop: spacing.md, marginBottom: spacing.xs, color: colors.textSecondary }]}>
                            {i18n.t('profile.advancedColorCustomization')}
                          </Text>
                          <Text style={[styles.settingSubtitle, { marginBottom: spacing.md }]}>
                            {i18n.t('profile.advancedColorDesc')}
                          </Text>

                          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
                            {[
                              { label: i18n.t('profile.backgroundColor'), key: 'bg', defaultVal: '#0D0F14', presets: ['#0D0F14', '#000000', '#0A0E17', '#121212'] },
                              { label: i18n.t('profile.cardSurfaceColor'), key: 'surface', defaultVal: '#161B24', presets: ['#161B24', '#1F2937', '#080808', '#1A1A1A'] },
                              { label: i18n.t('profile.borderColor'), key: 'border', defaultVal: '#252D3A', presets: ['#252D3A', '#334155', '#1C2330', '#2E2E2E'] },
                              { label: i18n.t('profile.primaryTextColor'), key: 'textPrimary', defaultVal: '#EEF1F6', presets: ['#EEF1F6', '#FFFFFF', '#D0D5DD', '#E0E0E0'] },
                              { label: i18n.t('profile.secondaryTextColor'), key: 'textSecondary', defaultVal: '#8B95A5', presets: ['#8B95A5', '#94A3B8', '#4E5A6E', '#64748B'] },
                            ].map((overrideItem) => {
                              const currentVal = (themeOverrides && themeOverrides[overrideItem.key]) || overrideItem.defaultVal;
                              return (
                                <View key={overrideItem.key} style={{ backgroundColor: colors.surfaceHigh, padding: spacing.sm, borderRadius: radius.md }}>
                                  <Text style={{ color: colors.textPrimary, fontSize: font.sizes.sm, fontFamily: font.semibold, marginBottom: 6 }}>
                                    {overrideItem.label}
                                  </Text>
                                  
                                  {/* Quick Presets */}
                                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                                    {overrideItem.presets.map((presetColor) => (
                                      <Pressable
                                        key={presetColor}
                                        style={{
                                          width: 24,
                                          height: 24,
                                          borderRadius: 12,
                                          backgroundColor: presetColor,
                                          borderWidth: 1.5,
                                          borderColor: currentVal.toLowerCase() === presetColor.toLowerCase() ? colors.accent : colors.border,
                                        }}
                                        onPress={() => {
                                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                          if (onUpdateThemeOverrides) {
                                            onUpdateThemeOverrides({ [overrideItem.key]: presetColor });
                                          }
                                        }}
                                        android_ripple={rippleTokens.surface}
                                      />
                                    ))}
                                  </View>

                                  {/* Manual Input */}
                                  <ThemeOverrideInput overrideKey={overrideItem.key} defaultVal={overrideItem.defaultVal} themeOverrides={themeOverrides} onUpdateThemeOverrides={onUpdateThemeOverrides} />
                                  <View style={{ display: 'none' }}>
                                    <TextInput
                                      style={styles.hexInputSmall}
                                      placeholder={i18n.t('profile.hexCodePlaceholder', { code: overrideItem.defaultVal })}
                                      placeholderTextColor={colors.textMuted}
                                      value={themeOverrides && themeOverrides[overrideItem.key] ? themeOverrides[overrideItem.key] : ''}
                                      onChangeText={(text) => {
                                        const cleanHex = text.replace(/[^#0-9A-Fa-f]/g, '');
                                        if (onUpdateThemeOverrides) {
                                          onUpdateThemeOverrides({ [overrideItem.key]: cleanHex });
                                        }
                                      }}
                                      maxLength={7}
                                    />
                                    <View
                                      style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 14,
                                        backgroundColor: currentVal.startsWith('#') && currentVal.length === 7 ? currentVal : overrideItem.defaultVal,
                                        borderColor: colors.border,
                                        borderWidth: 1,
                                      }}
                                    />
                                  </View>
                                </View>
                              );
                            })}
                          </View>

                          {/* Reset Theme Button */}
                          <Pressable
                            style={({ pressed }) => [
                              {
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: colors.error + '15',
                                borderColor: colors.error + '44',
                                borderWidth: 1,
                                paddingVertical: spacing.md,
                                borderRadius: radius.md,
                                marginTop: spacing.md,
                                opacity: pressed ? 0.8 : 1,
                              }
                            ]}
                            onPress={() => {
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              Alert.alert(
                                i18n.t('profile.resetTheme'),
                                i18n.t('profile.resetThemeMsg'),
                                [
                                  { text: i18n.t('common.cancel'), style: 'cancel' },
                                  {
                                    text: i18n.t('common.reset'),
                                    style: 'destructive',
                                    onPress: () => {
                                      if (onResetTheme) onResetTheme();
                                    },
                                  },
                                ]
                              );
                            }}
                            android_ripple={{ color: colors.error + '25', borderless: false }}
                          >
                            <Ionicons name="refresh-outline" size={18} color={colors.error} style={{ marginRight: spacing.sm }} />
                            <Text style={{ color: colors.error, fontFamily: font.bold, fontSize: font.sizes.base }}>
                              {i18n.t('profile.resetThemeToDefault')}
                            </Text>
                          </Pressable>
                        </>
                      )}
                    </Card>

                    {isDeveloperModeEnabled && (
                      <>
                        <SectionLabel
                          title={i18n.t('profile.developerSettings')}
                          subtitle={i18n.t('profile.developerSettingsSub')}
                          style={[styles.sectionLabel, { marginTop: spacing.xl }]}
                        />
                        <Card padding={spacing.lg}>
                          {/* Wearable Heart Rate Sync */}
                          <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                              <Ionicons name="pulse-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.settingTitle}>{i18n.t('profile.wearableHrSync')}</Text>
                                <Text style={styles.settingSubtitle} numberOfLines={2}>
                                  {i18n.t('profile.wearableHrSyncDesc')}
                                </Text>
                              </View>
                            </View>
                            <Pressable
                              style={[
                                styles.togglePill,
                                isLiveHeartRateEnabled && styles.togglePillActive
                              ]}
                              onPress={() => setIsLiveHeartRateEnabled(!isLiveHeartRateEnabled)}
                              android_ripple={rippleTokens.surface}
                            >
                              <Text style={[
                                styles.togglePillText,
                                isLiveHeartRateEnabled && styles.togglePillTextActive
                              ]}>
                                {isLiveHeartRateEnabled ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                              </Text>
                            </Pressable>
                          </View>

                          <View style={styles.settingDivider} />

                          {/* Achievement Badges */}
                          <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                              <Ionicons name="trophy-outline" size={20} color={colors.violet} style={{ marginRight: spacing.sm }} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.settingTitle}>{i18n.t('profile.achievementBadges')}</Text>
                                <Text style={styles.settingSubtitle}>{i18n.t('profile.achievementBadgesDesc')}</Text>
                              </View>
                            </View>
                            <Pressable
                              style={[
                                styles.togglePill,
                                showAchievementBadges && styles.togglePillActive
                              ]}
                              onPress={() => setShowAchievementBadges && setShowAchievementBadges(!showAchievementBadges)}
                              android_ripple={rippleTokens.surface}
                            >
                              <Text style={[
                                styles.togglePillText,
                                showAchievementBadges && styles.togglePillTextActive
                              ]}>
                                {showAchievementBadges ? i18n.t('extras.onLabel') : i18n.t('extras.offLabel')}
                              </Text>
                            </Pressable>
                          </View>

                          <View style={styles.settingDivider} />

                          {/* Diagnostic Data Viewer */}
                          <Pressable
                            style={styles.settingRow}
                            onPress={async () => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              const [
                                { loadAuthState },
                                { getSecureItem }
                              ] = await Promise.all([
                                import('../utils/authStore'),
                                import('../utils/secureStore')
                              ]);
                              const [savedAuth, secureToken] = await Promise.all([
                                loadAuthState(),
                                getSecureItem('google_oauth_token')
                              ]);
                              Alert.alert(
                                i18n.t('profile.inspectSession'),
                                `[Active Profile State]\n` +
                                `• Name: ${user?.name || 'N/A'}\n` +
                                `• Avatar: ${user?.avatarUri ? 'Present' : 'N/A'}\n` +
                                `• Total Workouts: ${sessions?.length ?? 0}\n\n` +
                                `[Active Google User]\n` +
                                `• Name: ${googleUser?.name || 'N/A'}\n` +
                                `• Email: ${googleUser?.email || 'N/A'}\n` +
                                `• Secure Token: ${secureToken ? 'Loaded (Stored Securely)' : 'Not Found'}\n\n` +
                                `[Saved Auth State (DB)]\n` +
                                `• Auth Mode: ${savedAuth?.authMode || 'N/A'}\n` +
                                `• Local User: ${savedAuth?.localUsername || 'N/A'}\n` +
                                `• Google Prof: ${savedAuth?.googleProfile ? `${savedAuth.googleProfile.name} (${savedAuth.googleProfile.email})` : 'N/A'}`
                              );
                            }}
                            android_ripple={rippleTokens.surface}
                          >
                            <View style={styles.settingInfo}>
                              <Ionicons name="bug-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.settingTitle}>{i18n.t('profile.inspectSessionData')}</Text>
                                <Text style={styles.settingSubtitle}>
                                  {i18n.t('profile.inspectSessionDataDesc')}
                                </Text>
                              </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                          </Pressable>

                          <View style={styles.settingDivider} />

                          {/* Trigger Test Error */}
                          <Pressable
                            style={styles.settingRow}
                            onPress={() => {
                              throw new Error('Test Crash Log Triggered by Developer');
                            }}
                            android_ripple={rippleTokens.surface}
                          >
                            <View style={styles.settingInfo}>
                              <Ionicons name="alert-circle-outline" size={20} color={colors.error} style={{ marginRight: spacing.sm }} />
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.settingTitle, { color: colors.error }]}>{i18n.t('profile.triggerTestError')}</Text>
                                <Text style={styles.settingSubtitle}>
                                  {i18n.t('profile.triggerTestErrorDesc')}
                                </Text>
                              </View>
                            </View>
                          </Pressable>

                          <View style={styles.settingDivider} />

                          {/* View Crash Logs */}
                          <Pressable
                            style={styles.settingRow}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              setSettingsView('developer');
                            }}
                            android_ripple={rippleTokens.surface}
                          >
                            <View style={styles.settingInfo}>
                              <Ionicons name="list-outline" size={20} color={colors.violet} style={{ marginRight: spacing.sm }} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.settingTitle}>{i18n.t('profile.viewCrashLogs')}</Text>
                                <Text style={styles.settingSubtitle}>
                                  {i18n.t('profile.viewCrashLogsDesc')}
                                </Text>
                              </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                          </Pressable>
                        </Card>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Sound Selector Bottom Sheet Modal */}
      <Modal
        visible={isSoundSelectorVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsSoundSelectorVisible(false)}
      >
        <Pressable 
          style={styles.bottomSheetBackdrop} 
          onPress={() => setIsSoundSelectorVisible(false)}
        >
          <Pressable 
            style={styles.bottomSheetContainer}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.bottomSheetDragIndicator} />
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>{i18n.t('profile.selectSoundEffect')}</Text>
              <Text style={styles.bottomSheetSubtitle}>
                {activeSoundTrigger === 'setChecked' && i18n.t('profile.chooseSoundSet')}
                {activeSoundTrigger === 'workoutCompleted' && i18n.t('profile.chooseSoundWorkout')}
                {activeSoundTrigger === 'timerCompleted' && i18n.t('profile.chooseSoundTimer')}
              </Text>
            </View>

            <View style={styles.bottomSheetOptions}>
              {([...(['chime', 'beep', 'fanfare', 'bell1', 'bell2', 'boxing-bell', 'mute'] as const), ...customSounds.map(s => s.id)]).map((soundKey) => {
                let isSelected = false;
                if (activeSoundTrigger === 'setChecked' && soundSetCompleted === soundKey) isSelected = true;
                if (activeSoundTrigger === 'workoutCompleted' && soundWorkoutFinished === soundKey) isSelected = true;
                if (activeSoundTrigger === 'timerCompleted' && soundTimerCompleted === soundKey) isSelected = true;

                const isCustom = !['chime', 'beep', 'fanfare', 'bell1', 'bell2', 'boxing-bell', 'mute'].includes(soundKey);

                let iconName: any = 'musical-notes-outline';
                if (soundKey === 'chime') iconName = 'musical-notes-outline';
                else if (soundKey === 'beep') iconName = 'notifications-outline';
                else if (soundKey === 'fanfare') iconName = 'trophy-outline';
                else if (soundKey === 'bell1') iconName = 'notifications-circle-outline';
                else if (soundKey === 'bell2') iconName = 'notifications-circle-outline';
                else if (soundKey === 'boxing-bell') iconName = 'alarm-outline';
                else if (soundKey === 'mute') iconName = 'volume-mute-outline';
                else iconName = 'document-attach-outline';

                return (
                  <Pressable
                    key={soundKey}
                    style={[
                      styles.soundOptionRow,
                      isSelected && styles.soundOptionRowActive
                    ]}
                    onPress={() => handleSelectSound(soundKey)}
                    android_ripple={rippleTokens.surface}
                  >
                    <View style={styles.soundOptionLeft}>
                      <View style={[
                        styles.soundOptionIconCircle,
                        isSelected ? { backgroundColor: colors.accent + '22' } : { backgroundColor: colors.surfaceHigh }
                      ]}>
                        <Ionicons 
                          name={iconName} 
                          size={18} 
                          color={isSelected ? colors.accent : colors.textSecondary} 
                        />
                      </View>
                      <Text style={[
                        styles.soundOptionText,
                        isSelected && styles.soundOptionTextActive
                      ]} numberOfLines={1}>
                        {formatSoundName(soundKey)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      {isCustom && (
                        <Pressable
                          onPress={(e) => handleDeleteCustomSound(soundKey, e)}
                          style={{ padding: spacing.xs }}
                          hitSlop={8}
                          accessibilityLabel={`Delete custom sound ${formatSoundName(soundKey)}`}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.error} />
                        </Pressable>
                      )}
                      {isSelected && (
                        <Ionicons name="checkmark" size={20} color={colors.accent} />
                      )}
                    </View>
                  </Pressable>
                );
              })}

              {/* Add Custom Sound Option */}
              <Pressable
                style={styles.addCustomSoundRow}
                onPress={handlePickCustomSound}
                android_ripple={rippleTokens.accent}
              >
                <View style={styles.soundOptionLeft}>
                  <View style={[styles.soundOptionIconCircle, { backgroundColor: colors.accent + '15' }]}>
                    <Ionicons name="add" size={20} color={colors.accent} />
                  </View>
                  <Text style={[styles.soundOptionText, { color: colors.accent, fontFamily: font.semibold }]}>
                    Add Custom Sound...
                  </Text>
                </View>
              </Pressable>
            </View>

            <Pressable
              style={styles.bottomSheetCloseBtn}
              onPress={() => setIsSoundSelectorVisible(false)}
              android_ripple={rippleTokens.surface}
            >
              <Text style={styles.bottomSheetCloseBtnText}>{i18n.t('common.done')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Timer Duration Picker Bottom Sheet Modal */}
      <Modal
        visible={isTimerPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsTimerPickerVisible(false)}
      >
        <Pressable 
          style={styles.bottomSheetBackdrop} 
          onPress={() => setIsTimerPickerVisible(false)}
        >
          <Pressable 
            style={styles.bottomSheetContainer}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.bottomSheetDragIndicator} />
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>{i18n.t('profile.selectDefaultRest')}</Text>
              <Text style={styles.bottomSheetSubtitle}>{i18n.t('profile.selectRestDuration')}</Text>
            </View>

            <View style={styles.bottomSheetOptions}>
              {([30, 60, 90, 120, 180] as const).map((durationVal) => {
                const isSelected = defaultRestDuration === durationVal;
                const formatLabel = (s: number) => {
                  if (s < 60) return `${s}s`;
                  return `${s / 60}m (${s}s)`;
                };

                return (
                  <Pressable
                    key={durationVal}
                    style={[
                      styles.soundOptionRow,
                      isSelected && styles.soundOptionRowActive
                    ]}
                    onPress={() => {
                      if (setDefaultRestDuration) setDefaultRestDuration(durationVal);
                      setIsTimerPickerVisible(false);
                    }}
                    android_ripple={rippleTokens.surface}
                  >
                    <View style={styles.soundOptionLeft}>
                      <View style={[
                        styles.soundOptionIconCircle,
                        isSelected ? { backgroundColor: colors.accent + '22' } : { backgroundColor: colors.surfaceHigh }
                      ]}>
                        <Ionicons 
                          name="time-outline" 
                          size={18} 
                          color={isSelected ? colors.accent : colors.textSecondary} 
                        />
                      </View>
                      <Text style={[
                        styles.soundOptionText,
                        isSelected && styles.soundOptionTextActive
                      ]}>
                        {formatLabel(durationVal)}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color={colors.accent} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Custom Duration Input Card */}
            <Card padding={spacing.md} style={styles.customTimerContainer}>
              <Text style={styles.customTimerTitle}>{i18n.t('profile.customRestDuration')}</Text>
              <View style={styles.customTimerRow}>
                <TextInput
                  style={styles.customTimerInput}
                  keyboardType="number-pad"
                  value={customTimerValue}
                  onChangeText={(val) => setCustomTimerValue(val.replace(/[^0-9]/g, ''))}
                  placeholder={i18n.t('profile.customRestPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  maxLength={4}
                />
                <Pressable
                  style={styles.customTimerBtn}
                  onPress={() => {
                    const parsed = parseInt(customTimerValue, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                      if (setDefaultRestDuration) setDefaultRestDuration(parsed);
                      setIsTimerPickerVisible(false);
                    } else {
                      Alert.alert(i18n.t('profile.invalidInput'), i18n.t('profile.invalidNumber'));
                    }
                  }}
                  android_ripple={rippleTokens.surface}
                >
                  <Text style={styles.customTimerBtnText}>{i18n.t('common.save')}</Text>
                </Pressable>
              </View>
            </Card>

            <Pressable
              style={[styles.bottomSheetCloseBtn, { marginTop: spacing.md }]}
              onPress={() => setIsTimerPickerVisible(false)}
              android_ripple={rippleTokens.surface}
            >
              <Text style={styles.bottomSheetCloseBtnText}>{i18n.t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.xxxl,
  },

  // Hero Card
  heroCard: {
    overflow:     'hidden',
    marginBottom: spacing.lg,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       spacing.lg,
    columnGap:     spacing.md,
  },
  avatarSection: {
    position: 'relative',
  },
  proBadge: {
    position: 'absolute',
    bottom:   -4,
    right:    -6,
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    color:         colors.textPrimary,
    fontSize:      font.sizes.lg,
    fontFamily:    font.bold,
    letterSpacing: -0.3,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     4,
    marginTop:     4,
  },
  heroMetaText: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.sm,
    fontFamily: font.regular,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginBottom:  spacing.lg,
  },
  statGap: { width: spacing.sm },

  // Section labels
  sectionLabel: { marginBottom: spacing.md },

  // Chart
  chartHeader: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   spacing.lg,
  },
  chartTitle: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.base,
    fontFamily: font.semibold,
  },
  chartSubtitle: {
    color:     colors.textSecondary,
    fontSize:  font.sizes.sm,
    fontFamily: font.regular,
    marginTop: 2,
  },
  chartBadge: {
    backgroundColor: colors.accentGlow,
    borderColor:     colors.accent,
    borderWidth:     1,
    borderRadius:    radius.full,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  chartBadgeText: {
    color:      colors.accent,
    fontSize:   font.sizes.xs,
    fontFamily: font.semibold,
  },

  // PR highlight card
  prRow: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     spacing.md,
  },
  prIcon: {
    width:          42,
    height:         42,
    borderRadius:   radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
  },
  prText: { flex: 1 },
  prTitle: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.md,
    fontFamily: font.semibold,
  },
  prSub: {
    color:     colors.textSecondary,
    fontSize:  font.sizes.sm,
    fontFamily: font.regular,
    marginTop: 2,
  },
  
  // Settings Section
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.semibold,
  },
  settingSubtitle: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
    marginTop: 2,
  },
  togglePill: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  togglePillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  togglePillText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: font.bold,
  },
  togglePillTextActive: {
    color: colors.textInverse,
  },
  togglePillSegmented: {
    flexDirection: 'row',
    paddingVertical: 0,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  togglePillSegment: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglePillSegmentActive: {
    backgroundColor: colors.accent,
  },
  themeCard: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 65,
  },
  themeCardLabel: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.semibold,
  },

  // Measure row
  measureRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
    columnGap:         spacing.md,
  },
  measureIcon: {
    width:          42,
    height:         42,
    borderRadius:   radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
  },
  measureText: { flex: 1 },
  measureTitle: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.md,
    fontFamily: font.semibold,
  },
  measureSub: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.xs,
    fontFamily: font.regular,
    marginTop:  2,
  },

  // Settings quick row (mirrors measure row)
  settingsQuickRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
    columnGap:         spacing.md,
  },
  settingsQuickIcon: {
    width:          42,
    height:         42,
    borderRadius:   radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Google sync components
  googlePromoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    rowGap: spacing.md,
  },
  googlePromoTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  googlePromoSubtitle: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.regular,
    lineHeight: 20,
    textAlign: 'center',
  },
  connectGoogleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
    ...(shadow.accentGlow as object),
  },
  connectGoogleBtnText: {
    color: colors.textInverse,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 0.8,
  },

  syncContainer: {
    alignItems: 'stretch',
    rowGap: spacing.md,
  },
  syncHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    flex: 1,
    marginRight: spacing.sm,
  },
  googleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  recoveryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  recoveryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recoveryBtn: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 6,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 14,
  },
  recoveryBtnText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: font.bold,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  wipeSimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    paddingVertical: spacing.xs,
  },
  wipeSimBtnText: {
    color: colors.error,
    fontSize: 9,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  syncTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
  },
  syncEmail: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
    marginTop: 1,
  },
  signOutBtn: {
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface2,
  },
  signOutBtnText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: font.bold,
  },
  syncDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  syncStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.xs,
  },
  syncStatusText: {
    color: colors.success,
    fontSize: font.sizes.xs,
    fontFamily: font.semibold,
  },
  syncTimeLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: font.regular,
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    marginTop: spacing.xs,
    ...(shadow.accentGlow as object),
  },
  syncNowBtnText: {
    color: colors.textInverse,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 0.8,
  },



  // Modals Styling
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 20,
    maxHeight: '90%',
    ...(shadow.lg as object),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  modalForm: {
    rowGap: spacing.md,
  },
  modalScroll: {
    rowGap: spacing.md,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    padding: spacing.md,
    fontSize: font.sizes.md,
    fontFamily: font.medium,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...(shadow.accentGlow as object),
  },
  submitBtnText: {
    color: colors.textInverse,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 1,
  },

  googleBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  googleBrandText: {
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.bold,
  },

  // Segmented Tabs for Google Modal
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.sm,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: colors.surface,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs - 1,
    fontFamily: font.semibold,
  },
  tabTextActive: {
    color: colors.accent,
    fontFamily: font.bold,
  },
  instructionText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: font.regular,
    lineHeight: 16,
    marginBottom: 4,
  },
  instructionsContainer: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  instructionsTitle: {
    color: colors.textPrimary,
    fontSize: 10,
    fontFamily: font.bold,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  instructionsStep: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: font.medium,
    lineHeight: 14,
    marginBottom: 4,
  },
  helpToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderRadius: radius.xs,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  helpToggleBtnText: {
    color: colors.accent,
    fontSize: 10,
    fontFamily: font.bold,
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
  },

  // Backup Card
  backupCard: {
    maxWidth: 400,
  },
  backupHelperText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
    lineHeight: 18,
  },
  codeBox: {
    fontFamily: 'monospace',
    fontSize: 10,
    textAlignVertical: 'top',
    height: 120,
  },

  // Settings Modal
  settingsHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.surface,
  },
  settingsBack: {
    width:  36,
    height: 36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  settingsTitle: {
    color:         colors.textPrimary,
    fontSize:      font.sizes.md,
    fontFamily:    font.bold,
    letterSpacing: 1.2,
  },
  settingsContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.xxxl,
    paddingTop:        spacing.md,
  },

  // About section
  aboutRow: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     spacing.md,
  },
  aboutIconBox: {
    width:          44,
    height:         44,
    borderRadius:   radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
  },
  aboutAppName: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.base,
    fontFamily: font.bold,
  },
  aboutVersion: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.xs,
    fontFamily: font.regular,
    marginTop:  2,
  },

  // Spinner
  spinnerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerCard: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: spacing.md,
  },
  spinnerVal: {
    color: colors.textPrimary,
    fontSize: font.sizes.xs,
    fontFamily: font.semibold,
  },
  settingDivider: {
    height:          1,
    backgroundColor: colors.border,
    width:           '100%',
    marginVertical:  spacing.md,
  },
  settingsMenuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    columnGap: spacing.md,
  },
  settingsMenuIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsMenuTextBlock: {
    flex: 1,
  },
  settingsMenuTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.semibold,
  },
  settingsMenuDesc: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
    marginTop: 2,
  },
  sliderContainer: {
    marginTop: spacing.sm,
    width:     '100%',
  },
  sliderTrack: {
    height:          6,
    backgroundColor: colors.surfaceHigh,
    borderRadius:    radius.full,
    position:        'relative',
    marginVertical:  12,
    justifyContent:  'center',
  },
  sliderFill: {
    height:          6,
    backgroundColor: colors.accent,
    borderRadius:    radius.full,
    position:        'absolute',
    left:            0,
  },
  sliderNotch: {
    width:           14,
    height:          14,
    borderRadius:    7,
    backgroundColor: colors.borderStrong,
    position:        'absolute',
    marginLeft:      -7,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.border,
  },
  sliderNotchActive: {
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: colors.accent,
    borderColor:     colors.textPrimary,
    borderWidth:     1.5,
    marginLeft:      -10,
    ...(shadow.accentGlow as object),
  },
  sliderNotchInner: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#0D0F14',
  },
  sliderThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderColor: colors.textPrimary,
    borderWidth: 1.5,
    position: 'absolute',
    marginLeft: -10,
    alignItems: 'center',
    justifyContent: 'center',
    ...(shadow.accentGlow as object),
    zIndex: 3,
  },
  sliderThumbInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0D0F14',
  },
  sliderTapZone: {
    width: 32,
    height: 32,
    position: 'absolute',
    marginLeft: -16,
    zIndex: 4,
    backgroundColor: 'transparent',
  },
  sliderLabels: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:      spacing.sm,
  },
  sliderLabelText: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.xs - 1,
    fontFamily: font.medium,
  },
  // Welcome Empty State / Demo Card
  demoCard: {
    borderColor:     colors.accentGlow,
    borderWidth:     1,
    marginBottom:    spacing.lg,
    backgroundColor: 'rgba(79, 142, 247, 0.03)',
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     spacing.sm,
    marginBottom:  spacing.sm,
  },
  demoIconCircle: {
    width:          36,
    height:         36,
    borderRadius:   radius.xs,
    alignItems:     'center',
    justifyContent: 'center',
  },
  demoTitle: {
    color:      colors.accent,
    fontSize:   font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  demoText: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.sm,
    fontFamily: font.regular,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  demoBtn: {
    backgroundColor: colors.accent,
    borderRadius:    radius.sm,
    paddingVertical: 11,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    ...(shadow.accentGlow as object),
  },
  demoBtnText: {
    color:      '#0D0F14',
    fontSize:   font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },

  // Milestone Badges Grid
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  badgeCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    columnGap: spacing.sm,
  },
  badgeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInfo: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: font.sizes.xs + 1,
    fontFamily: font.bold,
  },
  badgeDesc: {
    fontSize: 9,
    fontFamily: font.medium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quickStartCard: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  quickStartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickStartTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickStartLabel: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  quickStartWorkoutName: {
    color: colors.textPrimary,
    fontSize: font.sizes.lg,
    fontFamily: font.bold,
    marginBottom: spacing.xs,
  },
  quickStartExercises: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.regular,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  quickStartBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    ...(shadow.accentGlow as object),
  },
  quickStartBtnText: {
    color: '#0D0F14',
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },

  // Bottom Sheet Styles for Sound Selector
  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.85)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: colors.bg, // Strict AMOLED black `#0D0F14`
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderColor: colors.border,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.xl,
    ...(shadow.lg as object),
  },
  bottomSheetDragIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  bottomSheetHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  bottomSheetTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.lg,
    fontFamily: font.bold,
    textAlign: 'center',
  },
  bottomSheetSubtitle: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.medium,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  bottomSheetOptions: {
    rowGap: spacing.sm,
    marginBottom: spacing.lg,
  },
  soundOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: 52, // Respect >44dp minimum touch target
  },
  soundOptionRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surface2,
  },
  soundOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
  },
  soundOptionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundOptionText: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.medium,
  },
  soundOptionTextActive: {
    color: colors.accent,
    fontFamily: font.semibold,
  },
  bottomSheetCloseBtn: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderColor: colors.border,
    borderWidth: 1,
  },
  bottomSheetCloseBtnText: {
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  customTimerContainer: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    marginTop: spacing.xs,
    padding: spacing.md,
  },
  customTimerTitle: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  customTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
  },
  customTimerInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xs,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    fontSize: font.sizes.md,
    fontFamily: font.medium,
  },
  customTimerBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customTimerBtnText: {
    color: '#0D0F14',
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
  },
  volumeSliderContainer: {
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  volumeSliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  volumePercentage: {
    marginLeft: 'auto',
    color: colors.accent,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
  },
  volSliderTrack: {
    height: 8,
    borderRadius: radius.xs,
    backgroundColor: colors.bg,
    position: 'relative',
    marginVertical: spacing.md,
    justifyContent: 'center',
  },
  volSliderFill: {
    height: '100%',
    borderRadius: radius.xs,
    backgroundColor: colors.accent,
  },
  volSliderThumb: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.textPrimary,
    position: 'absolute',
    marginLeft: -10,
    borderWidth: 2,
    borderColor: colors.accent,
    boxShadow:   '0px 0px 4px ' + colors.accent + '80',
  },
  addCustomSoundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent + '30',
    borderStyle: 'dashed',
  },
  inlineLoginBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  inlineLoginBtnText: {
    color: '#0D0F14',
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
  connectedBadge: {
    backgroundColor: colors.successGlow,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'center',
    marginLeft: spacing.md,
  },
  connectedBadgeText: {
    color: colors.success,
    fontSize: font.sizes.xs - 1,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  colorPresetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface2,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  colorPresetDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  colorPresetLabel: {
    color: colors.textPrimary,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
  },
  hexInput: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontFamily: font.medium,
    fontSize: font.sizes.sm,
  },
  hexInputSmall: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    color: colors.textPrimary,
    fontFamily: font.medium,
    fontSize: font.sizes.xs,
  },
});

export default ProfileScreen;
