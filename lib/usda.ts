/**
 * Client USDA lookup — calls our server proxy only.
 * The USDA API key never lives in the app bundle.
 */

import type { UsdaHit } from './usdaFdc';
import { isValidBarcode } from './usdaFdc';

export type { UsdaHit };

async function withTimeout<T>(ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await work(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Look up a branded food by barcode via the Ceres /api/usda proxy.
 * Returns null when no exact match (or proxy unavailable).
 */
export async function lookupUsdaBarcode(
  barcode: string,
  timeoutMs = 8000
): Promise<UsdaHit | null> {
  const code = barcode.trim();
  if (!isValidBarcode(code)) return null;

  try {
    return await withTimeout(timeoutMs, async (signal) => {
      const res = await fetch(`/api/usda?barcode=${encodeURIComponent(code)}`, {
        signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { hit?: UsdaHit | null };
      return json.hit ?? null;
    });
  } catch {
    return null;
  }
}
