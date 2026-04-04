import type { DesignSystem } from '../types';

export const ds07: DesignSystem = {
  id: 'ds-07',
  name: 'Sport Energy',
  description: 'Dynamic red/black for high-energy sports',
  audience: ['sport', 'fitness', 'outdoor', 'running', 'musculation', 'nutrition'],
  colors: {
    primary: '#dc2626',
    secondary: '#f97316',
    background: '#0f0f0f',
    foreground: '#fafafa',
    accent: '#1c1c1c',
    muted: '#262626',
    border: '#404040',
    destructive: '#fbbf24',
  },
  fonts: { heading: 'Bebas Neue', body: 'Barlow' },
  borderRadius: '0.25rem',
  darkMode: true,
  shadows: true,
  animations: true,
};
