// App.tsx — Navigation root with font loading, live workout state, and completion celebrations
import React from 'react';
import { View, StyleSheet, ActivityIndicator, Modal, Text, Pressable, Alert, Linking } from 'react-native';
import { NavigationContainer }      from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar }                from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Ionicons }                 from '@expo/vector-icons';
import * as googleDrive             from './utils/googleDrive';
import { initDb, saveToDb, loadFromDb } from './utils/db';
import { importStrongCSV } from './utils/csvImporter';
import { setSecureItem, getSecureItem, deleteSecureItem } from './utils/secureStore';
import { setAlertListener, CustomAlertConfig } from './utils/alertOverride';
import { loadAuthState, saveAuthState, saveGoogleProfile, AuthMode, GoogleProfile } from './utils/authStore';
import { buildBackupData, exportBackupToFile, BackupData } from './utils/backupManager';

// Screens — Auth
import LoginScreen from './screens/LoginScreen';


// Design tokens
import { colors, spacing, radius, font, shadow, ripple as rippleTokens, globalAnimation } from './theme';

// Layout components
import BottomTabBar      from './components/layout/BottomTabBar';
import ActiveWorkoutBar  from './components/layout/ActiveWorkoutBar';
import ActiveWorkoutModal from './components/layout/ActiveWorkoutModal';
import { soundConfig } from './utils/soundPlayer';

// Simulators
import { WatchCompanionSimulator } from './components/ui/WatchCompanionSimulator';
import { SocialShareCard } from './components/ui/SocialShareCard';

// Screens
import ProfileScreen   from './screens/ProfileScreen';
import HistoryScreen   from './screens/HistoryScreen';
import WorkoutScreen   from './screens/WorkoutScreen';
import ExercisesScreen from './screens/ExercisesScreen';
import MeasureScreen   from './screens/MeasureScreen';
import MuscleMapScreen from './screens/MuscleMapScreen';

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

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
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
  const [isSocialShareVisible, setIsSocialShareVisible] = React.useState(false);

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

  // Modular Toggles and Custom Sound Settings
  const [isPlateCalculatorEnabled, setIsPlateCalculatorEnabled] = React.useState(false);
  const [isProgramsEnabled, setIsProgramsEnabled] = React.useState(false);
  const [isHistoryEnabled, setIsHistoryEnabled] = React.useState(true);
  const [isMusclesEnabled, setIsMusclesEnabled] = React.useState(true);
  const [enableRoutineFolders, setEnableRoutineFolders] = React.useState(false);
  const [isDeveloperModeEnabled, setIsDeveloperModeEnabled] = React.useState(false);
  const [appTheme, setAppThemeState] = React.useState<string>('default');
  const [customAccentColor, setCustomAccentColor] = React.useState('#4F8EF7');
  const [themeVersion, setThemeVersion] = React.useState(0);
  const [themeOverrides, setThemeOverrides] = React.useState<any>({});

  const [isProgressiveOverloadEnabled, setIsProgressiveOverloadEnabled] = React.useState(false);
  const [isAutoFinishSetEnabled, setIsAutoFinishSetEnabled] = React.useState(true);
  const [isKeyboardDismissOnNextEnabled, setIsKeyboardDismissOnNextEnabled] = React.useState(true);
  const [editingSessionId, setEditingSessionId] = React.useState<string | null>(null);


  const [soundSetCompleted, setSoundSetCompleted] = React.useState<string>('chime');
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
              setThemeOverrides(parsedOverrides);
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
            if (parsed.isPlateCalculatorEnabled !== undefined) setIsPlateCalculatorEnabled(parsed.isPlateCalculatorEnabled);
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
            if (parsed.isKeyboardDismissOnNextEnabled !== undefined) setIsKeyboardDismissOnNextEnabled(parsed.isKeyboardDismissOnNextEnabled);
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
          } else {
            const { applyTheme } = require('./theme');
            applyTheme('default', '#4F8EF7', parsedOverrides);
          }
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
        isPlateCalculatorEnabled,
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
        enableRoutineFolders,
        isDeveloperModeEnabled,
        isProgressiveOverloadEnabled,
        isAutoFinishSetEnabled,
        isKeyboardDismissOnNextEnabled,
        appTheme,
        customAccentColor,
      };
      saveToDb(STORAGE_KEY, data);
    } catch (e) {
      console.warn('Error saving state to database', e);
    }
  }, [user, sessionsList, templatesList, exercisesList, primaryMetricsList, bodyPartMetricsList, isAutoTimerEnabled, googleUser, animationSpeed, lastSynced, foldersList, activeProgramId, programStartDate, isHealthSyncEnabled, isLiveHeartRateEnabled, isPlateCalculatorEnabled, isProgramsEnabled, isHistoryEnabled, isMusclesEnabled, soundSetCompleted, soundWorkoutFinished, soundTimerCompleted, customSounds, soundVolume, defaultRestDuration, showAchievementBadges, showSummaryWidgets, showWeeklyTonnage, showWorkoutsChart, showHighlights, enableRoutineFolders, isDeveloperModeEnabled, isProgressiveOverloadEnabled, isAutoFinishSetEnabled, isKeyboardDismissOnNextEnabled, appTheme, customAccentColor]);

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
          const foundId = await googleDrive.findBackupFile(googleUser.accessToken);
          if (foundId) {
            fileId = foundId;
            fileIdUpdated = true;
          }
        }

        if (fileId) {
          await googleDrive.updateBackupFile(googleUser.accessToken, fileId, backupData);
        } else {
          fileId = await googleDrive.createBackupFile(googleUser.accessToken, backupData);
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

          // 1. Merge User Profile details (keep highest total workouts)
          const mergedUser = {
            ...user,
            name: name || user.name,
            avatarUri: avatarUri || user.avatarUri,
            totalWorkouts: Math.max(user.totalWorkouts || 0, backupData.user?.totalWorkouts || 0),
            isPro: user.isPro || backupData.user?.isPro || false,
          };
          setUser(mergedUser);

          // 2. Merge Sessions (deduplicating by ID)
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
        const profile = await googleDrive.fetchUserProfile(accessToken);
        const fileId = await googleDrive.findBackupFile(accessToken);
        
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
      isPlateCalculatorEnabled,
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
      isKeyboardDismissOnNextEnabled,
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
      if (parsed.user) setUser(parsed.user);
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
      if (s.isPlateCalculatorEnabled !== undefined) setIsPlateCalculatorEnabled(s.isPlateCalculatorEnabled);
      if (s.isProgramsEnabled !== undefined) setIsProgramsEnabled(s.isProgramsEnabled);
      if (s.isHistoryEnabled !== undefined) setIsHistoryEnabled(s.isHistoryEnabled);
      if (s.isMusclesEnabled !== undefined) setIsMusclesEnabled(s.isMusclesEnabled);
      if (s.enableRoutineFolders !== undefined) setEnableRoutineFolders(s.enableRoutineFolders);
      if (s.showAchievementBadges !== undefined) setShowAchievementBadges(s.showAchievementBadges);
      if (s.showSummaryWidgets !== undefined) setShowSummaryWidgets(s.showSummaryWidgets);
      if (s.showWeeklyTonnage !== undefined) setShowWeeklyTonnage(s.showWeeklyTonnage);
      if (s.showWorkoutsChart !== undefined) setShowWorkoutsChart(s.showWorkoutsChart);
      if (s.showHighlights !== undefined) setShowHighlights(s.showHighlights);
      if (s.animationSpeed !== undefined) setAnimationSpeed(s.animationSpeed);
      if (s.isProgressiveOverloadEnabled !== undefined) setIsProgressiveOverloadEnabled(s.isProgressiveOverloadEnabled);
      if (s.isAutoFinishSetEnabled !== undefined) setIsAutoFinishSetEnabled(s.isAutoFinishSetEnabled);
      if (s.isKeyboardDismissOnNextEnabled !== undefined) setIsKeyboardDismissOnNextEnabled(s.isKeyboardDismissOnNextEnabled);
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
  const handleAddExercise = (name: string, muscleGroup: string, equipment?: string) => {
    const newEx = {
      id: `ex-custom-${Date.now()}`,
      name,
      muscleGroup,
      weeklySets: 0,
      equipment: equipment || 'Other',
    };
    setExercisesList(prev => [newEx, ...prev]);
    return newEx;
  };

  const handleDeleteExercise = (id: string) => {
    setExercisesList(prev => prev.filter(e => e.id !== id));
  };

  const handleUpdateExerciseNotes = (id: string, notes?: string) => {
    setExercisesList(prev => prev.map(e => e.id === id ? { ...e, notes } : e));
  };

  const handleAddTemplate = (name: string, exerciseNames: string[], folder?: string) => {
    const newTpl = {
      id: `tpl-custom-${Date.now()}`,
      name,
      exercises: exerciseNames,
      lastUsed: new Date(),
      folder,
    };
    setTemplatesList(prev => [newTpl, ...prev]);
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplatesList(prev => prev.filter(t => t.id !== id));
  };

  const handleUpdateTemplate = (id: string, name: string, exerciseNames: string[], folder?: string) => {
    setTemplatesList(prev => prev.map(t => t.id === id ? { ...t, name, exercises: exerciseNames, folder } : t));
  };

  const handleReorderTemplates = (newTemplates: any[]) => {
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
  };

  const parseMetricValue = (str: string): number => {
    const cleaned = str.replace(/,/g, '');
    const match = cleaned.match(/[-+]?[0-9]*\.?[0-9]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  const getUnit = (label: string): string => {
    const l = label.toLowerCase();
    if (l.includes('fat')) return '%';
    if (l.includes('caloric') || l.includes('intake')) return ' kcal';
    if (l.includes('weight')) return ' kg';
    return ' cm';
  };

  const formatMetricValue = (val: number, label: string): string => {
    const unit = getUnit(label);
    if (unit === ' kcal') {
      return `${val.toLocaleString()} kcal`;
    }
    return `${val}${unit}`;
  };

  const mergeMetricsList = (local: any[], remote: any[]) => {
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
  };

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

  const handleAddFolder = (name: string) => {
    setFoldersList(prev => prev.includes(name) ? prev : [...prev, name]);
  };

  const handleRemoveFolder = (name: string) => {
    setFoldersList(prev => prev.filter(f => f !== name));
    setTemplatesList(prev => prev.map(t => t.folder === name ? { ...t, folder: undefined } : t));
  };

  const handleSubscribeProgram = (programId: string | null) => {
    setActiveProgramId(programId);
    setProgramStartDate(programId ? new Date().toISOString() : null);
  };

  const handleWipeAllData = () => {
    setUser({
      name: 'Alex Morgan',
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
  const [isWorkoutActive, setIsWorkoutActive] = React.useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return !!window.localStorage.getItem('strongern_active_workout_state');
      }
    } catch {}
    return false;
  });
  const [workoutName, setWorkoutName] = React.useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('strongern_active_workout_state');
        if (saved) {
          return JSON.parse(saved).workoutName || 'Active Workout';
        }
      }
    } catch {}
    return "";
  });
  const [startTime, setStartTime] = React.useState<Date>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('strongern_active_workout_state');
        if (saved) {
          return new Date(JSON.parse(saved).startTime);
        }
      }
    } catch {}
    return new Date();
  });
  const [workoutExercises, setWorkoutExercises] = React.useState<any[]>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('strongern_active_workout_state');
        if (saved) {
          return JSON.parse(saved).workoutExercises || [];
        }
      }
    } catch {}
    return [];
  });
  const [isWorkoutModalVisible, setIsWorkoutModalVisible] = React.useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('strongern_active_workout_state');
        if (saved) {
          return JSON.parse(saved).isWorkoutModalVisible ?? false;
        }
      }
    } catch {}
    return false;
  });
  const [completionData, setCompletionData] = React.useState<{
    totalVolume: number;
    totalSets: number;
    durationMin: number;
    name: string;
  } | null>(null);

  const handleStartWorkout = (name: string, exerciseNames: string[]) => {
    setWorkoutName(name);
    setStartTime(new Date());
    
    // Map exercise names to exercise set objects
    const mappedExercises = exerciseNames.map(exName => {
      let bestWeight = 60;
      let bestReps = 10;
      let sets: any = 3;

      const previousSession = sessionsList.find((s: any) => 
        s.exercises && s.exercises.some((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase())
      );
      if (previousSession) {
        const found = previousSession.exercises.find((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase());
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
      };
    });

    setWorkoutExercises(mappedExercises.length > 0 ? mappedExercises : [
      { name: 'Bench Press', sets: 3, bestWeight: 60, bestReps: 10 }
    ]);
    setIsWorkoutActive(true);
    setIsWorkoutModalVisible(true);
  };

  const handleResumeWorkout = (session: any) => {
    if (isWorkoutActive) {
      Alert.alert(
        "Workout Active",
        "You already have an active workout session running. Please finish or discard it first before resuming/editing another workout."
      );
      return;
    }

    setEditingSessionId(session.id);
    setWorkoutName(session.title);
    setStartTime(new Date(session.datetime));

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

  const handleFinishWorkout = (summary: { totalVolume: number; totalSets: number; durationMin: number }) => {
    const completedExercises = workoutExercises
      .filter(ex => {
        const count = typeof ex.sets === 'number' ? ex.sets : (ex.sets?.length || 0);
        return count > 0;
      })
      .map(ex => {
        if (typeof ex.sets === 'number') {
          return {
            name: ex.name,
            sets: ex.sets,
            bestWeight: ex.bestWeight || 60,
            bestReps: ex.bestReps || 10,
            setsDetails: (ex as any).setsDetails || [],
          };
        }
        const setsArray: any[] = ex.sets || [];
        const bestWeight = setsArray.reduce((max, s) => Math.max(max, parseFloat(s.weight) || 0), 0);
        const bestReps = setsArray.reduce((max, s) => Math.max(max, parseInt(s.reps, 10) || 0), 0);
        return {
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
        };
      });

    let updatedSessions = [...sessionsList];
    let nextUser = { ...user };

    if (editingSessionId) {
      updatedSessions = sessionsList.map((s: any) => {
        if (s.id === editingSessionId) {
          return {
            ...s,
            title: workoutName,
            exercises: completedExercises.length > 0 ? completedExercises : [
              { name: 'Bench Press', sets: 3, bestWeight: 60, bestReps: 10 }
            ],
            durationMinutes: summary.durationMin,
            totalVolumeKg: summary.totalVolume,
            prs: summary.totalVolume > 0 ? 1 : 0,
          };
        }
        return s;
      });
      setEditingSessionId(null);
    } else {
      const newSession = {
        id: `session-new-${Date.now()}`,
        title: workoutName,
        datetime: new Date(),
        comment: 'Logged via live active tracker!',
        exercises: completedExercises.length > 0 ? completedExercises : [
          { name: 'Bench Press', sets: 3, bestWeight: 60, bestReps: 10 }
        ],
        durationMinutes: summary.durationMin,
        totalVolumeKg: summary.totalVolume,
        prs: summary.totalVolume > 0 ? 1 : 0,
      };
      updatedSessions = [newSession, ...sessionsList];
      nextUser.totalWorkouts += 1;
    }

    setSessionsList(updatedSessions);
    setUser(nextUser);
    
    // Show celebratory screen
    setCompletionData({
      totalVolume: summary.totalVolume,
      totalSets: summary.totalSets,
      durationMin: summary.durationMin,
      name: workoutName,
    });

    setIsWorkoutActive(false);
    setIsWorkoutModalVisible(false);
  };

  const handleDiscardWorkout = () => {
    setIsWorkoutActive(false);
    setIsWorkoutModalVisible(false);
    setWorkoutExercises([]);
    setWorkoutName('Active Workout');
    setEditingSessionId(null);
  };

  // Persist active workout state on changes
  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (isWorkoutActive) {
          const activeState = {
            workoutName,
            startTime: startTime.toISOString(),
            workoutExercises,
            isWorkoutModalVisible,
          };
          window.localStorage.setItem('strongern_active_workout_state', JSON.stringify(activeState));
        } else {
          window.localStorage.removeItem('strongern_active_workout_state');
        }
      }
    } catch (e) {
      console.warn('Error persisting active workout state', e);
    }
  }, [isWorkoutActive, workoutName, startTime, workoutExercises, isWorkoutModalVisible]);

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
        workoutExercises.forEach(ex => {
          if (ex.setsDetails) {
            ex.setsDetails.forEach((set: any) => {
              if (set.completed) {
                totalVolume += (set.weight || 0) * (set.reps || 0);
                totalSets += 1;
              }
            });
          } else {
            totalVolume += (ex.bestWeight || 0) * (ex.bestReps || 0) * (ex.sets || 0);
            totalSets += ex.sets || 0;
          }
        });

        Alert.alert(
          "Safety Timer Triggered",
          "Your active workout session has exceeded the 3-hour limit and has been automatically saved.",
          [{ text: "OK" }]
        );

        handleFinishWorkout({
          totalVolume,
          totalSets,
          durationMin: 180, // Cap at 3 hours (180 mins)
        });
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isWorkoutActive, startTime, workoutExercises, handleFinishWorkout]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Show login/onboarding if not yet completed
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="light" />
      {authState === null ? (
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
        <NavigationContainer>
        <View style={styles.root}>
          <Tab.Navigator
            initialRouteName="Workout"
            tabBar={props => (
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
            )}
            screenOptions={{ headerShown: false }}
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
                  isPlateCalculatorEnabled={isPlateCalculatorEnabled}
                  setIsPlateCalculatorEnabled={setIsPlateCalculatorEnabled}
                  isProgramsEnabled={isProgramsEnabled}
                  setIsProgramsEnabled={setIsProgramsEnabled}
                  isHistoryEnabled={isHistoryEnabled}
                  setIsHistoryEnabled={setIsHistoryEnabled}
                  isMusclesEnabled={isMusclesEnabled}
                  setIsMusclesEnabled={setIsMusclesEnabled}
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
                  isDeveloperModeEnabled={isDeveloperModeEnabled}
                  setIsDeveloperModeEnabled={setIsDeveloperModeEnabled}
                  appTheme={appTheme}
                  setAppTheme={(theme: any) => {
                    setAppThemeState(theme);
                    const { applyTheme } = require('./theme');
                    applyTheme(theme, customAccentColor, themeOverrides);
                    setThemeVersion(v => v + 1);
                  }}
                  customAccentColor={customAccentColor}
                  setCustomAccentColor={(color: string) => {
                    setCustomAccentColor(color);
                    const { applyTheme } = require('./theme');
                    applyTheme(appTheme, color, themeOverrides);
                    setThemeVersion(v => v + 1);
                  }}
                  themeOverrides={themeOverrides}
                  onUpdateThemeOverrides={async (newOverrides: any) => {
                    const merged = { ...themeOverrides, ...newOverrides };
                    setThemeOverrides(merged);
                    await setSecureItem('theme_overrides', JSON.stringify(merged));
                    const { applyTheme } = require('./theme');
                    applyTheme(appTheme, customAccentColor, merged);
                    setThemeVersion(v => v + 1);
                  }}
                  onResetTheme={async () => {
                    setThemeOverrides({});
                    setCustomAccentColor('#4F8EF7');
                    setAppThemeState('default');
                    await deleteSecureItem('theme_overrides');
                    const { applyTheme, DEFAULT_THEME } = require('./theme');
                    applyTheme('default', '#4F8EF7', DEFAULT_THEME);
                    setThemeVersion(v => v + 1);
                  }}
                  authMode={authState.authMode}
                  onAppLogout={handleAppLogout}
                  isProgressiveOverloadEnabled={isProgressiveOverloadEnabled}
                  setIsProgressiveOverloadEnabled={setIsProgressiveOverloadEnabled}
                  isAutoFinishSetEnabled={isAutoFinishSetEnabled}
                  setIsAutoFinishSetEnabled={setIsAutoFinishSetEnabled}
                  isKeyboardDismissOnNextEnabled={isKeyboardDismissOnNextEnabled}
                  setIsKeyboardDismissOnNextEnabled={setIsKeyboardDismissOnNextEnabled}
                />
              )}
            </Tab.Screen>

            {isHistoryEnabled && (
              <Tab.Screen name="History">
                {() => <HistoryScreen sessions={sessionsList} onResumeWorkout={handleResumeWorkout} />}
              </Tab.Screen>
            )}

            <Tab.Screen name="Workout">
              {() => (
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
                />
              )}
            </Tab.Screen>

            <Tab.Screen name="Exercises">
              {() => (
                <ExercisesScreen 
                  exercises={exercisesList} 
                  onAddExercise={handleAddExercise}
                  onDeleteExercise={handleDeleteExercise}
                  onUpdateExerciseNotes={handleUpdateExerciseNotes}
                  sessions={sessionsList}
                />
              )}
            </Tab.Screen>

            {isMusclesEnabled && (
              <Tab.Screen name="Muscles">
                {() => (
                  <MuscleMapScreen
                    weeklyMuscleSets={weeklyMuscleSets}
                    sessions={sessionsList}
                    exercisesList={exercisesList}
                  />
                )}
              </Tab.Screen>
            )}
          </Tab.Navigator>

          {isWatchSimulatorVisible && (
            <WatchCompanionSimulator
              workoutName={workoutName}
              startTime={startTime}
              activeExercises={workoutExercises}
              onCheckSet={() => {
                Alert.alert("Wearable Companion", "Set marked as completed on smartwatch companion app!");
              }}
              onClose={() => setIsWatchSimulatorVisible(false)}
            />
          )}

          {/* Active Workout Interactive Modal Sheet */}
          <ActiveWorkoutModal
            visible={isWorkoutModalVisible}
            workoutName={workoutName}
            startTime={startTime}
            exercises={workoutExercises}
            isAutoTimerEnabled={isAutoTimerEnabled}
            onClose={() => setIsWorkoutModalVisible(false)}
            onFinish={handleFinishWorkout}
            onDiscard={handleDiscardWorkout}
            exerciseLibrary={exercisesList}
            onUpdateActiveExercises={setWorkoutExercises}
            onUpdateExerciseNotes={handleUpdateExerciseNotes}
            onAddCustomExercise={handleAddExercise}
            isLiveHeartRateEnabled={isLiveHeartRateEnabled}
            isPlateCalculatorEnabled={isPlateCalculatorEnabled}
            defaultRestDuration={defaultRestDuration}
            onRenameWorkout={setWorkoutName}
            sessions={sessionsList}
            isProgressiveOverloadEnabled={isProgressiveOverloadEnabled}
            isAutoFinishSetEnabled={isAutoFinishSetEnabled}
            isKeyboardDismissOnNextEnabled={isKeyboardDismissOnNextEnabled}
          />

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
                  
                  <Text style={styles.celebrationTitle}>WORKOUT COMPLETED!</Text>
                  <Text style={styles.celebrationSubtitle}>{completionData.name}</Text>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.celebrationStats}>
                    <View style={styles.celebrationStatItem}>
                      <Text style={styles.statVal}>{completionData.durationMin}m</Text>
                      <Text style={styles.statLabel}>DURATION</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.celebrationStatItem}>
                      <Text style={styles.statVal}>{completionData.totalSets}</Text>
                      <Text style={styles.statLabel}>SETS</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.celebrationStatItem}>
                      <Text style={styles.statVal}>{completionData.totalVolume} kg</Text>
                      <Text style={styles.statLabel}>VOLUME</Text>
                    </View>
                  </View>
                  
                  <Pressable
                    style={[styles.doneBtn, { backgroundColor: colors.surface2, borderColor: colors.accent, borderWidth: 1, marginBottom: spacing.sm }]}
                    onPress={() => setIsSocialShareVisible(true)}
                    android_ripple={rippleTokens.surface}
                  >
                    <Text style={[styles.doneBtnText, { color: colors.accent }]}>SHARE WORKOUT CARD</Text>
                  </Pressable>

                  <Pressable
                    style={styles.doneBtn}
                    onPress={() => setCompletionData(null)}
                    android_ripple={rippleTokens.accent}
                  >
                    <Text style={styles.doneBtnText}>AWESOME</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          )}

          {completionData && (
            <SocialShareCard
              visible={isSocialShareVisible}
              workoutName={completionData.name}
              durationMin={completionData.durationMin}
              totalSets={completionData.totalSets}
              totalVolume={completionData.totalVolume}
              onClose={() => setIsSocialShareVisible(false)}
            />
          )}
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
                            key={idx}
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
                        <Text style={styles.alertBtnText}>OK</Text>
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
});
