# Bifrost MCP Client (B8)

> **Status:** Phase 1 of v8.1 B8 (ADR-031, 2026-06-19).
> **Track:** PLAN.md § 2.5.2 (B8).
> **Decision:** Adopt `maximhq/bifrost` (Go, MIT) as the upstream MCP tool
> proxy. OmniRoute's Tier-2 engine keeps the native 87-tool MCP server;
> Bifrost's MCP client adds upstream MCP tool visibility. See
> [`docs/adr/0031-bifrost-tier1-router.md`](../adr/0031-bifrost-tier1-router.md)
> for the full decision rationale.

---

## What is the Bifrost MCP Client?

**BifrostMcpClient** (`open-sse/executors/bifrostMcpClient.ts`) is a thin
JSON-RPC 2.0 proxy that forwards MCP tool-list and tool-call requests to
Bifrost's HTTP MCP endpoint (`POST /mcp`). It is **not** a full MCP
client implementation — it only implements two methods:

| Method | JSON-RPC | Description |
|---|---|---|
| `listTools()` | `tools/list` | Lists MCP tools available through Bifrost-connected upstream MCP servers |
| `callTool(name, args)` | `tools/call` | Invokes a tool on the upstream MCP server via Bifrost |

The actual MCP protocol translation (stdio, SSE, Streamable HTTP) happens
inside Bifrost. OmniRoute sends JSON-RPC over HTTP; Bifrost handles the
rest.

---

## Architecture

```
   AI agent / IDE (MCP client)
        │
        ▼
   OmniRoute MCP Server (Tier-2)
        │  @modelcontextprotocol/sdk, 87 native tools
        │
        ├── OmniRoute native tools (health, routing, cache, ...)
        │
        └── BifrostMcpClient (this component)
                │  POST /mcp (JSON-RPC 2.0)
                ▼
        Bifrost Tier-1 (Go gateway)
                │  stdio / SSE / Streamable HTTP
                ▼
        Upstream MCP servers
          (filesystem, database, web search, ...)
```

**Key properties:**

- **Proxy, not reimplementation.** BifrostMcpClient is ~350 lines of TypeScript.
  It does not speak MCP transports — it delegates that to Bifrost.
- **Env-gated.** Disabled by default. Flip `BIFROST_MCP_ENABLED` to opt in.
- **Fallback semantics.** When Bifrost is disabled, unreachable, or returns
  an error, `{ fallbackRecommended: true }` signals the caller to use
  OmniRoute's native MCP tools (87 tools registered in
  `open-sse/mcp-server/server.ts`).
- **Singleton.** `bifrostMcpClient` is exported as a pre-instantiated singleton
  for convenience. Instantiate `new BifrostMcpClient()` for custom config.

---

## Activation

### 1. Required: Enable Bifrost MCP

```bash
export BIFROST_MCP_ENABLED=1
```

When unset or `0`/`false`, all `listTools()` and `callTool()` calls return
`{ ok: false, fallbackRecommended: true }`.

### 2. Optional: Override the MCP endpoint

```bash
export BIFROST_MCP_BASE_URL=http://127.0.0.1:8080/mcp   # default
```

Bifrost exposes its MCP endpoint at `POST /mcp` by default. If Bifrost
is behind a reverse proxy or on a different port, set this env var.

### 3. Optional: Authenticate to Bifrost

```bash
export BIFROST_MCP_API_KEY=sk-bifrost-virtual-key
```

If set, the client sends `Authorization: Bearer <key>` on every request.
This is the Bifrost virtual-key layer — it maps to Bifrost's `X-Api-Key`
or `Authorization` header depending on Bifrost's configuration (see
Bifrost's own auth docs).

---

## API Reference

### `BifrostMcpClient`

```ts
import { BifrostMcpClient, bifrostMcpClient } from "open-sse/executors/bifrostMcpClient.ts";
```

#### `listTools(): Promise<BifrostMcpResult<BifrostMcpTool[]>>`

Lists MCP tools available through Bifrost's upstream MCP servers.

**Returns:**
```ts
{
  ok: boolean;
  data?: BifrostMcpTool[];    // [{ name, description?, inputSchema? }, ...]
  error?: string;
  fallbackRecommended: boolean;
}
```

| ok | fallbackRecommended | Meaning |
|---|---|---|
| `true` | `false` | Tools listed successfully. |
| `false` | `true` | Disabled or unreachable — use OmniRoute native tools. |

#### `callTool(name, args): Promise<BifrostMcpResult<BifrostMcpCallResult>>`

Invokes an MCP tool by name.

**Parameters:**
- `name` — Tool name (as returned by `listTools()`).
- `args` — Arguments matching the tool's `inputSchema`.

**Returns:**
```ts
{
  ok: boolean;
  data?: {
    content: Array<{ type: "text" | "image" | "resource" | "embedded"; text?: string }>;
    isError?: boolean;
  };
  error?: string;
  fallbackRecommended: boolean;
}
```

When `ok=false` and `fallbackRecommended=true`, the caller should attempt
the same tool call against OmniRoute's native MCP tools before failing.

#### `healthCheck(): Promise<BifrostMcpHealth>`

Probes the Bifrost MCP endpoint by calling `listTools()` with a short
timeout.

**Returns:**
```ts
{
  ok: boolean;
  latencyMs: number;
  error?: string;
  toolCount?: number;   // only on success
}
```

### Standalone helpers

```ts
import { isBifrostMcpEnabled, resolveBifrostMcpBaseUrl } from "open-sse/executors/bifrostMcpClient.ts";

isBifrostMcpEnabled();            // → boolean (reads BIFROST_MCP_ENABLED)
await resolveBifrostMcpBaseUrl(); // → string (reads BIFROST_MCP_BASE_URL, default http://127.0.0.1:8080/mcp)
```

---

## Fallback behavior

The `fallbackRecommended` flag on every response makes it easy to chain
OmniRoute's native MCP tools as a fallback:

```ts
import { bifrostMcpClient } from "open-sse/executors/bifrostMcpClient.ts";

async function listAllMcpTools() {
  const bifrost = await bifrostMcpClient.listTools();
  if (bifrost.ok) return bifrost.data;

  // Fallback: use OmniRoute's native MCP tool catalog.
  // Call createMcpServer() from open-sse/mcp-server/server.ts to
  // enumerate native tools.
  return getOmniRouteNativeTools();
}
```

The flag is `true` when:
- `BIFROST_MCP_ENABLED` is unset, `0`, or `false`.
- Bifrost returns a non-2xx HTTP status (503, 500, 502, etc.).
- Bifrost is unreachable (network error, DNS failure, connection refused).
- Bifrost returns a JSON-RPC `-32601` error (method not found).

The flag is `false` (no fallback recommended) when:
- Bifrost returns a successful response with tool data.
- Bifrost returns a generic JSON-RPC error (e.g., `-32603` internal
  error) — this indicates Bifrost is reachable but something went wrong
  on the upstream MCP server.

---

## Env var reference

| Env var | Default | Description |
|---|---|---|
| `BIFROST_MCP_ENABLED` | (unset) | Set to `1` or `true` to enable the Bifrost MCP client. |
| `BIFROST_MCP_BASE_URL` | `http://127.0.0.1:8080/mcp` | HTTP endpoint for Bifrost's MCP proxy. |
| `BIFROST_MCP_API_KEY` | (unset) | Bearer token sent as `Authorization` header to Bifrost. |

---

## Troubleshooting

### "Bifrost MCP is not enabled"

```
[BIFROST_MCP] Bifrost MCP is not enabled. Set BIFROST_MCP_ENABLED=1.
```

**Fix:** Set `BIFROST_MCP_ENABLED=1` in the environment.

### "Bifrost MCP unreachable: ECONNREFUSED"

**Fix:** Ensure Bifrost is running and listening on the expected port.
Verify `BIFROST_MCP_BASE_URL` matches Bifrost's `--port` / config:

```bash
# Default Bifrost startup
./bifrost --config config.yaml   # listens on :8080

# Verify
curl -v http://127.0.0.1:8080/mcp -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### "Bifrost MCP returned HTTP 503"

**Fix:** Bifrost is running but its upstream MCP server connection is
down. Check Bifrost's logs (`/var/log/bifrost/`) and the upstream MCP
server's health. The fallback to OmniRoute native tools will activate
automatically.

### "No tools returned even with `ok=true`"

Bifrost is connected but its upstream MCP servers expose zero tools.
Check Bifrost's MCP client config:

```yaml
# Bifrost's config.yaml (mcp section)
mcp:
  servers:
    filesystem:
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/data"]
```

If no servers are configured, `listTools()` returns an empty array.

---

## Cross-references

- [`docs/adr/0031-bifrost-tier1-router.md`](../adr/0031-bifrost-tier1-router.md) — ADR (MADR format)
- [`docs/frameworks/BIFROST-BACKEND.md`](BIFROST-BACKEND.md) — Tier-1 router operator guide
- [`PLAN.md`](../../PLAN.md) § 2.5.2 — v8.1 Bifrost track (B8)
- [`open-sse/executors/bifrostMcpClient.ts`](../../open-sse/executors/bifrostMcpClient.ts) — implementation
- [`tests/unit/bifrost-mcp-client.test.ts`](../../tests/unit/bifrost-mcp-client.test.ts) — vitest suite
- [`vendor/bifrost/VENDOR.md`](../../vendor/bifrost/VENDOR.md) — vendored Bifrost provenance
- [`maximhq/bifrost`](https://github.com/maximhq/bifrost) — upstream Go gateway (MCP client docs)

---

**Owner:** MCP team · **Refresh cadence:** as the v8.1 track progresses.
