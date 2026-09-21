/**
 * Open Food Facts product lookup + transparent score.
 * Grades combine Nutri-Score, NOVA, additives, and a local ingredient read —
 * not a black-box AI score.
 */

import { analyzeIngredients, type IngredientAnalysis } from './ingredients';
import { buildProductFlags, countIngredients, detectAddedSugar, type ProductFlag } from './flags';
import { emptyNutrition, parseNutrition, type NutritionFacts } from './nutrition';

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
  categories: string[];
  verdict: Verdict;
  /** Composite shelf score used internally. */
  score: number;
  /**
   * Fun overall rating out of 10.
   * Elite can hit 11; abysmal/worst can go negative. Null when unknown.
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
 * Elite: 11/10. Abysmal: always negative. Worst: 0 or below.
 */
export function overallRating(score: number, verdict: Verdict): number | null {
  if (verdict === 'unknown') return null;

  // Typical composite spans roughly −6…+7
  let rating = Math.round(score * 1.35 + 4);

  if (verdict === 'elite') return 11;
  if (verdict === 'excellent') return Math.max(9, Math.min(10, rating));
  if (verdict === 'good') return Math.max(7, Math.min(8, rating));
  if (verdict === 'ok') return Math.max(5, Math.min(6, rating));
  if (verdict === 'poor') return Math.max(2, Math.min(4, rating));
  if (verdict === 'worst') return Math.min(0, Math.max(-4, rating));
  // abysmal — always a punchline negative
  return Math.min(-1, Math.max(-10, rating <= 0 ? rating : -Math.abs(rating) - 1));
}

export function formatRating(rating: number | null): string {
  if (rating === null) return '—/10';
  return `${rating}/10`;
}

/** Punchline labels for 0 and the −1…−10 band so every score sounds distinct. */
const NEGATIVE_LABELS: Record<number, string> = {
  0: 'Bleak',
  [-1]: 'Rough',
  [-2]: 'Dismal',
  [-3]: 'Grim',
  [-4]: 'Rotten',
  [-5]: 'Abysmal',
  [-6]: 'Appalling',
  [-7]: 'Catastrophic',
  [-8]: 'Toxic',
  [-9]: 'Cursed',
  [-10]: 'Nuclear',
};

const NEGATIVE_PROMPTS: Record<number, string[]> = {
  0: [
    'Zero out of ten. The barcode filed for emotional damages.',
    'Not quite negative yet — still a hard pass at the shelf.',
    'This is the culinary equivalent of a participation trophy… that failed.',
  ],
  [-1]: [
    'Barely below zero. The aisle just whispered “maybe not.”',
    'A soft no. Soft like margarine pretending to be butter.',
    'Your cart can do one better. Or twelve.',
  ],
  [-2]: [
    'Dismal vibes only. Put it back before it multiplies.',
    'Two steps into the red and already looking guilty.',
    'I’d rather invent dinner from spices and optimism.',
  ],
  [-3]: [
    'Grim reading. Even the nutrition panel looks tired.',
    'Three below. Your mitochondria just updated their will.',
    'This is how pantry regret starts — slowly, then all at once.',
  ],
  [-4]: [
    'Rotten score, shiny packaging. Classic bait-and-switch.',
    'Four in the hole. The freezer shelf wants nothing to do with this.',
    'If “meh” had a darker cousin, you just met it.',
  ],
  [-5]: [
    'Abysmal. Walk away like the building is on fire.',
    'Halfway to nuclear and somehow still in a grocery store.',
    'Congratulations, you found the middle of the bad barrel.',
  ],
  [-6]: [
    'Appalling. I’d rather chew the receipt.',
    'Six below zero — the snack aisle equivalent of a red flag parade.',
    'This product peaked in a lab meeting, not a kitchen.',
  ],
  [-7]: [
    'Catastrophic. Leave the aisle. Consider leaving the store.',
    'Seven deep. Your future self is already annoyed.',
    'If regret had a barcode, it would scan like this.',
  ],
  [-8]: [
    'Toxic energy, edible format. Hard no from Ceres.',
    'Eight below. Even the barcode looks like it needs a lawyer.',
    'This is what happens when a snack hates you personally.',
  ],
  [-9]: [
    'Cursed. I’d rather lick the freezer shelf.',
    'Nine in the red. Your cart deserves a restraining order.',
    'Not food — a cry for help in a colorful wrapper.',
  ],
  [-10]: [
    'Nuclear. Absolute bottom. Do not engage.',
    'Negative ten. The rating went into debt and took out a loan.',
    'This isn’t a product. It’s a cautionary tale with a lid.',
  ],
};

const NEGATIVE_HINTS: Record<number, string> = {
  0: 'Borderline collapse — processing and nutrition already look rough.',
  [-1]: 'Slightly underwater. Weak score with a few concern signals.',
  [-2]: 'Clearly in the red — processing and/or ingredients drag it down.',
  [-3]: 'Heavy flags stacking: score, processing, or concern ingredients.',
  [-4]: 'Multiple weak signals. Better options almost certainly exist.',
  [-5]: 'Deep in the red across score, processing, and ingredients.',
  [-6]: 'A harsh combo of ultra-processing and concern ingredients.',
  [-7]: 'Near-floor score — red flags dominate the label read.',
  [-8]: 'Extremely weak profile. Treat as a last-resort snack at best.',
  [-9]: 'Almost the bottom. Hard to justify putting this in a cart.',
  [-10]: 'Floor score. Multiple red flags with almost nothing redeeming.',
};

function clampNegativeRating(rating: number): number {
  return Math.max(-10, Math.min(0, Math.round(rating)));
}

export function verdictLabel(v: Verdict, rating?: number | null): string {
  if (typeof rating === 'number' && rating <= 0) {
    const key = clampNegativeRating(rating);
    return NEGATIVE_LABELS[key] ?? (v === 'worst' ? 'Worst' : 'Abysmal');
  }
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
      return 'Poor';
    case 'worst':
      return 'Worst';
    case 'abysmal':
      return 'Abysmal';
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
    'I wouldn’t feed that to my dog. And my dog has low standards.',
    'Your cart deserves better company than this.',
    'Technically edible. Spiritually questionable.',
    'Put it back. Future-you is already annoyed.',
    'This product called. It wants you to have lower standards.',
    'If regret had a flavor, it would taste like this.',
  ],
  worst: [
    'This isn’t food — it’s a chemistry set with branding.',
    'I’d rather chew the receipt.',
    'Hard pass. Even the barcode looks guilty.',
    'If your pantry could talk, it would file a restraining order.',
    'Your mitochondria just requested a transfer.',
    'This belongs in a museum of bad decisions.',
  ],
  abysmal: [
    'Absolutely not. Walk away like the building is on fire.',
    'This product peaked in a lab, not a kitchen.',
    'Congratulations, you found the bottom of the barrel.',
    'Leave it. Then leave the aisle. Then maybe the store.',
    'Negative stars. The rating went into debt for this one.',
    'I’d rather lick the freezer shelf.',
    'This is what happens when a snack hates you personally.',
    'Not food. A cry for help in a colorful wrapper.',
  ],
};

/** Short factual hint under the verdict title. */
export function verdictHint(v: Verdict, rating?: number | null): string {
  if (typeof rating === 'number' && rating <= 0) {
    return NEGATIVE_HINTS[clampNegativeRating(rating)] ?? NEGATIVE_HINTS[-5]!;
  }
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
      return 'Weaker nutrition and/or heavy processing. Check the label.';
    case 'worst':
      return 'Heavy processing and concern ingredients stack up fast.';
    case 'abysmal':
      return 'Multiple red flags across score, processing, and ingredients.';
    default:
      return 'Ceres could not grade this barcode from Open Food Facts.';
  }
}

/** Fun, deterministic one-liner for the verdict card. */
export function verdictPrompt(v: Verdict, seed = 'ceres', rating?: number | null): string {
  if (v === 'unknown') {
    return pickPrompt(seed, [
      'Ghost product — Open Food Facts shrugged.',
      'No grade yet. The barcode knows something we don’t.',
      'Data’s out to lunch. Try another scan.',
    ]);
  }
  if (typeof rating === 'number' && rating <= 0) {
    const key = clampNegativeRating(rating);
    return pickPrompt(`${seed}:${key}`, NEGATIVE_PROMPTS[key] ?? PROMPTS.abysmal);
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
    verdict: 'unknown',
    score: 0,
    rating: null,
    reasons: found
      ? ['Product exists but has little scoring data.']
      : ['No match in Open Food Facts for this barcode.'],
    flags: [],
    ingredientAnalysis: EMPTY_ANALYSIS,
    nutrition: emptyNutrition(),
    found,
  };
}

export async function lookupFood(barcode: string, timeoutMs = 6000): Promise<FoodProduct> {
  const code = barcode.trim();
  if (!code) return emptyProduct(barcode, false);

  try {
    return await withTimeout(timeoutMs, async (signal) => {
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
        return emptyProduct(code, false);
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

      let macroSignal = 0;
      if (nutrition.available) {
        for (const row of nutrition.rows) {
          if (row.flag === 'high') macroSignal -= 0.6;
          else if (row.flag === 'elevated') macroSignal -= 0.25;
          else if (row.flag === 'good') macroSignal += 0.35;
        }
        if (nutrition.hasProtein && (nutrition.proteinGrams ?? 0) >= 10) {
          // Already counted via good flag; tiny extra nudge for clear protein.
          macroSignal += 0.15;
        }
        macroSignal = Math.max(-2, Math.min(1.5, macroSignal));
      }

      const { verdict, reasons, score } = scoreProduct({
        nutriscore,
        nova,
        additivesCount,
        ingredientSignal: ingredientAnalysis.signal,
        badIngredientCount: ingredientAnalysis.bad.length,
        macroSignal,
      });

      if (nutrition.hasProtein && nutrition.proteinGrams != null) {
        reasons.push(
          `Protein ${nutrition.proteinGrams >= 10 ? 'present' : 'detected'} — ${nutrition.proteinGrams.toFixed(1)} g / 100 g`
        );
      }
      if (nutrition.overLimitCount > 0) {
        reasons.push(
          `${nutrition.overLimitCount} macro${nutrition.overLimitCount === 1 ? '' : 's'} above preferred limits`
        );
      }

      const rating = overallRating(score, verdict);

      if (sugarHit.present) {
        reasons.push(
          sugarHit.sources.length
            ? `Added sugar on the label (${sugarHit.sources.slice(0, 2).join(', ')})`
            : 'Added sugar flagged on the label'
        );
      }
      if (ingredientCount >= 15) {
        reasons.push(`${ingredientCount} ingredients listed — long label`);
      } else if (ingredientCount > 0 && ingredientCount <= 5) {
        reasons.push(`Short label — ${ingredientCount} ingredients`);
      }
      if (nova === 4) {
        // Ensure UPF always surfaces in the why list even if NOVA reason already exists.
        if (!reasons.some((r) => /NOVA 4/i.test(r))) {
          reasons.push('NOVA 4 — ultra-processed');
        }
      }

      const product: FoodProduct = {
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
    });
  } catch {
    return {
      ...emptyProduct(code, false),
      name: 'Lookup failed',
      reasons: ['Could not reach Open Food Facts. Check your connection and try again.'],
    };
  }
}
