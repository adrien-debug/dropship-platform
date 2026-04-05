import type { DesignSystem } from '../types';

export const ds01: DesignSystem = {
  id: 'ds-01',
  num: '01',
  name: 'Minimal White',
  category: 'lifestyle',
  description: 'Clean, minimal, luxurious feel',
  audience: ['lifestyle', 'mode', 'beaute', 'cosmetique', 'premium'],
  darkMode: false,
  colors: {
    accent: '#f3f4f6',
    bg: '#ffffff',
    bgAlt: '#f9fafb',
    text: '#111827',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    border: '#e5e7eb',
  },
  typography: {
    fontPrimary: "'Playfair Display', serif",
    fontBody: "'Inter', sans-serif",
    sizeH1: '3.5rem',
    sizeH2: '2.5rem',
    sizeH3: '1.75rem',
    sizeBody: '1rem',
    weightBlack: '900',
    weightBold: '700',
    weightRegular: '400',
  },
  spacing: { sm: '0.5rem', md: '1rem', lg: '2rem', xl: '4rem' },
  components: {
    borderWidth: '1px',
    radius: '0.25rem',
    transition: '0.2s ease',
    btnPadding: '0.75rem 1.5rem',
  },
};
