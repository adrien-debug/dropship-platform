import type { DesignSystem } from '../types';

export const ds08: DesignSystem = {
  id: 'ds-08',
  num: '08',
  name: 'Pastel Bloom',
  category: 'beauty',
  description: 'Soft pastels, feminine and elegant',
  audience: ['beaute', 'mode', 'feminine', 'skincare', 'parfum', 'soins'],
  darkMode: false,
  colors: {
    accent: '#ec4899',
    bg: '#fdf2f8',
    bgAlt: '#fce7f3',
    text: '#1f1f1f',
    textSecondary: '#a78bfa',
    textMuted: '#9ca3af',
    border: '#f9a8d4',
  },
  typography: {
    fontPrimary: "'Playfair Display', serif",
    fontBody: "'Lato', sans-serif",
    sizeH1: '3.5rem',
    sizeH2: '2.5rem',
    sizeH3: '1.75rem',
    sizeBody: '1rem',
    weightBlack: '900',
    weightBold: '700',
    weightRegular: '400',
  },
  spacing: { sm: '0.75rem', md: '1.25rem', lg: '2.5rem', xl: '5rem' },
  components: {
    borderWidth: '1px',
    radius: '1rem',
    transition: '0.3s ease',
    btnPadding: '0.875rem 1.75rem',
  },
};
