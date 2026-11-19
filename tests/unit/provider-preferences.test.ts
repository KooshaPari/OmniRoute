import test from "node:test";
import assert from "node:assert/strict";

import {
  extractProviderOptions,
  extractProviderPreferences,
  filterCandidatesByPreferences,
  filterComboModelsByPreferences,
  filterModelsByPreferences,
  providerOf,
  toOpenRouterProviderBody,
  type ProviderPreferences,
} from "../../open-sse/services/providerPreferences.ts";

function prefs(overrides: Partial<ProviderPreferences> = {}): ProviderPreferences {
  return {
    order: [],
    only: [],
    ignore: [],
    allowFallbacks: true,
    dataCollection: "allow",
    quantizations: [],
    maxPrice: {},
    ...overrides,
  };
}

test("extractProviderPreferences reads the full provider object", () => {
  const parsed = extractProviderPreferences({
    provider: {
      order: ["anthropic", "openai"],
      only: ["openai"],
      ignore: ["azure"],
      allow_fallbacks: false,
      data_collection: "deny",
      quantizations: ["fp16", "bf16"],
      sort: "throughput",
      max_price: { prompt: 1.5, completion: "2.5" },
    },
  });

  assert.deepEqual(parsed, {
    order: ["anthropic", "openai"],
    only: ["openai"],
    ignore: ["azure"],
    allowFallbacks: false,
    dataCollection: "deny",
    quantizations: ["fp16", "bf16"],
    sort: "throughput",
    maxPrice: { prompt: 1.5, completion: 2.5 },
  });
});

test("extractProviderPreferences supplies defaults", () => {
  assert.deepEqual(extractProviderPreferences({ provider: {} }), {
    order: [],
    only: [],
    ignore: [],
    allowFallbacks: true,
    dataCollection: "allow",
    quantizations: [],
    sort: null,
    maxPrice: {},
  });
});

test("extractProviderPreferences ignores invalid fields", () => {
  const parsed = extractProviderPreferences({
    provider: {
      order: "openai",
      only: [1, "openai"],
      sort: "bogus",
      max_price: { prompt: "not-a-number" },
    },
  });
  assert.deepEqual(parsed?.order, []);
  assert.deepEqual(parsed?.only, ["openai"]);
  assert.equal(parsed?.sort, null);
  assert.deepEqual(parsed?.maxPrice, {});
});

test("extractProviderPreferences returns null without a provider object", () => {
  assert.equal(extractProviderPreferences({}), null);
  assert.equal(extractProviderPreferences({ provider: "openai" }), null);
  assert.equal(extractProviderPreferences({ provider: null }), null);
});

test("extractProviderOptions keeps object-valued provider bags", () => {
  const parsed = extractProviderOptions({
    providerOptions: {
      openai: { organization: "org-xyz" },
      anthropic: { beta: true },
      invalid: "nope",
    },
  });
  assert.deepEqual(parsed, {
    options: {
      openai: { organization: "org-xyz" },
      anthropic: { beta: true },
    },
  });
  assert.equal(extractProviderOptions({}), null);
  assert.equal(extractProviderOptions({ providerOptions: [] }), null);
});

test("providerOf returns the prefix or the bare name", () => {
  assert.equal(providerOf("openai/gpt-4o"), "openai");
  assert.equal(providerOf("openrouter/anthropic/claude"), "openrouter");
  assert.equal(providerOf("gpt-4o"), "gpt-4o");
});

test("filterModelsByPreferences applies only and ignore", () => {
  const models = ["openai/gpt-4o", "anthropic/claude", "azure/gpt-4o"];
  assert.deepEqual(filterModelsByPreferences(models, prefs({ only: ["openai", "azure"] })), [
    "openai/gpt-4o",
    "azure/gpt-4o",
  ]);
  assert.deepEqual(filterModelsByPreferences(models, prefs({ ignore: ["azure"] })), [
    "openai/gpt-4o",
    "anthropic/claude",
  ]);
});

test("filterModelsByPreferences applies quantization substrings", () => {
  const models = ["local/model-fp16", "local/model-q4", "local/model-bf16"];
  assert.deepEqual(filterModelsByPreferences(models, prefs({ quantizations: ["fp16", "bf16"] })), [
    "local/model-fp16",
    "local/model-bf16",
  ]);
});

test("filterModelsByPreferences orders by provider and preserves fallbacks", () => {
  const models = ["b/m1", "a/m1", "c/m1", "a/m2"];
  assert.deepEqual(filterModelsByPreferences(models, prefs({ order: ["a", "c"] })), [
    "a/m1",
    "a/m2",
    "c/m1",
    "b/m1",
  ]);
});

test("allow_fallbacks false drops providers outside order", () => {
  const models = ["b/m1", "a/m1", "c/m1"];
  assert.deepEqual(
    filterModelsByPreferences(models, prefs({ order: ["a", "c"], allowFallbacks: false })),
    ["a/m1", "c/m1"]
  );
});

test("an empty order leaves the original sequence unchanged", () => {
  const models = ["b/m1", "a/m1", "c/m1"];
  assert.deepEqual(filterModelsByPreferences(models, prefs()), models);
});

test("filterCandidatesByPreferences works on provider/model objects", () => {
  const candidates = [
    { provider: "b", model: "m1" },
    { provider: "a", model: "m1" },
    { provider: "a", model: "m2" },
    { provider: "c", model: "m1-fp16" },
  ];
  assert.deepEqual(
    filterCandidatesByPreferences(candidates, prefs({ only: ["a", "c"], order: ["c", "a"] })),
    [
      { provider: "c", model: "m1-fp16" },
      { provider: "a", model: "m1" },
      { provider: "a", model: "m2" },
    ]
  );
  assert.deepEqual(
    filterCandidatesByPreferences(candidates, prefs({ quantizations: ["fp16"] })),
    [{ provider: "c", model: "m1-fp16" }]
  );
});

test("filterComboModelsByPreferences handles string targets", () => {
  const models = ["b/m1", "a/m1", "c/m1"];
  assert.deepEqual(
    filterComboModelsByPreferences(models, prefs({ only: ["a", "c"], order: ["c", "a"] })),
    ["c/m1", "a/m1"]
  );
});

test("filterComboModelsByPreferences preserves object target shape", () => {
  const models = [
    { model: "m1", providerId: "p1", weight: 1 },
    { model: "m2", provider: "p2", weight: 2 },
    { model: "p3/m3", weight: 3 },
  ];
  assert.deepEqual(
    filterComboModelsByPreferences(models, prefs({ only: ["p1", "p2"], order: ["p2", "p1"] })),
    [
      { model: "m2", provider: "p2", weight: 2 },
      { model: "m1", providerId: "p1", weight: 1 },
    ]
  );
});

test("filterComboModelsByPreferences applies quantization to object models", () => {
  const models = [
    { model: "m1-fp16", providerId: "p1" },
    { model: "m2-q4", providerId: "p1" },
  ];
  assert.deepEqual(
    filterComboModelsByPreferences(models, prefs({ quantizations: ["fp16"] })),
    [{ model: "m1-fp16", providerId: "p1" }]
  );
});

test("filterComboModelsByPreferences drops fallbacks when disabled", () => {
  const models = ["b/m1", "a/m1", "c/m1"];
  assert.deepEqual(
    filterComboModelsByPreferences(models, prefs({ order: ["a"], allowFallbacks: false })),
    ["a/m1"]
  );
});

test("toOpenRouterProviderBody serializes every field", () => {
  const body = toOpenRouterProviderBody(
    prefs({
      order: ["openai"],
      only: ["openai"],
      ignore: ["azure"],
      allowFallbacks: false,
      dataCollection: "deny",
      quantizations: ["fp16"],
      sort: "price",
      maxPrice: { prompt: 1, completion: 2 },
    })
  );
  assert.deepEqual(body, {
    order: ["openai"],
    only: ["openai"],
    ignore: ["azure"],
    allow_fallbacks: false,
    data_collection: "deny",
    quantizations: ["fp16"],
    sort: "price",
    max_price: { prompt: 1, completion: 2 },
  });
});

test("toOpenRouterProviderBody omits empty sort and max_price", () => {
  assert.deepEqual(toOpenRouterProviderBody(prefs()), {
    order: [],
    only: [],
    ignore: [],
    allow_fallbacks: true,
    data_collection: "allow",
    quantizations: [],
  });
});
