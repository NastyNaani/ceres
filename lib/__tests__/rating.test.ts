import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatRating, overallRating, scoreProduct, verdictLabel } from '../food';
import { isValidBarcode, normalizeUpc, upcMatches } from '../usdaFdc';

describe('overallRating soft scale', () => {
  it('maps elite to 11 and never emits 0', () => {
    assert.equal(overallRating(10, 'elite'), 11);
    for (const v of ['excellent', 'good', 'ok', 'poor', 'worst', 'abysmal'] as const) {
      const r = overallRating(0, v);
      assert.notEqual(r, 0);
    }
  });

  it('floors abysmal at -1 only', () => {
    assert.equal(overallRating(-10, 'abysmal'), -1);
    assert.equal(overallRating(0, 'abysmal'), -1);
  });

  it('keeps worst in 1–2 and poor in 3–4', () => {
    const worst = overallRating(-3, 'worst');
    const poor = overallRating(-1, 'poor');
    assert.ok(worst === 1 || worst === 2);
    assert.ok(poor === 3 || poor === 4);
  });

  it('formats ratings with /10', () => {
    assert.equal(formatRating(11), '11/10');
    assert.equal(formatRating(-1), '-1/10');
    assert.equal(formatRating(null), '—/10');
  });

  it('uses softer labels', () => {
    assert.equal(verdictLabel('poor'), 'Weak');
    assert.equal(verdictLabel('worst'), 'Skip');
    assert.equal(verdictLabel('abysmal', -1), 'Rough');
  });
});

describe('scoreProduct', () => {
  it('returns unknown without signals', () => {
    const r = scoreProduct({ nutriscore: null, nova: null, additivesCount: null });
    assert.equal(r.verdict, 'unknown');
  });

  it('rewards Nutri-Score A + NOVA 1', () => {
    const r = scoreProduct({ nutriscore: 'a', nova: 1, additivesCount: 0 });
    assert.ok(['elite', 'excellent', 'good', 'ok'].includes(r.verdict));
  });
});

describe('barcode helpers', () => {
  it('validates barcode shapes', () => {
    assert.equal(isValidBarcode('021130126026'), true);
    assert.equal(isValidBarcode('123'), false);
    assert.equal(isValidBarcode('abc'), false);
  });

  it('matches UPCs ignoring leading zeros', () => {
    assert.equal(normalizeUpc('000853910006170'), '853910006170');
    assert.equal(upcMatches('000853910006170', '853910006170'), true);
    assert.equal(upcMatches('111', '222'), false);
  });
});
