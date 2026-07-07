/**
 * Kbridge protocol — exact mirror of:
 *   backend-rust/crates/omniroute-server/src/kbridge.rs (Request enum)
 *   OmniRoute-frontend-svelte-2026-07-05/apps/bff/src/kbridge/protocol.ts (TS)
 *
 * Wire format: 4-byte BE length-prefix + msgpack payload.
 */
import { z } from 'zod';
import { AppError } from './error.ts';

export const KbridgeRequest = z.discriminatedUnion('op', [
  z.object({ id: z.string().uuid(), op: z.literal('ping') }).readonly(),
  z.object({ id: z.string().uuid(), op: z.literal('health') }).readonly(),
  z.object({ id: z.string().uuid(), op: z.literal('combo_resolve'), name: z.string(), model: z.string() }).readonly(),
  z.object({
    id: z.string().uuid(),
    op: z.literal('usage_record'),
    provider: z.string(),
    model: z.string(),
    tokens: z.number().int().min(0),
    cost: z.number().min(0),
    ts: z.number().int().min(0),
  }).readonly(),
]);
export type KbridgeRequest = z.infer<typeof KbridgeRequest>;

export const KbridgeResponse = z.union([
  z.object({ id: z.string().uuid(), ok: z.literal(true), data: z.unknown() }).readonly(),
  z.object({ id: z.string().uuid(), ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }).readonly() }).readonly(),
]);
export type KbridgeResponse = z.infer<typeof KbridgeResponse>;

export const KbridgeFrame = z.object({
  /** 4-byte BE length prefix; the envelope pads the body in encoding. */
  length: z.number().int().min(0).max(16 * 1024 * 1024),
  body: z.union([KbridgeRequest, KbridgeResponse]),
}).readonly();
export type KbridgeFrame = z.infer<typeof KbridgeFrame>;

/** AppError bridge from Kbridge error.code strings. */
export const KbridgeErrorToAppError = (id: string, code: string, message: string): { id: string; ok: false; error: AppError } => ({
  id,
  ok: false,
  error: { code: 'INTERNAL_ERROR', message: `kbridge[${code}]: ${message}` } as AppError,
});
