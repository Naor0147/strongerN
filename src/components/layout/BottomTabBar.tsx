// components/layout/BottomTabBar.tsx
// Premium floating tab bar — pill active indicator, accent icon colour, ripple feedback
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
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
  index:     number;
}

const TabItem: React.FC<TabItemProps> = React.memo(({ tab, isActive, onPress, index }) => {
  const scale = useRef(new Animated.Value(isActive ? 1 : 0.88)).current;

  useEffect(() => {
    if (globalAnimation.speed === 0) {
      scale.setValue(isActive ? 1 : 0.88);
      return;
    }
    Animated.spring(scale, {
      toValue:         isActive ? 1 : 0.88,
      useNativeDriver: true,
      stiffness:       animation.spring.stiffness / (globalAnimation.speed * globalAnimation.speed),
      damping:         animation.spring.damping / globalAnimation.speed,
      mass:            animation.spring.mass,
    }).start();
  }, [isActive, scale, globalAnimation.speed]);

  const iconColor = isActive ? colors.accent      : colors.iconInactive;
  const iconName  = isActive ? tab.iconActive     : tab.icon;
  const labelColor= isActive ? colors.textPrimary : colors.iconInactive;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={rippleTokens.borderless}
      style={styles.tab}
      accessibilityLabel={`${tab.label} tab`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      testID={`tab.${tab.route.toLowerCase()}`}
    >
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
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
          const tabConfigs = getTabConfig();
          const tab = tabConfigs.find(t => t.route === route.name);
          if (!tab) return null;
          
          return (
            <TabItem
              key={route.key}
              tab={tab}
              isActive={state.index === index}
              onPress={() => navigation.navigate(route.name)}
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
    shadowColor:     colors.accent,
    shadowOpacity:   0.7,
    shadowRadius:    6,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       6,
  },
  label: {
    fontSize:   font.sizes.xs,
    fontFamily: font.medium,
    marginTop:  4,
  },
});

export default BottomTabBar;
