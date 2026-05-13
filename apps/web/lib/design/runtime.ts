/**
 * Server-side helpers that turn `dropship_stores.design_preset` + `.palette`
 * into the runtime artifacts the storefront actually consumes:
 *   - A `<style>` block exposing every palette color + the typography family
 *     stacks as CSS custom properties (so any descendant component can read
 *     `var(--ds-primary)` / `var(--ds-font-display)` without prop drilling).
 *   - A `<link>` to Google Fonts loading exactly the weights the chosen
 *     preset needs (no preload of weights we don't use).
 *
 * Both are rendered inside the storefront layout. Templates read `var(--ds-*)`
 * everywhere instead of inventing colors or fonts on the fly.
 */

import type { StoreConfig } from '@/lib/store-config';
import { DESIGN_PRESETS, type DesignPreset, type StorePalette } from './presets';

// Fonts that Google Fonts actually hosts. The rest (Migra, PP Editorial New,
// General Sans, Satoshi, Geist) are commercial / Fontshare. For those we
// either fall back to a close Google equivalent OR self-host them later.
// Keep the mapping explicit so we never silently load a font that 404s.
const GOOGLE_FONT_FAMILIES: Record<string, { google: string; weights: number[]; italic?: boolean } | null> = {
  // Editorial serif
  'Instrument Serif': { google: 'Instrument+Serif', weights: [400], italic: true },
  'Inter Tight': { google: 'Inter+Tight', weights: [400, 500, 600] },
  'Fraunces': { google: 'Fraunces', weights: [400, 600], italic: true },
  // Common fall-backs
  'Geist': { google: 'Geist', weights: [400, 500, 600, 800] },
  'Playfair Display': { google: 'Playfair+Display', weights: [400, 700], italic: true },
  'Plus Jakarta Sans': { google: 'Plus+Jakarta+Sans', weights: [400, 500, 600, 700] },
  // Fontshare-only families — return null so we skip the Google Fonts <link>
  // for them. The CSS-var stack still names them, so a self-hosted @font-face
  // in the future will be picked up automatically.
  'Satoshi': null,
  'General Sans': null,
  'Migra': null,
  'PP Editorial New': null,
};

export interface RuntimeDesign {
  preset: DesignPreset;
  palette: StorePalette;
  /** Ready-to-inject Google Fonts URL or null if everything is self-hosted/system. */
  googleFontsUrl: string | null;
  /** Inline CSS to drop in a `<style>` tag inside the layout. */
  cssVars: string;
}

export function resolveDesign(store: StoreConfig): RuntimeDesign {
  // Fallback chain: explicit preset → first curated preset (editorial-serif).
  const preset =
    DESIGN_PRESETS.find((p) => p.slug === store.designPreset) ?? DESIGN_PRESETS[0]!;

  // Palette priority: structured `palette` column → legacy primary/accent
  // padded with the preset's neutrals → preset neutrals only. Every code
  // path below sees a fully populated StorePalette.
  const palette: StorePalette = store.palette ?? {
    primary: store.primaryColor || preset.neutrals.text,
    accent: store.accentColor || preset.neutrals.text,
    bg: preset.neutrals.bg,
    surface: preset.neutrals.surface,
    text: preset.neutrals.text,
    textMuted: preset.neutrals.textMuted,
    border: preset.neutrals.border,
    success: '#16a34a',
    danger: '#dc2626',
  };

  const googleFontsUrl = buildGoogleFontsUrl(preset);
  const cssVars = buildCssVars(preset, palette);

  return { preset, palette, googleFontsUrl, cssVars };
}

function buildGoogleFontsUrl(preset: DesignPreset): string | null {
  const families = [preset.fonts.display, preset.fonts.body];
  const params: string[] = [];
  for (const f of families) {
    const mapped = GOOGLE_FONT_FAMILIES[f.family];
    if (!mapped) continue;
    // Google Fonts CSS API v2 syntax:
    //   family=Name:ital,wght@0,400;0,600;1,400
    const weights = Array.from(new Set([...mapped.weights, ...f.weights])).sort((a, b) => a - b);
    const ital = mapped.italic || f.italic;
    const axes = ital
      ? `ital,wght@${weights.map((w) => `0,${w}`).join(';')};${weights.map((w) => `1,${w}`).join(';')}`
      : `wght@${weights.join(';')}`;
    params.push(`family=${mapped.google}:${axes}`);
  }
  if (params.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}

function buildCssVars(preset: DesignPreset, palette: StorePalette): string {
  const displayStack = `'${preset.fonts.display.family}', Georgia, serif`;
  const bodyStack = `'${preset.fonts.body.family}', system-ui, -apple-system, 'Inter', sans-serif`;
  const radius =
    preset.ui.radius === 'sharp' ? '4px' : preset.ui.radius === 'pill' ? '999px' : '12px';

  return `
:root {
  --ds-primary: ${palette.primary};
  --ds-accent: ${palette.accent};
  --ds-bg: ${palette.bg};
  --ds-surface: ${palette.surface};
  --ds-text: ${palette.text};
  --ds-text-muted: ${palette.textMuted};
  --ds-border: ${palette.border};
  --ds-success: ${palette.success};
  --ds-danger: ${palette.danger};
  --ds-font-display: ${displayStack};
  --ds-font-body: ${bodyStack};
  --ds-radius: ${radius};
  --ds-heading-tracking: ${preset.ui.headingTracking}em;
}
`.trim();
}
