import { describe, expect, it } from 'vitest';
import {
  scoreProduct,
  rankAndKeepTop,
  type ScorableProduct,
} from './product-scorer';

const base: ScorableProduct = {
  supplier: 'aliexpress',
  externalId: 'x',
  title: 't',
  price: 0,
  imageUrl: 'https://img.example.com/x.jpg',
};

describe('scoreProduct', () => {
  it('rates an ideal product highly (cost 15€, 10k orders, 4.7★)', () => {
    const { score, reasons } = scoreProduct({
      ...base,
      externalId: 'ideal',
      price: 15,
      orders: 10_000,
      evaluateRate: '4.7',
    });
    expect(score).toBeGreaterThan(0.7);
    // sanity: reasons should mention orders & cost
    expect(reasons.join(' ')).toMatch(/(Orders|Coût|Marge)/);
  });

  it('rates junk very low (cost 1.50€, 12 orders, 3★, missing image → 0)', () => {
    const { score, reasons } = scoreProduct({
      ...base,
      externalId: 'junk',
      price: 1.5,
      orders: 12,
      evaluateRate: '60%',
      imageUrl: '',
    });
    expect(score).toBe(0);
    expect(reasons[0]).toMatch(/Image manquante/);
  });

  it('rates junk low even when image is present (cost 1.50€, 12 orders, 60%)', () => {
    const { score } = scoreProduct({
      ...base,
      externalId: 'junk2',
      price: 1.5,
      orders: 12,
      evaluateRate: '60%',
    });
    expect(score).toBeLessThan(0.35);
  });

  it('rates a legitimate premium product decently (cost 45€, 800 orders, 4.5★)', () => {
    const { score } = scoreProduct({
      ...base,
      externalId: 'premium',
      price: 45,
      orders: 800,
      evaluateRate: '4.5',
    });
    expect(score).toBeGreaterThan(0.45);
    expect(score).toBeLessThan(0.8);
  });

  it('handles cost = 0 gracefully (hard gate, score = 0)', () => {
    const { score, reasons } = scoreProduct({
      ...base,
      externalId: 'free',
      price: 0,
      orders: 5_000,
      evaluateRate: '4.5',
    });
    expect(score).toBe(0);
    expect(reasons.join(' ')).toMatch(/Coût/);
  });

  it('handles negative cost as invalid (score = 0)', () => {
    const { score } = scoreProduct({
      ...base,
      externalId: 'neg',
      price: -5,
      orders: 1000,
    });
    expect(score).toBe(0);
  });

  it('handles missing orders / rating without crashing', () => {
    const { score } = scoreProduct({
      ...base,
      externalId: 'sparse',
      price: 20,
    });
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThan(0);
  });

  it('parses evaluateRate as percentage string ("94.6%") and as raw star float ("4.7")', () => {
    const pct = scoreProduct({ ...base, externalId: 'a', price: 15, orders: 1000, evaluateRate: '94.6%' });
    const star = scoreProduct({ ...base, externalId: 'b', price: 15, orders: 1000, evaluateRate: '4.7' });
    // Both forms should produce similar (within 10pp) sub-scores.
    expect(Math.abs(pct.score - star.score)).toBeLessThan(0.1);
  });

  it('penalises sub-3€ products even with good orders', () => {
    const cheap = scoreProduct({
      ...base,
      externalId: 'cheap',
      price: 2,
      orders: 50_000,
      evaluateRate: '4.5',
    });
    const decent = scoreProduct({
      ...base,
      externalId: 'decent',
      price: 15,
      orders: 50_000,
      evaluateRate: '4.5',
    });
    expect(cheap.score).toBeLessThan(decent.score);
  });
});

describe('rankAndKeepTop', () => {
  const mkItems = (n: number): ScorableProduct[] =>
    Array.from({ length: n }, (_, i) => ({
      ...base,
      externalId: `p-${i}`,
      // Spread prices across the sweet spot so scores vary monotonically.
      price: 5 + i * 1.5,
      orders: 1000 + i * 200,
      evaluateRate: '4.5',
    }));

  it('returns at most N items', () => {
    const out = rankAndKeepTop(mkItems(10), 3);
    expect(out.length).toBe(3);
  });

  it('returns fewer than N when input is smaller', () => {
    const out = rankAndKeepTop(mkItems(2), 5);
    expect(out.length).toBe(2);
  });

  it('sorts by score DESC', () => {
    const out = rankAndKeepTop(mkItems(10), 5);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1]._score).toBeGreaterThanOrEqual(out[i]._score);
    }
  });

  it('decorates items with _score and _scoreReasons', () => {
    const out = rankAndKeepTop(mkItems(3), 3);
    for (const item of out) {
      expect(typeof item._score).toBe('number');
      expect(Array.isArray(item._scoreReasons)).toBe(true);
      expect(item._scoreReasons.length).toBeGreaterThan(0);
    }
  });

  it('handles n=0 / negative n', () => {
    expect(rankAndKeepTop(mkItems(3), 0)).toEqual([]);
    expect(rankAndKeepTop(mkItems(3), -1)).toEqual([]);
  });

  it('puts an ideal product above a junk one regardless of input order', () => {
    const junk: ScorableProduct = {
      ...base,
      externalId: 'junk',
      price: 1.2,
      orders: 5,
      evaluateRate: '50%',
    };
    const ideal: ScorableProduct = {
      ...base,
      externalId: 'ideal',
      price: 18,
      orders: 8000,
      evaluateRate: '4.8',
    };
    const out = rankAndKeepTop([junk, ideal], 2);
    expect(out[0]?.externalId).toBe('ideal');
    expect(out[1]?.externalId).toBe('junk');
  });
});
