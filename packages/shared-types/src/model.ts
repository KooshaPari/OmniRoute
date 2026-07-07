/**
 * Model = provider-scoped catalog entry.
 */
import { z } from 'zod';
import { ProviderId } from './primitives.ts';
import { MicroCents, Currency, Cost } from './money.ts';

export const ModelCapability = z.enum([
  'chat', 'completion', 'vision', 'tools', 'json_mode', 'streaming',
  'reasoning', 'embeddings', 'image_generation', 'audio_input', 'audio_output',
]);
export type ModelCapability = z.infer<typeof ModelCapability>;

export const ModelPricing = z.object({
  prompt: MicroCents,
  completion: MicroCents,
  currency: Currency,
  isFree: z.boolean().default(false),
}).readonly();
export type ModelPricing = z.infer<typeof ModelPricing>;

export const ModelQuota = z.object({
  tokensPerMinute: z.number().int().nonnegative().nullable(),
  tokensPerDay: z.number().int().nonnegative().nullable(),
  costPerDay: MicroCents.nullable(),
  resetsAt: z.iso.datetime().nullable(),
}).readonly();
export type ModelQuota = z.infer<typeof ModelQuota>;

export const Model = z.object({
  id: z.string(),
  providerId: ProviderId,
  name: z.string().min(1).max(256),
  displayName: z.string().min(1).max(256),
  contextWindow: z.number().int().min(1).max(10_000_000),
  maxOutputTokens: z.number().int().min(1).max(1_000_000),
  capabilities: z.array(ModelCapability).min(1),
  pricing: ModelPricing,
  quota: ModelQuota.optional(),
  enabled: z.boolean().default(true),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
}).readonly();
export type Model = z.infer<typeof Model>;
