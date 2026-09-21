/**
 * Shelf callouts derived from Nutri-Score, NOVA, macros, and the ingredient list.
 */

import { parseIngredientList } from './ingredients';
import type { NutriGrade } from './food';
import type { NutritionFacts } from './nutrition';
import type { IngredientAnalysis } from './ingredients';

export type FlagTone = 'danger' | 'caution' | 'success' | 'neutral';

export type ProductFlag = {
  id: string;
  label: string;
  detail: string;
  tone: FlagTone;
};

/** Minimal product shape for flag builders — avoids circular imports with food.ts. */
export type FlagSource = {
  nutriscore: NutriGrade | null;
  nova: 1 | 2 | 3 | 4 | null;
  additivesCount: number | null;
  ingredientCount: number;
  hasAddedSugar: boolean;
  addedSugarSources: string[];
  nutrition: NutritionFacts;
  ingredientAnalysis: IngredientAnalysis;
};

const ADDED_SUGAR_MARKERS = [
  'sugar',
  'sugars',
  'glucose',
  'fructose',
  'sucrose',
  'dextrose',
  'maltose',
  'corn syrup',
  'high fructose',
  'hfcs',
  'glucose syrup',
  'glucose-fructose',
  'invert sugar',
  'invert syrup',
  'cane sugar',
  'brown sugar',
  'icing sugar',
  'powdered sugar',
  'caramel syrup',
  'agave',
  'molasses',
  'treacle',
];

export function countIngredients(text: string | null | undefined): number {
  return parseIngredientList(text).length;
}

export function detectAddedSugar(
  ingredientsText: string | null | undefined,
  analysisTags: string[] = []
): { present: boolean; sources: string[] } {
  const fromTags = analysisTags.some((t) => /with-added-sugar|added-sugar/i.test(t));
  const sources: string[] = [];
  const parts = parseIngredientList(ingredientsText);
  for (const part of parts) {
    const n = part.toLowerCase();
    if (ADDED_SUGAR_MARKERS.some((m) => n.includes(m))) {
      sources.push(part);
    }
  }
  const uniq = [...new Set(sources)].slice(0, 6);
  return { present: fromTags || uniq.length > 0, sources: uniq };
}

function satFatRow(nutrition: NutritionFacts) {
  return nutrition.rows.find((r) => r.id === 'satFat') ?? null;
}

function sugarsRow(nutrition: NutritionFacts) {
  return nutrition.rows.find((r) => r.id === 'sugars') ?? null;
}

export function buildProductFlags(product: FlagSource): ProductFlag[] {
  const flags: ProductFlag[] = [];

  if (product.nova === 4) {
    flags.push({
      id: 'upf',
      label: 'Ultra-processed',
      detail: 'NOVA 4 — industrial formulation, not a simple food.',
      tone: 'danger',
    });
  } else if (product.nova === 3) {
    flags.push({
      id: 'processed',
      label: 'Processed',
      detail: 'NOVA 3 — processed food. Fine sometimes, not a staple.',
      tone: 'caution',
    });
  } else if (product.nova === 1 || product.nova === 2) {
    flags.push({
      id: 'minimally',
      label: product.nova === 1 ? 'Minimally processed' : 'Culinary ingredient',
      detail: `NOVA ${product.nova} — closer to real food.`,
      tone: 'success',
    });
  }

  if (product.nutriscore === 'd' || product.nutriscore === 'e') {
    flags.push({
      id: 'low-nutri',
      label: `Low Nutri-Score ${product.nutriscore.toUpperCase()}`,
      detail: 'Weaker nutrition profile for this category.',
      tone: 'danger',
    });
  } else if (product.nutriscore === 'c') {
    flags.push({
      id: 'mid-nutri',
      label: 'Nutri-Score C',
      detail: 'Middle of the pack — better options often exist.',
      tone: 'caution',
    });
  } else if (product.nutriscore === 'a' || product.nutriscore === 'b') {
    flags.push({
      id: 'high-nutri',
      label: `Nutri-Score ${product.nutriscore.toUpperCase()}`,
      detail: 'Stronger nutrition signal when available.',
      tone: 'success',
    });
  }

  const sat = satFatRow(product.nutrition);
  if (sat && (sat.flag === 'high' || sat.flag === 'elevated')) {
    flags.push({
      id: 'sat-fat',
      label: sat.flag === 'high' ? 'High saturated fat' : 'Elevated saturated fat',
      detail: `${sat.display} / 100 g — ${sat.note ?? 'above preferred band'}.`,
      tone: sat.flag === 'high' ? 'danger' : 'caution',
    });
  }

  const sugarMacro = sugarsRow(product.nutrition);
  if (product.hasAddedSugar) {
    const src =
      product.addedSugarSources.length > 0
        ? product.addedSugarSources.slice(0, 3).join(', ')
        : 'listed on the label';
    flags.push({
      id: 'added-sugar',
      label: 'Added sugar',
      detail: `Found in ingredients: ${src}.`,
      tone: 'danger',
    });
  } else if (sugarMacro && (sugarMacro.flag === 'high' || sugarMacro.flag === 'elevated')) {
    flags.push({
      id: 'high-sugar',
      label: sugarMacro.flag === 'high' ? 'High sugars' : 'Elevated sugars',
      detail: `${sugarMacro.display} / 100 g.`,
      tone: sugarMacro.flag === 'high' ? 'danger' : 'caution',
    });
  }

  if (product.ingredientCount > 0) {
    const many = product.ingredientCount >= 15;
    const mid = product.ingredientCount >= 8;
    flags.push({
      id: 'ingredient-count',
      label: `${product.ingredientCount} ingredients`,
      detail: many
        ? 'Long label — often a ultra-processing signal.'
        : mid
          ? 'Moderate list length.'
          : 'Short list — easier to understand.',
      tone: many ? 'caution' : 'neutral',
    });
  }

  if (typeof product.additivesCount === 'number' && product.additivesCount >= 5) {
    flags.push({
      id: 'additives',
      label: `${product.additivesCount} additives`,
      detail: 'Heavy additive load on the label.',
      tone: product.additivesCount >= 8 ? 'danger' : 'caution',
    });
  }

  return flags;
}

export function nutriHighlight(grade: NutriGrade | null): FlagTone | null {
  if (!grade) return null;
  if (grade === 'd' || grade === 'e') return 'danger';
  if (grade === 'c') return 'caution';
  if (grade === 'a' || grade === 'b') return 'success';
  return null;
}

export function novaHighlight(nova: 1 | 2 | 3 | 4 | null): FlagTone | null {
  if (!nova) return null;
  if (nova === 4) return 'danger';
  if (nova === 3) return 'caution';
  return 'success';
}

export function toneColor(tone: FlagTone): string {
  switch (tone) {
    case 'danger':
      return '#E08A92';
    case 'caution':
      return '#D6B474';
    case 'success':
      return '#7BD4A8';
    default:
      return '#A7ABB4';
  }
}

export function toneDim(tone: FlagTone): string {
  switch (tone) {
    case 'danger':
      return 'rgba(224,138,146,0.14)';
    case 'caution':
      return 'rgba(214,180,116,0.14)';
    case 'success':
      return 'rgba(123,212,168,0.14)';
    default:
      return 'rgba(255,255,255,0.04)';
  }
}
