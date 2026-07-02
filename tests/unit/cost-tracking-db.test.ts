/**
 * Tests for the cost-tracking DB module.
 *
 * Covers recordCostEvent, list* helpers, and the two aggregate summaries
 * (per-tenant + per-key) per ADR-031 § 4. 10 cases — happy path, time
 * window filtering, multi-event rollup, breakdown shapes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-db-cost-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const ct = await import("../../src/lib/db/costTracking.ts");
const vk = await import("../../src/lib/db/virtualKeys.ts");

async function resetStorage() {
  core.resetDbInstance();
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (fs.existsSync(TEST_DATA_DIR)) {
        fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
      }
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  core.getDbInstance();
}

await resetStorage();

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function freshKey(tenantId: string, label: string) {
  return vk.mintVirtualKey(tenantId, { label });
}

// ──────────────── recordCostEvent ────────────────

test("recordCostEvent persists and returns the row", async () => {
  await resetStorage();
  const k = freshKey("tenant_a", "k1");
  const ev = ct.recordCostEvent({
    virtualKeyId: k.id,
    tenantId: "tenant_a",
    provider: "openai",
    model: "gpt-4o",
    promptTokens: 100,
    completionTokens: 50,
    costUsd: 0.01,
  });
  assert.equal(ev.virtualKeyId, k.id);
  assert.equal(ev.provider, "openai");
  assert.equal(ev.costUsd, 0.01);
  assert.equal(ev.promptTokens, 100);
  assert.equal(ev.completionTokens, 50);
  assert.ok(ev.occurredAt);
});

test("recordCostEvent requires virtualKeyId and tenantId", () => {
  assert.throws(() =>
    ct.recordCostEvent({
      virtualKeyId: "",
      tenantId: "t",
      provider: "p",
      model: "m",
    }),
  );
  assert.throws(() =>
    ct.recordCostEvent({
      virtualKeyId: "x",
      tenantId: "",
      provider: "p",
      model: "m",
    }),
  );
});

// ──────────────── listCostEventsForTenant / listCostEventsForKey ────────────────

test("listCostEventsForTenant returns events newest-first, time-windowed", async () => {
  await resetStorage();
  const k = freshKey("tenant_a", "k1");
  ct.recordCostEvent({
    virtualKeyId: k.id,
    tenantId: "tenant_a",
    provider: "openai",
    model: "gpt-4o",
    costUsd: 0.01,
    occurredAt: isoDaysAgo(10),
  });
  ct.recordCostEvent({
    virtualKeyId: k.id,
    tenantId: "tenant_a",
    provider: "anthropic",
    model: "claude-opus-4",
    costUsd: 0.05,
    occurredAt: isoDaysAgo(2),
  });
  // 1 day window: should only see the recent one
  const recent = ct.listCostEventsForTenant("tenant_a", isoDaysAgo(3));
  assert.equal(recent.length, 1);
  assert.equal(recent[0].provider, "anthropic");
  // 30 day window: should see both
  const all = ct.listCostEventsForTenant("tenant_a", isoDaysAgo(30));
  assert.equal(all.length, 2);
});

test("listCostEventsForKey scopes to a single key", async () => {
  await resetStorage();
  const k1 = freshKey("tenant_a", "k1");
  const k2 = freshKey("tenant_a", "k2");
  ct.recordCostEvent({
    virtualKeyId: k1.id,
    tenantId: "tenant_a",
    provider: "openai",
    model: "gpt-4o",
    costUsd: 0.01,
  });
  ct.recordCostEvent({
    virtualKeyId: k2.id,
    tenantId: "tenant_a",
    provider: "openai",
    model: "gpt-4o",
    costUsd: 0.02,
  });
  const k1Events = ct.listCostEventsForKey(k1.id);
  const k2Events = ct.listCostEventsForKey(k2.id);
  assert.equal(k1Events.length, 1);
  assert.equal(k1Events[0].costUsd, 0.01);
  assert.equal(k2Events.length, 1);
  assert.equal(k2Events[0].costUsd, 0.02);
});

// ──────────────── summarizeCostForTenant ────────────────

test("summarizeCostForTenant rolls up totals + breakdowns", async () => {
  await resetStorage();
  const k = freshKey("tenant_a", "k1");
  ct.recordCostEvent({
    virtualKeyId: k.id,
    tenantId: "tenant_a",
    provider: "openai",
    model: "gpt-4o",
    promptTokens: 100,
    completionTokens: 50,
    costUsd: 0.01,
    occurredAt: isoDaysAgo(1),
  });
  ct.recordCostEvent({
    virtualKeyId: k.id,
    tenantId: "tenant_a",
    provider: "openai",
    model: "gpt-4o-mini",
    promptTokens: 200,
    completionTokens: 100,
    costUsd: 0.005,
    occurredAt: isoDaysAgo(1),
  });
  ct.recordCostEvent({
    virtualKeyId: k.id,
    tenantId: "tenant_a",
    provider: "anthropic",
    model: "claude-opus-4",
    promptTokens: 300,
    completionTokens: 150,
    costUsd: 0.05,
    occurredAt: isoDaysAgo(2),
  });
  const summary = ct.summarizeCostForTenant("tenant_a", isoDaysAgo(7));
  assert.equal(summary.eventCount, 3);
  assert.equal(summary.totalCostUsd, 0.065);
  assert.equal(summary.totalPromptTokens, 600);
  assert.equal(summary.totalCompletionTokens, 300);
  // byProvider: 2 providers, openai = 0.015, anthropic = 0.05
  assert.equal(summary.byProvider.length, 2);
  const openaiBucket = summary.byProvider.find((b) => b.key === "openai");
  assert.ok(openaiBucket);
  assert.equal(openaiBucket!.costUsd, 0.015);
  assert.equal(openaiBucket!.eventCount, 2);
  // byModel: 3 models
  assert.equal(summary.byModel.length, 3);
  // byDay: 2 distinct days
  assert.equal(summary.byDay.length, 2);
  // Sorted by cost desc
  assert.equal(summary.byProvider[0].key, "anthropic");
});

test("summarizeCostForTenant filters by time window", async () => {
  await resetStorage();
  const k = freshKey("tenant_a", "k1");
  ct.recordCostEvent({
    virtualKeyId: k.id,
    tenantId: "tenant_a",
    provider: "openai",
    model: "gpt-4o",
    costUsd: 0.01,
    occurredAt: isoDaysAgo(60),
  });
  ct.recordCostEvent({
    virtualKeyId: k.id,
    tenantId: "tenant_a",
    provider: "openai",
    model: "gpt-4o",
    costUsd: 0.02,
    occurredAt: isoDaysAgo(2),
  });
  const last7 = ct.summarizeCostForTenant("tenant_a", isoDaysAgo(7));
  assert.equal(last7.eventCount, 1);
  assert.equal(last7.totalCostUsd, 0.02);
});

test("summarizeCostForTenant on empty tenant returns zeroed summary", async () => {
  await resetStorage();
  const summary = ct.summarizeCostForTenant("no-such-tenant", isoDaysAgo(30));
  assert.equal(summary.eventCount, 0);
  assert.equal(summary.totalCostUsd, 0);
  assert.equal(summary.totalPromptTokens, 0);
  assert.equal(summary.totalCompletionTokens, 0);
  assert.equal(summary.byProvider.length, 0);
  assert.equal(summary.byModel.length, 0);
  assert.equal(summary.byDay.length, 0);
});

// ──────────────── summarizeCostForKey ────────────────

test("summarizeCostForKey isolates rollup to a single key", async () => {
  await resetStorage();
  const k1 = freshKey("tenant_a", "k1");
  const k2 = freshKey("tenant_a", "k2");
  ct.recordCostEvent({
    virtualKeyId: k1.id,
    tenantId: "tenant_a",
    provider: "openai",
    model: "gpt-4o",
    costUsd: 0.01,
  });
  ct.recordCostEvent({
    virtualKeyId: k2.id,
    tenantId: "tenant_a",
    provider: "openai",
    model: "gpt-4o",
    costUsd: 0.99,
  });
  const k1Summary = ct.summarizeCostForKey(k1.id, isoDaysAgo(7));
  const k2Summary = ct.summarizeCostForKey(k2.id, isoDaysAgo(7));
  assert.equal(k1Summary.totalCostUsd, 0.01);
  assert.equal(k2Summary.totalCostUsd, 0.99);
  assert.equal(k1Summary.eventCount, 1);
  assert.equal(k2Summary.eventCount, 1);
});

// ──────────────── recordVirtualKeyUsage auto-emits cost_event ────────────────

test("recordVirtualKeyUsage auto-emits a cost_event with the same fields", async () => {
  await resetStorage();
  const k = freshKey("tenant_a", "k1");
  const r = vk.recordVirtualKeyUsage(k.id, 0.05, {
    provider: "openai",
    model: "gpt-4o",
    promptTokens: 1000,
    completionTokens: 500,
  });
  assert.equal(r.ok, true);
  const events = ct.listCostEventsForKey(k.id);
  assert.equal(events.length, 1);
  assert.equal(events[0].costUsd, 0.05);
  assert.equal(events[0].provider, "openai");
  assert.equal(events[0].model, "gpt-4o");
  assert.equal(events[0].promptTokens, 1000);
  assert.equal(events[0].completionTokens, 500);
});

test("recordVirtualKeyUsage does NOT emit a cost_event when over budget", async () => {
  await resetStorage();
  const k = freshKey("tenant_a", "k1", /* maxCostUsd ignored at this layer */);
  // No cap; we use a tight rpd cap to force the over-RPD path.
  const k2 = vk.mintVirtualKey("tenant_a", { label: "k2", maxRpd: 1 });
  assert.equal(vk.recordVirtualKeyUsage(k2.id, 0.01).ok, true);
  const denied = vk.recordVirtualKeyUsage(k2.id, 0.01);
  assert.equal(denied.ok, false);
  // Only the successful call produced a cost_event.
  const events = ct.listCostEventsForKey(k2.id);
  assert.equal(events.length, 1);
});

test("byDay series is sorted ascending and bucket key is YYYY-MM-DD", async () => {
  await resetStorage();
  const k = freshKey("tenant_a", "k1");
  ct.recordCostEvent({
    virtualKeyId: k.id,
    tenantId: "tenant_a",
    provider: "openai",
    model: "gpt-4o",
    costUsd: 0.01,
    occurredAt: isoDaysAgo(3),
  });
  ct.recordCostEvent({
    virtualKeyId: k.id,
    tenantId: "tenant_a",
    provider: "openai",
    model: "gpt-4o",
    costUsd: 0.02,
    occurredAt: isoDaysAgo(1),
  });
  const summary = ct.summarizeCostForTenant("tenant_a", isoDaysAgo(7));
  assert.equal(summary.byDay.length, 2);
  assert.match(summary.byDay[0].day, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(summary.byDay[0].day < summary.byDay[1].day, "byDay must be ascending");
});
