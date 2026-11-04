import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { severityCounts } from "../../scripts/check/audit-deps.mjs";

const zero = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
test("rejects malformed reports, negative counts, and unknown severities", () => {
  for (const value of [
    {},
    { metadata: { vulnerabilities: zero } },
    { metadata: { vulnerabilities: { ...zero, critical: -1 } }, advisories: {} },
    { metadata: { vulnerabilities: zero }, advisories: { x: { severity: "unknown" } } },
  ]) {
    assert.throws(() => severityCounts(value));
  }
});
test("advisory data cannot understate critical counts", () => {
  assert.equal(
    severityCounts({
      metadata: { vulnerabilities: zero },
      advisories: { x: { severity: "critical" } },
    }).critical,
    1
  );
});
test("audit subprocess fails closed on valid error JSON and nonzero clean exit", () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-gate-"));
  try {
    const executable = join(dir, "pnpm");
    for (const [body, exit] of [
      [JSON.stringify({ error: { code: "BROKEN" } }), 1],
      [JSON.stringify({ metadata: { vulnerabilities: zero }, advisories: {} }), 1],
      [
        JSON.stringify({
          metadata: { vulnerabilities: zero },
          advisories: { x: { severity: "critical" } },
        }),
        1,
      ],
    ]) {
      writeFileSync(executable, `#!/bin/sh\nprintf '%s' '${body}'\nexit ${exit}\n`);
      chmodSync(executable, 0o755);
      const result = spawnSync(process.execPath, [resolve("scripts/check/audit-deps.mjs")], {
        env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
        encoding: "utf8",
        timeout: 10000,
      });
      assert.equal(result.status, 1, result.stdout + result.stderr);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
