import type { DesignSystem } from '../types';

export const ds05: DesignSystem = {
  id: 'ds-05',
  name: 'Classic Commerce',
  description: 'Trustworthy blue/white classic e-commerce look',
  audience: ['general', 'ecommerce', 'marketplace', 'multi-produit', 'drop'],
  colors: {
    primary: '#2563eb',
    secondary: '#3b82f6',
    background: '#ffffff',
    foreground: '#1e293b',
    accent: '#eff6ff',
    muted: '#f1f5f9',
    border: '#e2e8f0',
    destructive: '#dc2626',
  },
  fonts: { heading: 'Poppins', body: 'Open Sans' },
  borderRadius: '0.5rem',
  darkMode: false,
  shadows: true,
  animations: false,
};
