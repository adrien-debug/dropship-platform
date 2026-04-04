import type { DesignSystem } from '../types';

export const ds04: DesignSystem = {
  id: 'ds-04',
  name: 'Bold Pop',
  description: 'Vibrant colors, fun and playful',
  audience: ['enfants', 'gadgets', 'jouets', 'fun', 'cadeaux', 'diy'],
  colors: {
    primary: '#f59e0b',
    secondary: '#8b5cf6',
    background: '#fffbeb',
    foreground: '#1c1917',
    accent: '#fef3c7',
    muted: '#fde68a',
    border: '#fcd34d',
    destructive: '#ef4444',
  },
  fonts: { heading: 'Fredoka', body: 'Nunito' },
  borderRadius: '1rem',
  darkMode: false,
  shadows: true,
  animations: true,
};
