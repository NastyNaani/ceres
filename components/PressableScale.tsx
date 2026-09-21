import * as Haptics from 'expo-haptics';
import React, { useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
};

/**
 * A pressable that springs slightly inward on touch and fires a light haptic.
 * Tuned for snappy, premium feedback.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  haptic = true,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const handleIn = (e: GestureResponderEvent) => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 90,
      bounciness: 0,
    }).start();
    if (haptic && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPressIn?.(e);
  };

  const handleOut = (e: GestureResponderEvent) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 70,
      bounciness: 3,
    }).start();
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
