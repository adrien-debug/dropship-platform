import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        serif: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        display: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
      },
      letterSpacing: {
        kicker: '0.30em',
        label: '0.22em',
        cta: '0.18em',
        header: '0.14em',
      },
      fontSize: {
        kicker: ['10px', { lineHeight: '1.5' }],
      },
      boxShadow: {
        cta: '0 22px 40px -18px rgba(0,0,0,0.55)',
        'card-hover': '0 18px 30px -20px rgba(0,0,0,0.25)',
        glow: '0 0 20px rgba(0, 183, 255, 0.08)',
        'glow-strong': '0 0 30px rgba(0, 183, 255, 0.15)',
        // Admin design system shadows
        'admin-card':       'var(--admin-shadow-card)',
        'admin-card-hover': 'var(--admin-shadow-card-hover)',
        'admin-chrome':     'var(--admin-shadow-chrome)',
        'admin-cta':        'var(--admin-shadow-cta)',
      },
      colors: {
        // Admin design system (mirrors --admin-* in globals.css)
        admin: {
          bg:           'var(--admin-bg)',
          'bg-subtle':  'var(--admin-bg-subtle)',
          'bg-muted':   'var(--admin-bg-muted)',
          chrome:       'var(--admin-chrome)',
          'chrome-soft':'var(--admin-chrome-soft)',
          border:       'var(--admin-border)',
          'border-strong': 'var(--admin-border-strong)',
          'border-soft':'var(--admin-border-soft)',
          text:         'var(--admin-text)',
          'text-secondary': 'var(--admin-text-secondary)',
          'text-muted': 'var(--admin-text-muted)',
          'text-faint': 'var(--admin-text-faint)',
          'text-inverse':'var(--admin-text-inverse)',
          accent:       'var(--admin-accent)',
          'accent-hover':'var(--admin-accent-hover)',
          'accent-soft':'var(--admin-accent-soft)',
          success:      'var(--admin-success)',
          'success-soft':'var(--admin-success-soft)',
          warning:      'var(--admin-warning)',
          'warning-soft':'var(--admin-warning-soft)',
          danger:       'var(--admin-danger)',
          'danger-soft':'var(--admin-danger-soft)',
        },
        // Dark theme semantic colors (mirror CSS vars)
        ds: {
          bg: {
            base: '#05070d',
            elevated: '#080b14',
            card: '#0b1020',
            'card-hover': '#0f1528',
            sidebar: '#060810',
          },
          surface: {
            subtle: 'rgba(255, 255, 255, 0.03)',
            DEFAULT: 'rgba(255, 255, 255, 0.05)',
            elevated: 'rgba(255, 255, 255, 0.07)',
          },
          border: {
            subtle: 'rgba(255, 255, 255, 0.06)',
            DEFAULT: 'rgba(255, 255, 255, 0.08)',
            strong: 'rgba(255, 255, 255, 0.12)',
            accent: 'rgba(0, 183, 255, 0.25)',
          },
          text: {
            primary: '#f8fafc',
            secondary: '#94a3b8',
            muted: '#64748b',
            disabled: '#475569',
          },
          accent: {
            cyan: '#00b7ff',
            blue: '#38bdf8',
          },
          semantic: {
            success: '#22c55e',
            warning: '#f59e0b',
            danger: '#ef4444',
            info: '#38bdf8',
          },
        },
      },
      width: {
        sidebar: '72px',
        'sidebar-expanded': '260px',
        'left-panel': '300px',
        'right-panel': '360px',
      },
      height: {
        header: '56px',
        'panel-header': '48px',
      },
      transitionTimingFunction: {
        'ds-default': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        'ds-fast': '150ms',
        'ds-default': '200ms',
        'ds-slow': '300ms',
      },
      borderRadius: {
        'ds-sm': '6px',
        'ds-md': '10px',
        'ds-lg': '14px',
        'ds-xl': '18px',
        // Admin design system radius scale
        'admin-sm': 'var(--admin-radius-sm)',
        'admin-md': 'var(--admin-radius-md)',
        'admin-lg': 'var(--admin-radius-lg)',
        'admin-xl': 'var(--admin-radius-xl)',
      },
      zIndex: {
        panel: '10',
        sticky: '20',
        dropdown: '30',
        modal: '40',
        tooltip: '50',
      },
    },
  },
  plugins: [],
};

export default config;
