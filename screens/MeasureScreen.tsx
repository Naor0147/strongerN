// screens/MeasureScreen.tsx
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, spacing } from '../theme';
import { MeasureItem } from '../data/mockData';

import ScreenHeader from '../components/layout/ScreenHeader';
import SectionLabel from '../components/ui/SectionLabel';
import PressableRow from '../components/ui/PressableRow';

interface MeasureScreenProps {
  primaryMetrics:  MeasureItem[];
  bodyPartMetrics: MeasureItem[];
}

type ListItem = MeasureItem | { _type: 'header'; id: string; label: string };

const MetricRow: React.FC<{ item: MeasureItem }> = React.memo(({ item }) => {
  return (
    <PressableRow
      onPress={() => {}}
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
}) => {
  const allData: ListItem[] = useMemo(() => [
    { _type: 'header', id: 'header-primary', label: 'Primary Metrics' },
    ...primaryMetrics,
    { _type: 'header', id: 'header-body-part', label: 'Body Parts' },
    ...bodyPartMetrics,
  ], [primaryMetrics, bodyPartMetrics]);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if ('_type' in item && item._type === 'header') {
        return <SubsectionHeader label={item.label} />;
      }
      return <MetricRow item={item as MeasureItem} />;
    },
    []
  );

  const keyExtractor = useCallback(
    (item: ListItem) => ('_type' in item ? item.id : (item as MeasureItem).id),
    []
  );

  const headerActions = useMemo(() => [
    { icon: 'add-outline' as const, label: 'Add Metric', onPress: () => {} },
    { icon: 'settings-outline' as const, label: 'Settings', onPress: () => {} },
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  list: {
    paddingBottom: spacing.xxxl + spacing.lg, // Account for Floating BottomTabBar and spacing
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
    height:         36, // Combined with padding vertical of spacing.md
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
});

export default MeasureScreen;
