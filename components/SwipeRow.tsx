import React, { useRef } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

type Props = {
  children: React.ReactNode;
  onFavorite?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
};

const ACTION_W = 68;
const OPEN_EASE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * Swipe left to reveal actions. Soft snap, no bounce.
 */
export function SwipeRow({ children, onFavorite, onShare, onDelete, disabled }: Props) {
  const x = useRef(new Animated.Value(0)).current;
  const start = useRef(0);
  const rightCount = (onShare ? 1 : 0) + (onDelete ? 1 : 0);
  const openLeft = ACTION_W * (rightCount || 1);

  const snapTo = (to: number) => {
    Animated.timing(x, {
      toValue: to,
      duration: 240,
      easing: OPEN_EASE,
      useNativeDriver: true,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        !disabled && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderGrant: () => {
        x.stopAnimation((v) => {
          start.current = v;
        });
      },
      onPanResponderMove: (_, g) => {
        let next = start.current + g.dx;
        // Soft rubber-band past limits
        if (next < -openLeft) {
          const over = next + openLeft;
          next = -openLeft + over * 0.18;
        } else if (next > 0 && !onFavorite) {
          next = next * 0.18;
        } else if (next > ACTION_W && onFavorite) {
          const over = next - ACTION_W;
          next = ACTION_W + over * 0.18;
        }
        x.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const projected = start.current + g.dx + g.vx * 80;
        let to = 0;
        if (projected < -openLeft * 0.35 || g.vx < -0.6) to = -openLeft;
        else if (onFavorite && (projected > ACTION_W * 0.35 || g.vx > 0.6)) to = ACTION_W;
        snapTo(to);
      },
      onPanResponderTerminate: () => snapTo(0),
    })
  ).current;

  if (disabled) return <>{children}</>;

  const actionOpacity = x.interpolate({
    inputRange: [-openLeft, -openLeft * 0.35, 0],
    outputRange: [1, 0.55, 0],
    extrapolate: 'clamp',
  });
  const actionScale = x.interpolate({
    inputRange: [-openLeft, 0],
    outputRange: [1, 0.92],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[styles.under, { opacity: actionOpacity, transform: [{ scale: actionScale }] }]}
        pointerEvents="box-none"
      >
        {onFavorite ? (
          <PressableScale
            onPress={onFavorite}
            style={[styles.act, styles.fav]}
            accessibilityLabel="Favorite"
          >
            <Icon name="star" size={17} color={colors.void} />
          </PressableScale>
        ) : (
          <View style={{ width: ACTION_W }} />
        )}
        <View style={styles.rightActs}>
          {onShare ? (
            <PressableScale onPress={onShare} style={[styles.act, styles.share]} accessibilityLabel="Share">
              <Icon name="share" size={17} color={colors.silver} />
            </PressableScale>
          ) : null}
          {onDelete ? (
            <PressableScale
              onPress={() => {
                snapTo(0);
                onDelete();
              }}
              style={[styles.act, styles.del]}
              accessibilityLabel="Delete"
            >
              <Icon name="trash" size={17} color={colors.danger} />
            </PressableScale>
          ) : null}
        </View>
      </Animated.View>
      <Animated.View style={[styles.front, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  under: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  rightActs: { flexDirection: 'row' },
  front: {
    borderRadius: radius.lg,
  },
  act: {
    width: ACTION_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fav: { backgroundColor: colors.silver },
  share: { backgroundColor: 'rgba(255,255,255,0.06)' },
  del: { backgroundColor: 'rgba(240,128,138,0.16)' },
});
