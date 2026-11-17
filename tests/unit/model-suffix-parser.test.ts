import test from "node:test";
import assert from "node:assert/strict";

import {
  SUFFIX_ROUTING_HINTS,
  applySuffixToRequest,
  getRoutingHints,
  parseModelSuffix,
  parseModelSuffixes,
  resolveModelAndHints,
  resolveModelSuffixRequest,
  resolveSuffixModel,
  stripModelSuffixes,
} from "../../open-sse/services/modelSuffixParser.ts";

test("a bare model has no suffixes", () => {
  const parsed = parseModelSuffixes("gpt-4o");
  assert.equal(parsed.baseModel, "gpt-4o");
  assert.deepEqual(parsed.suffixes, []);
  assert.equal(parsed.raw, "gpt-4o");
  assert.equal(parsed.hasSuffix, false);
});

test("single suffixes are parsed", () => {
  assert.deepEqual(parseModelSuffixes("gpt-4o:nitro").suffixes, ["nitro"]);
  assert.deepEqual(parseModelSuffixes("gpt-4o:floor").suffixes, ["floor"]);
  assert.deepEqual(parseModelSuffixes("gpt-4o:free").suffixes, ["free"]);
  assert.deepEqual(parseModelSuffixes("gpt-4o:thinking").suffixes, ["thinking"]);
  assert.deepEqual(parseModelSuffixes("gpt-4o:online").suffixes, ["online"]);
  assert.deepEqual(parseModelSuffixes("gpt-4o:extended").suffixes, ["extended"]);
});

test("multiple suffixes are parsed in order", () => {
  const parsed = parseModelSuffixes("anthropic/claude-sonnet-4-5:thinking:online");
  assert.equal(parsed.baseModel, "anthropic/claude-sonnet-4-5");
  assert.deepEqual(parsed.suffixes, ["thinking", "online"]);
});

test("unknown suffix tokens are ignored", () => {
  const parsed = parseModelSuffixes("model:unknownsuffix");
  assert.equal(parsed.baseModel, "model");
  assert.deepEqual(parsed.suffixes, []);
});

test("raw is preserved", () => {
  const raw = "gpt-4o:nitro";
  assert.equal(parseModelSuffixes(raw).raw, raw);
});

test("parsed properties reflect the suffixes", () => {
  assert.equal(parseModelSuffixes("model:thinking").isThinking, true);
  assert.equal(parseModelSuffixes("model:free").isFreeTier, true);
  assert.equal(parseModelSuffixes("model:nitro").isPerformanceTier, true);
  assert.equal(parseModelSuffixes("model:floor").isEconomyTier, true);
  assert.equal(parseModelSuffixes("model:online").needsWebSearch, true);
  assert.equal(parseModelSuffixes("model:extended").needsExtendedContext, true);
  assert.equal(parseModelSuffixes("model:nitro").isThinking, false);
});

test("parseModelSuffix returns the last known suffix", () => {
  assert.deepEqual(parseModelSuffix("gpt-4o:nitro"), { baseModel: "gpt-4o", suffix: "nitro" });
  assert.deepEqual(parseModelSuffix("openai/gpt-4o:free"), {
    baseModel: "openai/gpt-4o",
    suffix: "free",
  });
  assert.deepEqual(parseModelSuffix("gpt-4o"), { baseModel: "gpt-4o", suffix: null });
});

test("parseModelSuffix leaves unknown suffixes unchanged", () => {
  assert.deepEqual(parseModelSuffix("unknown:xyz"), { baseModel: "unknown:xyz", suffix: null });
});

test("stripModelSuffixes removes every known suffix", () => {
  assert.equal(stripModelSuffixes("gpt-4o:thinking:online"), "gpt-4o");
  assert.equal(stripModelSuffixes("gpt-4o"), "gpt-4o");
});

test("thinking adds reasoning only when absent", () => {
  const applied = applySuffixToRequest({}, parseModelSuffixes("model:thinking"));
  assert.deepEqual(applied.reasoning, { effort: "high" });

  const existing = applySuffixToRequest(
    { reasoning: { effort: "low", custom: true } },
    parseModelSuffixes("model:thinking")
  );
  assert.deepEqual(existing.reasoning, { effort: "low", custom: true });
});

test("online adds a web plugin and preserves existing plugins", () => {
  const applied = applySuffixToRequest(
    { plugins: [{ id: "code" }] },
    parseModelSuffixes("model:online")
  );
  assert.deepEqual(applied.plugins, [
    { id: "code" },
    { id: "web", max_results: 5 },
  ]);
});

test("online does not duplicate an existing web plugin", () => {
  const applied = applySuffixToRequest(
    { plugins: [{ id: "web", max_results: 3 }] },
    parseModelSuffixes("model:online")
  );
  assert.deepEqual(applied.plugins, [{ id: "web", max_results: 3 }]);
});

test("applySuffixToRequest does not mutate the input", () => {
  const original: Record<string, unknown> = { model: "base" };
  const copy = { ...original };
  applySuffixToRequest(original, parseModelSuffixes("model:thinking:online"));
  assert.deepEqual(original, copy);
});

test("applySuffixToRequest with no suffixes returns an equal copy", () => {
  const body: Record<string, unknown> = { model: "base", temperature: 0.7 };
  const applied = applySuffixToRequest(body, parseModelSuffixes("model"));
  assert.deepEqual(applied, body);
  assert.notEqual(applied, body);
});

test("tier suffixes set tg_tier", () => {
  assert.equal(applySuffixToRequest({}, parseModelSuffixes("m:nitro")).tg_tier, "performance");
  assert.equal(applySuffixToRequest({}, parseModelSuffixes("m:floor")).tg_tier, "economy");
  assert.equal(applySuffixToRequest({}, parseModelSuffixes("m:free")).tg_tier, "free");
});

test("resolveSuffixModel uses the model map for tier suffixes", () => {
  assert.equal(
    resolveSuffixModel(parseModelSuffixes("gpt-4o:nitro"), { "gpt-4o:nitro": "gpt-4o-turbo" }),
    "gpt-4o-turbo"
  );
  assert.equal(
    resolveSuffixModel(parseModelSuffixes("gpt-4o:floor"), { "gpt-4o:floor": "gpt-4o-mini" }),
    "gpt-4o-mini"
  );
  assert.equal(
    resolveSuffixModel(parseModelSuffixes("llama:free"), { "llama:free": "llama-free" }),
    "llama-free"
  );
});

test("resolveSuffixModel falls back to the base model", () => {
  assert.equal(resolveSuffixModel(parseModelSuffixes("gpt-4o:nitro")), "gpt-4o");
  assert.equal(resolveSuffixModel(parseModelSuffixes("gpt-4o:nitro"), {}), "gpt-4o");
});

test("resolveSuffixModel does not consult the map for non-tier suffixes", () => {
  assert.equal(
    resolveSuffixModel(parseModelSuffixes("model:thinking"), { "model:thinking": "x" }),
    "model"
  );
});

test("routing hints match the suffix", () => {
  assert.equal(getRoutingHints("nitro").providerSort, "throughput");
  assert.equal(getRoutingHints("floor").providerSort, "price");
  assert.equal(getRoutingHints("free").providerOnlyFree, true);
  assert.equal(getRoutingHints("thinking").reasoningEffort, "high");
  assert.deepEqual(getRoutingHints("online").plugins, [{ id: "web" }]);
  assert.equal(getRoutingHints("extended").contextLengthExtended, true);
  assert.deepEqual(getRoutingHints(null), {});
});

test("routing hints are fresh objects", () => {
  const first = getRoutingHints("online");
  first.plugins![0].id = "mutated";
  assert.equal(SUFFIX_ROUTING_HINTS.online.plugins![0].id, "web");
  assert.deepEqual(getRoutingHints("online").plugins, [{ id: "web" }]);
});

test("resolveModelAndHints combines parsing and hints", () => {
  assert.deepEqual(resolveModelAndHints("gpt-4o:nitro"), {
    baseModel: "gpt-4o",
    hints: { priority: "high", providerSort: "throughput" },
  });
  assert.deepEqual(resolveModelAndHints("gpt-4o"), { baseModel: "gpt-4o", hints: {} });
});

test("resolveModelSuffixRequest leaves unsuffixed bodies unchanged", () => {
  const body = { model: "gpt-4o", temperature: 0.2 };
  const resolved = resolveModelSuffixRequest("gpt-4o", body);
  assert.equal(resolved.model, "gpt-4o");
  assert.equal(resolved.body, body);
  assert.equal(resolved.parsed.hasSuffix, false);
});

test("resolveModelSuffixRequest strips suffixes and applies thinking", () => {
  const body = { model: "gpt-4o:thinking:online", temperature: 0.2 };
  const resolved = resolveModelSuffixRequest("gpt-4o:thinking:online", body);
  assert.equal(resolved.model, "gpt-4o");
  assert.equal(resolved.body.model, "gpt-4o");
  assert.deepEqual(resolved.body.reasoning, { effort: "high" });
  assert.equal(resolved.body.temperature, 0.2);
  assert.equal(resolved.body.plugins, undefined);
  assert.equal(resolved.body.tg_tier, undefined);
  assert.deepEqual(resolved.parsed.suffixes, ["thinking", "online"]);
  assert.equal(body.model, "gpt-4o:thinking:online");
});

test("resolveModelSuffixRequest preserves existing reasoning", () => {
  const body = { reasoning: { effort: "low" } };
  const resolved = resolveModelSuffixRequest("gpt-4o:thinking", body);
  assert.deepEqual(resolved.body.reasoning, { effort: "low" });
});

test("resolveModelSuffixRequest does not inject tier fields", () => {
  const resolved = resolveModelSuffixRequest("gpt-4o:nitro", { model: "gpt-4o:nitro" });
  assert.equal(resolved.model, "gpt-4o");
  assert.equal(resolved.body.tg_tier, undefined);
  assert.equal(resolved.parsed.isPerformanceTier, true);
});
