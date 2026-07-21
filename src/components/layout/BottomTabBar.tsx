// components/layout/BottomTabBar.tsx
// Premium floating tab bar — pill active indicator, accent icon colour, ripple feedback
import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius, ripple as rippleTokens, animation, globalAnimation } from '../../theme';
import i18n from '../../utils/i18n';
import { I18nManager } from 'react-native';

interface TabConfig {
  route:      string;
  icon:       keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  label:      string;
}

const getTabConfig = (): TabConfig[] => [
  { route: 'Profile',   icon: 'person-outline',     iconActive: 'person',      label: i18n.t('tabs.profile')   },
  { route: 'History',   icon: 'time-outline',        iconActive: 'time',        label: i18n.t('tabs.history')   },
  { route: 'Workout',   icon: 'add-circle-outline',  iconActive: 'add-circle',  label: i18n.t('tabs.workout')   },
  { route: 'Exercises', icon: 'barbell-outline',     iconActive: 'barbell',     label: i18n.t('tabs.exercises') },
  { route: 'Muscles',   icon: 'body-outline',        iconActive: 'body',        label: i18n.t('tabs.muscles')   },
];

// Single animated tab item
interface TabItemProps {
  tab:       TabConfig;
  isActive:  boolean;
  onPress:   () => void;
  onPressIn: () => void;
  index:     number;
}

const TabItem: React.FC<TabItemProps> = React.memo(({ tab, isActive, onPress, onPressIn, index }) => {
  const scale = useSharedValue(isActive ? 1 : 0.88);

  useEffect(() => {
    if (globalAnimation.speed === 0) {
      scale.value = isActive ? 1 : 0.88;
      return;
    }
    scale.value = withSpring(
      isActive ? 1 : 0.88,
      {
        stiffness: animation.spring.stiffness / (globalAnimation.speed * globalAnimation.speed),
        damping: animation.spring.damping / globalAnimation.speed,
        mass: animation.spring.mass,
      }
    );
  }, [isActive, scale, globalAnimation.speed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconColor = isActive ? colors.accent      : colors.iconInactive;
  const iconName  = isActive ? tab.iconActive     : tab.icon;
  const labelColor= isActive ? colors.textPrimary : colors.iconInactive;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      android_ripple={rippleTokens.borderless}
      style={styles.tab}
      accessibilityLabel={`${tab.label} tab`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      testID={`tab.${tab.route.toLowerCase()}`}
    >
      <Animated.View style={[styles.tabInner, animatedStyle]}>
        {/* Active pill indicator */}
        {isActive && (
          <View style={styles.activePill} />
        )}
        <Ionicons name={iconName} size={24} color={iconColor} />
        <Text style={[styles.label, { color: labelColor, fontFamily: I18nManager.isRTL ? 'Rubik_500Medium' : font.medium }]} numberOfLines={1}>
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

const BottomTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();

  const tabConfigs = useMemo(() => getTabConfig(), []);

  const navigateTo = useMemo(() => {
    const map: Record<string, () => void> = {};
    state.routes.forEach(route => {
      map[route.name] = () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });

        if (state.index !== state.routes.indexOf(route) && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      };
    });
    return map;
  }, [state.index, state.routes, navigation]);

  // A tab press is completed on release, but its screen can be prepared as soon
  // as the finger lands. This keeps expensive first mounts out of the critical
  // input-to-navigation window without changing tab-selection semantics.
  const preloadOnTouch = useMemo(() => {
    const map: Record<string, () => void> = {};
    state.routes.forEach((route, index) => {
      map[route.name] = () => {
        if (state.index !== index) {
          navigation.preload(route.name);
        }
      };
    });
    return map;
  }, [state.index, state.routes, navigation]);

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
      testID="bottom-tab-bar"
    >
      {/* Separator line */}
      <View style={styles.separator} />

      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const tab = tabConfigs.find(t => t.route === route.name);
          if (!tab) return null;
          
          return (
            <TabItem
              key={route.key}
              tab={tab}
              isActive={state.index === index}
              onPress={navigateTo[route.name]}
              onPressIn={preloadOnTouch[route.name]}
              index={index}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingTop:      spacing.xs,
  },
  separator: {
    height:          1,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: 'row',
  },
  tab: {
    flex:     1,
    overflow: 'hidden',
  },
  tabInner: {
    alignItems:      'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    position:        'relative',
  },
  activePill: {
    position:        'absolute',
    top:             0,
    width:           36,
    height:          3,
    borderRadius:    radius.full,
    backgroundColor: colors.accent,
    boxShadow:       '0px 0px 6px ' + colors.accent + 'B3',
  },
  label: {
    fontSize:   font.sizes.xs,
    fontFamily: font.medium,
    marginTop:  4,
  },
});

export default React.memo(BottomTabBar);
