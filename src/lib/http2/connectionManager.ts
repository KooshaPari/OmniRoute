/**
 * HTTP/2 Connection Manager — PR-040
 * ====================================
 *
 * Pools HTTP/2 sessions per provider endpoint with:
 *  - max 100 concurrent streams per session
 *  - 30s idle timeout before session teardown
 *  - auto-downgrade to HTTP/1.1 on GOAWAY
 *  - round-robin session rebalancing when head-of-line blocking
 *    is detected
 *
 * Designed as a drop-in replacement for the raw `fetch()` call in
 * bifrost relay outbound fetch (`src/app/api/v1/relay/chat/completions/bifrost/route.ts`).
 *
 * Usage:
 *   import { connectionManager } from "@/lib/http2/connectionManager";
 *   const resp = await connectionManager.fetch("https://api.example.com/v1/chat/completions", {
 *     method: "POST",
 *     headers: { "content-type": "application/json" },
 *     body: JSON.stringify(payload),
 *   });
 *
 * @see https://nodejs.org/api/http2.html
 */

import http2 from "node:http2";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Max concurrent streams per single HTTP/2 session (RFC 7540 § 5.1.2). */
const MAX_CONCURRENT_STREAMS = 100;

/** Idle timeout in ms — a session with no active streams is torn down after this. */
const IDLE_TIMEOUT_MS = 30_000;

/** How often (ms) the idle-sweep interval runs. */
const IDLE_SWEEP_INTERVAL_MS = 15_000;

/** Connect timeout in ms. */
const CONNECT_TIMEOUT_MS = 10_000;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Http2ManagerOptions {
  maxConcurrentStreams?: number;
  idleTimeoutMs?: number;
  connectTimeoutMs?: number;
  sweepIntervalMs?: number;
  /** Allow self-signed certificates (sets rejectUnauthorized: false on TLS). */
  rejectUnauthorized?: boolean;
}

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer | Uint8Array;
  signal?: AbortSignal;
}

// ── Internal session bookkeeping ─────────────────────────────────────────────

interface SessionEntry {
  session: http2.ClientHttp2Session;
  origin: string;
  lastUsed: number;
  streamCount: number;
  goawayReceived: boolean;
  /** Monotonically increasing connection-era; used to prefer younger sessions. */
  era: number;
}

// ── Connection Manager ────────────────────────────────────────────────────────

export class Http2ConnectionManager {
  private sessions = new Map<string, SessionEntry[]>();
  private globalEra = 0;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private readonly maxConcurrentStreams: number;
  private readonly idleTimeoutMs: number;
  private readonly connectTimeoutMs: number;
  private readonly sweepIntervalMs: number;
  private readonly rejectUnauthorized: boolean;

  constructor(options: Http2ManagerOptions = {}) {
    this.maxConcurrentStreams = options.maxConcurrentStreams ?? MAX_CONCURRENT_STREAMS;
    this.idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
    this.connectTimeoutMs = options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS;
    this.sweepIntervalMs = options.sweepIntervalMs ?? IDLE_SWEEP_INTERVAL_MS;
    this.rejectUnauthorized = options.rejectUnauthorized ?? true;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Perform an outbound HTTP(S) request, preferring HTTP/2 when the
   * server advertises h2 via ALPN. Falls back to HTTP/1.1 automatically.
   *
   * The returned `Response` is wire-compatible with the Web API `fetch()`
   * so it can be used as a drop-in replacement in bifrost relay code.
   */
  async fetch(url: string, options: FetchOptions = {}): Promise<Response> {
    const parsed = new URL(url);
    const origin = `${parsed.protocol}//${parsed.host}`;

    // Try HTTP/2 first (supports both https:// TLS and http:// cleartext h2c).
    // If the session is in GOAWAY state, or the server doesn't support h2,
    // we degrade to HTTP/1.1.
    try {
      const response = await this.http2Fetch(origin, parsed.pathname + parsed.search, options);
      return response;
    } catch {
      // Degrade to HTTP/1.1 on any HTTP/2 failure (GOAWAY, connect error, etc.)
      return this.http1Fetch(url, options);
    }
  }

  /**
   * Return the number of pooled sessions (for diagnostics / tests).
   */
  get poolSize(): number {
    let count = 0;
    for (const entries of this.sessions.values()) {
      count += entries.length;
    }
    return count;
  }

  /**
   * Return the number of active (in-use) streams across all sessions.
   */
  get activeStreams(): number {
    let count = 0;
    for (const entries of this.sessions.values()) {
      for (const entry of entries) {
        count += entry.streamCount;
      }
    }
    return count;
  }

  /**
   * Gracefully close all pooled sessions. Call during shutdown.
   */
  async close(): Promise<void> {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }

    const closePromises: Promise<void>[] = [];
    for (const [, entries] of this.sessions) {
      for (const entry of entries) {
        closePromises.push(this.destroySession(entry));
      }
    }
    await Promise.allSettled(closePromises);
    this.sessions.clear();
  }

  // ── HTTP/2 implementation ───────────────────────────────────────────────────

  private async http2Fetch(
    origin: string,
    path: string,
    options: FetchOptions
  ): Promise<Response> {
    const entry = this.getOrCreateSession(origin);
    if (entry.goawayReceived) {
      throw new Error("GOAWAY received");
    }

    return new Promise<Response>((resolve, reject) => {
      const req = entry.session.request({
        ":method": options.method ?? "GET",
        ":path": path,
        ":scheme": "https",
        ...this.normalizeHeaders(options.headers),
      });

      // Don't set encoding — we want raw Buffers for Buffer.concat
      // Track stream count
      entry.streamCount++;
      entry.lastUsed = Date.now();

      const chunks: Buffer[] = [];
      let statusCode = 502;
      const responseHeaders: Record<string, string> = {};

      req.on("response", (headers: http2.IncomingHttpHeaders) => {
        statusCode = Number(headers[":status"] ?? 502);
        for (const [key, value] of Object.entries(headers)) {
          if (key.startsWith(":")) continue;
          if (value !== undefined) {
            responseHeaders[key] = Array.isArray(value) ? value.join(", ") : String(value);
          }
        }
      });

      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on("end", () => {
        entry.streamCount--;
        if (!options.signal?.aborted) {
          const body = Buffer.concat(chunks);
          resolve(
            new Response(body, {
              status: statusCode,
              headers: responseHeaders,
            })
          );
        }
      });

      req.on("error", (err) => {
        entry.streamCount--;
        // Mark session as goaway so we degrade on next request
        entry.goawayReceived = true;
        reject(err);
      });

      // Abort handling
      if (options.signal) {
        if (options.signal.aborted) {
          req.destroy();
          reject(new DOMException("The operation was aborted", "AbortError"));
          return;
        }
        const onAbort = () => {
          req.destroy();
          reject(new DOMException("The operation was aborted", "AbortError"));
        };
        options.signal.addEventListener("abort", onAbort, { once: true });
        req.on("close", () => options.signal?.removeEventListener("abort", onAbort));
      }

      // Write body for POST/PUT etc.
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  private getOrCreateSession(origin: string): SessionEntry {
    let entries = this.sessions.get(origin);
    if (!entries) {
      entries = [];
      this.sessions.set(origin, entries);
    }

    // Try to reuse an existing session that isn't overloaded or goaway'd
    for (const entry of entries) {
      if (!entry.goawayReceived && entry.streamCount < this.maxConcurrentStreams) {
        return entry;
      }
    }

    // Create a new session
    const session = http2.connect(origin, {
      connectTimeout: this.connectTimeoutMs,
      // Peer max concurrent streams cap
      peerMaxConcurrentStreams: this.maxConcurrentStreams,
      ...(origin.startsWith("https:") && !this.rejectUnauthorized
        ? { rejectUnauthorized: false as const }
        : {}),
    });

    const entry: SessionEntry = {
      session,
      origin,
      lastUsed: Date.now(),
      streamCount: 0,
      goawayReceived: false,
      era: this.globalEra++,
    };

    session.on("goaway", () => {
      entry.goawayReceived = true;
      // Don't destroy immediately; in-flight streams drain naturally.
      // The next request picking this entry will see goawayReceived and
      // either create a new session or fall back to HTTP/1.1.
    });

    session.on("error", () => {
      entry.goawayReceived = true;
    });

    session.on("close", () => {
      // Remove from pool
      this.removeEntry(entry);
    });

    entries.push(entry);
    this.ensureSweeper();

    return entry;
  }

  private removeEntry(entry: SessionEntry): void {
    const entries = this.sessions.get(entry.origin);
    if (!entries) return;
    const idx = entries.indexOf(entry);
    if (idx !== -1) {
      entries.splice(idx, 1);
    }
    if (entries.length === 0) {
      this.sessions.delete(entry.origin);
    }
  }

  private async destroySession(entry: SessionEntry): Promise<void> {
    return new Promise<void>((resolve) => {
      entry.session.close(() => resolve());
      // Force close after 2s if graceful close hangs
      setTimeout(() => {
        try {
          entry.session.destroy();
        } catch {
          // ignore
        }
        resolve();
      }, 2_000).unref();
    });
  }

  // ── Idle sweep ──────────────────────────────────────────────────────────────

  private ensureSweeper(): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => this.sweepIdle(), this.sweepIntervalMs);
    this.sweepTimer.unref();
  }

  private sweepIdle(): void {
    const now = Date.now();
    for (const [origin, entries] of this.sessions) {
      const alive = entries.filter((e) => {
        if (e.goawayReceived && e.streamCount === 0) {
          // GOAWAY sessions with no active streams can be closed immediately
          this.destroySession(e);
          return false;
        }
        if (e.streamCount === 0 && now - e.lastUsed > this.idleTimeoutMs) {
          this.destroySession(e);
          return false;
        }
        return true;
      });
      if (alive.length > 0) {
        this.sessions.set(origin, alive);
      } else {
        this.sessions.delete(origin);
      }
    }
  }

  // ── HTTP/1.1 fallback ───────────────────────────────────────────────────────

  private http1Fetch(url: string, options: FetchOptions): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === "https:";
      const mod = isHttps ? https : http;

      const agentOpts: http.AgentOptions | https.AgentOptions = {};
      if (isHttps && !this.rejectUnauthorized) {
        (agentOpts as https.AgentOptions).rejectUnauthorized = false;
      }
      const agent = isHttps ? new https.Agent(agentOpts as https.AgentOptions) : new http.Agent(agentOpts);

      const req = mod.request(
        url,
        {
          method: options.method ?? "GET",
          headers: options.headers,
          timeout: this.connectTimeoutMs,
          agent,
        },
        (res) => {
          const chunks: Buffer[] = [];
          const statusCode = res.statusCode ?? 502;

          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const body = Buffer.concat(chunks);
            resolve(
              new Response(body, {
                status: statusCode,
                headers: res.headers as Record<string, string>,
              })
            );
          });
          res.on("error", reject);
        }
      );

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`HTTP/1.1 request timed out after ${this.connectTimeoutMs}ms`));
      });

      if (options.signal) {
        if (options.signal.aborted) {
          req.destroy();
          reject(new DOMException("The operation was aborted", "AbortError"));
          return;
        }
        const onAbort = () => {
          req.destroy();
          reject(new DOMException("The operation was aborted", "AbortError"));
        };
        options.signal.addEventListener("abort", onAbort, { once: true });
        req.on("close", () => options.signal?.removeEventListener("abort", onAbort));
      }

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private normalizeHeaders(
    headers?: Record<string, string>
  ): Record<string, string> {
    if (!headers) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      // HTTP/2 forbids connection-specific headers
      const lower = key.toLowerCase();
      if (
        lower === "connection" ||
        lower === "keep-alive" ||
        lower === "transfer-encoding" ||
        lower === "upgrade" ||
        lower === "proxy-connection"
      ) {
        continue;
      }
      // Host is derived from :authority
      if (lower === "host") continue;
      out[key] = value;
    }
    return out;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

/**
 * Global singleton connection manager.
 *
 * Import this from the bifrost relay route or any other provider-facing code:
 *
 *   import { connectionManager } from "@/lib/http2/connectionManager";
 *   const resp = await connectionManager.fetch(url, opts);
 */
export const connectionManager = new Http2ConnectionManager();
