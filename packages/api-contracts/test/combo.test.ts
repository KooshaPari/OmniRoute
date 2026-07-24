import { test, expect } from 'vitest';
import { ComboSchema } from '../src/combo';

test('valid combo with all fields', () => {
  const result = ComboSchema.parse({
    id: 'c1',
    name: 'Primary + fallback',
    primary: 'claude-sonnet-4',
    fallbacks: ['gpt-4o', 'gemini-2.5-pro'],
    strategy: 'first-success',
    createdAt: '2026-06-15T00:00:00Z',
  });
  expect(result.id).toBe('c1');
  expect(result.fallbacks).toEqual(['gpt-4o', 'gemini-2.5-pro']);
  expect(result.strategy).toBe('first-success');
});

test('defaults fallbacks to [] when omitted', () => {
  const result = ComboSchema.parse({
    id: 'c1',
    name: 'Solo',
    primary: 'claude-sonnet-4',
  });
  expect(result.fallbacks).toEqual([]);
});

test('defaults strategy to first-success', () => {
  const result = ComboSchema.parse({
    id: 'c1',
    name: 'Solo',
    primary: 'claude-sonnet-4',
    fallbacks: [],
  });
  expect(result.strategy).toBe('first-success');
});

test('rejects empty name', () => {
  expect(() => ComboSchema.parse({ id: 'c1', name: '', primary: 'x', fallbacks: [] })).toThrow();
});

test('rejects name longer than 255', () => {
  expect(() =>
    ComboSchema.parse({ id: 'c1', name: 'x'.repeat(256), primary: 'y', fallbacks: [] })
  ).toThrow();
});

test('rejects unknown strategy', () => {
  expect(() =>
    ComboSchema.parse({ id: 'c1', name: 'X', primary: 'x', fallbacks: [], strategy: 'random' })
  ).toThrow();
});

test('accepts all 4 documented strategies', () => {
  for (const strategy of ['first-success', 'round-robin', 'cost-optimized', 'latency-optimized']) {
    const result = ComboSchema.parse({ id: 'c1', name: 'X', primary: 'x', fallbacks: [], strategy });
    expect(result.strategy).toBe(strategy);
  }
});
