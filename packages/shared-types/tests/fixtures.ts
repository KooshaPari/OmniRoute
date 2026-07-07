/**
 * Canonical fixtures for tests across the monorepo.
 */
import type { ProviderConfig } from '../src/provider.ts';
import type { Combo } from '../src/combo.ts';
import type { ChatRequest } from '../src/request.ts';
import type { ChatResponse } from '../src/response.ts';

export const ULID = '01J9X3F4A2B7C5D6E7F8G9H0JK';

export const fixtureOpenai: ProviderConfig = {
  id: ULID,
  kind: 'openai',
  displayName: 'OpenAI prod',
  baseUrl: 'https://api.openai.com/v1',
  auth: { method: 'bearer', secretRef: 'vault://openai/prod' },
  enabledModels: ['gpt-4o', 'gpt-4o-mini'],
  defaultModel: 'gpt-4o-mini',
  timeoutMs: 60_000,
  maxRetries: 3,
  defaultHeaders: {},
  createdAt: '2026-07-04T00:00:00Z',
  updatedAt: '2026-07-04T00:00:00Z',
  tags: ['prod'],
};

export const fixtureFastCombo: Combo = {
  id: ULID,
  name: 'fast',
  displayName: 'Fast (gpt-4o-mini → claude-haiku)',
  description: 'Cheap, low-latency combo.',
  steps: [
    { providerId: ULID, model: 'gpt-4o-mini', kind: 'primary', weight: 60 },
    { providerId: ULID, model: 'claude-haiku-4-5', kind: 'fallback', weight: 40 },
  ],
  enabled: true,
  createdAt: '2026-07-04T00:00:00Z',
  updatedAt: '2026-07-04T00:00:00Z',
  tags: ['fast'],
};

export const fixtureChatRequest: ChatRequest = {
  model: 'fast:gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello, world!' }],
  stream: false,
  temperature: 0.7,
};

export const fixtureChatResponse: ChatResponse = {
  id: 'chatcmpl-fixture-1',
  object: 'chat.completion',
  created: 1_700_000_000,
  model: 'gpt-4o-mini',
  providerId: ULID,
  comboName: 'fast',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Hi there!' },
      finishReason: 'stop',
    },
  ],
  usage: { promptTokens: 12, completionTokens: 4, totalTokens: 16, cachedTokens: 0 },
  systemFingerprint: 'fp_fixture',
};
