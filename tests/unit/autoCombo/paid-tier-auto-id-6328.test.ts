/**
 * #6328 (follow-up to #6495 / #6512) — regression guard for
 * `isPaidTierAutoId`, which lets `/v1/models` REMOVE (not just hide) paid-tier
 * `auto/*` ids when the operator opts into `hidePaidModels`.
 */
import { test } from "vitest";
import assert from "node:assert/strict";

import {
  AUTO_SUFFIX_VARIANTS,
  AUTO_TEMPLATE_VARIANTS,
  isPaidTierAutoId,
} from "../../../open-sse/services/autoCombo/builtinCatalog.ts";

test("flat auto/pro-* variants are paid-tier", () => {
  assert.equal(isPaidTierAutoId("auto/pro-coding"), true);
  assert.equal(isPaidTierAutoId("auto/pro-reasoning"), true);
  assert.equal(isPaidTierAutoId("auto/pro-fast"), true);
});

test("only advertised flat pro aliases are paid-tier", () => {
  const advertisedFlatProIds = Object.keys(AUTO_TEMPLATE_VARIANTS).filter((id) =>
    id.slice("auto/".length).startsWith("pro-")
  );
  for (const autoId of advertisedFlatProIds) {
    assert.equal(isPaidTierAutoId(autoId), true, `${autoId} should remain paid-tier`);
  }
  assert.equal(isPaidTierAutoId("auto/pro-unicorn"), false);
  assert.equal(isPaidTierAutoId("auto/pro-"), false);
});

test("suffix auto/<category>:pro variants are paid-tier", () => {
  assert.equal(isPaidTierAutoId("auto/coding:pro"), true);
  assert.equal(isPaidTierAutoId("auto/reasoning:pro"), true);
});

test("only advertised compositional pro aliases are paid-tier", () => {
  const advertisedSuffixProIds = AUTO_SUFFIX_VARIANTS.filter((id) => id.endsWith(":pro"));
  for (const autoId of advertisedSuffixProIds) {
    assert.equal(isPaidTierAutoId(autoId), true, `${autoId} should remain paid-tier`);
  }
  assert.equal(isPaidTierAutoId("auto/chat:pro"), false);
  assert.equal(isPaidTierAutoId("auto/vision:pro"), false);
});

test("non-pro auto/* ids are NOT paid-tier (kept in advertised catalog)", () => {
  assert.equal(isPaidTierAutoId("auto/coding"), false);
  assert.equal(isPaidTierAutoId("auto/coding:free"), false);
  assert.equal(isPaidTierAutoId("auto/coding:fast"), false);
  assert.equal(isPaidTierAutoId("auto/best-coding"), false);
  assert.equal(isPaidTierAutoId("auto/best-free"), false);
  assert.equal(isPaidTierAutoId("auto/vision"), false);
});

test("non-auto ids and malformed input return false (guard)", () => {
  assert.equal(isPaidTierAutoId("openai/gpt-4o"), false);
  assert.equal(isPaidTierAutoId(""), false);
  assert.equal(isPaidTierAutoId("auto/"), false);
  // Argument is typed `string` at the call sites, but the guard tolerates junk.
  assert.equal(isPaidTierAutoId(undefined as unknown as string), false);
  assert.equal(isPaidTierAutoId(null as unknown as string), false);
});
