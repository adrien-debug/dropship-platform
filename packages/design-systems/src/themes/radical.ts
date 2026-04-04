import type { DesignSystem } from '../types';

export const radical: DesignSystem = {
  id: 'radical',
  num: '04',
  name: 'Radical Dark',
  category: 'bold',
  description: 'Brutalisme absolu, contrastes violents, typographie massive.',
  audience: ['streetwear', 'music', 'sport', 'urban', 'bold', 'figurines'],
  darkMode: true,
  colors: {
    accent: '#FFFF00',
    bg: '#000000',
    bgAlt: '#111111',
    text: '#ffffff',
    textSecondary: '#cccccc',
    textMuted: '#888888',
    border: '#ffffff',
  },
  typography: {
    fontPrimary: "'Syne', sans-serif",
    sizeH1: '7rem',
    sizeH2: '4rem',
    sizeH3: '1.5rem',
    sizeBody: '1.1rem',
    weightBlack: '800',
  },
  spacing: { sm: '15px', md: '25px', lg: '40px', xl: '80px' },
  components: {
    borderWidth: '6px',
    radius: '0px',
    transition: '0.1s ease',
    btnPadding: '25px 60px',
    skew: '-5deg',
  },
};
