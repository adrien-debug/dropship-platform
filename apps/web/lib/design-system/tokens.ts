/**
 * Design system tokens — TypeScript.
 *
 * These mirror the CSS custom properties in globals.css.
 * Use them for values needed in JS (canvas, charts, dynamic styles).
 * For static styling, prefer the CSS variables directly.
 */

// ── Backgrounds ──
export const bg = {
  base: '#05070d',
  elevated: '#080b14',
  card: '#0b1020',
  cardHover: '#0f1528',
  overlay: 'rgba(5, 7, 13, 0.85)',
  sidebar: '#060810',
} as const;

// ── Surfaces (glassmorphism) ──
export const surface = {
  subtle: 'rgba(255, 255, 255, 0.03)',
  default: 'rgba(255, 255, 255, 0.05)',
  elevated: 'rgba(255, 255, 255, 0.07)',
} as const;

// ── Borders ──
export const border = {
  subtle: 'rgba(255, 255, 255, 0.06)',
  default: 'rgba(255, 255, 255, 0.08)',
  strong: 'rgba(255, 255, 255, 0.12)',
  accent: 'rgba(0, 183, 255, 0.25)',
} as const;

// ── Text ──
export const text = {
  primary: '#f8fafc',
  secondary: '#94a3b8',
  muted: '#64748b',
  disabled: '#475569',
  inverse: '#0f172a',
} as const;

// ── Accents ──
export const accent = {
  cyan: '#00b7ff',
  blue: '#38bdf8',
  blueGlow: 'rgba(56, 189, 248, 0.15)',
  cyanGlow: 'rgba(0, 183, 255, 0.20)',
} as const;

// ── Semantic ──
export const semantic = {
  success: '#22c55e',
  successMuted: 'rgba(34, 197, 94, 0.15)',
  warning: '#f59e0b',
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  danger: '#ef4444',
  dangerMuted: 'rgba(239, 68, 68, 0.15)',
  info: '#38bdf8',
  infoMuted: 'rgba(56, 189, 248, 0.15)',
} as const;

// ── Layout ──
export const layout = {
  sidebarWidth: 72,
  sidebarWidthExpanded: 260,
  leftPanelWidth: 300,
  rightPanelWidth: 360,
  chatMinWidth: 480,
  headerHeight: 56,
  panelHeaderHeight: 48,
} as const;

// ── Spacing ──
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

// ── Radius ──
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
} as const;

// ── Shadows ──
export const shadow = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.30)',
  md: '0 4px 12px rgba(0, 0, 0, 0.40)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.50)',
  glow: '0 0 20px rgba(0, 183, 255, 0.08)',
  glowStrong: '0 0 30px rgba(0, 183, 255, 0.15)',
} as const;

// ── Transitions ──
export const transition = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  default: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// ── Z-index ──
export const zIndex = {
  base: 0,
  panel: 10,
  sticky: 20,
  dropdown: 30,
  modal: 40,
  tooltip: 50,
} as const;
