import type { DesignSystem } from './types';

/**
 * Generates CSS custom properties from a design system.
 * Inject this into <style> or :root to theme the storefront.
 */
export function toCssVariables(ds: DesignSystem): string {
  const vars: string[] = [];

  // Colors
  for (const [key, val] of Object.entries(ds.colors)) {
    vars.push(`--ds-${camelToKebab(key)}: ${val}`);
  }

  // Typography
  vars.push(`--ds-font-primary: ${ds.typography.fontPrimary}`);
  if (ds.typography.fontDisplay) vars.push(`--ds-font-display: ${ds.typography.fontDisplay}`);
  if (ds.typography.fontBody) vars.push(`--ds-font-body: ${ds.typography.fontBody}`);
  vars.push(`--ds-size-h1: ${ds.typography.sizeH1}`);
  vars.push(`--ds-size-h2: ${ds.typography.sizeH2}`);
  if (ds.typography.sizeH3) vars.push(`--ds-size-h3: ${ds.typography.sizeH3}`);
  vars.push(`--ds-size-body: ${ds.typography.sizeBody}`);
  vars.push(`--ds-weight-black: ${ds.typography.weightBlack}`);
  if (ds.typography.weightBold) vars.push(`--ds-weight-bold: ${ds.typography.weightBold}`);
  if (ds.typography.weightRegular) vars.push(`--ds-weight-regular: ${ds.typography.weightRegular}`);

  // Spacing
  vars.push(`--ds-space-sm: ${ds.spacing.sm}`);
  vars.push(`--ds-space-md: ${ds.spacing.md}`);
  vars.push(`--ds-space-lg: ${ds.spacing.lg}`);
  vars.push(`--ds-space-xl: ${ds.spacing.xl}`);

  // Components
  vars.push(`--ds-border-width: ${ds.components.borderWidth}`);
  vars.push(`--ds-radius: ${ds.components.radius}`);
  if (ds.components.shadow) vars.push(`--ds-shadow: ${ds.components.shadow}`);
  vars.push(`--ds-transition: ${ds.components.transition}`);
  vars.push(`--ds-btn-padding: ${ds.components.btnPadding}`);

  return `:root {\n  ${vars.join(';\n  ')};\n}`;
}

/**
 * Returns a Google Fonts <link> URL for the design system's fonts.
 */
export function toGoogleFontsUrl(ds: DesignSystem): string {
  const fonts = new Set<string>();
  extractFontName(ds.typography.fontPrimary, fonts);
  if (ds.typography.fontDisplay) extractFontName(ds.typography.fontDisplay, fonts);
  if (ds.typography.fontBody) extractFontName(ds.typography.fontBody, fonts);

  if (fonts.size === 0) return '';

  const families = [...fonts].map((f) => `family=${f.replace(/\s+/g, '+')}:wght@200;300;400;700;800;900`);
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

function extractFontName(cssValue: string, set: Set<string>) {
  const match = cssValue.match(/'([^']+)'/);
  if (match?.[1] && !['sans-serif', 'serif', 'monospace'].includes(match[1])) {
    set.add(match[1]);
  }
}

function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
