import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { resolveServerEntry } from "../../desktop-electrobun/src/serverEntry.ts";

test("Electrobun prefers the peer-stamp server wrapper when bundled", () => {
  const standaloneDir = "/tmp/omniroute-standalone";
  const entry = resolveServerEntry(
    standaloneDir,
    (path) => path === join(standaloneDir, "server-ws.mjs")
  );

  assert.equal(entry, "server-ws.mjs");
});

test("Electrobun supports standalone bundles without the peer-stamp wrapper", () => {
  const entry = resolveServerEntry("/tmp/omniroute-standalone", () => false);

  assert.equal(entry, "server.js");
});
