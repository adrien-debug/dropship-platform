import type { DesignSystem } from '../types';

export const ds08: DesignSystem = {
  id: 'ds-08',
  name: 'Pastel Bloom',
  description: 'Soft pastels, feminine and elegant',
  audience: ['beaute', 'mode', 'feminine', 'skincare', 'parfum', 'soins'],
  colors: {
    primary: '#ec4899',
    secondary: '#a78bfa',
    background: '#fdf2f8',
    foreground: '#1f1f1f',
    accent: '#fce7f3',
    muted: '#fbcfe8',
    border: '#f9a8d4',
    destructive: '#e11d48',
  },
  fonts: { heading: 'Playfair Display', body: 'Lato' },
  borderRadius: '1rem',
  darkMode: false,
  shadows: false,
  animations: true,
};
