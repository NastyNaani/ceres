import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../../components/AppBackground';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { ProductResultSheet } from '../../components/ProductResultSheet';
import { ScoreBadge } from '../../components/ScoreBadge';
import {
  AlternativeProduct,
  FoodProduct,
  findBetterAlternatives,
  formatRating,
  lookupFood,
  verdictLabel,
} from '../../lib/food';
import { HistoryItem, toggleFavorite, useHistory } from '../../lib/history';
import { colors, font, radius, spacing } from '../../theme';

type SwapsCacheEntry = {
  baseline: FoodProduct;
  category: string | null;
  items: AlternativeProduct[];
};

export default function SwapsScreen() {
  const insets = useSafeAreaInsets();
  const { items } = useHistory();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<FoodProduct | null>(null);
  const [alts, setAlts] = useState<AlternativeProduct[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [altsError, setAltsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<FoodProduct | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const sessionCache = useRef(new Map<string, SwapsCacheEntry>());
  const requestGen = useRef(0);

  const recent = useMemo(() => items.slice(0, 40), [items]);

  const selected = useMemo(
    () => recent.find((h) => h.id === selectedId) ?? recent[0] ?? null,
    [recent, selectedId]
  );

  useEffect(() => {
    if (!selectedId && recent[0]) setSelectedId(recent[0].id);
  }, [recent, selectedId]);

  const applyEntry = useCallback((entry: SwapsCacheEntry) => {
    setBaseline(entry.baseline);
    setCategory(entry.category);
    setAlts(entry.items);
    setAltsError(null);
  }, []);

  const loadAlternatives = useCallback(
    async (item: HistoryItem) => {
      const cached = sessionCache.current.get(item.barcode);
      if (cached && cached.items.length > 0) {
        applyEntry(cached);
        setLoading(false);
        return;
      }

      const gen = ++requestGen.current;
      setLoading(true);
      setAltsError(null);
      try {
        const product = await lookupFood(item.barcode);
        if (gen !== requestGen.current) return;
        if (!product.found) {
          setBaseline(product);
          setCategory(null);
          setAlts([]);
          return;
        }
        const result = await findBetterAlternatives(product);
        if (gen !== requestGen.current) return;
        const entry: SwapsCacheEntry = {
          baseline: product,
          category: result.category,
          items: result.items,
        };
        // Only session-cache successful swap lists — empty/failed should retry.
        if (result.items.length > 0) {
          sessionCache.current.set(item.barcode, entry);
        }
        applyEntry(entry);
        if (result.items.length === 0 && result.error) {
          setAltsError(result.error);
        }
      } catch {
        if (gen !== requestGen.current) return;
        setAlts([]);
        setAltsError('Could not load alternatives');
      } finally {
        if (gen === requestGen.current) setLoading(false);
      }
    },
    [applyEntry]
  );

  useEffect(() => {
    if (!selected) {
      setBaseline(null);
      setAlts([]);
      setCategory(null);
      setAltsError(null);
      return;
    }
    loadAlternatives(selected).catch(() => {});
  }, [selected?.barcode, loadAlternatives]);

  const openBarcode = async (code: string) => {
    setDetailLoading(true);
    setActive(null);
    try {
      setActive(await lookupFood(code));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <AppBackground>
      <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerPad}>
          <PageHeader
            kicker="CERES"
            title="Swaps"
            subtitle="Healthier picks in the same aisle"
          />
        </View>

        {recent.length === 0 ? (
          <EmptyState
            icon="swap"
            title="Scan something first"
            body="Your recent scans show up here with better options from the same category."
          />
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingBottom: insets.bottom + 120,
              gap: spacing.lg,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.body}>
              <Text style={styles.sectionTitle}>Your scans</Text>
              <FlatList
                horizontal
                data={recent}
                extraData={selected?.id}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scanStrip}
                renderItem={({ item }) => {
                  const on = item.id === selected?.id;
                  return (
                    <Pressable
                      onPress={() => setSelectedId(item.id)}
                      style={[styles.scanCard, on ? styles.scanCardOn : styles.scanCardOff]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      {on ? <View style={styles.scanSelectedMark} /> : null}
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.scanThumb} />
                      ) : (
                        <View style={[styles.scanThumb, styles.thumbFallback]}>
                          <Icon name="barcode" size={18} color={colors.silverDim} />
                        </View>
                      )}
                      <Text
                        style={[styles.scanName, on && styles.scanNameOn]}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      <ScoreBadge verdict={item.verdict} rating={item.rating} />
                    </Pressable>
                  );
                }}
              />

              {selected ? (
                <View style={styles.baseline}>
                  <View style={styles.baselineCopy}>
                    <Text style={styles.baselineKicker}>Looking at</Text>
                    <Text style={styles.baselineName} numberOfLines={2}>
                      {selected.name}
                    </Text>
                    {baseline ? (
                      <Text style={styles.baselineMeta}>
                        {verdictLabel(baseline.verdict, baseline.rating)} ·{' '}
                        {formatRating(baseline.rating)}
                        {category ? ` · ${category}` : ''}
                      </Text>
                    ) : (
                      <Text style={styles.baselineMeta}>
                        {verdictLabel(selected.verdict, selected.rating)}
                      </Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => openBarcode(selected.barcode)}
                    style={styles.baselineOpen}
                    accessibilityRole="button"
                    accessibilityLabel="Open scanned product"
                  >
                    <Icon name="chevron" size={16} color={colors.silver} />
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.altsHeader}>
                <Text style={styles.sectionTitle}>Top alternatives</Text>
                {loading ? <ActivityIndicator color={colors.silverDim} /> : null}
              </View>

              {!loading && alts.length === 0 ? (
                <View style={styles.emptyAlts}>
                  <Icon name="sparkle" size={22} color={colors.silverMid} />
                  <Text style={styles.emptyAltsTitle}>
                    {altsError
                      ? 'Swaps unavailable right now'
                      : baseline && (baseline.rating ?? 0) >= 8
                        ? 'Already a strong pick'
                        : 'No clearer swaps yet'}
                  </Text>
                  <Text style={styles.emptyAltsBody}>
                    {altsError
                      ? 'Open Food Facts search is busy or rate-limited. Try again in a minute.'
                      : baseline && !baseline.categoryTags.length
                        ? 'This product needs a category on Open Food Facts before we can suggest swaps.'
                        : 'Try another scan, or check back when more products are listed in this category.'}
                  </Text>
                </View>
              ) : (
                <View style={styles.altList}>
                  {alts.map((alt) => (
                    <Pressable
                      key={alt.barcode}
                      onPress={() => openBarcode(alt.barcode)}
                      style={styles.altRow}
                      accessibilityRole="button"
                      accessibilityLabel={`${alt.name}, ${verdictLabel(alt.verdict, alt.rating)}`}
                    >
                      {alt.imageUrl ? (
                        <Image source={{ uri: alt.imageUrl }} style={styles.altThumb} />
                      ) : (
                        <View style={[styles.altThumb, styles.thumbFallback]}>
                          <Icon name="sparkle" size={18} color={colors.silverDim} />
                        </View>
                      )}
                      <View style={{ flex: 1, gap: 4 }}>
                        {alt.brand ? <Text style={styles.brand}>{alt.brand}</Text> : null}
                        <Text style={styles.altName} numberOfLines={2}>
                          {alt.name}
                        </Text>
                        <Text style={styles.altMeta}>
                          {[
                            alt.nutriscore ? `Nutri ${alt.nutriscore.toUpperCase()}` : null,
                            alt.nova ? `NOVA ${alt.nova}` : null,
                            formatRating(alt.rating),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      <ScoreBadge verdict={alt.verdict} rating={alt.rating} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>

      <ProductResultSheet
        product={active}
        loading={detailLoading}
        onClose={() => {
          setActive(null);
          setDetailLoading(false);
        }}
        onRescan={() => {
          setActive(null);
          setDetailLoading(false);
        }}
        favorite={active ? !!items.find((h) => h.barcode === active.barcode)?.favorite : false}
        onToggleFavorite={
          active
            ? () => {
                const hit = items.find((h) => h.barcode === active.barcode);
                if (hit) toggleFavorite(hit.id).catch(() => {});
              }
            : undefined
        }
      />
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerPad: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  body: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  sectionTitle: {
    fontFamily: font.bodySemi,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  scanStrip: {
    gap: 10,
    paddingVertical: 2,
  },
  scanCard: {
    width: 124,
    gap: 8,
    padding: 10,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  scanCardOn: {
    borderColor: colors.silverBright,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  scanCardOff: {
    opacity: 0.55,
  },
  scanSelectedMark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.silverBright,
    zIndex: 1,
  },
  scanThumb: {
    width: '100%',
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.elevated,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanName: {
    fontFamily: font.bodySemi,
    fontSize: 12,
    color: colors.textSecondary,
    minHeight: 32,
  },
  scanNameOn: {
    color: colors.textPrimary,
  },
  baseline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderLeftWidth: 3,
    borderLeftColor: colors.silverMid,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  baselineCopy: { flex: 1, gap: 4 },
  baselineKicker: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  baselineName: {
    fontFamily: font.display,
    fontSize: 16,
    color: colors.textPrimary,
  },
  baselineMeta: {
    fontFamily: font.bodyReg,
    fontSize: 12,
    color: colors.textSecondary,
  },
  baselineOpen: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
  },
  altsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  emptyAlts: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
  },
  emptyAltsTitle: {
    fontFamily: font.bodySemi,
    fontSize: 15,
    color: colors.textPrimary,
  },
  emptyAltsBody: {
    fontFamily: font.bodyReg,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  altList: { gap: 10 },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
  },
  altThumb: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.elevated,
  },
  brand: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  altName: {
    fontFamily: font.bodySemi,
    fontSize: 15,
    color: colors.textPrimary,
  },
  altMeta: {
    fontFamily: font.bodyReg,
    fontSize: 12,
    color: colors.textTertiary,
  },
});
