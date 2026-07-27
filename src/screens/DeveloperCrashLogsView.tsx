import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, font, spacing, radius, ripple as rippleTokens } from '../theme';
import i18n from '../utils/i18n';
import Card from '../components/ui/Card';
import { CrashLog, getCrashLogs, clearCrashLogs, exportCrashLogsToFile, deleteCrashLog, copyCrashLogToClipboard } from '../utils/crashLogger';
import { styles } from './profileStyles';

export interface DeveloperCrashLogsViewProps {
  onBack: () => void;
}

export const DeveloperCrashLogsView: React.FC<DeveloperCrashLogsViewProps> = ({ onBack }) => {
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
