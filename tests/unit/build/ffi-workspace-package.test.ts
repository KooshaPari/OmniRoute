import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const FFI_WORKSPACES = [
  "packages/omniroute-ffi",
  "packages/omniroute-ffi-darwin-arm64",
  "packages/omniroute-ffi-darwin-x64",
  "packages/omniroute-ffi-linux-arm64-gnu",
  "packages/omniroute-ffi-linux-x64-gnu",
  "packages/omniroute-ffi-win32-x64",
];

test("root workspace exposes the local FFI package to clean release installs", async () => {
  const manifestUrl = new URL("../../../package.json", import.meta.url);
  const lockUrl = new URL("../../../package-lock.json", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const lock = JSON.parse(await readFile(lockUrl, "utf8"));
  const workspaces = Array.isArray(manifest.workspaces) ? manifest.workspaces : manifest.workspaces?.packages;

  assert.deepEqual(workspaces?.filter((workspace) => workspace.startsWith("packages/omniroute-ffi")), FFI_WORKSPACES);

  for (const workspace of FFI_WORKSPACES) {
    const packageUrl = new URL(`../../../${workspace}/package.json`, import.meta.url);
    const packageManifest = JSON.parse(await readFile(packageUrl, "utf8"));

    assert.equal(
      lock.packages[`node_modules/${packageManifest.name}`]?.link,
      true,
      `${packageManifest.name} must be a workspace link in package-lock.json`,
    );
  }
});
