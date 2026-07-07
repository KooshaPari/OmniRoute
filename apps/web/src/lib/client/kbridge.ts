/**
 * Browser-side kbridge client — opens WS to /api/kbridge, sends KbridgeRequest,
 * awaits KbridgeResponse. Falls back to fetch with ?op=... when WS unavailable.
 */
import type { KbridgeRequest, KbridgeResponse } from '@omniroute/shared-types';

export type KbridgeCall = <T = unknown>(req: Omit<KbridgeRequest, 'id'>) => Promise<T>;

export function browserKbridge(baseUrl = ''): KbridgeCall {
  return async <T = unknown>(req: Omit<KbridgeRequest, 'id'>): Promise<T> => {
    const id = crypto.randomUUID();
    const message = { id, ...req };
    const reply = await fetch(`${baseUrl}/api/kbridge/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!reply.ok) {
      const err = await reply.json().catch(() => ({}));
      throw Object.assign(new Error(err?.error?.message ?? reply.statusText), { code: err?.error?.code });
    }
    const body = (await reply.json()) as KbridgeResponse;
    if (!body.ok) {
      throw Object.assign(new Error(body.error.message), { code: body.error.code });
    }
    return body.data as T;
  };
}
