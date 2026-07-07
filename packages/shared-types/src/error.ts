/**
 * Canonical error envelope. Hono middleware serializes AppError -> JSON.
 */
import { z } from 'zod';

export const ErrorCode = z.enum([
  'NOT_FOUND', 'VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN',
  'RATE_LIMITED', 'CONFLICT', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_TIMEOUT',
  'PROVIDER_NOT_CONFIGURED', 'MODEL_NOT_FOUND', 'QUOTA_EXHAUSTED',
  'COMBO_UNRESOLVABLE', 'AUTH_PROVIDER_ERROR', 'INTERNAL_ERROR', 'BAD_GATEWAY',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const AppError = z.discriminatedUnion('code', [
  z.object({ code: z.literal('NOT_FOUND'), message: z.string(), resource: z.string(), id: z.string() }).readonly(),
  z.object({ code: z.literal('VALIDATION_ERROR'), message: z.string(), issues: z.array(z.object({ path: z.string(), message: z.string() })).readonly() }).readonly(),
  z.object({ code: z.literal('UNAUTHORIZED'), message: z.string() }).readonly(),
  z.object({ code: z.literal('FORBIDDEN'), message: z.string(), resource: z.string().optional() }).readonly(),
  z.object({ code: z.literal('RATE_LIMITED'), message: z.string(), retryAfterSeconds: z.number().int().nonnegative() }).readonly(),
  z.object({ code: z.literal('CONFLICT'), message: z.string(), conflictingField: z.string() }).readonly(),
  z.object({ code: z.literal('UPSTREAM_UNAVAILABLE'), message: z.string(), provider: z.string() }).readonly(),
  z.object({ code: z.literal('UPSTREAM_TIMEOUT'), message: z.string(), provider: z.string(), elapsedMs: z.number() }).readonly(),
  z.object({ code: z.literal('PROVIDER_NOT_CONFIGURED'), message: z.string(), provider: z.string() }).readonly(),
  z.object({ code: z.literal('MODEL_NOT_FOUND'), message: z.string(), model: z.string() }).readonly(),
  z.object({ code: z.literal('QUOTA_EXHAUSTED'), message: z.string(), provider: z.string(), resetAt: z.iso.datetime() }).readonly(),
  z.object({ code: z.literal('COMBO_UNRESOLVABLE'), message: z.string(), combo: z.string(), triedProviders: z.array(z.string()) }).readonly(),
  z.object({ code: z.literal('AUTH_PROVIDER_ERROR'), message: z.string(), provider: z.string() }).readonly(),
  z.object({ code: z.literal('INTERNAL_ERROR'), message: z.string(), requestId: z.string().optional() }).readonly(),
  z.object({ code: z.literal('BAD_GATEWAY'), message: z.string(), upstream: z.string() }).readonly(),
]);
export type AppError = z.infer<typeof AppError>;

export const AppErrorEnvelope = z.object({ ok: z.literal(false), error: AppError }).readonly();
export type AppErrorEnvelope = z.infer<typeof AppErrorEnvelope>;
