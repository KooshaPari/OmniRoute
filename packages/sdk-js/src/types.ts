/**
 * Placeholder AppType consumed by hono/client hc<AppType>.
 * Real routes live in apps/web/src/lib/server/hono/app.ts — re-exported
 * from there once lane B builds it out. Until then, we keep a structural
 * shim that compiles and lets the SDK ship independently.
 */
import type { ProviderPublic, Combo, ChatRequestEnvelope, ChatResponse, ChatChunk, UsageAggregate, ApiKey, HealthReport, AppError } from '@omniroute/shared-types';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: AppError };

export interface SdkAppType {
  providers: {
    list: (ctx: { headers?: HeadersInit }) => Promise<ApiResult<ProviderPublic[]>>;
    create: (ctx: { json: ProviderPublic; headers?: HeadersInit }) => Promise<ApiResult<ProviderPublic>>;
    patch: (ctx: { json: Partial<ProviderPublic>; params: { id: string }; headers?: HeadersInit }) => Promise<ApiResult<ProviderPublic>>;
    remove: (ctx: { params: { id: string }; headers?: HeadersInit }) => Promise<ApiResult<{ id: string; deleted: boolean }>>;
  };
  combos: {
    list: (ctx: { headers?: HeadersInit }) => Promise<ApiResult<Combo[]>>;
    resolve: (ctx: { json: { comboName: string; model: string; hints?: Record<string, unknown> }; headers?: HeadersInit }) => Promise<ApiResult<unknown>>;
  };
  apikeys: {
    list: (ctx: { headers?: HeadersInit }) => Promise<ApiResult<ApiKey[]>>;
    create: (ctx: { json: { providerId: string; label: string; secret: string; scope?: 'read' | 'chat' | 'admin' }; headers?: HeadersInit }) => Promise<ApiResult<{ id: string; secret: string; fingerprint: string }>>;
  };
  chat: {
    completions: (ctx: { json: ChatRequestEnvelope; headers?: HeadersInit }) => Promise<ApiResult<ChatResponse> | Response>;
  };
  usage: {
    list: (ctx: { query?: Record<string, string>; headers?: HeadersInit }) => Promise<ApiResult<unknown[]>>;
    aggregate: (ctx: { query?: Record<string, string>; headers?: HeadersInit }) => Promise<ApiResult<UsageAggregate>>;
  };
  health: {
    get: (ctx: { headers?: HeadersInit }) => Promise<ApiResult<HealthReport>>;
  };
}

export type { ChatChunk };
