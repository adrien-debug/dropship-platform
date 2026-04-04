import type { DesignSystem } from '../types';

export const ds01: DesignSystem = {
  id: 'ds-01',
  name: 'Minimal White',
  description: 'Clean, minimal, luxurious feel',
  audience: ['lifestyle', 'mode', 'beaute', 'cosmetique', 'premium'],
  colors: {
    primary: '#000000',
    secondary: '#6b7280',
    background: '#ffffff',
    foreground: '#111827',
    accent: '#f3f4f6',
    muted: '#f9fafb',
    border: '#e5e7eb',
    destructive: '#ef4444',
  },
  fonts: { heading: 'Playfair Display', body: 'Inter' },
  borderRadius: '0.25rem',
  darkMode: false,
  shadows: false,
  animations: true,
};
