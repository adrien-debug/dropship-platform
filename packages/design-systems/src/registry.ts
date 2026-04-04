import type { DesignSystem } from './types';
import { swiss } from './themes/swiss';
import { cyber } from './themes/cyber';
import { avant } from './themes/avant';
import { radical } from './themes/radical';
import { chrome } from './themes/chrome';

const ALL: DesignSystem[] = [swiss, cyber, avant, radical, chrome];

const byId = new Map<string, DesignSystem>(ALL.map((ds) => [ds.id, ds]));

export function getDesignSystem(id: string): DesignSystem | undefined {
  return byId.get(id);
}

export function listDesignSystems(): DesignSystem[] {
  return [...ALL];
}

export function suggestDesignSystem(audience: string): DesignSystem[] {
  const terms = audience.toLowerCase().split(/[\s,]+/);
  const scored = ALL.map((ds) => {
    const score = ds.audience.reduce(
      (acc, tag) => acc + (terms.some((t) => tag.includes(t) || t.includes(tag)) ? 1 : 0),
      0,
    );
    return { ds, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.ds);
}

/**
 * Registers a new design system at runtime.
 * Call this to add custom themes without modifying source files.
 */
export function registerDesignSystem(ds: DesignSystem): void {
  const existing = byId.get(ds.id);
  if (existing) {
    const idx = ALL.indexOf(existing);
    if (idx >= 0) ALL[idx] = ds;
  } else {
    ALL.push(ds);
  }
  byId.set(ds.id, ds);
}
