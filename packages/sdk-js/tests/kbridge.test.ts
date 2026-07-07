import { describe, expect, it } from 'vitest';
import { KbridgeBrowser } from '../src/kbridge.ts';

describe('KbridgeBrowser', () => {
  it('exposes typed helpers', () => {
    const c = new KbridgeBrowser({ baseUrl: 'http://localhost:5173' });
    expect(typeof c.ping).toBe('function');
    expect(typeof c.health).toBe('function');
    expect(typeof c.resolveCombo).toBe('function');
    expect(typeof c.recordUsage).toBe('function');
  });
});
