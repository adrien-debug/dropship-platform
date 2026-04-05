import type { DesignSystem } from './types';
import { swiss } from './themes/swiss';
import { cyber } from './themes/cyber';
import { avant } from './themes/avant';
import { radical } from './themes/radical';
import { chrome } from './themes/chrome';
import { ds01 } from './themes/ds-01-minimal-white';
import { ds02 } from './themes/ds-02-neo-tokyo';
import { ds03 } from './themes/ds-03-earth-organic';
import { ds04 } from './themes/ds-04-bold-pop';
import { ds05 } from './themes/ds-05-classic-commerce';
import { ds06 } from './themes/ds-06-luxury-gold';
import { ds07 } from './themes/ds-07-sport-energy';
import { ds08 } from './themes/ds-08-pastel-bloom';
import { ds09 } from './themes/ds-09-tech-dark';
import { ds10 } from './themes/ds-10-streetwear';

const ALL: DesignSystem[] = [
  swiss,
  cyber,
  avant,
  radical,
  chrome,
  ds01,
  ds02,
  ds03,
  ds04,
  ds05,
  ds06,
  ds07,
  ds08,
  ds09,
  ds10,
];

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
