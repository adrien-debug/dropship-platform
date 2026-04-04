import type { DesignSystem } from '../types';

export const ds09: DesignSystem = {
  id: 'ds-09',
  name: 'Tech Dark',
  description: 'Dark grays with blue accents, tech-forward',
  audience: ['tech', 'electronics', 'informatique', 'gadgets', 'domotique', 'audio'],
  colors: {
    primary: '#3b82f6',
    secondary: '#6366f1',
    background: '#09090b',
    foreground: '#fafafa',
    accent: '#18181b',
    muted: '#27272a',
    border: '#3f3f46',
    destructive: '#ef4444',
  },
  fonts: { heading: 'Space Grotesk', body: 'IBM Plex Sans' },
  borderRadius: '0.5rem',
  darkMode: true,
  shadows: true,
  animations: true,
};
