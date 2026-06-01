// screens/WorkoutScreen.tsx
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow } from '../theme';
import { Template } from '../data/mockData';

import ScreenHeader  from '../components/layout/ScreenHeader';
import Card          from '../components/ui/Card';
import IconButton    from '../components/ui/IconButton';
import SectionLabel  from '../components/ui/SectionLabel';
import PressableRow  from '../components/ui/PressableRow';

interface WorkoutScreenProps {
  templates:       Template[];
  onStartWorkout?: (name: string, exercises: string[]) => void;
}

function timeAgo(date: Date): string {
  const diffMs   = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays}d ago`;
  const weeks = Math.floor(diffDays / 7);
  return `${weeks}w ago`;
}

// ─── Template Card ────────────────────────────────────────────────
interface TemplateCardProps {
  template: Template;
  onStart?: (name: string, exercises: string[]) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = React.memo(({ template, onStart }) => (
  <Card style={styles.tplCard} padding={0} testID={`workout.template.${template.id}`}>
    <PressableRow
      onPress={() => onStart && onStart(template.name, template.exercises)}
      padding={{ vertical: spacing.md, horizontal: spacing.md }}
      ripple={rippleTokens.surface}
      accessibilityLabel={`Start ${template.name}`}
    >
      {/* Accent left bar via card variant is handled externally; use inner layout */}
      <View style={styles.tplAccentBar} />

      <View style={styles.tplInner}>
        <View style={styles.tplHeader}>
          <Text style={styles.tplName} numberOfLines={2}>{template.name}</Text>
          <View style={styles.tplMenuIcon}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
          </View>
        </View>

        <Text style={styles.tplExCount}>
          {template.exercises.length} exercises
        </Text>
        <Text style={styles.tplExList} numberOfLines={3}>
          {template.exercises.join(' · ')}
        </Text>

        <View style={styles.tplFooter}>
          <Ionicons name="time-outline" size={11} color={colors.textMuted} />
          <Text style={styles.tplLastUsed}>{timeAgo(template.lastUsed)}</Text>
        </View>
      </View>
    </PressableRow>
  </Card>
));

// ─── Quick Start Card (last used) ────────────────────────────────
interface QuickStartProps {
  template: Template;
  onStart?: (name: string, exercises: string[]) => void;
}

const QuickStartCard: React.FC<QuickStartProps> = React.memo(({ template, onStart }) => (
  <Card padding={0} variant="active" style={styles.quickCard} testID="workout.quick-start">
    <PressableRow
      onPress={() => onStart && onStart(template.name, template.exercises)}
      padding={{ vertical: spacing.md, horizontal: spacing.lg }}
      ripple={rippleTokens.accent}
      accessibilityLabel={`Quick start ${template.name}`}
    >
      <View style={styles.quickInner}>
        <View style={styles.quickLeft}>
          <View style={styles.quickIconWrap}>
            <Ionicons name="flash" size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.quickLabel}>Quick Start</Text>
            <Text style={styles.quickName}>{template.name}</Text>
          </View>
        </View>
        <Ionicons name="arrow-forward-circle" size={28} color={colors.accent} />
      </View>
    </PressableRow>
  </Card>
));

// ─── List Header ──────────────────────────────────────────────────
interface ListHeaderProps {
  count:    number;
  lastUsed: Template;
  onStart?: (name: string, exercises: string[]) => void;
}

const ListHeader: React.FC<ListHeaderProps> = React.memo(({ count, lastUsed, onStart }) => (
  <View>
    {/* CTA — Start Empty */}
    <Pressable
      onPress={() => onStart && onStart('Empty Workout', [])}
      android_ripple={{ color: '#FFFFFF25', borderless: false }}
      style={styles.ctaWrap}
      accessibilityLabel="Start an empty workout"
      accessibilityRole="button"
      testID="workout.start-empty"
    >
      <LinearGradient
        colors={[colors.accent, colors.accentDim]}
        style={styles.ctaGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Ionicons name="add-circle" size={22} color="#fff" />
        <Text style={styles.ctaText}>START AN EMPTY WORKOUT</Text>
      </LinearGradient>
    </Pressable>

    {/* Quick Start */}
    <QuickStartCard template={lastUsed} onStart={onStart} />

    {/* Templates section header */}
    <SectionLabel
      title="My Templates"
      subtitle={`${count} routines`}
      rightIcon="add-circle-outline"
      rightIconColor={colors.accent}
      style={styles.sectionLabel}
      testID="workout.templates-section"
    />
  </View>
));

// ─── Screen ────────────────────────────────────────────────────────
const WorkoutScreen: React.FC<WorkoutScreenProps> = ({ templates, onStartWorkout }) => {
  const pairs = useMemo(() => {
    const result: [Template, Template | null][] = [];
    for (let i = 0; i < templates.length; i += 2) {
      result.push([templates[i], templates[i + 1] ?? null]);
    }
    return result;
  }, [templates]);

  const lastUsed = useMemo(
    () => [...templates].sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())[0],
    [templates]
  );

  const renderPair = useCallback(
    ({ item }: { item: [Template, Template | null] }) => (
      <View style={styles.templateRow}>
        <View style={styles.templateCol}>
          <TemplateCard template={item[0]} onStart={onStartWorkout} />
        </View>
        <View style={styles.templateColGap} />
        <View style={styles.templateCol}>
          {item[1] ? <TemplateCard template={item[1]} onStart={onStartWorkout} /> : null}
        </View>
      </View>
    ),
    [onStartWorkout]
  );

  const keyExtractor = useCallback(
    (item: [Template, Template | null]) => item[0].id,
    []
  );

  const listHeader = useMemo(
    () => <ListHeader count={templates.length} lastUsed={lastUsed} onStart={onStartWorkout} />,
    [templates.length, lastUsed, onStartWorkout]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Workout"
        actions={[{ icon: 'search-outline', label: 'Search templates', testID: 'workout.search' }]}
        testID="workout.header"
      />
      <FlatList
        data={pairs}
        keyExtractor={keyExtractor}
        renderItem={renderPair}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={listHeader}
        removeClippedSubviews
        maxToRenderPerBatch={4}
        overScrollMode="never"
        ItemSeparatorComponent={() => <View style={styles.rowSep} />}
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
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.xxxl,
  },

  // CTA
  ctaWrap: {
    borderRadius: radius.md,
    overflow:     'hidden',
    marginBottom: spacing.md,
    ...(shadow.accentGlow as object),
  },
  ctaGradient: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: spacing.lg + 2,
    columnGap:       spacing.sm,
    borderRadius:    radius.md,
  },
  ctaText: {
    color:         '#fff',
    fontSize:      font.sizes.md,
    fontFamily:    font.bold,
    letterSpacing: 0.8,
  },

  // Quick Start
  quickCard: {
    marginBottom: spacing.lg,
  },
  quickInner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  quickLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     spacing.md,
    flex:          1,
  },
  quickIconWrap: {
    width:           38,
    height:          38,
    borderRadius:    radius.sm,
    backgroundColor: colors.accentGlow,
    alignItems:      'center',
    justifyContent:  'center',
  },
  quickLabel: {
    color:      colors.accent,
    fontSize:   font.sizes.xs,
    fontFamily: font.semibold,
    letterSpacing: 0.5,
  },
  quickName: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.md,
    fontFamily: font.bold,
  },

  // Section
  sectionLabel: { marginBottom: spacing.sm },

  // Template grid
  templateRow: {
    flexDirection: 'row',
  },
  templateCol: {
    flex: 1,
  },
  templateColGap: {
    width: spacing.sm,
  },
  rowSep: { height: spacing.sm },

  // Template card
  tplCard: {
    flex:     1,
    overflow: 'hidden',
  },
  tplAccentBar: {
    position:        'absolute',
    top:             0,
    bottom:          0,
    left:            0,
    width:           3,
    backgroundColor: colors.highlight,
  },
  tplInner: {
    paddingLeft: spacing.xs + 2,
  },
  tplHeader: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   spacing.xs,
    columnGap:      spacing.xs,
  },
  tplMenuIcon: {
    padding:      8,
    borderRadius: radius.full,
    alignItems:   'center',
    justifyContent: 'center',
  },
  tplName: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.md,
    fontFamily: font.semibold,
    flex:       1,
    letterSpacing: -0.2,
  },
  tplExCount: {
    color:        colors.accent,
    fontSize:     font.sizes.xs,
    fontFamily:   font.medium,
    marginBottom: 3,
  },
  tplExList: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.sm,
    fontFamily: font.regular,
    lineHeight: 19,
  },
  tplFooter: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     3,
    marginTop:     spacing.sm,
  },
  tplLastUsed: {
    color:      colors.textMuted,
    fontSize:   font.sizes.xs,
    fontFamily: font.regular,
  },
});

export default WorkoutScreen;
