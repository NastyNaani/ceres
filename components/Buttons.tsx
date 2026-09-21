import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, font, radius, silverGradientSoft } from '../theme';
import { Icon, IconName } from './Icon';
import { PressableScale } from './PressableScale';

type PrimaryProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

/** Brushed-silver filled button — the single highest-emphasis action. */
export function PrimaryButton({ label, onPress, icon, style, disabled }: PrimaryProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[style, disabled && { opacity: 0.4 }]}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <LinearGradient
        colors={[...silverGradientSoft] as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.primary}
      >
        {icon && <Icon name={icon} size={19} color={colors.void} strokeWidth={2.1} />}
        <Text style={styles.primaryLabel}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

type GhostProps = {
  label?: string;
  onPress: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  tone?: 'default' | 'danger';
};

/** Hairline glass button for secondary actions. */
export function GhostButton({ label, onPress, icon, style, compact, tone = 'default' }: GhostProps) {
  const color = tone === 'danger' ? colors.danger : colors.silver;
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.ghost, compact && styles.ghostCompact, style]}
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.ghostRow}>
        {icon && <Icon name={icon} size={18} color={color} strokeWidth={1.9} />}
        {label ? <Text style={[styles.ghostLabel, { color }]}>{label}</Text> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 56,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 9,
  },
  primaryLabel: {
    fontFamily: font.bodyBold,
    fontSize: 16,
    color: colors.void,
    letterSpacing: 0.2,
  },
  ghost: {
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 18,
  },
  ghostCompact: {
    height: 50,
    width: 56,
    paddingHorizontal: 0,
  },
  ghostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ghostLabel: {
    fontFamily: font.bodySemi,
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
