import type { DesignSystem } from '../types';

export const cyber: DesignSystem = {
  id: 'cyber',
  num: '02',
  name: 'Cyber Lab Neon',
  category: 'tech',
  description: 'Terminal hacker, neons verts, esthetique cyberpunk.',
  audience: ['gaming', 'tech', 'geek', 'crypto', 'hacker'],
  darkMode: true,
  colors: {
    accent: '#00FF41',
    bg: '#050505',
    bgAlt: '#020202',
    text: '#00FF41',
    textSecondary: '#ffffff',
    textMuted: '#aaaaaa',
    border: 'rgba(0,255,65,0.5)',
    error: '#ff0000',
  },
  typography: {
    fontPrimary: "'JetBrains Mono', monospace",
    sizeH1: '5rem',
    sizeH2: '2.5rem',
    sizeH3: '1.2rem',
    sizeBody: '1rem',
    weightBlack: '800',
    weightRegular: '400',
  },
  spacing: { sm: '10px', md: '20px', lg: '40px', xl: '80px' },
  components: {
    borderWidth: '1px',
    radius: '0px',
    shadow: '0 0 20px #00FF41',
    transition: '0.3s ease',
    btnPadding: '20px 40px',
    glow: '0 0 20px #00FF41',
  },
};
