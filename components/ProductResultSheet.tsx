import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FoodProduct } from '../lib/food';
import { formatRating, verdictHint, verdictLabel, verdictPrompt } from '../lib/food';
import {
  nutriHighlight,
  novaHighlight,
  toneColor,
  toneDim,
  type FlagTone,
  type ProductFlag,
} from '../lib/flags';
import type { AnalyzedIngredient, IngredientTier } from '../lib/ingredients';
import { useReducedMotion } from '../lib/motion';
import type { MacroFlag, MacroRow, NutritionFacts } from '../lib/nutrition';
import { matchWatchedAllergens, useSettings } from '../lib/settings';
import { colors, font, radius, spacing } from '../theme';
import { GhostButton, PrimaryButton } from './Buttons';
import { Icon } from './Icon';
import { ScoreBadge, scoreMeta } from './ScoreBadge';
import { SilverText } from './SilverText';

const SHEET_H = Dimensions.get('window').height * 0.88;
const DISMISS_Y = 140;

type Props = {
  product: FoodProduct | null;
  loading?: boolean;
  onClose: () => void;
  onRescan: () => void;
  favorite?: boolean;
  onToggleFavorite?: () => void;
};

export function ProductResultSheet({
  product,
  loading,
  onClose,
  onRescan,
  favorite,
  onToggleFavorite,
}: Props) {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const reduced = useReducedMotion();
  const open = !!product || !!loading;
  const meta = product ? scoreMeta(product.verdict, product.rating) : null;
  const dragY = useRef(new Animated.Value(SHEET_H)).current;
  const scrimOp = useRef(new Animated.Value(0)).current;

  const prompt = useMemo(() => {
    if (!product) return '';
    return verdictPrompt(product.verdict, `${product.barcode}:${product.name}`, product.rating);
  }, [product]);

  const watchedHits = useMemo(() => {
    if (!product) return [];
    return matchWatchedAllergens(
      settings.allergenWatch,
      product.allergens,
      product.ingredients
    );
  }, [product, settings.allergenWatch]);

  useEffect(() => {
    if (!open) {
      dragY.setValue(SHEET_H);
      scrimOp.setValue(0);
      return;
    }
    if (reduced) {
      dragY.setValue(0);
      scrimOp.setValue(1);
      return;
    }
    dragY.setValue(SHEET_H);
    Animated.parallel([
      Animated.timing(dragY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scrimOp, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, dragY, scrimOp, reduced]);

  const dismiss = (velocity = 0) => {
    if (reduced) {
      onClose();
      return;
    }
    Animated.parallel([
      Animated.timing(dragY, {
        toValue: SHEET_H,
        duration: Math.max(160, 280 - Math.min(120, Math.abs(velocity) * 40)),
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scrimOp, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_Y || g.vy > 1.1) {
          dismiss(g.vy);
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            speed: 48,
            bounciness: 0,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 48,
          bounciness: 0,
        }).start();
      },
    })
  ).current;

  const shareVerdict = async () => {
    if (!product) return;
    const flagLine =
      product.flags.length > 0
        ? product.flags
            .filter((f) => f.tone === 'danger' || f.tone === 'caution')
            .slice(0, 4)
            .map((f) => f.label)
            .join(' · ')
        : null;
    const lines = [
      `${product.name}${product.brand ? ` — ${product.brand}` : ''}`,
      `Ceres: ${verdictLabel(product.verdict, product.rating)} (${formatRating(product.rating)})`,
      product.nutriscore ? `Nutri-Score ${product.nutriscore.toUpperCase()}` : null,
      product.nova ? `NOVA ${product.nova}` : null,
      product.ingredientCount > 0 ? `${product.ingredientCount} ingredients` : null,
      product.hasAddedSugar ? 'Added sugar on label' : null,
      flagLine,
      `Barcode ${product.barcode}`,
      `https://world.openfoodfacts.org/product/${product.barcode}`,
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {}
  };

  const copyBarcode = async () => {
    if (!product) return;
    await Clipboard.setStringAsync(product.barcode);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const openOff = () => {
    if (!product) return;
    Linking.openURL(`https://world.openfoodfacts.org/product/${encodeURIComponent(product.barcode)}`).catch(
      () => {}
    );
  };

  return (
    <Modal visible={open} animationType="none" transparent onRequestClose={() => dismiss()}>
      <View style={styles.scrim}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: scrimOp }]}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
            onPress={() => dismiss()}
            accessibilityLabel="Dismiss"
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheetWrap,
            {
              transform: [{ translateY: dragY }],
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <BlurView intensity={Platform.OS === 'android' ? 50 : 70} tint="dark" style={styles.sheet}>
            <View
              {...panResponder.panHandlers}
              style={styles.dragZone}
              accessibilityLabel="Drag down to close"
            >
              <View style={styles.grabber} />
            </View>
            {loading || !product ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.silver} />
              <Text style={styles.loadingText}>Looking up product…</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.headerRow}>
                {product.imageUrl ? (
                  <Image source={{ uri: product.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Icon name="barcode" size={28} color={colors.silverDim} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 6 }}>
                  {product.brand ? <Text style={styles.brand}>{product.brand}</Text> : null}
                  <Text style={styles.name} numberOfLines={3}>
                    {product.name}
                  </Text>
                  <Pressable onPress={copyBarcode} hitSlop={6} accessibilityRole="button">
                    <Text style={styles.barcode}>{product.barcode} · tap to copy</Text>
                  </Pressable>
                </View>
                {onToggleFavorite ? (
                  <Pressable onPress={onToggleFavorite} hitSlop={10} accessibilityRole="button">
                    <Icon
                      name={favorite ? 'starFilled' : 'star'}
                      size={22}
                      color={favorite ? colors.silverBright : colors.silverDim}
                    />
                  </Pressable>
                ) : null}
              </View>

              {watchedHits.length > 0 ? (
                <View style={styles.watchAlert}>
                  <Icon name="shield" size={16} color={colors.danger} />
                  <Text style={styles.watchAlertText}>
                    Watch list match: {watchedHits.join(', ')}
                  </Text>
                </View>
              ) : null}

              <View
                style={[
                  styles.verdictCard,
                  meta && {
                    borderLeftColor: meta.color,
                    borderLeftWidth: 3,
                    backgroundColor:
                      product.rating !== null && product.rating < 0
                        ? colors.abysmalDim
                        : product.verdict === 'elite'
                          ? colors.eliteDim
                          : 'rgba(255,255,255,0.03)',
                  },
                ]}
              >
                <View style={styles.verdictTop}>
                  <ScoreBadge verdict={product.verdict} rating={product.rating} />
                  <View style={styles.ratingPill}>
                    <Text style={[styles.ratingValue, meta && { color: meta.color }]}>
                      {formatRating(product.rating)}
                    </Text>
                  </View>
                </View>
                <SilverText style={styles.verdictTitle}>
                  {verdictLabel(product.verdict, product.rating)}
                </SilverText>
                <Text style={styles.verdictPrompt}>{prompt}</Text>
                <Text style={styles.verdictHint}>{verdictHint(product.verdict, product.rating)}</Text>
              </View>

              <FlagStrip flags={product.flags} />

              <View style={styles.metrics}>
                <Metric
                  label="Nutri-Score"
                  value={product.nutriscore ? product.nutriscore.toUpperCase() : '—'}
                  tone={nutriHighlight(product.nutriscore)}
                />
                <Metric
                  label="NOVA"
                  value={product.nova ? String(product.nova) : '—'}
                  tone={novaHighlight(product.nova)}
                  hint={
                    product.nova === 4
                      ? 'UPF'
                      : product.nova === 3
                        ? 'Processed'
                        : product.nova === 1 || product.nova === 2
                          ? 'Cleaner'
                          : undefined
                  }
                />
                <Metric
                  label="Ingredients"
                  value={product.ingredientCount > 0 ? String(product.ingredientCount) : '—'}
                  tone={
                    product.ingredientCount >= 15
                      ? 'caution'
                      : product.ingredientCount > 0 && product.ingredientCount <= 5
                        ? 'success'
                        : 'neutral'
                  }
                />
              </View>

              <View style={styles.metrics}>
                <Metric
                  label="Additives"
                  value={
                    typeof product.additivesCount === 'number' ? String(product.additivesCount) : '—'
                  }
                  tone={
                    typeof product.additivesCount === 'number' && product.additivesCount >= 5
                      ? product.additivesCount >= 8
                        ? 'danger'
                        : 'caution'
                      : 'neutral'
                  }
                />
                <Metric
                  label="Added sugar"
                  value={product.hasAddedSugar ? 'Yes' : product.ingredients ? 'No' : '—'}
                  tone={product.hasAddedSugar ? 'danger' : product.ingredients ? 'success' : null}
                  hint={
                    product.hasAddedSugar && product.addedSugarSources[0]
                      ? product.addedSugarSources[0]
                      : undefined
                  }
                />
                <Metric
                  label="Sat. fat"
                  value={
                    product.nutrition.rows.find((r) => r.id === 'satFat')?.display ?? '—'
                  }
                  tone={(() => {
                    const sat = product.nutrition.rows.find((r) => r.id === 'satFat');
                    if (!sat) return null;
                    if (sat.flag === 'high') return 'danger';
                    if (sat.flag === 'elevated') return 'caution';
                    if (sat.flag === 'good' || sat.flag === 'low') return 'success';
                    return 'neutral';
                  })()}
                />
              </View>

              {product.reasons.length > 0 ? (
                <Section title="Why this score">
                  {product.reasons.map((r) => (
                    <Text key={r} style={styles.bullet}>
                      · {r}
                    </Text>
                  ))}
                </Section>
              ) : null}

              <MacroBreakdown nutrition={product.nutrition} />

              <IngredientBreakdown analysis={product.ingredientAnalysis} />

              {product.allergens.length > 0 ? (
                <Section title="Allergens">
                  <Text style={styles.body}>{product.allergens.join(' · ')}</Text>
                </Section>
              ) : null}

              {product.additives.length > 0 ? (
                <Section title="Additives">
                  <Text style={styles.body}>{product.additives.join(' · ')}</Text>
                </Section>
              ) : null}

              {product.ingredients ? (
                <Section title="Full ingredients">
                  {product.hasAddedSugar ? (
                    <View style={styles.sugarCallout}>
                      <Icon name="sparkle" size={14} color={colors.danger} />
                      <Text style={styles.sugarCalloutText}>
                        Added sugar highlighted below
                        {product.addedSugarSources.length
                          ? ` — ${product.addedSugarSources.slice(0, 3).join(', ')}`
                          : ''}
                      </Text>
                    </View>
                  ) : null}
                  <HighlightedIngredients
                    text={product.ingredients}
                    highlight={product.hasAddedSugar}
                    sources={product.addedSugarSources}
                  />
                </Section>
              ) : null}

              <Text style={styles.attrib}>
                Data from Open Food Facts. Scores use Nutri-Score, NOVA, additives, macros, and a
                local ingredient read when available. Macro limits follow common per-100 g
                traffic-light bands — not medical advice.
              </Text>

              <View style={styles.utilityRow}>
                <GhostButton label="Share" icon="share" onPress={shareVerdict} style={{ flex: 1 }} />
                <GhostButton label="OFF" icon="external" onPress={openOff} style={{ flex: 1 }} />
              </View>

              <View style={styles.actions}>
                <PrimaryButton label="Scan another" icon="scan" onPress={onRescan} style={{ flex: 1 }} />
                <GhostButton icon="close" onPress={() => dismiss()} compact />
              </View>
            </ScrollView>
          )}
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MacroBreakdown({ nutrition }: { nutrition: NutritionFacts }) {
  if (!nutrition.available) return null;

  return (
    <Section title="Nutrition · per 100 g">
      {nutrition.hasProtein ? (
        <View style={styles.proteinBanner}>
          <Icon name="check" size={14} color={colors.success} />
          <Text style={styles.proteinBannerText}>
            Contains protein
            {nutrition.proteinGrams != null ? ` · ${nutrition.proteinGrams.toFixed(1)} g` : ''}
          </Text>
        </View>
      ) : (
        <Text style={styles.body}>Little to no protein listed for 100 g.</Text>
      )}

      <View style={styles.macroTable}>
        <View style={styles.macroHeader}>
          <Text style={[styles.macroCellLabel, styles.macroHeaderText]}>Macro</Text>
          <Text style={[styles.macroCellValue, styles.macroHeaderText]}>Amount</Text>
          <Text style={[styles.macroCellFlag, styles.macroHeaderText]}>Flag</Text>
        </View>
        {nutrition.rows.map((row) => (
          <MacroTableRow key={row.id} row={row} />
        ))}
      </View>

      {nutrition.overLimitCount > 0 ? (
        <Text style={styles.macroFoot}>
          {nutrition.overLimitCount} value{nutrition.overLimitCount === 1 ? '' : 's'} above preferred
          limits — highlighted below.
        </Text>
      ) : (
        <Text style={styles.macroFoot}>No macros over the high/elevated bands.</Text>
      )}
    </Section>
  );
}

function MacroTableRow({ row }: { row: MacroRow }) {
  const tone = macroTone(row.flag);
  const hot = row.flag === 'high' || row.flag === 'elevated';

  return (
    <View
      style={[
        styles.macroRow,
        hot && {
          backgroundColor: row.flag === 'high' ? colors.dangerDim : colors.cautionDim,
          borderLeftColor: tone.color,
        },
        row.flag === 'good' && {
          backgroundColor: colors.successDim,
          borderLeftColor: colors.success,
        },
      ]}
    >
      <View style={styles.macroCellLabel}>
        <Text style={[styles.macroName, hot && { color: colors.textPrimary }]}>{row.label}</Text>
        {row.note ? <Text style={[styles.macroNote, { color: tone.color }]}>{row.note}</Text> : null}
      </View>
      <Text style={[styles.macroCellValue, styles.macroAmount, { color: tone.valueColor }]}>
        {row.display}
      </Text>
      <Text style={[styles.macroCellFlag, styles.macroFlag, { color: tone.color }]}>
        {tone.label}
      </Text>
    </View>
  );
}

function macroTone(flag: MacroFlag): { color: string; valueColor: string; label: string } {
  switch (flag) {
    case 'high':
      return { color: colors.danger, valueColor: colors.danger, label: 'High' };
    case 'elevated':
      return { color: colors.caution, valueColor: colors.caution, label: 'Watch' };
    case 'good':
      return { color: colors.success, valueColor: colors.success, label: 'Good' };
    case 'low':
      return { color: colors.textTertiary, valueColor: colors.textSecondary, label: 'Low' };
    case 'ok':
      return { color: colors.silverDim, valueColor: colors.textPrimary, label: 'OK' };
    default:
      return { color: colors.textTertiary, valueColor: colors.textTertiary, label: '—' };
  }
}

function IngredientBreakdown({
  analysis,
}: {
  analysis: FoodProduct['ingredientAnalysis'];
}) {
  const total =
    analysis.good.length + analysis.caution.length + analysis.bad.length + analysis.neutral.length;
  if (total === 0) return null;

  const segments = (
    [
      { key: 'good' as const, count: analysis.good.length, color: colors.success, label: 'Good' },
      {
        key: 'caution' as const,
        count: analysis.caution.length,
        color: colors.caution,
        label: 'Caution',
      },
      { key: 'bad' as const, count: analysis.bad.length, color: colors.danger, label: 'Concern' },
      {
        key: 'neutral' as const,
        count: analysis.neutral.length,
        color: colors.steel,
        label: 'Other',
      },
    ] satisfies { key: IngredientTier; count: number; color: string; label: string }[]
  ).filter((s) => s.count > 0);

  const rows: { title: string; color: string; items: AnalyzedIngredient[] }[] = [
    { title: 'Good', color: colors.success, items: analysis.good },
    { title: 'Caution', color: colors.caution, items: analysis.caution },
    { title: 'Concern', color: colors.danger, items: analysis.bad },
  ].filter((r) => r.items.length > 0);

  return (
    <Section title="Ingredients">
      <Text style={styles.body}>{analysis.summary}</Text>

      <View style={styles.chartTrack}>
        {segments.map((s) => (
          <View
            key={s.key}
            style={[
              styles.chartSegment,
              {
                flex: s.count,
                backgroundColor: s.color,
                opacity: 0.85,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.chartLegend}>
        {segments.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>
              {s.label} {s.count}
            </Text>
          </View>
        ))}
      </View>

      {rows.map((row) => (
        <View key={row.title} style={styles.ingGroup}>
          <View style={styles.ingGroupHeader}>
            <View style={[styles.ingGroupMark, { backgroundColor: row.color }]} />
            <Text style={styles.ingGroupTitle}>{row.title}</Text>
            <Text style={styles.ingGroupCount}>{row.items.length}</Text>
          </View>
          {row.items.map((item) => (
            <View key={`${row.title}-${item.name}`} style={styles.ingRow}>
              <View style={styles.ingCopy}>
                <Text style={styles.ingName}>{item.name}</Text>
                <Text style={styles.ingNote}>{item.note}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </Section>
  );
}

function FlagStrip({ flags }: { flags: ProductFlag[] }) {
  if (!flags.length) return null;
  return (
    <View style={styles.flagStrip}>
      <Text style={styles.sectionTitle}>At a glance</Text>
      <View style={styles.flagList}>
        {flags.map((flag) => {
          const color = toneColor(flag.tone);
          return (
            <View
              key={flag.id}
              style={[styles.flagChip, { backgroundColor: toneDim(flag.tone) }]}
            >
              <View style={[styles.flagAccent, { backgroundColor: color }]} />
              <View style={styles.flagCopy}>
                <Text style={styles.flagLabel}>{flag.label}</Text>
                <Text style={styles.flagDetail}>{flag.detail}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const SUGAR_RE =
  /\b(high[\s-]?fructose[\s-]?corn[\s-]?syrup|glucose[\s-]?fructose|corn syrup|glucose syrup|invert sugar|invert syrup|cane sugar|brown sugar|icing sugar|powdered sugar|caramel syrup|molasses|treacle|dextrose|maltose|sucrose|fructose|glucose|sugars?|agave)\b/gi;

function HighlightedIngredients({
  text,
  highlight,
  sources,
}: {
  text: string;
  highlight: boolean;
  sources: string[];
}) {
  if (!highlight) {
    return <Text style={styles.body}>{text}</Text>;
  }

  const extra = sources
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean);
  const combined =
    extra.length > 0
      ? new RegExp(`(${SUGAR_RE.source}|${extra.join('|')})`, 'gi')
      : SUGAR_RE;

  const parts: { t: string; hot: boolean }[] = [];
  let last = 0;
  const re = new RegExp(combined.source, combined.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: text.slice(last, m.index), hot: false });
    parts.push({ t: m[0], hot: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ t: text.slice(last), hot: false });
  if (parts.length === 0) parts.push({ t: text, hot: false });

  return (
    <Text style={styles.body}>
      {parts.map((p, i) =>
        p.hot ? (
          <Text key={i} style={styles.sugarHit}>
            {p.t}
          </Text>
        ) : (
          <Text key={i}>{p.t}</Text>
        )
      )}
    </Text>
  );
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: FlagTone | null;
  hint?: string;
}) {
  const color = tone && tone !== 'neutral' ? toneColor(tone) : undefined;
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: color ?? colors.silverBright }]}>{value}</Text>
      {hint ? (
        <Text style={styles.metricHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    maxHeight: '88%',
    width: '100%',
  },
  sheet: {
    maxHeight: '100%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: 'rgba(12,12,15,0.92)',
  },
  dragZone: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabber: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.steel,
  },
  loading: {
    paddingVertical: 64,
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    fontFamily: font.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  scroll: { maxHeight: '100%' },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  brand: {
    fontFamily: font.bodySemi,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  name: {
    fontFamily: font.display,
    fontSize: 20,
    letterSpacing: 0.2,
    color: colors.textPrimary,
  },
  barcode: {
    fontFamily: font.bodyReg,
    fontSize: 12,
    color: colors.textTertiary,
  },
  verdictCard: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  watchAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    backgroundColor: colors.dangerDim,
  },
  watchAlertText: {
    flex: 1,
    fontFamily: font.bodySemi,
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  utilityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  verdictTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  ratingPill: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ratingValue: {
    fontFamily: font.displayBold,
    fontSize: 16,
    letterSpacing: 0.4,
  },
  verdictTitle: {
    fontFamily: font.displayBold,
    fontSize: 26,
  },
  verdictPrompt: {
    fontFamily: font.bodySemi,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  verdictHint: {
    fontFamily: font.bodyReg,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  metrics: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
  },
  metricLabel: {
    fontFamily: font.bodySemi,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontFamily: font.display,
    fontSize: 22,
  },
  metricHint: {
    fontFamily: font.bodyReg,
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  flagStrip: { gap: 10 },
  flagList: { gap: 8 },
  flagChip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  flagAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  flagCopy: { flex: 1, gap: 2, paddingVertical: 0 },
  flagLabel: {
    fontFamily: font.bodySemi,
    fontSize: 13,
    letterSpacing: 0.2,
    color: colors.textPrimary,
  },
  flagDetail: {
    fontFamily: font.bodyReg,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  sugarCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    backgroundColor: colors.dangerDim,
    marginBottom: 4,
  },
  sugarCalloutText: {
    flex: 1,
    fontFamily: font.bodySemi,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  sugarHit: {
    color: colors.textPrimary,
    fontFamily: font.bodySemi,
    backgroundColor: 'rgba(224,138,146,0.22)',
  },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: font.bodySemi,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  bullet: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  body: {
    fontFamily: font.bodyReg,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  proteinBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
    backgroundColor: colors.successDim,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  proteinBannerText: {
    fontFamily: font.bodySemi,
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
  },
  macroTable: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  macroHeaderText: {
    fontFamily: font.bodySemi,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  macroCellLabel: { flex: 1.4, paddingRight: 8 },
  macroCellValue: { flex: 0.9, textAlign: 'right' as const },
  macroCellFlag: { flex: 0.7, textAlign: 'right' as const },
  macroName: {
    fontFamily: font.bodySemi,
    fontSize: 13,
    color: colors.textPrimary,
  },
  macroNote: {
    fontFamily: font.bodyReg,
    fontSize: 11,
    marginTop: 2,
  },
  macroAmount: {
    fontFamily: font.displayMed,
    fontSize: 14,
  },
  macroFlag: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  macroFoot: {
    fontFamily: font.bodyReg,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textTertiary,
  },
  chartTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.cardHi,
    marginTop: 4,
  },
  chartSegment: {
    height: '100%',
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.textSecondary,
  },
  ingGroup: {
    marginTop: 6,
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  ingGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  ingGroupMark: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ingGroupTitle: {
    flex: 1,
    fontFamily: font.bodySemi,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  ingGroupCount: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    color: colors.textTertiary,
  },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  ingCopy: {
    flex: 1,
    gap: 2,
  },
  ingName: {
    fontFamily: font.bodySemi,
    fontSize: 14,
    color: colors.textPrimary,
  },
  ingNote: {
    fontFamily: font.bodyReg,
    fontSize: 12,
    color: colors.textTertiary,
  },
  attrib: {
    fontFamily: font.bodyReg,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});
