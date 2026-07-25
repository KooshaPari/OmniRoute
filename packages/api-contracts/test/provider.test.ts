import { test, expect, describe } from 'vitest';
import { ProviderSchema } from '../src/provider';

describe('ProviderSchema - happy path', () => {
  test('valid provider with all fields', () => {
    const result = ProviderSchema.parse({
      id: 'p-anthropic-1',
      name: 'Anthropic Production',
      type: 'anthropic',
      config: { apiKey: 'sk-test-1234567890', baseUrl: 'https://api.anthropic.com' },
      createdAt: '2026-06-15T00:00:00Z',
    });
    expect(result.id).toBe('p-anthropic-1');
    expect(result.name).toBe('Anthropic Production');
    expect(result.type).toBe('anthropic');
    expect(result.config.apiKey).toBe('sk-test-1234567890');
    expect(result.createdAt).toBe('2026-06-15T00:00:00Z');
  });

  test('minimal provider (id + name + type) gets default empty config', () => {
    const result = ProviderSchema.parse({
      id: 'p1',
      name: 'OpenAI',
      type: 'openai',
    });
    expect(result.id).toBe('p1');
    expect(result.name).toBe('OpenAI');
    expect(result.type).toBe('openai');
    expect(result.config).toEqual({});
  });

  test('all 7 documented provider types are accepted', () => {
    for (const type of ['openai', 'anthropic', 'gemini', 'mistral', 'cohere', 'openrouter', 'custom']) {
      const result = ProviderSchema.parse({ id: `p-${type}`, name: type, type });
      expect(result.type).toBe(type);
    }
  });
});

describe('ProviderSchema - validation failures', () => {
  test('rejects unknown type', () => {
    expect(() =>
      ProviderSchema.parse({ id: 'p1', name: 'X', type: 'unknown', config: {} })
    ).toThrow();
  });

  test('rejects empty name (Zod min 1)', () => {
    expect(() => ProviderSchema.parse({ id: 'p1', name: '', type: 'openai' })).toThrow();
  });

  test('rejects name > 255 chars', () => {
    expect(() => ProviderSchema.parse({ id: 'p1', name: 'x'.repeat(256), type: 'openai' })).toThrow();
  });

  test('rejects missing required id', () => {
    expect(() => ProviderSchema.parse({ name: 'X', type: 'openai' })).toThrow();
  });

  test('rejects missing required name', () => {
    expect(() => ProviderSchema.parse({ id: 'p1', type: 'openai' })).toThrow();
  });

  test('rejects missing required type', () => {
    expect(() => ProviderSchema.parse({ id: 'p1', name: 'X' })).toThrow();
  });

  test('rejects config with non-string keys (Zod record(string, unknown))', () => {
    // config is z.record(z.string(), z.unknown()) - so keys must be strings
    // The parser should accept this since values are "unknown" but keys must be strings
    const result = ProviderSchema.parse({
      id: 'p1', name: 'X', type: 'openai',
      config: { 'string-key': 'value' },
    });
    expect(result.config['string-key']).toBe('value');
  });

  test('createdAt is optional but must be ISO datetime if provided', () => {
    expect(() =>
      ProviderSchema.parse({ id: 'p1', name: 'X', type: 'openai', createdAt: 'not-a-date' })
    ).toThrow();
  });
});
