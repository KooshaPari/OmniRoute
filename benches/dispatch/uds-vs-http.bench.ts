#!/usr/bin/env node
/**
 * uds-vs-http.bench.ts — HTTP loopback vs UDS JSON-RPC (ADR-032 / T1 vs T2)
 *
 * Benchmarks the round-trip overhead of T1 (HTTP fetch to localhost)
 * vs T2 (JSON-RPC over Unix socket). The UDS server is started in-process,
 * the HTTP server is started on a random port.
 *
 * The T1 baseline: `fetch("http://127.0.0.1:{port}/bench")`.
 * The T2 target: `sendJsonRpc()` over UDS from `udsClient.ts`.
 *
 * Usage:
 *   node --import tsx/esm benches/dispatch/uds-vs-http.bench.ts
 */

import { bench } from "./shared.ts";
import { createServer, type AddressInfo } from "node:net";
import { getDispatchUdsServer, registerUdsHandler, start, stop } from "../../open-sse/rpc/udsServer.ts";
import { invokeUdsEdge, __disconnectAllUdsClientsForTests } from "../../open-sse/rpc/udsClient.ts";

// ── T1 HTTP loopback server ────────────────────────────────────────
const httpServer = createServer((socket) => {
  // Read the request, write a minimal HTTP 200 response.
  socket.on("data", () => {
    socket.end("HTTP/1.1 200 OK\r\nContent-Length:2\r\n\r\nOK");
  });
});
await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
const httpPort = (httpServer.address() as AddressInfo).port;
const HTTP_URL = `http://127.0.0.1:${httpPort}/bench`;

// ── T2 UDS server ──────────────────────────────────────────────────
registerUdsHandler("bench.echo", (params: { msg?: string }) => params.msg ?? "ok");
await start();
const UDS_PATH = process.env.OMNIROUTE_UDS_SOCKET ?? `${process.env.DATA_DIR ?? "/tmp"}/dispatch.sock`;

const ITERATIONS = 500;

console.error(`[uds-vs-http] HTTP port=${httpPort} UDS=${UDS_PATH} iterations=${ITERATIONS}`);

// T1: HTTP loopback
const httpResult = await bench({
  name: "uds-vs-http-t1-fetch",
  tier: "T1",
  edge: "runtime.transport.http-loopback",
  description: "HTTP fetch() over TCP loopback (T1 baseline)",
  iterations: ITERATIONS,
  run: async () => {
    const res = await fetch(HTTP_URL);
    return res.status;
  },
});

console.log(JSON.stringify(httpResult, null, 2));
console.log("---");

// T2: UDS JSON-RPC
const udsResult = await bench({
  name: "uds-vs-http-t2-jsonrpc",
  tier: "T2",
  edge: "runtime.transport.uds-jsonrpc",
  description: "JSON-RPC 2.0 over Unix socket (T2 target)",
  iterations: ITERATIONS,
  run: async () => {
    const res = await invokeUdsEdge({ method: "bench.echo", socket: UDS_PATH } as never, { msg: "ping" });
    return res;
  },
});

console.log(JSON.stringify(udsResult, null, 2));

// ── Cleanup ────────────────────────────────────────────────────────
httpServer.close();
await stop();
console.error("[uds-vs-http] cleanup done");
