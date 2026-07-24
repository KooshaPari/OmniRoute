import { describe, expect, test } from 'vitest';
import { EnvSchema } from './env';

// env.ts exports `env` (parsed result) which is computed at module load.
// Re-parse a fresh object per test using safeParse so we can probe validation
// behavior without polluting process.env for other tests.

describe('BFF env schema', () => {
  test('accepts defaults when no env vars are set', () => {
    // Strip all BFF_* env vars so we exercise the defaults.
    const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
    for (const k of Object.keys(cleanEnv)) {
      if (k.startsWith('BFF_') || k === 'PORT' || k === 'OMNIROUTE_UPSTREAM' || k === 'NODE_ENV') {
        delete cleanEnv[k];
      }
    }
    const r = EnvSchema.safeParse(cleanEnv);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.PORT).toBe(4322);
      expect(r.data.BFF_API_KEY.length).toBeGreaterThanOrEqual(16);
      expect(r.data.NODE_ENV).toBe('development');
    }
  });

  test('rejects BFF_API_KEY that is too short', () => {
    const r = EnvSchema.safeParse({ ...process.env, BFF_API_KEY: 'short' });
    expect(r.success).toBe(false);
  });

  test('rejects invalid PORT (out of range)', () => {
    const r = EnvSchema.safeParse({ ...process.env, PORT: '999999' });
    expect(r.success).toBe(false);
  });

  test('coerces numeric env vars', () => {
    const r = EnvSchema.safeParse({
      ...process.env,
      PORT: '5000',
      BFF_RATE_LIMIT_RPM: '1200',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.PORT).toBe(5000);
      expect(r.data.BFF_RATE_LIMIT_RPM).toBe(1200);
    }
  });
});
