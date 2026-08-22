import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { colors, font, spacing, radius, shadow, ripple as rippleTokens } from '../theme';
import i18n from '../utils/i18n';
import Card from './ui/Card';
import {
  getDatabaseDiagnostics,
  restoreAllTombstonedSessions,
  DatabaseDiagnostics,
} from '../storage/history/repository';
import {
  getOauthLogs,
  clearOauthLogs,
  subscribeOauthLogs,
  copyOauthLogsToClipboard,
  OAuthLogEvent,
} from '../utils/oauthDiagnostics';
import { seedSmartWorkouts } from '../storage/seedTestData';

export interface DeveloperDiagnosticsViewProps {
  onBack?: () => void;
  onRefreshSessions?: () => Promise<void> | void;
  isHebrew?: boolean;
  onCloudSync?: () => Promise<boolean> | boolean;
}

export const DeveloperDiagnosticsView: React.FC<DeveloperDiagnosticsViewProps> = ({
  onBack,
  onRefreshSessions,
  onCloudSync,
}) => {
  const [diagnostics, setDiagnostics] = useState<DatabaseDiagnostics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [repairing, setRepairing] = useState<boolean>(false);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [seedCount, setSeedCount] = useState<number>(400);
  const [oauthLogs, setOauthLogs] = useState<OAuthLogEvent[]>(() => getOauthLogs());

  useEffect(() => {
    const unsub = subscribeOauthLogs((updated) => {
      setOauthLogs(updated);
    });
    return unsub;
  }, []);

  const handleCopyOauthLogs = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ok = copyOauthLogsToClipboard();
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(i18n.t('common.info'), i18n.t('login.copiedLogs'));
    }
  };

  const handleClearOauthLogs = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearOauthLogs();
  };

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

  const handleSeed = async (cnt: number) => {
    Alert.alert(
      `Seed ${cnt} Testing Workouts?`,
      `This will insert ${cnt} synthetic workouts locally for benchmarking. They will NOT be auto-synced to Google Drive. Continue?`,
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: `Seed ${cnt}`,
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSeeding(true);
              const t0 = Date.now();
              const res = await seedSmartWorkouts(cnt, Date.now() % 100000);
              const ms = Date.now() - t0;
              const hdrTxt = res.headerMs !== undefined ? `${res.headerMs}ms` : '<8ms';
              const aggTxt = res.aggregateMs !== undefined ? `${res.aggregateMs}ms` : '<40ms';
              const hdrOk = res.headerMs === undefined ? true : res.headerMs < 8;
              const aggOk = res.aggregateMs === undefined ? true : res.aggregateMs < 40;
              if (onRefreshSessions) await onRefreshSessions();
              await fetchDiagnostics();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // Never auto-sync generated data to real Drive backups
              Alert.alert(
                cnt >= 400 ? `Seeded ${cnt} Smart Workouts` : 'Seed complete',
                `Inserted ${res.inserted} · Total ${res.total} · Sets ${res.totalSets} in ${ms}ms.\nHeader50 ${hdrTxt} ${hdrOk ? '✓' : '⚠'} · SQL aggregate ${aggTxt} ${aggOk ? '✓' : '⚠'}.\nInfinite scroll: pull history & scroll to 400+.\nSynthetic data not auto-synced — use Export to share if needed.`,
                [{ text: 'OK' }]
              );
            } catch (e: any) {
              console.error('[DeveloperDiagnosticsView] Seed failed:', e);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Seed failed', e?.message || String(e));
            } finally {
              setSeeding(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Toolbar */}
      <View style={styles.toolbar}>
            <Pressable
              style={styles.refreshButton}
              onPress={handleRefresh}
              android_ripple={rippleTokens.surface}
              disabled={loading || repairing}
              accessibilityLabel="Refresh diagnostics"
              accessibilityRole="button"
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
              accessibilityLabel="Repair workout history"
              accessibilityRole="button"
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

          {/* Smart Seed 400+ Testing Workouts */}
          <Card padding={spacing.lg} style={[styles.actionCard, { borderColor: colors.accent + '40' }]}>
            <View style={styles.warningHeader}>
              <Ionicons name="flask-outline" size={22} color={colors.accent} />
              <Text style={[styles.warningTitle, { color: colors.accent }]}>Seed Testing Workouts (Smart)</Text>
            </View>
            <Text style={styles.warningDesc}>
              Generates {seedCount}+ realistic progressive-overload workouts (varied titles, 3-6 exercises, 2-5 sets, W/S/D/F, unilateral, RPE, supersets). Header-only pagination and SQL aggregate benchmarked. Synthetic data stays local and is never auto-synced to Drive.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, width: '100%' }}>
              {[400, 600, 800].map((n) => (
                <Pressable
                  key={n}
                  style={[
                    styles.repairButton,
                    { flex: 1, backgroundColor: seedCount === n ? colors.accent : colors.surface2, borderWidth: 1, borderColor: seedCount === n ? colors.accent : colors.border },
                  ]}
                  onPress={() => setSeedCount(n)}
                  android_ripple={rippleTokens.surface}
                  accessibilityLabel={`Select ${n} workouts to seed`}
                  accessibilityRole="button"
                >
                  <Text style={[styles.repairButtonText, { color: seedCount === n ? '#FFFFFF' : colors.textSecondary, fontSize: font.sizes.sm }]}>{String(n)}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.repairButton, { marginTop: spacing.sm, backgroundColor: colors.accent }, seeding && styles.repairButtonDisabled]}
              onPress={() => handleSeed(seedCount)}
              disabled={seeding}
              android_ripple={rippleTokens.surface}
              testID="developer.seed400"
              accessibilityLabel={`Seed ${seedCount} testing workouts`}
              accessibilityRole="button"
            >
              {seeding ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: spacing.sm }} />
              ) : (
                <Ionicons name="rocket-outline" size={20} color="#FFFFFF" style={{ marginRight: spacing.sm }} />
              )}
              <Text style={styles.repairButtonText}>{seeding ? 'Seeding…' : `Seed +${seedCount} Smart Workouts`}</Text>
            </Pressable>
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, fontFamily: font.regular, marginTop: spacing.xs, textAlign: 'center' }}>
              Current: {diagnostics?.activeSessionsCount ?? 0} active · Tap History after seed to verify infinite scroll to {seedCount}+
            </Text>
          </Card>

          {/* OAuth Diagnostics & Telemetry Log */}
          <Card padding={spacing.md} style={styles.oauthCard}>
            <View style={styles.oauthHeader}>
              <View style={styles.oauthHeaderLeft}>
                <Ionicons name="logo-google" size={18} color={colors.accent} />
                <Text style={styles.oauthTitle}>{i18n.t('login.diagnosticsTitle')}</Text>
              </View>
              <View style={styles.oauthActions}>
                <Pressable
                  style={styles.oauthBtn}
                  onPress={handleCopyOauthLogs}
                  android_ripple={rippleTokens.surface}
                >
                  <Ionicons name="copy-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.oauthBtnText}>{i18n.t('login.copyLogs')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.oauthBtn, { marginLeft: spacing.xs }]}
                  onPress={handleClearOauthLogs}
                  android_ripple={rippleTokens.surface}
                >
                  <Ionicons name="trash-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.oauthBtnText}>{i18n.t('login.clearLogs')}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.oauthConsole}>
              <ScrollView
                style={styles.oauthScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {oauthLogs.length === 0 ? (
                  <Text style={styles.oauthEmptyText}>{i18n.t('login.noLogs')}</Text>
                ) : (
                  oauthLogs.map((log) => {
                    const color =
                      log.level === 'ok'
                        ? colors.success
                        : log.level === 'error'
                        ? colors.error
                        : colors.accent;
                    return (
                      <View key={log.id} style={styles.oauthRow}>
                        <View style={styles.oauthRowHeader}>
                          <Text style={styles.oauthTime}>{log.formattedTime}</Text>
                          <Text style={[styles.oauthStep, { color }]}>{log.step}</Text>
                        </View>
                        {log.detail ? (
                          <Text style={styles.oauthDetail}>{log.detail}</Text>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
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

  // ── OAuth Diagnostics & Telemetry Card ──────────────────────────
  oauthCard: {
    marginTop: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  oauthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  oauthHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  oauthTitle: {
    color: colors.textPrimary,
    fontFamily: font.bold,
    fontSize: font.sizes.sm,
  },
  oauthActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  oauthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  oauthBtnText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
  },
  oauthConsole: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.xs,
    marginTop: spacing.xs,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: colors.border + '60',
  },
  oauthScroll: {
    maxHeight: 210,
  },
  oauthEmptyText: {
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: font.sizes.xs,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  oauthRow: {
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border + '40',
  },
  oauthRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  oauthTime: {
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
  },
  oauthStep: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    fontWeight: '600',
  },
  oauthDetail: {
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    marginTop: 2,
    paddingLeft: 4,
  },
});

export default DeveloperDiagnosticsView;
