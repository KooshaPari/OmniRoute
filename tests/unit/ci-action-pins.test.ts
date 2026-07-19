import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");

for (const relativePath of [
  ".github/workflows/ci.yml",
  ".github/workflows/security-scan.yml",
  ".github/workflows/reusable/quality-gate.yml",
]) {
  test(`${relativePath} pins every external action to a full commit SHA`, () => {
    const source = readFileSync(resolve(ROOT, relativePath), "utf8");
    for (const match of source.matchAll(/^\s*uses:\s*([^\s#]+).*/gm)) {
      const action = match[1];
      if (action.startsWith("./")) continue;
      assert.match(action, /@[0-9a-f]{40}$/, `${action} must use an immutable commit SHA`);
    }
  });
}

test("dependency review scopes the Sonar LGPL exception to the pinned action", () => {
  const source = readFileSync(resolve(ROOT, ".github/workflows/dependency-review.yml"), "utf8");
  assert.match(
    source,
    /allow-dependencies-licenses:\s*pkg:githubactions\/SonarSource\/sonarqube-scan-action@22918119ff8e1ca75a623e15c8296b6ea4fbe28f/
  );
  assert.doesNotMatch(source, /allow-licenses:.*LGPL/);
});

test("pillar scorecard stays read-only and does not commit generated reports", () => {
  const source = readFileSync(resolve(ROOT, ".github/workflows/pillar-checks.yml"), "utf8");
  assert.doesNotMatch(source, /contents:\s*write/);
  assert.doesNotMatch(source, /push-scorecard\.sh|git push/);
  assert.match(source, /persist-credentials:\s*false/);
});
