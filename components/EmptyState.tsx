import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';
import { Icon, IconName } from './Icon';

type Props = {
  icon?: IconName;
  title: string;
  body: string;
};

export function EmptyState({ icon = 'history', title, body }: Props) {
  return (
    <View style={styles.empty}>
      <View style={styles.icon}>
        <Icon name={icon} size={34} color={colors.silverMid} strokeWidth={1.4} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    paddingBottom: 80,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: spacing.lg,
  },
  title: { fontFamily: font.display, fontSize: 21, color: colors.textPrimary, letterSpacing: 0.3 },
  body: {
    fontFamily: font.bodyReg,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
