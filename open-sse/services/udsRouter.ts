// UDS Router — forwards OpenAI-compatible chat requests to the Rust data plane
// over a Unix Domain Socket. Acts as a transparent proxy from the TypeScript
// control plane to the Rust hot path.
//
// Architecture:
//   chatCore.ts → UDSRouter → net.Socket → $XDG_RUNTIME_DIR/omniroute/routed.sock
//                                                                    ↓
//                                                        omniroute-runtime (Rust)
//                                                                    ↓
//                                                        provider adapter → upstream
//
// When the UDS socket is unavailable, the router MUST return `null` so
// callers can fall back to the legacy executor path (graceful degradation).
//
// Reference: plans/2026-07-05-omniroute-rust-data-plane-v1.md §9 Phase 5
//            SPEC.md §17 polyglot binding tiers (T2 UDS RPC)

import * as net from "node:net";
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import logger from "@/lib/logger";

// ── Socket path resolution ──────────────────────────────────────────────────

/**
 * Resolve the omniroute-runtime UDS socket path.
 *
 * Resolution order (matching the Rust runtime's own logic):
 *   1. OMNIROUTE_DATA_PLANE_SOCKET env var
 *   2. $XDG_RUNTIME_DIR/omniroute/routed.sock
 *   3. /tmp/omniroute/routed.sock
 */
export function resolveSocketPath(): string {
  const env = process.env["OMNIROUTE_DATA_PLANE_SOCKET"];
  if (env) return env;

  const xdg = process.env["XDG_RUNTIME_DIR"];
  if (xdg) return path.join(xdg, "omniroute", "routed.sock");

  return "/tmp/omniroute/routed.sock";
}

// ── Socket health check ─────────────────────────────────────────────────────

/**
 * Returns true if the Rust data plane UDS socket exists and is listening.
 *
 * Does NOT attempt to connect — just checks file existence + socket type.
 * Call `udsHealthCheck()` rather than raw `fs.existsSync()` to avoid TOCTOU;
 * the caller must still handle connection failures gracefully.
 */
export function udsHealthCheck(): boolean {
  const sock = resolveSocketPath();
  try {
    const stat = fs.statSync(sock);
    return stat.isSocket();
  } catch {
    return false;
  }
}

// ── Forward a chat-completions request over UDS ─────────────────────────────

export interface UdsForwardResult {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/**
 * Forward a POST /v1/chat/completions payload to the Rust data plane over UDS.
 *
 * @param body JSON-stringified chat completion request body.
 * @param apiKey  Provider API key (forwarded as Authorization header).
 * @param providerId  Provider identifier (e.g. "openai", "anthropic").
 * @returns UdsForwardResult on success, or null if the socket is unavailable
 *          / the request can't be completed.
 */
export async function forwardToDataPlane(
  body: string,
  apiKey: string,
  providerId: string
): Promise<UdsForwardResult | null> {
  const socketPath = resolveSocketPath();

  if (!udsHealthCheck()) {
    logger.debug({ socketPath }, "udsfwd: socket not available, skipping");
    return null;
  }

  return new Promise<UdsForwardResult | null>((resolve) => {
    const socket = new net.Socket();
    let responseData = "";
    let statusCode = 0;
    let headers: http.IncomingHttpHeaders = {};

    // ── Timeout ──────────────────────────────────────────────────────
    const timeoutMs = 30_000;
    const timer = setTimeout(() => {
      logger.warn({ socketPath }, "udsfwd: timeout");
      socket.destroy();
      resolve(null);
    }, timeoutMs);

    // ── Connect over UDS ─────────────────────────────────────────────
    socket.connect(socketPath, () => {
      // Build minimal HTTP/1.1 request
      const reqLine =
        `POST /v1/chat/completions HTTP/1.1\r\n` +
        `Host: omniroute-rust\r\n` +
        `Content-Type: application/json\r\n` +
        `Authorization: Bearer ${apiKey}\r\n` +
        `X-OmniRoute-Provider: ${providerId}\r\n` +
        `Content-Length: ${Buffer.byteLength(body)}\r\n` +
        `Connection: close\r\n` +
        `\r\n` +
        body;

      socket.write(reqLine);
    });

    // ── Collect response ─────────────────────────────────────────────
    socket.on("data", (chunk: Buffer) => {
      responseData += chunk.toString("utf-8");
    });

    socket.on("close", () => {
      clearTimeout(timer);
      if (!responseData) {
        resolve(null);
        return;
      }

      // Naive HTTP/1.1 response parser: split headers / body on "\r\n\r\n"
      const headerEnd = responseData.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        // No headers — raw connection returned no valid HTTP
        resolve(null);
        return;
      }

      const rawHeaders = responseData.slice(0, headerEnd);
      const body = responseData.slice(headerEnd + 4);

      // Parse status line
      const statusMatch = rawHeaders.match(/^HTTP\/\d+\.\d+\s+(\d+)/);
      if (statusMatch) {
        statusCode = parseInt(statusMatch[1], 10);
      }

      // Parse headers
      const parsedHeaders: http.IncomingHttpHeaders = {};
      for (const line of rawHeaders.split("\r\n").slice(1)) {
        const sep = line.indexOf(":");
        if (sep !== -1) {
          const k = line.slice(0, sep).trim().toLowerCase();
          const v = line.slice(sep + 1).trim();
          if (parsedHeaders[k]) {
            parsedHeaders[k] = [parsedHeaders[k] as string, v].flat();
          } else {
            parsedHeaders[k] = v;
          }
        }
      }
      headers = parsedHeaders;

      resolve({ statusCode, headers, body });
    });

    socket.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      logger.debug({ err: err.message, socketPath }, "udsfwd: socket error");
      resolve(null);
    });
  });
}

/**
 * Returns the socket path for diagnostics / status pages.
 */
export function getSocketPath(): string {
  return resolveSocketPath();
}
