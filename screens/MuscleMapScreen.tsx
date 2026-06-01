// screens/MuscleMapScreen.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Ellipse, Rect } from 'react-native-svg';
import { colors, font, spacing, radius } from '../theme';
import ScreenHeader from '../components/layout/ScreenHeader';

interface MuscleMapScreenProps {
  weeklyMuscleSets: Record<string, number>; // e.g. { 'Chest': 25, 'Back': 22, 'Quads': 29, ... }
}

// Helper: get intensity (0-1) for a muscle
function getIntensity(sets: number, maxSets: number): number {
  if (maxSets === 0) return 0;
  return Math.min(1, sets / maxSets);
}

// Helper: get fill color with opacity based on intensity
function getMuscleColor(muscle: string, intensity: number): { fill: string; opacity: number } {
  const muscleColorMap: Record<string, string> = {
    'Chest': colors.muscle.chest,
    'Back': colors.muscle.back,
    'Quads': colors.muscle.quads,
    'Hamstrings': colors.muscle.hamstrings,
    'Shoulders': colors.muscle.shoulders,
    'Biceps': colors.muscle.biceps,
    'Triceps': colors.muscle.triceps,
    'Glutes': colors.muscle.glutes,
    'Rear Delts': colors.muscle.rearDelts,
  };
  const fill = muscleColorMap[muscle] ?? colors.muscle.default;
  const opacity = intensity < 0.05 ? 0.1 : Math.max(0.15, intensity);
  return { fill, opacity };
}

// ─── Front Body SVG ─────────────────────────────────────────────────────────
const FrontBody: React.FC<{ muscleSets: Record<string, number>; maxSets: number }> = ({
  muscleSets,
  maxSets,
}) => {
  const chest = getMuscleColor('Chest', getIntensity(muscleSets['Chest'] ?? 0, maxSets));
  const shoulders = getMuscleColor('Shoulders', getIntensity(muscleSets['Shoulders'] ?? 0, maxSets));
  const biceps = getMuscleColor('Biceps', getIntensity(muscleSets['Biceps'] ?? 0, maxSets));
  const triceps = getMuscleColor('Triceps', getIntensity(muscleSets['Triceps'] ?? 0, maxSets));
  const quads = getMuscleColor('Quads', getIntensity(muscleSets['Quads'] ?? 0, maxSets));

  return (
    <Svg width={160} height={320} viewBox="0 0 160 320">
      {/* Head */}
      <Path
        d="M80 8 C72 8 66 14 66 22 C66 30 72 36 80 36 C88 36 94 30 94 22 C94 14 88 8 80 8Z"
        fill={colors.surface2}
        stroke={colors.border}
        strokeWidth={1.5}
      />
      {/* Neck */}
      <Rect x="74" y="34" width="12" height="14" fill={colors.surface2} stroke={colors.border} strokeWidth={1} />
      {/* Torso outline */}
      <Path
        d="M52 48 L40 52 L34 58 L32 80 L36 100 L38 130 L44 140 L48 160 L112 160 L116 140 L122 130 L124 100 L128 80 L126 58 L120 52 L108 48 Z"
        fill={colors.surface2}
        stroke={colors.border}
        strokeWidth={1.5}
      />
      {/* Left arm */}
      <Path
        d="M52 48 L38 54 L32 70 L30 100 L34 120 L38 130 L42 120 L44 100 L44 80 L46 60 Z"
        fill={colors.surface2}
        stroke={colors.border}
        strokeWidth={1.5}
      />
      {/* Right arm */}
      <Path
        d="M108 48 L122 54 L128 70 L130 100 L126 120 L122 130 L118 120 L116 100 L116 80 L114 60 Z"
        fill={colors.surface2}
        stroke={colors.border}
        strokeWidth={1.5}
      />
      {/* Left leg */}
      <Path
        d="M48 160 L44 200 L42 240 L44 280 L52 290 L58 280 L56 240 L60 200 L72 160 Z"
        fill={colors.surface2}
        stroke={colors.border}
        strokeWidth={1.5}
      />
      {/* Right leg */}
      <Path
        d="M112 160 L100 160 L104 200 L108 240 L106 280 L112 290 L120 280 L118 240 L116 200 L112 160 Z"
        fill={colors.surface2}
        stroke={colors.border}
        strokeWidth={1.5}
      />

      {/* === MUSCLE HIGHLIGHTS === */}

      {/* Chest - Left Pec */}
      <Ellipse cx="65" cy="72" rx="14" ry="11" fill={chest.fill} fillOpacity={chest.opacity} />
      {/* Chest - Right Pec */}
      <Ellipse cx="95" cy="72" rx="14" ry="11" fill={chest.fill} fillOpacity={chest.opacity} />

      {/* Left Shoulder */}
      <Ellipse cx="46" cy="56" rx="10" ry="8" fill={shoulders.fill} fillOpacity={shoulders.opacity} />
      {/* Right Shoulder */}
      <Ellipse cx="114" cy="56" rx="10" ry="8" fill={shoulders.fill} fillOpacity={shoulders.opacity} />

      {/* Left Bicep */}
      <Ellipse cx="38" cy="84" rx="6" ry="14" fill={biceps.fill} fillOpacity={biceps.opacity} />
      {/* Right Bicep */}
      <Ellipse cx="122" cy="84" rx="6" ry="14" fill={biceps.fill} fillOpacity={biceps.opacity} />

      {/* Left Tricep (front-visible, lateral strip) */}
      <Ellipse cx="44" cy="86" rx="4" ry="12" fill={triceps.fill} fillOpacity={triceps.opacity * 0.7} />
      {/* Right Tricep */}
      <Ellipse cx="116" cy="86" rx="4" ry="12" fill={triceps.fill} fillOpacity={triceps.opacity * 0.7} />

      {/* Abs - 3×2 grid */}
      <Rect x="71" y="98"  width="8" height="9" rx="3" fill={colors.textMuted} fillOpacity={0.25} />
      <Rect x="81" y="98"  width="8" height="9" rx="3" fill={colors.textMuted} fillOpacity={0.25} />
      <Rect x="71" y="110" width="8" height="9" rx="3" fill={colors.textMuted} fillOpacity={0.25} />
      <Rect x="81" y="110" width="8" height="9" rx="3" fill={colors.textMuted} fillOpacity={0.25} />
      <Rect x="71" y="122" width="8" height="9" rx="3" fill={colors.textMuted} fillOpacity={0.25} />
      <Rect x="81" y="122" width="8" height="9" rx="3" fill={colors.textMuted} fillOpacity={0.25} />

      {/* Left Quad */}
      <Ellipse cx="58"  cy="195" rx="13" ry="28" fill={quads.fill} fillOpacity={quads.opacity} />
      {/* Right Quad */}
      <Ellipse cx="102" cy="195" rx="13" ry="28" fill={quads.fill} fillOpacity={quads.opacity} />
    </Svg>
  );
};

// ─── Back Body SVG ───────────────────────────────────────────────────────────
const BackBody: React.FC<{ muscleSets: Record<string, number>; maxSets: number }> = ({
  muscleSets,
  maxSets,
}) => {
  const back = getMuscleColor('Back', getIntensity(muscleSets['Back'] ?? 0, maxSets));
  const rearDelts = getMuscleColor('Rear Delts', getIntensity(muscleSets['Rear Delts'] ?? 0, maxSets));
  const hamstrings = getMuscleColor('Hamstrings', getIntensity(muscleSets['Hamstrings'] ?? 0, maxSets));
  const glutes = getMuscleColor('Glutes', getIntensity(muscleSets['Glutes'] ?? 0, maxSets));
  const triceps = getMuscleColor('Triceps', getIntensity(muscleSets['Triceps'] ?? 0, maxSets));

  return (
    <Svg width={160} height={320} viewBox="0 0 160 320">
      {/* Head */}
      <Path
        d="M80 8 C72 8 66 14 66 22 C66 30 72 36 80 36 C88 36 94 30 94 22 C94 14 88 8 80 8Z"
        fill={colors.surface2}
        stroke={colors.border}
        strokeWidth={1.5}
      />
      {/* Neck */}
      <Rect x="74" y="34" width="12" height="14" fill={colors.surface2} stroke={colors.border} strokeWidth={1} />
      {/* Torso */}
      <Path
        d="M52 48 L40 52 L34 58 L32 80 L36 100 L38 130 L44 140 L48 160 L112 160 L116 140 L122 130 L124 100 L128 80 L126 58 L120 52 L108 48 Z"
        fill={colors.surface2}
        stroke={colors.border}
        strokeWidth={1.5}
      />
      {/* Left arm */}
      <Path
        d="M52 48 L38 54 L32 70 L30 100 L34 120 L38 130 L42 120 L44 100 L44 80 L46 60 Z"
        fill={colors.surface2}
        stroke={colors.border}
        strokeWidth={1.5}
      />
      {/* Right arm */}
      <Path
        d="M108 48 L122 54 L128 70 L130 100 L126 120 L122 130 L118 120 L116 100 L116 80 L114 60 Z"
        fill={colors.surface2}
        stroke={colors.border}
        strokeWidth={1.5}
      />
      {/* Left leg */}
      <Path
        d="M48 160 L44 200 L42 240 L44 280 L52 290 L58 280 L56 240 L60 200 L72 160 Z"
        fill={colors.surface2}
        stroke={colors.border}
        strokeWidth={1.5}
      />
      {/* Right leg */}
      <Path
        d="M112 160 L100 160 L104 200 L108 240 L106 280 L112 290 L120 280 L118 240 L116 200 L112 160 Z"
        fill={colors.surface2}
        stroke={colors.border}
        strokeWidth={1.5}
      />

      {/* === MUSCLE HIGHLIGHTS === */}

      {/* Lats (Back) - Large V shapes */}
      <Path
        d="M54 52 L40 80 L40 120 L56 140 L70 130 L66 100 L62 70 Z"
        fill={back.fill}
        fillOpacity={back.opacity}
      />
      <Path
        d="M106 52 L120 80 L120 120 L104 140 L90 130 L94 100 L98 70 Z"
        fill={back.fill}
        fillOpacity={back.opacity}
      />

      {/* Traps */}
      <Path
        d="M72 48 L66 52 L68 70 L80 72 L92 70 L94 52 L88 48 Z"
        fill={rearDelts.fill}
        fillOpacity={rearDelts.opacity * 0.8}
      />

      {/* Rear Delts */}
      <Ellipse cx="46"  cy="56" rx="10" ry="8" fill={rearDelts.fill} fillOpacity={rearDelts.opacity} />
      <Ellipse cx="114" cy="56" rx="10" ry="8" fill={rearDelts.fill} fillOpacity={rearDelts.opacity} />

      {/* Triceps (back – more visible) */}
      <Ellipse cx="37"  cy="86" rx="5" ry="15" fill={triceps.fill} fillOpacity={triceps.opacity} />
      <Ellipse cx="123" cy="86" rx="5" ry="15" fill={triceps.fill} fillOpacity={triceps.opacity} />

      {/* Glutes */}
      <Ellipse cx="64" cy="160" rx="16" ry="13" fill={glutes.fill} fillOpacity={glutes.opacity} />
      <Ellipse cx="96" cy="160" rx="16" ry="13" fill={glutes.fill} fillOpacity={glutes.opacity} />

      {/* Hamstrings */}
      <Ellipse cx="57"  cy="210" rx="13" ry="30" fill={hamstrings.fill} fillOpacity={hamstrings.opacity} />
      <Ellipse cx="103" cy="210" rx="13" ry="30" fill={hamstrings.fill} fillOpacity={hamstrings.opacity} />
    </Svg>
  );
};

// ─── Muscle meta list ────────────────────────────────────────────────────────
const MUSCLE_LIST = [
  { key: 'Chest',      color: colors.muscle.chest,      view: 'front' },
  { key: 'Back',       color: colors.muscle.back,        view: 'back'  },
  { key: 'Shoulders',  color: colors.muscle.shoulders,   view: 'front' },
  { key: 'Biceps',     color: colors.muscle.biceps,      view: 'front' },
  { key: 'Triceps',    color: colors.muscle.triceps,     view: 'both'  },
  { key: 'Quads',      color: colors.muscle.quads,       view: 'front' },
  { key: 'Hamstrings', color: colors.muscle.hamstrings,  view: 'back'  },
  { key: 'Glutes',     color: colors.muscle.glutes,      view: 'back'  },
  { key: 'Rear Delts', color: colors.muscle.rearDelts,   view: 'back'  },
] as const;

// ─── Screen ──────────────────────────────────────────────────────────────────
const MuscleMapScreen: React.FC<MuscleMapScreenProps> = ({ weeklyMuscleSets }) => {
  const [view, setView] = useState<'front' | 'back'>('front');

  const maxSets = useMemo(() => {
    const vals = Object.values(weeklyMuscleSets);
    return vals.length > 0 ? Math.max(...vals) : 1;
  }, [weeklyMuscleSets]);

  const totalSets = useMemo(
    () => Object.values(weeklyMuscleSets).reduce((a, b) => a + b, 0),
    [weeklyMuscleSets],
  );

  const sortedMuscles = useMemo(
    () =>
      MUSCLE_LIST.map(m => ({ ...m, sets: weeklyMuscleSets[m.key] ?? 0 })).sort(
        (a, b) => b.sets - a.sets,
      ),
    [weeklyMuscleSets],
  );

  const mostWorked = sortedMuscles[0];

  // Resolve the color key for the most-worked muscle label
  const mostWorkedColor = (() => {
    if (!mostWorked) return colors.accent;
    const key = mostWorked.key.toLowerCase().replace(' ', '') as keyof typeof colors.muscle;
    return colors.muscle[key] ?? colors.accent;
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Muscle Map"
        subtitle="This week's training focus"
        testID="musclemap.header"
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        {/* ── Weekly Summary ─────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalSets}</Text>
            <Text style={styles.summaryLabel}>TOTAL SETS</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {Object.keys(weeklyMuscleSets).filter(k => (weeklyMuscleSets[k] ?? 0) > 0).length}
            </Text>
            <Text style={styles.summaryLabel}>MUSCLES HIT</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: mostWorkedColor }]}>
              {mostWorked?.key ?? '--'}
            </Text>
            <Text style={styles.summaryLabel}>MOST WORKED</Text>
          </View>
        </View>

        {/* ── View Toggle ────────────────────────────────────────────── */}
        <View style={styles.toggleContainer}>
          <Pressable
            style={[styles.toggleBtn, view === 'front' && styles.toggleBtnActive]}
            onPress={() => setView('front')}
          >
            <Text style={[styles.toggleBtnText, view === 'front' && styles.toggleBtnTextActive]}>
              FRONT
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, view === 'back' && styles.toggleBtnActive]}
            onPress={() => setView('back')}
          >
            <Text style={[styles.toggleBtnText, view === 'back' && styles.toggleBtnTextActive]}>
              BACK
            </Text>
          </Pressable>
        </View>

        {/* ── Body SVG ───────────────────────────────────────────────── */}
        <View style={styles.bodyContainer}>
          {view === 'front' ? (
            <FrontBody muscleSets={weeklyMuscleSets} maxSets={maxSets} />
          ) : (
            <BackBody muscleSets={weeklyMuscleSets} maxSets={maxSets} />
          )}

          {/* Intensity scale */}
          <View style={styles.scaleContainer}>
            <Text style={styles.scaleLabel}>Low</Text>
            <View style={styles.scaleGradient}>
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((v, i) => (
                <View key={i} style={[styles.scaleStep, { opacity: v }]} />
              ))}
            </View>
            <Text style={styles.scaleLabel}>High</Text>
          </View>
        </View>

        {/* ── Muscle Legend ──────────────────────────────────────────── */}
        <Text style={styles.legendTitle}>MUSCLE GROUPS</Text>
        <View style={styles.legendGrid}>
          {sortedMuscles.map(muscle => {
            const intensity = getIntensity(muscle.sets, maxSets);
            return (
              <View key={muscle.key} style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: muscle.color, opacity: Math.max(0.2, intensity) },
                  ]}
                />
                <View style={styles.legendInfo}>
                  <Text style={styles.legendMuscle}>{muscle.key}</Text>
                  <Text style={styles.legendSets}>{muscle.sets} sets</Text>
                </View>
                <View style={styles.legendBarBg}>
                  <View
                    style={[
                      styles.legendBarFill,
                      {
                        width: `${Math.round(intensity * 100)}%`,
                        backgroundColor: muscle.color,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxxl + spacing.xl },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.border },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: font.sizes.xl,
    fontFamily: font.bold,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.semibold,
    letterSpacing: 0.8,
    marginTop: 2,
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.xs,
  },
  toggleBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  toggleBtnText: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  toggleBtnTextActive: { color: colors.accent },

  // Body container
  bodyContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },

  // Intensity scale
  scaleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  scaleLabel: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
  },
  scaleGradient: {
    flexDirection: 'row',
    height: 8,
    width: 120,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
  },
  scaleStep: {
    flex: 1,
    backgroundColor: colors.accent,
  },

  // Legend
  legendTitle: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 1.2,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  legendGrid: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendInfo: { flex: 1 },
  legendMuscle: {
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
  },
  legendSets: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
    marginTop: 1,
  },
  legendBarBg: {
    width: 80,
    height: 4,
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  legendBarFill: {
    height: '100%',
    borderRadius: radius.full,
  },
});

export default MuscleMapScreen;
