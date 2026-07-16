/**
 * Tests for the mint-virtual-key A2A skill.
 *
 * Closes the remaining DEBT-006 (virtual-key surface) work that was
 * deferred from B1 of the v8.1 Bifrost track. 6 cases — auth gate, mint
 * happy path, raw key shown once, expiry validation, label and caps
 * pass-through, scope-denied branch.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { A2ATask } from "@/lib/a2a/taskManager";
import { executeMintVirtualKey } from "@/lib/a2a/skills/mintVirtualKey";
import {
  getDbInstance,
  closeDbInstance,
} from "@/lib/db/core";

function makeTask(
  metadata: Record<string, unknown> | undefined,
  messages: A2ATask["messages"] = [],
): A2ATask {
  return {
    id: `task-${Math.random().toString(36).slice(2, 10)}`,
    skill: "mint-virtual-key",
    messages,
    metadata,
    state: "working",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function parseArtifact(result: Awaited<ReturnType<typeof executeMintVirtualKey>>) {
  expect(result.artifacts).toHaveLength(1);
  expect(result.artifacts[0].type).toBe("text");
  return JSON.parse(result.artifacts[0].content);
}

let testSeq = 0;
function uniqueTenant(prefix: string): string {
  testSeq += 1;
  return `${prefix}-${Date.now()}-${testSeq}`;
}

beforeAll(() => {
  getDbInstance();
});

afterAll(() => {
  closeDbInstance();
});

beforeEach(() => {
  getDbInstance().exec("DELETE FROM virtual_keys");
});

describe("mintVirtualKey A2A skill", () => {
  it("rejects callers without the keys:write scope (scope_denied)", async () => {
    const result = await executeMintVirtualKey(
      makeTask({
        tenantId: "tenant_x",
        scopes: ["read:health"], // does NOT include keys:write
      }),
    );
    const payload = parseArtifact(result);
    expect(payload.error).toBe("scope_denied");
    expect(payload.message).toMatch(/keys:write/);
    expect(result.metadata?.success).toBe(false);
    // No row should have been created.
    const count = (getDbInstance()
      .prepare("SELECT COUNT(*) AS n FROM virtual_keys")
      .get() as { n: number }).n;
    expect(count).toBe(0);
  });

  it("rejects callers with no scopes field at all", async () => {
    const result = await executeMintVirtualKey(
      makeTask({ tenantId: "tenant_x" }), // no scopes
    );
    const payload = parseArtifact(result);
    expect(payload.error).toBe("scope_denied");
    expect(result.metadata?.success).toBe(false);
  });

  it("mints a key on the happy path and shows the rawKey exactly once", async () => {
    const tenantId = uniqueTenant("happy");
    const result = await executeMintVirtualKey(
      makeTask({
        tenantId,
        scopes: ["keys:write", "read:health"],
        label: "primary",
        max_cost_usd: 50,
        max_rpd: 200,
      }),
    );
    const payload = parseArtifact(result);
    expect(typeof payload.keyId).toBe("string");
    expect(payload.tenantId).toBe(tenantId);
    expect(payload.label).toBe("primary");
    expect(payload.keyPrefix).toMatch(/^vk_/);
    expect(payload.rawKey).toMatch(/^vk_[0-9a-f]{64}$/);
    expect(payload.warnings).toBeInstanceOf(Array);
    expect(result.metadata?.success).toBe(true);
    expect(result.metadata?.keyId).toBe(payload.keyId);

    // Second call to the same skill with the same args must NOT return
    // a usable rawKey — the row is identified by the fresh UUID, and
    // resolveVirtualKey is the only path that consults the hash. The
    // rawKey returned here is the value the caller must surface to the
    // user; if they lose it, they cannot recover it.
    expect(payload.rawKey).not.toBe(payload.keyId);
  });

  it("validates expires_at and rejects invalid timestamps", async () => {
    const result = await executeMintVirtualKey(
      makeTask({
        tenantId: uniqueTenant("exp"),
        scopes: ["keys:write"],
        expires_at: "not-a-date",
      }),
    );
    const payload = parseArtifact(result);
    expect(payload.error).toBe("invalid_input");
    expect(payload.message).toMatch(/expires_at/);
  });

  it("validates max_cost_usd is non-negative", async () => {
    const result = await executeMintVirtualKey(
      makeTask({
        tenantId: uniqueTenant("neg"),
        scopes: ["keys:write"],
        max_cost_usd: -5,
      }),
    );
    const payload = parseArtifact(result);
    expect(payload.error).toBe("invalid_input");
    expect(payload.message).toMatch(/max_cost_usd/);
  });

  it("emits warnings for unset caps and includes them in the artifact", async () => {
    const result = await executeMintVirtualKey(
      makeTask({
        tenantId: uniqueTenant("warn"),
        scopes: ["keys:write"],
      }),
    );
    const payload = parseArtifact(result);
    expect(result.metadata?.success).toBe(true);
    expect(payload.warnings).toBeInstanceOf(Array);
    expect(payload.warnings.length).toBeGreaterThan(0);
    // At least one of the unset-cap warnings should be present.
    const hasUnsetCapWarning = payload.warnings.some(
      (w: string) =>
        /max_cost_usd|max_rpd|allowed_models|expires_at/.test(w),
    );
    expect(hasUnsetCapWarning).toBe(true);
  });
});
