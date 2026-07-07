/**
 * Quota — provider or model level rate limits and consumption.
 */
import { z } from 'zod';
import { ProviderId } from './primitives.ts';
import { MicroCents } from './money.ts';
import { ISODateString } from './primitives.ts';

export const QuotaWindow = z.enum(['minute', 'hour', 'day', 'week', 'month']);
export type QuotaWindow = z.infer<typeof QuotaWindow>;

export const QuotaState = z.object({
  providerId: ProviderId,
  window: QuotaWindow,
  tokensUsed: z.number().int().min(0),
  tokensLimit: z.number().int().min(0).nullable(),
  costUsed: MicroCents,
  costLimit: MicroCents.nullable(),
  requestsUsed: z.number().int().min(0),
  requestsLimit: z.number().int().min(0).nullable(),
  resetsAt: ISODateString.nullable(),
  isExhausted: z.boolean(),
}).readonly();
export type QuotaState = z.infer<typeof QuotaState>;
