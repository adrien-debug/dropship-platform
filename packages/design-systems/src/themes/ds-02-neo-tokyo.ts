import type { DesignSystem } from '../types';

export const ds02: DesignSystem = {
  id: 'ds-02',
  name: 'Neo Tokyo',
  description: 'Dark neon cyberpunk aesthetic',
  audience: ['anime', 'gaming', 'tech', 'geek', 'manga', 'figurines'],
  colors: {
    primary: '#e879f9',
    secondary: '#22d3ee',
    background: '#0a0a0f',
    foreground: '#f0f0f5',
    accent: '#1a1a2e',
    muted: '#16162a',
    border: '#2d2d4a',
    destructive: '#f43f5e',
  },
  fonts: { heading: 'Orbitron', body: 'Rajdhani' },
  borderRadius: '0.5rem',
  darkMode: true,
  shadows: true,
  animations: true,
};
