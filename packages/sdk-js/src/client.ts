/**
 * Hono typed RPC client. Uses hc<AppType> when available; falls back to a
 * fetch-based stub so the SDK can ship before apps/web's AppType is final.
 */
import { hc } from 'hono/client';
import type { SdkAppType } from './types';

export interface ClientOptions {
  baseUrl: string;
  headers?: HeadersInit;
  fetch?: typeof fetch;
}

export function initClient(opts: ClientOptions) {
  const fetchImpl = opts.fetch ?? fetch;
  // The real `hc<SdkAppType>(baseUrl, { ... })` requires the actual Hono app.
  // Until apps/web exports AppType we use a thin fetch wrapper that mirrors
  // its route shape; the contract is identical so swapping in `hc` later is
  // a one-line change.
  return {
    providers: {
      list: () => call<unknown[]>('GET', '/api/providers', undefined, opts, fetchImpl),
      create: (json: unknown) => call<unknown>('POST', '/api/providers', json, opts, fetchImpl),
      patch: (id: string, json: unknown) => call<unknown>('PATCH', `/api/providers/${id}`, json, opts, fetchImpl),
      remove: (id: string) => call<{ id: string; deleted: boolean }>('DELETE', `/api/providers/${id}`, undefined, opts, fetchImpl),
    },
    combos: {
      list: () => call<unknown[]>('GET', '/api/combos', undefined, opts, fetchImpl),
      resolve: (json: unknown) => call<unknown>('POST', '/api/combos/resolve', json, opts, fetchImpl),
    },
    apikeys: {
      list: () => call<unknown[]>('GET', '/api/apikeys', undefined, opts, fetchImpl),
      create: (json: unknown) => call<unknown>('POST', '/api/apikeys', json, opts, fetchImpl),
    },
    chat: {
      completions: (json: unknown) => call<unknown | Response>('POST', '/api/chat/completions', json, opts, fetchImpl),
    },
    usage: {
      list: (q?: Record<string, string>) => call<unknown[]>('GET', `/api/usage${qs(q)}`, undefined, opts, fetchImpl),
      aggregate: (q?: Record<string, string>) => call<unknown>('GET', `/api/usage/aggregate${qs(q)}`, undefined, opts, fetchImpl),
    },
    health: {
      get: () => call<unknown>('GET', '/api/health', undefined, opts, fetchImpl),
    },
  } satisfies {
    [K in keyof SdkAppType]: SdkAppType[K] extends Record<string, (...args: never) => Promise<unknown>>
      ? { [M in keyof SdkAppType[K]]: (...args: Parameters<SdkAppType[K][M]>) => ReturnType<SdkAppType[K][M]> }
      : never;
  };
}

async function call<T>(method: string, path: string, json: unknown, opts: ClientOptions, fetchImpl: typeof fetch): Promise<T> {
  const r = await fetchImpl(new URL(path, opts.baseUrl), {
    method,
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body?.ok === false) {
    const err = body?.error ?? { code: 'INTERNAL_ERROR', message: r.statusText };
    throw Object.assign(new Error(err.message ?? `HTTP ${r.status}`), { code: err.code, status: r.status });
  }
  return body.data as T;
}

function qs(q?: Record<string, string>): string {
  if (!q) return '';
  const u = new URLSearchParams(q).toString();
  return u ? `?${u}` : '';
}

// Re-export for users who want to drop in `hc<AppType>` once apps/web ships.
export { hc };
