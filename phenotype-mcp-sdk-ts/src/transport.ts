/**
 * MCP transports — stdio (newline-delimited JSON) and SSE (stub).
 *
 * Mirrors `phenotype-mcp-sdk-rs` `transport.rs`:
 * - `StdioTransport` (transport.rs:17-101) — reads one JSON object per
 *   line from stdin, dispatches to the server, writes a single JSON
 *   response line to stdout. Handles `tools/list`, `tools/call`,
 *   `resources/list`, `resources/read`.
 * - `SseTransport` (transport.rs:108-130) — placeholder for HTTP+SSE.
 *   `serve` is a no-op stub, `getServer` exposes the wrapped server.
 */

import { createInterface } from 'node:readline';
import { McpError } from './types.js';
import { McpServer } from './server.js';

/**
 * Stdio transport. Reads newline-delimited JSON requests from stdin
 * and writes newline-delimited JSON responses to stdout.
 */
export class StdioTransport {
  private readonly server: McpServer;

  constructor(server: McpServer) {
    this.server = server;
  }

  /** Access the wrapped server (mirrors `transport.server()` in Rust). */
  getServer(): McpServer {
    return this.server;
  }

  /**
   * Dispatch a single request object to the server. Returns the
   * response object. Throws `McpError` on failure (the `run` loop
   * catches these and writes them to stdout as a JSON line).
   */
  async handleRequest(req: unknown): Promise<unknown> {
    const method = readMethod(req);
    switch (method) {
      case 'tools/list': {
        const tools = await this.server.listTools();
        return { tools: tools.map((t) => t.toJSON()) };
      }
      case 'tools/call': {
        const params = readParams(req);
        const name = params.name;
        if (typeof name !== 'string') {
          throw McpError.invalidArguments('missing name');
        }
        const args = params.arguments === undefined ? {} : params.arguments;
        const result = await this.server.callTool(name, args);
        return { result };
      }
      case 'resources/list': {
        const resources = await this.server.listResources();
        return { resources };
      }
      case 'resources/read': {
        const params = readParams(req);
        const uri = params.uri;
        if (typeof uri !== 'string') {
          throw McpError.invalidArguments('missing uri');
        }
        const content = await this.server.readResource(uri);
        return { content };
      }
      default:
        throw McpError.invalidArguments(`unknown method: ${String(method)}`);
    }
  }

  /**
   * Run the stdio event loop on the current process. Reads
   * newline-delimited JSON from `process.stdin` and writes responses
   * to `process.stdout` until EOF. Errors are reported as
   * `{ "error": { "kind": ..., "message": ... } }` lines.
   */
  async run(): Promise<void> {
    const rl = createInterface({
      input: process.stdin,
      crlfDelay: Infinity,
    });
    try {
      for await (const line of rl) {
        if (line.trim().length === 0) {
          continue;
        }
        let req: unknown;
        try {
          req = JSON.parse(line);
        } catch (e) {
          const err = McpError.invalidArguments(
            e instanceof Error ? e.message : String(e),
          );
          writeError(err);
          continue;
        }
        try {
          const resp = await this.handleRequest(req);
          process.stdout.write(JSON.stringify(resp) + '\n');
        } catch (e) {
          const err =
            e instanceof McpError
              ? e
              : McpError.internal(e instanceof Error ? e.message : String(e));
          writeError(err);
        }
      }
    } finally {
      rl.close();
    }
  }

  /** Mirror of Rust `Debug` impl — used by tests for a stable string form. */
  toString(): string {
    return `StdioTransport(server=${this.server.constructor.name})`;
  }
}

/**
 * SSE transport placeholder. The real implementation would bind an
 * HTTP server and stream MCP messages as Server-Sent Events; here it
 * is a stub matching the Rust version (`transport.rs:108-130`).
 */
export class SseTransport {
  private readonly server: McpServer;

  constructor(server: McpServer) {
    this.server = server;
  }

  /** Access the wrapped server. */
  getServer(): McpServer {
    return this.server;
  }

  /**
   * Placeholder serve loop. Returns successfully without doing
   * anything — the real implementation requires an HTTP framework.
   */
  async serve(_addr: string): Promise<void> {
    // TODO: implement HTTP+SSE streaming (matches Rust stub).
  }

  toString(): string {
    return `SseTransport(server=${this.server.constructor.name})`;
  }
}

// ---------- helpers ----------

function readMethod(req: unknown): string {
  if (req && typeof req === 'object' && 'method' in req) {
    const m = (req as { method: unknown }).method;
    if (typeof m === 'string') {
      return m;
    }
  }
  return 'unknown';
}

function readParams(req: unknown): Record<string, unknown> {
  if (req && typeof req === 'object' && 'params' in req) {
    const p = (req as { params: unknown }).params;
    if (p && typeof p === 'object') {
      return p as Record<string, unknown>;
    }
  }
  return {};
}

function writeError(err: McpError): void {
  process.stdout.write(
    JSON.stringify({ error: { kind: err.kind, message: err.detail } }) + '\n',
  );
}
