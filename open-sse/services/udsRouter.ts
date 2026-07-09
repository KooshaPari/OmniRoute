// UDS Router — forwards requests to the Rust data plane over a Unix Domain Socket.
//
// Supports both non-streaming (forwardToDataPlane) and streaming
// (forwardToDataPlaneStreaming) modes. The streaming path returns a web Response
// with a ReadableStream body, compatible with ExecutorResult.response from base.ts.
//
// Socket path resolution (in priority order):
//   1. OMNIROUTE_DATA_PLANE_SOCKET env var
//   2. $XDG_RUNTIME_DIR/omniroute/routed.sock
//   3. /tmp/omniroute/routed.sock
//
// Reference: SPEC.md §17 polyglot binding tiers (T2 UDS RPC)

import { request as httpRequest, type RequestOptions } from "node:http";
import { Socket } from "node:net";
import logger from "@/lib/logger";

const DEFAULT_SOCKET_PATHS = ["/tmp/omniroute/routed.sock"];

let _socketPath: string | null = null;

/**
 * Returns the resolved UDS socket path, cached after first resolution.
 */
export function getSocketPath(): string {
  if (_socketPath) return _socketPath;

  const envPath = process.env.OMNIROUTE_DATA_PLANE_SOCKET;
  if (envPath) {
    _socketPath = envPath;
    return _socketPath;
  }

  const runtimeDir = process.env.XDG_RUNTIME_DIR;
  if (runtimeDir) {
    _socketPath = runtimeDir + "/omniroute/routed.sock";
    return _socketPath;
  }

  _socketPath = DEFAULT_SOCKET_PATHS[0];
  return _socketPath;
}

// --- Health check ---

let _lastHealthCheck = 0;
let _cachedHealth = false;

/**
 * Quick UDS health check — caches for 5s.
 * Returns true if the data plane socket is reachable.
 */
export function udsHealthCheck(): boolean {
  const now = Date.now();
  if (now - _lastHealthCheck < 5000) return _cachedHealth;

  const path = getSocketPath();
  const sock = new Socket();
  try {
    sock.connect(path);
    _cachedHealth = true;
  } catch {
    _cachedHealth = false;
  } finally {
    sock.destroy();
  }
  _lastHealthCheck = now;
  return _cachedHealth;
}

// --- Non-streaming ---

export interface DataPlaneResponse {
  body: string;
  statusCode: number;
  headers: Record<string, string>;
}

/**
 * Sends a non-streaming request to the Rust data plane.
 * Collects the full response before resolving.
 */
export function forwardToDataPlane(
  body: string,
  apiKey: string,
  provider: string
): Promise<DataPlaneResponse | null> {
  return new Promise((resolve) => {
    const path = getSocketPath();
    const sock = new Socket();
    let responseData = "";
    let statusCode = 200;
    let responseHeaders: Record<string, string> = {};
    let headersParsed = false;

    const timeout = setTimeout(() => {
      sock.destroy();
      resolve(null);
    }, 30_000);

    sock.connect(path, () => {
      const request = [
        "POST /v1/chat/completions HTTP/1.1",
        "Host: omniroute",
        "Content-Type: application/json",
        `Authorization: Bearer ${apiKey}`,
        `X-OmniRoute-Provider: ${provider}`,
        `Content-Length: ${Buffer.byteLength(body)}`,
        "Connection: close",
        "",
        body,
      ].join("\r\n");

      sock.write(request);
    });

    sock.on("data", (chunk: Buffer) => {
      responseData += chunk.toString("utf-8");

      if (!headersParsed) {
        const headerEnd = responseData.indexOf("\r\n\r\n");
        if (headerEnd !== -1) {
          headersParsed = true;
          const rawHeaders = responseData.slice(0, headerEnd);
          const lines = rawHeaders.split("\r\n");

          // Parse status line
          const statusMatch = lines[0].match(/HTTP\/\d\.\d\s+(\d+)/);
          if (statusMatch) statusCode = parseInt(statusMatch[1], 10);

          // Parse headers
          for (let i = 1; i < lines.length; i++) {
            const colon = lines[i].indexOf(":");
            if (colon > 0) {
              const key = lines[i].slice(0, colon).trim().toLowerCase();
              const val = lines[i].slice(colon + 1).trim();
              responseHeaders[key] = val;
            }
          }
        }
      }
    });

    sock.on("close", () => {
      clearTimeout(timeout);

      if (!headersParsed) {
        resolve(null);
        return;
      }

      // Extract body (everything after the header block)
      const headerEnd = responseData.indexOf("\r\n\r\n");
      const body = headerEnd !== -1 ? responseData.slice(headerEnd + 4) : responseData;

      resolve({ body, statusCode, headers: responseHeaders });
    });

    sock.on("error", () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}

// --- Streaming ---

/**
 * Sends a streaming request to the Rust data plane and returns a web Response
 * with a ReadableStream body, compatible with the base.ts ExecutorResult.response
 * contract.
 *
 * Uses Node's http.request with a UDS createConnection() agent for proper HTTP
 * framing. The response body is a ReadableStream that emits SSE chunks as they
 * arrive from the upstream provider.
 */
export function forwardToDataPlaneStreaming(
  body: string,
  apiKey: string,
  provider: string
): Promise<Response | null> {
  return new Promise((resolve) => {
    const path = getSocketPath();
    const timeout = setTimeout(() => {
      resolve(null);
    }, 30_000);

    const opts: RequestOptions = {
      method: "POST",
      path: "/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-OmniRoute-Provider": provider,
        "Content-Length": String(Buffer.byteLength(body)),
        Connection: "keep-alive",
      },
      createConnection: () => {
        const sock = new Socket();
        sock.connect(path);
        return sock;
      },
    };

    const req = httpRequest(opts, (incoming) => {
      clearTimeout(timeout);

      const statusCode = incoming.statusCode ?? 500;
      if (statusCode >= 400) {
        // Collect full error body before resolving
        let errBody = "";
        incoming.on("data", (chunk: Buffer) => {
          errBody += chunk.toString("utf-8");
        });
        incoming.on("end", () => {
          const errorResponse = new Response(errBody, {
            status: statusCode,
            statusText: incoming.statusMessage ?? "Error",
            headers: { "content-type": "application/json" },
          });
          resolve(errorResponse);
        });
        return;
      }

      // Convert the Node IncomingMessage (Readable) into a web ReadableStream
      const webStream = new ReadableStream({
        start(controller) {
          incoming.on("data", (chunk: Buffer) => {
            controller.enqueue(chunk);
          });
          incoming.on("end", () => {
            controller.close();
          });
          incoming.on("error", (err) => {
            controller.error(err);
          });
        },
      });

      // Build the response headers from the incoming message
      const respHeaders: Record<string, string> = {};
      for (let i = 0; i < (incoming.rawHeaders?.length ?? 0); i += 2) {
        const key = incoming.rawHeaders?.[i]?.toLowerCase() ?? "";
        const val = incoming.rawHeaders?.[i + 1] ?? "";
        respHeaders[key] = val;
      }

      const response = new Response(webStream, {
        status: statusCode,
        statusText: incoming.statusMessage ?? "OK",
        headers: respHeaders,
      });

      resolve(response);
    });

    req.on("error", () => {
      clearTimeout(timeout);
      resolve(null);
    });

    req.write(body);
    req.end();
  });
}
