/**
 * UsageRecord — written per request, persisted to call_logs.
 * Matches kbridge usage_record op on backend-rust.
 */
import { z } from 'zod';
import { ProviderId, ModelId, RequestId, ISODateString } from './primitives.ts';
import { MicroCents } from './money.ts';

export const UsageRecord = z.object({
  id: RequestId,
  providerId: ProviderId,
  model: z.string().min(1).max(256),
  tokens: z.object({
    prompt: z.number().int().min(0).max(10_000_000),
    completion: z.number().int().min(0).max(10_000_000),
    cached: z.number().int().min(0).max(10_000_000).default(0),
  }).readonly(),
  cost: MicroCents,
  latencyMs: z.number().int().min(0).max(600_000),
  finishReason: z.enum(['stop', 'length', 'tool_calls', 'content_filter', 'error', 'canceled']),
  /** When the request was issued. */
  ts: z.number().int().min(0),
  userId: z.string().optional(),
  comboName: z.string().optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
}).readonly();
export type UsageRecord = z.infer<typeof UsageRecord>;

export const UsageAggregate = z.object({
  providerId: ProviderId.optional(),
  model: z.string().optional(),
  windowStart: ISODateString,
  windowEnd: ISODateString,
  totalRequests: z.number().int().min(0),
  totalPromptTokens: z.number().int().min(0),
  totalCompletionTokens: z.number().int().min(0),
  totalCost: MicroCents,
  averageLatencyMs: z.number().min(0),
  errorRate: z.number().min(0).max(1),
}).readonly();
export type UsageAggregate = z.infer<typeof UsageAggregate>;

export const UsageQuery = z.object({
  providerId: ProviderId.optional(),
  model: z.string().optional(),
  comboName: z.string().optional(),
  start: ISODateString.optional(),
  end: ISODateString.optional(),
  limit: z.number().int().min(1).max(10_000).default(100),
  cursor: z.string().optional(),
}).readonly();
export type UsageQuery = z.infer<typeof UsageQuery>;
