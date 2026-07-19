import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPackageToolInvocation } from "../../../scripts/build/package-tool.ts";

test("package tool invocation enables the shell for Windows command shims", () => {
  const invocation = buildPackageToolInvocation("win32", "npx", ["esbuild", "src/a.ts"]);
  assert.equal(invocation.file, "npx.cmd");
  assert.equal(invocation.options.shell, true);
  assert.deepEqual(invocation.args, ["esbuild", "src/a.ts"]);
});

test("package tool invocation avoids a shell on POSIX", () => {
  const invocation = buildPackageToolInvocation("linux", "npm", ["install", "--no-audit"]);
  assert.equal(invocation.file, "npm");
  assert.equal(invocation.options.shell, undefined);
});

test("Windows shell invocation rejects metacharacters", () => {
  assert.throws(
    () => buildPackageToolInvocation("win32", "npm", ["install", "pkg && calc"]),
    /unsafe package-tool argument/
  );
});
