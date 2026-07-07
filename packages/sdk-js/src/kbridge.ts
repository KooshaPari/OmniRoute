/**
 * Browser-side kbridge client. Browsers cannot open Unix sockets directly,
 * so this layer speaks to /api/kbridge on apps/web, which forwards the
 * msgpack frames to the omniroute-server kbridge daemon.
 */
import type { KbridgeRequest, KbridgeResponse } from '@omniroute/shared-types';

export interface KbridgeOptions {
  baseUrl?: string;
  /** Use WebSocket instead of fetch. */
  websocket?: boolean;
}

export class KbridgeBrowser {
  private ws: WebSocket | null = null;
  private inflight = new Map<string, { resolve: (v: KbridgeResponse) => void; reject: (e: Error) => void }>();

  constructor(public readonly options: KbridgeOptions = {}) {}

  async call<T = unknown>(req: Omit<KbridgeRequest, 'id'>): Promise<T> {
    const id = crypto.randomUUID();
    if (this.options.websocket) return this.callWs<T>(id, req);
    return this.callFetch<T>(id, req);
  }

  private async callFetch<T>(id: string, req: Omit<KbridgeRequest, 'id'>): Promise<T> {
    const r = await fetch(`${this.options.baseUrl ?? ''}/api/kbridge/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, ...req }),
    });
    const body = (await r.json()) as KbridgeResponse;
    if (!body.ok) {
      throw Object.assign(new Error(body.error.message), { code: body.error.code });
    }
    return body.data as T;
  }

  private callWs<T>(id: string, req: Omit<KbridgeRequest, 'id'>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const ws = this.ensureWs();
      this.inflight.set(id, {
        resolve: (reply) => reply.ok ? resolve(reply.data as T) : reject(Object.assign(new Error(reply.error.message), { code: reply.error.code })),
        reject,
      });
      ws.addEventListener('message', (ev) => {
        try {
          const reply = JSON.parse(typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer)) as KbridgeResponse;
          const p = this.inflight.get(reply.id);
          if (p) { this.inflight.delete(reply.id); p.resolve(reply); }
        } catch (e) {
          for (const p of this.inflight.values()) p.reject(e as Error);
          this.inflight.clear();
        }
      });
      ws.send(JSON.stringify({ id, ...req }));
    });
  }

  private ensureWs(): WebSocket {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return this.ws;
    const u = new URL('/api/kbridge', this.options.baseUrl ?? window.location.origin);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(u);
    return this.ws;
  }

  ping() { return this.call<{ pong: true; latencyMs: number; ts: number }>({ op: 'ping' }); }
  health() { return this.call<unknown>({ op: 'health' }); }
  resolveCombo(name: string, model: string) {
    return this.call<unknown>({ op: 'combo_resolve', name, model });
  }
  recordUsage(provider: string, model: string, tokens: number, cost: number) {
    return this.call<unknown>({ op: 'usage_record', provider, model, tokens, cost, ts: Date.now() });
  }
}
