export interface TemplateVars {
  brandName: string;
  tagline: string;
  niche: string;
  products: { name: string; price: number; image?: string; handle?: string }[];
}

export interface SiteTemplate {
  id: string;
  name: string;
  niches: string[];
  designSystem: string;
  pages: Record<string, (vars: TemplateVars) => string>;
}

import { animeTemplate } from './anime';
import { luxuryTemplate } from './luxury';
import { streetwearTemplate } from './streetwear';
import { beautyTemplate } from './beauty';
import { techTemplate } from './tech';
import { generalTemplate } from './general';

const ALL_TEMPLATES: SiteTemplate[] = [
  animeTemplate,
  luxuryTemplate,
  streetwearTemplate,
  beautyTemplate,
  techTemplate,
  generalTemplate,
];

const byId = new Map(ALL_TEMPLATES.map(t => [t.id, t]));

export function getTemplate(id: string): SiteTemplate | undefined {
  return byId.get(id);
}

export function listTemplates(): SiteTemplate[] {
  return [...ALL_TEMPLATES];
}

export function suggestTemplate(niche: string): SiteTemplate {
  const terms = niche.toLowerCase().split(/[\s,]+/);
  let best: SiteTemplate = ALL_TEMPLATES[ALL_TEMPLATES.length - 1]!;
  let bestScore = 0;
  for (const t of ALL_TEMPLATES) {
    const score = t.niches.reduce(
      (acc, n) => acc + (terms.some(term => n.includes(term) || term.includes(n)) ? 1 : 0),
      0,
    );
    if (score > bestScore) { best = t; bestScore = score; }
  }
  return best;
}

export function generateFromTemplate(template: SiteTemplate, vars: TemplateVars): Map<string, string> {
  const files = new Map<string, string>();
  for (const [route, gen] of Object.entries(template.pages)) {
    const filePath = route === '/' ? 'src/app/page.tsx' : `src/app${route}/page.tsx`;
    files.set(filePath, gen(vars));
  }
  return files;
}
