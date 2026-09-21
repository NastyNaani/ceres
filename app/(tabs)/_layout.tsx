import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../../components/Icon';
import { PressableScale } from '../../components/PressableScale';
import { useReducedMotion } from '../../lib/motion';
import { colors, font, radius } from '../../theme';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Scan', icon: 'scan' },
  { name: 'history', label: 'History', icon: 'history' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
];

const SNAP = Easing.out(Easing.cubic);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.void },
        freezeOnBlur: true,
      }}
      tabBar={(props) => <CeresTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

function CeresTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom - 2, 10) }]}
      pointerEvents="box-none"
    >
      <View style={styles.dock}>
        <BlurView
          intensity={Platform.OS === 'android' ? 48 : 68}
          tint="dark"
          style={styles.bar}
        >
          <View style={styles.barInner}>
            {state.routes.map((route: any, index: number) => {
              const meta = TABS.find((t) => t.name === route.name);
              if (!meta) return null;
              const focused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <TabItem
                  key={route.key}
                  meta={meta}
                  focused={focused}
                  onPress={onPress}
                />
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

function TabItem({
  meta,
  focused,
  onPress,
}: {
  meta: (typeof TABS)[number];
  focused: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const active = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(active, {
      toValue: focused ? 1 : 0,
      duration: reduced ? 0 : 140,
      easing: SNAP,
      useNativeDriver: true,
    }).start();
  }, [focused, reduced, active]);

  const iconOpacity = active.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.9}
      style={styles.tab}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={meta.label}
      accessibilityHint={`Opens the ${meta.label} tab`}
    >
      <Animated.View style={{ opacity: iconOpacity, alignItems: 'center', gap: 4 }}>
        <Icon
          name={meta.icon}
          size={20}
          color={focused ? colors.silverBright : colors.silverMid}
          strokeWidth={focused ? 2.1 : 1.6}
        />
        <Text style={[styles.label, focused && styles.labelActive]}>{meta.label}</Text>
        <View style={[styles.dot, focused ? styles.dotOn : styles.dotOff]} />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  dock: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  bar: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(214,218,224,0.18)',
    backgroundColor: 'rgba(12,12,15,0.92)',
  },
  barInner: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    paddingVertical: 2,
  },
  label: {
    fontFamily: font.body,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.textTertiary,
  },
  labelActive: {
    color: colors.silverBright,
    fontFamily: font.bodySemi,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
  dotOn: {
    backgroundColor: colors.silverBright,
    opacity: 0.9,
  },
  dotOff: {
    backgroundColor: 'transparent',
  },
});
