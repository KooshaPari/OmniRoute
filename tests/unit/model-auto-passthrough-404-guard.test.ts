/**
 * Issue: auto/* passthrough 404 guard
 *
 * Bug: when `auto/<invalid>` (e.g. `auto/cline`) reaches getModelInfoCore(),
 * it was parsed as provider="auto", model="cline", isAlias=false, and returned
 * IMMEDIATELY (line 643–650) WITHOUT running alias/combo resolution. This caused
 * a 404 downstream ("no active credentials for provider: auto") because "auto"
 * is never a real executor — it's a combo keyword.
 *
 * Fix: detect when provider==="auto" and isAlias===false in getModelInfoCore(),
 * validate the combo name via parseAutoPrefix(), and throw a clear 400 error
 * if it's not a recognized combo (auto, auto/coding, auto/fast, etc.).
 * Valid auto/* combos should never reach this layer — they're handled by
 * combo.ts routing — so a valid combo here is a routing bug.
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

// Test (a): auto/cline (invalid combo) must throw, not return provider="auto"
test("auto/<invalid> throws 400-style error, not silent 404", async () => {
  const err = await assert.rejects(
    () => getModelInfoCore("auto/cline", null),
    /not a recognized combo|auto\/cline is not a recognized combo/,
    "auto/cline should reject with clear error message"
  );
  assert(err instanceof Error, "error must be an Error instance");
  assert(err.message.includes("auto"), "error message must mention 'auto'");
  assert(err.message.includes("cline"), "error message must mention the invalid variant");
});

// Test (b): auto (valid combo) should also error here (combos belong in combo.ts, not model.ts)
test("auto (valid combo) should error with routing-bug message if it reaches model.ts", async () => {
  const err = await assert.rejects(
    () => getModelInfoCore("auto", null),
    /reached model resolution instead of combo router|routing bug/,
    "valid auto/* combo reaching model.ts is a routing bug"
  );
  assert(err instanceof Error, "error must be an Error instance");
  assert(err.message.includes("routing"), "error message must indicate routing failure");
});

// Test (c): auto/coding (valid combo variant) should also error with routing-bug message
test("auto/coding (valid combo variant) should error with routing-bug message if it reaches model.ts", async () => {
  const err = await assert.rejects(
    () => getModelInfoCore("auto/coding", null),
    /reached model resolution instead of combo router|routing bug/,
    "valid auto/coding combo reaching model.ts is a routing bug"
  );
  assert(err instanceof Error, "error must be an Error instance");
});

// Test (d): auto/fast (valid combo variant) should also error with routing-bug message
test("auto/fast (valid combo variant) should error with routing-bug message if it reaches model.ts", async () => {
  const err = await assert.rejects(
    () => getModelInfoCore("auto/fast", null),
    /reached model resolution instead of combo router|routing bug/,
    "valid auto/fast combo reaching model.ts is a routing bug"
  );
  assert(err instanceof Error, "error must be an Error instance");
});

// Test (e): real provider/model pairs like openai/gpt-4o must still work
test("real provider/model (openai/gpt-4o) still works correctly", async () => {
  const info = await getModelInfoCore("openai/gpt-4o", null);
  assert.equal(info.provider, "openai", "openai/gpt-4o must have provider=openai");
  assert.equal(info.model, "gpt-4o", "openai/gpt-4o must have model=gpt-4o");
});

// Test (f): model aliases (bare model names treated as aliases) still work
test("model alias (claude-sonnet-4) still resolves correctly", async () => {
  const info = await getModelInfoCore("claude-sonnet-4", null);
  // This is treated as an alias; it should go through alias resolution
  assert(info.model !== null, "claude-sonnet-4 alias must resolve to a model");
});
