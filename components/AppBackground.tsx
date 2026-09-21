import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  RadialGradient as SvgRadial,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors } from '../theme';

const NOISE = require('../assets/noise.png');

/**
 * Ambient backdrop: near-black field lit by a faint silver halo
 * and a deep vignette at the base for depth.
 */
export function AppBackground({
  children,
  shift = 0,
}: {
  children?: React.ReactNode;
  shift?: number;
}) {
  return (
    <View style={styles.root}>
      <Svg
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateY: Math.max(-24, Math.min(24, shift * 0.12)) }] },
        ]}
        pointerEvents="none"
      >
        <Defs>
          <SvgRadial id="halo" cx="50%" cy="0%" r="75%">
            <Stop offset="0%" stopColor="#3A3D44" stopOpacity="0.55" />
            <Stop offset="38%" stopColor="#16161B" stopOpacity="0.5" />
            <Stop offset="100%" stopColor={colors.void} stopOpacity="0" />
          </SvgRadial>
          <SvgRadial id="floor" cx="50%" cy="100%" r="80%">
            <Stop offset="0%" stopColor="#000000" stopOpacity="0.6" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </SvgRadial>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={colors.void} />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#halo)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#floor)" />
      </Svg>
      <Image source={NOISE} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
  },
});
