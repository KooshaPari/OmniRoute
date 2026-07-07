/**
 * Combo = ordered chain of provider/model steps with fallback rules.
 */
import { z } from 'zod';
import { ComboId, ProviderId, ISODateString } from './primitives.ts';

export const ComboStepKind = z.enum(['primary', 'fallback', 'race', 'cascade', 'shadow']);
export type ComboStepKind = z.infer<typeof ComboStepKind>;

export const ComboStep = z.object({
  providerId: ProviderId,
  model: z.string().min(1).max(256),
  kind: ComboStepKind,
  weight: z.number().int().min(0).max(100).default(50),
  condition: z.string().max(2048).optional(),
  timeoutMs: z.number().int().min(100).max(600_000).optional(),
}).readonly();
export type ComboStep = z.infer<typeof ComboStep>;

export const Combo = z.object({
  id: ComboId,
  name: z.string().min(1).max(120).regex(/^[a-z0-9][a-z0-9._-]*$/u, 'lowercase slug'),
  displayName: z.string().min(1).max(120),
  description: z.string().max(2048).optional(),
  steps: z.array(ComboStep).min(1).max(32),
  enabled: z.boolean().default(true),
  createdAt: ISODateString,
  updatedAt: ISODateString,
  tags: z.array(z.string().min(1).max(64)).max(32).default([]),
}).readonly();
export type Combo = z.infer<typeof Combo>;

export const ComboResolveRequest = z.object({
  comboName: z.string(),
  model: z.string(),
  hints: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
}).readonly();
export type ComboResolveRequest = z.infer<typeof ComboResolveRequest>;

export const ComboResolveResult = z.object({
  combo: Combo,
  resolvedSteps: z.array(ComboStep).min(1),
  totalWeight: z.number().int().min(0),
  estimatedCost: z.object({
    promptMicroCents: z.bigint().min(0n).max(99_999_999_999_999n),
    completionMicroCents: z.bigint().min(0n).max(99_999_999_999_999n),
  }).readonly(),
}).readonly();
export type ComboResolveResult = z.infer<typeof ComboResolveResult>;
