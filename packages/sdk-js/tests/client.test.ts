import { describe, expect, it } from 'vitest';
import { initClient } from '../src/client.ts';

const baseUrl = 'http://localhost:5173';

describe('sdk-js client', () => {
  it('builds without crashing', () => {
    const c = initClient({ baseUrl });
    expect(typeof c.providers.list).toBe('function');
    expect(typeof c.combos.list).toBe('function');
    expect(typeof c.chat.completions).toBe('function');
    expect(typeof c.health.get).toBe('function');
  });
});
