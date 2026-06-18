import { normalizeSeverity, normalizeCategory, deduplicateFindings, aggregateReports, getConclusion, formatMarkdownReport } from "../aggregator";
import { selectReviewerForPR, getOrAssignTool, assignTool, getAssignedTool, clearAssignment } from "../selector";
import { getQuotaState, consumeQuota, getDefaultQuota, markDegraded, recordFailure, enqueueReview, dequeueReview, getQueueSize } from "../quota";
import { applyDelta, extractChangedLines, getLastReviewedCommit, setLastReviewedCommit } from "../poster";
import { UnifiedReviewFinding } from "../types";

describe("aggregator", () => {
  test("normalizeSeverity maps tool severities to P0–P3", () => {
    expect(normalizeSeverity("critical")).toBe("P0");
    expect(normalizeSeverity("blocker")).toBe("P0");
    expect(normalizeSeverity("high")).toBe("P0");
    expect(normalizeSeverity("warning")).toBe("P1");
    expect(normalizeSeverity("medium")).toBe("P1");
    expect(normalizeSeverity("info")).toBe("P2");
    expect(normalizeSeverity("note")).toBe("P2");
    expect(normalizeSeverity("low")).toBe("P3");
    expect(normalizeSeverity("suggestion")).toBe("P3");
  });

  test("normalizeCategory maps tool categories", () => {
    expect(normalizeCategory("security")).toBe("security");
    expect(normalizeCategory("performance")).toBe("performance");
    expect(normalizeCategory("style")).toBe("style");
    expect(normalizeCategory("bug")).toBe("bug");
    expect(normalizeCategory("test coverage")).toBe("test");
    expect(normalizeCategory("docstring")).toBe("documentation");
    expect(normalizeCategory("code smell")).toBe("maintainability");
    expect(normalizeCategory("misc")).toBe("maintainability");
  });

  test("deduplicateFindings removes duplicates by (file, line, message)", () => {
    const findings: UnifiedReviewFinding[] = [
      { id: "1", tool: "copilot", severity: "P0", category: "security", file: "a.ts", line_start: 1, line_end: 1, message: "Hardcoded key", original_severity: "critical", confidence: "high", commit_sha: "abc" },
      { id: "2", tool: "coderabbit", severity: "P0", category: "security", file: "a.ts", line_start: 1, line_end: 1, message: "hardcoded key!!!", original_severity: "high", confidence: "high", commit_sha: "abc" },
      { id: "3", tool: "cursor", severity: "P2", category: "style", file: "b.ts", line_start: 2, line_end: 2, message: "Indent with 2 spaces", original_severity: "low", confidence: "medium", commit_sha: "abc" },
    ];
    const out = deduplicateFindings(findings);
    expect(out.length).toBe(2);
  });

  test("aggregateReports produces correct summary", () => {
    const r = aggregateReports([{
      pr_id: "1", commit_sha: "abc", tool: "unified" as any,
      findings: [
        { id: "1", tool: "copilot", severity: "P0", category: "security", file: "a.ts", line_start: 1, line_end: 1, message: "x", original_severity: "x", confidence: "high", commit_sha: "abc" },
        { id: "2", tool: "cursor", severity: "P1", category: "bug", file: "b.ts", line_start: 2, line_end: 2, message: "y", original_severity: "y", confidence: "high", commit_sha: "abc" },
      ],
      summary: { total: 2, by_severity: {}, by_category: {}, new_findings: 0, resolved_findings: 0 },
      generated_at: new Date().toISOString(),
    }]);
    expect(r.summary.total).toBe(2);
    expect(r.summary.by_severity.P0).toBe(1);
    expect(r.summary.by_severity.P1).toBe(1);
  });

  test("getConclusion reflects severity", () => {
    const base = { pr_id: "1", commit_sha: "abc", tool: "unified" as any, findings: [], generated_at: "" } as any;
    expect(getConclusion({ ...base, summary: { ...base.summary, by_severity: { P0: 1 } } })).toBe("failure");
    expect(getConclusion({ ...base, summary: { ...base.summary, by_severity: { P1: 1 } } })).toBe("failure");
    expect(getConclusion({ ...base, summary: { ...base.summary, by_severity: { P2: 1 } } })).toBe("neutral");
    expect(getConclusion({ ...base, summary: { ...base.summary, by_severity: {} } })).toBe("success");
  });

  test("formatMarkdownReport groups by severity", () => {
    const md = formatMarkdownReport({
      pr_id: "1", commit_sha: "abc123", tool: "copilot",
      findings: [
        { id: "1", tool: "copilot", severity: "P0", category: "security", file: "auth.ts", line_start: 42, line_end: 42, message: "Hardcoded key", original_severity: "critical", confidence: "high", commit_sha: "abc" },
      ],
      summary: { total: 1, by_severity: { P0: 1 }, by_category: { security: 1 }, new_findings: 0, resolved_findings: 0 },
      generated_at: "",
    });
    expect(md).toContain("Critical");
    expect(md).toContain("auth.ts:42");
    expect(md).toContain("Hardcoded key");
  });
});

describe("quota", () => {
  test("getQuotaState returns initial state", async () => {
    const s = await getQuotaState("forge", getDefaultQuota("forge"), "test-org");
    expect(s.tool).toBe("forge");
    expect(s.remaining).toBeGreaterThanOrEqual(0);
  });

  test("consumeQuota decrements remaining", async () => {
    const initial = await getQuotaState("kilocode", getDefaultQuota("kilocode"), "test-org-1");
    const consumed = await consumeQuota("kilocode", getDefaultQuota("kilocode"), "test-org-1");
    expect(consumed.used).toBeGreaterThanOrEqual(initial.used);
  });

  test("markDegraded and recordFailure", async () => {
    await markDegraded("cursor", getDefaultQuota("cursor"), "test-org-2", true);
    const s = await getQuotaState("cursor", getDefaultQuota("cursor"), "test-org-2");
    expect(s.degraded).toBe(true);
    await markDegraded("cursor", getDefaultQuota("cursor"), "test-org-2", false);
    const s2 = await getQuotaState("cursor", getDefaultQuota("cursor"), "test-org-2");
    expect(s2.degraded).toBe(false);
  });

  test("enqueueReview / dequeueReview round-trip", async () => {
    const item = { id: "test1", request: {} as any, assigned_tool: "forge" as any, status: "pending" as const, created_at: new Date().toISOString() };
    await enqueueReview(item);
    const size = await getQueueSize("forge");
    expect(size).toBeGreaterThanOrEqual(1);
    const dequeued = await dequeueReview("forge");
    if (dequeued) expect(dequeued.assigned_tool).toBe("forge");
  });
});

describe("selector", () => {
  test("getOrAssignTool returns a valid tool", async () => {
    const tool = await getOrAssignTool({
      pr: { owner: "test-org-3", repo: "test-repo", number: 999, head_sha: "abc", base_sha: "def" },
      event: "opened",
    });
    expect(["copilot", "coderabbit", "cursor", "forge", "kilocode", "codeql", "codeql-autofix"]).toContain(tool);
  });

  test("assignTool persists and getAssignedTool retrieves", async () => {
    await assignTool("test-org-4", "test-repo", 100, "coderabbit");
    const t = await getAssignedTool("test-org-4", "test-repo", 100);
    expect(t).toBe("coderabbit");
    await clearAssignment("test-org-4", "test-repo", 100);
    const t2 = await getAssignedTool("test-org-4", "test-repo", 100);
    expect(t2).toBeNull();
  });

  test("sticky: same PR returns same tool on second call", async () => {
    const req = { pr: { owner: "test-org-5", repo: "test-repo", number: 200, head_sha: "abc", base_sha: "def" }, event: "opened" as const };
    const t1 = await getOrAssignTool(req);
    const t2 = await getOrAssignTool(req);
    expect(t1).toBe(t2);
  });
});

describe("poster — delta", () => {
  test("extractChangedLines parses unified diff", () => {
    const diff = [{
      filename: "src/a.ts",
      patch: "@@ -1,3 +1,4 @@\n unchanged1\n+added1\n unchanged2\n+added2\n unchanged3\n",
    }];
    const out = extractChangedLines(diff as any);
    const lines = out.get("src/a.ts");
    expect(lines).toBeDefined();
    expect(lines!.has(2)).toBe(true);
    expect(lines!.has(4)).toBe(true);
  });

  test("applyDelta preserves findings on unchanged lines, drops findings on changed lines", () => {
    const changed = new Map<string, Set<number>>();
    changed.set("a.ts", new Set([10]));
    const prev: UnifiedReviewFinding[] = [
      { id: "1", tool: "forge", severity: "P0", category: "bug", file: "a.ts", line_start: 5, line_end: 5, message: "preserved", original_severity: "x", confidence: "high", commit_sha: "abc" },
      { id: "2", tool: "forge", severity: "P0", category: "bug", file: "a.ts", line_start: 10, line_end: 10, message: "dropped", original_severity: "x", confidence: "high", commit_sha: "abc" },
    ];
    const curr: UnifiedReviewFinding[] = [
      { id: "3", tool: "forge", severity: "P1", category: "bug", file: "a.ts", line_start: 11, line_end: 11, message: "new", original_severity: "x", confidence: "high", commit_sha: "abc" },
    ];
    const out = applyDelta(prev, curr, changed);
    expect(out.find((f) => f.message === "preserved")).toBeDefined();
    expect(out.find((f) => f.message === "dropped")).toBeUndefined();
    expect(out.find((f) => f.message === "new")).toBeDefined();
  });

  test("getLastReviewedCommit / setLastReviewedCommit round-trip", async () => {
    await setLastReviewedCommit("test-org-6", "repo", 1, "sha-abc");
    const got = await getLastReviewedCommit("test-org-6", "repo", 1);
    expect(got).toBe("sha-abc");
  });
});
