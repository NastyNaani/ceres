import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../../components/AppBackground';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { PressableScale } from '../../components/PressableScale';
import { ProductResultSheet } from '../../components/ProductResultSheet';
import { ScoreBadge } from '../../components/ScoreBadge';
import { SearchBar } from '../../components/SearchBar';
import { SwipeRow } from '../../components/SwipeRow';
import { FoodProduct, lookupFood, type Verdict, verdictLabel } from '../../lib/food';
import { HistoryItem, removeHistory, toggleFavorite, useHistory } from '../../lib/history';
import { relativeTime } from '../../lib/time';
import { colors, font, radius, spacing } from '../../theme';

type Filter = 'all' | 'favorites' | 'upf' | 'cleaner' | 'okay' | 'concerns';

const PRIMARY_FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'favorites', label: '★' },
  { id: 'cleaner', label: 'Cleaner' },
  { id: 'okay', label: 'Okay' },
  { id: 'concerns', label: 'Concerns' },
  { id: 'upf', label: 'UPF' },
];

const CLEANER: Verdict[] = ['elite', 'excellent', 'good'];
const CONCERNS: Verdict[] = ['poor', 'worst', 'abysmal'];

function matchesFilter(item: HistoryItem, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'favorites') return !!item.favorite;
  if (filter === 'upf') return item.nova === 4;
  if (filter === 'cleaner') return CLEANER.includes(item.verdict);
  if (filter === 'okay') return item.verdict === 'ok';
  if (filter === 'concerns') return CONCERNS.includes(item.verdict);
  return true;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { items } = useHistory();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [active, setActive] = useState<FoodProduct | null>(null);
  const [loading, setLoading] = useState(false);

  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparePair, setComparePair] = useState<[FoodProduct, FoodProduct] | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!matchesFilter(item, filter)) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.brand?.toLowerCase().includes(q) ?? false) ||
        item.barcode.includes(q)
      );
    });
  }, [items, query, filter]);

  const selectedItems = useMemo(
    () => selectedIds.map((id) => items.find((i) => i.id === id)).filter(Boolean) as HistoryItem[],
    [selectedIds, items]
  );

  const openItem = async (item: HistoryItem) => {
    if (compareMode) {
      toggleSelect(item.id);
      return;
    }
    setLoading(true);
    setActive(null);
    try {
      setActive(await lookupFood(item.barcode));
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1]!, id];
      return [...prev, id];
    });
  };

  const exitCompareMode = () => {
    setCompareMode(false);
    setSelectedIds([]);
  };

  const runCompare = async () => {
    if (selectedItems.length !== 2) return;
    setCompareLoading(true);
    try {
      const [a, b] = await Promise.all([
        lookupFood(selectedItems[0]!.barcode),
        lookupFood(selectedItems[1]!.barcode),
      ]);
      setComparePair([a, b]);
      exitCompareMode();
    } catch {
      Alert.alert('Compare failed', 'Could not load one of the products. Try again.');
    } finally {
      setCompareLoading(false);
    }
  };

  const activeFilterLabel =
    PRIMARY_FILTERS.find((f) => f.id === filter)?.label ?? 'All';

  return (
    <AppBackground>
      <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerPad}>
          <PageHeader
            kicker="CERES"
            title="History"
            subtitle={`${items.length} product${items.length === 1 ? '' : 's'}`}
            right={
              <PressableScale
                onPress={() => {
                  if (compareMode) exitCompareMode();
                  else {
                    setCompareMode(true);
                    setSelectedIds([]);
                  }
                }}
                style={[styles.headerBtn, compareMode && styles.headerBtnOn]}
                accessibilityRole="button"
                accessibilityLabel={compareMode ? 'Cancel compare' : 'Compare products'}
              >
                <Icon
                  name={compareMode ? 'close' : 'flip'}
                  size={18}
                  color={compareMode ? colors.silverBright : colors.silver}
                />
              </PressableScale>
            }
          />
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search products" />

          <Pressable
            onPress={() => setFiltersOpen((v) => !v)}
            style={styles.filterToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: filtersOpen }}
          >
            <Text style={styles.filterToggleLabel}>Filter · {activeFilterLabel}</Text>
            <View style={{ transform: [{ rotate: filtersOpen ? '90deg' : '0deg' }] }}>
              <Icon name="chevron" size={16} color={colors.textTertiary} />
            </View>
          </Pressable>

          {filtersOpen ? (
            <View style={styles.chipsWrap}>
              {PRIMARY_FILTERS.map((f) => {
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
            </View>
          ) : null}

          {compareMode ? (
            <Text style={styles.compareHint}>
              Select 2 products to compare ({selectedIds.length}/2)
            </Text>
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
              paddingBottom: insets.bottom + (compareMode ? 180 : 120),
              gap: 10,
            }}
            renderItem={({ item }) => {
              const selected = selectedIds.includes(item.id);
              const selectIndex = selectedIds.indexOf(item.id);
              return (
                <SwipeRow
                  disabled={compareMode}
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
                    onLongPress={() => {
                      if (!compareMode) toggleFavorite(item.id);
                    }}
                    style={[styles.row, selected && styles.rowSelected]}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${verdictLabel(item.verdict, item.rating)}`}
                  >
                    {compareMode ? (
                      <View style={[styles.selectMark, selected && styles.selectMarkOn]}>
                        {selected ? (
                          <Text style={styles.selectNum}>{selectIndex + 1}</Text>
                        ) : null}
                      </View>
                    ) : null}
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
              );
            }}
          />
        )}
      </View>

      {compareMode && selectedIds.length > 0 ? (
        <View style={[styles.compareBar, { paddingBottom: Math.max(insets.bottom, 12) + 72 }]}>
          <View style={styles.compareBarInner}>
            <Text style={styles.compareBarText} numberOfLines={1}>
              {selectedItems.map((i) => i.name).join('  ·  ')}
            </Text>
            <PressableScale
              onPress={runCompare}
              disabled={selectedIds.length !== 2 || compareLoading}
              style={[
                styles.compareGo,
                selectedIds.length !== 2 && styles.compareGoDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Compare selected products"
            >
              {compareLoading ? (
                <ActivityIndicator color={colors.void} />
              ) : (
                <Text style={styles.compareGoText}>
                  {selectedIds.length === 2 ? 'Compare' : 'Pick 2'}
                </Text>
              )}
            </PressableScale>
          </View>
        </View>
      ) : null}

      <ProductResultSheet
        product={active}
        loading={loading}
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

      {comparePair ? (
        <CompareModal
          a={comparePair[0]}
          b={comparePair[1]}
          onClose={() => setComparePair(null)}
        />
      ) : null}
    </AppBackground>
  );
}

function CompareModal({
  a,
  b,
  onClose,
}: {
  a: FoodProduct;
  b: FoodProduct;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.modalGrab} />
          <Text style={styles.compareTitle}>Compare</Text>
          <View style={styles.compareRow}>
            <CompareCol product={a} />
            <View style={styles.compareDivider} />
            <CompareCol product={b} />
          </View>
          <PressableScale onPress={onClose} style={styles.compareClose} accessibilityRole="button">
            <Text style={styles.compareCloseText}>Done</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

function CompareCol({ product }: { product: FoodProduct }) {
  const sugar = product.hasAddedSugar;
  const upf = product.nova === 4;
  return (
    <View style={styles.compareCol}>
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={styles.compareThumb} />
      ) : (
        <View style={[styles.compareThumb, styles.thumbFallback]}>
          <Icon name="barcode" size={18} color={colors.silverDim} />
        </View>
      )}
      <Text style={styles.compareName} numberOfLines={2}>
        {product.name}
      </Text>
      {product.brand ? <Text style={styles.compareBrand}>{product.brand}</Text> : null}
      <ScoreBadge verdict={product.verdict} rating={product.rating} />
      <Text style={styles.compareMeta}>{formatRatingSafe(product)}</Text>
      <Text style={styles.compareMeta}>
        Nutri {product.nutriscore?.toUpperCase() ?? '—'}
      </Text>
      <Text style={styles.compareMeta}>NOVA {product.nova ?? '—'}</Text>
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
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
  },
  headerBtnOn: {
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  filterToggleLabel: {
    flex: 1,
    fontFamily: font.bodySemi,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
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
  rowSelected: {
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  selectMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.silverDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectMarkOn: {
    borderColor: colors.silverBright,
    backgroundColor: colors.silverBright,
  },
  selectNum: {
    fontFamily: font.bodyBold,
    fontSize: 12,
    color: colors.void,
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
  compareBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
  },
  compareBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(12,12,15,0.94)',
  },
  compareBarText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  compareGo: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.silverBright,
    minWidth: 88,
    alignItems: 'center',
  },
  compareGoDisabled: {
    opacity: 0.45,
  },
  compareGoText: {
    fontFamily: font.bodyBold,
    fontSize: 13,
    color: colors.void,
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: 'rgba(12,12,15,0.97)',
    paddingHorizontal: spacing.xl,
    paddingTop: 10,
    gap: 14,
  },
  modalGrab: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.steel,
    marginBottom: 4,
  },
  compareTitle: {
    fontFamily: font.display,
    fontSize: 18,
    color: colors.textPrimary,
  },
  compareRow: { flexDirection: 'row', gap: 12 },
  compareCol: { flex: 1, gap: 8 },
  compareDivider: {
    width: 1,
    backgroundColor: colors.hairline,
  },
  compareThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.elevated,
  },
  compareName: {
    fontFamily: font.bodySemi,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 36,
  },
  compareBrand: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  compareMeta: {
    fontFamily: font.bodyReg,
    fontSize: 12,
    color: colors.textSecondary,
  },
  compareFlag: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    color: colors.danger,
  },
  compareClose: {
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  compareCloseText: {
    fontFamily: font.bodySemi,
    fontSize: 14,
    color: colors.silver,
  },
});
