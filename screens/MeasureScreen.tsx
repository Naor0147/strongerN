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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow } from '../theme';
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

const MeasureScreen: React.FC<MeasureScreenProps> = ({
  primaryMetrics,
  bodyPartMetrics,
  onRecordMetric,
  onAddMetric,
}) => {
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
    setNewLogValue(item.lastValue ?? '');
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
      setIsLogModalVisible(false);
      setSelectedMetric(null);
      Alert.alert('Success', `Recorded ${newLogValue.trim()} for ${selectedMetric.label}!`);
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
    <SafeAreaView style={styles.safe} edges={['top']}>
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

      {/* Modal 1: Log Metric Value */}
      {selectedMetric && (
        <Modal
          visible={isLogModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setIsLogModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>LOG {selectedMetric.label.toUpperCase()}</Text>
                <IconButton
                  name="close"
                  size={22}
                  color={colors.textSecondary}
                  onPress={() => setIsLogModalVisible(false)}
                />
              </View>

              <View style={styles.modalForm}>
                <Text style={styles.inputLabel}>NEW VALUE</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={selectedMetric.label.toLowerCase().includes('fat') ? 'e.g. 14.5%' : selectedMetric.label.toLowerCase().includes('caloric') ? 'e.g. 2,900 kcal' : 'e.g. 83.2 kg / 40.5 cm'}
                  placeholderTextColor={colors.textMuted}
                  value={newLogValue}
                  onChangeText={setNewLogValue}
                  keyboardAppearance="dark"
                  autoFocus
                  maxLength={25}
                />

                <Pressable
                  style={styles.submitBtn}
                  onPress={handleSaveLog}
                  android_ripple={rippleTokens.accent}
                >
                  <Text style={styles.submitBtnText}>SAVE VALUE</Text>
                </Pressable>
              </View>
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
    </SafeAreaView>
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
});

export default MeasureScreen;
