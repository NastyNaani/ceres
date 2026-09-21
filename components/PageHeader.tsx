import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, font, spacing } from '../theme';
import { SilverText } from './SilverText';

type Props = {
  kicker: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export function PageHeader({ kicker, title, subtitle, right }: Props) {
  const { width } = useWindowDimensions();
  const titleSize = width < 360 ? 26 : 30;
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>{kicker}</Text>
        <SilverText style={[styles.title, { fontSize: titleSize }]}>{title}</SilverText>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: font.bodySemi,
    fontSize: 12,
    letterSpacing: 3,
    color: colors.textTertiary,
  },
  title: {
    fontFamily: font.displayBold,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: font.body,
    fontSize: 12.5,
    letterSpacing: 0.4,
    color: colors.textTertiary,
    marginTop: 6,
  },
});
