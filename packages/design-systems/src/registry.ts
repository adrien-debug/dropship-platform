import type { DesignSystem } from './types';
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

const designSystems: DesignSystem[] = [
  ds01, ds02, ds03, ds04, ds05,
  ds06, ds07, ds08, ds09, ds10,
];

const designSystemMap = new Map<string, DesignSystem>(
  designSystems.map((ds) => [ds.id, ds]),
);

export function getDesignSystem(id: string): DesignSystem | undefined {
  return designSystemMap.get(id);
}

export function listDesignSystems(): DesignSystem[] {
  return [...designSystems];
}

export function suggestDesignSystem(audience: string): DesignSystem[] {
  const query = audience.toLowerCase().trim();
  const tokens = query.split(/[\s,;|]+/).filter(Boolean);

  const scored = designSystems.map((ds) => {
    let score = 0;
    for (const tag of ds.audience) {
      const normalizedTag = tag.toLowerCase();
      if (normalizedTag === query) {
        score += 10;
      }
      for (const token of tokens) {
        if (normalizedTag === token) {
          score += 5;
        } else if (normalizedTag.includes(token) || token.includes(normalizedTag)) {
          score += 2;
        }
      }
    }
    if (ds.name.toLowerCase().includes(query)) {
      score += 3;
    }
    if (ds.description.toLowerCase().includes(query)) {
      score += 1;
    }
    return { ds, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.ds);
}
