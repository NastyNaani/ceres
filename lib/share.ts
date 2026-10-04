import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';
import type { FoodProduct } from './food';
import { formatRating, verdictLabel } from './food';

/** Deep link that opens this product in Ceres. */
export function productDeepLink(barcode: string): string {
  return Linking.createURL(`product/${encodeURIComponent(barcode.trim())}`);
}

/** Formatted share card — no Open Food Facts URLs (those steal the preview). */
export function formatShareMessage(product: FoodProduct): string {
  const title = product.brand
    ? `${product.name}\n${product.brand}`
    : product.name;
  const scoreLine = `Ceres · ${verdictLabel(product.verdict, product.rating)} · ${formatRating(product.rating)}`;

  const metrics: string[] = [];
  if (product.nutriscore) metrics.push(`Nutri-Score ${product.nutriscore.toUpperCase()}`);
  if (product.nova) metrics.push(`NOVA ${product.nova}`);
  if (product.ingredientCount > 0) metrics.push(`${product.ingredientCount} ingredients`);
  if (product.hasAddedSugar) metrics.push('Added sugar');

  const flags = product.flags
    .filter((f) => f.tone === 'danger' || f.tone === 'caution')
    .slice(0, 4)
    .map((f) => f.label);

  const link = productDeepLink(product.barcode);

  const blocks = [
    '✦  CERES',
    title,
    '',
    scoreLine,
    metrics.length ? metrics.join('  ·  ') : null,
    flags.length ? flags.join('  ·  ') : null,
    '',
    `Open in Ceres\n${link}`,
  ];

  return blocks.filter((line) => line !== null).join('\n');
}

export async function shareProduct(product: FoodProduct): Promise<void> {
  const message = formatShareMessage(product);
  const url = productDeepLink(product.barcode);
  try {
    if (Platform.OS === 'ios') {
      await Share.share({ message, url });
    } else {
      await Share.share({ message });
    }
  } catch {
    // User dismissed the sheet — ignore.
  }
}
