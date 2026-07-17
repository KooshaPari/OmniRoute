import { afterEach, describe, expect, it } from 'vitest';

import { getLocale, isRTL, setLocale, t } from '../../../src/lib/i18n/index.svelte';

afterEach(() => {
  setLocale('en');
});

describe('runtime i18n state', () => {
  it('can be imported and read during server rendering', () => {
    expect(getLocale()).toBe('en');
    expect(t('nav.dashboard')).toBe('Dashboard');
  });

  it('updates translations for a bundled locale', () => {
    setLocale('es');
    expect(getLocale()).toBe('es');
    expect(t('nav.dashboard')).toBe('Panel');
    expect(isRTL()).toBe(false);
  });

  it('retains supported locale state while falling back to English messages', () => {
    setLocale('pl');
    expect(getLocale()).toBe('pl');
    expect(t('nav.dashboard')).toBe('Dashboard');
  });

  it('retains RTL state while falling back to English messages', () => {
    setLocale('ar');
    expect(getLocale()).toBe('ar');
    expect(isRTL()).toBe(true);
    expect(t('missing.key', 'fallback')).toBe('fallback');
  });

  it('falls back safely for unsupported locales', () => {
    setLocale('not-a-locale');
    expect(getLocale()).toBe('en');
    expect(t('missing.key', 'fallback')).toBe('fallback');
  });
});
