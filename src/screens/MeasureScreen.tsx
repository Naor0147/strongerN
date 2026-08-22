// screens/MeasureScreen.tsx
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, cancelAnimation, Easing } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as RN from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow, globalAnimation, getScaledDuration, getSpringConfig } from '../theme';
import { MeasureItem } from '../data/mockData';
import i18n from '../utils/i18n';
import { showToast } from '../utils/toast';

import ScreenHeader from '../components/layout/ScreenHeader';
import SectionLabel from '../components/ui/SectionLabel';
import PressableRow from '../components/ui/PressableRow';
import IconButton   from '../components/ui/IconButton';

interface MeasureScreenProps {
  primaryMetrics:  MeasureItem[];
  bodyPartMetrics: MeasureItem[];
  onRecordMetric?: (id: string, newValue: string) => void;
  onAddMetric?:    (label: string, isPrimary: boolean) => void;
  onDeleteMetricLog?: (id: string, date: string) => void;
}

type ListItem = MeasureItem | { _type: 'header'; id: string; label: string };

const MetricRow: React.FC<{ item: MeasureItem; onPress: (item: MeasureItem) => void }> = React.memo(({ item, onPress }) => {
  return (
    <PressableRow
      onPress={() => onPress(item)}
      style={styles.rowContainer}
      padding={{ vertical: spacing.md, horizontal: spacing.lg }}
      testID={`measure.metric.${item.id}`}
      accessibilityLabel={`${item.label}, ${i18n.t('extras.lastRecordedValue')}: ${item.lastValue ?? i18n.t('extras.none')}`}
    >
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{item.label}</Text>
        <View style={styles.rowRight}>
          {item.lastValue ? (
            <Text style={styles.lastValueText}>{item.lastValue}</Text>
          ) : (
            <Text style={styles.noValueText}>--</Text>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </View>
    </PressableRow>
  );
});

const SubsectionHeader: React.FC<{ label: string }> = React.memo(({ label }) => (
  <View style={styles.subsectionHeaderContainer}>
    <SectionLabel
      title={label.toUpperCase()}
      testID={`measure.section.${label.toLowerCase().replace(/\s+/g, '-')}`}
    />
  </View>
));

const getUnit = (label: string): string => {
  const l = label.toLowerCase();
  if (l.includes('fat')) return '%';
  if (l.includes('caloric') || l.includes('intake')) return ' kcal';
  if (l.includes('weight')) return ' kg';
  return ' cm';
};

const formatDateString = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[d.getMonth()]} ${d.getDate()}`;
};

const SwipeableHistoryItem: React.FC<{
  entry: { date: string; value: number };
  unit: string;
  onDelete: () => void;
}> = ({ entry, unit, onDelete }) => {
  const swipeX = useSharedValue(0);

  useEffect(() => {
    return () => {
      cancelAnimation(swipeX);
    };
  }, []);

  const animateTranslation = (toVal: number, callback?: () => void) => {
    'worklet';
    if (globalAnimation.speed === 0) {
      swipeX.value = toVal;
      if (callback) callback();
    } else {
      swipeX.value = withSpring(
        toVal,
        {
          stiffness: 140 / (globalAnimation.speed * globalAnimation.speed),
          damping: 16 / globalAnimation.speed,
          mass: 0.9,
        },
        () => {
          if (callback) callback();
        }
      );
    }
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        swipeX.value = Math.max(e.translationX, -120);
      }
    })
    .onEnd((e) => {
      if (e.translationX < -60) {
        animateTranslation(-80);
      } else {
        animateTranslation(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));

  return (
    <View style={styles.swipeContainer}>
      <Pressable
        style={styles.deleteBackground}
        onPress={() => {
          cancelAnimation(swipeX);
          onDelete();
        }}
        testID={`measure.delete-log-${entry.date}`}
      >
        <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
      </Pressable>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[styles.swipeForeground, animatedStyle]}
        >
          <View style={styles.historyRow}>
            <Text style={styles.historyDate}>{formatDateString(entry.date)}</Text>
            <Text style={styles.historyValue}>{entry.value}{unit}</Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const MeasureScreen: React.FC<MeasureScreenProps> = ({
  primaryMetrics,
  bodyPartMetrics,
  onRecordMetric,
  onAddMetric,
  onDeleteMetricLog,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedMetric, setSelectedMetric] = useState<MeasureItem | null>(null);
  const [isLogModalVisible, setIsLogModalVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

  // Input form states
  const [newLogValue, setNewLogValue] = useState('');
  const [newMetricLabel, setNewMetricLabel] = useState('');
  const [isNewPrimary, setIsNewPrimary] = useState(false);

  const allData: ListItem[] = useMemo(() => [
    { _type: 'header', id: 'header-primary', label: i18n.t('measure.primaryMetrics') },
    ...primaryMetrics,
    { _type: 'header', id: 'header-body-part', label: i18n.t('measure.bodyParts') },
    ...bodyPartMetrics,
  ], [primaryMetrics, bodyPartMetrics]);

  const handleRowPress = useCallback((item: MeasureItem) => {
    setSelectedMetric(item);
    const num = item.lastValue ? item.lastValue.replace(/[^\d.]/g, '') : '';
    setNewLogValue(num);
    setIsLogModalVisible(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if ('_type' in item && item._type === 'header') {
        return <SubsectionHeader label={item.label} />;
      }
      return <MetricRow item={item as MeasureItem} onPress={handleRowPress} />;
    },
    [handleRowPress]
  );

  const keyExtractor = useCallback(
    (item: ListItem) => ('_type' in item ? item.id : (item as MeasureItem).id),
    []
  );

  const handleSaveLog = () => {
    if (selectedMetric && onRecordMetric) {
      if (!newLogValue.trim()) {
        Alert.alert(i18n.t('common.error'), i18n.t('measure.enterValue'));
        return;
      }
      onRecordMetric(selectedMetric.id, newLogValue.trim());
      const num = parseFloat(newLogValue.trim().replace(/[^\d.]/g, ''));
      if (!isNaN(num)) {
        setSelectedMetric(prev => {
          if (!prev) return null;
          const history = prev.history ? [...prev.history] : [];
          const todayStr = new Date().toISOString().split('T')[0];
          const existingIndex = history.findIndex(h => h.date === todayStr);
          if (existingIndex > -1) {
            history[existingIndex] = { date: todayStr, value: num };
          } else {
            history.push({ date: todayStr, value: num });
          }
          history.sort((a, b) => a.date.localeCompare(b.date));
          const cleaned = prev.lastValue || '';
          const unitStr = cleaned.includes('%') ? '%' : cleaned.includes('kcal') ? ' kcal' : cleaned.includes('cm') ? ' cm' : ' kg';
          return {
            ...prev,
            lastValue: `${num}${unitStr}`,
            history,
          };
        });
      }
      setNewLogValue('');
      showToast(i18n.t('measure.recordedValue', { label: selectedMetric.label }), 'success');
    }
  };

  const handleAddSubmit = () => {
    if (!newMetricLabel.trim()) {
      Alert.alert(i18n.t('common.error'), i18n.t('measure.enterMetricLabel'));
      return;
    }
    if (onAddMetric) {
      onAddMetric(newMetricLabel.trim(), isNewPrimary);
      setNewMetricLabel('');
      setIsAddModalVisible(false);
      showToast(i18n.t('measure.customMetricAdded', { name: newMetricLabel.trim() }), 'success');
    }
  };

  const headerActions = useMemo(() => [
    { icon: 'add-outline' as const, label: i18n.t('measure.addMetric'), onPress: () => setIsAddModalVisible(true) },
    {
      icon: 'settings-outline' as const,
      label: i18n.t('measure.settings'),
      onPress: () => {
        Alert.alert(i18n.t('measure.measurementSettings'), i18n.t('measure.measurementSettingsMsg'));
      }
    },
  ], []);

  const fadeAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(0.96);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: scaleAnim.value }],
    flex: 1,
  }));

  useEffect(() => {
    fadeAnim.value = 0;
    scaleAnim.value = 0.96;
    const easingFn = Easing && typeof Easing.out === 'function' ? Easing.out(Easing.cubic) : undefined;
    fadeAnim.value = withTiming(1, { duration: 250, easing: easingFn });
    scaleAnim.value = withSpring(1, getSpringConfig(140, 16));
  }, []);

  const totalCount = primaryMetrics.length + bodyPartMetrics.length;

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <Animated.View style={animatedContainerStyle}>
        <ScreenHeader
          title={i18n.t('measure.title')}
          subtitle={i18n.t('extras.metricsTracked', { count: totalCount })}
          actions={headerActions}
        />
      <FlatList
        data={allData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        overScrollMode="never"
        removeClippedSubviews
        testID="measure.list"
      />
      </Animated.View>

      {/* Modal 1: Log Metric Value (Redesigned as Metric Details Modal) */}
      {selectedMetric && (
        <Modal
          visible={isLogModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setIsLogModalVisible(false);
            setSelectedMetric(null);
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.detailsCard]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedMetric.label.toUpperCase()}</Text>
                <IconButton
                  name="close"
                  size={22}
                  color={colors.textSecondary}
                  onPress={() => {
                    setIsLogModalVisible(false);
                    setSelectedMetric(null);
                  }}
                />
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.detailsScrollContent}
              >
                {/* ── Trend Graph Section ── */}
                {selectedMetric.history && selectedMetric.history.length > 0 ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>{i18n.t('extras.trendHistory')}</Text>
                    <View style={styles.chartContainer}>
                      {(() => {
                        const history = selectedMetric.history || [];
                        const values = history.map(h => h.value);
                        const maxVal = Math.max(...values, 1);
                        const minVal = Math.min(...values, 0);
                        const range = maxVal - minVal;
                        const getPercentage = (val: number) => {
                          if (range === 0) return 100;
                          return 20 + ((val - minVal) / range) * 80;
                        };
                        const unit = getUnit(selectedMetric.label);

                        return history.slice(-5).map((entry) => {
                          const pct = getPercentage(entry.value);
                          return (
                            <View key={entry.date} style={styles.chartRow}>
                              <Text style={styles.chartDate}>{formatDateString(entry.date)}</Text>
                              <View style={styles.chartBarTrack}>
                                <View
                                  style={[
                                    styles.chartBarFill,
                                    {
                                      width: `${pct}%`,
                                      backgroundColor: colors.accent,
                                    }
                                  ]}
                                />
                              </View>
                              <Text style={styles.chartValue}>{entry.value}{unit}</Text>
                            </View>
                          );
                        });
                      })()}
                    </View>
                  </View>
                ) : null}

                {/* ── Log New Entry Section ── */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>{i18n.t('extras.logNewEntry')}</Text>
                  <View style={styles.logInputContainer}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      placeholder={
                        selectedMetric.label.toLowerCase().includes('fat')
                          ? '14.5'
                          : selectedMetric.label.toLowerCase().includes('caloric')
                            ? '2800'
                            : '82.4'
                      }
                      placeholderTextColor={colors.textMuted}
                      value={newLogValue}
                      onChangeText={setNewLogValue}
                      keyboardType="numeric"
                      keyboardAppearance="dark"
                    />
                    <Pressable
                      style={styles.logSaveBtn}
                      onPress={handleSaveLog}
                      android_ripple={rippleTokens.accent}
                    >
                      <Text style={styles.logSaveBtnText}>{i18n.t('extras.saveBtn')}</Text>
                    </Pressable>
                  </View>
                </View>

                {/* ── History Logs List Section ── */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>{i18n.t('extras.logHistory')}</Text>
                  {(!selectedMetric.history || selectedMetric.history.length === 0) ? (
                    <Text style={styles.emptyLogsText}>{i18n.t('extras.noHistoryLogs')}</Text>
                  ) : (
                    <View style={styles.logsListContainer}>
                      {selectedMetric.history.slice().reverse().map((entry, idx) => {
                        const unit = getUnit(selectedMetric.label);
                        return (
                          <SwipeableHistoryItem
                            key={`${entry.date}-${idx}`}
                            entry={entry}
                            unit={unit}
                            onDelete={() => {
                              Alert.alert(
                                i18n.t('common.delete'),
                                i18n.t('extras.confirmDeleteEntry'),
                                [
                                  { text: i18n.t('common.cancel'), style: 'cancel' },
                                  {
                                    text: i18n.t('common.delete'),
                                    style: 'destructive',
                                    onPress: () => {
                                      if (onDeleteMetricLog) {
                                        onDeleteMetricLog(selectedMetric.id, entry.date);
                                        setSelectedMetric(prev => {
                                          if (!prev) return null;
                                          const updatedHistory = (prev.history || []).filter(h => h.date !== entry.date);
                                          let updatedLastValue = undefined;
                                          if (updatedHistory.length > 0) {
                                            const latest = updatedHistory[updatedHistory.length - 1];
                                            const cleaned = prev.lastValue || '';
                                            const unitStr = cleaned.includes('%') ? '%' : cleaned.includes('kcal') ? ' kcal' : cleaned.includes('cm') ? ' cm' : ' kg';
                                            updatedLastValue = `${latest.value}${unitStr}`;
                                          }
                                          return {
                                            ...prev,
                                            lastValue: updatedLastValue,
                                            history: updatedHistory,
                                          };
                                        });
                                        showToast(i18n.t('extras.entryDeleted'), 'info');
                                      }
                                    }
                                  }
                                ]
                              );
                            }}
                          />
                        );
                      })}
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal 2: Add Custom Metric */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{i18n.t('extras.addMeasurePoint')}</Text>
              <IconButton
                name="close"
                size={22}
                color={colors.textSecondary}
                onPress={() => setIsAddModalVisible(false)}
              />
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.inputLabel}>{i18n.t('extras.metricLabel')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={i18n.t('extras.metricLabelPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={newMetricLabel}
                onChangeText={setNewMetricLabel}
                keyboardAppearance="dark"
                maxLength={30}
              />

              <Text style={styles.inputLabel}>{i18n.t('extras.metricCategory')}</Text>
              <View style={styles.categoryRow}>
                <Pressable
                  onPress={() => setIsNewPrimary(true)}
                  style={[
                    styles.categoryBtn,
                    isNewPrimary && styles.categoryBtnActive
                  ]}
                  android_ripple={rippleTokens.surface}
                >
                  <Ionicons name="bar-chart-outline" size={16} color={isNewPrimary ? colors.textInverse : colors.textSecondary} />
                  <Text style={[
                    styles.categoryBtnText,
                    isNewPrimary && styles.categoryBtnTextActive
                  ]}>
                    {i18n.t('extras.primaryCategory')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setIsNewPrimary(false)}
                  style={[
                    styles.categoryBtn,
                    !isNewPrimary && styles.categoryBtnActive
                  ]}
                  android_ripple={rippleTokens.surface}
                >
                  <Ionicons name="resize-outline" size={16} color={!isNewPrimary ? colors.textInverse : colors.textSecondary} />
                  <Text style={[
                    styles.categoryBtnText,
                    !isNewPrimary && styles.categoryBtnTextActive
                  ]}>
                    {i18n.t('extras.bodyPartCategory')}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.submitBtn}
                onPress={handleAddSubmit}
                android_ripple={rippleTokens.accent}
              >
                <Text style={styles.submitBtnText}>{i18n.t('extras.addPointBtn')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  list: {
    paddingBottom: spacing.xxxl + spacing.lg,
  },
  rowContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.bg,
  },
  rowContent: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    height:         36,
  },
  rowLabel: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.md,
    fontFamily: font.medium,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     spacing.sm,
  },
  lastValueText: {
    color:      colors.accent,
    fontSize:   font.sizes.md,
    fontFamily: font.semibold,
  },
  noValueText: {
    color:      colors.textMuted,
    fontSize:   font.sizes.md,
    fontFamily: font.regular,
  },
  subsectionHeaderContainer: {
    backgroundColor:   colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.xs,
  },

  // Modals
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

  // Category buttons
  categoryRow: {
    flexDirection: 'row',
    columnGap: spacing.sm,
    marginVertical: spacing.xs,
  },
  categoryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 12,
  },
  categoryBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryBtnText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  categoryBtnTextActive: {
    color: colors.textInverse,
  },

  // Details Modal
  detailsCard: {
    maxWidth: 400,
    height: '80%',
  },
  detailsScrollContent: {
    rowGap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  detailSection: {
    rowGap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: font.bold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  chartContainer: {
    rowGap: spacing.sm,
    backgroundColor: colors.surface2,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderColor: colors.border,
    borderWidth: 1,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
  },
  chartDate: {
    width: 50,
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
  },
  chartBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  chartBarFill: {
    height: '100%',
    borderRadius: radius.xs,
  },
  chartValue: {
    width: 65,
    textAlign: 'right',
    color: colors.textPrimary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
  logInputContainer: {
    flexDirection: 'row',
    columnGap: spacing.sm,
    alignItems: 'center',
  },
  logSaveBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
  },
  logSaveBtnText: {
    color: colors.textInverse,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
  },
  emptyLogsText: {
    color: colors.textMuted,
    fontSize: font.sizes.sm,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },
  logsListContainer: {
    rowGap: spacing.xs,
  },

  // Swipeable Items
  swipeContainer: {
    height: 48,
    backgroundColor: colors.error,
    borderRadius: radius.xs,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeForeground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  historyRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDate: {
    color: colors.textPrimary,
    fontFamily: font.medium,
    fontSize: font.sizes.sm,
  },
  historyValue: {
    color: colors.accent,
    fontFamily: font.bold,
    fontSize: font.sizes.md,
  },
});

export default MeasureScreen;
