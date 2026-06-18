import { ForgeAdapter } from "../adapters/forge";
import { CodeRabbitAdapter, CursorAdapter, KiloCodeAdapter, CopilotAdapter, CodeQLAdapter } from "../adapters/cloud";
import { getAdapter, getAllHealth, BaseAdapter } from "../adapters/index";
import { ReviewRequest } from "../types";

/** Build a minimal request for tests */
function makeRequest(overrides: Partial<ReviewRequest> = {}): ReviewRequest {
  return {
    pr: {
      owner: "test-org",
      repo: "test-repo",
      number: 1,
      head_sha: "abc123",
      base_sha: "def456",
    },
    event: "opened",
    ...overrides,
  };
}

describe("adapter index — getAdapter dispatch", () => {
  test("getAdapter returns a valid adapter for every known tool", () => {
    // Map of tool name → expected adapter name. codeql-autofix shares the
    // CodeQLAdapter class whose name is "codeql" by design.
    const expected: Record<string, string> = {
      copilot: "copilot",
      coderabbit: "coderabbit",
      cursor: "cursor",
      forge: "forge",
      kilocode: "kilocode",
      codeql: "codeql",
      "codeql-autofix": "codeql",
    };
    for (const [t, expectedName] of Object.entries(expected)) {
      const a = getAdapter(t as any);
      expect(a).toBeDefined();
      expect(a.name).toBe(expectedName);
      expect(typeof a.review).toBe("function");
      expect(typeof a.health).toBe("function");
    }
  });

  test("getAdapter caches instances across calls", () => {
    const a1 = getAdapter("forge");
    const a2 = getAdapter("forge");
    expect(a1).toBe(a2);
  });

  test("getAdapter falls back to Forge for unknown tools", () => {
    const a = getAdapter("nonexistent" as any);
    expect(a.name).toBe("forge");
  });
});

describe("BaseAdapter shared behavior", () => {
  test("createEmptyReport returns a valid report with no findings", () => {
    const adapter = new ForgeAdapter();
    const report = adapter["createEmptyReport"](makeRequest(), "forge");
    expect(report.tool).toBe("forge");
    expect(report.findings).toEqual([]);
    expect(report.summary.total).toBe(0);
  });

  test("mapSeverity covers P0–P3", () => {
    const adapter = new ForgeAdapter();
    expect(adapter["mapSeverity"]("critical", "forge")).toBe("P0");
    expect(adapter["mapSeverity"]("warning", "forge")).toBe("P1");
    expect(adapter["mapSeverity"]("info", "forge")).toBe("P2");
    expect(adapter["mapSeverity"]("nit", "forge")).toBe("P3");
  });

  test("mapCategory maps standard categories", () => {
    const adapter = new ForgeAdapter();
    expect(adapter["mapCategory"]("security")).toBe("security");
    expect(adapter["mapCategory"]("performance")).toBe("performance");
    expect(adapter["mapCategory"]("test")).toBe("test");
    expect(adapter["mapCategory"]("docstring")).toBe("documentation");
  });

  test("makeFindingId is deterministic and prefixed with tool name", () => {
    const adapter = new ForgeAdapter();
    const id1 = adapter["makeFindingId"]("a.ts", 5, "issue");
    const id2 = adapter["makeFindingId"]("a.ts", 5, "issue");
    const id3 = adapter["makeFindingId"]("b.ts", 5, "issue");
    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id1.startsWith("forge-")).toBe(true);
  });
});

describe("ForgeAdapter", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("returns empty report when no diff is available", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(""),
    } as any);
    const adapter = new ForgeAdapter();
    const report = await adapter.review(makeRequest());
    expect(report.findings).toEqual([]);
  });

  test("health() returns available=true when OmniRoute /health responds 200", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true } as any);
    const adapter = new ForgeAdapter();
    const h = await adapter.health();
    expect(h.available).toBe(true);
  });

  test("health() returns available=false when OmniRoute is unreachable", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const adapter = new ForgeAdapter();
    const h = await adapter.health();
    expect(h.available).toBe(false);
    expect(h.remaining_quota).toBe(0);
  });
});

describe("CodeRabbitAdapter", () => {
  test("returns empty report when CODERABBIT_API_KEY is not set", async () => {
    delete process.env.CODERABBIT_API_KEY;
    const adapter = new CodeRabbitAdapter();
    const report = await adapter.review(makeRequest());
    expect(report.tool).toBe("coderabbit");
    expect(report.findings).toEqual([]);
  });

  test("health() returns available=false without API key", async () => {
    delete process.env.CODERABBIT_API_KEY;
    const adapter = new CodeRabbitAdapter();
    const h = await adapter.health();
    expect(h.available).toBe(false);
  });
});

describe("CursorAdapter", () => {
  test("returns empty report when CURSOR_API_KEY is not set", async () => {
    delete process.env.CURSOR_API_KEY;
    const adapter = new CursorAdapter();
    const report = await adapter.review(makeRequest());
    expect(report.tool).toBe("cursor");
    expect(report.findings).toEqual([]);
  });

  test("health() returns available=false without API key", async () => {
    delete process.env.CURSOR_API_KEY;
    const adapter = new CursorAdapter();
    const h = await adapter.health();
    expect(h.available).toBe(false);
  });
});

describe("KiloCodeAdapter", () => {
  test("returns empty report when KILOCODE_API_KEY is not set", async () => {
    delete process.env.KILOCODE_API_KEY;
    const adapter = new KiloCodeAdapter();
    const report = await adapter.review(makeRequest());
    expect(report.tool).toBe("kilocode");
    expect(report.findings).toEqual([]);
  });

  test("health() returns quota=50 for free tier", async () => {
    process.env.KILOCODE_API_KEY = "test-key";
    const adapter = new KiloCodeAdapter();
    const h = await adapter.health();
    expect(h.available).toBe(true);
    expect(h.remaining_quota).toBe(50);
  });
});

describe("CopilotAdapter", () => {
  test("returns empty report when GITHUB_TOKEN is not set", async () => {
    delete process.env.GITHUB_TOKEN;
    const adapter = new CopilotAdapter();
    const report = await adapter.review(makeRequest());
    expect(report.tool).toBe("copilot");
    expect(report.findings).toEqual([]);
  });

  test("health() returns available=true (native)", async () => {
    const adapter = new CopilotAdapter();
    const h = await adapter.health();
    expect(h.available).toBe(true);
  });
});

describe("CodeQLAdapter", () => {
  test("returns empty report when GITHUB_TOKEN is not set", async () => {
    delete process.env.GITHUB_TOKEN;
    const adapter = new CodeQLAdapter();
    const report = await adapter.review(makeRequest());
    expect(report.tool).toBe("codeql");
    expect(report.findings).toEqual([]);
  });

  test("health() returns near-infinite quota (native)", async () => {
    const adapter = new CodeQLAdapter();
    const h = await adapter.health();
    expect(h.available).toBe(true);
    expect(h.remaining_quota).toBeGreaterThan(1000);
  });
});

describe("getAllHealth — parallel health probes", () => {
  test("returns health for all 7 known tools", async () => {
    const health = await getAllHealth();
    expect(Object.keys(health).sort()).toEqual(
      ["codeql", "codeql-autofix", "coderabbit", "copilot", "cursor", "forge", "kilocode"].sort(),
    );
    for (const tool of Object.values(health)) {
      const t = tool as { available: boolean; remaining_quota: number };
      expect(typeof t.available).toBe("boolean");
      expect(typeof t.remaining_quota).toBe("number");
    }
  });
});

describe("BaseAdapter export", () => {
  test("BaseAdapter is exported", () => {
    expect(BaseAdapter).toBeDefined();
  });
});
