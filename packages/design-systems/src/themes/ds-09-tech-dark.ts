import type { DesignSystem } from '../types';

export const ds09: DesignSystem = {
  id: 'ds-09',
  num: '09',
  name: 'Tech Dark',
  category: 'tech',
  description: 'Dark grays with blue accents, tech-forward',
  audience: ['tech', 'electronics', 'informatique', 'gadgets', 'domotique', 'audio'],
  darkMode: true,
  colors: {
    accent: '#3b82f6',
    bg: '#09090b',
    bgAlt: '#18181b',
    text: '#fafafa',
    textSecondary: '#6366f1',
    textMuted: '#a1a1aa',
    border: '#3f3f46',
  },
  typography: {
    fontPrimary: "'Space Grotesk', sans-serif",
    fontBody: "'IBM Plex Sans', sans-serif",
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
    radius: '0.5rem',
    shadow: '0 4px 16px rgba(59, 130, 246, 0.2)',
    transition: '0.2s ease',
    btnPadding: '0.75rem 1.5rem',
  },
};
