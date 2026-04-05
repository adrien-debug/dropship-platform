import { llmComplete } from './llm.js';

export interface EcommercePageConfig {
  pageName: string;
  route: string;
  sections: string[];
}

export interface EcommerceSiteConfig {
  brandName: string;
  tagline: string;
  niche: string;
  tone: string;
  palette: string;
  typography: string;
  products: { name: string; price: number; image?: string }[];
  pages: EcommercePageConfig[];
}

const ECOMMERCE_PAGES: EcommercePageConfig[] = [
  {
    pageName: 'Home',
    route: '/',
    sections: ['hero', 'featured-products', 'value-props', 'testimonials', 'newsletter'],
  },
  {
    pageName: 'Shop',
    route: '/shop',
    sections: ['category-filter', 'product-grid', 'pagination'],
  },
  {
    pageName: 'About',
    route: '/about',
    sections: ['brand-story', 'team', 'values', 'cta'],
  },
  {
    pageName: 'Contact',
    route: '/contact',
    sections: ['contact-form', 'faq'],
  },
];

export function getDefaultEcommercePages(): EcommercePageConfig[] {
  return ECOMMERCE_PAGES;
}

export async function generateEcommerceContext(config: EcommerceSiteConfig): Promise<string> {
  const prompt = `You are a brand strategist for premium e-commerce stores. Create a concise brand brief for:

Brand: "${config.brandName}"
Niche: ${config.niche}
Tagline: "${config.tagline}"
Tone: ${config.tone}
Top products: ${config.products.slice(0, 5).map(p => `${p.name} ($${p.price})`).join(', ')}

Provide:
1. Brand positioning (2 sentences)
2. Target audience persona (3 sentences)
3. 5 power words for this brand
4. Value proposition (1 sentence)
5. Competitive advantage (1 sentence)

Be specific to ${config.niche}. Write in English. Keep it under 300 words total.`;

  return llmComplete(prompt, 2048);
}

export async function generateEcommerceCopy(
  config: EcommerceSiteConfig,
  page: EcommercePageConfig,
  brandBrief: string,
): Promise<string> {
  const prompt = `You are a copywriter for premium e-commerce. Write content for the "${page.pageName}" page.

Brand brief:
${brandBrief}

Brand: ${config.brandName} (${config.niche})
Page sections: ${page.sections.join(', ')}
${page.route === '/' ? `Featured products: ${config.products.slice(0, 6).map(p => p.name).join(', ')}` : ''}

For each section, output:
---SECTION: [name]---
HEADLINE: [compelling, specific to ${config.niche}]
SUBHEADLINE: [1-2 sentences with a benefit]
BODY: [2-3 paragraphs, authentic voice, no fluff words]
CTA: [specific action verb + outcome]
---END---

Rules:
- No "innovative", "cutting-edge", "seamless", "game-changing"
- Include specific numbers where relevant
- Write in English
- Keep copy authentic and premium`;

  return llmComplete(prompt, 4096);
}

export async function generateEcommercePageTsx(
  config: EcommerceSiteConfig,
  page: EcommercePageConfig,
  copy: string,
): Promise<string> {
  const isHome = page.route === '/';
  const isShop = page.route === '/shop';

  const medusaImports = isHome || isShop
    ? `import { getProducts } from '@/lib/medusa';`
    : '';

  const serverComponent = isHome || isShop;

  const prompt = `You are a senior Next.js developer. Generate a complete, production-ready page component for an e-commerce store.

Page: ${page.pageName} (${page.route})
Brand: ${config.brandName} (${config.niche})
Palette: dark theme with accent color
Sections: ${page.sections.join(', ')}

Copy to use (use EXACTLY):
${copy}

${isHome ? `Products to display (fetched from Medusa API):
${config.products.slice(0, 6).map(p => `- ${p.name}: $${p.price}${p.image ? ` (image: ${p.image})` : ''}`).join('\n')}` : ''}

Requirements:
1. ${serverComponent ? 'Server component (no "use client")' : '"use client" directive'}
2. ${medusaImports ? `Import: ${medusaImports}` : 'No Medusa imports needed'}
3. Use Tailwind CSS only — dark theme (bg-gray-950, bg-gray-900, text-white)
4. Responsive: mobile-first with sm: md: lg: breakpoints
5. ${isHome ? 'Fetch products with getProducts({ limit: 8 }) and display in a grid' : ''}
6. ${isShop ? 'Fetch products with getProducts() and display in a filterable grid' : ''}
7. Product cards link to /product/[handle]
8. Clean, minimal, premium aesthetic
9. NO imports from packages not in Next.js standard (no motion, no headlessui)
10. Export default function named ${page.pageName.replace(/\s/g, '')}Page

Output ONLY the TSX code. No markdown fences. No explanations.
The code should be 100-300 lines, clean and functional.`;

  let code = await llmComplete(prompt, 12000);

  code = code.trim();
  if (code.startsWith('```')) {
    code = code.replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/, '').replace(/\n?```$/, '');
  }

  if (code.length < 50) {
    throw new Error(`Generated code too short for ${page.pageName} (${code.length} chars)`);
  }

  return code;
}

export async function generateFullSite(
  config: EcommerceSiteConfig,
  onProgress?: (step: string, detail: string) => void,
): Promise<Map<string, string>> {
  const pages = config.pages.length > 0 ? config.pages : getDefaultEcommercePages();
  const files = new Map<string, string>();

  onProgress?.('context', 'Generating brand brief...');
  const brandBrief = await generateEcommerceContext(config);
  onProgress?.('context', `Brief: ${brandBrief.slice(0, 100)}...`);

  for (const page of pages) {
    onProgress?.('copy', `Writing copy for ${page.pageName}...`);
    const copy = await generateEcommerceCopy(config, page, brandBrief);

    onProgress?.('codegen', `Generating ${page.pageName} page code...`);
    const tsx = await generateEcommercePageTsx(config, page, copy);

    const filePath = page.route === '/'
      ? 'src/app/page.tsx'
      : `src/app${page.route}/page.tsx`;

    files.set(filePath, tsx);
    onProgress?.('codegen', `${page.pageName}: ${tsx.length} chars`);
  }

  return files;
}
