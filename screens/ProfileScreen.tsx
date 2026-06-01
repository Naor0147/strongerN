// screens/ProfileScreen.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, spacing, radius, ripple as rippleTokens } from '../theme';
import { User, ChartDataPoint } from '../data/mockData';

import ScreenHeader from '../components/layout/ScreenHeader';
import Card         from '../components/ui/Card';
import Avatar       from '../components/ui/Avatar';
import Badge        from '../components/ui/Badge';
import BarChart     from '../components/ui/BarChart';
import StatCard     from '../components/ui/StatCard';
import SectionLabel from '../components/ui/SectionLabel';

interface ProfileScreenProps {
  user:                  User;
  weeklyChartData:       ChartDataPoint[];
  isAutoTimerEnabled:    boolean;
  setIsAutoTimerEnabled: (val: boolean) => void;
  onMeasurePress:        () => void;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ 
  user, 
  weeklyChartData, 
  isAutoTimerEnabled, 
  setIsAutoTimerEnabled,
  onMeasurePress,
}) => {
  const chartData = useMemo(
    () => weeklyChartData.map(d => ({ label: d.weekLabel, value: d.count })),
    [weeklyChartData]
  );

  const bestWeek   = useMemo(() => Math.max(...weeklyChartData.map(d => d.count)), [weeklyChartData]);
  const avgPerWeek = useMemo(
    () => weeklyChartData.reduce((s, d) => s + d.count, 0) / weeklyChartData.length,
    [weeklyChartData]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Profile"
        actions={[
          { icon: 'notifications-outline', label: 'Notifications', testID: 'profile.notifications' },
          { icon: 'settings-outline', label: 'Settings', testID: 'profile.settings' },
        ]}
        testID="profile.header"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        {/* ── User Hero Card ───────────────────────────────────── */}
        <Card style={styles.heroCard} padding={0} testID="profile.user-card">
          <View style={styles.heroContent}>
            <View style={styles.avatarSection}>
              <Avatar
                initials={getInitials(user.name)}
                uri={user.avatarUri}
                size={64}
                isPro={user.isPro}
                testID="profile.avatar"
              />
              {user.isPro && (
                <Badge
                  label="PRO"
                  color={colors.gold}
                  textColor={colors.textInverse}
                  style={styles.proBadge}
                  testID="profile.pro-badge"
                />
              )}
            </View>

            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{user.name}</Text>
              <View style={styles.heroMeta}>
                <Ionicons name="trophy-outline" size={13} color={colors.gold} />
                <Text style={styles.heroMetaText}>{user.totalWorkouts} workouts completed</Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
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
            value={user.totalWorkouts}
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
            <View style={[styles.prIcon, { backgroundColor: colors.gold + '22' }]}>
              <Ionicons name="trophy" size={20} color={colors.gold} />
            </View>
            <View style={styles.prText}>
              <Text style={styles.prTitle}>New PR — Bench Press</Text>
              <Text style={styles.prSub}>100 kg × 5 reps  ·  May 28</Text>
            </View>
            <Badge
              label="+5 kg"
              color={colors.gold}
              textColor={colors.textInverse}
            />
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
              <Text style={styles.measureSub}>Body metrics &amp; size tracking</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>

        {/* ── Settings Section ─────────────────────────────────── */}
        <SectionLabel
          title="Workout Settings"
          style={[styles.sectionLabel, { marginTop: spacing.xl }]}
          testID="profile.settings-section"
        />
        <Card padding={spacing.lg} testID="profile.settings-card">
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="alarm-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Auto Rest Timer</Text>
                <Text style={styles.settingSubtitle} numberOfLines={2}>
                  Automatically start countdown after completing a set
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
        </Card>
      </ScrollView>
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
});

export default ProfileScreen;
