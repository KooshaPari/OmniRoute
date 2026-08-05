import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const entrypoint = new URL("../src/bun/index.ts", import.meta.url);

async function readEntrypoint(): Promise<string> {
  return readFile(entrypoint, "utf8");
}

test("desktop servers use health endpoints for successful readiness", async () => {
  const source = await readEntrypoint();

  assert.equal(
    source.match(/const readinessUrl = `\$\{url\}\/healthz`;/g)?.length,
    2,
    "both bundled servers should prove their own health endpoint before navigation",
  );
  assert.equal(
    source.match(/fetch\(readinessUrl, \{ signal: AbortSignal\.timeout\(500\) \}\)/g)?.length,
    2,
  );
  assert.match(source, /if \(response\.ok\) return url;/);
});

test("desktop readiness timeouts release both spawned servers before fallback", async () => {
  const source = await readEntrypoint();

  assert.match(source, /rendererServer = stopSpawnedServer\(rendererServer\);/);
  assert.match(source, /nextServer = stopSpawnedServer\(nextServer\);/);
  assert.match(
    source,
    /function stopSpawnedServer\([\s\S]*?try \{[\s\S]*?server\.kill\(\);[\s\S]*?catch \(error\)[\s\S]*?return undefined;/,
  );
});
