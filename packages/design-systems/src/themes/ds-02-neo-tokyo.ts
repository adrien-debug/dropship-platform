import type { DesignSystem } from '../types';

export const ds02: DesignSystem = {
  id: 'ds-02',
  num: '02',
  name: 'Neo Tokyo',
  category: 'gaming',
  description: 'Dark neon cyberpunk aesthetic',
  audience: ['anime', 'gaming', 'tech', 'geek', 'manga', 'figurines'],
  darkMode: true,
  colors: {
    accent: '#e879f9',
    bg: '#0a0a0f',
    bgAlt: '#1a1a2e',
    text: '#f0f0f5',
    textSecondary: '#22d3ee',
    textMuted: '#a5a5b5',
    border: '#2d2d4a',
  },
  typography: {
    fontPrimary: "'Orbitron', sans-serif",
    fontBody: "'Rajdhani', sans-serif",
    sizeH1: '3.5rem',
    sizeH2: '2.5rem',
    sizeH3: '1.75rem',
    sizeBody: '1.1rem',
    weightBlack: '900',
    weightBold: '700',
    weightRegular: '400',
  },
  spacing: { sm: '0.5rem', md: '1rem', lg: '2rem', xl: '4rem' },
  components: {
    borderWidth: '2px',
    radius: '0.5rem',
    shadow: '0 0 20px rgba(232, 121, 249, 0.3)',
    transition: '0.3s ease',
    btnPadding: '0.75rem 1.5rem',
  },
};
