// tests/unit/chatcore-executor-proxy.test.ts
// Characterization of resolveExecutorWithProxy — the upstream-proxy executor resolver extracted from
// handleChatCore (chatCore god-file decomposition, #3501). Exercises the REAL config path through a
// temp DB: disabled/native → the provider's own executor; cliproxyapi → the passthrough executor;
// fallback → a distinct wrapper that owns its own execute(). The wrapper's retry behaviour is not
// invoked here (it would hit the network); the existing cliproxyapi-fallback-wiring.test.ts covers
// the surrounding wiring.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-executor-proxy-test-"));
process.env.DATA_DIR = testDataDir;

// Dynamic imports AFTER DATA_DIR is set so core.ts picks up the temp path.
const coreDb = await import("../../src/lib/db/core.ts");
const upstreamProxyDb = await import("../../src/lib/db/upstreamProxy.ts");
const { resolveExecutorWithProxy } = await import(
  "../../open-sse/handlers/chatCore/executorProxy.ts"
);
const { getExecutor } = await import("../../open-sse/executors/index.ts");
const { clearUpstreamProxyConfigCache } = await import(
  "../../open-sse/handlers/chatCore/comboContextCache.ts"
);

// Save & restore BIFROST_ENABLED so each test can toggle it.
const originalBifrostEnv = process.env.BIFROST_ENABLED;

before(async () => {
  await coreDb.ensureDbInitialized();
});

beforeEach(() => {
  clearUpstreamProxyConfigCache();
});

after(() => {
  coreDb.resetDbInstance();
  fs.rmSync(testDataDir, { recursive: true, force: true });
  // Restore original BIFROST_ENABLED
  if (originalBifrostEnv === undefined) {
    delete process.env.BIFROST_ENABLED;
  } else {
    process.env.BIFROST_ENABLED = originalBifrostEnv;
  }
});

test("no config (disabled by default) returns the provider's own executor", async () => {
  clearUpstreamProxyConfigCache("openai");
  const exec = await resolveExecutorWithProxy("openai");
  assert.equal(exec, getExecutor("openai"));
});

test("mode 'native' returns the provider's own executor", async () => {
  await upstreamProxyDb.upsertUpstreamProxyConfig({
    providerId: "openai",
    mode: "native",
    enabled: true,
  });
  clearUpstreamProxyConfigCache("openai");
  const exec = await resolveExecutorWithProxy("openai");
  assert.equal(exec, getExecutor("openai"));
});

test("mode 'cliproxyapi' returns a CLIProxyAPI passthrough wrapper", async () => {
  await upstreamProxyDb.upsertUpstreamProxyConfig({
    providerId: "anthropic",
    mode: "cliproxyapi",
    enabled: true,
  });
  clearUpstreamProxyConfigCache("anthropic");
  const exec = await resolveExecutorWithProxy("anthropic");
  assert.notEqual(exec, getExecutor("anthropic"));
  assert.notEqual(exec, getExecutor("cliproxyapi"));
  assert.equal(typeof exec.execute, "function");
});

test("mode 'fallback' returns a distinct wrapper owning its own execute()", async () => {
  await upstreamProxyDb.upsertUpstreamProxyConfig({
    providerId: "openai",
    mode: "fallback",
    enabled: true,
  });
  clearUpstreamProxyConfigCache("openai");
  const exec = await resolveExecutorWithProxy("openai");
  assert.notEqual(exec, getExecutor("openai"));
  assert.notEqual(exec, getExecutor("cliproxyapi"));
  assert.equal(typeof exec.execute, "function");
});

test("mode 'cliproxyapi' maps models before dispatching to CLIProxyAPI", async () => {
  await upstreamProxyDb.upsertUpstreamProxyConfig({
    providerId: "anthropic",
    mode: "cliproxyapi",
    enabled: true,
    cliproxyapiModelMapping: {
      "claude-3-5-sonnet": "anthropic/claude-3-5-sonnet-latest",
    },
  });
  clearUpstreamProxyConfigCache("anthropic");

  const cliproxyapiExec = getExecutor("cliproxyapi");
  const originalExecute = cliproxyapiExec.execute;
  let capturedInput;
  cliproxyapiExec.execute = async (input) => {
    capturedInput = input;
    return { response: { status: 200 } };
  };

  try {
    const exec = await resolveExecutorWithProxy("anthropic");
    await exec.execute({
      model: "claude-3-5-sonnet",
      body: { model: "claude-3-5-sonnet", messages: [] },
      stream: false,
      credentials: {},
    });
  } finally {
    cliproxyapiExec.execute = originalExecute;
  }

  assert.equal(capturedInput.model, "anthropic/claude-3-5-sonnet-latest");
  assert.deepEqual(capturedInput.body, {
    model: "anthropic/claude-3-5-sonnet-latest",
    messages: [],
  });
});

test("mode 'fallback' applies global CLIProxyAPI model mappings on proxy retry", async () => {
  await upstreamProxyDb.upsertUpstreamProxyConfig({
    providerId: "openai",
    mode: "fallback",
    enabled: true,
  });
  await upstreamProxyDb.upsertUpstreamProxyConfig({
    providerId: "cliproxyapi",
    mode: "native",
    enabled: true,
    cliproxyapiModelMapping: {
      "gpt-4o": "openai/gpt-4o",
    },
  });
  clearUpstreamProxyConfigCache();

  const nativeExec = getExecutor("openai");
  const cliproxyapiExec = getExecutor("cliproxyapi");
  const originalNativeExecute = nativeExec.execute;
  const originalProxyExecute = cliproxyapiExec.execute;
  let capturedProxyInput;

  nativeExec.execute = async () => ({ response: { status: 503 } });
  cliproxyapiExec.execute = async (input) => {
    capturedProxyInput = input;
    return { response: { status: 200 } };
  };

  try {
    const exec = await resolveExecutorWithProxy("openai");
    await exec.execute({
      model: "gpt-4o",
      body: { model: "gpt-4o", messages: [] },
      stream: false,
      credentials: {},
    });
  } finally {
    nativeExec.execute = originalNativeExecute;
    cliproxyapiExec.execute = originalProxyExecute;
  }

  assert.equal(capturedProxyInput.model, "openai/gpt-4o");
  assert.deepEqual(capturedProxyInput.body, {
    model: "openai/gpt-4o",
    messages: [],
  });
});

// ── Bifrost Tier-1 router path (Phase 1) ─────────────────────────

test("BIFROST_ENABLED=1 returns a bifrost-backed executor with execute+getProvider", async () => {
  process.env.BIFROST_ENABLED = "1";
  try {
    const exec = await resolveExecutorWithProxy("openai");
    assert.notEqual(exec, getExecutor("openai"), "should not be the native executor");
    assert.equal(typeof exec.execute, "function", "should have execute()");
    assert.equal(typeof exec.getProvider, "function", "should have getProvider()");
    assert.equal(exec.getProvider(), "openai", "getProvider() should return the provider id");
  } finally {
    delete process.env.BIFROST_ENABLED;
  }
});

test("BIFROST_ENABLED=1 bifrost executor is distinct from native executor for anthropic", async () => {
  process.env.BIFROST_ENABLED = "1";
  try {
    const exec = await resolveExecutorWithProxy("anthropic");
    assert.notEqual(exec, getExecutor("anthropic"), "bifrost exec should differ from native");
    assert.notEqual(exec, getExecutor("cliproxyapi"), "bifrost exec should differ from cliproxyapi");
  } finally {
    delete process.env.BIFROST_ENABLED;
  }
});

test("BIFROST_ENABLED=true also activates bifrost path", async () => {
  process.env.BIFROST_ENABLED = "true";
  try {
    const exec = await resolveExecutorWithProxy("openai");
    assert.notEqual(exec, getExecutor("openai"), "BIFROST_ENABLED=true should activate bifrost");
    assert.equal(typeof exec.execute, "function");
  } finally {
    delete process.env.BIFROST_ENABLED;
  }
});

test("bifrost path does not interfere with upstream proxy cliproxyapi mode", async () => {
  process.env.BIFROST_ENABLED = "1";
  try {
    // cliproxyapi mode should still work when bifrost is also enabled (bifrost check is first)
    await upstreamProxyDb.upsertUpstreamProxyConfig({
      providerId: "openai",
      mode: "cliproxyapi",
      enabled: true,
    });
    clearUpstreamProxyConfigCache("openai");
    const exec = await resolveExecutorWithProxy("openai");
    // bifrost should win since the check is first
    assert.notEqual(exec, getExecutor("openai"), "bifrost should win over cliproxyapi");
    assert.equal(typeof exec.execute, "function");
    assert.equal(typeof exec.getProvider, "function");
  } finally {
    delete process.env.BIFROST_ENABLED;
  }
});
