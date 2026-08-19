/**
 * MuscleSetsBars.tsx
 *
 * AMOLED-first Muscle Group Set Distribution component.
 * Displays horizontal volume progress bars for each muscle group based on completed sets.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, I18nManager } from 'react-native';
import { colors, font, spacing, radius } from '../../theme';
import i18n from '../../utils/i18n';

export interface MuscleSetsBarsProps {
  muscleSets: Record<string, number>;
  maxDisplay?: number;
  testID?: string;
}

const ORDERED_MUSCLES = [
  'Chest',
  'Back',
  'Quads',
  'Hamstrings',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Glutes',
  'Rear Delts',
  'Calves',
  'Forearms',
  'Abs',
];

export const MuscleSetsBars: React.FC<MuscleSetsBarsProps> = ({
  muscleSets = {},
  maxDisplay = 12,
  testID,
}) => {
  const sortedMuscles = useMemo(() => {
    const entries = ORDERED_MUSCLES.map((muscle) => ({
      name: muscle,
      sets: muscleSets[muscle] || 0,
    })).filter((item) => item.sets > 0);

    // Also include any 'Other' or extra keys with > 0 sets
    Object.keys(muscleSets).forEach((key) => {
      if (!ORDERED_MUSCLES.includes(key) && (muscleSets[key] || 0) > 0) {
        entries.push({ name: key, sets: muscleSets[key] });
      }
    });

    entries.sort((a, b) => b.sets - a.sets);
    return entries.slice(0, maxDisplay);
  }, [muscleSets, maxDisplay]);

  const maxSets = useMemo(() => {
    let max = 1;
    sortedMuscles.forEach((item) => {
      if (item.sets > max) max = item.sets;
    });
    return max;
  }, [sortedMuscles]);

  if (sortedMuscles.length === 0) {
    return (
      <View style={styles.emptyContainer} testID={testID}>
        <Text style={styles.emptyText}>{i18n.t('profile.noMuscleData') || 'No completed sets recorded yet'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {sortedMuscles.map((item) => {
        const percentage = Math.min(100, Math.max(8, Math.round((item.sets / maxSets) * 100)));
        const muscleLabel = i18n.t(`exercises.muscles.${item.name.toLowerCase()}`, { defaultValue: item.name });

        return (
          <View key={item.name} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.muscleName}>{muscleLabel}</Text>
              <Text style={styles.setsCount}>
                {item.sets} {i18n.t('common.sets', { count: item.sets }) || 'sets'}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${percentage}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.sm,
  },
  row: {
    width: '100%',
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  muscleName: {
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
  },
  setsCount: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.semibold,
  },
  track: {
    height: 8,
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    overflow: 'hidden',
    width: '100%',
  },
  bar: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  emptyContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: font.sizes.sm,
    fontFamily: font.regular,
  },
});
