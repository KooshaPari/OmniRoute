import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("root workspace exposes the local FFI package to clean release installs", async () => {
  const manifestUrl = new URL("../../../package.json", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const workspaces = Array.isArray(manifest.workspaces) ? manifest.workspaces : manifest.workspaces?.packages;

  assert.ok(
    workspaces?.includes("packages/omniroute-ffi"),
    "@omniroute/ffi is imported by the release build and must be in the root workspace graph"
  );
});
