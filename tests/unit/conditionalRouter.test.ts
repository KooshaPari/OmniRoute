import test from "node:test";
import assert from "node:assert/strict";

import {
  ConditionalEvaluator,
  buildRoutingContext,
  evaluateCondition,
  evaluateConditionalRoutes,
  matchConditionalRoute,
  type ConditionalRoute,
} from "../../src/domain/conditionalRouter.ts";

function route(
  condition: Record<string, unknown>,
  target = "target-model",
  name = "test"
): ConditionalRoute {
  return { condition, target, name };
}

test("plain equality matches a scalar field", () => {
  assert.equal(evaluateCondition({ "metadata.tier": "premium" }, { "metadata.tier": "premium" }), true);
  assert.equal(evaluateCondition({ "metadata.tier": "premium" }, { "metadata.tier": "free" }), false);
});

test("plain equality combines every field", () => {
  const context = { "metadata.tier": "premium", "params.stream": true };
  assert.equal(
    evaluateCondition({ "metadata.tier": "premium", "params.stream": true }, context),
    true
  );
  assert.equal(
    evaluateCondition({ "metadata.tier": "premium", "params.stream": false }, context),
    false
  );
});

test("$eq and $ne", () => {
  assert.equal(evaluateCondition({ "params.stream": { $eq: true } }, { "params.stream": true }), true);
  assert.equal(evaluateCondition({ "params.stream": { $eq: false } }, { "params.stream": true }), false);
  assert.equal(evaluateCondition({ "params.stream": { $ne: false } }, { "params.stream": true }), true);
  assert.equal(evaluateCondition({ "params.stream": { $ne: true } }, { "params.stream": true }), false);
});

test("$in and $nin on arrays", () => {
  assert.equal(evaluateCondition({ "params.model": { $in: ["a", "b"] } }, { "params.model": "b" }), true);
  assert.equal(evaluateCondition({ "params.model": { $in: ["a", "b"] } }, { "params.model": "c" }), false);
  assert.equal(evaluateCondition({ "params.model": { $nin: ["a", "b"] } }, { "params.model": "c" }), true);
  assert.equal(evaluateCondition({ "params.model": { $nin: ["a", "b"] } }, { "params.model": "a" }), false);
});

test("$in and $nin on strings", () => {
  assert.equal(evaluateCondition({ "params.model": { $in: "gpt-4o-mini" } }, { "params.model": "4o" }), true);
  assert.equal(evaluateCondition({ "params.model": { $nin: "gpt-4o-mini" } }, { "params.model": "claude" }), true);
});

test("$regex is case-insensitive and null-safe", () => {
  assert.equal(evaluateCondition({ "params.model": { $regex: "^gpt" } }, { "params.model": "GPT-4o" }), true);
  assert.equal(evaluateCondition({ "params.model": { $regex: "^gpt" } }, { "params.model": "claude" }), false);
  assert.equal(evaluateCondition({ "params.model": { $regex: "^gpt" } }, { "params.model": null }), false);
});

test("$exists checks own-property presence", () => {
  assert.equal(evaluateCondition({ "metadata.tier": { $exists: true } }, { "metadata.tier": "premium" }), true);
  assert.equal(evaluateCondition({ "metadata.tier": { $exists: true } }, {}), false);
  assert.equal(evaluateCondition({ "metadata.tier": { $exists: false } }, {}), true);
});

test("$and combines nested conditions", () => {
  const condition = {
    $and: [
      { "metadata.tier": "premium" },
      { "params.stream": { $eq: true } },
    ],
  };
  assert.equal(
    evaluateCondition(condition, { "metadata.tier": "premium", "params.stream": true }),
    true
  );
  assert.equal(
    evaluateCondition(condition, { "metadata.tier": "premium", "params.stream": false }),
    false
  );
});

test("$or matches any nested condition", () => {
  const condition = {
    $or: [{ "metadata.tier": "premium" }, { "params.priority": { $in: [10, 20] } }],
  };
  assert.equal(evaluateCondition(condition, { "params.priority": 10 }), true);
  assert.equal(evaluateCondition(condition, { "metadata.tier": "premium" }), true);
  assert.equal(evaluateCondition(condition, {}), false);
});

test("$and and $or can nest", () => {
  const condition = {
    $and: [
      { $or: [{ "metadata.tier": "premium" }, { "metadata.tier": "enterprise" }] },
      { "params.stream": true },
    ],
  };
  assert.equal(
    evaluateCondition(condition, { "metadata.tier": "enterprise", "params.stream": true }),
    true
  );
  assert.equal(
    evaluateCondition(condition, { "metadata.tier": "free", "params.stream": true }),
    false
  );
});

test("unknown operators throw", () => {
  assert.throws(() => evaluateCondition({ "params.priority": { $gt: 5 } }, { "params.priority": 10 }));
});

test("$and and $or require arrays", () => {
  assert.throws(() => evaluateCondition({ $and: {} }, {}));
  assert.throws(() => evaluateCondition({ $or: "nope" }, {}));
});

test("$in and $nin require arrays or strings", () => {
  assert.throws(() => evaluateCondition({ "params.model": { $in: 5 } }, { "params.model": "a" }));
});

test("excessive condition nesting is rejected", () => {
  let condition: Record<string, unknown> = { "metadata.tier": "premium" };
  for (let i = 0; i < 20; i += 1) condition = { $and: [condition] };
  assert.throws(() => evaluateCondition(condition, { "metadata.tier": "premium" }));
});

test("buildRoutingContext prefixes params and metadata", () => {
  const context = buildRoutingContext({ model: "gpt-4o", stream: true }, { tier: "premium" });
  assert.deepEqual(context, {
    "params.model": "gpt-4o",
    "params.stream": true,
    "metadata.tier": "premium",
  });
});

test("matchConditionalRoute returns the first match", () => {
  const routes = [
    route({ "metadata.tier": "free" }, "free-model", "free"),
    route({ "metadata.tier": "premium" }, "premium-model", "premium"),
  ];
  assert.equal(matchConditionalRoute(routes, { "metadata.tier": "premium" })?.target, "premium-model");
  assert.equal(matchConditionalRoute(routes, { "metadata.tier": "enterprise" }), null);
});

test("ConditionalEvaluator returns the first matching route", () => {
  const evaluator = new ConditionalEvaluator([
    route({ "metadata.tier": "premium" }, "premium-model", "premium"),
    route({ "metadata.tier": "premium" }, "second-model", "second"),
  ]);
  const result = evaluator.evaluate({ "metadata.tier": "premium" });
  assert.deepEqual(result, {
    matched: true,
    target: "premium-model",
    routeName: "premium",
    error: "",
  });
});

test("invalid conditions return an error result without throwing", () => {
  const result = evaluateConditionalRoutes(
    [route({ "params.priority": { $gt: 5 } }, "target", "bad")],
    { "params.priority": 10 }
  );
  assert.equal(result.matched, false);
  assert.notEqual(result.error, "");
});

test("a no-match result has empty target and routeName", () => {
  const result = evaluateConditionalRoutes([route({ "metadata.tier": "premium" })], {});
  assert.deepEqual(result, { matched: false, target: "", routeName: "", error: "" });
});
