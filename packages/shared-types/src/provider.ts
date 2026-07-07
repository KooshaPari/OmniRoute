/**
 * Provider = upstream LLM API account.
 * Mirrors backend-rust/crates/omniroute-core/src/provider.rs.
 */
import { z } from 'zod';
import { ProviderId, HttpUrl, ISODateString } from './primitives.ts';

export const ProviderKind = z.enum([
  'openai', 'anthropic', 'google', 'openrouter', 'ollama', 'azure',
  'bedrock', 'mistral', 'cohere', 'groq', 'deepseek', 'xai', 'perplexity', 'custom',
]);
export type ProviderKind = z.infer<typeof ProviderKind>;

export const ProviderStatus = z.enum(['active', 'paused', 'error', 'provisioning', 'disabled']);
export type ProviderStatus = z.infer<typeof ProviderStatus>;

export const ProviderAuth = z.discriminatedUnion('method', [
  z.object({ method: z.literal('bearer'), secretRef: z.string() }).readonly(),
  z.object({ method: z.literal('header'), headerName: z.string().max(64), secretRef: z.string() }).readonly(),
  z.object({ method: z.literal('query'), paramName: z.string().max(64), secretRef: z.string() }).readonly(),
  z.object({ method: z.literal('none') }).readonly(),
]);
export type ProviderAuth = z.infer<typeof ProviderAuth>;

export const ProviderConfig = z.object({
  id: ProviderId,
  kind: ProviderKind,
  displayName: z.string().min(1).max(120),
  baseUrl: HttpUrl,
  auth: ProviderAuth,
  enabledModels: z.array(z.string().min(1).max(256)).max(2048),
  defaultModel: z.string().max(256).optional(),
  timeoutMs: z.number().int().min(100).max(600_000).default(60_000),
  maxRetries: z.number().int().min(0).max(10).default(3),
  defaultHeaders: z.record(z.string(), z.string()).default({}),
  proxyUrl: HttpUrl.optional(),
  createdAt: ISODateString,
  updatedAt: ISODateString,
  tags: z.array(z.string().min(1).max(64)).max(32).default([]),
}).readonly();
export type ProviderConfig = z.infer<typeof ProviderConfig>;

export const ProviderPublic = ProviderConfig.omit({ auth: true }).extend({
  status: ProviderStatus,
  lastHealthAt: ISODateString.optional(),
}).readonly();
export type ProviderPublic = z.infer<typeof ProviderPublic>;
