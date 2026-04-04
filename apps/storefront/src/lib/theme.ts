import {
  getDesignSystem,
  toCssVariables,
  toGoogleFontsUrl,
  type DesignSystem,
} from '@dropship/design-systems';

let cached: { ds: DesignSystem; css: string; fontsUrl: string } | null = null;

export function getTheme() {
  if (cached) return cached;

  const dsId = process.env.DESIGN_SYSTEM || process.env.NEXT_PUBLIC_DESIGN_SYSTEM || 'swiss';

  const ds = getDesignSystem(dsId) ?? getDesignSystem('swiss')!;
  if (!getDesignSystem(dsId)) {
    console.warn(`[theme] Design system "${dsId}" not found, falling back to swiss`);
  }

  cached = {
    ds,
    css: toCssVariables(ds),
    fontsUrl: toGoogleFontsUrl(ds),
  };

  return cached;
}
