import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, font, spacing, radius, shadow, ripple as rippleTokens } from '../theme';
import i18n from '../utils/i18n';
import Card from './ui/Card';
import {
  getDatabaseDiagnostics,
  restoreAllTombstonedSessions,
  DatabaseDiagnostics,
} from '../storage/history/repository';

export interface DeveloperDiagnosticsViewProps {
  onBack?: () => void;
  onRefreshSessions?: () => Promise<void> | void;
  isHebrew?: boolean;
}

export const DeveloperDiagnosticsView: React.FC<DeveloperDiagnosticsViewProps> = ({
  onBack,
  onRefreshSessions,
}) => {
  const [diagnostics, setDiagnostics] = useState<DatabaseDiagnostics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [repairing, setRepairing] = useState<boolean>(false);

  const fetchDiagnostics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDatabaseDiagnostics();
      setDiagnostics(data);
    } catch (error) {
      console.error('[DeveloperDiagnosticsView] Failed to get diagnostics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchDiagnostics();
  };

  const handleRepair = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setRepairing(true);

      const restoredCount = await restoreAllTombstonedSessions();

      if (onRefreshSessions) {
        await onRefreshSessions();
      }

      await fetchDiagnostics();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const rawSuccessText = i18n.t('developer.diagnostics.repairSuccess', { count: restoredCount });
      const successMessage = typeof rawSuccessText === 'string'
        ? rawSuccessText.replace(/\{count\}|\{\{count\}\}/g, String(restoredCount))
        : `Repaired ${restoredCount} workouts successfully`;

      Alert.alert(
        i18n.t('developer.diagnostics.repairButton'),
        successMessage,
        [{ text: i18n.t('common.ok') || 'OK' }]
      );
    } catch (error: any) {
      console.error('[DeveloperDiagnosticsView] Repair failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        i18n.t('common.error') || 'Error',
        error?.message || 'Failed to repair workout history'
      );
    } finally {
      setRepairing(false);
    }
  };

  const hasTombstones = (diagnostics?.tombstonedSessionsCount ?? 0) > 0;

  return (
    <View style={styles.container}>
      {/* Top Toolbar */}
      <View style={styles.toolbar}>
        <Pressable
          style={styles.refreshButton}
          onPress={handleRefresh}
          android_ripple={rippleTokens.surface}
          disabled={loading || repairing}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={colors.accent}
            style={loading ? styles.rotatingIcon : undefined}
          />
          <Text style={styles.refreshButtonText}>
            {i18n.t('developer.diagnostics.refresh')}
          </Text>
        </Pressable>
      </View>

      {loading && !diagnostics ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Storage Engine Status Banner */}
          <Card padding={spacing.md} style={styles.statusBanner}>
            <View style={styles.statusBannerHeader}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: diagnostics?.isReady ? colors.success : colors.error },
                ]}
              />
              <Text style={styles.statusTitle}>
                {i18n.t('developer.diagnostics.sqliteStatus')}
              </Text>
              <View style={{ flex: 1 }} />
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: diagnostics?.isReady
                      ? colors.success + '20'
                      : colors.error + '20',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    { color: diagnostics?.isReady ? colors.success : colors.error },
                  ]}
                >
                  {diagnostics?.isReady ? 'READY · WAL' : 'UNAVAILABLE'}
                </Text>
              </View>
            </View>
          </Card>

          {/* 2x2 Telemetry Grid */}
          <View style={styles.grid}>
            {/* Active Workouts */}
            <Card padding={spacing.md} style={styles.statCard}>
              <View
                style={[styles.statIconBox, { backgroundColor: colors.accent + '20' }]}
              >
                <Ionicons name="barbell-outline" size={20} color={colors.accent} />
              </View>
              <Text style={[styles.statValue, { color: colors.accent }]}>
                {diagnostics?.activeSessionsCount ?? 0}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                {i18n.t('developer.diagnostics.activeWorkouts')}
              </Text>
            </Card>

            {/* Tombstoned Workouts */}
            <Card
              padding={spacing.md}
              style={[
                styles.statCard,
                hasTombstones ? { borderColor: colors.error + '60' } : undefined,
              ]}
            >
              <View
                style={[
                  styles.statIconBox,
                  {
                    backgroundColor: hasTombstones
                      ? colors.error + '20'
                      : colors.success + '20',
                  },
                ]}
              >
                <Ionicons
                  name={hasTombstones ? 'trash-outline' : 'shield-checkmark-outline'}
                  size={20}
                  color={hasTombstones ? colors.error : colors.success}
                />
              </View>
              <Text
                style={[
                  styles.statValue,
                  { color: hasTombstones ? colors.error : colors.success },
                ]}
              >
                {diagnostics?.tombstonedSessionsCount ?? 0}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                {i18n.t('developer.diagnostics.tombstonedWorkouts')}
              </Text>
            </Card>

            {/* Total SQLite Rows */}
            <Card padding={spacing.md} style={styles.statCard}>
              <View
                style={[styles.statIconBox, { backgroundColor: colors.highlight + '20' }]}
              >
                <Ionicons name="server-outline" size={20} color={colors.highlight} />
              </View>
              <Text style={[styles.statValue, { color: colors.highlight }]}>
                {diagnostics?.rawTotalSessionsCount ?? 0}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                {i18n.t('developer.diagnostics.rawTotalRows')}
              </Text>
            </Card>

            {/* MMKV Instant Cache */}
            <Card padding={spacing.md} style={styles.statCard}>
              <View
                style={[styles.statIconBox, { backgroundColor: colors.gold + '20' }]}
              >
                <Ionicons name="flash-outline" size={20} color={colors.gold} />
              </View>
              <Text style={[styles.statValue, { color: colors.gold }]}>
                {diagnostics?.cachedRecentCount ?? 0}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                {i18n.t('developer.diagnostics.mmkvCacheCount')}
              </Text>
            </Card>
          </View>

          {/* Sync & Hydration Details */}
          <Card padding={spacing.md} style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons
                  name="cloud-done-outline"
                  size={18}
                  color={colors.textSecondary}
                  style={{ marginRight: spacing.sm }}
                />
                <Text style={styles.detailLabel}>
                  {i18n.t('developer.diagnostics.isFullHistoryLoaded')}
                </Text>
              </View>
              <View style={styles.badgeSuccess}>
                <Text style={styles.badgeSuccessText}>HYDRATED</Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons
                  name="layers-outline"
                  size={18}
                  color={colors.textSecondary}
                  style={{ marginRight: spacing.sm }}
                />
                <Text style={styles.detailLabel}>
                  {i18n.t('developer.diagnostics.mmkvCacheCount')} (Recent / Total)
                </Text>
              </View>
              <Text style={styles.detailValue}>
                {diagnostics?.cachedRecentCount ?? 0} / {diagnostics?.cachedTotalCount ?? 0}
              </Text>
            </View>
          </Card>

          {/* Repair Action Section */}
          <Card padding={spacing.lg} style={styles.actionCard}>
            {hasTombstones ? (
              <View style={styles.warningContainer}>
                <View style={styles.warningHeader}>
                  <Ionicons name="warning-outline" size={24} color={colors.error} />
                  <Text style={styles.warningTitle}>
                    {diagnostics?.tombstonedSessionsCount} soft-deleted workout(s) detected
                  </Text>
                </View>
                <Text style={styles.warningDesc}>
                  Tombstoned sessions are hidden from history and analytics. Tap below to
                  instantly untombstone and restore all workouts back to your active history.
                </Text>
              </View>
            ) : (
              <View style={styles.healthyContainer}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={28}
                  color={colors.success}
                  style={{ marginBottom: spacing.xs }}
                />
                <Text style={styles.healthyText}>
                  {i18n.t('developer.diagnostics.noTombstones')}
                </Text>
              </View>
            )}

            <Pressable
              style={[
                styles.repairButton,
                repairing && styles.repairButtonDisabled,
                !hasTombstones && styles.repairButtonSecondary,
              ]}
              onPress={handleRepair}
              disabled={repairing}
              android_ripple={rippleTokens.surface}
            >
              {repairing ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: spacing.sm }} />
              ) : (
                <Ionicons
                  name="medkit-outline"
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: spacing.sm }}
                />
              )}
              <Text style={styles.repairButtonText}>
                {repairing
                  ? i18n.t('developer.diagnostics.repairing')
                  : i18n.t('developer.diagnostics.repairButton')}
              </Text>
            </Pressable>
          </Card>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.md,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  refreshButtonText: {
    color: colors.accent,
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
  },
  rotatingIcon: {
    transform: [{ rotate: '45deg' }],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  scroll: {
    flex: 1,
  },
  statusBanner: {
    marginBottom: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  statusBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.bold,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  statusPillText: {
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    ...(shadow.card as object),
  },
  statIconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: font.sizes.xl,
    fontFamily: font.bold,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  detailCard: {
    marginBottom: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontFamily: font.medium,
  },
  detailValue: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  badgeSuccess: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  badgeSuccessText: {
    color: colors.success,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
  actionCard: {
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
  },
  warningContainer: {
    marginBottom: spacing.md,
    width: '100%',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  warningTitle: {
    color: colors.error,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    flex: 1,
  },
  warningDesc: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
    lineHeight: 18,
  },
  healthyContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  healthyText: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.medium,
    textAlign: 'center',
  },
  repairButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    width: '100%',
    height: 48,
    borderRadius: radius.md,
    ...(shadow.card as object),
  },
  repairButtonSecondary: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  repairButtonDisabled: {
    opacity: 0.6,
  },
  repairButtonText: {
    color: '#FFFFFF',
    fontSize: font.sizes.md,
    fontFamily: font.bold,
  },
});

export default DeveloperDiagnosticsView;
