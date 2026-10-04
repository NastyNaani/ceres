import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AppBackground } from '../../components/AppBackground';
import { GhostButton } from '../../components/Buttons';
import { ProductResultSheet } from '../../components/ProductResultSheet';
import { FoodProduct, lookupFood } from '../../lib/food';
import { toggleFavorite, useHistory } from '../../lib/history';
import { colors, font, spacing } from '../../theme';

/**
 * Opens a product from a Ceres deep link (ceres://product/{barcode}).
 */
export default function ProductDeepLinkScreen() {
  const router = useRouter();
  const history = useHistory();
  const params = useLocalSearchParams<{ barcode: string }>();
  const raw = Array.isArray(params.barcode) ? params.barcode[0] : params.barcode;
  const barcode = (raw ?? '').trim();

  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!barcode) {
      setLoading(false);
      setError('Missing barcode');
      return;
    }
    setLoading(true);
    setError(null);
    lookupFood(barcode)
      .then((result) => {
        if (cancelled) return;
        setProduct(result);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this product.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [barcode]);

  const goHome = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <AppBackground>
      <View style={styles.root}>
        {loading && !product ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.silver} />
            <Text style={styles.hint}>Opening product…</Text>
          </View>
        ) : null}
        {error && !product ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <GhostButton label="Back to scan" icon="scan" onPress={goHome} />
          </View>
        ) : null}
      </View>

      <ProductResultSheet
        product={product}
        loading={loading && !product}
        onClose={goHome}
        onRescan={goHome}
        favorite={product ? !!history.items.find((h) => h.barcode === product.barcode)?.favorite : false}
        onToggleFavorite={
          product
            ? () => {
                const hit = history.items.find((h) => h.barcode === product.barcode);
                if (hit) toggleFavorite(hit.id).catch(() => {});
              }
            : undefined
        }
      />
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  center: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  hint: {
    fontFamily: font.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  error: {
    fontFamily: font.bodySemi,
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
