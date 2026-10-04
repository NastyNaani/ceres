/**
 * USDA FoodData Central parsing helpers (server-safe, no secrets).
 * Used by the /api/usda route; never call FDC from the client with a key.
 */

export type UsdaHit = {
  name: string;
  brand: string | null;
  ingredients: string | null;
  category: string | null;
  /** Open Food Facts–style nutriment keys with `_100g` suffix. */
  nutriments: Record<string, number>;
};

type UsdaNutrient = {
  nutrientId?: number;
  value?: number;
  amount?: number;
};

export type UsdaFood = {
  description?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  ingredients?: string;
  foodCategory?: string;
  foodNutrients?: UsdaNutrient[];
};

export function normalizeUpc(code: string): string {
  return code.replace(/\D/g, '').replace(/^0+/, '') || '0';
}

export function isValidBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code.trim());
}

export function upcMatches(gtin: string | undefined, barcode: string): boolean {
  if (!gtin) return false;
  return normalizeUpc(gtin) === normalizeUpc(barcode);
}

/** Map common FDC nutrient IDs → OFF-style keys. */
const NUTRIENT_MAP: Record<number, { key: string; toGrams?: boolean }> = {
  1008: { key: 'energy-kcal' },
  1003: { key: 'proteins' },
  1005: { key: 'carbohydrates' },
  2000: { key: 'sugars' },
  1004: { key: 'fat' },
  1258: { key: 'saturated-fat' },
  1079: { key: 'fiber' },
  1093: { key: 'sodium', toGrams: true }, // mg → g
};

export function nutrimentsFromUsda(food: UsdaFood): Record<string, number> {
  // FDC search `value` for branded foods is already normalized per 100 g.
  const out: Record<string, number> = {};
  const list = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];

  for (const n of list) {
    const id = typeof n.nutrientId === 'number' ? n.nutrientId : null;
    if (id === null) continue;
    const spec = NUTRIENT_MAP[id];
    if (!spec) continue;
    const raw = typeof n.value === 'number' ? n.value : typeof n.amount === 'number' ? n.amount : null;
    if (raw === null || !Number.isFinite(raw)) continue;
    let v = raw;
    if (spec.toGrams) v = v / 1000;
    out[`${spec.key}_100g`] = v;
  }

  if (typeof out.sodium_100g === 'number' && out.salt_100g === undefined) {
    out.salt_100g = out.sodium_100g * 2.5;
  }

  return out;
}

export function hitFromUsdaFood(food: UsdaFood): UsdaHit {
  const name =
    (typeof food.description === 'string' && food.description.trim()) ||
    (typeof food.brandName === 'string' && food.brandName.trim()) ||
    'Unknown product';
  const brand =
    (typeof food.brandName === 'string' && food.brandName.trim()) ||
    (typeof food.brandOwner === 'string' && food.brandOwner.trim()) ||
    null;
  const ingredients =
    typeof food.ingredients === 'string' && food.ingredients.trim()
      ? food.ingredients.trim()
      : null;
  const category =
    typeof food.foodCategory === 'string' && food.foodCategory.trim()
      ? food.foodCategory.trim()
      : null;

  return {
    name,
    brand,
    ingredients,
    category,
    nutriments: nutrimentsFromUsda(food),
  };
}
