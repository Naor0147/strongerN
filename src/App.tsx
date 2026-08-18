// App.tsx — Navigation root with font loading, live workout state, and completion celebrations
import React from 'react';
import { View, StyleSheet, Modal, Text, Pressable, Alert, Linking, AppState, ScrollView, Platform } from 'react-native';
import { enableFreeze } from 'react-native-screens';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';

enableFreeze(true);
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar }                from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Rubik_700Bold } from '@expo-google-fonts/rubik';
import { Ionicons }                 from '@expo/vector-icons';
import * as googleDrive             from './utils/googleDrive';
import { initDb, saveToDb, loadFromDb, deleteFromDb } from './utils/db';
import { importStrongCSV } from './utils/csvImporter';
import { setSecureItem, getSecureItem, deleteSecureItem } from './utils/secureStore';
import { setAlertListener, CustomAlertConfig } from './utils/alertOverride';
import { loadAuthState, saveAuthState, saveGoogleProfile, getInitialAuthState, AuthMode, GoogleProfile } from './utils/authStore';
import {
  getCachedAppData,
  setCachedAppData,
  getCachedRecentSessions,
  setCachedRecentSessions,
  getCachedTotalSessionsCount,
  setCachedTotalSessionsCount,
  getCachedProfileSummaries,
  setCachedProfileSummaries,
  clearInstantCache,
  InstantAppData,
  InstantProfileSummaries,
} from './storage/instantCache';
import { buildBackupData, exportBackupToFile, BackupData } from './utils/backupManager';
import { getSessionsForExerciseVariation } from './utils/variationUtils';
import i18n from './utils/i18n';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useActiveWorkoutStore } from './state/activeWorkoutStore';
import { bootstrapPersistence } from './storage/persistenceBootstrap';
import { sessionV2ToLegacy, legacySessionToV2 } from './storage/history/legacySessionMapper';
import { bulkImportSessions, reconcileSessions, softDeleteSession, upsertSession, loadAllSessions } from './storage/history/repository';
import { loadCompactSettings, saveCompactSettings } from './storage/compactSettings';
import { buildExerciseHistoryIndex, resolveLastPerformanceSuggestion } from './storage/expectedValues';

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

// Screens
import ProfileScreen   from './screens/ProfileScreen';
import HistoryScreen   from './screens/HistoryScreen';
import WorkoutScreen   from './screens/WorkoutScreen';
import ExercisesScreen from './screens/ExercisesScreen';
import MeasureScreen   from './screens/MeasureScreen';
import MuscleMapScreen from './screens/MuscleMapScreen';
import E2EAppHarness from './screens/E2EAppHarness';
import Toast from './components/ui/Toast';

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

interface MeasureModalSheetProps {
  visible: boolean;
  onClose: () => void;
  primaryMetricsList: any[];
  bodyPartMetricsList: any[];
  onRecordMetric?: (id: string, newValue: string) => void;
  onAddMetric?: (label: string, isPrimary: boolean) => void;
  onDeleteMetricLog?: (id: string, date: string) => void;
}

const MeasureModalSheet: React.FC<MeasureModalSheetProps> = React.memo(({
  visible,
  onClose,
  primaryMetricsList,
  bodyPartMetricsList,
  onRecordMetric,
  onAddMetric,
  onDeleteMetricLog,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.measureModalContainer, { paddingTop: insets.top }]}>
        <View style={styles.measureModalHeader}>
          <Pressable
            onPress={onClose}
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
          onRecordMetric={onRecordMetric}
          onAddMetric={onAddMetric}
          onDeleteMetricLog={onDeleteMetricLog}
        />
      </View>
    </Modal>
  );
});

function App() {
  const isE2E = Platform.OS === 'web' && (
    process.env.EXPO_PUBLIC_E2E === 'true' || (typeof window !== 'undefined' && (
      window.location?.search?.includes('e2e=true') ||
      window.sessionStorage?.getItem('is_e2e_mode') === 'true'
    ))
  );

  if (isE2E) {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.setItem('is_e2e_mode', 'true');
      } catch (e) {}
    }
    return <E2EAppHarness />;
  }

  return <MainApp />;
}

function MainApp() {

  // Clear legacy localStorage e2e key if present
  if (typeof window !== 'undefined' && window.localStorage?.getItem('is_e2e_mode')) {
    try {
      window.localStorage.removeItem('is_e2e_mode');
    } catch (e) {}
  }

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

  // â”€â”€ Synchronous Frame 0 MMKV Instant Hydration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const initialAuth = React.useMemo(() => getInitialAuthState(), []);
  const initialAppData = React.useMemo(() => getCachedAppData(), []);
  const initialRecentSessions = React.useMemo(() => getCachedRecentSessions(), []);
  const initialProfileSummaries = React.useMemo(() => getCachedProfileSummaries(), []);
  const initialSettings = React.useMemo(() => loadCompactSettings(), []);

  // Performance telemetry marker
  if (!(global as any).__HYDRATION_LOGGED__) {
    (global as any).__HYDRATION_LOGGED__ = true;
    const now = Date.now();
    const t0 = (global as any).__STARTUP_T0__ || now;
    console.log(`[PERF_BENCHMARK] Frame 0 Instant State Hydrated in ${now - t0}ms (cachedUser: ${Boolean(initialAppData?.user)}, cachedSessions: ${initialRecentSessions?.length ?? 0})`);
  }

  // â”€â”€ Auth State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // null = loading from storage; false = needs onboarding; AuthState = loaded
  const [authState, setAuthState] = React.useState<{
    hasCompletedOnboarding: boolean;
    authMode: AuthMode;
    localUsername: string;
    googleProfile?: GoogleProfile | null;
  } | null>(() => initialAuth);

  // Guard to prevent overwriting stored data with defaults on mount
  const [isDataLoaded, setIsDataLoaded] = React.useState(() => Boolean(initialAppData));
  const [isFullHistoryLoaded, setIsFullHistoryLoaded] = React.useState(false);
  const [isWorkoutRestored, setIsWorkoutRestored] = React.useState(true);

  // Load auth state from DB on mount (background reconciliation / first launch fallback)
  React.useEffect(() => {
    (async () => {
      await initDb();
      const saved = await loadAuthState();
      if (saved) {
        setAuthState(saved);
        if (saved.authMode === 'google' && saved.googleProfile) {
          const p = saved.googleProfile;
          setGoogleUser(prev => prev ?? {
            email: p.email,
            name: p.name,
            avatarUri: p.avatarUri,
            fileId: p.fileId,
            accessToken: undefined,
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
      } else if (!initialAuth) {
        // First launch â€” show onboarding
        setAuthState({ hasCompletedOnboarding: false, authMode: 'guest', localUsername: '' });
      }
    })();
  }, [initialAuth]);

  // Non-blocking initialization of sounds and notifications after first paint
  React.useEffect(() => {
    const timer = setTimeout(() => {
      initSounds();
      initNotifications();
    }, 60);
    return () => clearTimeout(timer);
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

  // Dynamic States (Clean production-ready default state populated from synchronous instant cache)
  const initialTotalCount = React.useMemo(() => getCachedTotalSessionsCount() ?? initialAppData?.user?.totalWorkouts ?? 0, []);
  const [user, setUser] = React.useState<{
    name: string;
    totalWorkouts: number;
    isPro: boolean;
    avatarUri?: string;
  }>(() => {
    if (initialAppData?.user) {
      return {
        ...initialAppData.user,
        totalWorkouts: initialTotalCount,
      };
    }
    return {
      name: initialAuth?.authMode === 'local' && initialAuth.localUsername
        ? initialAuth.localUsername
        : initialAuth?.authMode === 'google' && initialAuth.googleProfile?.name
        ? initialAuth.googleProfile.name
        : 'Guest User',
      totalWorkouts: initialTotalCount,
      isPro: false,
      avatarUri: initialAuth?.authMode === 'google' ? initialAuth.googleProfile?.avatarUri : undefined,
    };
  });

  const [sessionsList, setSessionsList] = React.useState<any[]>(() => initialRecentSessions ?? []);
  const [templatesList, setTemplatesList] = React.useState<any[]>(() => initialAppData?.templatesList ?? []);
  const [exercisesList, setExercisesList] = React.useState<any[]>(() => initialAppData?.exercisesList ?? mockExercises);
  const exercisesListRef = React.useRef(exercisesList);

  const [primaryMetricsList, setPrimaryMetricsList] = React.useState<any[]>(() =>
    initialAppData?.primaryMetricsList ?? mockPrimaryMetrics.map(m => ({ ...m, lastValue: undefined, history: [] }))
  );
  const [bodyPartMetricsList, setBodyPartMetricsList] = React.useState<any[]>(() =>
    initialAppData?.bodyPartMetricsList ?? mockBodyPartMetrics.map(m => ({ ...m, lastValue: undefined, history: [] }))
  );
  const [isAutoTimerEnabled, setIsAutoTimerEnabled] = React.useState(() => initialSettings?.isAutoTimerEnabled ?? true);
  const [googleUser, setGoogleUser] = React.useState<{
    email: string;
    name: string;
    avatarUri?: string;
    accessToken?: string;
    fileId?: string;
  } | null>(() => {
    if (initialAppData?.googleUser) return initialAppData.googleUser;
    if (initialAuth?.authMode === 'google' && initialAuth.googleProfile) {
      return {
        email: initialAuth.googleProfile.email,
        name: initialAuth.googleProfile.name,
        avatarUri: initialAuth.googleProfile.avatarUri,
        fileId: initialAuth.googleProfile.fileId,
      };
    }
    return null;
  });
  const [animationSpeed, setAnimationSpeed] = React.useState(() => initialSettings?.animationSpeed ?? 1);
  const [lastSynced, setLastSynced] = React.useState<string | null>(() => initialAppData?.lastSynced ?? null);

  // Program & Folder States
  const [foldersList, setFoldersList] = React.useState<string[]>(() => initialAppData?.foldersList ?? ['All', 'Bulking Splits', 'Home Workouts', 'Travel']);
  const [activeProgramId, setActiveProgramId] = React.useState<string | null>(() => initialAppData?.activeProgramId ?? null);
  const [programStartDate, setProgramStartDate] = React.useState<string | null>(() => initialAppData?.programStartDate ?? null);

  // Smartwatch and Health States
  const [isWatchSimulatorVisible, setIsWatchSimulatorVisible] = React.useState(false);
  const [isHealthSyncEnabled, setIsHealthSyncEnabled] = React.useState(() => initialSettings?.isHealthSyncEnabled ?? false);
  const [isLiveHeartRateEnabled, setIsLiveHeartRateEnabled] = React.useState(() => initialSettings?.isLiveHeartRateEnabled ?? false);

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
  const [isProgramsEnabled, setIsProgramsEnabled] = React.useState(() => initialSettings?.isProgramsEnabled ?? false);
  const [isHistoryEnabled, setIsHistoryEnabled] = React.useState(() => initialSettings?.isHistoryEnabled ?? true);
  const [isMusclesEnabled, setIsMusclesEnabled] = React.useState(() => initialSettings?.isMusclesEnabled ?? true);
  const [enableRoutineFolders, setEnableRoutineFolders] = React.useState(() => initialSettings?.enableRoutineFolders ?? false);
  const [isDeveloperModeEnabled, setIsDeveloperModeEnabled] = React.useState(() => initialSettings?.isDeveloperModeEnabled ?? false);
  const [appTheme, setAppThemeState] = React.useState<string>(() => initialSettings?.appTheme ?? 'default');
  const [customAccentColor, setCustomAccentColor] = React.useState(() => initialSettings?.customAccentColor ?? '#4F8EF7');
  const [themeVersion, setThemeVersion] = React.useState(0);

  const [languageVersion, setLanguageVersion] = React.useState(0); // Increment to trigger re-render on language change

  const [isProgressiveOverloadEnabled, setIsProgressiveOverloadEnabled] = React.useState(() => initialSettings?.isProgressiveOverloadEnabled ?? false);
  const [isAutoFinishSetEnabled, setIsAutoFinishSetEnabled] = React.useState(() => initialSettings?.isAutoFinishSetEnabled ?? true);

  const editingSessionId = useActiveWorkoutStore(state => state.editingSessionId);
  const setEditingSessionId = useActiveWorkoutStore(state => state.setEditingSessionId);
  const [isRpeMode, setIsRpeMode] = React.useState(() => initialSettings?.isRpeMode ?? true); // true = RPE, false = RIR
  const exerciseNameLanguage = i18n.locale.startsWith('he') ? 'he' as const : 'en' as const;

  const [soundSetCompleted, setSoundSetCompleted] = React.useState<string>(() => initialSettings?.soundSetCompleted ?? 'satisfying-click');
  const [soundWorkoutFinished, setSoundWorkoutFinished] = React.useState<string>(() => initialSettings?.soundWorkoutFinished ?? 'fanfare');
  const [soundTimerCompleted, setSoundTimerCompleted] = React.useState<string>(() => initialSettings?.soundTimerCompleted ?? 'beep');
  const [customSounds, setCustomSounds] = React.useState<{ id: string; name: string; uri: string }[]>(() => initialSettings?.customSounds ?? []);
  const [soundVolume, setSoundVolume] = React.useState(() => initialSettings?.soundVolume ?? 0.8);

  // Rest Timer default settings & layout preferences
  const [defaultRestDuration, setDefaultRestDuration] = React.useState(() => initialSettings?.defaultRestDuration ?? 90);
  const [showAchievementBadges, setShowAchievementBadges] = React.useState(() => initialSettings?.showAchievementBadges ?? false);
  const [showSummaryWidgets, setShowSummaryWidgets] = React.useState(() => initialSettings?.showSummaryWidgets ?? false);
  const [showWeeklyTonnage, setShowWeeklyTonnage] = React.useState(() => initialSettings?.showWeeklyTonnage ?? false);
  const [showWorkoutsChart, setShowWorkoutsChart] = React.useState(() => initialSettings?.showWorkoutsChart ?? true);
  const [showHighlights, setShowHighlights] = React.useState(() => initialSettings?.showHighlights ?? false);
  const [showHypertrophyGoal, setShowHypertrophyGoal] = React.useState(() => initialSettings?.showHypertrophyGoal ?? false);
  const historyRepositoryReadyRef = React.useRef(false);

  // Apply initial theme immediately to eliminate theme flash
  React.useEffect(() => {
    if (initialSettings?.appTheme) {
      const { applyTheme } = require('./theme');
      applyTheme(initialSettings.appTheme, initialSettings.customAccentColor || '#4F8EF7');
    }
  }, [initialSettings]);

  // Dynamically calculate weekly chart data based on sessionsList (with fast pre-cached fallback)
  const dynamicWeeklyChartData = React.useMemo(() => {
    if (sessionsList.length === 0 && initialProfileSummaries?.dynamicWeeklyChartData) {
      return initialProfileSummaries.dynamicWeeklyChartData;
    }
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
  }, [sessionsList, initialProfileSummaries]);

  // Background Database & History Synchronization (non-blocking)
  React.useEffect(() => {
    async function loadData() {
      try {
        const [dbReady, secureOverridesStr] = await Promise.all([
          initDb(),
          getSecureItem('theme_overrides').catch(() => null),
        ]);
        if (dbReady) {
          let parsedOverrides: any = {};
          if (secureOverridesStr) {
            try {
              parsedOverrides = JSON.parse(secureOverridesStr);
            } catch (e) {
              console.warn('Failed to parse theme overrides', e);
            }
          }
          const [parsed, legacyActiveWorkout] = await Promise.all([
            loadFromDb(STORAGE_KEY),
            loadFromDb('strongern_active_workout_state'),
          ]);
          const persistence = await bootstrapPersistence(parsed, legacyActiveWorkout);
          historyRepositoryReadyRef.current = persistence.historyReady;

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
            if (parsed.templatesList) {
              setTemplatesList(parsed.templatesList.map((t: any) => ({
                ...t,
                lastUsed: new Date(t.lastUsed)
              })));
            }
            if (parsed.exercisesList) {
              const loadedIds = new Set();
              const uniqueLoaded = parsed.exercisesList.map((e: any) => {
                const safeVars = Array.isArray(e.variations) ? e.variations : [];
                if (!e.id || loadedIds.has(e.id)) {
                  const newId = `ex-custom-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
                  loadedIds.add(newId);
                  return { ...e, variations: safeVars, id: newId };
                }
                loadedIds.add(e.id);
                return { ...e, variations: safeVars };
              });

              const loadedNames = new Set(uniqueLoaded.map((e: any) => e.name.toLowerCase().trim()));
              const merged = [...uniqueLoaded];
              mockExercises.forEach((defaultEx) => {
                if (!loadedIds.has(defaultEx.id) && !loadedNames.has(defaultEx.name.toLowerCase().trim())) {
                  merged.push({ ...defaultEx, variations: Array.isArray(defaultEx.variations) ? defaultEx.variations : [] });
                  loadedIds.add(defaultEx.id);
                }
              });
              setExercisesList(merged);
              exercisesListRef.current = merged;
            }
            if (parsed.primaryMetricsList) setPrimaryMetricsList(parsed.primaryMetricsList);
            if (parsed.bodyPartMetricsList) setBodyPartMetricsList(parsed.bodyPartMetricsList);
            if (parsed.googleUser !== undefined) {
              const secureToken = await getSecureItem('google_oauth_token');
              if (parsed.googleUser && secureToken) {
                setGoogleUser({ ...parsed.googleUser, accessToken: secureToken });
              } else {
                setGoogleUser(parsed.googleUser);
              }
            }
            if (parsed.lastSynced !== undefined) setLastSynced(parsed.lastSynced);
            if (parsed.foldersList) setFoldersList(parsed.foldersList);
            if (parsed.activeProgramId !== undefined) setActiveProgramId(parsed.activeProgramId);
            if (parsed.programStartDate !== undefined) setProgramStartDate(parsed.programStartDate);
          }

          let loadedSessionsMapped: any[] | null = null;
          if (persistence.historyReady && persistence.sessions) {
            loadedSessionsMapped = persistence.sessions.map(sessionV2ToLegacy);
          } else if (parsed?.sessionsList && Array.isArray(parsed.sessionsList)) {
            loadedSessionsMapped = parsed.sessionsList.map((s: any) => ({
              ...s,
              datetime: new Date(s.datetime)
            }));
          }

          if (loadedSessionsMapped !== null) {
            setSessionsList(loadedSessionsMapped);
            setCachedRecentSessions(loadedSessionsMapped, loadedSessionsMapped.length);
            setUser(prev => ({ ...prev, totalWorkouts: loadedSessionsMapped!.length }));
          }

          // Hydrate Settings from MMKV Compact Settings (falling back to legacy payload on first run)
          const settings = persistence.settings || {};
          const st = (key: string) => settings[key as keyof typeof settings] !== undefined
            ? settings[key as keyof typeof settings]
            : (parsed ? parsed[key] : undefined);

          if (st('isAutoTimerEnabled') !== undefined) setIsAutoTimerEnabled(st('isAutoTimerEnabled'));
          if (st('animationSpeed') !== undefined) setAnimationSpeed(st('animationSpeed'));
          if (st('isHealthSyncEnabled') !== undefined) setIsHealthSyncEnabled(st('isHealthSyncEnabled'));
          if (st('isLiveHeartRateEnabled') !== undefined) setIsLiveHeartRateEnabled(st('isLiveHeartRateEnabled'));
          if (st('isProgramsEnabled') !== undefined) setIsProgramsEnabled(st('isProgramsEnabled'));
          if (st('isHistoryEnabled') !== undefined) setIsHistoryEnabled(st('isHistoryEnabled'));
          if (st('isMusclesEnabled') !== undefined) setIsMusclesEnabled(st('isMusclesEnabled'));
          if (st('enableRoutineFolders') !== undefined) setEnableRoutineFolders(st('enableRoutineFolders'));
          if (st('isDeveloperModeEnabled') !== undefined) setIsDeveloperModeEnabled(st('isDeveloperModeEnabled'));
          if (st('customAccentColor') !== undefined) setCustomAccentColor(st('customAccentColor'));
          if (st('appTheme') !== undefined) {
            setAppThemeState(st('appTheme'));
            const { applyTheme } = require('./theme');
            applyTheme(st('appTheme'), st('customAccentColor') || '#4F8EF7', parsedOverrides);
          } else {
            const { applyTheme } = require('./theme');
            applyTheme('default', '#4F8EF7', parsedOverrides);
          }
          if (st('isProgressiveOverloadEnabled') !== undefined) setIsProgressiveOverloadEnabled(st('isProgressiveOverloadEnabled'));
          if (st('isAutoFinishSetEnabled') !== undefined) setIsAutoFinishSetEnabled(st('isAutoFinishSetEnabled'));
          if (st('isRpeMode') !== undefined) setIsRpeMode(st('isRpeMode'));
          if (st('soundSetCompleted') !== undefined) setSoundSetCompleted(st('soundSetCompleted'));
          if (st('soundWorkoutFinished') !== undefined) setSoundWorkoutFinished(st('soundWorkoutFinished'));
          if (st('soundTimerCompleted') !== undefined) setSoundTimerCompleted(st('soundTimerCompleted'));
          if (st('customSounds') !== undefined) setCustomSounds(st('customSounds'));
          if (st('soundVolume') !== undefined) setSoundVolume(st('soundVolume'));
          if (st('defaultRestDuration') !== undefined) setDefaultRestDuration(st('defaultRestDuration'));
          if (st('showAchievementBadges') !== undefined) setShowAchievementBadges(st('showAchievementBadges'));
          if (st('showSummaryWidgets') !== undefined) setShowSummaryWidgets(st('showSummaryWidgets'));
          if (st('showWeeklyTonnage') !== undefined) setShowWeeklyTonnage(st('showWeeklyTonnage'));
          if (st('showWorkoutsChart') !== undefined) setShowWorkoutsChart(st('showWorkoutsChart'));
          if (st('showHighlights') !== undefined) setShowHighlights(st('showHighlights'));
          if (st('showHypertrophyGoal') !== undefined) setShowHypertrophyGoal(st('showHypertrophyGoal'));

          useActiveWorkoutStore.getState().hydrate(persistence.activeDraft);
          activeWorkoutStateSavedRef.current = Boolean(persistence.activeDraft?.isWorkoutActive);
          setIsWorkoutRestored(true);

          if (__DEV__) {
            const now = Date.now();
            const t0 = (global as any).__STARTUP_T0__ || now;
            console.log(`[PERF_BENCHMARK] Background SQLite & History Sync Complete in ${now - t0}ms`);
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('Error loading persisted state', e);
        try {
          const fallbackSessions = await loadAllSessions();
          if (fallbackSessions) {
            const mapped = fallbackSessions.map(sessionV2ToLegacy);
            setSessionsList(mapped);
            setCachedRecentSessions(mapped, mapped.length);
            setUser(prev => ({ ...prev, totalWorkouts: mapped.length }));
          }
        } catch (fallbackErr) {
          if (__DEV__) console.warn('Fallback loadAllSessions failed', fallbackErr);
        }
      } finally {
        setIsDataLoaded(true);
        setIsFullHistoryLoaded(true);
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

  // Root state save refs
  const rootSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const latestAppDataRef = React.useRef<any>(null);

  const flushMainAppData = React.useCallback(() => {
    if (rootSaveTimeoutRef.current) {
      clearTimeout(rootSaveTimeoutRef.current);
      rootSaveTimeoutRef.current = null;
    }
    if (latestAppDataRef.current) {
      if (__DEV__) console.log('[SAVE] Flushing main app data immediately');
      saveToDb(STORAGE_KEY, latestAppDataRef.current).catch(e => {
        console.error('[SAVE] Error flushing main app data:', e);
      });
    }
  }, []);

  // Save compact settings to MMKV on settings changes (hot-path synchronous native persistence)
  React.useEffect(() => {
    if (!isDataLoaded) return;
    try {
      saveCompactSettings({
        isAutoTimerEnabled,
        animationSpeed,
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
      });
    } catch (e) {
      console.warn('[CompactSettings] Failed to save compact settings:', e);
    }
  }, [
    isDataLoaded,
    isAutoTimerEnabled,
    animationSpeed,
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
  ]);

  // Save core user app data (templates, custom exercises, metrics, profile, routines) to database & MMKV instant cache
  // Note: sessionsList is decoupled into relational SQLite v2 (strongern_v2.db) and cached in MMKV
  React.useEffect(() => {
    if (!isDataLoaded) return;
    try {
      const googleUserToSave = googleUser ? { ...googleUser, accessToken: undefined } : null;
      const data = {
        user,
        templatesList,
        exercisesList,
        primaryMetricsList,
        bodyPartMetricsList,
        googleUser: googleUserToSave,
        lastSynced,
        foldersList,
        activeProgramId,
        programStartDate,
      };
      // Synchronous MMKV Instant Cache update (Frame 0 zero-delay startup)
      setCachedAppData(data);
      latestAppDataRef.current = data;
      if (rootSaveTimeoutRef.current) {
        clearTimeout(rootSaveTimeoutRef.current);
      }
      rootSaveTimeoutRef.current = setTimeout(() => {
        saveToDb(STORAGE_KEY, data).catch(e => {
          console.error('[SAVE] Error saving state to database:', e);
        });
        rootSaveTimeoutRef.current = null;
      }, 400);
    } catch (e) {
      console.warn('Error queuing state save to database', e);
    }
    return () => {
      if (rootSaveTimeoutRef.current) {
        clearTimeout(rootSaveTimeoutRef.current);
        rootSaveTimeoutRef.current = null;
      }
    };
  }, [
    user,
    templatesList,
    exercisesList,
    primaryMetricsList,
    bodyPartMetricsList,
    googleUser,
    lastSynced,
    foldersList,
    activeProgramId,
    programStartDate,
    isDataLoaded,
  ]);

  // Reconcile and refresh recent sessions cache and total count on session updates
  React.useEffect(() => {
    if (!isDataLoaded) return;
    const timer = setTimeout(() => {
      setCachedRecentSessions(sessionsList);
    }, 400);
    return () => clearTimeout(timer);
  }, [sessionsList, isDataLoaded]);

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
          if (historyRepositoryReadyRef.current) {
            reconcileSessions(mergedSessions.map((s: any, idx: number) => legacySessionToV2(s, idx))).catch((err) => {
              console.error('[HistoryRepository] Google Drive sync reconciliation failed:', err);
            });
          }

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
    clearInstantCache();
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
        const restoredSessions = parsed.sessionsList.map((s: any) => ({
          ...s,
          datetime: new Date(s.datetime)
        }));
        setSessionsList(restoredSessions);
        if (historyRepositoryReadyRef.current) {
          reconcileSessions(restoredSessions.map((s: any, idx: number) => legacySessionToV2(s, idx))).catch((err) => {
            console.error('[HistoryRepository] Backup restore reconciliation failed:', err);
          });
        }
      }
      if (parsed.templatesList) {
        setTemplatesList(parsed.templatesList.map((t: any) => ({
          ...t,
          lastUsed: new Date(t.lastUsed)
        })));
      }
      if (parsed.exercisesList) {
        const loadedIds = new Set();
        const uniqueLoaded = parsed.exercisesList.map((e: any) => {
          if (!e.id || loadedIds.has(e.id)) {
            const newId = `ex-custom-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            loadedIds.add(newId);
            return { ...e, id: newId };
          }
          loadedIds.add(e.id);
          return e;
        });
        setExercisesList(uniqueLoaded);
      }
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
        if (historyRepositoryReadyRef.current) {
          bulkImportSessions(importedSessions.map((s, idx) => legacySessionToV2(s, idx))).catch((err) => {
            console.error('[HistoryRepository] Bulk import sessions failed:', err);
          });
        }
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
      id: `ex-custom-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
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

  const handleUpdateExerciseVariations = React.useCallback((id: string, variations: string[]) => {
    const updated = exercisesListRef.current.map(e => e.id === id ? { ...e, variations } : e);
    exercisesListRef.current = updated;
    setExercisesList(updated);
    if (latestAppDataRef.current) {
      latestAppDataRef.current = {
        ...latestAppDataRef.current,
        exercisesList: updated,
      };
      saveToDb(STORAGE_KEY, latestAppDataRef.current).catch(e => {
        console.error('[SAVE] Error saving updated variations to DB:', e);
      });
    }
  }, []);

  const handleAddTemplate = React.useCallback((name: string, exerciseNames: string[], folder?: string, exercisesDetails?: any[], notes?: string, useRoutineTargets?: boolean, defaultRestDuration?: number) => {
    const newTpl = {
      id: `tpl-custom-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      name,
      exercises: exerciseNames,
      exercisesDetails,
      lastUsed: new Date(),
      folder,
      notes,
      useRoutineTargets: !!useRoutineTargets,
      defaultRestDuration: defaultRestDuration !== undefined ? defaultRestDuration : undefined,
    };
    setTemplatesList(prev => [newTpl, ...prev]);
  }, []);

  const handleDeleteTemplate = React.useCallback((id: string) => {
    setTemplatesList(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleUpdateTemplate = React.useCallback((id: string, name: string, exerciseNames: string[], folder?: string, exercisesDetails?: any[], notes?: string, useRoutineTargets?: boolean, defaultRestDuration?: number) => {
    setTemplatesList(prev => prev.map(t => t.id === id ? { ...t, name, exercises: exerciseNames, folder, exercisesDetails, notes, useRoutineTargets: !!useRoutineTargets, defaultRestDuration } : t));
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
    clearInstantCache();
    if (historyRepositoryReadyRef.current) {
      reconcileSessions([]).catch((err) => {
        console.error('[HistoryRepository] Clear all sessions failed:', err);
      });
    }
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
  const handleMeasurePress = React.useCallback(() => {
    setIsMeasureModalVisible(true);
  }, []);

  const handleSetAppTheme = React.useCallback((theme: any) => {
    setAppThemeState(theme);
    const { applyTheme } = require('./theme');
    applyTheme(theme, customAccentColor);
    setThemeVersion(v => v + 1);
  }, [customAccentColor]);

  const handleSetCustomAccentColor = React.useCallback((color: string) => {
    setCustomAccentColor(color);
    const { applyTheme } = require('./theme');
    applyTheme(appTheme, color);
    setThemeVersion(v => v + 1);
  }, [appTheme]);

  // Compute weekly muscle sets from sessions in the last 7 days (with instant precomputed cache)
  const weeklyMuscleSets = React.useMemo(() => {
    if (sessionsList.length === 0 && initialProfileSummaries?.weeklyMuscleSets) {
      return initialProfileSummaries.weeklyMuscleSets;
    }
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
  }, [sessionsList, exercisesList, initialProfileSummaries]);

  // Persist precomputed profile summaries (charts, muscle sets) to MMKV for Frame 0 zero-delay rendering
  React.useEffect(() => {
    if (dynamicWeeklyChartData.length > 0 || (weeklyMuscleSets && Object.keys(weeklyMuscleSets).length > 0)) {
      setCachedProfileSummaries({ dynamicWeeklyChartData, weeklyMuscleSets });
    }
  }, [dynamicWeeklyChartData, weeklyMuscleSets]);



  // Active workout management states
  const isWorkoutActive = useActiveWorkoutStore(state => state.isWorkoutActive);
  const workoutName = useActiveWorkoutStore(state => state.workoutName);
  const startTime = useActiveWorkoutStore(state => state.startTime);
  const workoutExercises = useActiveWorkoutStore(state => state.workoutExercises);
  const isWorkoutModalVisible = useActiveWorkoutStore(state => state.isWorkoutModalVisible);
  const activeWorkoutComment = useActiveWorkoutStore(state => state.activeWorkoutComment);
  const beginActiveWorkout = useActiveWorkoutStore(state => state.beginWorkout);
  const endActiveWorkout = useActiveWorkoutStore(state => state.endWorkout);
  const setWorkoutName = useActiveWorkoutStore(state => state.setWorkoutName);
  const setStartTime = useActiveWorkoutStore(state => state.setStartTime);
  const setWorkoutExercises = useActiveWorkoutStore(state => state.setWorkoutExercises);
  const setIsWorkoutModalVisible = useActiveWorkoutStore(state => state.setWorkoutModalVisible);
  const setActiveWorkoutComment = useActiveWorkoutStore(state => state.setActiveWorkoutComment);
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
  const sessionsListRef = React.useRef(sessionsList);
  const userRef = React.useRef(user);
  const editingSessionIdRef = React.useRef(editingSessionId);
  const workoutNameRef = React.useRef(workoutName);
  const startTimeRef = React.useRef(startTime);
  const workoutExercisesRef = React.useRef(workoutExercises);

  const flushVersionRef = React.useRef(0);
  const saveActiveWorkoutStateRef = React.useRef<(forceFlush?: boolean) => void>(() => {});
  const setWorkoutExercisesAndRef = React.useCallback((exercises: any[]) => {
    flushVersionRef.current += 1;
    workoutExercisesRef.current = exercises;
    setWorkoutExercises(exercises);
    if (isWorkoutActiveRef.current && saveActiveWorkoutStateRef.current) {
      saveActiveWorkoutStateRef.current(false);
    }
  }, [setWorkoutExercises]);

  React.useEffect(() => {
    templatesListRef.current = templatesList;
    exercisesListRef.current = exercisesList;
    sessionsListRef.current = sessionsList;
    userRef.current = user;
    editingSessionIdRef.current = editingSessionId;
    workoutNameRef.current = workoutName;
    startTimeRef.current = startTime;
    workoutExercisesRef.current = workoutExercises;
  }, [templatesList, exercisesList, sessionsList, user, editingSessionId, workoutName, startTime, workoutExercises]);

  const handleStartWorkout = React.useCallback((name: string, exerciseNames: string[], exercisesDetails?: any[]) => {
    if (useActiveWorkoutStore.getState().isWorkoutActive) {
      Alert.alert(
        i18n.t('workout.activeWorkoutInProgressTitle'),
        i18n.t('workout.activeWorkoutInProgressMsg'),
        [{ text: i18n.t('common.ok'), style: 'cancel' }]
      );
      return;
    }

    const workoutStartedAt = new Date();
    const historyIndex = buildExerciseHistoryIndex(sessionsListRef.current);
    const matchingTemplate = templatesListRef.current.find(t => t.name.toLowerCase().trim() === name.toLowerCase().trim());
    const initialComment = matchingTemplate?.notes || '';
    if (matchingTemplate && matchingTemplate.defaultRestDuration !== undefined) {
      setDefaultRestDuration(matchingTemplate.defaultRestDuration);
    }
    
    // Fallback: Resolve exercisesDetails from templatesList if not provided (e.g. starting program calendar workout or smart up-next selector)
    let resolvedDetails = exercisesDetails;
    if (!resolvedDetails || resolvedDetails.length === 0) {
      if (matchingTemplate && matchingTemplate.exercisesDetails && matchingTemplate.exercisesDetails.length > 0) {
        resolvedDetails = matchingTemplate.exercisesDetails;
      }
    }
    
    // Build O(1) library map for fast exercise lookups
    const exerciseLibMap = new Map(
      exercisesListRef.current.map(e => [e.name.toLowerCase().trim(), e])
    );

    // Map exercise names to exercise set objects
    const mappedExercises = exerciseNames.map((exName, index) => {
      const libraryEx = exerciseLibMap.get(exName.toLowerCase().trim());
      const isExUnilateral = libraryEx?.isUnilateral || false;

      // Find the corresponding detail, preferably by index first, fallback to name lookup
      const detail = (resolvedDetails?.[index] && resolvedDetails[index].name.toLowerCase().trim() === exName.toLowerCase().trim())
        ? resolvedDetails[index]
        : resolvedDetails?.find(d => d.name.toLowerCase().trim() === exName.toLowerCase().trim());
      
      const targetVariation = detail?.variation;

      if (detail && detail.sets && detail.sets.length > 0) {
        const categoryOrdinals: Record<string, number> = {};
        const setsDetails = detail.sets.map((s: any) => {
          const unilateral = s.isUnilateral || isExUnilateral;
          const category = s.category || 'S';
          const ordinal = categoryOrdinals[category] ?? 0;
          categoryOrdinals[category] = ordinal + 1;
          const templateSuggestion = {
            weight: String(s.weight ?? ''),
            reps: String(s.reps ?? ''),
            leftWeight: String(s.leftWeight ?? s.weight ?? ''),
            leftReps: String(s.leftReps ?? s.reps ?? ''),
            rightWeight: String(s.rightWeight ?? s.weight ?? ''),
            rightReps: String(s.rightReps ?? s.reps ?? ''),
          };
          const expected = matchingTemplate?.useRoutineTargets
            ? templateSuggestion
            : resolveLastPerformanceSuggestion(
                exName,
                category,
                ordinal,
                sessionsListRef.current,
                unilateral,
                targetVariation,
                historyIndex,
                {
                  routineName: name,
                  exercisePosition: index,
                  supersetGroupId: detail.superSetGroupId,
                  progressiveOverloadEnabled: isProgressiveOverloadEnabled,
                  equipment: libraryEx?.equipment,
                  templateSuggestion,
                }
              );
          return {
            // Suggestions are intentionally not values: they remain muted until
            // the lifter explicitly enters or accepts them.
            weight: '',
            reps: '',
            suggestedWeight: expected.weight,
            suggestedReps: expected.reps,
            completed: false,
            category,
            isUnilateral: unilateral,
            leftWeight: unilateral ? '' : undefined,
            leftReps: unilateral ? '' : undefined,
            rightWeight: unilateral ? '' : undefined,
            rightReps: unilateral ? '' : undefined,
            suggestedLeftWeight: unilateral ? expected.leftWeight : undefined,
            suggestedLeftReps: unilateral ? expected.leftReps : undefined,
            suggestedRightWeight: unilateral ? expected.rightWeight : undefined,
            suggestedRightReps: unilateral ? expected.rightReps : undefined,
          };
        });
        return {
          name: exName,
          variation: targetVariation,
          sets: detail.sets.length,
          bestWeight: Number(setsDetails[0]?.weight ?? 0),
          bestReps: Number(setsDetails[0]?.reps ?? 0),
          superSetGroupId: detail.superSetGroupId,
          useRoutineTargets: Boolean(matchingTemplate?.useRoutineTargets),
          setsDetails,
        };
      }

      let bestWeight = 0;
      let bestReps = 0;
      let sets: any = 3;

      const histEntries = historyIndex.byExercise.get(exName.toLowerCase().trim());
      if (histEntries && histEntries.length > 0) {
        const prevEx = histEntries[0]?.exercise;
        if (prevEx) {
          if (typeof prevEx.sets === 'number') {
            sets = prevEx.sets;
          } else if (Array.isArray(prevEx.setsDetails)) {
            sets = prevEx.setsDetails.length;
          } else if (Array.isArray(prevEx.sets)) {
            sets = (prevEx.sets as any[]).length;
          }
        }
      }
      const setCount = typeof sets === 'number' ? Math.max(1, sets) : 3;
      const expectedSets = Array.from({ length: setCount }).map((_, setIndex) => {
        const expected = resolveLastPerformanceSuggestion(
          exName,
          'S',
          setIndex,
          sessionsListRef.current,
          isExUnilateral,
          targetVariation,
          historyIndex,
          {
            routineName: name,
            exercisePosition: index,
            progressiveOverloadEnabled: isProgressiveOverloadEnabled,
            equipment: libraryEx?.equipment,
          }
        );
        return {
          weight: '',
          reps: '',
          suggestedWeight: expected.weight,
          suggestedReps: expected.reps,
          completed: false,
          category: 'S' as const,
          isUnilateral: isExUnilateral,
          leftWeight: isExUnilateral ? '' : undefined,
          leftReps: isExUnilateral ? '' : undefined,
          rightWeight: isExUnilateral ? '' : undefined,
          rightReps: isExUnilateral ? '' : undefined,
          suggestedLeftWeight: isExUnilateral ? expected.leftWeight : undefined,
          suggestedLeftReps: isExUnilateral ? expected.leftReps : undefined,
          suggestedRightWeight: isExUnilateral ? expected.rightWeight : undefined,
          suggestedRightReps: isExUnilateral ? expected.rightReps : undefined,
        };
      });
      bestWeight = Number(expectedSets[0]?.suggestedWeight ?? 0);
      bestReps = Number(expectedSets[0]?.suggestedReps ?? 0);
      
      return {
        name: exName,
        variation: targetVariation,
        sets,
        bestWeight,
        bestReps,
        setsDetails: expectedSets,
      };
    });

    console.log('[START WORKOUT] Creating', mappedExercises.length, 'exercises');

    // Phase C: Update lastUsed on the matching template when the workout starts
    if (name && name !== i18n.t('extras.emptyWorkout')) {
      setTemplatesList(prev => prev.map(t =>
        t.name && t.name.toLowerCase().trim() === name.toLowerCase().trim()
          ? { ...t, lastUsed: new Date() }
          : t
      ));
    }

    beginActiveWorkout({
      workoutName: name,
      startTime: workoutStartedAt,
      workoutExercises: mappedExercises.length > 0 ? mappedExercises : [],
      isWorkoutModalVisible: true,
      activeWorkoutComment: initialComment,
      editingSessionId: null,
    });
  }, [beginActiveWorkout, isProgressiveOverloadEnabled]);

  const handleResumeWorkout = (session: any) => {
    if (isWorkoutActive) {
      Alert.alert(
        i18n.t('alerts.workoutActive'),
        i18n.t('alerts.workoutActiveMsg')
      );
      return;
    }

    // Map session exercises back to active workout exercises structure
    const mapped = session.exercises.map((ex: any) => {
      return {
        id: ex.id,
        name: ex.name,
        variation: ex.variation,
        superSetGroupId: ex.superSetGroupId,
        note: ex.note,
        sets: ex.setsDetails?.length || ex.sets || 3,
        bestWeight: ex.bestWeight,
        bestReps: ex.bestReps,
        setsDetails: ex.setsDetails || [],
      };
    });

    beginActiveWorkout({
      workoutName: session.title,
      startTime: new Date(session.datetime),
      workoutExercises: mapped,
      isWorkoutModalVisible: true,
      activeWorkoutComment: session.comment || '',
      editingSessionId: session.id,
    });
  };

  const handleDiscardWorkout = React.useCallback(() => {
    try {
      endActiveWorkout();
      deleteFromDb('strongern_active_workout_state').catch(() => {});
      activeWorkoutStateSavedRef.current = false;
    } catch (error) {
      console.error('[Persistence] Refusing to discard an un-tombstoned active workout:', error);
      Alert.alert(i18n.t('common.error'), 'The workout could not be safely discarded. Please try again.');
    }
  }, [endActiveWorkout]);

  const handleFinishWorkout = React.useCallback(async (summary: { totalVolume: number; totalSets: number; durationMin: number; comment?: string }) => {
    if (summary.totalSets === 0) {
      handleDiscardWorkout();
      return;
    }
    const completedExercises = workoutExercisesRef.current.reduce<any[]>((acc, ex) => {
      const count = typeof ex.sets === 'number' ? ex.sets : (ex.sets?.length || 0);
      if (count > 0) {
        if (typeof ex.sets === 'number') {
          // setsDetails comes from flushExercisesToParent — contains all sets with completed flags
          const allDetails: any[] = (ex as any).setsDetails || [];
          const doneSets = allDetails.filter((s: any) => s.completed === true);
          const bestWeight = doneSets.reduce((max: number, s: any) => Math.max(max, parseFloat(s.weight) || 0), 0);
          const bestReps = doneSets.reduce((max: number, s: any) => Math.max(max, parseInt(s.reps, 10) || 0), 0);
          acc.push({
            name: ex.name,
            variation: ex.variation,
            // sets count = only completed sets (for history summary display)
            sets: doneSets.length,
            bestWeight: bestWeight || ex.bestWeight || 0,
            bestReps: bestReps || ex.bestReps || 0,
            // setsDetails = ALL sets (done + undone) so resuming shows full workout with all exercises & sets
            setsDetails: allDetails.map((s: any) => ({
              weight: parseFloat(s.weight) || 0,
              reps: parseInt(s.reps, 10) || 0,
              completed: s.completed === true,
              rpe: s.rpe ? parseFloat(s.rpe) : undefined,
              category: s.category || 'S',
              isUnilateral: s.isUnilateral || false,
              leftWeight: s.isUnilateral ? (parseFloat(s.leftWeight) || 0) : undefined,
              leftReps: s.isUnilateral ? (parseInt(s.leftReps, 10) || 0) : undefined,
              rightWeight: s.isUnilateral ? (parseFloat(s.rightWeight) || 0) : undefined,
              rightReps: s.isUnilateral ? (parseInt(s.rightReps, 10) || 0) : undefined,
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

    const durableSession = editingSessionIdRef.current
      ? updatedSessions.find((session: any) => session.id === editingSessionIdRef.current)
      : updatedSessions[0];
    try {
      if (durableSession && historyRepositoryReadyRef.current) {
        await upsertSession(legacySessionToV2(durableSession));
      }
      endActiveWorkout();
      activeWorkoutStateSavedRef.current = false;
    } catch (error) {
      console.error('[Persistence] Workout finish transaction failed; active draft retained.', error);
      Alert.alert(i18n.t('common.error'), 'Your workout is still safely stored, but finishing it failed. Please try again.');
      return;
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

  }, [handleDiscardWorkout, endActiveWorkout]);

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
  const handleDeleteSession = React.useCallback(async (sessionId: string) => {
    try {
      const nextSessions = sessionsListRef.current.filter(s => s.id !== sessionId);
      if (historyRepositoryReadyRef.current) {
        await softDeleteSession(sessionId);
      }
      setSessionsList(nextSessions);
    } catch (error) {
      console.error('[HistoryRepository] Refusing non-durable history deletion:', error);
      Alert.alert(i18n.t('common.error'), 'The workout could not be safely deleted. Please try again.');
    }
  }, []);

  // Keep totalWorkouts derived from sessionsList length (avoids nested setState crash)
  // When isFullHistoryLoaded is true, sync exact length (covers additions and deletions).
  // While false (Frame 0 preview), keep the cached count.
  React.useEffect(() => {
    if (!isFullHistoryLoaded) return;
    setUser(prev => {
      if (prev.totalWorkouts === sessionsList.length) return prev;
      return { ...prev, totalWorkouts: sessionsList.length };
    });
    setCachedTotalSessionsCount(sessionsList.length);
  }, [sessionsList, isFullHistoryLoaded]);

  const activeWorkoutStateSavedRef = React.useRef(false);

  const isWorkoutActiveRef = React.useRef(isWorkoutActive);
  const isWorkoutModalVisibleRef = React.useRef(isWorkoutModalVisible);
  const activeWorkoutCommentRef = React.useRef(activeWorkoutComment);
  React.useEffect(() => {
    isWorkoutActiveRef.current = isWorkoutActive;
    isWorkoutModalVisibleRef.current = isWorkoutModalVisible;
    activeWorkoutCommentRef.current = activeWorkoutComment;
    workoutExercisesRef.current = workoutExercises;
  }, [isWorkoutActive, isWorkoutModalVisible, activeWorkoutComment, workoutExercises]);

  const flushSave = React.useCallback(() => {
    if (__DEV__) console.log('[SAVE] AppState change/flush save triggered');
    try {
      flushMainAppData();
    } catch (e) {
      console.error('[SAVE] Error during flushSave:', e);
    }
  }, [flushMainAppData]);

  // Flush on web beforeunload
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleBeforeUnload = () => {
      flushSave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushSave]);


  // Save workout state when app goes to background (native)
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      try {
        if (state === 'active') {
          Notifications.dismissAllNotificationsAsync().catch(() => {});
        }
        if (state === 'background' || state === 'inactive') {
          flushSave();
        }
      } catch (e) {
        console.error('[AppState Error in App.tsx]:', e);
      }
    });
    return () => sub.remove();
  }, [flushSave]);



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
  const historyScreenElement = (
    <HistoryScreen sessions={sessionsList} onResumeWorkout={handleResumeWorkout} onDeleteSession={handleDeleteSession} />
  );

  const workoutScreenElement = React.useMemo(() => {
    return (
      <WorkoutScreen 
        isHydrating={!isDataLoaded || !isWorkoutRestored}
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
        onUpdateExerciseNotes={handleUpdateExerciseNotes}
        onUpdateExercise={handleUpdateExercise}
      />
    );
  }, [
    isDataLoaded,
    isWorkoutRestored,
    templatesList,
    handleStartWorkout,
    handleAddTemplate,
    handleDeleteTemplate,
    handleUpdateTemplate,
    handleReorderTemplates,
    exercisesList,
    handleUpdateExerciseNotes,
    handleUpdateExercise,
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
        onUpdateExerciseVariations={handleUpdateExerciseVariations}
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




  const handleWorkoutCrashRecovery = React.useCallback(() => {
    console.warn('[RECOVERY] Resetting active workout state after ErrorBoundary caught crash');
    try {
      endActiveWorkout();
      deleteFromDb('strongern_active_workout_state');
    } catch (e) {
      console.error('Error tombstoning corrupt active workout state:', e);
      return;
    }
    isWorkoutActiveRef.current = false;
    isWorkoutModalVisibleRef.current = false;
    activeWorkoutStateSavedRef.current = false;
  }, [endActiveWorkout]);

  const navigationTheme = React.useMemo(() => ({
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.accent,
      background: colors.bg,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.accent,
    },
  }), []);

  // Show login/onboarding if not yet completed
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="light" />
      {authState === null ? null : !authState.hasCompletedOnboarding ? (
        <LoginScreen
          onComplete={handleAuthComplete}
          onGoogleLogin={handleGoogleLogin}
          onRestoreBackup={handleRestoreBackup}
        />
      ) : (
        <NavigationContainer key={languageVersion} theme={navigationTheme}>
        <View style={styles.root}>
          <Tab.Navigator
            initialRouteName="Profile"
            tabBar={renderTabBar}
            screenOptions={{ headerShown: false, freezeOnBlur: true }}
          >
            <Tab.Screen name="Profile">
              {() => (
                <ProfileScreen
                  isHydrating={!isDataLoaded || !isWorkoutRestored}
                  user={user}
                  weeklyChartData={dynamicWeeklyChartData}
                  sessions={sessionsList}
                  isAutoTimerEnabled={isAutoTimerEnabled}
                  setIsAutoTimerEnabled={setIsAutoTimerEnabled}
                  onMeasurePress={handleMeasurePress}
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
                  setAppTheme={handleSetAppTheme}
                  customAccentColor={customAccentColor}
                  setCustomAccentColor={handleSetCustomAccentColor}

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
          <ErrorBoundary onReset={handleWorkoutCrashRecovery}>
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
              onUpdateActiveExercises={setWorkoutExercisesAndRef}
              onUpdateExerciseNotes={handleUpdateExerciseNotes}
              onUpdateExerciseInsightsNotes={handleUpdateExerciseInsightsNotes}
              onUpdateExerciseVariations={handleUpdateExerciseVariations}
              onAddCustomExercise={handleAddExercise}
              isLiveHeartRateEnabled={isLiveHeartRateEnabled}
              onUpdateExercise={handleUpdateExercise}

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
          <MeasureModalSheet
            visible={isMeasureModalVisible}
            onClose={() => setIsMeasureModalVisible(false)}
            primaryMetricsList={primaryMetricsList}
            bodyPartMetricsList={bodyPartMetricsList}
            onRecordMetric={handleRecordMetric}
            onAddMetric={handleAddMetric}
            onDeleteMetricLog={handleDeleteMetricLog}
          />

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
      <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.bg,
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
