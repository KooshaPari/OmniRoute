import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const FFI_WORKSPACE = "packages/omniroute-ffi";

test("root workspace exposes the local FFI package to clean release installs", async () => {
  const manifestUrl = new URL("../../../package.json", import.meta.url);
  const lockUrl = new URL("../../../package-lock.json", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const lock = JSON.parse(await readFile(lockUrl, "utf8"));
  const workspaces = Array.isArray(manifest.workspaces) ? manifest.workspaces : manifest.workspaces?.packages;

  assert.deepEqual(workspaces?.filter((workspace) => workspace.startsWith("packages/omniroute-ffi")), [FFI_WORKSPACE]);

  const packageUrl = new URL(`../../../${FFI_WORKSPACE}/package.json`, import.meta.url);
  const packageManifest = JSON.parse(await readFile(packageUrl, "utf8"));

  for (const [packageName, source] of Object.entries(packageManifest.optionalDependencies)) {
    assert.equal(
      source,
      `file:../omniroute-${packageName.slice("@omniroute/".length)}`,
      `${packageName} must resolve from its local platform package`,
    );

    assert.equal(
      lock.packages[`node_modules/${packageName}`]?.link,
      true,
      `${packageName} must be locked as an optional dependency of the portable FFI workspace`,
    );
  }
});
