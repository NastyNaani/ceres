import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catches render crashes so Expo doesn’t hard-close the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ceres ErrorBoundary', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>{this.state.error.message || 'Unexpected error'}</Text>
        <Pressable
          onPress={() => this.setState({ error: null })}
          style={styles.btn}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.md,
  },
  title: {
    fontFamily: font.display,
    fontSize: 22,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: font.bodyReg,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  btn: {
    marginTop: spacing.md,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.card,
  },
  btnText: {
    fontFamily: font.bodySemi,
    fontSize: 14,
    color: colors.silver,
  },
});
