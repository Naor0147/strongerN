// App.tsx — Navigation root with font loading, live workout state, and completion celebrations
import React from 'react';
import { View, StyleSheet, ActivityIndicator, Modal, Text, Pressable, Alert, Linking, AppState, ScrollView } from 'react-native';
import { enableFreeze } from 'react-native-screens';
import { NavigationContainer }      from '@react-navigation/native';

enableFreeze(true);
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar }                from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Rubik_700Bold } from '@expo-google-fonts/rubik';
import { Ionicons }                 from '@expo/vector-icons';
import * as googleDrive             from './utils/googleDrive';
import { initDb, saveToDb, loadFromDb, deleteFromDb } from './utils/db';
import { importStrongCSV } from './utils/csvImporter';
import { setSecureItem, getSecureItem, deleteSecureItem } from './utils/secureStore';
import { setAlertListener, CustomAlertConfig } from './utils/alertOverride';
import { loadAuthState, saveAuthState, saveGoogleProfile, AuthMode, GoogleProfile } from './utils/authStore';
import { buildBackupData, exportBackupToFile, BackupData } from './utils/backupManager';
import i18n from './utils/i18n';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
// generateWorkoutInsights import removed (completion insights feature removed)

// Screens — Auth
import LoginScreen from './screens/LoginScreen';


// Design tokens
import { colors, spacing, radius, font, shadow, ripple as rippleTokens, globalAnimation } from './theme';

// Layout components
import BottomTabBar      from './components/layout/BottomTabBar';
import ActiveWorkoutBar  from './components/layout/ActiveWorkoutBar';
import ActiveWorkoutModal from './components/layout/ActiveWorkoutModal';
import { soundConfig, initSounds } from './utils/soundPlayer';
import { initNotifications, getLastNotificationResponse, onNotificationTapped, isWorkoutNotificationResponse } from './utils/notifications';

// Simulators
import { WatchCompanionSimulator } from './components/ui/WatchCompanionSimulator';
// SocialShareCard import removed (share feature removed from completion)

// Screens
import ProfileScreen   from './screens/ProfileScreen';
import HistoryScreen   from './screens/HistoryScreen';
import WorkoutScreen   from './screens/WorkoutScreen';
import ExercisesScreen from './screens/ExercisesScreen';
import MeasureScreen   from './screens/MeasureScreen';
import MuscleMapScreen from './screens/MuscleMapScreen';
import E2EAppHarness from './screens/E2EAppHarness';

// Mock data
import {
  mockUser,
  mockChartData,
  mockSessions,
  mockTemplates,
  mockExercises,
  mockPrimaryMetrics,
  mockBodyPartMetrics,
  mockPrograms,
} from './data/mockData';

const Tab = createBottomTabNavigator();

function parseMetricValue(str: string): number {
  const cleaned = str.replace(/,/g, '');
  const match = cleaned.match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : 0;
}

function getUnit(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('fat')) return '%';
  if (l.includes('caloric') || l.includes('intake')) return ' kcal';
  if (l.includes('weight')) return ' kg';
  return ' cm';
}

function formatMetricValue(val: number, label: string): string {
  const unit = getUnit(label);
  if (unit === ' kcal') {
    return `${val.toLocaleString()} kcal`;
  }
  return `${val}${unit}`;
}

function mergeMetricsListFn(local: any[], remote: any[]) {
  const merged = [...local];
  remote.forEach((rm: any) => {
    const localIdx = merged.findIndex(
      lm => lm.id === rm.id || lm.label.toLowerCase().trim() === rm.label.toLowerCase().trim()
    );
    if (localIdx > -1) {
      const localHistory = merged[localIdx].history || [];
      const remoteHistory = rm.history || [];
      const mergedHistory = [...localHistory];
      remoteHistory.forEach((rh: any) => {
        if (!mergedHistory.some(lh => lh.date === rh.date)) {
          mergedHistory.push(rh);
        }
      });
      mergedHistory.sort((a: any, b: any) => a.date.localeCompare(b.date));
      
      let lastVal = merged[localIdx].lastValue;
      if (mergedHistory.length > 0) {
        const latest = mergedHistory[mergedHistory.length - 1];
        lastVal = formatMetricValue(latest.value, merged[localIdx].label);
      }
      
      merged[localIdx] = {
        ...merged[localIdx],
        history: mergedHistory,
        lastValue: lastVal,
      };
    } else {
      merged.push(rm);
    }
  });
  return merged;
}

function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });


  // ── Auth State ────────────────────────────────────────────────

  // null = loading from storage; false = needs onboarding; AuthState = loaded
  const [authState, setAuthState] = React.useState<{
    hasCompletedOnboarding: boolean;
    authMode: AuthMode;
    localUsername: string;
    googleProfile?: GoogleProfile | null;
  } | null>(null);

  // Guard to prevent overwriting stored data with defaults on mount
  const [isDataLoaded, setIsDataLoaded] = React.useState(false);
  const [isWorkoutRestored, setIsWorkoutRestored] = React.useState(false);

  // Load auth state from DB on mount
  React.useEffect(() => {
    (async () => {
      await initDb();
      const saved = await loadAuthState();
      if (saved) {
        setAuthState(saved);
        // If previously signed in with Google, pre-populate googleUser from authStore
        // (the main DB load below will also run and may enrich it with the SecureStore token)
        if (saved.authMode === 'google' && saved.googleProfile) {
          const p = saved.googleProfile;
          setGoogleUser(prev => prev ?? {
            email: p.email,
            name: p.name,
            avatarUri: p.avatarUri,
            fileId: p.fileId,
            accessToken: undefined, // Token loaded separately from SecureStore in loadData()
          });
          setUser(prev => ({
            ...prev,
            name: p.name || prev.name,
            avatarUri: p.avatarUri || prev.avatarUri,
          }));
        } else if (saved.authMode === 'local' && saved.localUsername) {
          setUser(prev => ({
            ...prev,
            name: saved.localUsername,
          }));
        }
      } else {
        // First launch — show onboarding
        setAuthState({ hasCompletedOnboarding: false, authMode: 'guest', localUsername: '' });
      }
    })();
  }, []);

  // Initialize sounds and notifications on mount
  React.useEffect(() => {
    initSounds();
    initNotifications();
  }, []);



  const handleAuthComplete = async (authMode: AuthMode, username: string) => {
    if (authMode !== 'google') {
      const newState = {
        hasCompletedOnboarding: true,
        authMode,
        localUsername: username,
        googleProfile: null,
      };
      setAuthState(newState);
      await saveAuthState(newState);
    }
    // Set user display name
    if (username && username !== 'Guest') {
      setUser(prev => ({ ...prev, name: username }));
    }
  };

  const STORAGE_KEY = 'strongern_app_data_v1';
  const CLOUD_PREFIX = 'strongern_cloud_backup_v1_';

  // Dynamic States (Clean production-ready default state)
  const [user, setUser] = React.useState<{
    name: string;
    totalWorkouts: number;
    isPro: boolean;
    avatarUri?: string;
  }>({
    name: 'Guest User',
    totalWorkouts: 0,
    isPro: false,
  });
  const [sessionsList, setSessionsList] = React.useState<any[]>([]);
  const [templatesList, setTemplatesList] = React.useState<any[]>([]);
  const [exercisesList, setExercisesList] = React.useState<any[]>(mockExercises);
  const [primaryMetricsList, setPrimaryMetricsList] = React.useState<any[]>(() =>
    mockPrimaryMetrics.map(m => ({ ...m, lastValue: undefined, history: [] }))
  );
  const [bodyPartMetricsList, setBodyPartMetricsList] = React.useState<any[]>(() =>
    mockBodyPartMetrics.map(m => ({ ...m, lastValue: undefined, history: [] }))
  );
  const [isAutoTimerEnabled, setIsAutoTimerEnabled] = React.useState(true);
  const [googleUser, setGoogleUser] = React.useState<{
    email: string;
    name: string;
    avatarUri?: string;
    accessToken?: string;
    fileId?: string;
  } | null>(null);
  const [animationSpeed, setAnimationSpeed] = React.useState(1);
  const [lastSynced, setLastSynced] = React.useState<string | null>(null);

  // Program & Folder States
  const [foldersList, setFoldersList] = React.useState<string[]>(['All', 'Bulking Splits', 'Home Workouts', 'Travel']);
  const [activeProgramId, setActiveProgramId] = React.useState<string | null>(null);
  const [programStartDate, setProgramStartDate] = React.useState<string | null>(null);

  // Smartwatch and Health States
  const [isWatchSimulatorVisible, setIsWatchSimulatorVisible] = React.useState(false);
  const [isHealthSyncEnabled, setIsHealthSyncEnabled] = React.useState(false);
  const [isLiveHeartRateEnabled, setIsLiveHeartRateEnabled] = React.useState(false);
  // isSocialShareVisible, isInsightsVisible, insightsData states removed (completion insights/share removed)

  // Custom Alert Modal State
  const [activeAlert, setActiveAlert] = React.useState<CustomAlertConfig | null>(null);

  React.useEffect(() => {
    setAlertListener((config) => {
      setActiveAlert(config);
    });
    return () => {
      setAlertListener(null);
    };
  }, []);

  // Language Change Listener
  React.useEffect(() => {
    const { setLanguageChangeListener } = require('./utils/i18n');
    setLanguageChangeListener(() => {
      setLanguageVersion(v => v + 1);
    });
    return () => {
      setLanguageChangeListener(null);
    };
  }, []);

  // Modular Toggles and Custom Sound Settings

  const [isProgramsEnabled, setIsProgramsEnabled] = React.useState(false);
  const [isHistoryEnabled, setIsHistoryEnabled] = React.useState(true);
  const [isMusclesEnabled, setIsMusclesEnabled] = React.useState(true);
  const [enableRoutineFolders, setEnableRoutineFolders] = React.useState(false);
  const [isDeveloperModeEnabled, setIsDeveloperModeEnabled] = React.useState(false);
  const [appTheme, setAppThemeState] = React.useState<string>('default');
  const [customAccentColor, setCustomAccentColor] = React.useState('#4F8EF7');
  const [themeVersion, setThemeVersion] = React.useState(0);

  const [languageVersion, setLanguageVersion] = React.useState(0); // Increment to trigger re-render on language change

  const [isProgressiveOverloadEnabled, setIsProgressiveOverloadEnabled] = React.useState(false);
  const [isAutoFinishSetEnabled, setIsAutoFinishSetEnabled] = React.useState(true);

  const [editingSessionId, setEditingSessionId] = React.useState<string | null>(null);
  const [isRpeMode, setIsRpeMode] = React.useState(true); // true = RPE, false = RIR
  const exerciseNameLanguage = i18n.locale.startsWith('he') ? 'he' as const : 'en' as const;


  const [soundSetCompleted, setSoundSetCompleted] = React.useState<string>('satisfying-click');
  const [soundWorkoutFinished, setSoundWorkoutFinished] = React.useState<string>('fanfare');
  const [soundTimerCompleted, setSoundTimerCompleted] = React.useState<string>('beep');
  const [customSounds, setCustomSounds] = React.useState<{ id: string; name: string; uri: string }[]>([]);
  const [soundVolume, setSoundVolume] = React.useState(0.8);

  // Rest Timer default settings & layout preferences
  const [defaultRestDuration, setDefaultRestDuration] = React.useState(90);
  const [showAchievementBadges, setShowAchievementBadges] = React.useState(false);
  const [showSummaryWidgets, setShowSummaryWidgets] = React.useState(false);
  const [showWeeklyTonnage, setShowWeeklyTonnage] = React.useState(false);
  const [showWorkoutsChart, setShowWorkoutsChart] = React.useState(true);
  const [showHighlights, setShowHighlights] = React.useState(false);
  const [showHypertrophyGoal, setShowHypertrophyGoal] = React.useState(false);


  // Dynamically calculate weekly chart data based on sessionsList (Monday start to match getWeeklyStreak)
  const dynamicWeeklyChartData = React.useMemo(() => {
    const weeks: { start: Date; end: Date; label: string; count: number }[] = [];
    const oneDay = 24 * 60 * 60 * 1000;
    
    for (let i = 7; i >= 0; i--) {
      const start = new Date(Date.now() - i * 7 * oneDay);
      const day = start.getDay();
      // Monday start: Sunday (0) shifts back 6 days, Monday-Saturday (1-6) shifts back (day - 1) days
      const diff = day === 0 ? 6 : day - 1;
      start.setTime(start.getTime() - diff * oneDay);
      start.setHours(0, 0, 0, 0);
      
      weeks.push({
        start,
        end: new Date(start.getTime() + 7 * oneDay - 1),
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        count: 0,
      });
    }
    
    sessionsList.forEach(session => {
      const sessDate = new Date(session.datetime);
      weeks.forEach(w => {
        if (sessDate >= w.start && sessDate <= w.end) {
          w.count++;
        }
      });
    });
    
    return weeks.map(w => ({ weekLabel: w.label, count: w.count }));
  }, [sessionsList]);

  // Load from database on mount
  React.useEffect(() => {
    async function loadData() {
      try {
        const dbReady = await initDb();
        if (dbReady) {
          const secureOverridesStr = await getSecureItem('theme_overrides');
          let parsedOverrides: any = {};
          if (secureOverridesStr) {
            try {
              parsedOverrides = JSON.parse(secureOverridesStr);
            } catch (e) {
              console.warn('Failed to parse theme overrides', e);
            }
          }
          const parsed = await loadFromDb(STORAGE_KEY);
          if (parsed) {
            if (parsed.user) {
              const currentAuth = await loadAuthState();
              const currentAuthMode = currentAuth?.authMode || parsed.authMode;
              const isAuthed = currentAuthMode === 'google' || currentAuthMode === 'local';
              const authedName = currentAuthMode === 'google' ? currentAuth?.googleProfile?.name : currentAuth?.localUsername;
              
              setUser(prev => ({
                ...parsed.user,
                name: (isAuthed && authedName) ? authedName : (parsed.user.name || prev.name),
                avatarUri: (currentAuthMode === 'google' && currentAuth?.googleProfile?.avatarUri) ? currentAuth.googleProfile.avatarUri : (parsed.user.avatarUri || prev.avatarUri),
              }));
            }
            if (parsed.sessionsList) {
              setSessionsList(parsed.sessionsList.map((s: any) => ({
                ...s,
                datetime: new Date(s.datetime)
              })));
            }
            if (parsed.templatesList) {
              setTemplatesList(parsed.templatesList.map((t: any) => ({
                ...t,
                lastUsed: new Date(t.lastUsed)
              })));
            }
            if (parsed.exercisesList) {
              const loadedIds = new Set(parsed.exercisesList.map((e: any) => e.id));
              const loadedNames = new Set(parsed.exercisesList.map((e: any) => e.name.toLowerCase().trim()));
              const merged = [...parsed.exercisesList];
              mockExercises.forEach((defaultEx) => {
                if (!loadedIds.has(defaultEx.id) && !loadedNames.has(defaultEx.name.toLowerCase().trim())) {
                  merged.push(defaultEx);
                }
              });
              setExercisesList(merged);
            }
            if (parsed.primaryMetricsList) setPrimaryMetricsList(parsed.primaryMetricsList);
            if (parsed.bodyPartMetricsList) setBodyPartMetricsList(parsed.bodyPartMetricsList);
            if (parsed.isAutoTimerEnabled !== undefined) setIsAutoTimerEnabled(parsed.isAutoTimerEnabled);
            if (parsed.googleUser !== undefined) {
              const secureToken = await getSecureItem('google_oauth_token');
              if (parsed.googleUser && secureToken) {
                setGoogleUser({ ...parsed.googleUser, accessToken: secureToken });
              } else {
                setGoogleUser(parsed.googleUser);
              }
            }
            if (parsed.animationSpeed !== undefined) setAnimationSpeed(parsed.animationSpeed);
            if (parsed.lastSynced !== undefined) setLastSynced(parsed.lastSynced);
            if (parsed.foldersList) setFoldersList(parsed.foldersList);
            if (parsed.activeProgramId !== undefined) setActiveProgramId(parsed.activeProgramId);
            if (parsed.programStartDate !== undefined) setProgramStartDate(parsed.programStartDate);
            if (parsed.isHealthSyncEnabled !== undefined) setIsHealthSyncEnabled(parsed.isHealthSyncEnabled);
            if (parsed.isLiveHeartRateEnabled !== undefined) setIsLiveHeartRateEnabled(parsed.isLiveHeartRateEnabled);

            if (parsed.isProgramsEnabled !== undefined) setIsProgramsEnabled(parsed.isProgramsEnabled);
            if (parsed.isHistoryEnabled !== undefined) setIsHistoryEnabled(parsed.isHistoryEnabled);
            if (parsed.isMusclesEnabled !== undefined) setIsMusclesEnabled(parsed.isMusclesEnabled);
            if (parsed.enableRoutineFolders !== undefined) setEnableRoutineFolders(parsed.enableRoutineFolders);
            if (parsed.isDeveloperModeEnabled !== undefined) setIsDeveloperModeEnabled(parsed.isDeveloperModeEnabled);
            if (parsed.customAccentColor !== undefined) setCustomAccentColor(parsed.customAccentColor);
            if (parsed.appTheme !== undefined) {
              setAppThemeState(parsed.appTheme);
              const { applyTheme } = require('./theme');
              applyTheme(parsed.appTheme, parsed.customAccentColor || '#4F8EF7', parsedOverrides);
            } else {
              const { applyTheme } = require('./theme');
              applyTheme('default', '#4F8EF7', parsedOverrides);
            }
            if (parsed.isProgressiveOverloadEnabled !== undefined) setIsProgressiveOverloadEnabled(parsed.isProgressiveOverloadEnabled);
            if (parsed.isAutoFinishSetEnabled !== undefined) setIsAutoFinishSetEnabled(parsed.isAutoFinishSetEnabled);

            if (parsed.isRpeMode !== undefined) setIsRpeMode(parsed.isRpeMode);
            if (parsed.soundSetCompleted !== undefined) setSoundSetCompleted(parsed.soundSetCompleted);
            if (parsed.soundWorkoutFinished !== undefined) setSoundWorkoutFinished(parsed.soundWorkoutFinished);
            if (parsed.soundTimerCompleted !== undefined) setSoundTimerCompleted(parsed.soundTimerCompleted);
            if (parsed.customSounds !== undefined) setCustomSounds(parsed.customSounds);
            if (parsed.soundVolume !== undefined) setSoundVolume(parsed.soundVolume);
            if (parsed.defaultRestDuration !== undefined) setDefaultRestDuration(parsed.defaultRestDuration);
            if (parsed.showAchievementBadges !== undefined) setShowAchievementBadges(parsed.showAchievementBadges);
            if (parsed.showSummaryWidgets !== undefined) setShowSummaryWidgets(parsed.showSummaryWidgets);
            if (parsed.showWeeklyTonnage !== undefined) setShowWeeklyTonnage(parsed.showWeeklyTonnage);
            if (parsed.showWorkoutsChart !== undefined) setShowWorkoutsChart(parsed.showWorkoutsChart);
            if (parsed.showHighlights !== undefined) setShowHighlights(parsed.showHighlights);
            if (parsed.showHypertrophyGoal !== undefined) setShowHypertrophyGoal(parsed.showHypertrophyGoal);
          } else {
            const { applyTheme } = require('./theme');
            applyTheme('default', '#4F8EF7', parsedOverrides);
          }

          // Restore active workout state from DB (cross-platform)
          try {
            const savedWorkout = await loadFromDb('strongern_active_workout_state');
            console.log('[RESTORE] Loaded workout state:', savedWorkout ? 'found' : 'not found');
            if (savedWorkout && savedWorkout.workoutExercises && savedWorkout.workoutExercises.length > 0 && savedWorkout.workoutName && savedWorkout.workoutName !== 'Empty Workout') {
              console.log('[RESTORE] Restoring', savedWorkout.workoutExercises.length, 'exercises');
              setIsWorkoutActive(true);
              if (savedWorkout.workoutName) setWorkoutName(savedWorkout.workoutName);
              if (savedWorkout.startTime) setStartTime(new Date(savedWorkout.startTime));
              setWorkoutExercises(savedWorkout.workoutExercises);
              if (savedWorkout.isWorkoutModalVisible !== undefined) setIsWorkoutModalVisible(savedWorkout.isWorkoutModalVisible);
              if (savedWorkout.comment !== undefined) setActiveWorkoutComment(savedWorkout.comment || '');
            } else {
              console.log('[RESTORE] No valid non-empty workout found in saved state, purging');
              setIsWorkoutActive(false);
              setIsWorkoutModalVisible(false);
              deleteFromDb('strongern_active_workout_state');
            }
          } catch (e) {
            console.warn('Error restoring active workout state', e);
          }
          setIsWorkoutRestored(true);
        }
      } catch (e) {
        console.warn('Error loading persisted state', e);
      } finally {
        setIsDataLoaded(true);
      }
    }
    loadData();
  }, []);

  // Set document body background color on Web to match AMOLED pure black
  React.useEffect(() => {
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.backgroundColor = '#0D0F14';
    }
  }, []);

  // Save to database on state changes
  React.useEffect(() => {
    if (!isDataLoaded) return;
    try {
      const googleUserToSave = googleUser ? { ...googleUser, accessToken: undefined } : null;
      const data = {
        user,
        sessionsList,
        templatesList,
        exercisesList,
        primaryMetricsList,
        bodyPartMetricsList,
        isAutoTimerEnabled,
        googleUser: googleUserToSave,
        animationSpeed,
        lastSynced,
        foldersList,
        activeProgramId,
        programStartDate,
        isHealthSyncEnabled,
        isLiveHeartRateEnabled,

        isProgramsEnabled,
        isHistoryEnabled,
        isMusclesEnabled,
        soundSetCompleted,
        soundWorkoutFinished,
        soundTimerCompleted,
        customSounds,
        soundVolume,
        defaultRestDuration,
        showAchievementBadges,
        showSummaryWidgets,
        showWeeklyTonnage,
        showWorkoutsChart,
        showHighlights,
        showHypertrophyGoal,
        enableRoutineFolders,
        isDeveloperModeEnabled,
        isProgressiveOverloadEnabled,
        isAutoFinishSetEnabled,
        isRpeMode,
        appTheme,
        customAccentColor,
      };
      saveToDb(STORAGE_KEY, data);
    } catch (e) {
      console.warn('Error saving state to database', e);
    }
  }, [user, sessionsList, templatesList, exercisesList, primaryMetricsList, bodyPartMetricsList, isAutoTimerEnabled, googleUser, animationSpeed, lastSynced, foldersList, activeProgramId, programStartDate, isHealthSyncEnabled, isLiveHeartRateEnabled, isProgramsEnabled, isHistoryEnabled, isMusclesEnabled, soundSetCompleted, soundWorkoutFinished, soundTimerCompleted, customSounds, soundVolume, defaultRestDuration, showAchievementBadges, showSummaryWidgets, showWeeklyTonnage, showWorkoutsChart, showHighlights, showHypertrophyGoal, enableRoutineFolders, isDeveloperModeEnabled, isProgressiveOverloadEnabled, isAutoFinishSetEnabled, isRpeMode, appTheme, customAccentColor, isDataLoaded]);

  // Auto-sync state changes to Google Drive
  const isInitialLoadRef = React.useRef(true);
  
  const handleGoogleSessionExpired = React.useCallback(async () => {
    setGoogleUser(prev => prev ? { ...prev, accessToken: undefined } : null);
    await deleteSecureItem('google_oauth_token');
    const currentAuth = await loadAuthState();
    if (currentAuth && currentAuth.googleProfile) {
      await saveGoogleProfile({
        ...currentAuth.googleProfile,
        tokenExpiresAt: undefined,
      });
    }
  }, []);

  React.useEffect(() => {
    if (!isDataLoaded) return;
    
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    if (!googleUser || !googleUser.accessToken) return;

    const delayDebounceFn = setTimeout(async () => {
      console.log('[Auto-Sync] Commencing automatic Google Drive backup update...');
      try {
        const nowStr = new Date().toISOString();
        const backupData = {
          user,
          sessionsList,
          templatesList,
          exercisesList,
          primaryMetricsList,
          bodyPartMetricsList,
          isAutoTimerEnabled,
          timestamp: nowStr,
          lastSynced: nowStr,
        };

        let fileId = googleUser.fileId;
        let fileIdUpdated = false;
        if (!fileId) {
          const foundId = await googleDrive.findBackupFile(googleUser.accessToken!);
          if (foundId) {
            fileId = foundId;
            fileIdUpdated = true;
          }
        }

        if (fileId) {
          await googleDrive.updateBackupFile(googleUser.accessToken!, fileId, backupData);
        } else {
          fileId = await googleDrive.createBackupFile(googleUser.accessToken!, backupData);
          fileIdUpdated = true;
        }

        if (fileIdUpdated) {
          const updatedFileId = fileId;
          setGoogleUser(prev => prev ? { ...prev, fileId: updatedFileId } : null);
          const currentAuth = await loadAuthState();
          if (currentAuth && currentAuth.googleProfile) {
            await saveGoogleProfile({
              ...currentAuth.googleProfile,
              fileId: updatedFileId,
            });
          }
        }

        setLastSynced(nowStr);
        console.log('[Auto-Sync] Automatic backup completed successfully.');
      } catch (e: any) {
        console.warn('[Auto-Sync Error]', e);
        if (e.message && (
          e.message.includes('401') || 
          e.message.toLowerCase().includes('unauthorized') || 
          e.message.toLowerCase().includes('invalid credentials') || 
          e.message.toLowerCase().includes('auth')
        )) {
          console.warn('[Auto-Sync] Access token invalid or expired. Triggering reconnect.');
          await handleGoogleSessionExpired();
        }
      }
    }, 2000);

    return () => clearTimeout(delayDebounceFn);
  }, [user, sessionsList, templatesList, exercisesList, primaryMetricsList, bodyPartMetricsList, isAutoTimerEnabled, googleUser]);

  // Synchronize audio preferences to soundConfig helper
  React.useEffect(() => {
    soundConfig.setChecked = soundSetCompleted;
    soundConfig.workoutCompleted = soundWorkoutFinished;
    soundConfig.timerCompleted = soundTimerCompleted;
    soundConfig.volume = soundVolume;
    soundConfig.customSounds = customSounds;
  }, [soundSetCompleted, soundWorkoutFinished, soundTimerCompleted, soundVolume, customSounds]);



  // Synchronize dynamic global animation speed token
  React.useEffect(() => {
    globalAnimation.speed = animationSpeed;
  }, [animationSpeed]);

  // Google Sync & Real Cloud Backup logic using Google Drive API
  const handleGoogleLogin = async (
    email: string,
    name: string,
    accessToken?: string,
    fileId?: string,
    avatarUri?: string
  ) => {
    setGoogleUser({ email, name, accessToken, fileId, avatarUri });
    
    // We update the local React state authState to instantly re-render listening screens/components in 'google' mode!
    const newAuthState = {
      hasCompletedOnboarding: true,
      authMode: 'google' as AuthMode,
      localUsername: name,
      googleProfile: {
        email,
        name,
        avatarUri,
        fileId,
        tokenExpiresAt: accessToken ? Date.now() + 55 * 60 * 1000 : undefined,
      }
    };
    setAuthState(newAuthState);

    if (accessToken) {
      await setSecureItem('google_oauth_token', accessToken);
    }

    // Persist Google profile to authStore so it survives app restarts
    // Token expiry: Google access tokens last ~1 hour from issuance
    await saveGoogleProfile({
      email,
      name,
      avatarUri,
      fileId,
      tokenExpiresAt: accessToken ? Date.now() + 55 * 60 * 1000 : undefined, // 55 min
    });

    let mergedDataToUpload = null;
    let backupFoundAndMerged = false;

    // Check if real Google Drive backup exists and auto-restore / merge it!
    if (accessToken && fileId) {
      try {
        const backupData = await googleDrive.downloadBackupFile(accessToken, fileId);
        if (backupData) {
          backupFoundAndMerged = true;

          // 1. Merge Sessions (deduplicating by ID)
          const localSessions = sessionsList || [];
          const remoteSessions = backupData.sessionsList || [];
          const mergedSessions = [...localSessions];
          remoteSessions.forEach((rs: any) => {
            if (!mergedSessions.some(ls => ls.id === rs.id)) {
              mergedSessions.push({
                ...rs,
                datetime: new Date(rs.datetime)
              });
            }
          });
          mergedSessions.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
          setSessionsList(mergedSessions);

          // 2. Merge User Profile details
          const mergedUser = {
            ...user,
            name: name || user.name,
            avatarUri: avatarUri || user.avatarUri,
            totalWorkouts: mergedSessions.length,
            isPro: user.isPro || backupData.user?.isPro || false,
          };
          setUser(mergedUser);

          // 3. Merge Templates (deduplicating by ID)
          const localTemplates = templatesList || [];
          const remoteTemplates = backupData.templatesList || [];
          const mergedTemplates = [...localTemplates];
          remoteTemplates.forEach((rt: any) => {
            if (!mergedTemplates.some(lt => lt.id === rt.id)) {
              mergedTemplates.push({
                ...rt,
                lastUsed: new Date(rt.lastUsed)
              });
            }
          });
          setTemplatesList(mergedTemplates);

          // 4. Merge Exercises (deduplicating by ID or name)
          const localExercises = exercisesList || [];
          const remoteExercises = backupData.exercisesList || [];
          const mergedExercises = [...localExercises];
          remoteExercises.forEach((re: any) => {
            const isDuplicate = mergedExercises.some(
              le => le.id === re.id || le.name.toLowerCase().trim() === re.name.toLowerCase().trim()
            );
            if (!isDuplicate) {
              mergedExercises.push(re);
            }
          });
          setExercisesList(mergedExercises);

          // 5. Merge Metrics
          const mergedPrimaryMetrics = mergeMetricsList(primaryMetricsList || [], backupData.primaryMetricsList || []);
          setPrimaryMetricsList(mergedPrimaryMetrics);

          const mergedBodyPartMetrics = mergeMetricsList(bodyPartMetricsList || [], backupData.bodyPartMetricsList || []);
          setBodyPartMetricsList(mergedBodyPartMetrics);

          // Set lastSynced timestamp
          const nowStr = new Date().toISOString();
          setLastSynced(nowStr);

          // Prepare merged data to write back to Google Drive
          mergedDataToUpload = {
            user: mergedUser,
            sessionsList: mergedSessions,
            templatesList: mergedTemplates,
            exercisesList: mergedExercises,
            primaryMetricsList: mergedPrimaryMetrics,
            bodyPartMetricsList: mergedBodyPartMetrics,
            isAutoTimerEnabled,
            timestamp: nowStr,
            lastSynced: nowStr,
          };
        }
      } catch (e) {
        console.warn('Error auto-restoring backup from Google Drive', e);
      }
    }

    // If backup wasn't found (first time connecting), we just link by setting user name/avatar details
    if (!backupFoundAndMerged) {
      setUser(prev => ({
        ...prev,
        name: name || prev.name,
        avatarUri: avatarUri || prev.avatarUri,
      }));
    }

    // Immediately upload the merged data to Google Drive so the cloud is up to date
    if (accessToken) {
      try {
        const nowStr = new Date().toISOString();
        const finalBackupData = mergedDataToUpload || {
          user: {
            ...user,
            name: name || user.name,
            avatarUri: avatarUri || user.avatarUri,
          },
          sessionsList,
          templatesList,
          exercisesList,
          primaryMetricsList,
          bodyPartMetricsList,
          isAutoTimerEnabled,
          timestamp: nowStr,
          lastSynced: nowStr,
        };

        let activeFileId = fileId;
        if (!activeFileId) {
          activeFileId = await googleDrive.createBackupFile(accessToken, finalBackupData);
          setGoogleUser(prev => prev ? { ...prev, fileId: activeFileId } : { email, name, accessToken, fileId: activeFileId, avatarUri });
          // Update saved profile with the fileId
          await saveGoogleProfile({
            email,
            name,
            avatarUri,
            fileId: activeFileId,
            tokenExpiresAt: accessToken ? Date.now() + 55 * 60 * 1000 : undefined,
          });
        } else {
          await googleDrive.updateBackupFile(accessToken, activeFileId, finalBackupData);
        }
        setLastSynced(nowStr);
        console.log('[App] SQLite-to-Drive sync completed successfully.');
      } catch (syncErr) {
        console.error('[App] SQLite-to-Drive sync failed:', syncErr);
      }
    }

    return backupFoundAndMerged;
  };

  // ── Deep Link OAuth Parser ──
  const parseAndHandleOAuthLink = async (url: string) => {
    if (!url || !url.includes('strongern://oauth-callback')) return;
    
    let accessToken = '';
    const hashSplit = url.split('#');
    const querySplit = url.split('?');
    
    const parseParams = (paramString: string) => {
      const params: Record<string, string> = {};
      const pairs = paramString.split('&');
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      }
      return params;
    };
    
    if (hashSplit.length > 1) {
      const params = parseParams(hashSplit[1]);
      if (params.access_token) accessToken = params.access_token;
    }
    
    if (!accessToken && querySplit.length > 1) {
      const params = parseParams(querySplit[1]);
      if (params.access_token) accessToken = params.access_token;
      else if (params.token) accessToken = params.token;
    }
    
    if (accessToken) {
      console.log('[App] Extracted OAuth access token from deep link. Authenticating...');
      try {
        const [profile, fileId] = await Promise.all([
          googleDrive.fetchUserProfile(accessToken),
          googleDrive.findBackupFile(accessToken),
        ]);
        
        await handleGoogleLogin(
          profile.email,
          profile.name,
          accessToken,
          fileId || undefined,
          profile.avatarUri
        );
      } catch (err) {
        console.error('[App] Failed to handle Google OAuth from deep link:', err);
        const newState = { hasCompletedOnboarding: true, authMode: 'guest' as AuthMode, localUsername: 'Guest' };
        setAuthState(newState);
        await saveAuthState(newState);
        setUser(prev => ({ ...prev, name: 'Guest User' }));
      }
    }
  };

  React.useEffect(() => {
    if (!isDataLoaded) return;
    
    const handleDeepLink = async (event: { url: string }) => {
      await parseAndHandleOAuthLink(event.url);
    };

    const getInitialLink = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await parseAndHandleOAuthLink(initialUrl);
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    getInitialLink();

    return () => {
      subscription.remove();
    };
  }, [isDataLoaded]);


  const handleGoogleLogout = async () => {
    setGoogleUser(null);
    await deleteSecureItem('google_oauth_token');
  };

  const handleAppLogout = async () => {
    if (googleUser) {
      await handleGoogleLogout();
    }
    const { resetAuthState } = await import('./utils/authStore');
    await resetAuthState();
    setAuthState({
      hasCompletedOnboarding: false,
      authMode: 'guest',
      localUsername: '',
    });
    setUser({
      name: 'Guest User',
      totalWorkouts: 0,
      isPro: false,
    });
  };


  const handleCloudSync = async () => {
    if (!googleUser || !googleUser.accessToken) return false;
    try {
      const nowStr = new Date().toISOString();
      const backupData = {
        user,
        sessionsList,
        templatesList,
        exercisesList,
        primaryMetricsList,
        bodyPartMetricsList,
        isAutoTimerEnabled,
        timestamp: nowStr,
        lastSynced: nowStr,
      };

      let fileId = googleUser.fileId;
      if (!fileId) {
        const foundId = await googleDrive.findBackupFile(googleUser.accessToken);
        if (foundId) {
          fileId = foundId;
        }
      }

      if (fileId) {
        await googleDrive.updateBackupFile(googleUser.accessToken, fileId, backupData);
      } else {
        const newFileId = await googleDrive.createBackupFile(googleUser.accessToken, backupData);
        setGoogleUser(prev => prev ? { ...prev, fileId: newFileId } : null);
      }

      setLastSynced(nowStr);
      return true;
    } catch (e) {
      console.error('[Google Sync Error]', e);
      return false;
    }
  };

  // Export/Import backups
  const handleExportBackup = async (): Promise<boolean> => {
    const settings = {
      isAutoTimerEnabled,
      defaultRestDuration,
      soundSetCompleted,
      soundWorkoutFinished,
      soundTimerCompleted,
      soundVolume,

      isProgramsEnabled,
      isHistoryEnabled,
      isMusclesEnabled,
      enableRoutineFolders,
      showAchievementBadges,
      showSummaryWidgets,
      showWeeklyTonnage,
      showWorkoutsChart,
      showHighlights,
      animationSpeed,
      isProgressiveOverloadEnabled,
      isAutoFinishSetEnabled,

      isRpeMode,
      showHypertrophyGoal,
    };
    const backupData = buildBackupData({
      username: user.name,
      user,
      sessionsList,
      templatesList,
      exercisesList,
      primaryMetricsList,
      bodyPartMetricsList,
      settings,
    });
    return exportBackupToFile(backupData);
  };

  /** Build a legacy JSON string (for the CSV/text export path) */
  const handleExportBackupString = (): string => {
    const data = {
      user,
      sessionsList,
      templatesList,
      exercisesList,
      primaryMetricsList,
      bodyPartMetricsList,
      isAutoTimerEnabled,
      exportTimestamp: new Date().toISOString(),
      lastSynced,
    };
    return JSON.stringify(data);
  };

  const handleImportBackup = (backupStr: string): boolean => {
    try {
      const parsed = JSON.parse(backupStr);
      return applyBackupData(parsed);
    } catch (e) {
      console.warn('Error importing backup', e);
      return false;
    }
  };

  /** Shared logic to apply any parsed backup object (used by both paste-import and file-restore) */
  const applyBackupData = (parsed: any): boolean => {
    try {
      if (parsed.user) {
        setUser({
          ...parsed.user,
          totalWorkouts: parsed.sessionsList ? parsed.sessionsList.length : (parsed.user.totalWorkouts || 0)
        });
      }
      if (parsed.sessionsList) {
        setSessionsList(parsed.sessionsList.map((s: any) => ({
          ...s,
          datetime: new Date(s.datetime)
        })));
      }
      if (parsed.templatesList) {
        setTemplatesList(parsed.templatesList.map((t: any) => ({
          ...t,
          lastUsed: new Date(t.lastUsed)
        })));
      }
      if (parsed.exercisesList) setExercisesList(parsed.exercisesList);
      if (parsed.primaryMetricsList) setPrimaryMetricsList(parsed.primaryMetricsList);
      if (parsed.bodyPartMetricsList) setBodyPartMetricsList(parsed.bodyPartMetricsList);
      if (parsed.lastSynced) setLastSynced(parsed.lastSynced);
      // Apply settings from v2 format (nested under `settings`) or v1 format (flat)
      const s = parsed.settings || parsed;
      if (s.isAutoTimerEnabled !== undefined) setIsAutoTimerEnabled(s.isAutoTimerEnabled);
      if (s.defaultRestDuration !== undefined) setDefaultRestDuration(s.defaultRestDuration);
      if (s.soundSetCompleted !== undefined) setSoundSetCompleted(s.soundSetCompleted);
      if (s.soundWorkoutFinished !== undefined) setSoundWorkoutFinished(s.soundWorkoutFinished);
      if (s.soundTimerCompleted !== undefined) setSoundTimerCompleted(s.soundTimerCompleted);
      if (s.soundVolume !== undefined) setSoundVolume(s.soundVolume);

      if (s.isProgramsEnabled !== undefined) setIsProgramsEnabled(s.isProgramsEnabled);
      if (s.isHistoryEnabled !== undefined) setIsHistoryEnabled(s.isHistoryEnabled);
      if (s.isMusclesEnabled !== undefined) setIsMusclesEnabled(s.isMusclesEnabled);
      if (s.enableRoutineFolders !== undefined) setEnableRoutineFolders(s.enableRoutineFolders);
      if (s.showAchievementBadges !== undefined) setShowAchievementBadges(s.showAchievementBadges);
      if (s.showSummaryWidgets !== undefined) setShowSummaryWidgets(s.showSummaryWidgets);
      if (s.showWeeklyTonnage !== undefined) setShowWeeklyTonnage(s.showWeeklyTonnage);
      if (s.showWorkoutsChart !== undefined) setShowWorkoutsChart(s.showWorkoutsChart);
      if (s.showHighlights !== undefined) setShowHighlights(s.showHighlights);
      if (s.showHypertrophyGoal !== undefined) setShowHypertrophyGoal(s.showHypertrophyGoal);
      if (s.animationSpeed !== undefined) setAnimationSpeed(s.animationSpeed);
      if (s.isProgressiveOverloadEnabled !== undefined) setIsProgressiveOverloadEnabled(s.isProgressiveOverloadEnabled);
      if (s.isAutoFinishSetEnabled !== undefined) setIsAutoFinishSetEnabled(s.isAutoFinishSetEnabled);
      if (s.isKeyboardDismissOnNextEnabled !== undefined) { /* always-on, ignored */ }
      if (s.isRpeMode !== undefined) setIsRpeMode(s.isRpeMode);
      return true;
    } catch (e) {
      console.warn('Error applying backup data', e);
      return false;
    }
  };

  /**
   * Called when user picks a backup file on the LoginScreen (post-reinstall restore).
   * Applies all data, then the login flow calls handleAuthComplete automatically.
   */
  const handleRestoreBackup = async (backupData: BackupData, username: string): Promise<boolean> => {
    try {
      const success = applyBackupData(backupData);
      if (success) {
        // Also update the user name to match the restored profile
        if (username) {
          setUser(prev => ({ ...prev, name: username }));
        }
      }
      return success;
    } catch (e) {
      console.warn('[App] handleRestoreBackup error:', e);
      return false;
    }
  };

  const handleImportStrongCSV = (csvText: string): { importedCount: number; addedExercisesCount: number } => {
    try {
      const { importedSessions, addedExercises } = importStrongCSV(csvText, exercisesList, sessionsList);
      
      if (importedSessions.length > 0) {
        setSessionsList(prev => [...importedSessions, ...prev]);
        setUser(prev => ({
          ...prev,
          totalWorkouts: sessionsList.length + importedSessions.length
        }));
      }
      
      if (addedExercises.length > 0) {
        setExercisesList(prev => [...addedExercises, ...prev]);
      }
      
      return {
        importedCount: importedSessions.length,
        addedExercisesCount: addedExercises.length,
      };
    } catch (e) {
      console.warn('Error importing Strong CSV', e);
      throw e;
    }
  };

  const handleExportCSV = (): string => {
    let csv = 'Session ID,Date,Title,Duration (min),Volume (kg),PRs,Exercise Name,Sets,Best Weight (kg),Best Reps\n';
    sessionsList.forEach((session: any) => {
      const dateStr = new Date(session.datetime).toISOString();
      session.exercises.forEach((ex: any) => {
        const cleanTitle = session.title.replace(/"/g, '""');
        const cleanExName = ex.name.replace(/"/g, '""');
        csv += `"${session.id}","${dateStr}","${cleanTitle}",${session.durationMinutes},${session.totalVolumeKg},${session.prs},"${cleanExName}",${ex.sets},${ex.bestWeight},${ex.bestReps}\n`;
      });
    });
    return csv;
  };

  // Dynamic state modifiers
  const handleAddExercise = React.useCallback((name: string, muscleGroup: string, equipment?: string, isUnilateral?: boolean) => {
    const newEx = {
      id: `ex-custom-${Date.now()}`,
      name,
      muscleGroup,
      allTimeSets: 0,
      equipment: equipment || 'Other',
      isUnilateral: isUnilateral || false,
    };
    setExercisesList(prev => [newEx, ...prev]);
    return newEx;
  }, []);

  const handleDeleteExercise = React.useCallback((id: string) => {
    setExercisesList(prev => prev.filter(e => e.id !== id));
  }, []);

  const handleUpdateExerciseNotes = React.useCallback((id: string, notes?: string) => {
    setExercisesList(prev => prev.map(e => e.id === id ? { ...e, notes } : e));
  }, []);

  const handleUpdateExercise = React.useCallback((id: string, name: string, muscleGroup: string, equipment: string, isUnilateral: boolean) => {
    setExercisesList(prev => prev.map(e => e.id === id ? { ...e, name, muscleGroup, equipment, isUnilateral } : e));
  }, []);

  const handleAddTemplate = React.useCallback((name: string, exerciseNames: string[], folder?: string, exercisesDetails?: any[]) => {
    const newTpl = {
      id: `tpl-custom-${Date.now()}`,
      name,
      exercises: exerciseNames,
      exercisesDetails,
      lastUsed: new Date(),
      folder,
    };
    setTemplatesList(prev => [newTpl, ...prev]);
  }, []);

  const handleDeleteTemplate = React.useCallback((id: string) => {
    setTemplatesList(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleUpdateTemplate = React.useCallback((id: string, name: string, exerciseNames: string[], folder?: string, exercisesDetails?: any[]) => {
    setTemplatesList(prev => prev.map(t => t.id === id ? { ...t, name, exercises: exerciseNames, folder, exercisesDetails } : t));
  }, []);

  const handleReorderTemplates = React.useCallback((newTemplates: any[]) => {
    setTemplatesList(prev => {
      const reorderedIds = new Set(newTemplates.map(t => t.id));
      const result: any[] = [];
      let newTemplatesIdx = 0;
      prev.forEach(item => {
        if (reorderedIds.has(item.id)) {
          result.push(newTemplates[newTemplatesIdx++]);
        } else {
          result.push(item);
        }
      });
      return result;
    });
  }, []);



  const mergeMetricsList = mergeMetricsListFn;

  const handleRecordMetric = (id: string, newValue: string) => {
    const numericVal = parseMetricValue(newValue);
    const todayStr = new Date().toISOString().split('T')[0];

    const updater = (m: any) => {
      if (m.id !== id) return m;
      const history = m.history ? [...m.history] : [];
      const existingIndex = history.findIndex((h: any) => h.date === todayStr);
      if (existingIndex > -1) {
        history[existingIndex] = { date: todayStr, value: numericVal };
      } else {
        history.push({ date: todayStr, value: numericVal });
      }
      history.sort((a: any, b: any) => a.date.localeCompare(b.date));
      const formatted = formatMetricValue(numericVal, m.label);
      return { ...m, lastValue: formatted, history };
    };

    setPrimaryMetricsList(prev => prev.map(updater));
    setBodyPartMetricsList(prev => prev.map(updater));
  };

  const handleDeleteMetricLog = (id: string, date: string) => {
    const updater = (m: any) => {
      if (m.id !== id) return m;
      const history = (m.history || []).filter((h: any) => h.date !== date);
      let lastValue = undefined;
      if (history.length > 0) {
        const latest = history[history.length - 1];
        lastValue = formatMetricValue(latest.value, m.label);
      }
      return { ...m, lastValue, history };
    };
    setPrimaryMetricsList(prev => prev.map(updater));
    setBodyPartMetricsList(prev => prev.map(updater));
  };

  const handleAddMetric = (label: string, isPrimary: boolean) => {
    const newMetric = {
      id: `metric-custom-${Date.now()}`,
      label,
      lastValue: undefined,
      history: [],
    };
    if (isPrimary) {
      setPrimaryMetricsList(prev => [...prev, newMetric]);
    } else {
      setBodyPartMetricsList(prev => [...prev, newMetric]);
    }
  };

  const handleUpdateUser = (name: string) => {
    setUser(prev => ({ ...prev, name }));
  };

  const handleAddFolder = React.useCallback((name: string) => {
    setFoldersList(prev => prev.includes(name) ? prev : [...prev, name]);
  }, []);

  const handleRemoveFolder = React.useCallback((name: string) => {
    setFoldersList(prev => prev.filter(f => f !== name));
    setTemplatesList(prev => prev.map(t => t.folder === name ? { ...t, folder: undefined } : t));
  }, []);

  const handleSubscribeProgram = React.useCallback((programId: string | null) => {
    setActiveProgramId(programId);
    setProgramStartDate(programId ? new Date().toISOString() : null);
  }, []);

  const handleWipeAllData = () => {
    setUser({
      name: 'Guest User',
      totalWorkouts: 0,
      isPro: false,
    });
    setSessionsList([]);
    setTemplatesList([]);
    setGoogleUser(null);
    setLastSynced(null);
    deleteSecureItem('google_oauth_token');
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Measure modal state (accessed from Profile)
  const [isMeasureModalVisible, setIsMeasureModalVisible] = React.useState(false);

  // Compute weekly muscle sets from sessions in the last 7 days
  const weeklyMuscleSets = React.useMemo(() => {
    const exerciseMuscleMap: Record<string, string> = {};
    exercisesList.forEach(ex => {
      if (ex && ex.name) {
        exerciseMuscleMap[ex.name.toLowerCase()] = ex.muscleGroup;
      }
    });
    const nameToMuscle = (name: string): string => {
      if (!name) return 'Other';
      const n = name.toLowerCase();
      if (n.includes('squat') || n.includes('leg press') || n.includes('quad')) return 'Quads';
      if (n.includes('deadlift') || n.includes('row') || n.includes('pull') || n.includes('lat')) return 'Back';
      if (n.includes('bench') || n.includes('fly') || n.includes('chest') || n.includes('pec')) return 'Chest';
      if (n.includes('press') && (n.includes('overhead') || n.includes('shoulder') || n.includes('military'))) return 'Shoulders';
      if (n.includes('curl') || n.includes('bicep')) return 'Biceps';
      if (n.includes('tricep') || n.includes('pushdown') || n.includes('dip') || n.includes('skull')) return 'Triceps';
      if (n.includes('hamstring') || n.includes('nordic') || n.includes('leg curl') || n.includes('romanian')) return 'Hamstrings';
      if (n.includes('glute') || n.includes('hip thrust')) return 'Glutes';
      if (n.includes('lateral raise') || n.includes('rear delt') || n.includes('face pull')) return 'Rear Delts';
      if (n.includes('calf')) return 'Calves';
      if (n.includes('forearm') || n.includes('wrist') || n.includes('roller')) return 'Forearms';
      if (n.includes('ab ') || n.includes('crunch') || n.includes('plank') || n.includes('sit up') || n.includes('twist') || n.includes('leg raise')) return 'Abs';
      
      const mapped = exerciseMuscleMap[n];
      if (mapped === 'Core') return 'Abs';
      return mapped ?? 'Other';
    };
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sets: Record<string, number> = {};
    sessionsList.forEach((session: any) => {
      if (!session || !session.datetime) return;
      if (new Date(session.datetime) < cutoff) return;
      if (session.exercises && Array.isArray(session.exercises)) {
        session.exercises.forEach((ex: any) => {
          if (ex && ex.name) {
            const muscle = nameToMuscle(ex.name);
            sets[muscle] = (sets[muscle] ?? 0) + (ex.sets || 0);
          }
        });
      }
    });
    return sets;
  }, [sessionsList, exercisesList]);



  // Active workout management states
  const [isWorkoutActive, setIsWorkoutActive] = React.useState(false);
  const [workoutName, setWorkoutName] = React.useState("");
  const [startTime, setStartTime] = React.useState<Date>(() => new Date());
  const [workoutExercises, setWorkoutExercises] = React.useState<any[]>([]);
  const [isWorkoutModalVisible, setIsWorkoutModalVisible] = React.useState(false);
  const [activeWorkoutComment, setActiveWorkoutComment] = React.useState("");
  const [completionData, setCompletionData] = React.useState<{
    totalVolume: number;
    totalSets: number;
    durationMin: number;
    name: string;
  } | null>(null);

  // Handle notification taps & cold starts
  React.useEffect(() => {
    const unsubscribe = onNotificationTapped((response) => {
      if (isWorkoutNotificationResponse(response) && isWorkoutActive) {
        setIsWorkoutModalVisible(true);
      }
    });

    let active = true;
    (async () => {
      const last = await getLastNotificationResponse();
      if (active && last && isWorkoutNotificationResponse(last) && isWorkoutActive) {
        setIsWorkoutModalVisible(true);
      }
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [isWorkoutActive]);

  // Stable refs for state stabilization
  const templatesListRef = React.useRef(templatesList);
  const exercisesListRef = React.useRef(exercisesList);
  const sessionsListRef = React.useRef(sessionsList);
  const userRef = React.useRef(user);
  const editingSessionIdRef = React.useRef(editingSessionId);
  const workoutNameRef = React.useRef(workoutName);
  const startTimeRef = React.useRef(startTime);

  React.useEffect(() => {
    templatesListRef.current = templatesList;
    exercisesListRef.current = exercisesList;
    sessionsListRef.current = sessionsList;
    userRef.current = user;
    editingSessionIdRef.current = editingSessionId;
    workoutNameRef.current = workoutName;
    startTimeRef.current = startTime;
  }, [templatesList, exercisesList, sessionsList, user, editingSessionId, workoutName, startTime]);

  const handleStartWorkout = React.useCallback((name: string, exerciseNames: string[], exercisesDetails?: any[]) => {
    setWorkoutName(name);
    setStartTime(new Date());
    setActiveWorkoutComment('');
    
    // Fallback: Resolve exercisesDetails from templatesList if not provided (e.g. starting program calendar workout or smart up-next selector)
    let resolvedDetails = exercisesDetails;
    if (!resolvedDetails || resolvedDetails.length === 0) {
      const matchingTemplate = templatesListRef.current.find(t => t.name.toLowerCase().trim() === name.toLowerCase().trim());
      if (matchingTemplate && matchingTemplate.exercisesDetails && matchingTemplate.exercisesDetails.length > 0) {
        resolvedDetails = matchingTemplate.exercisesDetails;
      }
    }
    
    // Map exercise names to exercise set objects
    const mappedExercises = exerciseNames.map((exName, index) => {
      const libraryEx = exercisesListRef.current.find(e => e.name.toLowerCase().trim() === exName.toLowerCase().trim());
      const isExUnilateral = libraryEx?.isUnilateral || false;

      // Find the corresponding detail, preferably by index first, fallback to name lookup
      const detail = (resolvedDetails?.[index] && resolvedDetails[index].name.toLowerCase().trim() === exName.toLowerCase().trim())
        ? resolvedDetails[index]
        : resolvedDetails?.find(d => d.name.toLowerCase().trim() === exName.toLowerCase().trim());
      
      if (detail && detail.sets && detail.sets.length > 0) {
        return {
          name: exName,
          sets: detail.sets.length,
          bestWeight: 60,
          bestReps: 10,
          superSetGroupId: detail.superSetGroupId,
          setsDetails: detail.sets.map((s: any) => {
            const unilateral = s.isUnilateral || isExUnilateral;
            return {
              weight: (s.weight ?? '0').toString(),
              reps: (s.reps ?? '10').toString(),
              completed: false,
              category: s.category || 'S',
              isUnilateral: unilateral,
              leftWeight: unilateral ? (s.leftWeight !== undefined ? s.leftWeight.toString() : (s.weight ?? '60').toString()) : undefined,
              leftReps: unilateral ? (s.leftReps !== undefined ? s.leftReps.toString() : (s.reps ?? '10').toString()) : undefined,
              rightWeight: unilateral ? (s.rightWeight !== undefined ? s.rightWeight.toString() : (s.weight ?? '60').toString()) : undefined,
              rightReps: unilateral ? (s.rightReps !== undefined ? s.rightReps.toString() : (s.reps ?? '10').toString()) : undefined,
            };
          }),
        };
      }

      let bestWeight = 60;
      let bestReps = 10;
      let sets: any = 3;

      const previousSession = sessionsListRef.current.find((s: any) => 
        s.exercises && s.exercises.some((e: any) => e.name && e.name.toLowerCase().trim() === exName.toLowerCase().trim())
      );
      if (previousSession) {
        const found = previousSession.exercises.find((e: any) => e.name && e.name.toLowerCase().trim() === exName.toLowerCase().trim());
        if (found) {
          bestWeight = found.bestWeight || 60;
          bestReps = found.bestReps || 10;
          sets = typeof found.sets === 'number' ? found.sets : (found.sets?.length || 3);
        }
      }
      
      return {
        name: exName,
        sets,
        bestWeight,
        bestReps,
        setsDetails: Array.from({ length: typeof sets === 'number' ? sets : 3 }).map(() => ({
          weight: bestWeight.toString(),
          reps: bestReps.toString(),
          completed: false,
          category: 'S' as const,
          isUnilateral: isExUnilateral,
          leftWeight: isExUnilateral ? bestWeight.toString() : undefined,
          leftReps: isExUnilateral ? bestReps.toString() : undefined,
          rightWeight: isExUnilateral ? bestWeight.toString() : undefined,
          rightReps: isExUnilateral ? bestReps.toString() : undefined,
        })),
      };
    });

    console.log('[START WORKOUT] Creating', mappedExercises.length, 'exercises');
    setWorkoutExercises(mappedExercises.length > 0 ? mappedExercises : []);

    // Phase C: Update lastUsed on the matching template when the workout starts
    if (name && name !== i18n.t('extras.emptyWorkout')) {
      setTemplatesList(prev => prev.map(t =>
        t.name && t.name.toLowerCase().trim() === name.toLowerCase().trim()
          ? { ...t, lastUsed: new Date() }
          : t
      ));
    }

    setIsWorkoutActive(true);
    setIsWorkoutModalVisible(true);
  }, []);

  const handleResumeWorkout = (session: any) => {
    if (isWorkoutActive) {
      Alert.alert(
        i18n.t('alerts.workoutActive'),
        i18n.t('alerts.workoutActiveMsg')
      );
      return;
    }

    setEditingSessionId(session.id);
    setWorkoutName(session.title);
    setStartTime(new Date(session.datetime));
    setActiveWorkoutComment(session.comment || '');

    // Map session exercises back to active workout exercises structure
    const mapped = session.exercises.map((ex: any) => {
      return {
        name: ex.name,
        sets: ex.setsDetails?.length || ex.sets || 3,
        bestWeight: ex.bestWeight,
        bestReps: ex.bestReps,
        setsDetails: ex.setsDetails || [],
      };
    });

    setWorkoutExercises(mapped);
    setIsWorkoutActive(true);
    setIsWorkoutModalVisible(true);
  };

  const handleDiscardWorkout = React.useCallback(() => {
    setIsWorkoutActive(false);
    setIsWorkoutModalVisible(false);
    setWorkoutExercises([]);
    setWorkoutName('Active Workout');
    setEditingSessionId(null);
    setActiveWorkoutComment('');
  }, []);

  const handleFinishWorkout = React.useCallback((summary: { totalVolume: number; totalSets: number; durationMin: number; comment?: string }) => {
    if (summary.totalSets === 0) {
      handleDiscardWorkout();
      return;
    }
    const completedExercises = workoutExercisesRef.current.reduce<any[]>((acc, ex) => {
      const count = typeof ex.sets === 'number' ? ex.sets : (ex.sets?.length || 0);
      if (count > 0) {
        if (typeof ex.sets === 'number') {
          acc.push({
            name: ex.name,
            sets: ex.sets,
            bestWeight: ex.bestWeight || 60,
            bestReps: ex.bestReps || 10,
            setsDetails: (ex as any).setsDetails || [],
          });
        } else {
          const setsArray: any[] = ex.sets || [];
          const bestWeight = setsArray.reduce((max, s) => Math.max(max, parseFloat(s.weight) || 0), 0);
          const bestReps = setsArray.reduce((max, s) => Math.max(max, parseInt(s.reps, 10) || 0), 0);
          acc.push({
            name: ex.name,
            sets: setsArray.length,
            bestWeight: bestWeight || ex.bestWeight || 60,
            bestReps: bestReps || ex.bestReps || 10,
            setsDetails: setsArray.map(s => ({
              weight: parseFloat(s.weight) || 0,
              reps: parseInt(s.reps, 10) || 0,
              completed: s.completed || false,
              rpe: s.rpe ? parseFloat(s.rpe) : undefined,
              category: s.category || 'S',
            })),
          });
        }
      }
      return acc;
    }, []);

    let updatedSessions = [...sessionsListRef.current];
    let nextUser = { ...userRef.current };

    if (editingSessionIdRef.current) {
      updatedSessions = sessionsListRef.current.map((s: any) => {
        if (s.id === editingSessionIdRef.current) {
          return {
            ...s,
            title: workoutNameRef.current,
            exercises: completedExercises.length > 0 ? completedExercises : [],
            durationMinutes: summary.durationMin,
            totalVolumeKg: summary.totalVolume,
            prs: summary.totalVolume > 0 ? 1 : 0,
            comment: summary.comment !== undefined ? summary.comment : s.comment,
          };
        }
        return s;
      });
      setEditingSessionId(null);
    } else {
      const newSession = {
        id: `session-new-${Date.now()}`,
        title: workoutNameRef.current,
        datetime: new Date(startTimeRef.current),
        comment: summary.comment || '',
        exercises: completedExercises.length > 0 ? completedExercises : [],
        durationMinutes: summary.durationMin,
        totalVolumeKg: summary.totalVolume,
        prs: summary.totalVolume > 0 ? 1 : 0,
      };
      updatedSessions = [newSession, ...sessionsListRef.current];
      nextUser.totalWorkouts = updatedSessions.length;
    }

    setSessionsList(updatedSessions);
    setUser(nextUser);
    
    // Insights calculation removed (completion insights feature removed)
    
    // Show celebratory screen
    setCompletionData({
      totalVolume: summary.totalVolume,
      totalSets: summary.totalSets,
      durationMin: summary.durationMin,
      name: workoutNameRef.current,
    });

    setIsWorkoutActive(false);
    setIsWorkoutModalVisible(false);
    setActiveWorkoutComment('');
  }, [handleDiscardWorkout]);

  const handleCloseWorkoutModal = React.useCallback(() => {
    setIsWorkoutModalVisible(false);
  }, []);

  const handleUpdateExerciseInsightsNotes = React.useCallback((exId: string, insightsNotes?: string) => {
    setExercisesList(prev => prev.map(ex => ex.id === exId ? { ...ex, insightsNotes } : ex));
  }, []);

  const handleUpdateWorkoutComment = React.useCallback((newComment: string) => {
    setActiveWorkoutComment(newComment);
    if (editingSessionIdRef.current) {
      setSessionsList(prev => prev.map(s => s.id === editingSessionIdRef.current ? { ...s, comment: newComment } : s));
    }
  }, []);

  // Phase A1: Removed nested setState (was crashing React 19 concurrent renderer).
  // totalWorkouts is now kept in sync via a separate useEffect below.
  const handleDeleteSession = React.useCallback((sessionId: string) => {
    setSessionsList(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  // Keep totalWorkouts derived from sessionsList length (avoids nested setState crash)
  React.useEffect(() => {
    setUser(prev => prev.totalWorkouts === sessionsList.length
      ? prev
      : { ...prev, totalWorkouts: sessionsList.length });
  }, [sessionsList]);

  const activeWorkoutStateSavedRef = React.useRef(false);

  // Persist active workout state on changes (cross-platform via db.ts)
  React.useEffect(() => {
    if (!isDataLoaded || !isWorkoutRestored) return;
    if (isWorkoutActive && workoutExercises.length > 0 && workoutName !== 'Empty Workout') {
      const activeState = {
        workoutName,
        startTime: startTime.toISOString(),
        workoutExercises,
        isWorkoutModalVisible,
        comment: activeWorkoutComment,
      };
      console.log('[SAVE] Saving workout state, exercises count:', workoutExercises.length);
      saveToDb('strongern_active_workout_state', activeState);
      activeWorkoutStateSavedRef.current = true;
    } else {
      console.log('[SAVE] Deleting or not persisting workout state (exercises empty or empty workout)');
      deleteFromDb('strongern_active_workout_state');
      activeWorkoutStateSavedRef.current = false;
    }
  }, [isWorkoutActive, workoutName, startTime, workoutExercises, isWorkoutModalVisible, activeWorkoutComment, isDataLoaded, isWorkoutRestored]);

  // Save workout state when app goes to background (native)
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        Notifications.dismissAllNotificationsAsync().catch(() => {});
      }
      if (state === 'background' || state === 'inactive') {
        if (isWorkoutActive && workoutExercises.length > 0 && workoutName !== 'Empty Workout') {
          const activeState = {
            workoutName,
            startTime: startTime.toISOString(),
            workoutExercises,
            isWorkoutModalVisible,
            comment: activeWorkoutComment,
          };
          saveToDb('strongern_active_workout_state', activeState);
        } else {
          deleteFromDb('strongern_active_workout_state');
        }
      }
    });
    return () => sub.remove();
  }, [isWorkoutActive, workoutName, startTime, workoutExercises, isWorkoutModalVisible, activeWorkoutComment]);

  const workoutExercisesRef = React.useRef(workoutExercises);
  React.useEffect(() => {
    workoutExercisesRef.current = workoutExercises;
  }, [workoutExercises]);

  const handleFinishWorkoutRef = React.useRef(handleFinishWorkout);
  React.useEffect(() => {
    handleFinishWorkoutRef.current = handleFinishWorkout;
  }, [handleFinishWorkout]);

  // Auto-close safety timer (3 hours)
  React.useEffect(() => {
    if (!isWorkoutActive) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime.getTime();
      const threeHours = 3 * 60 * 60 * 1000;
      if (elapsed > threeHours) {
        // Workout has been active for more than 3 hours, let's auto-save it
        let totalVolume = 0;
        let totalSets = 0;
        workoutExercisesRef.current.forEach(ex => {
          if (ex.setsDetails) {
            ex.setsDetails.forEach((set: any) => {
              if (set.completed) {
                if (set.isUnilateral) {
                  const leftW = parseFloat(set.leftWeight ?? set.weight ?? '0') || 0;
                  const leftR = parseInt(set.leftReps ?? set.reps ?? '0', 10) || 0;
                  const rightW = parseFloat(set.rightWeight ?? set.weight ?? '0') || 0;
                  const rightR = parseInt(set.rightReps ?? set.reps ?? '0', 10) || 0;
                  totalVolume += (leftW * leftR) + (rightW * rightR);
                } else {
                  totalVolume += (set.weight || 0) * (set.reps || 0);
                }
                totalSets += 1;
              }
            });
          } else {
            totalVolume += (ex.bestWeight || 0) * (ex.bestReps || 0) * (ex.sets || 0);
            totalSets += ex.sets || 0;
          }
        });

        Alert.alert(
          i18n.t('alerts.safetyTimer'),
          i18n.t('alerts.safetyTimerMsg'),
          [{ text: i18n.t('common.ok') }]
        );

        handleFinishWorkoutRef.current({
          totalVolume,
          totalSets,
          durationMin: 180, // Cap at 3 hours (180 mins)
        });
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isWorkoutActive, startTime]);

  const renderTabBar = React.useCallback((props: BottomTabBarProps) => (
    <>
      {isWorkoutActive && (
        <ActiveWorkoutBar
          workoutName={workoutName}
          startTime={startTime}
          onPress={() => setIsWorkoutModalVisible(true)}
          onFinish={() => setIsWorkoutModalVisible(true)}
        />
      )}
      <BottomTabBar {...props} />
    </>
  ), [isWorkoutActive, workoutName, startTime]);

  // Memoize Tab screens to prevent them from unmounting/re-mounting or re-rendering on every App state change
  const historyScreenElement = React.useMemo(() => {
    return <HistoryScreen sessions={sessionsList} onResumeWorkout={handleResumeWorkout} onDeleteSession={handleDeleteSession} />;
  }, [sessionsList, handleResumeWorkout, handleDeleteSession]);

  const workoutScreenElement = React.useMemo(() => {
    return (
      <WorkoutScreen 
        templates={templatesList} 
        onStartWorkout={handleStartWorkout}
        onAddTemplate={handleAddTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onUpdateTemplate={handleUpdateTemplate}
        onReorderTemplates={handleReorderTemplates}
        exercises={exercisesList}
        folders={foldersList}
        onAddFolder={handleAddFolder}
        onDeleteFolder={handleRemoveFolder}
        activeProgramId={activeProgramId}
        programStartDate={programStartDate}
        onSubscribeProgram={handleSubscribeProgram}
        isProgramsEnabled={isProgramsEnabled}
        enableRoutineFolders={enableRoutineFolders}
        onAddCustomExercise={handleAddExercise}
        sessions={sessionsList}
        exerciseNameLanguage={exerciseNameLanguage}
      />
    );
  }, [
    templatesList,
    handleStartWorkout,
    handleAddTemplate,
    handleDeleteTemplate,
    handleUpdateTemplate,
    handleReorderTemplates,
    exercisesList,
    foldersList,
    handleAddFolder,
    handleRemoveFolder,
    activeProgramId,
    programStartDate,
    handleSubscribeProgram,
    isProgramsEnabled,
    enableRoutineFolders,
    handleAddExercise,
    sessionsList
  ]);

  const exercisesScreenElement = React.useMemo(() => {
    return (
      <ExercisesScreen 
        exercises={exercisesList} 
        onAddExercise={handleAddExercise}
        onDeleteExercise={handleDeleteExercise}
        onUpdateExerciseNotes={handleUpdateExerciseNotes}
        onUpdateExercise={handleUpdateExercise}
        sessions={sessionsList}
        exerciseNameLanguage={exerciseNameLanguage}
      />
    );
  }, [
    exercisesList,
    handleAddExercise,
    handleDeleteExercise,
    handleUpdateExerciseNotes,
    handleUpdateExercise,
    sessionsList
  ]);

  const muscleMapScreenElement = React.useMemo(() => {
    return (
      <MuscleMapScreen
        weeklyMuscleSets={weeklyMuscleSets}
        sessions={sessionsList}
        exercisesList={exercisesList}
        exerciseNameLanguage={exerciseNameLanguage}
        showHypertrophyGoal={showHypertrophyGoal}
        setShowHypertrophyGoal={setShowHypertrophyGoal}
      />
    );
  }, [
    weeklyMuscleSets,
    sessionsList,
    exercisesList,
    showHypertrophyGoal,
    setShowHypertrophyGoal
  ]);


  if (process.env.EXPO_PUBLIC_E2E === 'true') {
    return <E2EAppHarness />;
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Show login/onboarding if not yet completed
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="light" />
      {authState === null || !isDataLoaded || !isWorkoutRestored ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : !authState.hasCompletedOnboarding ? (
        <LoginScreen
          onComplete={handleAuthComplete}
          onGoogleLogin={handleGoogleLogin}
          onRestoreBackup={handleRestoreBackup}
        />
      ) : (
        <NavigationContainer key={languageVersion}>
        <View style={styles.root}>
          <Tab.Navigator
            initialRouteName="Profile"
            tabBar={renderTabBar}
            screenOptions={{ headerShown: false, freezeOnBlur: true }}
          >
            <Tab.Screen name="Profile">
              {() => (
                <ProfileScreen
                  user={user}
                  weeklyChartData={dynamicWeeklyChartData}
                  sessions={sessionsList}
                  isAutoTimerEnabled={isAutoTimerEnabled}
                  setIsAutoTimerEnabled={setIsAutoTimerEnabled}
                  onMeasurePress={() => setIsMeasureModalVisible(true)}
                  googleUser={googleUser}
                  onGoogleLogin={handleGoogleLogin}
                  onGoogleLogout={handleGoogleLogout}
                  onCloudSync={handleCloudSync}
                  onUpdateUser={handleUpdateUser}
                  onImportBackup={handleImportBackup}
                  onImportStrongCSV={handleImportStrongCSV}
                  onExportBackup={handleExportBackup}
                  onExportCSV={handleExportCSV}
                  animationSpeed={animationSpeed}
                  setAnimationSpeed={setAnimationSpeed}
                  onWipeAllData={handleWipeAllData}
                  lastSynced={lastSynced}
                  weeklyMuscleSets={weeklyMuscleSets}
                  exercises={exercisesList}
                  isWatchSimulatorVisible={isWatchSimulatorVisible}
                  setIsWatchSimulatorVisible={setIsWatchSimulatorVisible}
                  isHealthSyncEnabled={isHealthSyncEnabled}
                  setIsHealthSyncEnabled={setIsHealthSyncEnabled}
                  isLiveHeartRateEnabled={isLiveHeartRateEnabled}
                  setIsLiveHeartRateEnabled={setIsLiveHeartRateEnabled}
                  onStartWorkout={handleStartWorkout}
                  templates={templatesList}
                  activeProgramId={activeProgramId}

                  isProgramsEnabled={isProgramsEnabled}
                  setIsProgramsEnabled={setIsProgramsEnabled}

                  soundSetCompleted={soundSetCompleted}
                  setSoundSetCompleted={setSoundSetCompleted}
                  soundWorkoutFinished={soundWorkoutFinished}
                  setSoundWorkoutFinished={setSoundWorkoutFinished}
                  soundTimerCompleted={soundTimerCompleted}
                  setSoundTimerCompleted={setSoundTimerCompleted}
                  customSounds={customSounds}
                  setCustomSounds={setCustomSounds}
                  soundVolume={soundVolume}
                  setSoundVolume={setSoundVolume}
                  defaultRestDuration={defaultRestDuration}
                  setDefaultRestDuration={setDefaultRestDuration}
                  showAchievementBadges={showAchievementBadges}
                  setShowAchievementBadges={setShowAchievementBadges}
                  showSummaryWidgets={showSummaryWidgets}
                  setShowSummaryWidgets={setShowSummaryWidgets}
                  showWeeklyTonnage={showWeeklyTonnage}
                  setShowWeeklyTonnage={setShowWeeklyTonnage}
                  showWorkoutsChart={showWorkoutsChart}
                  setShowWorkoutsChart={setShowWorkoutsChart}
                  showHighlights={showHighlights}
                  setShowHighlights={setShowHighlights}
                  enableRoutineFolders={enableRoutineFolders}
                  setEnableRoutineFolders={setEnableRoutineFolders}
                  showHypertrophyGoal={showHypertrophyGoal}
                  setShowHypertrophyGoal={setShowHypertrophyGoal}
                  isDeveloperModeEnabled={isDeveloperModeEnabled}
                  setIsDeveloperModeEnabled={setIsDeveloperModeEnabled}
                  appTheme={appTheme}
                  setAppTheme={(theme: any) => {
                    setAppThemeState(theme);
                    const { applyTheme } = require('./theme');
                    applyTheme(theme, customAccentColor);
                    setThemeVersion(v => v + 1);
                  }}
                  customAccentColor={customAccentColor}
                  setCustomAccentColor={(color: string) => {
                    setCustomAccentColor(color);
                    const { applyTheme } = require('./theme');
                    applyTheme(appTheme, color);
                    setThemeVersion(v => v + 1);
                  }}

                  authMode={authState.authMode}
                  onAppLogout={handleAppLogout}
                  isProgressiveOverloadEnabled={isProgressiveOverloadEnabled}
                  setIsProgressiveOverloadEnabled={setIsProgressiveOverloadEnabled}
                  isAutoFinishSetEnabled={isAutoFinishSetEnabled}
                  setIsAutoFinishSetEnabled={setIsAutoFinishSetEnabled}
                  isRpeMode={isRpeMode}
                  setIsRpeMode={setIsRpeMode}
                />
              )}
            </Tab.Screen>

            {isHistoryEnabled && (
              <Tab.Screen name="History">
                {() => historyScreenElement}
              </Tab.Screen>
            )}

            <Tab.Screen name="Workout">
              {() => workoutScreenElement}
            </Tab.Screen>

            <Tab.Screen name="Exercises">
              {() => exercisesScreenElement}
            </Tab.Screen>

            {isMusclesEnabled && (
              <Tab.Screen name="Muscles">
                {() => muscleMapScreenElement}
              </Tab.Screen>
            )}
          </Tab.Navigator>

          {isWatchSimulatorVisible && (
            <WatchCompanionSimulator
              workoutName={workoutName}
              startTime={startTime}
              activeExercises={workoutExercises}
              onCheckSet={() => {
                Alert.alert(i18n.t('alerts.wearableCompanion'), i18n.t('alerts.wearableCompanionMsg'));
              }}
              onClose={() => setIsWatchSimulatorVisible(false)}
            />
          )}

          {/* Active Workout Interactive Modal Sheet — wrapped in ErrorBoundary (Phase A3) */}
          <ErrorBoundary>
            <ActiveWorkoutModal
              visible={isWorkoutModalVisible}
              workoutName={workoutName}
              startTime={startTime}
              exercises={workoutExercises}
              isAutoTimerEnabled={isAutoTimerEnabled}
              onClose={handleCloseWorkoutModal}
              onFinish={handleFinishWorkout}
              onDiscard={handleDiscardWorkout}
              exerciseLibrary={exercisesList}
              onUpdateActiveExercises={setWorkoutExercises}
              onUpdateExerciseNotes={handleUpdateExerciseNotes}
              onUpdateExerciseInsightsNotes={handleUpdateExerciseInsightsNotes}
              onAddCustomExercise={handleAddExercise}
              isLiveHeartRateEnabled={isLiveHeartRateEnabled}

              defaultRestDuration={defaultRestDuration}
              onRenameWorkout={setWorkoutName}
              sessions={sessionsList}
              isProgressiveOverloadEnabled={isProgressiveOverloadEnabled}
              isAutoFinishSetEnabled={isAutoFinishSetEnabled}

              isRpeMode={isRpeMode}
              exerciseNameLanguage={exerciseNameLanguage}
              isEditing={!!editingSessionId}
              previousDurationMin={editingSessionId ? sessionsList.find(s => s.id === editingSessionId)?.durationMinutes : undefined}
              editingComment={activeWorkoutComment}
              onUpdateComment={handleUpdateWorkoutComment}
              onUpdateStartTime={setStartTime}
              onUpdateDefaultRestDuration={setDefaultRestDuration}
            />
          </ErrorBoundary>

          {/* Measure Modal Sheet (accessible from Profile) */}
          <Modal
            visible={isMeasureModalVisible}
            animationType="slide"
            transparent={false}
            onRequestClose={() => setIsMeasureModalVisible(false)}
          >
            <View style={styles.measureModalContainer}>
              <View style={styles.measureModalHeader}>
                <Pressable
                  onPress={() => setIsMeasureModalVisible(false)}
                  style={styles.measureModalClose}
                  android_ripple={rippleTokens.borderless}
                  accessibilityLabel="Close measurements"
                >
                  <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
                </Pressable>
              </View>
              <MeasureScreen
                primaryMetrics={primaryMetricsList}
                bodyPartMetrics={bodyPartMetricsList}
                onRecordMetric={handleRecordMetric}
                onAddMetric={handleAddMetric}
                onDeleteMetricLog={handleDeleteMetricLog}
              />
            </View>
          </Modal>

          {/* Premium Congratulations Modal Overlay */}
          {completionData && (
            <Modal transparent visible={!!completionData} animationType="fade">
              <View style={styles.celebrationBackdrop}>
                <View style={styles.celebrationCard}>
                  <View style={[styles.trophyGlow, { backgroundColor: colors.gold + '1A' }]}>
                    <Ionicons name="trophy" size={54} color={colors.gold} />
                  </View>
                  
                  <Text style={styles.celebrationTitle}>{i18n.t('completion.workoutCompleted')}</Text>
                  <Text style={styles.celebrationSubtitle}>{completionData.name}</Text>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.celebrationStats}>
                    <View style={styles.celebrationStatItem}>
                      <Text style={styles.statVal}>{completionData.durationMin}m</Text>
                      <Text style={styles.statLabel}>{i18n.t('completion.duration')}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.celebrationStatItem}>
                      <Text style={styles.statVal}>{completionData.totalSets}</Text>
                      <Text style={styles.statLabel}>{i18n.t('completion.sets')}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.celebrationStatItem}>
                      <Text style={styles.statVal}>{completionData.totalVolume} kg</Text>
                      <Text style={styles.statLabel}>{i18n.t('completion.volume')}</Text>
                    </View>
                  </View>
                  
                  {/* Share and Insights buttons removed (Phase D) */}

                  <Pressable
                    style={styles.doneBtn}
                    onPress={() => {
                      setCompletionData(null);
                    }}
                    android_ripple={rippleTokens.accent}
                  >
                    <Text style={styles.doneBtnText}>{i18n.t('completion.awesome')}</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          )}

          {/* Workout Insights Modal and SocialShareCard removed (Phase D) */}
          {/* Custom Alert Modal (App-Wide Native Alert Replacement) */}
          {activeAlert && (
            <Modal
              transparent
              visible={!!activeAlert}
              animationType="fade"
              onRequestClose={() => {
                if (activeAlert.options?.cancelable !== false) {
                  if (activeAlert.options?.onDismiss) activeAlert.options.onDismiss();
                  setActiveAlert(null);
                }
              }}
            >
              <Pressable
                style={styles.alertBackdrop}
                onPress={() => {
                  if (activeAlert.options?.cancelable !== false) {
                    if (activeAlert.options?.onDismiss) activeAlert.options.onDismiss();
                    setActiveAlert(null);
                  }
                }}
              >
                <Pressable style={styles.alertCard} onPress={(e) => e.stopPropagation()}>
                  <Text style={styles.alertTitle}>{activeAlert.title}</Text>
                  {activeAlert.message && (
                    <Text style={styles.alertMessage}>{activeAlert.message}</Text>
                  )}

                  <View style={[
                    styles.alertButtonsContainer,
                    (activeAlert.buttons && activeAlert.buttons.length > 2)
                      ? { flexDirection: 'column', rowGap: spacing.sm }
                      : { flexDirection: 'row', columnGap: spacing.sm }
                  ]}>
                    {activeAlert.buttons && activeAlert.buttons.length > 0 ? (
                      activeAlert.buttons.map((btn, idx) => {
                        const isDestructive = btn.style === 'destructive';
                        const isCancel = btn.style === 'cancel';
                        return (
                          <Pressable
                            key={btn.text}
                            style={[
                              styles.alertBtn,
                              isDestructive && styles.alertBtnDestructive,
                              isCancel && styles.alertBtnCancel,
                              (activeAlert.buttons!.length <= 2) && { flex: 1 }
                            ]}
                            onPress={() => {
                              setActiveAlert(null);
                              if (btn.onPress) btn.onPress();
                            }}
                            android_ripple={isDestructive ? rippleTokens.accent : rippleTokens.surface}
                          >
                            <Text style={[
                              styles.alertBtnText,
                              isDestructive && styles.alertBtnTextDestructive,
                              isCancel && styles.alertBtnTextCancel
                            ]}>
                              {(btn.text || '').toUpperCase()}
                            </Text>
                          </Pressable>
                        );
                      })
                    ) : (
                      <Pressable
                        style={[styles.alertBtn, { flex: 1 }]}
                        onPress={() => setActiveAlert(null)}
                        android_ripple={rippleTokens.accent}
                      >
                        <Text style={styles.alertBtnText}>{i18n.t('common.ok')}</Text>
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              </Pressable>
            </Modal>
          )}
        </View>
        </NavigationContainer>
      )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex:            1,
    backgroundColor: colors.bg,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Celebration Modal Styles
  celebrationBackdrop: {
    flex:            1,
    backgroundColor: 'rgba(5, 7, 10, 0.92)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         24,
  },
  celebrationCard: {
    width:           '90%',
    maxWidth:        340,
    backgroundColor: colors.surface,
    borderColor:     colors.border,
    borderWidth:     1,
    borderRadius:    radius.lg,
    padding:         24,
    alignItems:      'center',
    ...(shadow.lg as object),
  },
  trophyGlow: {
    width:           90,
    height:          90,
    borderRadius:    45,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
  },
  celebrationTitle: {
    color:         colors.gold,
    fontSize:      font.sizes.lg,
    fontFamily:    font.bold,
    letterSpacing: 1.5,
    textAlign:     'center',
  },
  celebrationSubtitle: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.base,
    fontFamily: font.semibold,
    marginTop:  4,
    textAlign:  'center',
  },
  divider: {
    height:          1,
    backgroundColor: colors.border,
    width:           '100%',
    marginVertical:  20,
  },
  celebrationStats: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-around',
    width:          '100%',
    marginBottom:   24,
  },
  celebrationStatItem: {
    alignItems: 'center',
    flex:       1,
  },
  statVal: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.base,
    fontFamily: font.bold,
  },
  statLabel: {
    color:         colors.textSecondary,
    fontSize:      font.sizes.xs,
    fontFamily:    font.semibold,
    marginTop:     4,
    letterSpacing: 0.5,
  },
  statDivider: {
    width:           1,
    height:          30,
    backgroundColor: colors.border,
  },
  doneBtn: {
    backgroundColor: colors.accent,
    width:           '100%',
    paddingVertical: 12,
    borderRadius:    radius.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  doneBtnText: {
    color:         colors.textInverse,
    fontSize:      font.sizes.sm,
    fontFamily:    font.bold,
    letterSpacing: 1,
  },

  // Measure Modal
  measureModalContainer: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  measureModalHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.surface,
  },
  measureModalClose: {
    padding: spacing.xs,
  },

  // Custom Alert Styles
  alertBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  alertCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.xl,
    ...(shadow.lg as object),
  },
  alertTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.lg,
    fontFamily: font.bold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  alertMessage: {
    color: colors.textSecondary,
    fontSize: font.sizes.md,
    fontFamily: font.regular,
    marginBottom: spacing.xl,
    textAlign: 'center',
    lineHeight: 20,
  },
  alertButtonsContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  alertBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  alertBtnDestructive: {
    backgroundColor: colors.error,
  },
  alertBtnCancel: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderWidth: 1,
  },
  alertBtnText: {
    color: colors.textInverse,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.5,
    textAlign: 'center',
    width: '100%',
  },
  alertBtnTextDestructive: {
    color: colors.textPrimary,
  },
  alertBtnTextCancel: {
    color: colors.textPrimary,
  },
  insightsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  insightsCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...(shadow.lg as object),
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  insightsTitleText: {
    color: colors.textPrimary,
    fontSize: font.sizes.lg,
    fontFamily: font.bold,
  },
  insightsSubtitleText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
    marginTop: 2,
  },
  insightsCloseBtn: {
    padding: spacing.xs,
  },
  insightsScroll: {
    flex: 1,
    marginBottom: spacing.md,
  },
  insightsScrollContent: {
    paddingVertical: spacing.xs,
  },
  insightItemCard: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  insightItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  insightItemName: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.semibold,
    flex: 1,
    marginRight: spacing.sm,
  },
  insightBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  insightBadgeText: {
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
  insightItemDetails: {
    gap: spacing.xs,
  },
  insightDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  insightDetailText: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.regular,
    flex: 1,
    lineHeight: 18,
  },
});

export default function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
