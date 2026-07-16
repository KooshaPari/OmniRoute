import assert from "node:assert/strict";
import test from "node:test";

import { resolveLocalFirstMode } from "./local-first-ci-mode.mjs";

const cases = [
  ["default-branch push verifies committed evidence", "push", "main", "main", "verify"],
  ["non-default push runs gates live", "push", "feature/x", "main", "live"],
  ["pull request runs gates live", "pull_request", "123/merge", "main", "live"],
  ["manual dispatch runs gates live", "workflow_dispatch", "main", "main", "live"],
];

for (const [name, eventName, refName, defaultBranch, expected] of cases) {
  test(name, () => {
    assert.equal(resolveLocalFirstMode({ eventName, refName, defaultBranch }), expected);
  });
}

test("unexpected events fail closed", () => {
  assert.throws(
    () => resolveLocalFirstMode({ eventName: "schedule", refName: "main", defaultBranch: "main" }),
    /unsupported Local-First CI event/u,
  );
});

test("push mode fails closed without repository branch metadata", () => {
  assert.throws(
    () => resolveLocalFirstMode({ eventName: "push", refName: "main", defaultBranch: "" }),
    /requires refName and defaultBranch/u,
  );
});
