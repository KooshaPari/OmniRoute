/**
 * Kbridge protocol parity test — these shapes MUST match backend-rust/crates/omniroute-server/src/kbridge.rs.
 */
import { describe, expect, it } from 'vitest';
import { KbridgeRequest, KbridgeResponse } from '../src/kbridge.ts';

describe('kbridge request shapes', () => {
  it('validates ping op', () => {
    const req = { id: '019f3003-fd00-7910-b23e-012452a3fc14', op: 'ping' as const };
    expect(KbridgeRequest.parse(req)).toEqual(req);
  });

  it('validates health op', () => {
    const req = { id: '019f3003-fd00-7910-b23e-012452a3fc14', op: 'health' as const };
    expect(KbridgeRequest.parse(req)).toEqual(req);
  });

  it('validates combo_resolve op', () => {
    const req = { id: '019f3003-fd00-7910-b23e-012452a3fc14', op: 'combo_resolve' as const, name: 'fast', model: 'gpt-4o-mini' };
    expect(KbridgeRequest.parse(req)).toEqual(req);
  });

  it('validates usage_record op', () => {
    const req = {
      id: '019f3003-fd00-7910-b23e-012452a3fc14',
      op: 'usage_record' as const,
      provider: 'openai',
      model: 'gpt-4o',
      tokens: 1234,
      cost: 0.0025,
      ts: Date.now(),
    };
    expect(KbridgeRequest.parse(req)).toEqual(req);
  });

  it('rejects unknown op', () => {
    expect(() => KbridgeRequest.parse({ id: '019f3003-fd00-7910-b23e-012452a3fc14', op: 'unknown' })).toThrow();
  });

  it('rejects missing id', () => {
    expect(() => KbridgeRequest.parse({ op: 'ping' })).toThrow();
  });
});

describe('kbridge response shapes', () => {
  it('validates ok response', () => {
    const res = { id: '019f3003-fd00-7910-b23e-012452a3fc14', ok: true as const, data: { ping: 'pong' } };
    expect(KbridgeResponse.parse(res)).toEqual(res);
  });

  it('validates error response', () => {
    const res = { id: '019f3003-fd00-7910-b23e-012452a3fc14', ok: false as const, error: { code: 'TIMEOUT', message: 'upstream slow' } };
    expect(KbridgeResponse.parse(res)).toEqual(res);
  });
});
