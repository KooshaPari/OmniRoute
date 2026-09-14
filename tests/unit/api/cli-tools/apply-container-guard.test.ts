import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

/**
 * Container-guard homologation for POST /api/cli-tools/apply.
 *
 * Both runtime modes are exercised by SCOPED `OMNIROUTE_CONTAINER` overrides
 * (set per test, restored in finally). The override is the documented test
 * seam of `isRunningInContainer()`; it is never forced globally — forcing it
 * off for the whole suite would hide a regression in the guard itself.
 */

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-apply-guard-data-"));
const TEST_XDG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-apply-guard-xdg-"));
const originalDataDir = process.env.DATA_DIR;
const originalXdg = process.env.XDG_CONFIG_HOME;
// Fresh DB without a configured password → management auth is open, so these
// tests exercise the guard, not the auth stack (covered elsewhere).
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.XDG_CONFIG_HOME = TEST_XDG_DIR;

const core = await import("../../../../src/lib/db/core.ts");
const { POST } = await import("../../../../src/app/api/cli-tools/apply/route.ts");

const OPENCODE_CONFIG = path.join(TEST_XDG_DIR, "opencode", "opencode.json");

// The OpenCode generator refuses to write without the live /v1/models catalog
// (context windows are catalog-sourced by design), so serve a minimal catalog
// from an in-test loopback server instead of mocking generator internals.
let catalogServer: http.Server;
let catalogBaseUrl = "";

function startCatalogServer(): Promise<string> {
  return new Promise((resolve) => {
    catalogServer = http.createServer((req, res) => {
      if (String(req.url).startsWith("/v1/models")) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            data: [{ id: "glm/glm-5.2", object: "model", context_length: 128000 }],
          })
        );
        return;
      }
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    });
    catalogServer.listen(0, "127.0.0.1", () => {
      const address = catalogServer.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

function applyRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/cli-tools/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function withContainerMode<T>(mode: "1" | "0", run: () => Promise<T>): Promise<T> {
  const original = process.env.OMNIROUTE_CONTAINER;
  const originalAllow = process.env.OMNIROUTE_ALLOW_CONTAINER_CONFIG_WRITE;
  process.env.OMNIROUTE_CONTAINER = mode;
  delete process.env.OMNIROUTE_ALLOW_CONTAINER_CONFIG_WRITE;
  try {
    return await run();
  } finally {
    if (original === undefined) delete process.env.OMNIROUTE_CONTAINER;
    else process.env.OMNIROUTE_CONTAINER = original;
    if (originalAllow !== undefined) {
      process.env.OMNIROUTE_ALLOW_CONTAINER_CONFIG_WRITE = originalAllow;
    }
  }
}

describe("POST /api/cli-tools/apply — container guard", () => {
  before(async () => {
    catalogBaseUrl = await startCatalogServer();
  });

  after(() => {
    catalogServer?.close();
    core.resetDbInstance();
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.rmSync(TEST_XDG_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdg;
  });

  it("refuses an OpenCode write in container mode with a safe 422", async () => {
    const res = await withContainerMode("1", () =>
      POST(
        applyRequest({
          toolId: "opencode",
          baseUrl: catalogBaseUrl,
          apiKey: "sk-test-guard",
        })
      )
    );
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.ok(body.containerEphemeralTarget, "422 must be keyed as containerEphemeralTarget");
    assert.strictEqual(body.hostSetupCommand, "omniroute setup-opencode");
    assert.ok(typeof body.error === "string" && body.error.length > 0);
    assert.ok(!body.error.includes("at /"), "error must not leak a stack trace");
    assert.ok(!body.error.includes("sk-test-guard"), "error must not leak the API key");
    assert.strictEqual(fs.existsSync(OPENCODE_CONFIG), false, "nothing may be written");
  });

  it("still serves dry-run previews in container mode without writing", async () => {
    const res = await withContainerMode("1", () =>
      POST(
        applyRequest({
          toolId: "opencode",
          baseUrl: catalogBaseUrl,
          apiKey: "sk-test-guard",
          dryRun: true,
        })
      )
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.dryRun, true);
    assert.ok(String(body.content).includes(catalogBaseUrl));
    assert.strictEqual(fs.existsSync(OPENCODE_CONFIG), false, "dry-run must not write");
  });

  it("writes the valid OpenCode config on a host", async () => {
    const res = await withContainerMode("0", () =>
      POST(
        applyRequest({
          toolId: "opencode",
          baseUrl: catalogBaseUrl,
          apiKey: "sk-test-guard",
        })
      )
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.configPath, OPENCODE_CONFIG);
    assert.ok(fs.existsSync(OPENCODE_CONFIG), "host write must land");
    const written = fs.readFileSync(OPENCODE_CONFIG, "utf-8");
    assert.ok(written.includes(catalogBaseUrl));
  });
});
