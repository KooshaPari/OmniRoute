import { beforeEach, describe, expect, it, vi } from 'vitest';

const reporters = vi.hoisted(() => ({
  onLCP: vi.fn(), onFID: vi.fn(), onCLS: vi.fn(),
  onINP: vi.fn(), onTTFB: vi.fn(), onFCP: vi.fn(),
}));

vi.mock('web-vitals', () => reporters);

describe('web-vitals initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('window', {});
    Object.values(reporters).forEach((reporter) => reporter.mockClear());
  });

  it('registers every reporter exactly once', async () => {
    const { initWebVitals } = await import('./web-vitals');
    initWebVitals();
    initWebVitals();
    Object.values(reporters).forEach((reporter) => expect(reporter).toHaveBeenCalledTimes(1));
  });
});
