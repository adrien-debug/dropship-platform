import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#1a1a2e', light: '#16213e', accent: '#0f3460', highlight: '#e94560' },
      },
    },
  },
  plugins: [],
};

export default config;
