import test from "node:test";
import assert from "node:assert/strict";

import {
  paretoFrontier,
  rankCandidates,
  rankCandidatesPareto,
  type RoutingCandidate,
} from "../../src/lib/routing/adaptiveRouting.ts";

function candidate(
  providerId: string,
  overrides: Partial<RoutingCandidate> = {}
): RoutingCandidate {
  return {
    providerId,
    modelId: "model",
    capabilityScore: 1,
    allocation: "allow",
    healthScore: 1,
    circuit: "closed",
    quota: "unknown",
    errorRate: 0,
    modelPreference: 1,
    costPreference: 1,
    latencyMs: 0,
    ...overrides,
  };
}

const A = candidate("a", { costPreference: 0.2, latencyMs: 10_000 });
const B = candidate("b", { capabilityScore: 0.8 });
const C = candidate("c", {
  capabilityScore: 0.7,
  costPreference: 0.6,
  latencyMs: 2_000,
});
const D = candidate("d", {
  capabilityScore: 0.9,
  costPreference: 0.5,
  latencyMs: 25_000,
});

test("paretoFrontier keeps tradeoffs and drops dominated candidates", () => {
  const frontier = paretoFrontier([A, B, C, D]);
  const ids = frontier.map((entry) => entry.providerId);
  assert.deepEqual(ids, ["a", "d", "b"]);
  assert.equal(ids.includes("c"), false);
});

test("paretoFrontier excludes ineligible candidates", () => {
  const frontier = paretoFrontier([
    A,
    candidate("exhausted", { quota: "exhausted" }),
    candidate("open", { circuit: "open" }),
    candidate("denied", { allocation: "deny" }),
  ]);
  assert.deepEqual(frontier.map((entry) => entry.providerId), ["a"]);
});

test("quality preference selects the highest-quality frontier point", () => {
  const result = rankCandidatesPareto([A, B, C, D], "quality");
  assert.equal(result.selected?.providerId, "a");
  assert.deepEqual(result.frontier.map((entry) => entry.providerId), ["a", "d", "b"]);
});

test("cost preference selects the cheapest frontier point", () => {
  assert.equal(rankCandidatesPareto([A, B, C, D], "cost").selected?.providerId, "b");
});

test("latency preference selects the fastest frontier point", () => {
  assert.equal(rankCandidatesPareto([A, B, C, D], "latency").selected?.providerId, "b");
});

test("balanced preference uses quality, cost, and latency", () => {
  const result = rankCandidatesPareto([A, B, C, D], "balanced");
  assert.equal(result.selected?.providerId, "a");
});

test("all returned candidates are ranked by weighted score", () => {
  const result = rankCandidatesPareto([A, B, C, D], "quality");
  const scores = result.candidates.map((entry) => entry.score);
  assert.deepEqual(scores, [...scores].sort((left, right) => right - left));
});

test("empty input returns no selection and no frontier", () => {
  const result = rankCandidatesPareto([], "balanced");
  assert.equal(result.selected, null);
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(result.frontier, []);
});

test("weighted ranking is unchanged", () => {
  assert.equal(rankCandidates([A, B, C, D]).selected?.providerId, "b");
});
