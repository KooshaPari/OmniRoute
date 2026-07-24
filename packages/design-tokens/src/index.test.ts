import { describe, expect, test } from 'vitest';
import { tokens, type Tokens } from './index';

describe('design tokens', () => {
  test('exposes brand colors', () => {
    expect(tokens.colors.primary).toBe('#e54d5e');
    expect(tokens.colors.accent).toBe('#6366f1');
    expect(tokens.colors['accent-light']).toBe('#a855f7');
  });

  test('all color values are valid hex strings', () => {
    const hexRe = /^#[0-9a-fA-F]{6}$/;
    for (const [name, value] of Object.entries(tokens.colors)) {
      expect(value, `color ${name} should be 6-digit hex`).toMatch(hexRe);
    }
  });

  test('exposes the JetBrains Mono font stack', () => {
    expect(tokens.font.mono).toContain('JetBrains Mono');
    expect(tokens.font.mono).toContain('monospace');
  });

  test('grid size is in px and reasonable', () => {
    const n = Number(tokens.grid.size.replace('px', ''));
    expect(Number.isFinite(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(4);
    expect(n).toBeLessThanOrEqual(64);
  });

  test('brand gradient points in the right direction', () => {
    expect(tokens.gradient.brand).toMatch(/linear-gradient\(.+, .+\)/);
  });

  test('Tokens type is exported and matches tokens shape', () => {
    // Compile-time assertion: this assignment must compile for Tokens to be useful.
    const t: Tokens = tokens;
    expect(t.colors.primary).toBe(tokens.colors.primary);
  });
});
