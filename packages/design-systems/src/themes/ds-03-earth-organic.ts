import type { DesignSystem } from '../types';

export const ds03: DesignSystem = {
  id: 'ds-03',
  name: 'Earth Organic',
  description: 'Warm earth tones, natural and organic feel',
  audience: ['bio', 'cosmetique', 'sante', 'naturel', 'bien-etre', 'herboristerie'],
  colors: {
    primary: '#78716c',
    secondary: '#a16207',
    background: '#faf7f2',
    foreground: '#292524',
    accent: '#f5f0e8',
    muted: '#e7e0d5',
    border: '#d6cfc4',
    destructive: '#dc2626',
  },
  fonts: { heading: 'Lora', body: 'Source Sans 3' },
  borderRadius: '0.75rem',
  darkMode: false,
  shadows: false,
  animations: false,
};
