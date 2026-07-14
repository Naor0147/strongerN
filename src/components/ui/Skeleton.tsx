import React, { useEffect } from 'react';
import { View, StyleSheet, DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { colors, radius, spacing } from '../../theme';

export interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const ShimmerContainer: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    let mounted = true;
    const pulse = () => {
      if (!mounted) return;
      opacity.value = withTiming(0.75, { duration: 650, easing: Easing.inOut(Easing.ease) }, (finished) => {
        if (finished && mounted) {
          opacity.value = withTiming(0.35, { duration: 650, easing: Easing.inOut(Easing.ease) }, (f2) => {
            if (f2 && mounted) {
              pulse();
            }
          });
        }
      });
    };
    pulse();
    return () => {
      mounted = false;
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
};

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = '100%',
  height = 16,
  borderRadius = radius.xs,
  style,
}) => {
  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#1E2532',
        },
        style,
      ]}
    />
  );
};

export const ProfileSkeleton: React.FC = () => {
  return (
    <ShimmerContainer style={skeletonStyles.container}>
      {/* Header Skeleton */}
      <View style={skeletonStyles.headerRow}>
        <SkeletonBlock width={140} height={28} borderRadius={radius.sm} />
        <SkeletonBlock width={36} height={36} borderRadius={18} />
      </View>

      {/* User Card Skeleton */}
      <View style={skeletonStyles.userCard}>
        <SkeletonBlock width={64} height={64} borderRadius={32} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <SkeletonBlock width="60%" height={20} />
          <SkeletonBlock width="40%" height={14} />
        </View>
      </View>

      {/* Stat Grid Skeleton */}
      <View style={skeletonStyles.statGrid}>
        <SkeletonBlock width="48%" height={80} borderRadius={radius.md} />
        <SkeletonBlock width="48%" height={80} borderRadius={radius.md} />
        <SkeletonBlock width="48%" height={80} borderRadius={radius.md} />
        <SkeletonBlock width="48%" height={80} borderRadius={radius.md} />
      </View>

      {/* Section Skeleton */}
      <SkeletonBlock width="100%" height={140} borderRadius={radius.lg} style={{ marginTop: spacing.md }} />
    </ShimmerContainer>
  );
};

export const WorkoutHeaderSkeleton: React.FC = () => {
  return (
    <ShimmerContainer style={skeletonStyles.container}>
      <View style={skeletonStyles.headerRow}>
        <SkeletonBlock width={120} height={28} borderRadius={radius.sm} />
        <SkeletonBlock width={36} height={36} borderRadius={18} />
      </View>

      <View style={skeletonStyles.routineHeader}>
        <SkeletonBlock width={180} height={24} />
        <SkeletonBlock width="100%" height={50} borderRadius={radius.md} style={{ marginTop: spacing.sm }} />
      </View>
    </ShimmerContainer>
  );
};

const skeletonStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  routineHeader: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
