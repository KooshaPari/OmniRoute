import type { Config } from 'tailwindcss';

export default {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        accent: 'var(--color-accent)',
        'accent-light': 'var(--color-accent-light)',
      },
      fontFamily: { mono: 'JetBrains Mono, SF Mono, Menlo, monospace' },
    },
  },
} satisfies Partial<Config>;
