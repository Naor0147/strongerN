// screens/ProfileScreen.tsx
import React, { useMemo, useState, useRef } from 'react';
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
  Animated,
  Easing,
  Platform,
  Linking,
  PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import i18n, { switchLanguage } from '../utils/i18n';
import { I18nManager } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { pickAndReadBackupFile } from '../utils/backupManager';

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
  onStartWorkout?:            (name: string, exerciseNames: string[]) => void;
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
  if (!isoString) return 'Never backed up';
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Last synced: Just now';
  if (diffMins < 60) return `Last synced: ${diffMins}m ago`;
  return `Last synced: ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
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

  React.useEffect(() => {
    setLocalVolume(soundVolume);
  }, [soundVolume]);

  const startVolumeRef = useRef(0);
  const localVolumeRef = useRef(localVolume);
  localVolumeRef.current = localVolume;

  const setSoundVolumeRef = useRef(setSoundVolume);
  setSoundVolumeRef.current = setSoundVolume;

  const soundSetCompletedRef = useRef(soundSetCompleted);
  soundSetCompletedRef.current = soundSetCompleted;

  const sliderWidthRef = useRef(sliderWidth);
  sliderWidthRef.current = sliderWidth;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        const initialTouchX = evt.nativeEvent.locationX;
        const width = sliderWidthRef.current || 200;
        let newVolume = Math.max(0, Math.min(1, initialTouchX / width));
        newVolume = Math.round(newVolume * 20) / 20;
        setLocalVolume(newVolume);
        startVolumeRef.current = newVolume;
      },
      onPanResponderMove: (evt, gestureState) => {
        const width = sliderWidthRef.current || 200;
        const deltaVol = gestureState.dx / width;
        let newVolume = Math.max(0, Math.min(1, startVolumeRef.current + deltaVol));
        newVolume = Math.round(newVolume * 20) / 20;
        setLocalVolume(newVolume);
      },
      onPanResponderRelease: () => {
        const finalVol = localVolumeRef.current;
        if (setSoundVolumeRef.current) {
          setSoundVolumeRef.current(finalVol);
        }
        import('../utils/soundPlayer').then((m) =>
          m.playSoundByKey(soundSetCompletedRef.current)
        );
      },
    })
  ).current;

  return (
    <View style={styles.volumeSliderContainer}>
      <View style={styles.volumeSliderHeader}>
        <Ionicons name="volume-medium-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
        <Text style={styles.settingTitle}>Sound Volume</Text>
        <Text style={styles.volumePercentage}>{Math.round(localVolume * 100)}%</Text>
      </View>
      <View
        style={styles.volSliderTrack}
        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View pointerEvents="none" style={[styles.volSliderFill, { width: `${localVolume * 100}%` }]} />
        <View pointerEvents="none" style={[styles.volSliderThumb, { left: `${localVolume * 100}%` }]} />
      </View>
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

  React.useEffect(() => {
    setLocalSpeed(animationSpeed);
  }, [animationSpeed]);

  const startSpeedRef = useRef(0);
  const localSpeedRef = useRef(localSpeed);
  localSpeedRef.current = localSpeed;

  const setAnimationSpeedRef = useRef(setAnimationSpeed);
  setAnimationSpeedRef.current = setAnimationSpeed;

  const sliderWidthRef = useRef(sliderWidth);
  sliderWidthRef.current = sliderWidth;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        const initialTouchX = evt.nativeEvent.locationX;
        const width = sliderWidthRef.current || 200;
        let newSpeed = Math.max(0, Math.min(2, (initialTouchX / width) * 2));
        newSpeed = Math.round(newSpeed * 20) / 20; // steps of 0.05
        setLocalSpeed(newSpeed);
        startSpeedRef.current = newSpeed;
      },
      onPanResponderMove: (evt, gestureState) => {
        const width = sliderWidthRef.current || 200;
        const deltaSpeed = (gestureState.dx / width) * 2;
        let newSpeed = Math.max(0, Math.min(2, startSpeedRef.current + deltaSpeed));
        newSpeed = Math.round(newSpeed * 20) / 20;
        setLocalSpeed(newSpeed);
      },
      onPanResponderRelease: () => {
        const finalSpeed = localSpeedRef.current;
        if (setAnimationSpeedRef.current) {
          setAnimationSpeedRef.current(finalSpeed);
        }
      },
    })
  ).current;

  return (
    <View style={styles.volumeSliderContainer}>
      <View style={styles.volumeSliderHeader}>
        <Ionicons name="speedometer-outline" size={20} color={colors.highlight} style={{ marginRight: spacing.sm }} />
        <Text style={styles.settingTitle}>Global Animation Speed</Text>
        <Text style={styles.volumePercentage}>
          {localSpeed === 0 ? 'Instant (0x)' : `${localSpeed}x`}
        </Text>
      </View>
      <View
        style={styles.volSliderTrack}
        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View pointerEvents="none" style={[styles.volSliderFill, { width: `${(localSpeed / 2) * 100}%` }]} />
        <View pointerEvents="none" style={[styles.volSliderThumb, { left: `${(localSpeed / 2) * 100}%` }]} />
      </View>
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
  onGoogleLogin,
  onGoogleLogout,
  onCloudSync,
  onUpdateUser,
  onImportBackup,
  onImportStrongCSV,
  onExportBackup,
  onExportCSV,
  animationSpeed,
  setAnimationSpeed,
  onWipeAllData,
  lastSynced,
  weeklyMuscleSets = {},
  exercises = [],
  isWatchSimulatorVisible,
  setIsWatchSimulatorVisible,
  isHealthSyncEnabled,
  setIsHealthSyncEnabled,
  isLiveHeartRateEnabled,
  setIsLiveHeartRateEnabled,
  onStartWorkout,
  templates = [],
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
  customSounds = [],
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
  const [developerToolsUnlocked, setDeveloperToolsUnlocked] = useState(isDeveloperModeEnabled);
  React.useEffect(() => {
    if (isDeveloperModeEnabled) {
      setDeveloperToolsUnlocked(true);
    }
  }, [isDeveloperModeEnabled]);

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
      setDeveloperToolsUnlocked(true);
      Alert.alert(
        "Developer Tools Unlocked",
        "Developer Mode is now visible at the bottom of the Settings page."
      );
      versionTapCount.current = 0;
    }
  };
  const [isBackupPanelVisible, setIsBackupPanelVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  // Form inputs
  const [tempName, setTempName] = useState(user?.name || '');
  const [backupText, setBackupText] = useState('');
  const [pastedBackup, setPastedBackup] = useState('');

  // Sound selector overlay states
  const [isSoundSelectorVisible, setIsSoundSelectorVisible] = useState(false);
  const [activeSoundTrigger, setActiveSoundTrigger] = useState<'setChecked' | 'workoutCompleted' | 'timerCompleted' | null>(null);

  // Timer selector overlay states
  const [isTimerPickerVisible, setIsTimerPickerVisible] = useState(false);
  const [customTimerValue, setCustomTimerValue] = useState(defaultRestDuration.toString());



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
      
      Alert.alert('Success', `Custom sound "${newSound.name}" added successfully!`);
    } catch (error) {
      console.warn('Error picking custom sound:', error);
      Alert.alert('Error', 'Failed to pick custom sound file.');
    }
  };

  const handleDeleteCustomSound = (soundId: string, e: any) => {
    e.stopPropagation();
    Alert.alert(
      'Delete Custom Sound',
      'Are you sure you want to remove this custom sound?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
    if (soundKey === 'chime') return 'Chime';
    if (soundKey === 'beep') return 'Double Beep';
    if (soundKey === 'fanfare') return 'Fanfare';
    if (soundKey === 'bell1') return 'Bell 1';
    if (soundKey === 'bell2') return 'Bell 2';
    if (soundKey === 'boxing-bell') return 'Boxing Bell';
    if (soundKey === 'mute') return 'Mute / None';
    const found = customSounds.find(c => c.id === soundKey);
    return found ? found.name : 'Custom Sound';
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
          Alert.alert('Google Sign-In Error', 'No access token returned from Google.');
        }
      } else if (response.type === 'error') {
        setIsSyncing(false);
        Alert.alert('Google Sign-In Error', `OAuth error: ${response.error?.message || 'Unknown error'}`);
      } else if (response.type === 'cancel') {
        setIsSyncing(false);
        Alert.alert('Google Sign-In Cancelled', 'The Google Sign-In flow was closed or cancelled.');
      }
    }
  }, [response]);

  // Load animations
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const speed = (typeof globalAnimation !== 'undefined' && globalAnimation && typeof globalAnimation.speed === 'number')
      ? globalAnimation.speed
      : 1;

    if (speed === 0) {
      fadeAnim.setValue(1);
      return;
    }
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450 * speed,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
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
          'Demo Data Loaded',
          'The comprehensive demo database has been successfully restored! All charts, PR logs, history entries, and muscle metrics are now fully populated.'
        );
      } else {
        Alert.alert('Error', 'Failed to load demo data.');
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
        title: 'Consistency King',
        description: 'Log 10+ workouts',
        icon: 'calendar-outline' as const,
        unlocked: totalW >= 10,
      },
      {
        id: 'century-club',
        title: 'Century Club',
        description: 'Log 100+ workouts',
        icon: 'trophy-outline' as const,
        unlocked: totalW >= 100,
      },
      {
        id: 'heavy-lifter',
        title: 'Heavy Lifter',
        description: 'Lift 10,000+ kg total',
        icon: 'barbell-outline' as const,
        unlocked: allVol >= 10000,
      },
      {
        id: 'titan',
        title: 'Titan',
        description: 'Lift 50,000+ kg total',
        icon: 'flame-outline' as const,
        unlocked: allVol >= 50000,
      },
      {
        id: 'iron-lungs',
        title: 'Iron Lungs',
        description: 'Workout for 60+ mins',
        icon: 'stopwatch-outline' as const,
        unlocked: has60m,
      },
      {
        id: 'custom-creator',
        title: 'Custom Creator',
        description: 'Add a custom exercise',
        icon: 'hammer-outline' as const,
        unlocked: hasCustom,
      },
      {
        id: 'early-bird',
        title: 'Early Bird',
        description: 'Workout before 8:00 AM',
        icon: 'sunny-outline' as const,
        unlocked: earlyBird,
      },
      {
        id: 'night-owl',
        title: 'Night Owl',
        description: 'Workout after 8:00 PM',
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
      Alert.alert('Error', 'Please enter a name.');
      return;
    }
    if (onUpdateUser) {
      onUpdateUser(tempName.trim());
    }
    setIsRenameVisible(false);
    Alert.alert('Success', 'Profile name updated!');
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
          'Google Cloud Recovery',
          `Welcome back, ${profile.name}! We successfully connected to your Google Drive, located your backup, and restored all workouts, routines, and measurements!`
        );
      } else {
        // Run initial cloud sync to save current local state to their Drive!
        await onCloudSync();
        Alert.alert(
          'Google Account Connected',
          `Successfully connected as "${profile.email}". Auto-backup is now active! All completed sessions will sync instantly to your Google Drive.`
        );
      }
    } catch (err: any) {
      setIsSyncing(false);
      console.error('[Google Connect Error]', err);
      Alert.alert('Connection Failed', `Failed to connect: ${err.message || err}`);
    }
  };

  // Google Sign-In via OAuth (standard native picker flow)
  const handleGoogleWebAuth = async () => {
    if (!ANDROID_CLIENT_ID) {
      Alert.alert(
        'Google Client ID Not Set',
        'Google Client ID is not configured in environment variables. Please check your .env file.'
      );
      return;
    }

    if (!request) {
      Alert.alert('Google Client Not Ready', 'The Google client is initializing. Please try again in a moment.');
      return;
    }

    setIsSyncing(true);
    try {
      await promptAsync();
    } catch (err: any) {
      console.error('[ProfileScreen] promptAsync error', err);
      setIsSyncing(false);
      Alert.alert('Authentication Failed', err.message || String(err));
    }
  };



  // File-based export
  const handleExportJson = async () => {
    if (onExportBackup) {
      try {
        const ok = await onExportBackup();
        if (!ok) {
          Alert.alert('Export Failed', 'Could not export the backup file. Please try again.');
        }
        // Success message is shown by the native Share sheet / download trigger
      } catch (e: any) {
        Alert.alert('Export Error', e.message || 'An error occurred during export.');
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
      'Export Format',
      'Select your preferred export format:',
      [
        {
          text: 'Backup File (.json)',
          onPress: handleExportJson,
        },
        {
          text: 'CSV Spreadsheet (.csv)',
          onPress: handleExportCsvPress,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleImportPress = () => {
    Alert.alert(
      'Import / Restore Method',
      'Select your preferred import method:',
      [
        {
          text: 'Restore from Backup File (.json)',
          onPress: handleImportFromFile,
        },
        {
          text: 'Paste JSON Payload',
          onPress: () => {
            setPastedBackup('');
            setBackupText('');
            setIsBackupPanelVisible(true);
          },
        },
        {
          text: 'Cancel',
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
        Alert.alert('Error', 'The picked CSV file is empty.');
        return;
      }

      if (onImportStrongCSV) {
        const { importedCount, addedExercisesCount } = onImportStrongCSV(csvText);
        Alert.alert(
          'Import Successful',
          `Successfully imported ${importedCount} workout sessions and added ${addedExercisesCount} new exercises to your library.`
        );
      } else {
        Alert.alert('Error', 'Import functionality is not available.');
      }
    } catch (error: any) {
      console.warn('Error importing Strong CSV:', error);
      Alert.alert('Import Failed', error.message || 'Failed to parse and import the CSV file.');
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
            '✅ Restore Complete',
            `Successfully restored all workouts, exercises, and settings from your backup file!`
          );
        } else {
          Alert.alert('Restore Failed', 'Could not apply the backup data. Please check the file.');
        }
      }
    } catch (e: any) {
      Alert.alert('Import Error', e.message || 'An error occurred during import.');
    }
  };

  const handleImportSubmit = () => {
    if (!pastedBackup.trim()) {
      Alert.alert('Error', 'Please paste a backup string first.');
      return;
    }
    if (onImportBackup) {
      const ok = onImportBackup(pastedBackup.trim());
      if (ok) {
        setPastedBackup('');
        setIsBackupPanelVisible(false);
        Alert.alert('Success', 'Profile restored successfully from your backup data package!');
      } else {
        Alert.alert('Error', 'Invalid backup format. Please verify the copied string.');
      }
    }
  };

  // Phone switch simulation
  const handlePhoneWipeSimulator = () => {
    Alert.alert(
      'Simulate Phone Switch / Wipe',
      'This will clear all local workouts and data from your device database to test recovery. (Simulates switching phones or reinstalling the app). Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe Local Data',
          style: 'destructive',
          onPress: () => {
            try {
              if (onWipeAllData) {
                onWipeAllData();
              } else if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem('strongern_app_data_v1');
              }
              Alert.alert(
                'Local Database Wiped',
                'Local data wiped! Click Google Connect and log in with your email to see Google Cloud instantly recover your workouts!',
                [
                  {
                    text: 'OK',
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
      'Log Out',
      'Are you sure you want to log out of your current session? Your local data will be preserved, but you will need to sign in again to access it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setIsSettingsVisible(false);
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
        title="Profile"
        actions={[
          {
            icon: 'notifications-outline',
            label: 'Notifications',
            onPress: () => {
              Alert.alert('Gym Reminders', 'No active notifications. We will alert you on your scheduled training days!');
            }
          },
          {
            icon: 'settings-outline',
            label: 'Settings',
            onPress: () => setIsSettingsVisible(true),
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
          {user?.totalWorkouts === 0 && !googleUser && authMode === 'guest' && isDeveloperModeEnabled && (
            <Card padding={spacing.lg} style={styles.demoCard}>
              <View style={styles.demoHeader}>
                <View style={[styles.demoIconCircle, { backgroundColor: colors.accent + '22' }]}>
                  <Ionicons name="sparkles" size={20} color={colors.accent} />
                </View>
                <Text style={styles.demoTitle}>WELCOME TO STRONGERN!</Text>
              </View>
              <Text style={styles.demoText}>
                Start tracking your workouts in the <Text style={{ fontFamily: font.bold, color: colors.accent }}>Workout</Text> tab to build up your stats, or load the comprehensive <Text style={{ fontFamily: font.bold, color: colors.highlight }}>Demo Database</Text> with one click below to instantly explore all of our premium charts, history logs, and muscle analytics!
              </Text>
              <Pressable
                onPress={handleLoadDemoData}
                style={styles.demoBtn}
                android_ripple={rippleTokens.accent}
              >
                <Ionicons name="barbell" size={16} color="#0D0F14" style={{ marginRight: spacing.xs }} />
                <Text style={styles.demoBtnText}>LOAD DEMO DATABASE</Text>
              </Pressable>
            </Card>
          )}

          {/* ── User Hero Card ───────────────────────────────────── */}
        <Card style={styles.heroCard} padding={0} testID="profile.user-card">
          <View style={styles.heroContent}>
            <View style={styles.avatarSection}>
              <Avatar
                initials={getInitials((authMode === 'google' ? googleUser?.name : user?.name) || 'Guest User')}
                uri={user?.avatarUri}
                size={64}
                testID="profile.avatar"
              />
            </View>

            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>
                {authMode === 'google' ? (googleUser?.name || 'Google User') : (user?.name || 'Guest User')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.sm, flexWrap: 'wrap' }}>
                <View style={styles.heroMeta}>
                  <Ionicons name="trophy-outline" size={13} color={colors.accent} />
                  <Text style={styles.heroMetaText}>{user?.totalWorkouts ?? 0} workouts completed</Text>
                </View>
              </View>
            </View>
          </View>
        </Card>

        {/* ── Smart Quick Start Card ───────────────────────────── */}
        <Pressable
          onPress={() => {
            if (onStartWorkout) {
              onStartWorkout(nextWorkout.name, nextWorkout.exercises);
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
          <Card 
            padding={spacing.lg} 
            style={{ backgroundColor: 'transparent', borderWidth: 0, marginBottom: 0 }}
          >
            <View style={styles.quickStartHeader}>
              <View style={styles.quickStartTitleContainer}>
                <Ionicons name="flash" size={16} color={nextWorkout.badgeColor} style={{ marginRight: spacing.xs }} />
                <Text style={styles.quickStartLabel}>UP NEXT</Text>
              </View>
              <Badge 
                label={nextWorkout.type.toUpperCase()} 
                color={nextWorkout.badgeColor} 
                textColor={nextWorkout.badgeColor}
              />
            </View>
            
            <Text style={styles.quickStartWorkoutName}>{nextWorkout.name}</Text>
            
            {nextWorkout.exercises && nextWorkout.exercises.length > 0 && (
              <Text style={styles.quickStartExercises} numberOfLines={2}>
                {nextWorkout.exercises.join('  ·  ')}
              </Text>
            )}

            <View style={styles.quickStartBtn}>
              <Ionicons name="play" size={16} color="#0D0F14" style={{ marginRight: spacing.xs }} />
              <Text style={styles.quickStartBtnText}>Start Workout</Text>
            </View>
          </Card>
        </Pressable>

        {/* ── Dashboard ────────────────────────────────────────── */}

        {/* ── Chart Card ───────────────────────────────────────── */}
        {showWorkoutsChart && (
          <Card padding={spacing.lg} style={{ backgroundColor: 'transparent' }} testID="profile.chart-card">
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>Workouts per week</Text>
                <Text style={styles.chartSubtitle}>Last 8 weeks</Text>
              </View>
              <View style={styles.chartBadge}>
                <Text style={styles.chartBadgeText}>↑ Active</Text>
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
                label="Avg / week"
                decimals={1}
                icon="trending-up-outline"
                iconColor={colors.accent}
                style={{ backgroundColor: 'transparent' }}
                testID="profile.stat-avg-week"
              />
              <View style={styles.statGap} />
              <StatCard
                value={sessions.length}
                label="All time"
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
                label="Week Streak"
                icon="flame-outline"
                iconColor={colors.accent}
                style={{ backgroundColor: 'transparent' }}
                testID="profile.stat-streak"
              />
              <View style={styles.statGap} />
              <StatCard
                value={monthlyVolume / 1000}
                decimals={1}
                label="Month Vol (t)"
                icon="analytics-outline"
                iconColor={colors.highlight}
                style={{ backgroundColor: 'transparent' }}
                testID="profile.stat-month-vol"
              />
              <View style={styles.statGap} />
              <StatCard
                value={allTimeVolume / 1000}
                decimals={1}
                label="All Vol (t)"
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
          title="Measurements"
          subtitle="Track physical progress"
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
              <Text style={styles.measureTitle}>Body & Measurements</Text>
              <Text style={styles.measureSub}>Log size tracking & weight metrics</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>

        {/* ── Personal Records ── */}
        {showHighlights && (
          <>
            <SectionLabel
              title="Personal Records"
              subtitle="Your top lifts"
              style={[styles.sectionLabel, { marginTop: spacing.xl }]}
            />
            {topPrs.length === 0 ? (
              <Card padding={spacing.lg}>
                <Text style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center' }}>
                  Log workouts to track achievements.
                </Text>
              </Card>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xs, paddingBottom: spacing.xs }}
              >
                {topPrs.map((pr, idx) => (
                  <Card 
                    key={idx} 
                    padding={spacing.md} 
                    style={{ width: 140, borderColor: colors.border, borderWidth: 1, backgroundColor: 'transparent' }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                      <Ionicons name="trophy" size={14} color={colors.gold} />
                      <Text style={{ color: colors.textMuted, fontSize: 9, fontFamily: font.bold }}>{pr.date}</Text>
                    </View>
                    <Text style={{ color: colors.textPrimary, fontSize: font.sizes.xs, fontFamily: font.bold, marginBottom: 2 }} numberOfLines={1}>
                      {pr.name}
                    </Text>
                    <Text style={{ color: colors.accent, fontSize: font.sizes.md, fontFamily: font.bold }}>
                      {pr.weight} kg
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: font.medium }}>
                      for {pr.reps} reps
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
              title="Volume Trends"
              subtitle="Muscle sets completed this week"
              style={[styles.sectionLabel, { marginTop: spacing.xl }]}
            />
            <Card padding={spacing.lg}>
              {Object.keys(weeklyMuscleSets || {}).length === 0 ? (
                <Text style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center' }}>
                  No sets logged this week.
                </Text>
              ) : (
                <View style={{ gap: spacing.md }}>
                  {Object.keys(weeklyMuscleSets).map((muscle, idx) => {
                    const sets = weeklyMuscleSets[muscle] || 0;
                    const maxVal = Math.max(...Object.values(weeklyMuscleSets), 1);
                    const percentage = Math.round((sets / maxVal) * 100);
                    return (
                      <View key={idx} style={{ gap: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: colors.textPrimary, fontSize: font.sizes.xs, fontFamily: font.semibold }}>
                            {muscle.toUpperCase()}
                          </Text>
                          <Text style={{ color: colors.textSecondary, fontSize: font.sizes.xs, fontFamily: font.bold }}>
                            {sets} sets
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
              title="Milestone Badges"
              subtitle="Your earned achievements"
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
              <Text style={styles.modalTitle}>EDIT NAME</Text>
              <IconButton
                name="close"
                size={22}
                color={colors.textSecondary}
                onPress={() => setIsRenameVisible(false)}
              />
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>YOUR NAME</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Alex Morgan"
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
                <Text style={styles.submitBtnText}>SAVE NAME</Text>
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
              <Text style={styles.modalTitle}>MANUAL PORTABILITY</Text>
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
                  <Text style={styles.inputLabel}>DATA PACKAGE GENERATED</Text>
                  <Text style={styles.backupHelperText}>
                    Copy the text below. You can paste it into the "Import Backup" field on any device to fully recover your workouts.
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
                      Alert.alert('Copied!', 'Data payload successfully highlighted/copied! Move it safely.');
                    }}
                    android_ripple={rippleTokens.accent}
                  >
                    <Text style={styles.submitBtnText}>DONE</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>PASTE DATA PAYLOAD (JSON)</Text>
                  <Text style={styles.backupHelperText}>
                    Paste the stringified JSON backup payload generated from your other device to import all workouts, routines, and measurements instantly.
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.codeBox, { height: 160 }]}
                    placeholder='{"user":{"name":"Alex Morgan"...}'
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
                    <Text style={styles.submitBtnText}>IMPORT DATA PACKAGE</Text>
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
              <Text style={styles.spinnerVal}>Synchronizing cloud database...</Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal D: Full Settings Sheet */}
      <Modal
        visible={isSettingsVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsSettingsVisible(false)}
      >
        <View style={[styles.safe, { paddingTop: insets.top }]}>
          {/* Settings Header */}
          <View style={styles.settingsHeader}>
            <Pressable
              onPress={() => setIsSettingsVisible(false)}
              style={styles.settingsBack}
              android_ripple={rippleTokens.borderless}
              accessibilityLabel="Close settings"
            >
              <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.settingsTitle}>SETTINGS</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.settingsContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── ACCOUNT & SYNC ──────────────────────────────────── */}
            <SectionLabel
              title="ACCOUNT & SYNC"
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
                        ? 'Google Connected' 
                        : authMode === 'local'
                        ? 'Local Profile'
                        : 'Guest Session'}
                    </Text>
                    <Text style={styles.settingSubtitle}>
                      {authMode === 'google'
                        ? (googleUser?.email || 'Connected with Google') + (googleUser?.accessToken ? '' : ' (Session Expired)')
                        : authMode === 'local'
                        ? `Logged in as ${user?.name || 'Local User'}`
                        : 'Workouts saved locally. Sign in to back up.'}
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
                      {authMode === 'local' ? 'LINK GOOGLE' : 'LOG IN'}
                    </Text>
                  </Pressable>
                ) : googleUser && !googleUser.accessToken ? (
                  <Pressable
                    style={[styles.inlineLoginBtn, { backgroundColor: '#FF9F0A' }]}
                    onPress={handleGoogleWebAuth}
                    android_ripple={rippleTokens.surface}
                  >
                    <Text style={[styles.inlineLoginBtnText, { color: '#0D0F14' }]}>RECONNECT</Text>
                  </Pressable>
                ) : (
                  <View style={styles.connectedBadge}>
                    <Text style={styles.connectedBadgeText}>ACTIVE</Text>
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
                    <Text style={styles.settingTitle}>Edit Display Name</Text>
                    <Text style={styles.settingSubtitle}>
                      Change your profile name
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
                    <Text style={[styles.settingTitle, { color: colors.error }]}>Log Out</Text>
                    <Text style={styles.settingSubtitle}>
                      Sign out of this session and return to launch screen
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>


            </Card>



            {/* Data Portability (under Account & Sync) */}
            <View style={{ height: spacing.md }} />
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
                    <Text style={styles.settingTitle}>Export Data</Text>
                    <Text style={styles.settingSubtitle}>
                      Export all workouts &amp; settings as a Backup file (.json) or CSV spreadsheet.
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
                    <Text style={styles.settingTitle}>Import / Restore Data</Text>
                    <Text style={styles.settingSubtitle}>
                      Recover your data from a backup file (.json) or by pasting a JSON payload.
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
                    <Text style={styles.settingTitle}>Import Strong CSV</Text>
                    <Text style={styles.settingSubtitle}>
                      Import workout history exported from the Strong app (.csv).
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
                <Text style={styles.wipeSimBtnText}>PHONE SWITCH SIMULATOR (WIPE LOCAL DATA)</Text>
              </Pressable>
            </Card>

            {/* ── WORKOUT PREFERENCES ─────────────────────────────── */}
            <SectionLabel
              title="WORKOUT PREFERENCES"
              style={[styles.sectionLabel, { marginTop: spacing.xl }]}
            />
            <Card padding={spacing.lg}>
              {/* Auto Rest Timer */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="alarm-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Auto Rest Timer</Text>
                    <Text style={styles.settingSubtitle} numberOfLines={2}>
                      Start rest countdown after completing a set
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
                    {isAutoTimerEnabled ? 'ON' : 'OFF'}
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
                    <Text style={styles.settingTitle}>Default Rest Duration</Text>
                    <Text style={styles.settingSubtitle}>
                      Initialized when completing a workout set
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
                    <Text style={styles.settingTitle}>Progressive Overload</Text>
                    <Text style={styles.settingSubtitle} numberOfLines={2}>
                      Automatically suggests weight (+2.5kg) or rep (+1 rep) increments for upcoming sets
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
                    {isProgressiveOverloadEnabled ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.settingDivider} />

              {/* Auto-Finish Set */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Auto-Finish Set</Text>
                    <Text style={styles.settingSubtitle} numberOfLines={2}>
                      Automatically marks a set as completed when pressing "Next" inside the Reps & RPE boxes
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
                    {isAutoFinishSetEnabled ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.settingDivider} />

              {/* Keyboard Dismiss on Next */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="keypad-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Keyboard Dismiss on Next</Text>
                    <Text style={styles.settingSubtitle} numberOfLines={2}>
                      Dismisses the keyboard instead of jumping to the next field when pressing "Next" inside Reps & RPE boxes
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
                    {isKeyboardDismissOnNextEnabled ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.settingDivider} />

              {/* RPE / RIR Toggle */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="speedometer-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>RPE / RIR Mode</Text>
                    <Text style={styles.settingSubtitle} numberOfLines={2}>
                      {isRpeMode ? 'Showing Rate of Perceived Exertion (RPE)' : 'Showing Reps in Reserve (RIR)'}
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

              {/* Features & Modules Toggles */}
              <View style={{ marginTop: spacing.md }}>
                <Text style={[styles.settingTitle, { fontSize: font.sizes.md, fontFamily: font.bold, marginBottom: spacing.xs, color: colors.textSecondary }]}>Enabled Modules</Text>
                
                {/* Plate Calculator */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="disc-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Plate Calculator</Text>
                      <Text style={styles.settingSubtitle}>Show disc plate calculator in workout header</Text>
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
                      {isPlateCalculatorEnabled ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.settingDivider} />

                {/* Training Programs */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="ribbon-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Training Programs</Text>
                      <Text style={styles.settingSubtitle}>Show PPL & 5/3/1 splits in Workout tab</Text>
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
                      {isProgramsEnabled ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.settingDivider} />

                {/* Workout History Tab */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="time-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Workout History Tab</Text>
                      <Text style={styles.settingSubtitle}>Show History tab in bottom navigation</Text>
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
                      {isHistoryEnabled ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.settingDivider} />

                {/* Muscle Map Tab */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="body-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Muscle Map Tab</Text>
                      <Text style={styles.settingSubtitle}>Show Muscles tab in bottom navigation</Text>
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
                      {isMusclesEnabled ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Card>

            {/* ── APPEARANCE & INTERACTION ────────────────────────── */}
            <SectionLabel
              title="APPEARANCE & INTERACTION"
              style={[styles.sectionLabel, { marginTop: spacing.xl }]}
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
                    {I18nManager.isRTL ? 'EN' : 'HE'}
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
                    <Text style={styles.settingTitle}>Set Completed</Text>
                    <Text style={styles.settingSubtitle}>
                      Sound played when checking off a set
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
                    <Text style={styles.settingTitle}>Workout Finished</Text>
                    <Text style={styles.settingSubtitle}>
                      Sound played when finishing a session
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
                    <Text style={styles.settingTitle}>Timer Completed</Text>
                    <Text style={styles.settingSubtitle}>
                      Sound played when the rest countdown ends
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
              <Text style={[styles.settingTitle, { fontSize: font.sizes.md, fontFamily: font.bold, marginTop: spacing.md, marginBottom: spacing.xs, color: colors.textSecondary }]}>Visible Dashboard Widgets</Text>



              {/* Summary Data Widgets */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="stats-chart-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Summary Data Widgets</Text>
                    <Text style={styles.settingSubtitle}>Show dashboard stat cards (all-time, streak, avg)</Text>
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
                    {showSummaryWidgets ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.settingDivider} />

              {/* Weekly Tonnage */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="barbell-outline" size={20} color={colors.highlight} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Weekly Tonnage / Volume</Text>
                    <Text style={styles.settingSubtitle}>Show sets volume trends bars on profile</Text>
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
                    {showWeeklyTonnage ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.settingDivider} />

              {/* Workouts Chart */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="trending-up-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Workouts Chart</Text>
                    <Text style={styles.settingSubtitle}>Show workouts per week bar chart</Text>
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
                    {showWorkoutsChart ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.settingDivider} />

              {/* Personal Records */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="trophy-outline" size={20} color={colors.gold} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Personal Records</Text>
                    <Text style={styles.settingSubtitle}>Show personal records on profile</Text>
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
                    {showHighlights ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.settingDivider} />

              {/* Routine Folders */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="folder-outline" size={20} color={colors.violet} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Routine Folders</Text>
                    <Text style={styles.settingSubtitle}>Group routines into folders</Text>
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
                    {enableRoutineFolders ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              </View>
            </Card>

            {/* ── ABOUT ────────────────────────────────────────── */}
            <SectionLabel
              title="ABOUT"
              style={[styles.sectionLabel, { marginTop: spacing.xl }]}
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
                  <Text style={styles.aboutVersion}>Version 1.0.0  ·  AMOLED Optimized (Tap version to unlock developer tools)</Text>
                </View>
              </Pressable>
            </Card>

            {/* ── DEVELOPER OPTIONS (Conditionally Shown) ───────── */}
            {developerToolsUnlocked && (
              <>
                <SectionLabel
                  title="DEVELOPER OPTIONS"
                  subtitle="Testing and demo tools"
                  style={[styles.sectionLabel, { marginTop: spacing.xl }]}
                />
                <Card padding={spacing.lg}>
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Ionicons name="construct-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingTitle}>Enable Developer Tools</Text>
                        <Text style={styles.settingSubtitle}>
                          Unlock database generation, system telemetry controls, and local sandbox settings.
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
                        {isDeveloperModeEnabled ? 'ON' : 'OFF'}
                      </Text>
                    </Pressable>
                  </View>

                  {isDeveloperModeEnabled && (
                    <>
                      <View style={styles.settingDivider} />
                      <Text style={[styles.settingSubtitle, { marginVertical: spacing.md, color: colors.textSecondary }]}>
                        Developer settings are configuration options and utility commands used to test and verify app features during development. They allow developers and testers to inspect states, load pre-defined mock databases, and emulate physical device sensors or integrations.
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
                              <Text style={[styles.settingTitle, { color: colors.textSecondary }]}>Load Demo Database</Text>
                              <Text style={styles.settingSubtitle}>
                                Populate app with sample workouts, sessions, and metrics for testing
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
                              <Text style={[styles.settingTitle, { color: colors.textMuted }]}>Load Demo Database</Text>
                              <Text style={styles.settingSubtitle}>
                                Only available for Guest accounts. Sign out to enable.
                              </Text>
                            </View>
                          </View>
                          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
                        </View>
                      )}

                      <View style={styles.settingDivider} />

                      {/* Theme selection UI */}
                      <Text style={[styles.settingTitle, { fontSize: font.sizes.md, fontFamily: font.bold, marginTop: spacing.md, marginBottom: spacing.xs, color: colors.textSecondary }]}>
                        App Theme Color
                      </Text>
                      <Text style={[styles.settingSubtitle, { marginBottom: spacing.md }]}>
                        Change the accent theme color of the app dynamically.
                      </Text>

                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                        {[
                          { id: 'default', label: 'Default', accent: '#4F8EF7', preview: ['#4F8EF7', '#38BDF8', '#161B24'] },
                          { id: 'purple', label: 'Purple', accent: '#7C5CFC', preview: ['#7C5CFC', '#A855F7', '#161B24'] },
                          { id: 'black-white', label: 'Mono', accent: '#FFFFFF', preview: ['#FFFFFF', '#E2E8F0', '#161B24'] },
                          { id: 'custom', label: 'Custom', accent: customAccentColor, preview: [customAccentColor, customAccentColor, '#161B24'] },
                        ].map((t) => {
                          const isSelected = appTheme === t.id;
                          return (
                            <Pressable
                              key={t.id}
                              style={[
                                styles.themeCard,
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
                            Configure Custom Color
                          </Text>

                          {/* Quick color preset selector */}
                          <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, flexWrap: 'wrap' }}>
                            {[
                              { label: 'Emerald', value: '#10B981' },
                              { label: 'Sunset', value: '#F97316' },
                              { label: 'Hot Pink', value: '#EC4899' },
                              { label: 'Crimson', value: '#EF4444' },
                              { label: 'Yellow', value: '#EAB308' },
                            ].map((preset) => (
                              <Pressable
                                key={preset.value}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 6,
                                  backgroundColor: colors.surface2,
                                  paddingVertical: 6,
                                  paddingHorizontal: 12,
                                  borderRadius: radius.full,
                                  borderWidth: 1,
                                  borderColor: customAccentColor === preset.value ? preset.value : 'transparent',
                                }}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  if (setCustomAccentColor) setCustomAccentColor(preset.value);
                                }}
                                android_ripple={rippleTokens.surface}
                              >
                                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: preset.value }} />
                                <Text style={{ color: colors.textPrimary, fontSize: font.sizes.xs, fontFamily: font.medium }}>
                                  {preset.label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>

                          {/* Visual Color Picker Grid */}
                          <Text style={[styles.settingTitle, { fontSize: font.sizes.xs, fontFamily: font.semibold, color: colors.textSecondary, marginBottom: spacing.sm }]}>
                            PICK A COLOR
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
                              style={{
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
                              }}
                              placeholder="#HEX Code (e.g. #4F8EF7)"
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
                        Advanced Color Customization
                      </Text>
                      <Text style={[styles.settingSubtitle, { marginBottom: spacing.md }]}>
                        Override specific layout colors. Default AMOLED background is pure black #0D0F14.
                      </Text>

                      <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
                        {[
                          { label: 'Background Color', key: 'bg', defaultVal: '#0D0F14', presets: ['#0D0F14', '#000000', '#0A0E17', '#121212'] },
                          { label: 'Card Surface Color', key: 'surface', defaultVal: '#161B24', presets: ['#161B24', '#1F2937', '#080808', '#1A1A1A'] },
                          { label: 'Border Color', key: 'border', defaultVal: '#252D3A', presets: ['#252D3A', '#334155', '#1C2330', '#2E2E2E'] },
                          { label: 'Primary Text Color', key: 'textPrimary', defaultVal: '#EEF1F6', presets: ['#EEF1F6', '#FFFFFF', '#D0D5DD', '#E0E0E0'] },
                          { label: 'Secondary Text Color', key: 'textSecondary', defaultVal: '#8B95A5', presets: ['#8B95A5', '#94A3B8', '#4E5A6E', '#64748B'] },
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
                              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                                <TextInput
                                  style={{
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
                                  }}
                                  placeholder={`Hex code (e.g. ${overrideItem.defaultVal})`}
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
                            'Reset Theme',
                            'Are you sure you want to completely reset the theme and all color overrides to default?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Reset',
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
                          Reset Theme to Default
                        </Text>
                      </Pressable>
                    </>
                  )}
                </Card>

                {isDeveloperModeEnabled && (
                  <>
                    <SectionLabel
                      title="DEVELOPER SETTINGS"
                      subtitle="Simulated APIs & system switches"
                      style={[styles.sectionLabel, { marginTop: spacing.xl }]}
                    />
                    <Card padding={spacing.lg}>
                      {/* Wearable Heart Rate Sync */}
                      <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                          <Ionicons name="pulse-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Wearable Heart Rate Sync</Text>
                            <Text style={styles.settingSubtitle} numberOfLines={2}>
                              Pull active heartbeat BPM telemetry during workout sessions
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
                            {isLiveHeartRateEnabled ? 'ON' : 'OFF'}
                          </Text>
                        </Pressable>
                      </View>

                      <View style={styles.settingDivider} />

                      {/* Achievement Badges */}
                      <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                          <Ionicons name="trophy-outline" size={20} color={colors.violet} style={{ marginRight: spacing.sm }} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Achievement Badges</Text>
                            <Text style={styles.settingSubtitle}>Show earned milestone badges on profile</Text>
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
                            {showAchievementBadges ? 'ON' : 'OFF'}
                          </Text>
                        </Pressable>
                      </View>

                      <View style={styles.settingDivider} />

                      {/* Diagnostic Data Viewer */}
                      <Pressable
                        style={styles.settingRow}
                        onPress={async () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          const { loadAuthState } = await import('../utils/authStore');
                          const { getSecureItem } = await import('../utils/secureStore');
                          const savedAuth = await loadAuthState();
                          const secureToken = await getSecureItem('google_oauth_token');
                          Alert.alert(
                            'Inspect Session Data',
                            `[Active Profile State]\n` +
                            `• Name: ${user?.name || 'N/A'}\n` +
                            `• Avatar: ${user?.avatarUri ? 'Present' : 'N/A'}\n` +
                            `• Total Workouts: ${user?.totalWorkouts ?? 0}\n\n` +
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
                            <Text style={styles.settingTitle}>Inspect Session Data</Text>
                            <Text style={styles.settingSubtitle}>
                              Show account metadata, loaded profile fields, and secure storage tokens
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
              <Text style={styles.bottomSheetTitle}>Select Sound Effect</Text>
              <Text style={styles.bottomSheetSubtitle}>
                {activeSoundTrigger === 'setChecked' && 'Choose sound for Set Completed'}
                {activeSoundTrigger === 'workoutCompleted' && 'Choose sound for Workout Finished'}
                {activeSoundTrigger === 'timerCompleted' && 'Choose sound for Timer Completed'}
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
              <Text style={styles.bottomSheetCloseBtnText}>Done</Text>
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
              <Text style={styles.bottomSheetTitle}>Default Rest Duration</Text>
              <Text style={styles.bottomSheetSubtitle}>Select rest countdown default interval</Text>
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
              <Text style={styles.customTimerTitle}>Custom Rest Duration (seconds)</Text>
              <View style={styles.customTimerRow}>
                <TextInput
                  style={styles.customTimerInput}
                  keyboardType="number-pad"
                  value={customTimerValue}
                  onChangeText={(val) => setCustomTimerValue(val.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 45"
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
                      Alert.alert("Invalid Input", "Please enter a valid number of seconds.");
                    }
                  }}
                  android_ripple={rippleTokens.surface}
                >
                  <Text style={styles.customTimerBtnText}>SAVE</Text>
                </Pressable>
              </View>
            </Card>

            <Pressable
              style={[styles.bottomSheetCloseBtn, { marginTop: spacing.md }]}
              onPress={() => setIsTimerPickerVisible(false)}
              android_ripple={rippleTokens.surface}
            >
              <Text style={styles.bottomSheetCloseBtnText}>Cancel</Text>
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
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
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
  },
  connectedBadgeText: {
    color: colors.success,
    fontSize: font.sizes.xs - 1,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
});

export default ProfileScreen;
