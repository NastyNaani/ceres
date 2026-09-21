import React, { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, spacing } from '../theme';
import { AppBackground } from './AppBackground';
import { PrimaryButton } from './Buttons';
import { Icon, IconName } from './Icon';
import { ShimmerText } from './ShimmerText';
import { SilverText } from './SilverText';

const { width: W } = Dimensions.get('window');

const SLIDES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'barcode',
    title: 'Scan the shelf',
    body: 'Point at any food barcode. Ceres looks it up on Open Food Facts in a second.',
  },
  {
    icon: 'shield',
    title: 'Clear verdict',
    body: 'See Elite through Abysmal — grounded in Nutri-Score, NOVA, additives, and the ingredient list.',
  },
  {
    icon: 'history',
    title: 'Your pantry log',
    body: 'Every product you scan stays on device in History — searchable favorites, no account.',
  },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / W);
    if (i !== index) setIndex(i);
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      scroller.current?.scrollTo({ x: (index + 1) * W, animated: true });
    } else {
      onDone();
    }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <AppBackground>
        <View style={[styles.top, { paddingTop: insets.top + spacing.lg }]}>
          <ShimmerText style={styles.brand}>CERES</ShimmerText>
          <Pressable onPress={onDone} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip onboarding">
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          scrollEventThrottle={16}
        >
          {SLIDES.map((s) => (
            <View key={s.title} style={[styles.slide, { width: W }]}>
              <View style={styles.iconPod}>
                <Icon name={s.icon} size={56} color={colors.silver} strokeWidth={1.3} />
              </View>
              <SilverText style={styles.title}>{s.title}</SilverText>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          <PrimaryButton
            label={index === SLIDES.length - 1 ? 'Get started' : 'Next'}
            icon={index === SLIDES.length - 1 ? 'check' : 'chevron'}
            onPress={next}
            style={{ alignSelf: 'stretch', marginHorizontal: spacing.xl }}
          />
        </View>
      </AppBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  brand: { fontFamily: font.displayBold, fontSize: 20, letterSpacing: 6 },
  skip: { fontFamily: font.bodySemi, fontSize: 15, color: colors.textSecondary },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.lg,
  },
  iconPod: {
    width: 110,
    height: 110,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: font.displayBold,
    fontSize: 28,
    textAlign: 'center',
  },
  body: {
    fontFamily: font.bodyReg,
    fontSize: 15.5,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  bottom: {
    gap: spacing.lg,
    alignItems: 'center',
  },
  dots: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.steel,
  },
  dotActive: {
    backgroundColor: colors.silver,
    width: 18,
  },
});
