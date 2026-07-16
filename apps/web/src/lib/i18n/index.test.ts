import { afterEach, describe, expect, it } from 'vitest';

import { getLocale, isRTL, setLocale, t } from './index.svelte';

afterEach(() => {
  setLocale('en');
});

describe('runtime i18n state', () => {
  it('can be imported and read during server rendering', () => {
    expect(getLocale()).toBe('en');
    expect(t('nav.dashboard')).toBe('Dashboard');
  });

  it('updates translations and direction from the shared reactive locale', () => {
    setLocale('es');

    expect(getLocale()).toBe('es');
    expect(t('nav.dashboard')).toBe('Panel');
    expect(isRTL()).toBe(false);

    setLocale('ar');
    expect(getLocale()).toBe('ar');
    expect(isRTL()).toBe(true);
  });

  it('falls back safely for unsupported locales and missing messages', () => {
    setLocale('not-a-locale');

    expect(getLocale()).toBe('en');
    expect(t('missing.key', 'fallback')).toBe('fallback');
  });
});
