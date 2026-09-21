import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import { SearchBar } from '../../components/SearchBar';
import { SwipeRow } from '../../components/SwipeRow';
import { FoodProduct, lookupFood, type Verdict, verdictLabel } from '../../lib/food';
import { HistoryItem, removeHistory, toggleFavorite, useHistory } from '../../lib/history';
import { relativeTime } from '../../lib/time';
import { colors, font, radius, spacing } from '../../theme';

type Filter = 'all' | 'favorites' | 'upf' | Verdict;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'favorites', label: '★' },
  { id: 'upf', label: 'UPF' },
  { id: 'elite', label: 'Elite' },
  { id: 'excellent', label: 'Excellent' },
  { id: 'good', label: 'Good' },
  { id: 'ok', label: 'Okay' },
  { id: 'poor', label: 'Poor' },
  { id: 'worst', label: 'Worst' },
  { id: 'abysmal', label: 'Abysmal' },
];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { items } = useHistory();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [active, setActive] = useState<FoodProduct | null>(null);
  const [compare, setCompare] = useState<FoodProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickCompare, setPickCompare] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === 'favorites' && !item.favorite) return false;
      if (filter === 'upf' && item.nova !== 4) return false;
      if (
        filter !== 'all' &&
        filter !== 'favorites' &&
        filter !== 'upf' &&
        item.verdict !== filter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.brand?.toLowerCase().includes(q) ?? false) ||
        item.barcode.includes(q)
      );
    });
  }, [items, query, filter]);

  const openItem = async (item: HistoryItem) => {
    setLoading(true);
    if (pickCompare) {
      setCompare(null);
    } else {
      setActive(null);
    }
    try {
      const product = await lookupFood(item.barcode);
      if (pickCompare) {
        setCompare(product);
        setPickCompare(false);
      } else {
        setActive(product);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackground>
      <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerPad}>
          <PageHeader
            kicker="CERES"
            title="History"
            subtitle={`${items.length} product${items.length === 1 ? '' : 's'}`}
            right={
              <Pressable
                onPress={() => {
                  setPickCompare(true);
                  setCompare(null);
                  Alert.alert(
                    'Compare products',
                    'Tap any product to load it as the comparison side. Then open another product to see both.'
                  );
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Compare products"
              >
                <Icon name="plus" size={22} color={pickCompare ? colors.silverBright : colors.silverDim} />
              </Pressable>
            }
          />
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search products" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map((f) => {
              const on = filter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {pickCompare ? (
            <Text style={styles.compareHint}>Compare mode — pick a product</Text>
          ) : null}
        </View>

        {filtered.length === 0 ? (
          <EmptyState
            icon="barcode"
            title={items.length === 0 ? 'No products yet' : 'No matches'}
            body={
              items.length === 0
                ? 'Scan a food barcode and it will appear here — private, on this device.'
                : 'Try a different search or clear filters.'
            }
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: spacing.xl,
              paddingBottom: insets.bottom + 120,
              gap: 10,
            }}
            renderItem={({ item }) => (
              <SwipeRow
                onDelete={() => {
                  Alert.alert('Remove product?', item.name, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => removeHistory(item.id),
                    },
                  ]);
                }}
              >
                <Pressable
                  onPress={() => openItem(item)}
                  onLongPress={() => toggleFavorite(item.id)}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${verdictLabel(item.verdict, item.rating)}`}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbFallback]}>
                      <Icon name="barcode" size={20} color={colors.silverDim} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    {item.brand ? <Text style={styles.brand}>{item.brand}</Text> : null}
                    <Text style={styles.name} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.meta}>{relativeTime(item.createdAt)}</Text>
                  </View>
                  <ScoreBadge verdict={item.verdict} rating={item.rating} />
                </Pressable>
              </SwipeRow>
            )}
          />
        )}
      </View>

      <ProductResultSheet
        product={active}
        loading={loading && !pickCompare}
        onClose={() => {
          setActive(null);
          setLoading(false);
        }}
        onRescan={() => {
          setActive(null);
          setLoading(false);
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

      {compare && active ? (
        <CompareOverlay
          a={active}
          b={compare}
          onClose={() => setCompare(null)}
          bottom={insets.bottom}
        />
      ) : null}
    </AppBackground>
  );
}

function CompareOverlay({
  a,
  b,
  onClose,
  bottom,
}: {
  a: FoodProduct;
  b: FoodProduct;
  onClose: () => void;
  bottom: number;
}) {
  return (
    <View style={[styles.compareCard, { bottom: bottom + 100 }]} pointerEvents="box-none">
      <View style={styles.compareInner}>
        <Text style={styles.compareTitle}>Compare</Text>
        <View style={styles.compareRow}>
          <CompareCol product={a} />
          <View style={styles.compareDivider} />
          <CompareCol product={b} />
        </View>
        <Pressable onPress={onClose} style={styles.compareClose} accessibilityRole="button">
          <Text style={styles.compareCloseText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CompareCol({ product }: { product: FoodProduct }) {
  const sugar = product.hasAddedSugar;
  const upf = product.nova === 4;
  return (
    <View style={styles.compareCol}>
      <Text style={styles.compareName} numberOfLines={2}>
        {product.name}
      </Text>
      <ScoreBadge verdict={product.verdict} rating={product.rating} />
      <Text style={styles.compareMeta}>{formatRatingSafe(product)}</Text>
      <Text style={styles.compareMeta}>
        Nutri {product.nutriscore?.toUpperCase() ?? '—'} · NOVA {product.nova ?? '—'}
      </Text>
      <Text style={styles.compareMeta}>
        {product.ingredientCount > 0 ? `${product.ingredientCount} ingredients` : 'Ingredients —'}
      </Text>
      <Text style={styles.compareMeta}>Additives {product.additivesCount ?? '—'}</Text>
      {upf ? <Text style={styles.compareFlag}>Ultra-processed</Text> : null}
      {sugar ? <Text style={styles.compareFlag}>Added sugar</Text> : null}
    </View>
  );
}

function formatRatingSafe(p: FoodProduct) {
  if (p.rating === null) return '—/10';
  return `${p.rating}/10`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerPad: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
  },
  chipOn: {
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipText: {
    fontFamily: font.bodySemi,
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipTextOn: { color: colors.silverBright },
  compareHint: {
    fontFamily: font.body,
    fontSize: 12,
    color: colors.caution,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.elevated,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  name: {
    fontFamily: font.bodySemi,
    fontSize: 15,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: font.bodyReg,
    fontSize: 12,
    color: colors.textTertiary,
  },
  compareCard: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
  },
  compareInner: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(12,12,15,0.96)',
    padding: spacing.lg,
    gap: 12,
  },
  compareTitle: {
    fontFamily: font.display,
    fontSize: 16,
    color: colors.textPrimary,
  },
  compareRow: { flexDirection: 'row', gap: 10 },
  compareCol: { flex: 1, gap: 8 },
  compareDivider: {
    width: 1,
    backgroundColor: colors.hairline,
  },
  compareName: {
    fontFamily: font.bodySemi,
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 36,
  },
  compareMeta: {
    fontFamily: font.bodyReg,
    fontSize: 11,
    color: colors.textSecondary,
  },
  compareFlag: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    color: colors.danger,
  },
  compareClose: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  compareCloseText: {
    fontFamily: font.bodySemi,
    fontSize: 13,
    color: colors.silver,
  },
});
