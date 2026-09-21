import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';
import { Icon } from './Icon';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChangeText, placeholder = 'Search' }: Props) {
  return (
    <View style={styles.bar} accessibilityRole="search">
      <Icon name="search" size={17} color={colors.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        selectionColor={colors.silver}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityLabel="Clear search">
          <Icon name="close" size={16} color={colors.textTertiary} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 15.5,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
});
