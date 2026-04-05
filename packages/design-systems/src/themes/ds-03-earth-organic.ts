import type { DesignSystem } from '../types';

export const ds03: DesignSystem = {
  id: 'ds-03',
  num: '03',
  name: 'Earth Organic',
  category: 'wellness',
  description: 'Warm earth tones, natural and organic feel',
  audience: ['bio', 'cosmetique', 'sante', 'naturel', 'bien-etre', 'herboristerie'],
  darkMode: false,
  colors: {
    accent: '#a16207',
    bg: '#faf7f2',
    bgAlt: '#f5f0e8',
    text: '#292524',
    textSecondary: '#78716c',
    textMuted: '#a8a29e',
    border: '#d6cfc4',
  },
  typography: {
    fontPrimary: "'Lora', serif",
    fontBody: "'Source Sans 3', sans-serif",
    sizeH1: '3rem',
    sizeH2: '2.25rem',
    sizeH3: '1.5rem',
    sizeBody: '1rem',
    weightBlack: '800',
    weightBold: '600',
    weightRegular: '400',
  },
  spacing: { sm: '0.5rem', md: '1rem', lg: '2rem', xl: '4rem' },
  components: {
    borderWidth: '1px',
    radius: '0.75rem',
    transition: '0.2s ease',
    btnPadding: '0.75rem 1.5rem',
  },
};
