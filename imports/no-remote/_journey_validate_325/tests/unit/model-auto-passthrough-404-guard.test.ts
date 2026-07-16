/**
 * Issue: auto/* passthrough 404 guard
 *
 * getModelInfoCore() must not return provider="auto" (silent 404 path).
 * Unrecognized auto/* returns errorType=model_not_found with a clear message;
 * recognized auto/* returns a routing-bug message so callers know combo routing
 * should have intercepted the id.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-auto-404-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const { getModelInfoCore } = await import("../../open-sse/services/model.ts");

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("auto/<invalid> returns model_not_found, not provider=auto", async () => {
  const info = await getModelInfoCore("auto/cline", null);
  assert.equal(info.provider, null);
  assert.equal(info.errorType, "model_not_found");
  assert.match(String(info.errorMessage), /not a recognized combo|auto\/cline/i);
});

test("auto (valid combo) returns routing-bug message if it reaches model.ts", async () => {
  const info = await getModelInfoCore("auto", null);
  assert.equal(info.provider, null);
  assert.equal(info.errorType, "model_not_found");
  assert.match(String(info.errorMessage), /reached model resolution|routing bug/i);
});

test("auto/coding (valid combo variant) returns routing-bug message if it reaches model.ts", async () => {
  const info = await getModelInfoCore("auto/coding", null);
  assert.equal(info.provider, null);
  assert.equal(info.errorType, "model_not_found");
  assert.match(String(info.errorMessage), /reached model resolution|routing bug/i);
});

test("auto/fast (valid combo variant) returns routing-bug message if it reaches model.ts", async () => {
  const info = await getModelInfoCore("auto/fast", null);
  assert.equal(info.provider, null);
  assert.equal(info.errorType, "model_not_found");
  assert.match(String(info.errorMessage), /reached model resolution|routing bug/i);
});

test("real provider/model (openai/gpt-4o) still works correctly", async () => {
  const info = await getModelInfoCore("openai/gpt-4o", null);
  assert.equal(info.provider, "openai");
  assert.equal(info.model, "gpt-4o");
});

test("model alias (claude-sonnet-4) still resolves correctly", async () => {
  const info = await getModelInfoCore("claude-sonnet-4", null);
  assert(info.model !== null, "claude-sonnet-4 alias must resolve to a model");
});
