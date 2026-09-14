
import type { Response as Resp } from "undici";

// Minimal fetch mock responses that satisfy what apiFetch needs.
export function makeMcpResp(data: unknown, status = 200, headers: Record<string, string> = {}) {
  const hdrs = new Headers({ "content-type": "application/json", ...headers });
  const obj = {
    ok: status < 400,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(typeof data === "string" ? data : JSON.stringify(data)),
    headers: hdrs,
  } as unknown as Resp;
  return obj;
}

export function makeMcpStreamFetch({
  toolResult = { content: [{ type: "text", text: "ok" }] },
  initStatus = 200,
  callStatus = 200,
  callError = false,
} = {}) {
  return (async (url: string | URL, init?: unknown) => {
    const u = String(url);
    if (!u.includes("/api/mcp/stream")) {
      return makeMcpResp({ error: "not found" }, 404);
    }
    const body = init?.body ? JSON.parse(init.body) : {};
    if (body.method === "initialize") {
      return makeMcpResp(
        { jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2024-11-05", capabilities: {} } },
        initStatus,
        initStatus < 400 ? { "mcp-session-id": "sess-test" } : {},
      );
    }
    if (body.method === "tools/call") {
      if (callStatus !== 200) return makeMcpResp({ error: "tool failure" }, callStatus);
      if (callError) {
        return makeMcpResp({
          jsonrpc: "2.0",
          id: body.id,
          result: { content: [{ type: "text", text: "tool error" }], isError: true },
        });
      }
      return makeMcpResp({ jsonrpc: "2.0", id: body.id, result: toolResult });
    }
    return makeMcpResp({ error: "unknown method" }, 400);
  }) as unknown as typeof globalThis.fetch;
}
