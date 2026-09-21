import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Verdict } from '../lib/food';
import { verdictLabel } from '../lib/food';
import { colors, font, radius } from '../theme';
import { Icon } from './Icon';

const META: Record<Verdict, { color: string; label: string }> = {
  elite: { color: colors.elite, label: 'Elite' },
  excellent: { color: colors.success, label: 'Excellent' },
  good: { color: colors.success, label: 'Good' },
  ok: { color: colors.caution, label: 'Okay' },
  poor: { color: colors.danger, label: 'Poor' },
  worst: { color: colors.dangerDeep, label: 'Worst' },
  abysmal: { color: colors.abysmal, label: 'Abysmal' },
  unknown: { color: colors.silverDim, label: 'Unknown' },
};

export function scoreMeta(verdict: Verdict, rating?: number | null) {
  const base = META[verdict] ?? META.unknown;
  if (typeof rating === 'number' && rating <= 0) {
    const label = verdictLabel(verdict, rating);
    const color =
      rating <= -8 ? colors.abysmal : rating <= -4 ? colors.dangerDeep : colors.danger;
    return { color, label };
  }
  return base;
}

export function ScoreBadge({
  verdict,
  rating,
  size = 'md',
}: {
  verdict: Verdict;
  rating?: number | null;
  size?: 'md' | 'lg';
}) {
  const m = scoreMeta(verdict, rating);
  const label = verdictLabel(verdict, rating);
  const large = size === 'lg';
  return (
    <View
      style={[
        styles.badge,
        large && styles.badgeLg,
        {
          borderColor: `${m.color}88`,
          backgroundColor: `${m.color}18`,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Product score: ${label}`}
    >
      <Icon name="shield" size={large ? 14 : 12} color={m.color} />
      <Text style={[styles.text, large && styles.textLg, { color: m.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeLg: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  text: { fontFamily: font.bodySemi, fontSize: 12, letterSpacing: 0.4 },
  textLg: { fontSize: 13, letterSpacing: 0.5 },
});
