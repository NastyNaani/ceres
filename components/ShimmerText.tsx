import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { silverGradient } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  /** Pause the sweep loop (e.g. while hidden behind a sheet). */
  active?: boolean;
};

/**
 * Silver gradient text with a slow specular highlight that sweeps across the
 * glyphs — a subtle "brushed metal catching the light" effect.
 */
export function ShimmerText({ children, style, active = true }: Props) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!w || !active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [w, x, active]);

  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-w, w] });

  return (
    <MaskedView maskElement={<Text style={style}>{children}</Text>}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
        <LinearGradient
          colors={[...silverGradient] as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {w > 0 && (
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.95)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        )}
      </View>
    </MaskedView>
  );
}
