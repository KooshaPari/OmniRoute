/**
 * Round-trip tests — parse(z.infer type) must succeed and reproduce the input.
 */
import { describe, expect, it } from 'vitest';
import { ProviderConfig, ProviderPublic } from '../src/provider.ts';
import { ChatRequest, ChatRequestEnvelope, ChatMessage } from '../src/request.ts';
import { ChatResponse, ChatChunk } from '../src/response.ts';
import { UsageRecord } from '../src/usage.ts';
import { HealthReport, PingResponse } from '../src/health.ts';
import { Combo, ComboResolveRequest } from '../src/combo.ts';

const ulid = '01J9X3F4A2B7C5D6E7F8G9H0JK';

describe('Provider roundtrip', () => {
  it('ProviderConfig roundtrip', () => {
    const p = {
      id: ulid, kind: 'openai', displayName: 'OpenAI prod', baseUrl: 'https://api.openai.com/v1',
      auth: { method: 'bearer', secretRef: 'vault://openai/prod' },
      enabledModels: ['gpt-4o', 'gpt-4o-mini'], defaultModel: 'gpt-4o-mini',
      timeoutMs: 60_000, maxRetries: 3, defaultHeaders: {}, createdAt: '2026-07-04T00:00:00Z', updatedAt: '2026-07-04T00:00:00Z', tags: ['prod'],
    };
    expect(ProviderConfig.parse(p)).toEqual(p);
  });

  it('ProviderPublic omits auth', () => {
    const p = {
      id: ulid, kind: 'openai', displayName: 'OpenAI prod', baseUrl: 'https://api.openai.com/v1',
      auth: { method: 'bearer', secretRef: 'vault://openai/prod' },
      enabledModels: ['gpt-4o'], defaultModel: 'gpt-4o',
      timeoutMs: 60_000, maxRetries: 3, defaultHeaders: {}, createdAt: '2026-07-04T00:00:00Z', updatedAt: '2026-07-04T00:00:00Z', tags: [],
      status: 'active' as const,
    };
    const pub = ProviderPublic.parse(p);
    expect(pub).not.toHaveProperty('auth');
  });
});

describe('ChatRequest roundtrip', () => {
  it('validates a basic chat request', () => {
    const req = { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], stream: false };
    expect(ChatRequest.parse(req)).toEqual(req);
  });

  it('rejects empty messages', () => {
    expect(() => ChatRequest.parse({ model: 'gpt-4o-mini', messages: [] })).toThrow();
  });

  it('rejects temperature out of range', () => {
    expect(() => ChatRequest.parse({ model: 'm', messages: [{ role: 'user', content: 'x' }], temperature: 3 })).toThrow();
  });

  it('envelope roundtrip', () => {
    const env = { request: { model: 'gpt-4o', messages: [{ role: 'user' as const, content: 'hi' }], stream: false } };
    expect(ChatRequestEnvelope.parse(env)).toEqual(env);
  });
});

describe('ChatResponse / ChatChunk roundtrip', () => {
  it('validates full response', () => {
    const res = {
      id: 'chatcmpl-1', object: 'chat.completion' as const, created: 1_700_000_000, model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant' as const, content: 'hello' }, finishReason: 'stop' as const }],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cachedTokens: 0 },
    };
    expect(ChatResponse.parse(res)).toEqual(res);
  });

  it('validates streaming chunk', () => {
    const chunk = {
      id: 'chatcmpl-1', object: 'chat.completion.chunk' as const, created: 1_700_000_000, model: 'gpt-4o',
      choices: [{ index: 0, delta: { content: 'hel' }, finishReason: null }],
    };
    expect(ChatChunk.parse(chunk)).toEqual(chunk);
  });
});

describe('UsageRecord roundtrip', () => {
  it('validates usage record', () => {
    const rec = {
      id: ulid, providerId: ulid, model: 'gpt-4o',
      tokens: { prompt: 100, completion: 50, cached: 0 },
      cost: 500000n, latencyMs: 800, finishReason: 'stop' as const, ts: Date.now(), metadata: {},
    };
    expect(UsageRecord.parse(rec)).toEqual(rec);
  });
});

describe('Health / Ping roundtrip', () => {
  it('validates health report', () => {
    const r = { status: 'healthy' as const, version: '4.0.0', uptimeSeconds: 100, components: [], timestamp: '2026-07-04T00:00:00Z' };
    expect(HealthReport.parse(r)).toEqual(r);
  });
  it('validates ping', () => {
    const p = { pong: true as const, latencyMs: 5, ts: Date.now() };
    expect(PingResponse.parse(p)).toEqual(p);
  });
});

describe('Combo roundtrip', () => {
  it('validates combo', () => {
    const c = {
      id: ulid, name: 'fast', displayName: 'Fast combo',
      steps: [{ providerId: ulid, model: 'gpt-4o-mini', kind: 'primary' as const, weight: 80 }],
      enabled: true, createdAt: '2026-07-04T00:00:00Z', updatedAt: '2026-07-04T00:00:00Z', tags: [],
    };
    expect(Combo.parse(c)).toEqual(c);
  });

  it('validates resolve request', () => {
    const r = { comboName: 'fast', model: 'gpt-4o-mini', hints: {} };
    expect(ComboResolveRequest.parse(r)).toEqual(r);
  });
});
