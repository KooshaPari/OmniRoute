import { test, expect } from 'vitest';
import { ProviderSchema } from '../src/provider';

test('valid provider', () => {
  const result = ProviderSchema.parse({
    id: 'p1',
    name: 'Anthropic',
    type: 'anthropic',
    config: {},
  });
  expect(result.id).toBe('p1');
});

test('invalid type', () => {
  expect(() =>
    ProviderSchema.parse({ id: 'p1', name: 'X', type: 'unknown', config: {} })
  ).toThrow();
});
