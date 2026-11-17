import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  compileExpression,
  evalExpression,
  evaluateCelRoutes,
  type CelRoute,
} from "../../src/domain/celRouter.ts";

interface ExpectedRoute {
  matched: boolean;
  target: string;
  routeName: string;
  error: boolean;
}

interface RouteCase {
  name: string;
  routes: CelRoute[];
  context: Record<string, unknown>;
  expected: ExpectedRoute;
}

interface ExpressionCase {
  name: string;
  expression: string;
  context: Record<string, unknown>;
  expected: boolean;
}

interface Fixture {
  source: string;
  generatedAt: string;
  routeCases: RouteCase[];
  expressionCases: ExpressionCase[];
}

const fixture = JSON.parse(
  readFileSync(new URL("../fixtures/cel-parity.json", import.meta.url), "utf8")
) as Fixture;

test("parity fixture comes from the Python oracle and covers the 18 base cases", () => {
  assert.match(fixture.source, /routing_impl\/cel_router\.py$/);
  assert.ok(fixture.routeCases.length >= 18);
  assert.ok(fixture.expressionCases.length >= 9);
});

test("route results match the Python oracle", () => {
  for (const entry of fixture.routeCases) {
    const result = evaluateCelRoutes(entry.routes, entry.context);
    const label = `${entry.name}: ${entry.routes.map((route) => route.expression).join(" | ")}`;
    assert.equal(result.matched, entry.expected.matched, `${label}: matched`);
    assert.equal(result.target, entry.expected.target, `${label}: target`);
    assert.equal(result.routeName, entry.expected.routeName, `${label}: routeName`);
    assert.equal(result.error !== "", entry.expected.error, `${label}: error`);
  }
});

test("compiled expression results match the Python oracle", () => {
  for (const entry of fixture.expressionCases) {
    const compiled = compileExpression(entry.expression);
    assert.equal(
      evalExpression(compiled, entry.context),
      entry.expected,
      `${entry.name}: ${entry.expression}`
    );
  }
});
