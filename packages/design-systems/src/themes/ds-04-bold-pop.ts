import type { DesignSystem } from '../types';

export const ds04: DesignSystem = {
  id: 'ds-04',
  num: '04',
  name: 'Bold Pop',
  category: 'fun',
  description: 'Vibrant colors, fun and playful',
  audience: ['enfants', 'gadgets', 'jouets', 'fun', 'cadeaux', 'diy'],
  darkMode: false,
  colors: {
    accent: '#f59e0b',
    bg: '#fffbeb',
    bgAlt: '#fef3c7',
    text: '#1c1917',
    textSecondary: '#8b5cf6',
    textMuted: '#78716c',
    border: '#fcd34d',
  },
  typography: {
    fontPrimary: "'Fredoka', sans-serif",
    fontBody: "'Nunito', sans-serif",
    sizeH1: '3.5rem',
    sizeH2: '2.5rem',
    sizeH3: '1.75rem',
    sizeBody: '1.1rem',
    weightBlack: '900',
    weightBold: '700',
    weightRegular: '400',
  },
  spacing: { sm: '0.75rem', md: '1.25rem', lg: '2.5rem', xl: '5rem' },
  components: {
    borderWidth: '2px',
    radius: '1rem',
    shadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    transition: '0.3s ease',
    btnPadding: '1rem 2rem',
  },
};
