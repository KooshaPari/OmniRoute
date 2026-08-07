import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));

async function readEntrypoint(): Promise<string> {
  return readFile(resolve(here, "../src/bun/index.ts"), "utf8");
}

test("renderer receives the bundled backend origin for server-side BFF routes", async () => {
  const source = await readEntrypoint();

  assert.match(
    source,
    /const BFF_ORIGIN =\s*process\.env\.OMNIROUTE_BFF_URL \?\?\s*process\.env\.PUBLIC_OMNIROUTE_BFF_URL \?\?/
  );
  assert.match(source, /BFF_ORIGIN,\s*PUBLIC_OMNIROUTE_BFF_URL: BFF_ORIGIN,/);
  assert.match(
    source,
    /const bundledUrl = await bootNextServer\(\);[\s\S]*const rendererUrl = await bootRendererServer\(\);/
  );
});

test("both packaged services use their explicit health route for readiness", async () => {
  const source = await readEntrypoint();

  assert.equal((source.match(/fetch\(`\$\{url\}\/healthz`/g) ?? []).length, 2);
  assert.match(source, /async function bootNextServer\(\)[\s\S]*fetch\(`\$\{url\}\/healthz`/);
  assert.match(source, /async function bootRendererServer\(\)[\s\S]*fetch\(`\$\{url\}\/healthz`/);
});
