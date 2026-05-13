/**
 * Curated design presets for storefronts. The agent picks 3 candidates per
 * niche, the user confirms one in the chat, and the choice is FROZEN in
 * `dropship_stores.design_preset`. No more random Google Fonts on every
 * regeneration — same store, same fonts, same mood.
 *
 * Each preset bundles:
 *   - A font pair (display + body) loaded from Google Fonts at runtime
 *   - A palette skeleton (the agent fills in primary/accent per-store)
 *   - A "mood" string used by the FLUX prompt builder so generated imagery
 *     visually matches the type system
 *
 * Keep this list short and opinionated. Five well-tuned presets beat fifty
 * mediocre ones, and the agent can recommend confidently.
 */

export interface PaletteSkeleton {
  /** Backgrounds — the body and elevated surfaces. */
  bg: string;
  surface: string;
  /** Text colors. */
  text: string;
  textMuted: string;
  /** Lines + dividers. */
  border: string;
}

export interface DesignPreset {
  slug: string;
  label: string;
  /** One-sentence pitch shown to the user when they choose. */
  tagline: string;
  /** Best suited for these niches (used by the agent for shortlisting). */
  suitedFor: string[];
  fonts: {
    display: { family: string; weights: number[]; italic?: boolean };
    body: { family: string; weights: number[]; italic?: boolean };
  };
  /** Default neutrals — primary + accent come from the per-store palette. */
  neutrals: PaletteSkeleton;
  /** One-line mood the FLUX prompt builder pastes into asset prompts. */
  imageryMood: string;
  /** UI rendering hints. */
  ui: {
    radius: 'sharp' | 'soft' | 'pill';
    contrast: 'low' | 'medium' | 'high';
    headingTracking: number;
  };
}

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    slug: 'editorial-serif',
    label: 'Editorial serif',
    tagline: 'Magazine de mode. Italiques cinéma, blancs généreux, ton premium discret.',
    suitedFor: ['lifestyle', 'beauty', 'home', 'fashion', 'wellness'],
    fonts: {
      display: { family: 'Instrument Serif', weights: [400], italic: true },
      body: { family: 'Inter Tight', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#faf8f3',
      surface: '#ffffff',
      text: '#0d0d0d',
      textMuted: '#6b6b6b',
      border: '#e6e2d8',
    },
    imageryMood: 'editorial 35mm photograph, soft north-window light, warm neutrals, sand and bone tones, deep negative space, magazine cover quality',
    ui: { radius: 'soft', contrast: 'medium', headingTracking: -0.02 },
  },
  {
    slug: 'tech-mono',
    label: 'Tech mono',
    tagline: 'Vercel-grade. Geist + lettres précises. Pour produits techniques et minimalistes.',
    suitedFor: ['tech', 'gadgets', 'productivity', 'office', 'audio'],
    fonts: {
      display: { family: 'Geist', weights: [500, 600, 800] },
      body: { family: 'Geist', weights: [400, 500] },
    },
    neutrals: {
      bg: '#0a0a0a',
      surface: '#121212',
      text: '#fafafa',
      textMuted: '#a3a3a3',
      border: '#262626',
    },
    imageryMood: 'studio product photograph on matte black surface, cold neutral light, single rim light, brushed aluminum textures, controlled shadow, technical precision',
    ui: { radius: 'sharp', contrast: 'high', headingTracking: -0.025 },
  },
  {
    slug: 'brutalist-luxe',
    label: 'Brutalist luxe',
    tagline: 'Off-White rencontre Jacquemus. Lettres pleines, blocs noirs, contraste maximal.',
    suitedFor: ['fashion', 'streetwear', 'accessories', 'luxury'],
    fonts: {
      display: { family: 'PP Editorial New', weights: [400, 700], italic: true },
      body: { family: 'Satoshi', weights: [400, 500, 700, 900] },
    },
    neutrals: {
      bg: '#f4f1ec',
      surface: '#ffffff',
      text: '#000000',
      textMuted: '#525252',
      border: '#000000',
    },
    imageryMood: 'high-contrast editorial photograph, hard sunlight or seamless studio, sharp shadow, single stark color background, fashion campaign mood, no fuss',
    ui: { radius: 'sharp', contrast: 'high', headingTracking: -0.04 },
  },
  {
    slug: 'gen-z-bold',
    label: 'Gen-Z bold',
    tagline: 'Saturé, énergique, vibe TikTok. Display Migra + body General Sans, grain léger.',
    suitedFor: ['fitness', 'fashion', 'beauty', 'tech', 'snacks', 'pets'],
    fonts: {
      display: { family: 'Migra', weights: [600, 900], italic: true },
      body: { family: 'General Sans', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#fff8ec',
      surface: '#ffffff',
      text: '#101010',
      textMuted: '#4a4a4a',
      border: '#101010',
    },
    imageryMood: 'vibrant editorial photograph, saturated golden hour light, real young person using the product, candid energy, grain, color-blocked composition',
    ui: { radius: 'pill', contrast: 'high', headingTracking: -0.035 },
  },
  {
    slug: 'lifestyle-warm',
    label: 'Lifestyle warm',
    tagline: 'Aimé Leon Dore. Tons sable et terracotta, serif chaud, dimanche matin DTC.',
    suitedFor: ['lifestyle', 'home', 'kitchen', 'beauty', 'wellness', 'pets'],
    fonts: {
      display: { family: 'Fraunces', weights: [400, 600], italic: true },
      body: { family: 'Inter Tight', weights: [400, 500, 600] },
    },
    neutrals: {
      bg: '#f3ede2',
      surface: '#fbf8f1',
      text: '#1c1611',
      textMuted: '#6b5e4f',
      border: '#d9cfbd',
    },
    imageryMood: 'warm Sunday-morning photograph, oak and linen textures, terracotta and bone palette, soft golden window light, human hands in frame, slow-living mood',
    ui: { radius: 'soft', contrast: 'medium', headingTracking: -0.02 },
  },
];

export function getPreset(slug: string | null | undefined): DesignPreset {
  return DESIGN_PRESETS.find((p) => p.slug === slug) ?? DESIGN_PRESETS[0]!;
}

export function listPresetSlugs(): string[] {
  return DESIGN_PRESETS.map((p) => p.slug);
}

/**
 * Locked, structured palette stored in `dropship_stores.palette`. The agent
 * + user decide it once at creation time and templates read from this
 * single source of truth.
 */
export interface StorePalette {
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  danger: string;
}

export function buildPaletteFromPreset(
  preset: DesignPreset,
  primary: string,
  accent: string,
): StorePalette {
  return {
    primary,
    accent,
    bg: preset.neutrals.bg,
    surface: preset.neutrals.surface,
    text: preset.neutrals.text,
    textMuted: preset.neutrals.textMuted,
    border: preset.neutrals.border,
    success: '#16a34a',
    danger: '#dc2626',
  };
}
