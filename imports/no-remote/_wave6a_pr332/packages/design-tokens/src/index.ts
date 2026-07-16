export const tokens = {
  colors: {
    primary: '#e54d5e',
    accent: '#6366f1',
    'accent-light': '#a855f7',
  },
  font: { mono: 'JetBrains Mono, SF Mono, Menlo, monospace' },
  grid: { size: '32px' },
  gradient: { brand: 'linear-gradient(135deg, #e54d5e, #6366f1)' },
} as const;

export type Tokens = typeof tokens;
