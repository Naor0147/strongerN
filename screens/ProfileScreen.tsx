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
  googleUser:            { email: string; name: string } | null;
  onGoogleLogin:         (email: string, name: string) => boolean;
  onGoogleLogout:        () => void;
  onCloudSync:           () => boolean;
  onUpdateUser?:         (name: string) => void;
  onImportBackup?:       (backupStr: string) => boolean;
  onExportBackup?:       () => string;
  onExportCSV?:          () => string;
  animationSpeed:        number;
  setAnimationSpeed:     (val: number) => void;
  onWipeAllData?:        () => void;
}

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
          totalWorkouts: mockSessions.length,
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

  const bestWeek   = useMemo(() => {
    if (!weeklyChartData || weeklyChartData.length === 0) return 0;
    return Math.max(...weeklyChartData.map(d => d.count));
  }, [weeklyChartData]);

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

  // Google Login submit
  const handleGoogleSubmit = () => {
    if (!googleEmail.trim()) {
      Alert.alert('Error', 'Please enter an email.');
      return;
    }
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setIsGoogleModalVisible(false);
      const isRestored = onGoogleLogin(googleEmail.trim().toLowerCase(), googleName.trim() || user?.name || '');
      
      if (isRestored) {
        Alert.alert(
          'Google Cloud Recovery',
          `Welcome back! We found an existing training backup for "${googleEmail.trim().toLowerCase()}" and successfully restored all workouts, custom templates, and exercises!`
        );
      } else {
        Alert.alert(
          'Google Account Connected',
          `Successfully connected to "${googleEmail.trim().toLowerCase()}". Auto-backup is now active! All completed sessions will sync instantly to your cloud.`
        );
      }
    }, 1500);
  };

  // Manual cloud sync
  const handleManualSyncPress = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      const ok = onCloudSync();
      if (ok) {
        Alert.alert('Cloud Sync Successful', 'All workouts, custom exercises, circumferences, and templates are backed up successfully in your Google Drive cloud!');
      } else {
        Alert.alert('Error', 'Sync failed. Please connect a Google account first.');
      }
    }, 1200);
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
        <Card style={styles.heroCard} padding={0} testID="profile.user-card">
          <Pressable
            onPress={() => {
              setTempName(user?.name || '');
              setIsRenameVisible(true);
            }}
            style={styles.heroContent}
            android_ripple={rippleTokens.surface}
            accessibilityLabel="Edit Profile Name"
          >
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

            <Ionicons name="create-outline" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>

        {/* ── Stats Row ────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            value={bestWeek}
            label="Best week"
            icon="flame-outline"
            iconColor={colors.gold}
            testID="profile.stat-best-week"
          />
          <View style={styles.statGap} />
          <StatCard
            value={avgPerWeek}
            label="Avg / week"
            decimals={1}
            icon="trending-up-outline"
            iconColor={colors.accent}
            testID="profile.stat-avg-week"
          />
          <View style={styles.statGap} />
          <StatCard
            value={user?.totalWorkouts ?? 0}
            label="All time"
            icon="barbell-outline"
            iconColor={colors.highlight}
            testID="profile.stat-all-time"
          />
        </View>

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
        <Card padding={spacing.lg} testID="profile.chart-card">
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

        {/* ── Recent Activity Teaser ───────────────────────────── */}
        <SectionLabel
          title="Recent Highlights"
          subtitle="Your best moments"
          style={[styles.sectionLabel, { marginTop: spacing.xl }]}
          testID="profile.highlights-section"
        />
        <Card variant="highlight" padding={spacing.lg} testID="profile.pr-card">
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

        {/* ── Body & Measurements Section ───────────────────────── */}
        <SectionLabel
          title="Body & Measurements"
          style={[styles.sectionLabel, { marginTop: spacing.xl }]}
          testID="profile.body-section"
        />
        <Card padding={0} testID="profile.measure-card">
          <Pressable
            style={styles.measureRow}
            onPress={onMeasurePress}
            android_ripple={rippleTokens.surface}
            testID="profile.measure-btn"
            accessibilityLabel="Open measurements"
          >
            <View style={[styles.measureIcon, { backgroundColor: colors.highlight + '22' }]}>
              <Ionicons name="resize-outline" size={20} color={colors.highlight} />
            </View>
            <View style={styles.measureText}>
              <Text style={styles.measureTitle}>Measurements</Text>
              <Text style={styles.measureSub}>Body metrics & size tracking</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>

        {/* ── Quick Access: Settings ────────────────────────────── */}
        <SectionLabel
          title="Settings & Backup"
          style={[styles.sectionLabel, { marginTop: spacing.xl }]}
        />
        <Card padding={0}>
          <Pressable
            style={styles.settingsQuickRow}
            onPress={() => setIsSettingsVisible(true)}
            android_ripple={rippleTokens.surface}
            accessibilityLabel="Open settings"
          >
            <View style={[styles.settingsQuickIcon, { backgroundColor: colors.accent + '22' }]}>
              <Ionicons name="settings-outline" size={20} color={colors.accent} />
            </View>
            <View style={styles.measureText}>
              <Text style={styles.measureTitle}>App Settings</Text>
              <Text style={styles.measureSub}>Timer · Cloud Sync · Import/Export · About</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
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

      {/* Modal B: Google Connect Sheet */}
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
              <View style={styles.googleBrandRow}>
                <Ionicons name="logo-google" size={24} color={colors.accent} />
                <Text style={styles.googleBrandText}>Sign In with Google</Text>
              </View>

              <Text style={styles.inputLabel}>GOOGLE EMAIL ADDRESS</Text>
              <TextInput
                style={styles.textInput}
                placeholder="account@gmail.com"
                placeholderTextColor={colors.textMuted}
                value={googleEmail}
                onChangeText={setGoogleEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                keyboardAppearance="dark"
              />

              <Text style={styles.inputLabel}>NAME FOR PROFILE</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Alex Morgan"
                placeholderTextColor={colors.textMuted}
                value={googleName}
                onChangeText={setGoogleName}
                keyboardAppearance="dark"
              />

              {isSyncing ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={styles.loadingText}>Contacting Google server...</Text>
                </View>
              ) : (
                <Pressable
                  style={styles.submitBtn}
                  onPress={handleGoogleSubmit}
                  android_ripple={rippleTokens.accent}
                >
                  <Text style={styles.submitBtnText}>SIGN IN & RESTORE</Text>
                </Pressable>
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
            {/* ── Workout Preferences ─────────────────────────────── */}
            <SectionLabel
              title="Workout Preferences"
              style={styles.sectionLabel}
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

                {/* Stepped custom slider */}
                <View style={styles.sliderContainer}>
                  <View style={styles.sliderTrack}>
                    <View style={[styles.sliderFill, { width: `${(animationSpeed / 2) * 100}%` }]} />
                    {[0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(val => {
                      const isActive = animationSpeed === val;
                      return (
                        <Pressable
                          key={val}
                          style={[
                            styles.sliderNotch,
                            { left: `${(val / 2) * 100}%` },
                            isActive && styles.sliderNotchActive
                          ]}
                          onPress={() => setAnimationSpeed(val)}
                        >
                          {isActive && <View style={styles.sliderNotchInner} />}
                        </Pressable>
                      );
                    })}
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
                    <Text style={styles.syncTimeLabel}>Last synced: Just Now</Text>
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
    justifyContent: 'space-between',
    columnGap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recoveryBtn: {
    flex: 1,
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
    fontSize: 9,
    fontFamily: font.bold,
    letterSpacing: 0.5,
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
  sliderLabels: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:      spacing.xs,
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
