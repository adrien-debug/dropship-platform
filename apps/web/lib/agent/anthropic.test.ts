import { describe, expect, it } from 'vitest';
import { computeCostEur } from './anthropic';

describe('computeCostEur', () => {
  it('prices Haiku 4.5 (input + output)', () => {
    // 1000 input tokens, 500 output tokens, USD_TO_EUR default 0.92
    // input cost: 1000 / 1_000_000 * 0.80 = $0.0008
    // output cost: 500 / 1_000_000 * 4.00 = $0.002
    // total USD: 0.0028
    // total EUR: 0.0028 * 0.92 = 0.002576
    const cost = computeCostEur('claude-haiku-4-5-20251001', 1000, 500);
    expect(cost).toBeCloseTo(0.002576, 5);
  });

  it('prices Sonnet 4.6', () => {
    // 1M input + 1M output @ $3/$15 = $18 USD * 0.92 EUR ≈ 16.56 EUR
    const cost = computeCostEur('claude-sonnet-4-6', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(16.56, 2);
  });

  it('returns 0 for unknown model', () => {
    expect(computeCostEur('mystery-model', 1000, 1000)).toBe(0);
  });

  it('handles zero tokens', () => {
    expect(computeCostEur('claude-haiku-4-5-20251001', 0, 0)).toBe(0);
  });
});
