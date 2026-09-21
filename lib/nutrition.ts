/**
 * Per-100g nutrition facts from Open Food Facts + traffic-light style flags.
 * Limits roughly follow UK FOP thresholds for solids; protein/fibre “good” bands
 * are positive highlights, not medical advice.
 */

export type MacroFlag = 'high' | 'elevated' | 'ok' | 'good' | 'low' | 'none';

export type MacroRow = {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  /** Display string e.g. "12.4 g" or "—" */
  display: string;
  flag: MacroFlag;
  /** Short reason when flagged high / elevated / good */
  note: string | null;
};

export type NutritionFacts = {
  per: '100g';
  rows: MacroRow[];
  hasProtein: boolean;
  proteinGrams: number | null;
  overLimitCount: number;
  available: boolean;
};

function num(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pick100g(n: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = num(n[`${key}_100g`] ?? n[key]);
    if (v !== null) return v;
  }
  return null;
}

function fmt(value: number | null, unit: string, digits = 1): string {
  if (value === null) return '—';
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Number(value.toFixed(digits));
  return `${rounded} ${unit}`;
}

type LimitSpec = {
  id: string;
  label: string;
  keys: string[];
  unit: string;
  /** Above this → high (red) */
  high?: number;
  /** Above this → elevated (amber) */
  elevated?: number;
  /** At/above this → good (green) — for protein/fibre */
  goodAt?: number;
  /** Prefer higher is better */
  positive?: boolean;
  digits?: number;
  highNote?: string;
  elevatedNote?: string;
  goodNote?: string;
};

const SPECS: LimitSpec[] = [
  {
    id: 'energy',
    label: 'Energy',
    keys: ['energy-kcal', 'energy-kcal_value'],
    unit: 'kcal',
    elevated: 400,
    high: 550,
    digits: 0,
    elevatedNote: 'Calorie-dense for 100 g',
    highNote: 'Very calorie-dense',
  },
  {
    id: 'protein',
    label: 'Protein',
    keys: ['proteins'],
    unit: 'g',
    goodAt: 10,
    positive: true,
    goodNote: 'Solid protein for 100 g',
  },
  {
    id: 'carbs',
    label: 'Carbs',
    keys: ['carbohydrates'],
    unit: 'g',
    elevated: 45,
    high: 70,
    elevatedNote: 'Carb-heavy',
    highNote: 'Very high carbs',
  },
  {
    id: 'sugars',
    label: 'Sugars',
    keys: ['sugars'],
    unit: 'g',
    elevated: 5,
    high: 22.5,
    elevatedNote: 'Above low-sugar band',
    highNote: 'High sugar (traffic-light red)',
  },
  {
    id: 'glucose',
    label: 'Glucose',
    keys: ['glucose'],
    unit: 'g',
    elevated: 5,
    high: 15,
    elevatedNote: 'Notable glucose',
    highNote: 'High glucose',
  },
  {
    id: 'fibre',
    label: 'Fibre',
    keys: ['fiber', 'fibre'],
    unit: 'g',
    goodAt: 6,
    positive: true,
    goodNote: 'Good fibre source',
  },
  {
    id: 'fat',
    label: 'Fat',
    keys: ['fat'],
    unit: 'g',
    elevated: 3,
    high: 17.5,
    elevatedNote: 'Above low-fat band',
    highNote: 'High fat (traffic-light red)',
  },
  {
    id: 'satFat',
    label: 'Saturated fat',
    keys: ['saturated-fat'],
    unit: 'g',
    elevated: 1.5,
    high: 5,
    elevatedNote: 'Above low sat-fat band',
    highNote: 'High saturated fat',
  },
  {
    id: 'salt',
    label: 'Salt',
    keys: ['salt'],
    unit: 'g',
    elevated: 0.3,
    high: 1.5,
    elevatedNote: 'Above low-salt band',
    highNote: 'High salt (traffic-light red)',
  },
  {
    id: 'sodium',
    label: 'Sodium',
    keys: ['sodium'],
    unit: 'g',
    elevated: 0.12,
    high: 0.6,
    elevatedNote: 'Above low-sodium band',
    highNote: 'High sodium',
  },
];

function flagFor(spec: LimitSpec, value: number | null): { flag: MacroFlag; note: string | null } {
  if (value === null) return { flag: 'none', note: null };

  if (spec.positive && spec.goodAt !== undefined && value >= spec.goodAt) {
    return { flag: 'good', note: spec.goodNote ?? null };
  }

  if (spec.high !== undefined && value > spec.high) {
    return { flag: 'high', note: spec.highNote ?? 'Above recommended band' };
  }
  if (spec.elevated !== undefined && value > spec.elevated) {
    return { flag: 'elevated', note: spec.elevatedNote ?? 'Worth watching' };
  }

  if (spec.positive) {
    if (value > 0) return { flag: 'ok', note: null };
    return { flag: 'low', note: 'Little to none' };
  }

  return { flag: 'ok', note: null };
}

export function parseNutrition(raw: unknown): NutritionFacts {
  const empty: NutritionFacts = {
    per: '100g',
    rows: [],
    hasProtein: false,
    proteinGrams: null,
    overLimitCount: 0,
    available: false,
  };

  if (!raw || typeof raw !== 'object') return empty;
  const n = raw as Record<string, unknown>;

  const rows: MacroRow[] = [];
  for (const spec of SPECS) {
    const value = pick100g(n, spec.keys);
    // Skip glucose entirely when OFF has no value — rare field.
    if (value === null && spec.id === 'glucose') continue;

    const { flag, note } = flagFor(spec, value);
    rows.push({
      id: spec.id,
      label: spec.label,
      value,
      unit: spec.unit,
      display: fmt(value, spec.unit, spec.digits ?? 1),
      flag,
      note,
    });
  }

  const protein = rows.find((r) => r.id === 'protein');
  const proteinGrams = protein?.value ?? null;
  const hasProtein = typeof proteinGrams === 'number' && proteinGrams >= 0.5;
  const overLimitCount = rows.filter((r) => r.flag === 'high' || r.flag === 'elevated').length;
  const available = rows.some((r) => r.value !== null);

  return {
    per: '100g',
    rows: available ? rows : [],
    hasProtein,
    proteinGrams,
    overLimitCount,
    available,
  };
}

export function emptyNutrition(): NutritionFacts {
  return {
    per: '100g',
    rows: [],
    hasProtein: false,
    proteinGrams: null,
    overLimitCount: 0,
    available: false,
  };
}
