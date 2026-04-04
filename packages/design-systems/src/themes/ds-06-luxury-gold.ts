import type { DesignSystem } from '../types';

export const ds06: DesignSystem = {
  id: 'ds-06',
  name: 'Luxury Gold',
  description: 'Black and gold, premium and opulent',
  audience: ['bijoux', 'montres', 'luxe', 'premium', 'accessoires', 'maroquinerie'],
  colors: {
    primary: '#d4a843',
    secondary: '#b8860b',
    background: '#0c0c0c',
    foreground: '#f5f5f0',
    accent: '#1a1a1a',
    muted: '#262626',
    border: '#333333',
    destructive: '#b91c1c',
  },
  fonts: { heading: 'Cormorant Garamond', body: 'Montserrat' },
  borderRadius: '0rem',
  darkMode: true,
  shadows: true,
  animations: true,
};
