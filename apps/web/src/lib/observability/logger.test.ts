import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

describe('logger', () => {
  let infoSpy: any;
  let warnSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('getLogger returns a logger with all 4 levels', async () => {
    const { getLogger } = await import('./logger');
    const log = getLogger('test');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
  });

  test('info-level emit produces a valid JSON entry with required fields', async () => {
    const { getLogger } = await import('./logger');
    const log = getLogger('test-scope');
    log.info('hello world');
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const line = infoSpy.mock.calls[0][0] as string;
    const entry = JSON.parse(line);
    expect(entry.level).toBe('info');
    expect(entry.scope).toBe('test-scope');
    expect(entry.message).toBe('hello world');
    expect(typeof entry.ts).toBe('string');
    // ISO 8601 timestamp
    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('error-level emit writes to console.error and includes extras', async () => {
    const { getLogger } = await import('./logger');
    const log = getLogger('errors');
    log.error('something broke', { code: 500, path: '/api/v1/x' });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(entry.level).toBe('error');
    expect(entry.scope).toBe('errors');
    expect(entry.message).toBe('something broke');
    expect(entry.code).toBe(500);
    expect(entry.path).toBe('/api/v1/x');
  });

  test('warn-level emit writes to console.warn', async () => {
    const { getLogger } = await import('./logger');
    const log = getLogger('warnings');
    log.warn('deprecation warning');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(entry.level).toBe('warn');
    expect(entry.message).toBe('deprecation warning');
  });
});
