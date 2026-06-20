/**
 * Bifrost MCP Client — wraps Bifrost's MCP HTTP proxy endpoint as an
 * OmniRoute MCP tool-call bridge.
 *
 * Bifrost (maximhq/bifrost, Go, MIT) exposes an MCP client integration at
 * POST /mcp using JSON-RPC 2.0. This executor calls that endpoint to
 * list and invoke MCP tools exposed by Bifrost-connected upstream MCP
 * servers.
 *
 * Architecture:
 * ```
 *   AI agent / IDE (MCP client)
 *        │
 *        ▼
 *   OmniRoute MCP Server (Tier-2, @modelcontextprotocol/sdk)
 *        │
 *        ├── OmniRoute's native MCP tools (87 tools)
 *        │
 *        └── BifrostMcpClient (this file) ──▶ Bifrost /mcp (JSON-RPC)
 *                                                  │
 *                                                  └── Upstream MCP servers
 * ```
 *
 * This is a **proxy** — it passes JSON-RPC 2.0 calls through to Bifrost's
 * MCP endpoint, not a reimplementation of the MCP protocol. Bifrost
 * translates the call to the upstream MCP server (stdio, SSE, or
 * Streamable HTTP) and returns the result.
 *
 * Fallback: when BIFROST_MCP_ENABLED is false/unset, or when Bifrost's
 * MCP endpoint returns an error or is unreachable, the caller should fall
 * back to OmniRoute's own MCP tools (the native 87-tool set registered
 * in open-sse/mcp-server/server.ts). This executor returns a
 * `fallbackRecommended` flag in the error path for easy fallback logic.
 *
 * Activation:
 *   export BIFROST_MCP_ENABLED=1
 *   export BIFROST_MCP_BASE_URL=http://127.0.0.1:8080/mcp   # default
 *   export BIFROST_MCP_API_KEY=sk-...                       # optional
 *
 * Reference: ADR-031 (Bifrost Tier-1 router), PLAN.md § 2.5.2 (B8),
 * docs/frameworks/BIFROST-MCP-CLIENT.md.
 *
 * @module open-sse/executors/bifrostMcpClient
 */

// ─── Types ───────────────────────────────────────────────────────────

/** JSON-RPC 2.0 request envelope. */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 success response. */
export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  result?: T;
  error?: JsonRpcError;
}

/** JSON-RPC 2.0 error object. */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** Bifrost MCP tool listing entry (returns from tools/list). */
export interface BifrostMcpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/** MCP tool-call result content block (per MCP spec). */
export interface McpContentBlock {
  type: "text" | "image" | "resource" | "embedded";
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

/** Result of a Bifrost MCP tool call (tools/call response). */
export interface BifrostMcpCallResult {
  content: McpContentBlock[];
  isError?: boolean;
  meta?: Record<string, unknown>;
}

/** Health / status summary for the Bifrost MCP connection. */
export interface BifrostMcpHealth {
  ok: boolean;
  latencyMs: number;
  error?: string;
  toolCount?: number;
}

/**
 * Unified result from BifrostMcpClient methods.
 * When `ok` is false, `fallbackRecommended` signals the caller to switch
 * to OmniRoute's native MCP tools (open-sse/mcp-server/).
 */
export interface BifrostMcpResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  fallbackRecommended: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8080;
const DEFAULT_MCP_PATH = "/mcp";
const DEFAULT_MCP_BASE_URL = `http://${DEFAULT_HOST}:${DEFAULT_PORT}${DEFAULT_MCP_PATH}`;
const FETCH_TIMEOUT_MS = 10_000;
const BIFROST_MCP_TAG = "BIFROST_MCP";

// ─── Env helpers ─────────────────────────────────────────────────────

/**
 * Whether the Bifrost MCP client integration is enabled.
 * Disabled by default; flip via BIFROST_MCP_ENABLED env var.
 */
export function isBifrostMcpEnabled(): boolean {
  const flag = process.env.BIFROST_MCP_ENABLED;
  if (!flag) return false;
  return flag === "true" || flag === "1";
}

/**
 * Resolve the Bifrost MCP endpoint base URL.
 * Default: http://127.0.0.1:8080/mcp
 */
export async function resolveBifrostMcpBaseUrl(): Promise<string> {
  const envUrl = process.env.BIFROST_MCP_BASE_URL;
  if (envUrl && typeof envUrl === "string") return envUrl.replace(/\/+$/, "");
  return DEFAULT_MCP_BASE_URL;
}

// ─── JSON-RPC helpers ────────────────────────────────────────────────

let _requestId = 1;

function nextId(): number {
  return _requestId++;
}

function buildJsonRpcRequest(
  method: string,
  params?: Record<string, unknown>,
): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id: nextId(),
    method,
    params: params ?? {},
  };
}

// ─── BifrostMcpClient ────────────────────────────────────────────────

/**
 * BifrostMcpClient — proxy that forwards MCP tool calls to Bifrost's
 * /mcp JSON-RPC 2.0 endpoint.
 *
 * This class does NOT implement the full MCP specification. It only
 * implements the two methods Bifrost exposes:
 *   - tools/list   → list MCP tools available upstream
 *   - tools/call   → invoke an MCP tool
 *
 * All other MCP methods (tools/list changed notifications, resource
 * methods, etc.) are handled by OmniRoute's own MCP server.
 */
export class BifrostMcpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor() {
    this.baseUrl = DEFAULT_MCP_BASE_URL;
    this.apiKey = process.env.BIFROST_MCP_API_KEY || undefined;
  }

  // ── Internal fetch ─────────────────────────────────────────────

  /**
   * Send a JSON-RPC 2.0 request to Bifrost's /mcp endpoint.
   * Returns the raw parsed JSON on success, or a descriptive error.
   */
  private async jsonRpcCall<T>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<BifrostMcpResult<T>> {
    if (!isBifrostMcpEnabled()) {
      return {
        ok: false,
        error: `[${BIFROST_MCP_TAG}] Bifrost MCP is not enabled. Set BIFROST_MCP_ENABLED=1.`,
        fallbackRecommended: true,
      };
    }

    const url = this.baseUrl;
    const body = buildJsonRpcRequest(method, params);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      // Non-2xx from Bifrost — treat as fallback trigger.
      if (!response.ok) {
        const statusText = response.statusText || `HTTP ${response.status}`;
        let bodyText = "";
        try {
          bodyText = await response.text();
        } catch {
          // body may be empty for 4xx/5xx
        }
        return {
          ok: false,
          error: `[${BIFROST_MCP_TAG}] Bifrost MCP returned ${response.status} ${statusText}${bodyText ? `: ${bodyText.slice(0, 200)}` : ""}`,
          fallbackRecommended: true,
        };
      }

      const raw = (await response.json()) as JsonRpcResponse<T>;

      // JSON-RPC error response.
      if (raw.error) {
        return {
          ok: false,
          error: `[${BIFROST_MCP_TAG}] Bifrost MCP JSON-RPC error [${raw.error.code}]: ${raw.error.message}`,
          fallbackRecommended: raw.error.code === -32601, // method not found → fallback
        };
      }

      return {
        ok: true,
        data: raw.result as T,
        fallbackRecommended: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `[${BIFROST_MCP_TAG}] Bifrost MCP unreachable: ${message}`,
        fallbackRecommended: true,
      };
    }
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * List MCP tools available through the Bifrost MCP client.
   *
   * Returns the raw tool list Bifrost exposes via its upstream MCP
   * servers. Each tool has name, description, and inputSchema.
   *
   * On failure, returns `{ ok: false, fallbackRecommended: true }`
   * so the caller can switch to OmniRoute's native MCP tool registry.
   */
  async listTools(): Promise<BifrostMcpResult<BifrostMcpTool[]>> {
    const result = await this.jsonRpcCall<{ tools?: BifrostMcpTool[] }>("tools/list");
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        fallbackRecommended: result.fallbackRecommended,
      };
    }
    return {
      ok: true,
      data: result.data?.tools ?? [],
      fallbackRecommended: false,
    };
  }

  /**
   * Invoke an MCP tool through the Bifrost MCP client.
   *
   * @param name   — Tool name as reported by Bifrost's tools/list.
   * @param args   — Arguments matching the tool's inputSchema.
   *
   * Returns the tool-call result (content blocks + optional isError flag).
   * On failure, `fallbackRecommended: true` signals the caller to try
   * the same tool on OmniRoute's native MCP tool set before giving up.
   */
  async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<BifrostMcpResult<BifrostMcpCallResult>> {
    const result = await this.jsonRpcCall<BifrostMcpCallResult>("tools/call", {
      name,
      arguments: args,
    });
    return {
      ok: result.ok,
      data: result.ok ? result.data : undefined,
      error: result.ok ? undefined : result.error,
      fallbackRecommended: result.ok ? false : result.fallbackRecommended,
    };
  }

  /**
   * Health check — probes the Bifrost MCP endpoint by calling
   * tools/list with a short timeout. Returns tool count on success.
   */
  async healthCheck(): Promise<BifrostMcpHealth> {
    const start = Date.now();

    if (!isBifrostMcpEnabled()) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: "Bifrost MCP not enabled (BIFROST_MCP_ENABLED unset)",
      };
    }

    const result = await this.listTools();

    return {
      ok: result.ok,
      latencyMs: Date.now() - start,
      error: result.error,
      toolCount: result.ok ? result.data?.length ?? 0 : undefined,
    };
  }
}

// ─── Singleton instance ─────────────────────────────────────────────

/** Default singleton instance. Import and use directly. */
export const bifrostMcpClient = new BifrostMcpClient();

export default BifrostMcpClient;
