import { loadConfig, getEnabledTools, getToolConfig, loadConfigForRepo, invalidateConfig } from "../config";
import { UnifiedReviewConfigSchema } from "../types";

describe("config — loadConfig()", () => {
  test("returns default config synchronously", () => {
    const c = loadConfig();
    expect(c.reviewers.length).toBeGreaterThan(0);
    expect(c.reviewers.map((r) => r.name)).toContain("forge");
    expect(c.reviewers.map((r) => r.name)).toContain("kilocode");
    expect(c.reviewers.map((r) => r.name)).toContain("copilot");
  });
});

describe("config — getEnabledTools()", () => {
  test("returns only enabled reviewers", () => {
    const tools = getEnabledTools();
    expect(tools.every((t) => t.enabled)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });
});

describe("config — getToolConfig()", () => {
  test("returns config for known tool", () => {
    const cfg = getToolConfig("forge");
    expect(cfg).toBeDefined();
    expect(cfg?.name).toBe("forge");
  });

  test("returns undefined for unknown tool", () => {
    const cfg = getToolConfig("nonexistent" as any);
    expect(cfg).toBeUndefined();
  });
});

describe("config — loadConfigForRepo() (async)", () => {
  test("returns default config when no repo or env config exists", async () => {
    delete process.env.UNIFIED_REVIEW_CONFIG;
    const { config, source } = await loadConfigForRepo("test-org-1", "test-repo-1");
    expect(source).toBe("default");
    expect(config.reviewers.length).toBeGreaterThan(0);
  });

  test("honors env override (UNIFIED_REVIEW_CONFIG)", async () => {
    process.env.UNIFIED_REVIEW_CONFIG = `
reviewers:
  - name: forge
    weight: 2.0
    quota:
      reviews_per_day: 99
    enabled: true
    adapter: local
    config: {}
`;
    invalidateConfig("test-org-2", "test-repo-2");
    const { config, source } = await loadConfigForRepo("test-org-2", "test-repo-2");
    expect(source).toBe("env");
    const forge = config.reviewers.find((r) => r.name === "forge");
    expect(forge).toBeDefined();
    expect(forge?.weight).toBe(2.0);
    expect(forge?.quota.reviews_per_day).toBe(99);
    delete process.env.UNIFIED_REVIEW_CONFIG;
  });

  test("caches config per repo", async () => {
    invalidateConfig("test-org-3", "test-repo-3");
    const r1 = await loadConfigForRepo("test-org-3", "test-repo-3");
    const r2 = await loadConfigForRepo("test-org-3", "test-repo-3");
    expect(r1.config).toBe(r2.config); // same reference — cached
  });

  test("falls back to default on validation error", async () => {
    process.env.UNIFIED_REVIEW_CONFIG = "reviewers: not_an_array";
    invalidateConfig("test-org-4", "test-repo-4");
    const { source } = await loadConfigForRepo("test-org-4", "test-repo-4");
    expect(source).toBe("default");
    delete process.env.UNIFIED_REVIEW_CONFIG;
  });
});

describe("config — Zod schema", () => {
  test("default config validates against the schema", () => {
    const result = UnifiedReviewConfigSchema.safeParse(loadConfig());
    expect(result.success).toBe(true);
  });

  test("rejects invalid tool names", () => {
    const result = UnifiedReviewConfigSchema.safeParse({
      reviewers: [
        { name: "not-a-real-tool", weight: 1, quota: { reviews_per_day: 1 }, enabled: true, adapter: "api", config: {} },
      ],
    });
    expect(result.success).toBe(false);
  });
});
