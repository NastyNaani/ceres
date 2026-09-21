import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';

type Props = {
  value: boolean;
  onChange: (v: boolean) => void;
};

/** A compact, metallic on/off switch. */
export function Toggle({ value, onChange }: Props) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      speed: 16,
      bounciness: 8,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });
  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.08)', colors.silver],
  });
  const knobBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.silverMid, colors.void],
  });

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        onChange(!value);
      }}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Animated.View style={[styles.track, { backgroundColor: bg }]}>
        <Animated.View style={[styles.knob, { backgroundColor: knobBg, transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    justifyContent: 'center',
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
