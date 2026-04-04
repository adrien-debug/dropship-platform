import type { DesignSystem } from '../types';

export const ds10: DesignSystem = {
  id: 'ds-10',
  name: 'Streetwear',
  description: 'Urban, graffiti-inspired, bold and raw',
  audience: ['streetwear', 'sneakers', 'urban', 'hip-hop', 'skate', 'mode-urbaine'],
  colors: {
    primary: '#facc15',
    secondary: '#f43f5e',
    background: '#111111',
    foreground: '#f5f5f5',
    accent: '#1e1e1e',
    muted: '#2a2a2a',
    border: '#404040',
    destructive: '#ff3333',
  },
  fonts: { heading: 'Anton', body: 'Rubik' },
  borderRadius: '0rem',
  darkMode: true,
  shadows: true,
  animations: true,
};
