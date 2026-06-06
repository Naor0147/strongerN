// screens/MeasureScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
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
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow, globalAnimation, getScaledDuration } from '../theme';
import { MeasureItem } from '../data/mockData';

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
      accessibilityLabel={`${item.label}, last recorded value is ${item.lastValue ?? 'none'}`}
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
  const swipeX = React.useRef(new Animated.Value(0)).current;

  const animateTranslation = (toVal: number, callback?: () => void) => {
    if (globalAnimation.speed === 0) {
      Animated.timing(swipeX, {
        toValue: toVal,
        duration: 0,
        useNativeDriver: true,
      }).start(callback);
    } else {
      Animated.spring(swipeX, {
        toValue: toVal,
        useNativeDriver: true,
        stiffness: 140 / (globalAnimation.speed * globalAnimation.speed),
        damping: 16 / globalAnimation.speed,
        mass: 0.9,
      }).start(callback);
    }
  };
  
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          const limitedX = Math.max(gestureState.dx, -120);
          swipeX.setValue(limitedX);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -60) {
          animateTranslation(-80);
        } else {
          animateTranslation(0);
        }
      },
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      <Pressable 
        style={styles.deleteBackground} 
        onPress={() => {
          onDelete();
          Animated.timing(swipeX, {
            toValue: 0,
            duration: getScaledDuration(100),
            useNativeDriver: true,
          }).start();
        }}
        testID={`measure.delete-log-${entry.date}`}
      >
        <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
      </Pressable>

      <Animated.View
        style={[styles.swipeForeground, { transform: [{ translateX: swipeX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.historyRow}>
          <Text style={styles.historyDate}>{formatDateString(entry.date)}</Text>
          <Text style={styles.historyValue}>{entry.value}{unit}</Text>
        </View>
      </Animated.View>
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
    { _type: 'header', id: 'header-primary', label: 'Primary Metrics' },
    ...primaryMetrics,
    { _type: 'header', id: 'header-body-part', label: 'Body Parts' },
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
        Alert.alert('Error', 'Please enter a value.');
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
      Alert.alert('Success', `Recorded value for ${selectedMetric.label}!`);
    }
  };

  const handleAddSubmit = () => {
    if (!newMetricLabel.trim()) {
      Alert.alert('Error', 'Please enter a metric label.');
      return;
    }
    if (onAddMetric) {
      onAddMetric(newMetricLabel.trim(), isNewPrimary);
      setNewMetricLabel('');
      setIsAddModalVisible(false);
      Alert.alert('Success', `Custom metric "${newMetricLabel.trim()}" added successfully!`);
    }
  };

  const headerActions = useMemo(() => [
    { icon: 'add-outline' as const, label: 'Add Metric', onPress: () => setIsAddModalVisible(true) },
    {
      icon: 'settings-outline' as const,
      label: 'Settings',
      onPress: () => {
        Alert.alert('Measurement Settings', 'Measurements allow you to track your body fat, weight, and key muscle circumferences in AMOLED high-fidelity details.');
      }
    },
  ], []);

  const totalCount = useMemo(() => {
    return primaryMetrics.length + bodyPartMetrics.length;
  }, [primaryMetrics.length, bodyPartMetrics.length]);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Measure"
        subtitle={`${totalCount} metrics tracked`}
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
                    <Text style={styles.sectionTitle}>TREND HISTORY</Text>
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

                        return history.slice(-5).map((entry, idx) => {
                          const pct = getPercentage(entry.value);
                          return (
                            <View key={idx} style={styles.chartRow}>
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
                  <Text style={styles.sectionTitle}>LOG NEW ENTRY</Text>
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
                      <Text style={styles.logSaveBtnText}>SAVE</Text>
                    </Pressable>
                  </View>
                </View>

                {/* ── History Logs List Section ── */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>LOG HISTORY</Text>
                  {(!selectedMetric.history || selectedMetric.history.length === 0) ? (
                    <Text style={styles.emptyLogsText}>No history logs recorded.</Text>
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
                              }
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
              <Text style={styles.modalTitle}>ADD MEASURE POINT</Text>
              <IconButton
                name="close"
                size={22}
                color={colors.textSecondary}
                onPress={() => setIsAddModalVisible(false)}
              />
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.inputLabel}>METRIC LABEL</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Forearms / Chest / Neck"
                placeholderTextColor={colors.textMuted}
                value={newMetricLabel}
                onChangeText={setNewMetricLabel}
                keyboardAppearance="dark"
                maxLength={30}
              />

              <Text style={styles.inputLabel}>METRIC CATEGORY</Text>
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
                    PRIMARY
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
                    BODY PART
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.submitBtn}
                onPress={handleAddSubmit}
                android_ripple={rippleTokens.accent}
              >
                <Text style={styles.submitBtnText}>ADD POINT</Text>
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
