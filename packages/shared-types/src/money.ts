/**
 * Money primitives. Integer micro-cents to avoid float drift.
 */
import { z } from 'zod';

export const Currency = z.enum(['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF']);
export type Currency = z.infer<typeof Currency>;

export const MicroCents = z.bigint().min(0n).max(99_999_999_999_999n).brand<'MicroCents'>();
export type MicroCents = z.infer<typeof MicroCents>;

export const BillingCredit = z.object({
  currency: Currency,
  microCents: MicroCents,
  label: z.string().max(120).optional(),
}).readonly();
export type BillingCredit = z.infer<typeof BillingCredit>;

export const Cost = z.object({
  prompt: MicroCents,
  completion: MicroCents,
  total: MicroCents,
  currency: Currency,
}).readonly();
export type Cost = z.infer<typeof Cost>;
