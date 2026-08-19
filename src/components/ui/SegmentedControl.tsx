import React, { useEffect } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, font, radius, spacing, ripple } from '../../theme';

export interface TabEntry {
  key: string;
  label: string;
  icon?: string;
}

export interface SegmentedControlProps {
  tabs: TabEntry[];
  activeKey: string;
  onChange: (key: string) => void;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
  tabs,
  activeKey,
  onChange,
}) => {
  const activeIndexSV = useSharedValue(0);

  useEffect(() => {
    const idx = tabs.findIndex((t) => t.key === activeKey);
    if (idx !== -1) {
      activeIndexSV.value = withTiming(idx, {
        duration: 200,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [activeKey, tabs, activeIndexSV]);

  const slideStyle = useAnimatedStyle(() => {
    const tabWidthPercent = 100 / tabs.length;
    return {
      left: `${activeIndexSV.value * tabWidthPercent}%`,
      width: `${tabWidthPercent}%`,
    };
  });

  return (
    <View style={styles.container}>
      {/* Sliding background indicator */}
      <Animated.View style={[styles.slidingBg, slideStyle]} />

      {/* Tab triggers */}
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onChange(tab.key)}
            android_ripple={ripple.borderless}
          >
            {tab.icon && (
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={isActive ? colors.accent : colors.textSecondary}
                style={styles.icon}
              />
            )}
            <Text
              style={[
                styles.labelText,
                isActive ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
    height: 50,
  },
  slidingBg: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    backgroundColor: colors.bg,
    borderRadius: radius.md - 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    zIndex: 1,
  },
  icon: {
    marginRight: spacing.xs,
  },
  labelText: {
    fontSize: font.sizes.sm,
    letterSpacing: -0.1,
  },
  labelActive: {
    color: colors.textPrimary,
    fontFamily: font.semibold,
  },
  labelInactive: {
    color: colors.textSecondary,
    fontFamily: font.medium,
  },
});

export default SegmentedControl;
