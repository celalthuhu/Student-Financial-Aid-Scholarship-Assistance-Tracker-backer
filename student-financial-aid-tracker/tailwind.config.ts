import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#38BDF8', deep: '#0284C7', light: '#E0F2FE', softer: '#F0F9FF' },
        ink: '#0F172A',
        muted: '#64748B',
        line: '#E2E8F0',
      },
    },
  },
  plugins: [],
};

export default config;
