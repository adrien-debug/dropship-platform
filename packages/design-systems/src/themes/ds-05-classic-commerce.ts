import type { DesignSystem } from '../types';

export const ds05: DesignSystem = {
  id: 'ds-05',
  num: '05',
  name: 'Classic Commerce',
  category: 'ecommerce',
  description: 'Trustworthy blue/white classic e-commerce look',
  audience: ['general', 'ecommerce', 'marketplace', 'multi-produit', 'drop'],
  darkMode: false,
  colors: {
    accent: '#2563eb',
    bg: '#ffffff',
    bgAlt: '#f1f5f9',
    text: '#1e293b',
    textSecondary: '#3b82f6',
    textMuted: '#64748b',
    border: '#e2e8f0',
  },
  typography: {
    fontPrimary: "'Poppins', sans-serif",
    fontBody: "'Open Sans', sans-serif",
    sizeH1: '3rem',
    sizeH2: '2.25rem',
    sizeH3: '1.5rem',
    sizeBody: '1rem',
    weightBlack: '800',
    weightBold: '600',
    weightRegular: '400',
  },
  spacing: { sm: '0.5rem', md: '1rem', lg: '2rem', xl: '4rem' },
  components: {
    borderWidth: '1px',
    radius: '0.5rem',
    shadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    transition: '0.2s ease',
    btnPadding: '0.75rem 1.5rem',
  },
};
