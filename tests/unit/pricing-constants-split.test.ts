// Characterization of the pricing.ts split (god-file decomposition): the host became a barrel that
// re-exports DEFAULT_PRICING (now merged from 4 semantic family files that import shared tier consts)
// and keeps the helper functions. Pure-data move → behavior identical. Locks: public surface, the
// spread-merge integrity, and that lookups/cost math resolve unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";

const P = await import("../../src/shared/constants/pricing.ts");
const OAUTH = await import("../../src/shared/constants/pricing/oauth-subscriptions.ts");

test("barrel still exports DEFAULT_PRICING + supported helpers", () => {
  for (const name of ["DEFAULT_PRICING", "getPricingForModel", "getDefaultPricing"]) {
    assert.ok(name in P, `missing export: ${name}`);
  }
  assert.equal(Object.hasOwn(P, "calculateCostFromTokens"), false);
});

test("DEFAULT_PRICING merges the 4 family files; families partition all entries", async () => {
  const merged = Object.keys((P as Record<string, object>).DEFAULT_PRICING).length;
  const families: [string, string][] = [
    ["oauth-subscriptions", "DEFAULT_PRICING_OAUTH"],
    ["frontier-labs", "DEFAULT_PRICING_FRONTIER"],
    ["inference-hosts", "DEFAULT_PRICING_INFERENCE"],
    ["regional", "DEFAULT_PRICING_REGIONAL"],
  ];
  let famTotal = 0;
  const seen = new Set<string>();
  for (const [file, exportName] of families) {
    const mod = await import(`../../src/shared/constants/pricing/${file}.ts`);
    for (const k of Object.keys(mod[exportName])) {
      assert.ok(!seen.has(k), `pricing key ${k} appears in more than one family`);
      seen.add(k);
      famTotal++;
    }
  }
  assert.equal(merged, famTotal, "spread-merge lost/duplicated a top-level key");
  assert.ok(merged > 25);
});

test("shared tier consts feed the parts (a known model resolves to a shared rate)", () => {
  const pricing = (P as Record<string, (p: string, m: string) => unknown>).getPricingForModel(
    "openai",
    "gpt-4o"
  );
  assert.ok(pricing && typeof pricing === "object");
  assert.equal(typeof (pricing as { input?: number }).input, "number");
});

test("OAuth split preserves exact GPT-5.6 Codex tier pricing", () => {
  const expected = {
    "gpt-5.6-sol": { input: 5, output: 30, cached: 0.5, reasoning: 30, cache_creation: 6.25 },
    "gpt-5.6-terra": { input: 2.5, output: 15, cached: 0.25, reasoning: 15, cache_creation: 3.125 },
    "gpt-5.6-luna": { input: 1, output: 6, cached: 0.1, reasoning: 6, cache_creation: 1.25 },
  };

  for (const [model, rates] of Object.entries(expected)) {
    assert.deepEqual(OAUTH.DEFAULT_PRICING_OAUTH.cx[model], rates, model);
  }
});

test("formatCost remains re-exported from the pricing barrel", () => {
  const fn = (P as Record<string, (value: number) => string>).formatCost;
  assert.equal(fn(0.0123), "$0.0123");
});
