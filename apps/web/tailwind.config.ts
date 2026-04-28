import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './lib/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        serif: ['var(--font-display)', ...defaultTheme.fontFamily.serif],
        display: ['var(--font-display)', ...defaultTheme.fontFamily.serif],
      },
      letterSpacing: {
        kicker: '0.30em',
        label:  '0.22em',
        cta:    '0.18em',
      },
      boxShadow: {
        'cta':        '0 22px 40px -18px rgba(0,0,0,0.55)',
        'card-hover': '0 18px 30px -20px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
