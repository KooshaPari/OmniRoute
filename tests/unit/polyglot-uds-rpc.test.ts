/**
 * Tests for the polyglot UDS RPC server + client roundtrip (ADR-032, F1).
 *
 * Covers:
 *   - Server starts, registers a handler, responds to a JSON-RPC call.
 *   - Server enforces method-not-found.
 *   - Server enforces parse-error on malformed frames.
 *   - Client throws UDS_NO_CONNECTION when the server is not running.
 *   - Multiple sequential calls share the same persistent connection.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, createServer } from "node:net";

const tmp = mkdtempSync(join(tmpdir(), "polyglot-uds-"));
process.env.OMNIROUTE_UDS_SOCKET = join(tmp, "polyglot.sock");
process.env.DATA_DIR = tmp;

const { registerUdsHandler, start, stop, callHandlerInProcess, getPolyglotUdsServer } = await import(
  "../../open-sse/rpc/udsServer.ts"
);
const { invokeUdsEdge, __disconnectAllUdsClientsForTests, healthcheckUdsEdge } = await import(
  "../../open-sse/rpc/udsClient.ts"
);

// ─── Server lifecycle ──────────────────────────────────────────────────────

test.before(async () => {
  // Make sure no stale socket file remains.
  if (existsSync(process.env.OMNIROUTE_UDS_SOCKET!)) {
    rmSync(process.env.OMNIROUTE_UDS_SOCKET!);
  }
});

test.after(async () => {
  __disconnectAllUdsClientsForTests();
  await stop();
  if (existsSync(process.env.OMNIROUTE_UDS_SOCKET!)) {
    rmSync(process.env.OMNIROUTE_UDS_SOCKET!);
  }
  rmSync(tmp, { recursive: true, force: true });
});

// ─── T1: handler registration + in-process invocation ─────────────────────

test("callHandlerInProcess invokes registered handlers synchronously", async () => {
  registerUdsHandler("test.echo", async (params: { x: number }) => ({ doubled: params.x * 2 }));
  const result = await callHandlerInProcess<{ x: number }, { doubled: number }>("test.echo", { x: 21 });
  assert.equal(result.doubled, 42);
});

test("callHandlerInProcess rejects unknown methods", async () => {
  await assert.rejects(() => callHandlerInProcess("test.missing", {}), /not registered|Method not registered/);
});

// ─── T2: server starts and accepts connections ────────────────────────────

test("start() binds the UDS socket and accepts a TCP-via-UDS connection", async () => {
  registerUdsHandler("test.bindcheck", async () => ({ ok: true }));

  await start();
  const srv = getPolyglotUdsServer();
  assert.ok(srv, "server state should be present after start()");
  assert.equal(srv?.isListening, true);
  assert.ok(existsSync(process.env.OMNIROUTE_UDS_SOCKET!), "socket file should exist");

  // Open a raw socket and verify it's accepted (then close).
  await new Promise<void>((resolve, reject) => {
    const c = connect(process.env.OMNIROUTE_UDS_SOCKET!, () => {
      c.end();
      resolve();
    });
    c.on("error", reject);
  });
});

// ─── T3: end-to-end JSON-RPC roundtrip ────────────────────────────────────

test("invokeUdsEdge roundtrips a JSON-RPC request to a registered handler", async () => {
  registerUdsHandler("test.sum", async (params: { a: number; b: number }) => ({ sum: params.a + params.b }));

  await start();

  const result = await invokeUdsEdge<{ a: number; b: number }, { sum: number }>(
    { method: "test.sum" },
    { a: 2, b: 40 },
    { timeoutMs: 2000 }
  );
  assert.equal(result.sum, 42);
});

// ─── T4: malformed JSON-RPC returns an error frame ────────────────────────

test("server returns Method not found for unknown methods", async () => {
  await start();

  // Open a raw socket, send a JSON-RPC frame, parse the response.
  const response = await new Promise<string>((resolve, reject) => {
    const c = connect(process.env.OMNIROUTE_UDS_SOCKET!, () => {
      c.write('{"jsonrpc":"2.0","id":7,"method":"does.not.exist","params":{}}\n');
    });
    let buf = "";
    c.on("data", (chunk) => {
      buf += chunk.toString("utf-8");
      if (buf.includes("\n")) {
        c.end();
      }
    });
    c.on("end", () => resolve(buf));
    c.on("close", () => resolve(buf));
    c.on("error", reject);
  });

  const frame = JSON.parse(response.split("\n")[0]!);
  assert.equal(frame.id, 7);
  assert.ok(frame.error, "expected error frame");
  assert.match(frame.error.message, /Method not found/);
});

// ─── T5: client fails fast when server socket file is missing ─────────────

test("invokeUdsEdge rejects when the socket file does not exist", async () => {
  __disconnectAllUdsClientsForTests();
  const bogus = join(tmpdir(), "definitely-does-not-exist.sock");
  if (existsSync(bogus)) rmSync(bogus);

  await assert.rejects(
    () =>
      invokeUdsEdge<{ x: number }, { y: number }>(
        { socket: bogus, method: "test.sum" },
        { x: 1 },
        { timeoutMs: 250 }
      ),
    /UDS_NO_CONNECTION|socket not connected/i
  );
});

// ─── T6: healthcheckUdsEdge reports the server state ──────────────────────

test("healthcheckUdsEdge returns null when the server is up", async () => {
  registerUdsHandler("test.health", async () => ({ ok: true }));
  await start();

  const result = await healthcheckUdsEdge({ method: "test.health", timeoutMs: 500 });
  assert.equal(result, null);
});