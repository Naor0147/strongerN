// screens/ProfileScreen.tsx
import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow } from '../theme';
import * as googleDrive from '../utils/googleDrive';
import {
  User,
  ChartDataPoint,
  mockUser,
  mockSessions,
  mockTemplates,
  mockExercises,
  mockPrimaryMetrics,
  mockBodyPartMetrics,
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
  onGoogleLogin:         (email: string, name: string, accessToken?: string, fileId?: string, avatarUri?: string) => Promise<boolean> | boolean;
  onGoogleLogout:        () => void;
  onCloudSync:           () => Promise<boolean> | boolean;
  onUpdateUser?:         (name: string) => void;
  onImportBackup?:       (backupStr: string) => boolean;
  onExportBackup?:       () => string;
  onExportCSV?:          () => string;
  animationSpeed:        number;
  setAnimationSpeed:     (val: number) => void;
  onWipeAllData?:        () => void;
  lastSynced:            string | null;
  weeklyMuscleSets?:     Record<string, number>;
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

const ProfileScreen: React.FC<ProfileScreenProps> = ({ 
  user, 
  weeklyChartData, 
  sessions,
  isAutoTimerEnabled, 
  setIsAutoTimerEnabled,
  onMeasurePress,
  googleUser,
  onGoogleLogin,
  onGoogleLogout,
  onCloudSync,
  onUpdateUser,
  onImportBackup,
  onExportBackup,
  onExportCSV,
  animationSpeed,
  setAnimationSpeed,
  onWipeAllData,
  lastSynced,
  weeklyMuscleSets = {},
}) => {
  // Modals state
  const [isRenameVisible, setIsRenameVisible] = useState(false);
  const [isGoogleModalVisible, setIsGoogleModalVisible] = useState(false);
  const [isBackupPanelVisible, setIsBackupPanelVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  // Form inputs
  const [tempName, setTempName] = useState(user?.name || '');
  const [googleEmail, setGoogleEmail] = useState('naor0147@gmail.com');
  const [googleName, setGoogleName] = useState(user?.name || '');
  const [backupText, setBackupText] = useState('');
  const [pastedBackup, setPastedBackup] = useState('');

  // Segmented control / developer token states
  const [googleActiveTab, setGoogleActiveTab] = useState<'login' | 'token'>('login');
  const [googleClientId, setGoogleClientId] = useState('806742513296-amc1kbf9u6k11qg50jrt1r4b3qg0k9n0.apps.googleusercontent.com');
  const [googleAccessToken, setGoogleAccessToken] = useState('');

  // Load animations
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(25)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800 * animationSpeed,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.05)),
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800 * animationSpeed,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [animationSpeed]);

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
    const list: { name: string; weight: number; reps: number; date: string }[] = [];
    (sessions || []).forEach(session => {
      (session.exercises || []).forEach((ex: any) => {
        const d = new Date(session.datetime);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateStr = `${monthNames[d.getMonth()]} ${d.getDate()}`;
        list.push({ name: ex.name, weight: ex.bestWeight, reps: ex.bestReps, date: dateStr });
      });
    });
    const unique = new Map<string, typeof list[number]>();
    list.sort((a, b) => b.weight - a.weight).forEach(item => {
      if (!unique.has(item.name)) {
        unique.set(item.name, item);
      }
    });
    return Array.from(unique.values()).slice(0, 5);
  }, [sessions]);

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
      setIsGoogleModalVisible(false);

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

  // Google Sign-In via OAuth popup
  const handleGoogleWebAuth = () => {
    if (!googleClientId.trim()) {
      Alert.alert('Error', 'Please enter a Google Client ID.');
      return;
    }

    const redirectUri = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'http://localhost:8081';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(googleClientId.trim())}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email')}`;

    const popup = typeof window !== 'undefined' ? window.open(authUrl, 'google-oauth', 'width=500,height=600') : null;

    if (!popup) {
      Alert.alert(
        'Popup Blocked',
        'Google Login popup was blocked by your browser. Please allow popups or use the Developer Token tab to connect instantly!'
      );
      return;
    }

    setIsSyncing(true);

    const interval = setInterval(async () => {
      try {
        if (popup && popup.location && popup.location.hash) {
          const hash = popup.location.hash;
          if (hash.includes('access_token')) {
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get('access_token');
            popup.close();
            clearInterval(interval);

            if (token) {
              await handleConnectWithToken(token);
            } else {
              setIsSyncing(false);
              Alert.alert('Authentication Failed', 'Could not retrieve access token from Google.');
            }
          }
        }
      } catch (e) {
        // Cross-origin boundaries throw errors while popup is on Google login page, which is expected
      }

      if (!popup || popup.closed) {
        clearInterval(interval);
        setIsSyncing(false);
      }
    }, 500);
  };

  const handleDeveloperTokenSubmit = () => {
    if (!googleAccessToken.trim()) {
      Alert.alert('Error', 'Please enter a Google Access Token.');
      return;
    }
    handleConnectWithToken(googleAccessToken.trim());
  };

  // Manual cloud sync
  const handleManualSyncPress = async () => {
    setIsSyncing(true);
    try {
      const ok = await onCloudSync();
      setIsSyncing(false);
      if (ok) {
        Alert.alert('Cloud Sync Successful', 'All workouts, custom exercises, circumferences, and templates are backed up successfully in your Google Drive cloud!');
      } else {
        Alert.alert('Error', 'Sync failed. Please connect a Google account first.');
      }
    } catch (e: any) {
      setIsSyncing(false);
      Alert.alert('Error', `Sync failed: ${e.message || e}`);
    }
  };

  // Clipboard backups
  const handleExportJson = () => {
    if (onExportBackup) {
      const json = onExportBackup();
      setBackupText(json);
      setIsBackupPanelVisible(true);
    }
  };

  const handleExportCsvPress = () => {
    if (onExportCSV) {
      const csv = onExportCSV();
      setBackupText(csv);
      setIsBackupPanelVisible(true);
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
          {user?.totalWorkouts === 0 && (
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
        <Card style={[styles.heroCard, { backgroundColor: 'transparent' }]} padding={0} testID="profile.user-card">
          <View style={styles.heroContent}>
            <View style={styles.avatarSection}>
              <Avatar
                initials={getInitials(user?.name || 'Alex Morgan')}
                uri={user?.avatarUri}
                size={64}
                testID="profile.avatar"
              />
            </View>

            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{user?.name || 'Alex Morgan'}</Text>
              <View style={styles.heroMeta}>
                <Ionicons name="trophy-outline" size={13} color={colors.gold} />
                <Text style={styles.heroMetaText}>{user?.totalWorkouts ?? 0} workouts completed</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* ── Dashboard ────────────────────────────────────────── */}
        <SectionLabel
          title="Dashboard"
          rightIcon="add-circle-outline"
          rightIconColor={colors.accent}
          onRightPress={() => {
            Alert.alert('Custom Dashboard', 'You can customize your profile highlights and statistics.');
          }}
          style={styles.sectionLabel}
          testID="profile.dashboard-section"
        />

        {/* ── Chart Card ───────────────────────────────────────── */}
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

        {/* ── Stats Row (Moved Below Dashboard, Best Week Removed) ────────── */}
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
            value={user?.totalWorkouts ?? 0}
            label="All time"
            icon="barbell-outline"
            iconColor={colors.highlight}
            style={{ backgroundColor: 'transparent' }}
            testID="profile.stat-all-time"
          />
        </View>

        {/* ── Recent Activity Teaser ───────────────────────────── */}
        <SectionLabel
          title="Recent Highlights"
          subtitle="Your best moments"
          style={[styles.sectionLabel, { marginTop: spacing.xl }]}
          testID="profile.highlights-section"
        />
        <Card variant="highlight" padding={spacing.lg} style={{ backgroundColor: 'transparent' }} testID="profile.pr-card">
          <View style={styles.prRow}>
            <View style={[styles.prIcon, { backgroundColor: colors.accent + '22' }]}>
              <Ionicons name="trophy" size={20} color={colors.accent} />
            </View>
            <View style={styles.prText}>
              <Text style={styles.prTitle}>{bestPr ? `New PR — ${bestPr.name}` : 'Ready to Start!'}</Text>
              <Text style={styles.prSub}>
                {bestPr ? `${bestPr.weight} kg × ${bestPr.reps} reps  ·  ${bestPr.date}` : 'Log workouts to record achievements.'}
              </Text>
            </View>
            {bestPr && (
              <Badge
                label="PR"
                color={colors.accent}
                textColor={colors.textInverse}
              />
            )}
          </View>
        </Card>

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

        {/* ── Volume Trends ── */}
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

      {/* Modal B: Google Connect Sheet (Redesigned with Web Sign-In & Developer Token) */}
      <Modal
        visible={isGoogleModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsGoogleModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>CONNECT GOOGLE</Text>
              <IconButton
                name="close"
                size={22}
                color={colors.textSecondary}
                onPress={() => setIsGoogleModalVisible(false)}
              />
            </View>

            <View style={styles.modalForm}>
              {/* Tab Selector */}
              <View style={styles.tabBar}>
                <Pressable
                  style={[styles.tabItem, googleActiveTab === 'login' && styles.tabItemActive]}
                  onPress={() => setGoogleActiveTab('login')}
                  android_ripple={rippleTokens.surface}
                >
                  <Text style={[styles.tabText, googleActiveTab === 'login' && styles.tabTextActive]}>
                    GOOGLE SIGN-IN
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.tabItem, googleActiveTab === 'token' && styles.tabItemActive]}
                  onPress={() => setGoogleActiveTab('token')}
                  android_ripple={rippleTokens.surface}
                >
                  <Text style={[styles.tabText, googleActiveTab === 'token' && styles.tabTextActive]}>
                    DEV TOKEN
                  </Text>
                </Pressable>
              </View>

              {googleActiveTab === 'login' ? (
                <View style={{ flex: 1, rowGap: spacing.sm }}>
                  <Text style={styles.instructionText}>
                    Sign in dynamically using a secure Google popup. Requires a Client ID configured for this development origin.
                  </Text>

                  <Text style={styles.inputLabel}>GOOGLE CLIENT ID</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter Google Client ID"
                    placeholderTextColor={colors.textMuted}
                    value={googleClientId}
                    onChangeText={setGoogleClientId}
                    keyboardAppearance="dark"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsTitle}>HOW TO GET A CLIENT ID:</Text>
                    <Text style={styles.instructionsStep}>1. Open Google Cloud Console API Credentials page.</Text>
                    <Text style={styles.instructionsStep}>2. Create an OAuth 2.0 Client ID for "Web Application".</Text>
                    <Text style={styles.instructionsStep}>3. Add authorized JavaScript origin: {(typeof window !== 'undefined' && window.location) ? window.location.origin : 'http://localhost:8081'}</Text>
                  </View>

                  {isSyncing ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={colors.accent} />
                      <Text style={styles.loadingText}>Contacting Google server...</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.submitBtn}
                      onPress={handleGoogleWebAuth}
                      android_ripple={rippleTokens.accent}
                    >
                      <Text style={styles.submitBtnText}>SIGN IN WITH GOOGLE</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <View style={{ flex: 1, rowGap: spacing.sm }}>
                  <Text style={styles.instructionText}>
                    Directly connect using a temporary access token from Google's playground. Perfect for instant testing!
                  </Text>

                  <Text style={styles.inputLabel}>OAUTH ACCESS TOKEN</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Paste access token (starts with ya29...)"
                    placeholderTextColor={colors.textMuted}
                    value={googleAccessToken}
                    onChangeText={setGoogleAccessToken}
                    keyboardAppearance="dark"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsTitle}>INSTANT CONNECT STEPS:</Text>
                    <Text style={styles.instructionsStep}>1. Open developers.google.com/oauthplayground</Text>
                    <Text style={styles.instructionsStep}>2. Select Drive API v3 (drive.file scope) & userinfo profile/email scopes.</Text>
                    <Text style={styles.instructionsStep}>3. Click Authorize, click Exchange, and paste the Access Token above!</Text>
                  </View>

                  {isSyncing ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={colors.accent} />
                      <Text style={styles.loadingText}>Validating credentials...</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.submitBtn, { backgroundColor: colors.highlight }]}
                      onPress={handleDeveloperTokenSubmit}
                      android_ripple={rippleTokens.accent}
                    >
                      <Text style={[styles.submitBtnText, { color: '#0D0F14' }]}>CONNECT WITH TOKEN</Text>
                    </Pressable>
                  )}
                </View>
              )}
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
      {isSyncing && !isGoogleModalVisible && (
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
        <SafeAreaView style={styles.safe} edges={['top']}>
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
            {/* ── Account Management ──────────────────────────────── */}
            <SectionLabel
              title="Account Management"
              style={styles.sectionLabel}
            />
            <Card padding={spacing.lg}>
              <Pressable
                style={styles.settingRow}
                onPress={() => {
                  setTempName(user?.name || '');
                  setIsRenameVisible(true);
                }}
                android_ripple={rippleTokens.surface}
              >
                <View style={styles.settingInfo}>
                  <Ionicons name="person-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Edit Name</Text>
                    <Text style={styles.settingSubtitle}>
                      Change your profile name
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            </Card>

            {/* ── Workout Preferences ─────────────────────────────── */}
            <SectionLabel
              title="Workout Preferences"
              style={[styles.sectionLabel, { marginTop: spacing.xl }]}
            />
            <Card padding={spacing.lg}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="alarm-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Auto Rest Timer</Text>
                    <Text style={styles.settingSubtitle} numberOfLines={2}>
                      Start 90s countdown after completing a set
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

              {/* ── Animation Speed Scale Selector ──────────────────── */}
              <View style={{ marginTop: spacing.md }}>
                <View style={styles.settingInfo}>
                  <Ionicons name="speedometer-outline" size={20} color={colors.highlight} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Global Animation Speed</Text>
                    <Text style={styles.settingSubtitle}>
                      Scale factor for entry and view transitions
                    </Text>
                  </View>
                </View>

                {/* Premium Slider (Dots Removed) */}
                <View style={styles.sliderContainer}>
                  <View style={styles.sliderTrack}>
                    <View style={[styles.sliderFill, { width: `${(animationSpeed / 2) * 100}%` }]} />
                    
                    {/* Premium dynamic glowing thumb */}
                    <View style={[styles.sliderThumb, { left: `${(animationSpeed / 2) * 100}%` }]}>
                      <View style={styles.sliderThumbInner} />
                    </View>

                    {/* Transparent tactile touch hotspots */}
                    {[0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(val => (
                      <Pressable
                        key={val}
                        style={[
                          styles.sliderTapZone,
                          { left: `${(val / 2) * 100}%` }
                        ]}
                        onPress={() => setAnimationSpeed(val)}
                        hitSlop={8}
                      />
                    ))}
                  </View>
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabelText}>0x (Instant)</Text>
                    <Text style={[styles.sliderLabelText, { color: colors.accent, fontFamily: font.bold }]}>
                      {animationSpeed === 0 ? 'Instant (0x)' : `${animationSpeed}x`}
                    </Text>
                    <Text style={styles.sliderLabelText}>2x (Slow)</Text>
                  </View>
                </View>
              </View>
            </Card>


            {/* ── Cloud Sync & Backup ─────────────────────────────── */}
            <SectionLabel
              title="Cloud Sync & Backup"
              subtitle="Google account sync"
              style={[styles.sectionLabel, { marginTop: spacing.xl }]}
            />
            <Card padding={spacing.lg}>
              {googleUser ? (
                <View style={styles.syncContainer}>
                  <View style={styles.syncHeaderRow}>
                    <View style={styles.syncLeft}>
                      <View style={[styles.googleIconCircle, { backgroundColor: colors.accent + '22' }]}>
                        <Ionicons name="logo-google" size={18} color={colors.accent} />
                      </View>
                      <View>
                        <Text style={styles.syncTitle}>Google Account Connected</Text>
                        <Text style={styles.syncEmail} numberOfLines={1}>{googleUser.email}</Text>
                      </View>
                    </View>
                    <Pressable onPress={onGoogleLogout} style={styles.signOutBtn}>
                      <Text style={styles.signOutBtnText}>Sign Out</Text>
                    </Pressable>
                  </View>

                  <View style={styles.syncDivider} />

                  <View style={styles.syncStatusRow}>
                    <View style={styles.syncStatusLeft}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={styles.syncStatusText}>Auto-Backup Active</Text>
                    </View>
                    <Text style={styles.syncTimeLabel}>{formatLastSynced(lastSynced)}</Text>
                  </View>

                  <Pressable
                    onPress={handleManualSyncPress}
                    style={styles.syncNowBtn}
                    android_ripple={rippleTokens.accent}
                  >
                    <Ionicons name="sync" size={16} color="#0D0F14" />
                    <Text style={styles.syncNowBtnText}>SYNC NOW</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.googlePromoContainer}>
                  <Ionicons name="cloud-upload-outline" size={32} color={colors.accent} />
                  <Text style={styles.googlePromoTitle}>NEVER LOSE YOUR WORKOUTS</Text>
                  <Text style={styles.googlePromoSubtitle}>
                    Connect your Google Account to automatically back up all workouts, exercises, and templates.
                  </Text>
                  <Pressable
                    onPress={() => {
                      setGoogleEmail('naor0147@gmail.com');
                      setGoogleName(user?.name || '');
                      setIsGoogleModalVisible(true);
                    }}
                    style={styles.connectGoogleBtn}
                    android_ripple={rippleTokens.accent}
                  >
                    <Ionicons name="logo-google" size={16} color="#0D0F14" />
                    <Text style={styles.connectGoogleBtnText}>CONNECT GOOGLE ACCOUNT</Text>
                  </Pressable>
                </View>
              )}
            </Card>

            {/* ── Manual Data Recovery ────────────────────────────── */}
            <SectionLabel
              title="Data Portability"
              subtitle="Export · Import · Recovery"
              style={[styles.sectionLabel, { marginTop: spacing.xl }]}
            />
            <Card padding={spacing.md}>
              <View style={styles.recoveryGrid}>
                <Pressable
                  style={styles.recoveryBtn}
                  onPress={handleExportJson}
                  android_ripple={rippleTokens.surface}
                >
                  <Ionicons name="code-download-outline" size={18} color={colors.accent} />
                  <Text style={styles.recoveryBtnText}>EXPORT JSON</Text>
                </Pressable>

                <Pressable
                  style={styles.recoveryBtn}
                  onPress={handleExportCsvPress}
                  android_ripple={rippleTokens.surface}
                >
                  <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                  <Text style={styles.recoveryBtnText}>EXPORT CSV</Text>
                </Pressable>

                <Pressable
                  style={styles.recoveryBtn}
                  onPress={() => {
                    setPastedBackup('');
                    setBackupText('');
                    setIsBackupPanelVisible(true);
                  }}
                  android_ripple={rippleTokens.surface}
                >
                  <Ionicons name="push-outline" size={18} color={colors.highlight} />
                  <Text style={styles.recoveryBtnText}>IMPORT BACKUP</Text>
                </Pressable>

                <Pressable
                  style={styles.recoveryBtn}
                  onPress={handleLoadDemoData}
                  android_ripple={rippleTokens.surface}
                >
                  <Ionicons name="sparkles-outline" size={18} color={colors.highlight} />
                  <Text style={styles.recoveryBtnText}>RESTORE DEMO</Text>
                </Pressable>
              </View>

              <View style={styles.recoveryDivider} />

              <Pressable
                onPress={handlePhoneWipeSimulator}
                style={styles.wipeSimBtn}
                android_ripple={rippleTokens.surface}
              >
                <Ionicons name="refresh" size={14} color={colors.textSecondary} />
                <Text style={styles.wipeSimBtnText}>PHONE SWITCH SIMULATOR (WIPE LOCAL DATA)</Text>
              </Pressable>
            </Card>

            {/* ── App Info ────────────────────────────────────────── */}
            <SectionLabel
              title="About"
              style={[styles.sectionLabel, { marginTop: spacing.xl }]}
            />
            <Card padding={spacing.lg}>
              <View style={styles.aboutRow}>
                <View style={[styles.aboutIconBox, { backgroundColor: colors.accent + '22' }]}>
                  <Ionicons name="barbell-outline" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aboutAppName}>strongerN</Text>
                  <Text style={styles.aboutVersion}>Version 1.0.0  ·  AMOLED Optimized</Text>
                </View>
              </View>
            </Card>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
    backgroundColor: colors.successGlow,
    borderColor:     colors.success,
    borderWidth:     1,
    borderRadius:    radius.full,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  chartBadgeText: {
    color:      colors.success,
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

  // Recovery Panel
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
  recoveryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
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
});

export default ProfileScreen;
