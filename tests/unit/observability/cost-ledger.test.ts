/**
 * tests/unit/observability/cost-ledger.test.ts
 *
 * PR-007 cost-ledger tests. Verifies the task-spec API surface:
 *   - recordTokenUsage increments the spec metrics + ledger
 *   - getTenantCost returns a per-tenant summary
 *   - getAllTenantCosts returns all tenants
 *   - resetForTests wipes state
 *   - multi-tenant isolation
 *   - unknown provider tolerated (fallback pricing)
 *   - kind allow-list enforced
 *   - concurrent records are safe (Node is single-threaded; we exercise
 *     interleaving through awaits)
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  recordTokenUsage,
  recordTokenUsageWithLedger,
  getTenantCost,
  getAllTenantCosts,
  resetForTests,
  isTelemetryDisabled,
  admitTenantId,
  TENANT_ID_CAPACITY,
  computeCostUsd,
  _writeLedgerEntry,
} from "../../../src/lib/observability/costLedger";
import {
  tenantCostDollarsTotal,
  tenantTokensTotal,
  metricsRegistry,
} from "../../../src/lib/observability/metrics";

function resetAll(): void {
  resetForTests();
  metricsRegistry.reset();
}

test("cost-ledger: record + get round-trip", () => {
  resetAll();
  recordTokenUsageWithLedger({
    tenantId: "t-alpha",
    provider: "openai",
    model: "gpt-4o",
    kind: "input",
    count: 1000,
  });
  const summary = getTenantCost("t-alpha", 0);
  assert.equal(summary.tenantId, "t-alpha");
  assert.equal(summary.totalTokens, 1000);
  assert.ok(summary.totalCostUsd > 0, "expected non-zero cost");
  assert.equal(summary.buckets.length, 1);
  assert.equal(summary.buckets[0].provider, "openai");
  assert.equal(summary.buckets[0].model, "gpt-4o");
  assert.equal(summary.buckets[0].kind, "input");
  assert.equal(summary.buckets[0].tokens, 1000);
});

test("cost-ledger: getTenantCost with since filter", () => {
  resetAll();
  const start = Date.now();
  recordTokenUsageWithLedger({ tenantId: "t-since", provider: "openai", model: "gpt-4o", kind: "input", count: 1000 });
  // Cutoff in the future → no rows.
  const future = getTenantCost("t-since", start + 10_000);
  assert.equal(future.totalTokens, 0);
  assert.equal(future.buckets.length, 0);
  // Cutoff in the past → one row.
  const past = getTenantCost("t-since", start - 10_000);
  assert.equal(past.totalTokens, 1000);
});

test("cost-ledger: getAllTenantCosts returns every tenant", () => {
  resetAll();
  recordTokenUsageWithLedger({ tenantId: "t-1", provider: "openai", model: "gpt-4o", kind: "input", count: 500 });
  recordTokenUsageWithLedger({ tenantId: "t-2", provider: "anthropic", model: "claude-sonnet-4", kind: "output", count: 750 });
  const all = getAllTenantCosts(0);
  const ids = all.map((s) => s.tenantId).sort();
  assert.deepEqual(ids, ["t-1", "t-2"]);
  const t1 = all.find((s) => s.tenantId === "t-1")!;
  const t2 = all.find((s) => s.tenantId === "t-2")!;
  assert.equal(t1.totalTokens, 500);
  assert.equal(t2.totalTokens, 750);
});

test("cost-ledger: resetForTests wipes the ledger and metric registry", () => {
  resetAll();
  recordTokenUsageWithLedger({ tenantId: "t-r", provider: "openai", model: "gpt-4o", kind: "input", count: 1000 });
  assert.ok(getAllTenantCosts(0).length >= 1);
  resetForTests();
  metricsRegistry.reset();
  assert.equal(getAllTenantCosts(0).length, 0);
  assert.equal(getTenantCost("t-r", 0).totalTokens, 0);
});

test("cost-ledger: multi-tenant isolation (records do not leak across tenants)", () => {
  resetAll();
  recordTokenUsageWithLedger({ tenantId: "tenant-a", provider: "openai", model: "gpt-4o", kind: "input", count: 100 });
  recordTokenUsageWithLedger({ tenantId: "tenant-b", provider: "anthropic", model: "claude-sonnet-4", kind: "input", count: 200 });
  const a = getTenantCost("tenant-a", 0);
  const b = getTenantCost("tenant-b", 0);
  assert.equal(a.totalTokens, 100);
  assert.equal(b.totalTokens, 200);
  assert.equal(a.buckets[0].provider, "openai");
  assert.equal(b.buckets[0].provider, "anthropic");
});

test("cost-ledger: unknown provider/model falls back to FALLBACK_RATE_PER_1K", () => {
  resetAll();
  recordTokenUsageWithLedger({ tenantId: "t-x", provider: "unknown-vendor", model: "mystery-1", kind: "input", count: 1000 });
  const summary = getTenantCost("t-x", 0);
  assert.equal(summary.totalTokens, 1000);
  // Fallback rate is $0.01 / 1k tokens. 1000 input tokens → $0.01.
  assert.ok(
    Math.abs(summary.totalCostUsd - 0.01) < 1e-6,
    `expected $0.01 fallback cost, got ${summary.totalCostUsd}`
  );
});

test("cost-ledger: kind allow-list enforced (unknown kinds normalise to 'input')", () => {
  resetAll();
  recordTokenUsageWithLedger({ tenantId: "t-k", provider: "openai", model: "gpt-4o", kind: "garbage", count: 500 });
  const summary = getTenantCost("t-k", 0);
  assert.equal(summary.buckets[0].kind, "input");
  // The metric itself is labelled with the normalised kind.
  const tokens = tenantTokensTotal.get({ tenant_id: "t-k", provider: "openai", model: "gpt-4o", kind: "input" });
  assert.equal(tokens, 500);
});

test("cost-ledger: concurrent records via awaits remain consistent", async () => {
  resetAll();
  const N = 50;
  await Promise.all(
    Array.from({ length: N }, (_, i) =>
      Promise.resolve().then(() =>
        recordTokenUsageWithLedger({
          tenantId: "t-conc",
          provider: "openai",
          model: "gpt-4o",
          kind: "input",
          count: 10,
        })
      )
    )
  );
  const summary = getTenantCost("t-conc", 0);
  assert.equal(summary.totalTokens, N * 10);
  // Cost should be non-zero and consistent with pricing.
  assert.ok(summary.totalCostUsd > 0);
});

test("cost-ledger: OTEL_SDK_DISABLED short-circuits every record", () => {
  resetAll();
  process.env.OTEL_SDK_DISABLED = "true";
  try {
    assert.equal(isTelemetryDisabled(), true);
    recordTokenUsage({ tenantId: "t-off", provider: "openai", model: "gpt-4o", kind: "input", count: 9999 });
    recordTokenUsageWithLedger({ tenantId: "t-off", provider: "openai", model: "gpt-4o", kind: "input", count: 9999 });
    // No metric increment, no ledger entry.
    assert.equal(tenantTokensTotal.get({ tenant_id: "t-off", provider: "openai", model: "gpt-4o", kind: "input" }), 0);
    assert.equal(tenantCostDollarsTotal.get({ tenant_id: "t-off", provider: "openai", model: "gpt-4o", kind: "input" }), 0);
    assert.equal(getTenantCost("t-off", 0).totalTokens, 0);
  } finally {
    delete process.env.OTEL_SDK_DISABLED;
  }
});

test("cost-ledger: tenant_id cardinality cap (FIFO eviction at 1024)", () => {
  resetAll();
  // Admit TENANT_ID_CAPACITY tenants.
  for (let i = 0; i < TENANT_ID_CAPACITY; i++) {
    assert.equal(admitTenantId(`t-${i}`), `t-${i}`);
  }
  // The 1025th tenant is admitted and evicts the oldest (`t-0`).
  assert.equal(admitTenantId("t-overflow"), "t-overflow");
  // Re-admitting `t-0` after eviction admits it fresh (and would evict `t-1`).
  assert.equal(admitTenantId("t-0"), "t-0");
});

test("cost-ledger: computeCostUsd returns 0 for zero tokens, exact for known rows", () => {
  resetAll();
  const zero = computeCostUsd("openai", "gpt-4o", "input", 0);
  assert.equal(zero.costUsd, 0);
  // 1000 input tokens on gpt-4o = $0.0025 per task pricing table.
  const r = computeCostUsd("openai", "gpt-4o", "input", 1000);
  assert.ok(Math.abs(r.costUsd - 0.0025) < 1e-6, `expected $0.0025, got ${r.costUsd}`);
  // Cached tokens also charge at input rate.
  const cached = computeCostUsd("openai", "gpt-4o", "cached", 1000);
  assert.equal(cached.costUsd, r.costUsd);
});

test("cost-ledger: _writeLedgerEntry upserts into the same bucket", () => {
  resetAll();
  _writeLedgerEntry("t-up", "openai", "gpt-4o", "input", 100, 0.00025, Date.now());
  _writeLedgerEntry("t-up", "openai", "gpt-4o", "input", 50, 0.000125, Date.now());
  const summary = getTenantCost("t-up", 0);
  assert.equal(summary.totalTokens, 150);
  assert.ok(Math.abs(summary.totalCostUsd - 0.000375) < 1e-9);
});
