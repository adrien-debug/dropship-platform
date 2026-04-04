import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ds: {
          accent: 'var(--ds-accent)',
          bg: 'var(--ds-bg)',
          'bg-alt': 'var(--ds-bg-alt)',
          text: 'var(--ds-text)',
          'text-secondary': 'var(--ds-text-secondary)',
          'text-muted': 'var(--ds-text-muted)',
          border: 'var(--ds-border)',
        },
      },
      borderRadius: {
        ds: 'var(--ds-radius)',
      },
      borderWidth: {
        ds: 'var(--ds-border-width)',
      },
      fontFamily: {
        ds: 'var(--ds-font-primary)',
        'ds-display': 'var(--ds-font-display, var(--ds-font-primary))',
        'ds-body': 'var(--ds-font-body, var(--ds-font-primary))',
      },
      spacing: {
        'ds-sm': 'var(--ds-space-sm)',
        'ds-md': 'var(--ds-space-md)',
        'ds-lg': 'var(--ds-space-lg)',
        'ds-xl': 'var(--ds-space-xl)',
      },
      transitionDuration: {
        ds: 'var(--ds-transition)',
      },
      boxShadow: {
        ds: 'var(--ds-shadow, none)',
      },
    },
  },
  plugins: [],
};

export default config;
