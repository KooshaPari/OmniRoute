import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { waitForMitmWorkerReady } from "../../src/mitm/workerReadiness.ts";

test("worker readiness requires an explicit valid port message", async () => {
  const worker = new EventEmitter();
  const ready = waitForMitmWorkerReady(worker as never, 100);
  worker.emit("message", { status: "booting" });
  worker.emit("message", { port: 11451 });
  assert.equal(await ready, 11451);
});

test("worker survival without readiness times out", async () => {
  const worker = new EventEmitter();
  await assert.rejects(waitForMitmWorkerReady(worker as never, 10), /did not report readiness/);
});

test("worker error and early exit reject startup", async () => {
  const errored = new EventEmitter();
  const errorReady = waitForMitmWorkerReady(errored as never, 100);
  errored.emit("error", new Error("worker boom"));
  await assert.rejects(errorReady, /worker boom/);

  const exited = new EventEmitter();
  const exitReady = waitForMitmWorkerReady(exited as never, 100);
  exited.emit("exit", 2);
  await assert.rejects(exitReady, /code 2/);
});
