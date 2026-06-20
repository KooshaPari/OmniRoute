/**
 * Bifrost MCP Client tests (B8 of v8.1 Bifrost track).
 *
 * Covers:
 *  - Env gating (BIFROST_MCP_ENABLED)
 *  - listTools() forwards correct JSON-RPC to /mcp
 *  - listTools() returns parsed tool list
 *  - callTool() forwards correct JSON-RPC params
 *  - callTool() returns parsed result
 *  - Fallback when Bifrost MCP disabled/unavailable/errors
 *  - healthCheck() returns structured health summary
 *  - BIFROST_MCP_BASE_URL override
 *  - BIFROST_MCP_API_KEY auth header
 *
 * Reference: docs/adr/0031-bifrost-tier1-router.md (B8),
 * docs/frameworks/BIFROST-MCP-CLIENT.md.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  BifrostMcpClient,
  bifrostMcpClient,
  isBifrostMcpEnabled,
  resolveBifrostMcpBaseUrl,
} from "../../open-sse/executors/bifrostMcpClient.ts";

// ─── isBifrostMcpEnabled ─────────────────────────────────────────────

describe("isBifrostMcpEnabled", () => {
  const original = process.env.BIFROST_MCP_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.BIFROST_MCP_ENABLED;
    else process.env.BIFROST_MCP_ENABLED = original;
  });

  it("returns false when BIFROST_MCP_ENABLED is unset", () => {
    delete process.env.BIFROST_MCP_ENABLED;
    expect(isBifrostMcpEnabled()).toBe(false);
  });

  it("returns true when BIFROST_MCP_ENABLED=1", () => {
    process.env.BIFROST_MCP_ENABLED = "1";
    expect(isBifrostMcpEnabled()).toBe(true);
  });

  it("returns true when BIFROST_MCP_ENABLED=true", () => {
    process.env.BIFROST_MCP_ENABLED = "true";
    expect(isBifrostMcpEnabled()).toBe(true);
  });

  it("returns false when BIFROST_MCP_ENABLED=false", () => {
    process.env.BIFROST_MCP_ENABLED = "false";
    expect(isBifrostMcpEnabled()).toBe(false);
  });

  it("returns false when BIFROST_MCP_ENABLED=0", () => {
    process.env.BIFROST_MCP_ENABLED = "0";
    expect(isBifrostMcpEnabled()).toBe(false);
  });
});

// ─── resolveBifrostMcpBaseUrl ────────────────────────────────────────

describe("resolveBifrostMcpBaseUrl", () => {
  const original = process.env.BIFROST_MCP_BASE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.BIFROST_MCP_BASE_URL;
    else process.env.BIFROST_MCP_BASE_URL = original;
  });

  it("returns default URL when env var is unset", async () => {
    delete process.env.BIFROST_MCP_BASE_URL;
    const url = await resolveBifrostMcpBaseUrl();
    expect(url).toBe("http://127.0.0.1:8080/mcp");
  });

  it("returns the env var value when set (stripping trailing slash)", async () => {
    process.env.BIFROST_MCP_BASE_URL = "http://bifrost.test:9090/mcp/";
    const url = await resolveBifrostMcpBaseUrl();
    expect(url).toBe("http://bifrost.test:9090/mcp");
  });

  it("supports custom paths via env var", async () => {
    process.env.BIFROST_MCP_BASE_URL = "http://bifrost.internal:8080/custom/mcp";
    const url = await resolveBifrostMcpBaseUrl();
    expect(url).toBe("http://bifrost.internal:8080/custom/mcp");
  });
});

// ─── BifrostMcpClient (env gating) ─────────────────────────────────

describe("BifrostMcpClient (env gating)", () => {
  const originalEnabled = process.env.BIFROST_MCP_ENABLED;
  const originalBaseUrl = process.env.BIFROST_MCP_BASE_URL;
  const originalApiKey = process.env.BIFROST_MCP_API_KEY;

  beforeEach(() => {
    delete process.env.BIFROST_MCP_ENABLED;
    delete process.env.BIFROST_MCP_BASE_URL;
    delete process.env.BIFROST_MCP_API_KEY;
  });

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.BIFROST_MCP_ENABLED;
    else process.env.BIFROST_MCP_ENABLED = originalEnabled;
    if (originalBaseUrl === undefined) delete process.env.BIFROST_MCP_BASE_URL;
    else process.env.BIFROST_MCP_BASE_URL = originalBaseUrl;
    if (originalApiKey === undefined) delete process.env.BIFROST_MCP_API_KEY;
    else process.env.BIFROST_MCP_API_KEY = originalApiKey;
  });

  it("listTools() returns fallbackRecommended=true when BIFROST_MCP_ENABLED unset", async () => {
    const client = new BifrostMcpClient();
    const result = await client.listTools();
    expect(result.ok).toBe(false);
    expect(result.fallbackRecommended).toBe(true);
    expect(result.error).toMatch(/not enabled/);
  });

  it("callTool() returns fallbackRecommended=true when BIFROST_MCP_ENABLED unset", async () => {
    const client = new BifrostMcpClient();
    const result = await client.callTool("some_tool", { arg: 1 });
    expect(result.ok).toBe(false);
    expect(result.fallbackRecommended).toBe(true);
    expect(result.error).toMatch(/not enabled/);
  });

  it("healthCheck() returns ok=false when BIFROST_MCP_ENABLED unset", async () => {
    const client = new BifrostMcpClient();
    const result = await client.healthCheck();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not enabled/);
  });
});

// ─── BifrostMcpClient (listTools) ──────────────────────────────────

describe("BifrostMcpClient (listTools)", () => {
  const originalEnabled = process.env.BIFROST_MCP_ENABLED;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.BIFROST_MCP_ENABLED = "1";
    process.env.BIFROST_MCP_BASE_URL = "http://bifrost.test:8080/mcp";
  });

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.BIFROST_MCP_ENABLED;
    else process.env.BIFROST_MCP_ENABLED = originalEnabled;
    delete process.env.BIFROST_MCP_BASE_URL;
    globalThis.fetch = originalFetch;
  });

  const mockJsonRpcResponse = (result: unknown) =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  it("POSTs to the expected URL with JSON-RPC envelope", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonRpcResponse({ tools: [] })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    await client.listTools();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = mockFetch.mock.calls[0] ?? [];
    expect(calledUrl).toBe("http://bifrost.test:8080/mcp");
    expect((init as RequestInit).method).toBe("POST");

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.method).toBe("tools/list");
    expect(body.params).toBeDefined();
  });

  it("returns parsed tool list from Bifrost response", async () => {
    const tools = [
      { name: "get_weather", description: "Get current weather", inputSchema: { type: "object" } },
      { name: "search_web", description: "Search the web", inputSchema: { type: "object" } },
    ];
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonRpcResponse({ tools })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    const result = await client.listTools();

    expect(result.ok).toBe(true);
    expect(result.fallbackRecommended).toBe(false);
    expect(result.data).toEqual(tools);
    expect(result.data?.length).toBe(2);
  });

  it("returns empty array when Bifrost returns no tools", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonRpcResponse({ tools: [] })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    const result = await client.listTools();

    expect(result.ok).toBe(true);
    expect(result.data).toEqual([]);
  });
});

// ─── BifrostMcpClient (callTool) ───────────────────────────────────

describe("BifrostMcpClient (callTool)", () => {
  const originalEnabled = process.env.BIFROST_MCP_ENABLED;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.BIFROST_MCP_ENABLED = "1";
    process.env.BIFROST_MCP_BASE_URL = "http://bifrost.test:8080/mcp";
  });

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.BIFROST_MCP_ENABLED;
    else process.env.BIFROST_MCP_ENABLED = originalEnabled;
    delete process.env.BIFROST_MCP_BASE_URL;
    globalThis.fetch = originalFetch;
  });

  const mockJsonRpcResponse = (result: unknown) =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  it("POSTs correct JSON-RPC for tools/call", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonRpcResponse({ content: [{ type: "text", text: "done" }] })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    await client.callTool("get_weather", { city: "London" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0] ?? [];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.method).toBe("tools/call");
    expect(body.params.name).toBe("get_weather");
    expect(body.params.arguments).toEqual({ city: "London" });
  });

  it("returns parsed call result from Bifrost", async () => {
    const content = [
      { type: "text", text: "The weather in London is 15°C and cloudy." },
    ];
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonRpcResponse({ content, isError: false })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    const result = await client.callTool("get_weather", { city: "London" });

    expect(result.ok).toBe(true);
    expect(result.data?.content).toEqual(content);
    expect(result.data?.isError).toBe(false);
  });

  it("returns isError=true when Bifrost returns tool error", async () => {
    const content = [{ type: "text", text: "City not found" }];
    const mockFetch = vi.fn().mockResolvedValue(
      mockJsonRpcResponse({ content, isError: true })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    const result = await client.callTool("get_weather", { city: "Atlantis" });

    expect(result.ok).toBe(true); // JSON-RPC call succeeded; tool returned error
    expect(result.data?.isError).toBe(true);
    expect(result.data?.content[0].text).toMatch(/not found/);
  });
});

// ─── BifrostMcpClient (fallback behavior) ──────────────────────────

describe("BifrostMcpClient (fallback behavior)", () => {
  const originalEnabled = process.env.BIFROST_MCP_ENABLED;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.BIFROST_MCP_ENABLED = "1";
    process.env.BIFROST_MCP_BASE_URL = "http://bifrost.test:8080/mcp";
  });

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.BIFROST_MCP_ENABLED;
    else process.env.BIFROST_MCP_ENABLED = originalEnabled;
    delete process.env.BIFROST_MCP_BASE_URL;
    globalThis.fetch = originalFetch;
  });

  it("returns fallbackRecommended=true when Bifrost returns HTTP 503", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Service Unavailable", { status: 503 })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    const result = await client.listTools();

    expect(result.ok).toBe(false);
    expect(result.fallbackRecommended).toBe(true);
    expect(result.error).toMatch(/503/);
  });

  it("returns fallbackRecommended=true when Bifrost is unreachable (network error)", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    const result = await client.listTools();

    expect(result.ok).toBe(false);
    expect(result.fallbackRecommended).toBe(true);
    expect(result.error).toMatch(/ECONNREFUSED/);
  });

  it("returns fallbackRecommended=true for method-not-found JSON-RPC errors", async () => {
    const response = {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32601, message: "Method not found" },
    };
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    const result = await client.listTools();

    expect(result.ok).toBe(false);
    expect(result.fallbackRecommended).toBe(true);
    expect(result.error).toMatch(/Method not found/);
  });

  it("does NOT recommend fallback for generic JSON-RPC errors", async () => {
    const response = {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32603, message: "Internal error" },
    };
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    const result = await client.callTool("some_tool", {});

    expect(result.ok).toBe(false);
    expect(result.fallbackRecommended).toBe(false);
    expect(result.error).toMatch(/Internal error/);
  });
});

// ─── BifrostMcpClient (healthCheck) ────────────────────────────────

describe("BifrostMcpClient (healthCheck)", () => {
  const originalEnabled = process.env.BIFROST_MCP_ENABLED;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.BIFROST_MCP_ENABLED = "1";
    process.env.BIFROST_MCP_BASE_URL = "http://bifrost.test:8080/mcp";
  });

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.BIFROST_MCP_ENABLED;
    else process.env.BIFROST_MCP_ENABLED = originalEnabled;
    delete process.env.BIFROST_MCP_BASE_URL;
    globalThis.fetch = originalFetch;
  });

  it("returns ok=true with tool count on healthy response", async () => {
    const tools = [
      { name: "tool_a" },
      { name: "tool_b" },
      { name: "tool_c" },
    ];
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    const health = await client.healthCheck();

    expect(health.ok).toBe(true);
    expect(health.toolCount).toBe(3);
    expect(health.error).toBeUndefined();
  });

  it("returns ok=false with error on failure", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    const health = await client.healthCheck();

    expect(health.ok).toBe(false);
    expect(health.error).toMatch(/ECONNREFUSED/);
    expect(health.toolCount).toBeUndefined();
  });
});

// ─── BifrostMcpClient (auth) ────────────────────────────────────────

describe("BifrostMcpClient (auth)", () => {
  const originalEnabled = process.env.BIFROST_MCP_ENABLED;
  const originalApiKey = process.env.BIFROST_MCP_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.BIFROST_MCP_ENABLED = "1";
    process.env.BIFROST_MCP_BASE_URL = "http://bifrost.test:8080/mcp";
    process.env.BIFROST_MCP_API_KEY = "sk-bifrost-test-key";
  });

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.BIFROST_MCP_ENABLED;
    else process.env.BIFROST_MCP_ENABLED = originalEnabled;
    delete process.env.BIFROST_MCP_BASE_URL;
    if (originalApiKey === undefined) delete process.env.BIFROST_MCP_API_KEY;
    else process.env.BIFROST_MCP_API_KEY = originalApiKey;
    globalThis.fetch = originalFetch;
  });

  it("sends Authorization header when BIFROST_MCP_API_KEY is set", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools: [] } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    await client.listTools();

    const [, init] = mockFetch.mock.calls[0] ?? [];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk-bifrost-test-key");
  });

  it("does NOT send Authorization header when BIFROST_MCP_API_KEY is unset", async () => {
    delete process.env.BIFROST_MCP_API_KEY;
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools: [] } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new BifrostMcpClient();
    await client.listTools();

    const [, init] = mockFetch.mock.calls[0] ?? [];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

// ─── Singleton ──────────────────────────────────────────────────────

describe("bifrostMcpClient singleton", () => {
  it("exports a singleton instance", () => {
    expect(bifrostMcpClient).toBeInstanceOf(BifrostMcpClient);
    expect(bifrostMcpClient.listTools).toBeInstanceOf(Function);
    expect(bifrostMcpClient.callTool).toBeInstanceOf(Function);
    expect(bifrostMcpClient.healthCheck).toBeInstanceOf(Function);
  });

  it("singleton is a frozen instance (BifrostMcpClient)", () => {
    // The singleton is a regular class instance; verify prototype chain
    expect(Object.getPrototypeOf(bifrostMcpClient)).toBe(BifrostMcpClient.prototype);
  });
});
