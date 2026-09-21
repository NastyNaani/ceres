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
}: {
  verdict: Verdict;
  rating?: number | null;
}) {
  const m = scoreMeta(verdict, rating);
  const label = verdictLabel(verdict, rating);
  return (
    <View
      style={[styles.badge, { borderColor: `${m.color}55` }]}
      accessibilityRole="text"
      accessibilityLabel={`Product score: ${label}`}
    >
      <Icon name="shield" size={12} color={m.color} />
      <Text style={[styles.text, { color: m.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  text: { fontFamily: font.bodySemi, fontSize: 11, letterSpacing: 0.4 },
});
