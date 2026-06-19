/**
 * Tests for the provider-discovery A2A skill.
 *
 * Verifies the 232-provider catalog at src/shared/constants/providers.ts
 * is enumerated correctly, filters apply, recommendations pick 3 best-fit
 * providers with rationale, and health checks inspect env-var presence
 * without making network calls.
 *
 * Source of truth:
 *   - src/shared/constants/providers.ts (10 sections, 232 providers)
 *   - src/lib/a2a/skills/providerDiscovery.ts (this implementation)
 */

import { describe, expect, it } from "vitest";
import { executeProviderDiscovery } from "@/lib/a2a/skills/providerDiscovery";
import type { A2ATask } from "@/lib/a2a/taskManager";

function makeTask(metadata: Record<string, unknown> | undefined): A2ATask {
  return {
    id: "test-task",
    skill: "provider-discovery",
    messages: [],
    metadata,
    state: "working",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function parseArtifact(
  result: Awaited<ReturnType<typeof executeProviderDiscovery>>,
): Record<string, unknown> {
  expect(result.artifacts).toHaveLength(1);
  expect(result.artifacts[0].type).toBe("text");
  return JSON.parse(result.artifacts[0].content);
}

describe("providerDiscovery A2A skill", () => {
  it("lists the full catalog when no filters are supplied (action=list)", async () => {
    const result = await executeProviderDiscovery(
      makeTask({ action: "list" }),
    );
    const payload = parseArtifact(result);

    // The catalog has 232 providers across 10 sections.
    expect(payload.totalCount).toBe(232);
    expect(payload.filteredCount).toBe(232);
    expect(Array.isArray(payload.providers)).toBe(true);
    const providers = payload.providers as Array<Record<string, unknown>>;
    expect(providers.length).toBe(232);

    // Spot-check the shape of a representative entry (OpenAI should be api_key + chat).
    const openai = providers.find((p) => p.id === "openai");
    expect(openai).toBeDefined();
    expect(openai?.authType).toBe("api_key");
    expect(Array.isArray(openai?.capabilities)).toBe(true);
    expect((openai?.capabilities as string[])).toContain("chat");
  });

  it("filters the list by capability (action=list, capability=embeddings)", async () => {
    const result = await executeProviderDiscovery(
      makeTask({ action: "list", query: { capability: "embeddings" } }),
    );
    const payload = parseArtifact(result);
    const providers = payload.providers as Array<Record<string, unknown>>;

    expect(payload.totalCount).toBe(232);
    expect(payload.filteredCount).toBeLessThan(232);
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.length).toBe(payload.filteredCount);
    for (const p of providers) {
      expect((p.capabilities as string[])).toContain("embeddings");
    }
    // OpenAI ships embeddings, so it must be in the result set.
    expect(providers.some((p) => p.id === "openai")).toBe(true);
  });

  it("filters the list by authType (action=list, authType=oauth)", async () => {
    const result = await executeProviderDiscovery(
      makeTask({ action: "list", query: { authType: "oauth" } }),
    );
    const payload = parseArtifact(result);
    const providers = payload.providers as Array<Record<string, unknown>>;

    expect(payload.filteredCount).toBeGreaterThan(0);
    expect(providers.length).toBe(payload.filteredCount);
    for (const p of providers) {
      expect(p.authType).toBe("oauth");
    }
    // ChatGPT (oauth) must be present.
    expect(providers.some((p) => p.id === "chatgpt")).toBe(true);
  });

  it("filters the list by freeOnly=true and returns only free-tier providers", async () => {
    const result = await executeProviderDiscovery(
      makeTask({ action: "list", query: { freeOnly: true } }),
    );
    const payload = parseArtifact(result);
    const providers = payload.providers as Array<Record<string, unknown>>;

    expect(payload.filteredCount).toBeGreaterThan(0);
    expect(payload.filteredCount).toBeLessThan(232);
    for (const p of providers) {
      expect(p.freeTier).toBe(true);
    }
  });

  it("filters the list by minContextWindow (only 32k+ context providers)", async () => {
    const result = await executeProviderDiscovery(
      makeTask({ action: "list", query: { minContextWindow: 32000 } }),
    );
    const payload = parseArtifact(result);
    const providers = payload.providers as Array<Record<string, unknown>>;

    expect(payload.filteredCount).toBeGreaterThan(0);
    for (const p of providers) {
      const cw = p.contextWindow as number | null;
      expect(cw).not.toBeNull();
      expect(cw as number).toBeGreaterThanOrEqual(32000);
    }
  });

  it("filters by supportsStreaming=true and includes providers that support it", async () => {
    const result = await executeProviderDiscovery(
      makeTask({ action: "list", query: { supportsStreaming: true } }),
    );
    const payload = parseArtifact(result);
    const providers = payload.providers as Array<Record<string, unknown>>;

    expect(payload.filteredCount).toBeGreaterThan(0);
    for (const p of providers) {
      expect((p.capabilities as string[])).toContain("tools"); // proxy for "openai-compatible-streaming"
    }
  });

  it("recommends exactly 3 providers with rationale (action=recommend)", async () => {
    const result = await executeProviderDiscovery(
      makeTask({
        action: "recommend",
        query: { capability: "chat", authType: "api_key" },
      }),
    );
    const payload = parseArtifact(result);
    const recs = payload.recommendations as Array<{
      id: string;
      score: number;
      rationale: string;
    }>;

    expect(Array.isArray(recs)).toBe(true);
    expect(recs).toHaveLength(3);
    // Scores must be in descending order.
    expect(recs[0].score).toBeGreaterThanOrEqual(recs[1].score);
    expect(recs[1].score).toBeGreaterThanOrEqual(recs[2].score);
    // Rationale must be present and non-empty.
    for (const r of recs) {
      expect(r.rationale.length).toBeGreaterThan(0);
      expect(r.id.length).toBeGreaterThan(0);
    }
  });

  it("returns an empty recommendation set with a warning when no provider matches", async () => {
    // minContextWindow=999_000_000 is impossible — no provider has that much context.
    const result = await executeProviderDiscovery(
      makeTask({
        action: "recommend",
        query: { minContextWindow: 999_000_000 },
      }),
    );
    const payload = parseArtifact(result);
    const recs = payload.recommendations as unknown[];

    expect(recs).toHaveLength(0);
    expect(Array.isArray(payload.warnings)).toBe(true);
    expect((payload.warnings as string[]).length).toBeGreaterThan(0);
  });

  it("checks health of a known provider (env-var presence, no network)", async () => {
    const result = await executeProviderDiscovery(
      makeTask({
        action: "health",
        providers: ["openai"],
        envSnapshot: { OPENAI_API_KEY: "sk-test" },
      }),
    );
    const payload = parseArtifact(result);
    const results = payload.results as Array<Record<string, unknown>>;

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("openai");
    expect(results[0].envVar).toBe("OPENAI_API_KEY");
    expect(results[0].envPresent).toBe(true);
    expect(results[0].status).toBe("configured");
  });

  it("reports health of a known provider with no env var set (status=missing)", async () => {
    const result = await executeProviderDiscovery(
      makeTask({
        action: "health",
        providers: ["openai"],
        envSnapshot: {},
      }),
    );
    const payload = parseArtifact(result);
    const results = payload.results as Array<Record<string, unknown>>;

    expect(results[0].id).toBe("openai");
    expect(results[0].envPresent).toBe(false);
    expect(results[0].status).toBe("missing");
  });

  it("returns status=unknown for an unknown provider id (action=health)", async () => {
    const result = await executeProviderDiscovery(
      makeTask({
        action: "health",
        providers: ["this-provider-does-not-exist-xyz"],
        envSnapshot: {},
      }),
    );
    const payload = parseArtifact(result);
    const results = payload.results as Array<Record<string, unknown>>;

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("this-provider-does-not-exist-xyz");
    expect(results[0].status).toBe("unknown");
    expect(results[0].envPresent).toBe(false);
  });
});
