import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../server.ts";

type ToolSearchResult = {
  tools: Array<{ name: string; signature?: string }>;
};

vi.mock("../audit.ts", () => ({
  logToolCall: vi.fn().mockResolvedValue(undefined),
  closeAuditDb: vi.fn(),
}));

describe("omniroute_tool_search", () => {
  let client: Client;

  beforeEach(async () => {
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer();
    await server.connect(st);
    client = new Client({ name: "t", version: "1.0.0" });
    await client.connect(ct);
  });

  afterEach(async () => {
    await client.close();
  });

  it("appears in tools/list with read:tools scope", async () => {
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === "omniroute_tool_search")).toBeTruthy();
  });

  it("returns relevant tool with a signature, not itself", async () => {
    const res = await client.callTool({
      name: "omniroute_tool_search",
      arguments: { query: "health" },
    });
    const text = (res.content as Array<{ text: string }>)[0].text;
    const parsed = JSON.parse(text) as ToolSearchResult;
    expect(parsed.tools.some((t) => t.name === "omniroute_get_health")).toBe(true);
    expect(parsed.tools.every((t) => t.name !== "omniroute_tool_search")).toBe(true);
    expect(typeof parsed.tools[0].signature).toBe("string");
  });

  it("respects MCP_TOOL_ALLOW filtering", async () => {
    const originalAllow = process.env.MCP_TOOL_ALLOW;
    const originalDeny = process.env.MCP_TOOL_DENY;

    await client.close();
    process.env.MCP_TOOL_ALLOW = "omniroute_tool_search,omniroute_get_health";
    delete process.env.MCP_TOOL_DENY;

    try {
      const [ct, st] = InMemoryTransport.createLinkedPair();
      const server = createMcpServer();
      await server.connect(st);
      client = new Client({ name: "t", version: "1.0.0" });
      await client.connect(ct);

      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([
        "omniroute_get_health",
        "omniroute_tool_search",
      ]);

      const res = await client.callTool({
        name: "omniroute_tool_search",
        arguments: { query: "health" },
      });
      const text = (res.content as Array<{ text: string }>)[0].text;
      const parsed = JSON.parse(text) as ToolSearchResult;
      expect(parsed.tools.map((t) => t.name)).toEqual(["omniroute_get_health"]);
    } finally {
      if (originalAllow === undefined) delete process.env.MCP_TOOL_ALLOW;
      else process.env.MCP_TOOL_ALLOW = originalAllow;
      if (originalDeny === undefined) delete process.env.MCP_TOOL_DENY;
      else process.env.MCP_TOOL_DENY = originalDeny;
    }
  });
});
