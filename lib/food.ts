/**
 * Product lookup + transparent score.
 * Primary: Open Food Facts (Nutri-Score, NOVA, additives).
 * Fallback: USDA FoodData Central when OFF misses or returns sparse data.
 * Grades combine those signals with a local ingredient read — not a black-box AI score.
 */

import { analyzeIngredients, type IngredientAnalysis } from './ingredients';
import { buildProductFlags, countIngredients, detectAddedSugar, type ProductFlag } from './flags';
import { emptyNutrition, parseNutrition, type NutritionFacts } from './nutrition';
import { lookupUsdaBarcode } from './usda';

export type Verdict =
  | 'elite'
  | 'excellent'
  | 'good'
  | 'ok'
  | 'poor'
  | 'worst'
  | 'abysmal'
  | 'unknown';

export type NutriGrade = 'a' | 'b' | 'c' | 'd' | 'e';

export type FoodProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  nutriscore: NutriGrade | null;
  nova: 1 | 2 | 3 | 4 | null;
  additivesCount: number | null;
  additives: string[];
  ingredients: string | null;
  /** Parsed ingredient token count from the label. */
  ingredientCount: number;
  hasAddedSugar: boolean;
  addedSugarSources: string[];
  allergens: string[];
  /** Human-readable category labels (e.g. "chocolate cookies"). */
  categories: string[];
  /** Raw Open Food Facts category tags (e.g. "en:chocolate-cookies") for search. */
  categoryTags: string[];
  verdict: Verdict;
  /** Composite shelf score used internally. */
  score: number;
  /**
   * Fun overall rating out of 10.
   * Scale: −1, then 1…11 (no zero). Elite can hit 11; floor is a soft −1.
   * Null when unknown.
   */
  rating: number | null;
  reasons: string[];
  flags: ProductFlag[];
  ingredientAnalysis: IngredientAnalysis;
  nutrition: NutritionFacts;
  found: boolean;
};

const FIELDS = [
  'product_name',
  'brands',
  'image_front_small_url',
  'image_url',
  'nutriscore_grade',
  'nova_group',
  'additives_n',
  'additives_tags',
  'ingredients_text',
  'ingredients_n',
  'ingredients_analysis_tags',
  'allergens_tags',
  'categories_tags',
  'nutriments',
].join(',');

const EMPTY_ANALYSIS: IngredientAnalysis = {
  items: [],
  good: [],
  caution: [],
  bad: [],
  neutral: [],
  signal: 0,
  summary: 'No ingredient details to grade.',
};

async function withTimeout<T>(ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await work(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function parseNutri(raw: unknown): NutriGrade | null {
  if (typeof raw !== 'string') return null;
  const g = raw.trim().toLowerCase();
  if (g === 'a' || g === 'b' || g === 'c' || g === 'd' || g === 'e') return g;
  return null;
}

function parseNova(raw: unknown): 1 | 2 | 3 | 4 | null {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return null;
}

function cleanTags(tags: unknown, prefix: string): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.replace(new RegExp(`^${prefix}:`, 'i'), '').replace(/-/g, ' '))
    .filter(Boolean)
    .slice(0, 24);
}

/** Keep taxonomy tags like `en:chocolate-cookies` for API filters. */
function rawCategoryTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((t): t is string => typeof t === 'string' && t.includes(':'))
    .slice(0, 12);
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickPrompt(seed: string, prompts: string[]): string {
  if (prompts.length === 0) return '';
  return prompts[hashSeed(seed) % prompts.length]!;
}

/** Combine Nutri-Score + NOVA + additives + ingredient/macro signals into a shelf verdict. */
export function scoreProduct(input: {
  nutriscore: NutriGrade | null;
  nova: 1 | 2 | 3 | 4 | null;
  additivesCount: number | null;
  ingredientSignal?: number;
  badIngredientCount?: number;
  macroSignal?: number;
}): { verdict: Verdict; reasons: string[]; score: number } {
  const reasons: string[] = [];
  let score = 0;
  let signals = 0;

  if (input.nutriscore) {
    signals += 1;
    const map: Record<NutriGrade, number> = { a: 2, b: 1, c: 0, d: -1, e: -2 };
    score += map[input.nutriscore];
    reasons.push(`Nutri-Score ${input.nutriscore.toUpperCase()}`);
  }

  if (input.nova) {
    signals += 1;
    const map: Record<1 | 2 | 3 | 4, number> = { 1: 2, 2: 1, 3: -1, 4: -2 };
    score += map[input.nova];
    const labels: Record<1 | 2 | 3 | 4, string> = {
      1: 'unprocessed / minimally processed',
      2: 'culinary ingredients',
      3: 'processed food',
      4: 'ultra-processed',
    };
    reasons.push(`NOVA ${input.nova} — ${labels[input.nova]}`);
  }

  if (typeof input.additivesCount === 'number' && input.additivesCount > 0) {
    signals += 1;
    if (input.additivesCount >= 8) {
      score -= 2;
      reasons.push(`${input.additivesCount} additives listed`);
    } else if (input.additivesCount >= 5) {
      score -= 1;
      reasons.push(`${input.additivesCount} additives listed`);
    } else {
      reasons.push(`${input.additivesCount} additive${input.additivesCount === 1 ? '' : 's'} listed`);
    }
  }

  if (typeof input.ingredientSignal === 'number' && input.ingredientSignal !== 0) {
    signals += 1;
    score += input.ingredientSignal;
    const bad = input.badIngredientCount ?? 0;
    if (bad > 0) {
      reasons.push(
        `${bad} concern ingredient${bad === 1 ? '' : 's'} flagged on the label`
      );
    } else if (input.ingredientSignal > 0) {
      reasons.push('Ingredient list leans toward recognizable whole foods');
    }
  }

  if (typeof input.macroSignal === 'number' && input.macroSignal !== 0) {
    signals += 1;
    score += input.macroSignal;
  }

  if (signals === 0) {
    return {
      verdict: 'unknown',
      reasons: ['Not enough Open Food Facts data to score this product.'],
      score: 0,
    };
  }

  let verdict: Verdict;
  if (score >= 5) verdict = 'elite';
  else if (score >= 3.5) verdict = 'excellent';
  else if (score >= 2) verdict = 'good';
  else if (score >= 0) verdict = 'ok';
  else if (score >= -2) verdict = 'poor';
  else if (score >= -4) verdict = 'worst';
  else verdict = 'abysmal';

  return { verdict, reasons, score };
}

/**
 * Map composite score → flashy /10 rating.
 * Scale: −1, then 1…11 (skips 0). Elite: 11/10. Floor: soft −1 only.
 */
export function overallRating(score: number, verdict: Verdict): number | null {
  if (verdict === 'unknown') return null;

  // Typical composite spans roughly −6…+7
  let rating = Math.round(score * 1.35 + 4);

  if (verdict === 'elite') return 11;
  if (verdict === 'excellent') return Math.max(9, Math.min(10, rating));
  if (verdict === 'good') return Math.max(7, Math.min(8, rating));
  if (verdict === 'ok') return Math.max(5, Math.min(6, rating));
  if (verdict === 'poor') return Math.max(3, Math.min(4, rating));
  if (verdict === 'worst') return Math.max(1, Math.min(2, rating === 0 ? 1 : rating));
  // abysmal — single soft floor, no deep negatives
  return -1;
}

export function formatRating(rating: number | null): string {
  if (rating === null) return '—/10';
  return `${rating}/10`;
}

export function verdictLabel(v: Verdict, rating?: number | null): string {
  if (typeof rating === 'number' && rating < 0) return 'Rough';
  switch (v) {
    case 'elite':
      return 'Elite';
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'ok':
      return 'Okay';
    case 'poor':
      return 'Weak';
    case 'worst':
      return 'Skip';
    case 'abysmal':
      return 'Rough';
    default:
      return 'Unknown';
  }
}

const PROMPTS: Record<Exclude<Verdict, 'unknown'>, string[]> = {
  elite: [
    'Shelf royalty. Put it in the cart before someone else does.',
    'This is what “clean label” wishes it looked like.',
    'Rare air. Your future self just high-fived you.',
    'If groceries had a dress code, this one showed up in black tie.',
    '11/10 energy. The barcode practically apologized for being this good.',
    'Chef’s kiss. The aisle just got classier.',
  ],
  excellent: [
    'Quietly impressive. No drama, just solid food.',
    'This is the kind of label you can actually read without squinting.',
    'Strong pick — the pantry equivalent of a firm handshake.',
    'You’re shopping like someone who means it.',
    'Almost elite. Still the kind of thing you’d brag about casually.',
  ],
  good: [
    'Looks solid. No need to overthink this one.',
    'A respectable citizen of the grocery aisle.',
    'Good enough to buy without the guilt spiral.',
    'Clean-ish, honest-ish, cart-worthy.',
    'Not perfect. Still better than 80% of this shelf.',
  ],
  ok: [
    'Fine in moderation — not a villain, not a hero.',
    'The culinary equivalent of “it’s complicated.”',
    'You could do better. You could also do worse.',
    'Weeknight food. Not a hill to die on.',
    'Meh with a barcode. Take it or leave it.',
  ],
  poor: [
    'Not your strongest pick — a better swap is probably nearby.',
    'A bit weak on the label. Worth a second look at the shelf.',
    'Okay as an occasional treat, not a daily staple.',
    'You can do a little better without trying hard.',
    'Fine in a pinch. Not what I’d reach for first.',
  ],
  worst: [
    'I’d skip this one if there’s an easy alternative.',
    'Heavy on the processing — check for a simpler option.',
    'Not a great everyday pick. Save it for rare cravings.',
    'The label’s doing a lot. Your cart can aim higher.',
    'Pass for now — better options usually sit one shelf over.',
  ],
  abysmal: [
    'Rough score. A softer pass unless you really want it.',
    'Not a great match for everyday eating — swap if you can.',
    'The aisle whispered “maybe not.” Listen if you want.',
    'Hard to recommend. Treat-only territory.',
    'A soft no from Ceres — your call at the checkout.',
  ],
};

/** Short factual hint under the verdict title. */
export function verdictHint(v: Verdict, _rating?: number | null): string {
  switch (v) {
    case 'elite':
      return 'Top-tier Nutri-Score, light processing, and a clean ingredient read.';
    case 'excellent':
      return 'Strong nutrition and processing signals with a friendly label.';
    case 'good':
      return 'Looks solid based on Nutri-Score, processing, and ingredients.';
    case 'ok':
      return 'Mixed signals — fine in moderation, better options may exist.';
    case 'poor':
      return 'Weaker nutrition and/or heavier processing. A swap may feel better.';
    case 'worst':
      return 'Processing and concern ingredients stack up — better picks are likely nearby.';
    case 'abysmal':
      return 'Multiple weak signals across score, processing, and ingredients.';
    default:
      return 'Ceres could not grade this barcode from available product data.';
  }
}

/** Fun, deterministic one-liner for the verdict card. */
export function verdictPrompt(v: Verdict, seed = 'ceres', _rating?: number | null): string {
  if (v === 'unknown') {
    return pickPrompt(seed, [
      'Ghost product — no solid match in our databases yet.',
      'No grade yet. The barcode knows something we don’t.',
      'Data’s out to lunch. Try another scan in a moment.',
    ]);
  }
  return pickPrompt(seed, PROMPTS[v]);
}

export const VERDICT_ORDER: Verdict[] = [
  'elite',
  'excellent',
  'good',
  'ok',
  'poor',
  'worst',
  'abysmal',
  'unknown',
];

export function isVerdict(value: unknown): value is Verdict {
  return (
    value === 'elite' ||
    value === 'excellent' ||
    value === 'good' ||
    value === 'ok' ||
    value === 'poor' ||
    value === 'worst' ||
    value === 'abysmal' ||
    value === 'unknown'
  );
}

function emptyProduct(barcode: string, found: boolean): FoodProduct {
  return {
    barcode,
    name: found ? 'Unknown product' : 'Product not found',
    brand: null,
    imageUrl: null,
    nutriscore: null,
    nova: null,
    additivesCount: null,
    additives: [],
    ingredients: null,
    ingredientCount: 0,
    hasAddedSugar: false,
    addedSugarSources: [],
    allergens: [],
    categories: [],
    categoryTags: [],
    verdict: 'unknown',
    score: 0,
    rating: null,
    reasons: found
      ? ['Product exists but has little scoring data.']
      : ['No match in Open Food Facts or USDA for this barcode.'],
    flags: [],
    ingredientAnalysis: EMPTY_ANALYSIS,
    nutrition: emptyNutrition(),
    found,
  };
}

function macroSignalFromNutrition(nutrition: NutritionFacts): number {
  if (!nutrition.available) return 0;
  let macroSignal = 0;
  for (const row of nutrition.rows) {
    if (row.flag === 'high') macroSignal -= 0.6;
    else if (row.flag === 'elevated') macroSignal -= 0.25;
    else if (row.flag === 'good') macroSignal += 0.35;
  }
  if (nutrition.hasProtein && (nutrition.proteinGrams ?? 0) >= 10) {
    macroSignal += 0.15;
  }
  return Math.max(-2, Math.min(1.5, macroSignal));
}

function appendScoreDetails(
  reasons: string[],
  input: {
    nutrition: NutritionFacts;
    sugarHit: { present: boolean; sources: string[] };
    ingredientCount: number;
    nova: 1 | 2 | 3 | 4 | null;
  }
) {
  if (input.nutrition.hasProtein && input.nutrition.proteinGrams != null) {
    reasons.push(
      `Protein ${input.nutrition.proteinGrams >= 10 ? 'present' : 'detected'} — ${input.nutrition.proteinGrams.toFixed(1)} g / 100 g`
    );
  }
  if (input.nutrition.overLimitCount > 0) {
    reasons.push(
      `${input.nutrition.overLimitCount} macro${input.nutrition.overLimitCount === 1 ? '' : 's'} above preferred limits`
    );
  }
  if (input.sugarHit.present) {
    reasons.push(
      input.sugarHit.sources.length
        ? `Added sugar on the label (${input.sugarHit.sources.slice(0, 2).join(', ')})`
        : 'Added sugar flagged on the label'
    );
  }
  if (input.ingredientCount >= 15) {
    reasons.push(`${input.ingredientCount} ingredients listed — long label`);
  } else if (input.ingredientCount > 0 && input.ingredientCount <= 5) {
    reasons.push(`Short label — ${input.ingredientCount} ingredients`);
  }
  if (input.nova === 4 && !reasons.some((r) => /NOVA 4/i.test(r))) {
    reasons.push('NOVA 4 — ultra-processed');
  }
}

function productFromUsda(code: string, hit: Awaited<ReturnType<typeof lookupUsdaBarcode>>): FoodProduct | null {
  if (!hit) return null;

  const ingredients = hit.ingredients;
  const nutrition = parseNutrition(hit.nutriments);
  const ingredientAnalysis = analyzeIngredients(ingredients, []);
  const sugarHit = detectAddedSugar(ingredients, []);
  const ingredientCount = countIngredients(ingredients);
  const categories = hit.category ? [hit.category] : [];

  const { verdict, reasons, score } = scoreProduct({
    nutriscore: null,
    nova: null,
    additivesCount: null,
    ingredientSignal: ingredientAnalysis.signal,
    badIngredientCount: ingredientAnalysis.bad.length,
    macroSignal: macroSignalFromNutrition(nutrition),
  });

  reasons.unshift('Matched via USDA FoodData Central (Open Food Facts had no usable hit).');
  appendScoreDetails(reasons, { nutrition, sugarHit, ingredientCount, nova: null });

  const rating = overallRating(score, verdict);
  const product: FoodProduct = {
    barcode: code,
    name: hit.name,
    brand: hit.brand,
    imageUrl: null,
    nutriscore: null,
    nova: null,
    additivesCount: null,
    additives: [],
    ingredients,
    ingredientCount,
    hasAddedSugar: sugarHit.present,
    addedSugarSources: sugarHit.sources,
    allergens: [],
    categories,
    categoryTags: [],
    verdict,
    score,
    rating,
    reasons,
    flags: [],
    ingredientAnalysis,
    nutrition,
    found: true,
  };
  product.flags = buildProductFlags(product);
  return product;
}

type OffLookup =
  | { ok: true; product: FoodProduct }
  | { ok: false; kind: 'not_found' | 'network' };

async function lookupOpenFoodFacts(code: string, timeoutMs: number): Promise<OffLookup> {
  try {
    const product = await withTimeout(timeoutMs, async (signal) => {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
        {
          signal,
          headers: {
            // OFF asks clients to identify themselves.
            'User-Agent': 'Ceres/1.0 (food score app; local-dev)',
          },
        }
      );
      const json = await res.json();
      if (json?.status !== 1 || !json.product) {
        return null;
      }

      const p = json.product;
      const name =
        (typeof p.product_name === 'string' && p.product_name.trim()) ||
        (typeof p.brands === 'string' && p.brands.trim()) ||
        'Unknown product';
      const brand =
        typeof p.brands === 'string' ? p.brands.split(',')[0]?.trim() || null : null;
      const imageUrl =
        (typeof p.image_front_small_url === 'string' && p.image_front_small_url) ||
        (typeof p.image_url === 'string' && p.image_url) ||
        null;
      const nutriscore = parseNutri(p.nutriscore_grade);
      const nova = parseNova(p.nova_group);
      const additivesCount = typeof p.additives_n === 'number' ? p.additives_n : null;
      const additives = cleanTags(p.additives_tags, 'en');
      const ingredients =
        typeof p.ingredients_text === 'string' && p.ingredients_text.trim()
          ? p.ingredients_text.trim()
          : null;
      const allergens = cleanTags(p.allergens_tags, 'en');
      const categoryTags = rawCategoryTags(p.categories_tags);
      const categories = cleanTags(p.categories_tags, 'en').slice(0, 6);
      const nutrition = parseNutrition(p.nutriments);
      const ingredientAnalysis = analyzeIngredients(ingredients, additives);
      const analysisTags = Array.isArray(p.ingredients_analysis_tags)
        ? p.ingredients_analysis_tags.filter((t: unknown): t is string => typeof t === 'string')
        : [];
      const sugarHit = detectAddedSugar(ingredients, analysisTags);
      const fromApiCount =
        typeof p.ingredients_n === 'number' && p.ingredients_n > 0 ? p.ingredients_n : 0;
      const ingredientCount = Math.max(fromApiCount, countIngredients(ingredients));

      const { verdict, reasons, score } = scoreProduct({
        nutriscore,
        nova,
        additivesCount,
        ingredientSignal: ingredientAnalysis.signal,
        badIngredientCount: ingredientAnalysis.bad.length,
        macroSignal: macroSignalFromNutrition(nutrition),
      });

      appendScoreDetails(reasons, { nutrition, sugarHit, ingredientCount, nova });
      const rating = overallRating(score, verdict);

      const built: FoodProduct = {
        barcode: code,
        name,
        brand,
        imageUrl,
        nutriscore,
        nova,
        additivesCount,
        additives,
        ingredients,
        ingredientCount,
        hasAddedSugar: sugarHit.present,
        addedSugarSources: sugarHit.sources,
        allergens,
        categories,
        categoryTags,
        verdict,
        score,
        rating,
        reasons,
        flags: [],
        ingredientAnalysis,
        nutrition,
        found: true,
      };
      built.flags = buildProductFlags(built);
      return built;
    });

    if (!product) return { ok: false, kind: 'not_found' };
    return { ok: true, product };
  } catch {
    return { ok: false, kind: 'network' };
  }
}

function needsUsdaFallback(result: OffLookup): boolean {
  if (!result.ok) return true;
  // Sparse OFF hit — try USDA for nutrition/ingredients before giving up.
  return result.product.verdict === 'unknown';
}

export async function lookupFood(barcode: string, timeoutMs = 8000): Promise<FoodProduct> {
  const code = barcode.trim();
  if (!code) return emptyProduct(barcode, false);

  let off = await lookupOpenFoodFacts(code, timeoutMs);

  // First-scan flakiness is often a timeout/abort — retry OFF once.
  if (!off.ok && off.kind === 'network') {
    off = await lookupOpenFoodFacts(code, timeoutMs);
  }

  if (off.ok && !needsUsdaFallback(off)) {
    return off.product;
  }

  const usda = productFromUsda(code, await lookupUsdaBarcode(code, timeoutMs));
  if (usda) return usda;

  if (off.ok) return off.product;

  if (off.kind === 'network') {
    return {
      ...emptyProduct(code, false),
      name: 'Lookup failed',
      reasons: ['Could not reach product databases. Check your connection and try again.'],
    };
  }

  return emptyProduct(code, false);
}

export type AlternativeProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  nutriscore: NutriGrade | null;
  nova: 1 | 2 | 3 | 4 | null;
  verdict: Verdict;
  rating: number | null;
  score: number;
};

const ALT_FIELDS = [
  'code',
  'product_name',
  'brands',
  'image_front_small_url',
  'image_url',
  'nutriscore_grade',
  'nova_group',
  'additives_n',
].join(',');

function nutriRank(g: NutriGrade | null): number {
  if (!g) return 3;
  return { a: 0, b: 1, c: 2, d: 3, e: 4 }[g];
}

function isHealthierThan(candidate: AlternativeProduct, baseline: FoodProduct): boolean {
  if (baseline.rating != null && candidate.rating != null && candidate.rating > baseline.rating) {
    return true;
  }
  if (candidate.score > baseline.score) return true;
  // Nutri-Score alone (A better than E) — search hits lack full ingredient/macro signals.
  if (
    candidate.nutriscore &&
    baseline.nutriscore &&
    nutriRank(candidate.nutriscore) < nutriRank(baseline.nutriscore)
  ) {
    return true;
  }
  if (baseline.nova === 4 && candidate.nova != null && candidate.nova <= 2) return true;
  return false;
}

function categoryDepth(tag: string): number {
  return tag
    .replace(/^[^:]+:/i, '')
    .split('-')
    .filter(Boolean).length;
}

/**
 * Prefer mid-level categories (e.g. en:crackers) over ultra-specific leaves
 * like en:salty-snacks-crackers-garnished-with-cheese, which rarely have healthier peers.
 */
function pickCategoryCandidates(tags: string[]): string[] {
  const en = tags.filter((t) => /^en:/i.test(t));
  const pool = en.length ? en : tags;
  const ranked = pool.map((t) => {
    const depth = categoryDepth(t);
    let rank = 0;
    if (depth >= 2 && depth <= 3) rank = 100 - depth;
    else if (depth === 4) rank = 55;
    else if (depth === 1) rank = 25;
    else rank = 15;
    return { t, rank, depth };
  });
  ranked.sort((a, b) => b.rank - a.rank || a.depth - b.depth);
  const out: string[] = [];
  for (const row of ranked) {
    if (!out.includes(row.t)) out.push(row.t);
    if (out.length >= 3) break;
  }
  return out;
}

function scoreSearchHit(raw: Record<string, unknown>): AlternativeProduct | null {
  const code =
    (typeof raw.code === 'string' && raw.code) ||
    (typeof raw._id === 'string' && raw._id) ||
    '';
  if (!code) return null;

  const name =
    (typeof raw.product_name === 'string' && raw.product_name.trim()) ||
    (typeof raw.brands === 'string' && raw.brands.trim()) ||
    'Unknown product';
  const brand =
    typeof raw.brands === 'string' ? raw.brands.split(',')[0]?.trim() || null : null;
  const imageUrl =
    (typeof raw.image_front_small_url === 'string' && raw.image_front_small_url) ||
    (typeof raw.image_url === 'string' && raw.image_url) ||
    null;
  const nutriscore = parseNutri(raw.nutriscore_grade);
  const nova = parseNova(raw.nova_group);
  const additivesCount = typeof raw.additives_n === 'number' ? raw.additives_n : null;
  const { verdict, score } = scoreProduct({ nutriscore, nova, additivesCount });
  const rating = overallRating(score, verdict);

  return {
    barcode: code,
    name,
    brand,
    imageUrl,
    nutriscore,
    nova,
    verdict,
    rating,
    score,
  };
}

/** Cap search payload + UI list so we stay light on OFF search quotas (10/min/IP). */
const ALT_PAGE_SIZE = 15;
const ALT_LIMIT = 3;
const ALT_CACHE_TTL_MS = 30 * 60 * 1000;
const ALT_CACHE_VERSION = 2;

type AltCacheEntry = {
  category: string | null;
  items: AlternativeProduct[];
  at: number;
  version: number;
};

const altCache = new Map<string, AltCacheEntry>();

function labelForTag(tag: string): string {
  return tag.replace(/^[^:]+:/i, '').replace(/-/g, ' ');
}

async function searchCategory(
  tag: string,
  product: FoodProduct,
  signal: AbortSignal
): Promise<AlternativeProduct[]> {
  const params = new URLSearchParams({
    categories_tags: tag,
    fields: ALT_FIELDS,
    page_size: String(ALT_PAGE_SIZE),
    sort_by: 'nutriscore_score',
  });

  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/search?${params.toString()}`,
    {
      signal,
      headers: {
        'User-Agent': 'Ceres/1.0 (food score app; local-dev)',
        Accept: 'application/json',
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Search failed (${res.status})`);
  }
  const json = await res.json();
  const products = Array.isArray(json?.products) ? json.products : [];
  const seen = new Set<string>([product.barcode]);
  const scored: AlternativeProduct[] = [];

  for (const raw of products) {
    if (!raw || typeof raw !== 'object') continue;
    const hit = scoreSearchHit(raw as Record<string, unknown>);
    if (!hit || seen.has(hit.barcode)) continue;
    seen.add(hit.barcode);
    if (!isHealthierThan(hit, product)) continue;
    scored.push(hit);
  }

  scored.sort((a, b) => {
    const ra = a.rating ?? a.score;
    const rb = b.rating ?? b.score;
    if (rb !== ra) return rb - ra;
    return nutriRank(a.nutriscore) - nutriRank(b.nutriscore);
  });
  return scored;
}

/**
 * Healthier products in the same Open Food Facts category (better Ceres score / Nutri-Score).
 * Successful results are cached per barcode for 30 minutes. Empty/failed lookups are not cached.
 */
export async function findBetterAlternatives(
  product: FoodProduct,
  timeoutMs = 10000
): Promise<{ category: string | null; items: AlternativeProduct[]; error?: string }> {
  const cached = altCache.get(product.barcode);
  if (
    cached &&
    cached.version === ALT_CACHE_VERSION &&
    Date.now() - cached.at < ALT_CACHE_TTL_MS &&
    cached.items.length > 0
  ) {
    return { category: cached.category, items: cached.items };
  }

  const candidates = pickCategoryCandidates(product.categoryTags);
  if (!candidates.length) {
    return { category: null, items: [] };
  }

  try {
    return await withTimeout(timeoutMs, async (signal) => {
      let bestCategory = candidates[0]!;
      let bestItems: AlternativeProduct[] = [];
      let lastError: string | undefined;

      // Mid-level category first, then one broader fallback (max 2 searches).
      for (const tag of candidates.slice(0, 2)) {
        try {
          const hits = await searchCategory(tag, product, signal);
          if (hits.length > bestItems.length) {
            bestItems = hits;
            bestCategory = tag;
          }
          if (bestItems.length >= ALT_LIMIT) break;
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'Search failed';
        }
      }

      const items = bestItems.slice(0, ALT_LIMIT);
      const category = labelForTag(bestCategory);
      if (items.length > 0) {
        altCache.set(product.barcode, {
          category,
          items,
          at: Date.now(),
          version: ALT_CACHE_VERSION,
        });
        return { category, items };
      }
      return {
        category,
        items: [],
        error: lastError,
      };
    });
  } catch {
    return {
      category: labelForTag(candidates[0]!),
      items: [],
      error: 'Could not reach Open Food Facts',
    };
  }
}

