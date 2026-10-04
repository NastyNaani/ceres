/**
 * Server-only USDA FoodData Central proxy.
 * The API key stays in process.env.USDA_API_KEY and never ships in the app bundle.
 */

import {
  hitFromUsdaFood,
  isValidBarcode,
  upcMatches,
  type UsdaFood,
  type UsdaHit,
} from '../../lib/usdaFdc';

const FDC_SEARCH = 'https://api.nal.usda.gov/fdc/v1/foods/search';

/** Simple per-isolate rate limit (best-effort on edge). */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 40;
const hits = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'anon'
  );
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || now >= row.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  row.count += 1;
  return row.count > RATE_MAX;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(request: Request) {
  if (rateLimited(clientKey(request))) {
    return json({ error: 'Too many requests' }, 429);
  }

  const barcode = new URL(request.url).searchParams.get('barcode')?.trim() ?? '';
  if (!isValidBarcode(barcode)) {
    return json({ error: 'Invalid barcode' }, 400);
  }

  const apiKey = process.env.USDA_API_KEY?.trim();
  if (!apiKey) {
    return json({ error: 'USDA lookup is not configured' }, 503);
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      query: barcode,
      dataType: 'Branded',
      pageSize: '25',
    });
    const res = await fetch(`${FDC_SEARCH}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return json({ error: 'Upstream USDA error' }, 502);
    }

    const body = (await res.json()) as { foods?: UsdaFood[] };
    const foods = Array.isArray(body.foods) ? body.foods : [];
    const match = foods.find((f) => upcMatches(f.gtinUpc, barcode));
    const hit: UsdaHit | null = match ? hitFromUsdaFood(match) : null;
    return json({ hit });
  } catch {
    return json({ error: 'USDA lookup failed' }, 502);
  }
}
