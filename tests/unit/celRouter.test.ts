import test from "node:test";
import assert from "node:assert/strict";

import {
  CelEvaluator,
  compileExpression,
  evalExpression,
  evaluateCelRoutes,
  type CelRoute,
} from "../../src/domain/celRouter.ts";

function ctx(values: Record<string, unknown> = {}): Record<string, unknown> {
  return { context: values };
}

function route(expression: string, target = "target-model", name = "test"): CelRoute {
  return { expression, target, name };
}

function run(expression: string, context: Record<string, unknown>) {
  return evaluateCelRoutes([route(expression)], context);
}

test("simple equality", () => {
  const result = run('context.model == "gpt-4o"', ctx({ model: "gpt-4o" }));
  assert.equal(result.matched, true);
  assert.equal(result.target, "target-model");
  assert.equal(result.error, "");
});

test("simple inequality", () => {
  assert.equal(run('context.model != "gpt-4o"', ctx({ model: "claude-3-5-sonnet" })).matched, true);
  assert.equal(run('context.model != "gpt-4o"', ctx({ model: "gpt-4o" })).matched, false);
});

test("numeric greater-than", () => {
  assert.equal(run("context.priority > 5", ctx({ priority: 10 })).matched, true);
  assert.equal(run("context.priority > 5", ctx({ priority: 3 })).matched, false);
});

test("numeric less-than-or-equal", () => {
  assert.equal(run("context.priority <= 5", ctx({ priority: 5 })).matched, true);
  assert.equal(run("context.priority <= 5", ctx({ priority: 6 })).matched, false);
});

test("and operator", () => {
  const expr = 'context.model == "gpt-4o" && context.priority > 5';
  assert.equal(run(expr, ctx({ model: "gpt-4o", priority: 10 })).matched, true);
  assert.equal(run(expr, ctx({ model: "gpt-4o", priority: 3 })).matched, false);
  assert.equal(run(expr, ctx({ model: "claude", priority: 10 })).matched, false);
});

test("or operator", () => {
  const expr = 'context.model == "gpt-4o" || context.model == "claude-3-opus"';
  assert.equal(run(expr, ctx({ model: "gpt-4o" })).matched, true);
  assert.equal(run(expr, ctx({ model: "claude-3-opus" })).matched, true);
  assert.equal(run(expr, ctx({ model: "gemini" })).matched, false);
});

test("not operator", () => {
  const expr = '!(context.model == "gpt-4o")';
  assert.equal(run(expr, ctx({ model: "claude" })).matched, true);
  assert.equal(run(expr, ctx({ model: "gpt-4o" })).matched, false);
});

test("nested attribute access", () => {
  assert.equal(
    run('context.metadata.tier == "premium"', ctx({ metadata: { tier: "premium" } })).matched,
    true
  );
  assert.equal(
    run('context.metadata.tier == "premium"', ctx({ metadata: { tier: "free" } })).matched,
    false
  );
});

test("missing attribute returns no match without error", () => {
  const result = run("context.priority > 5", ctx({ model: "gpt-4o" }));
  assert.equal(result.matched, false);
  assert.equal(result.error, "");
});

test("string contains", () => {
  assert.equal(run('context.model.contains("gpt")', ctx({ model: "gpt-4o" })).matched, true);
  assert.equal(run('context.model.contains("gpt")', ctx({ model: "claude-3" })).matched, false);
});

test("string startsWith", () => {
  assert.equal(
    run('context.model.startsWith("claude")', ctx({ model: "claude-3-sonnet" })).matched,
    true
  );
  assert.equal(run('context.model.startsWith("claude")', ctx({ model: "gpt-4o" })).matched, false);
});

test("string endsWith", () => {
  assert.equal(
    run('context.model.endsWith("turbo")', ctx({ model: "gpt-3.5-turbo" })).matched,
    true
  );
  assert.equal(run('context.model.endsWith("turbo")', ctx({ model: "gpt-4o" })).matched, false);
});

test("in operator on a list", () => {
  const expr = 'context.model in ["gpt-4o", "gpt-4-turbo"]';
  assert.equal(run(expr, ctx({ model: "gpt-4o" })).matched, true);
  assert.equal(run(expr, ctx({ model: "claude-3" })).matched, false);
});

test("structural list equality", () => {
  assert.equal(run('context.tags == ["a", "b"]', ctx({ tags: ["a", "b"] })).matched, true);
  assert.equal(run('context.tags == ["a", "b"]', ctx({ tags: ["a"] })).matched, false);
});

test("boolean and numeric equality", () => {
  assert.equal(run("context.enabled == 1", ctx({ enabled: true })).matched, true);
  assert.equal(run("context.enabled == 0", ctx({ enabled: false })).matched, true);
  assert.equal(run("context.enabled < 2", ctx({ enabled: true })).matched, true);
  assert.equal(run("context.enabled > 2", ctx({ enabled: true })).matched, false);
});

test("structural object equality", () => {
  const equal = ctx({
    metadata: { tier: "premium", count: 1 },
    expected: { tier: "premium", count: 1 },
  });
  assert.equal(run("context.metadata == context.expected", equal).matched, true);

  const different = ctx({
    metadata: { tier: "premium" },
    expected: { tier: "free" },
  });
  assert.equal(run("context.metadata == context.expected", different).matched, false);
});

test("cyclic structures stop at the depth guard", () => {
  const first: Record<string, unknown> = {};
  first.self = first;
  const second: Record<string, unknown> = {};
  second.self = second;

  assert.doesNotThrow(() => run("context.first == context.second", ctx({ first, second })));
  assert.equal(run("context.first == context.second", ctx({ first, second })).matched, false);
});

test("ternary expression", () => {
  const expr = "context.priority > 5 ? true : false";
  assert.equal(run(expr, ctx({ priority: 10 })).matched, true);
  assert.equal(run(expr, ctx({ priority: 2 })).matched, false);
});

test("ternary can return a string target", () => {
  const result = run(
    'context.tier == "premium" ? "premium-model" : "free-model"',
    ctx({ tier: "premium" })
  );
  assert.equal(result.matched, true);
  assert.equal(result.target, "premium-model");
});

test("multiple routes use the first match", () => {
  const routes = [
    route('context.model == "gpt-4o"', "route-a", "A"),
    route('context.model == "gpt-4o"', "route-b", "B"),
    route('context.model == "claude"', "route-c", "C"),
  ];
  const first = evaluateCelRoutes(routes, ctx({ model: "gpt-4o" }));
  assert.equal(first.matched, true);
  assert.equal(first.target, "route-a");
  assert.equal(first.routeName, "A");

  const second = evaluateCelRoutes(routes, ctx({ model: "claude" }));
  assert.equal(second.matched, true);
  assert.equal(second.target, "route-c");
});

test("invalid expression returns an error without throwing", () => {
  const result = evaluateCelRoutes([route("@@invalid@@", "target", "bad")], ctx({}));
  assert.equal(result.matched, false);
  assert.notEqual(result.error, "");
});

test("compileExpression and evalExpression", () => {
  const compiled = compileExpression('context.model == "gpt-4o"');
  assert.equal(evalExpression(compiled, ctx({ model: "gpt-4o" })), true);
  assert.equal(evalExpression(compiled, ctx({ model: "claude" })), false);
});

test("CelEvaluator direct usage", () => {
  const evaluator = new CelEvaluator([
    route('context.tier == "premium"', "premium-model", "premium"),
    route('context.tier == "free"', "free-model", "free"),
  ]);
  const premium = evaluator.evaluate(ctx({ tier: "premium" }));
  assert.equal(premium.matched, true);
  assert.equal(premium.target, "premium-model");
  assert.equal(premium.routeName, "premium");

  const free = evaluator.evaluate(ctx({ tier: "free" }));
  assert.equal(free.matched, true);
  assert.equal(free.target, "free-model");

  assert.equal(evaluator.evaluate(ctx({ tier: "enterprise" })).matched, false);
});

test("null comparisons", () => {
  assert.equal(run("context.missing == null", ctx({})).matched, true);
  assert.equal(run('context.model == null', ctx({ model: "gpt-4o" })).matched, false);
  assert.equal(run("context.missing > 5", ctx({})).matched, false);
});

test("string escapes", () => {
  assert.equal(run('context.model == "gpt\\n4o"', ctx({ model: "gpt\n4o" })).matched, true);
  assert.equal(run('context.model == "a\\"b"', ctx({ model: 'a"b' })).matched, true);
});

test("empty list and non-list in", () => {
  assert.equal(run('context.model in []', ctx({ model: "gpt-4o" })).matched, false);
  assert.equal(run('context.model in "gpt-4o"', ctx({ model: "gpt-4o" })).matched, true);
});

test("forbidden attribute segments are rejected", () => {
  assert.throws(() => compileExpression("context.__proto__.x == 1"));
  assert.throws(() => compileExpression("context.constructor == 1"));
});

test("over-long expressions are rejected", () => {
  assert.throws(() => compileExpression("a".repeat(2049)));
});

test("deep nesting is rejected", () => {
  assert.throws(() => compileExpression("!".repeat(40) + "true"));
});

test("dropped comparison with a non-boolean value is truthy", () => {
  assert.equal(run("context.model", ctx({ model: "gpt-4o" })).matched, true);
  assert.equal(run("context.empty", ctx({ empty: "" })).matched, false);
});
