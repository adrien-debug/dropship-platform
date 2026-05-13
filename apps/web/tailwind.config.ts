import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './lib/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        // Satoshi Variable everywhere. The serif/display aliases stay
        // pointed at the same family so existing `font-serif` / `font-display`
        // usages keep working — visual hierarchy now comes from weight + size,
        // not from a separate display font.
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        serif: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        display: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
      },
      letterSpacing: {
        kicker: '0.30em',
        label:  '0.22em',
        cta:    '0.18em',
        header: '0.14em',
      },
      fontSize: {
        kicker: ['10px', { lineHeight: '1.5' }],
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
