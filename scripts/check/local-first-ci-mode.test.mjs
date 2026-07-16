import assert from "node:assert/strict";
import test from "node:test";

import { resolveLocalFirstMode } from "./local-first-ci-mode.mjs";

const cases = [
  ["default-branch push records exact-tree evidence", "push", "main", "main", undefined, "record"],
  ["non-default push runs gates live", "push", "feature/x", "main", undefined, "live"],
  ["pull request runs gates live", "pull_request", "123/merge", "main", undefined, "live"],
  ["manual live dispatch runs gates live", "workflow_dispatch", "main", "main", "live", "live"],
  ["manual audit dispatch verifies committed evidence", "workflow_dispatch", "main", "main", "verify", "verify"],
  ["manual record dispatch emits exact-tree evidence", "workflow_dispatch", "main", "main", "record", "record"],
];

for (const [name, eventName, refName, defaultBranch, dispatchMode, expected] of cases) {
  test(name, () => {
    assert.equal(resolveLocalFirstMode({ eventName, refName, defaultBranch, dispatchMode }), expected);
  });
}

test("unsupported events, invalid metadata, and invalid dispatch modes fail closed", () => {
  assert.throws(
    () => resolveLocalFirstMode({ eventName: "schedule", refName: "main", defaultBranch: "main" }),
    /unsupported Local-First CI event/u,
  );
  assert.throws(
    () => resolveLocalFirstMode({ eventName: "push", refName: "main", defaultBranch: "" }),
    /requires refName and defaultBranch/u,
  );
  assert.throws(
    () =>
      resolveLocalFirstMode({
        eventName: "workflow_dispatch",
        refName: "main",
        defaultBranch: "main",
        dispatchMode: "unsupported",
      }),
    /unsupported workflow_dispatch mode/u,
  );
});
