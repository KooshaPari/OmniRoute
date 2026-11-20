import test from "node:test";
import assert from "node:assert/strict";
import { makeManagementSessionRequest } from "../helpers/managementSession.ts";

const shutdown = await import("../../src/app/api/shutdown/route.ts");
const restart = await import("../../src/app/api/restart/route.ts");
const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
const originalKill = process.kill;
const originalTimeout = globalThis.setTimeout;

for (const [name, route] of [["shutdown", shutdown], ["restart", restart]] as const) {
  test(`${name}: Windows denies without scheduling a signal`, async () => {
    const request = await makeManagementSessionRequest("http://localhost/", { method: "POST" });
    const timers: unknown[] = [];
    const signals: unknown[] = [];
    Object.defineProperty(process, "platform", { ...originalPlatform, value: "win32" });
    globalThis.setTimeout = ((callback: unknown) => { timers.push(callback); return 0; }) as typeof setTimeout;
    process.kill = ((...args: unknown[]) => { signals.push(args); return true; }) as typeof process.kill;
    try {
      const response = await route.POST(request);
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /Windows/);
      assert.deepEqual(timers, []);
      assert.deepEqual(signals, []);
    } finally {
      globalThis.setTimeout = originalTimeout;
      process.kill = originalKill;
      Object.defineProperty(process, "platform", originalPlatform);
    }
  });

  test(`${name}: management denial precedes Windows guard`, async () => {
    const request = new Request(`http://example.test/api/${name}`, { method: "POST" });
    Object.defineProperty(process, "platform", { ...originalPlatform, value: "win32" });
    try {
      const response = await route.POST(request);
      assert.equal(response.status, 401);
    } finally {
      Object.defineProperty(process, "platform", originalPlatform);
    }
  });

  test(`${name}: POSIX keeps existing delayed SIGTERM path`, async () => {
    const request = await makeManagementSessionRequest("http://localhost/", { method: "POST" });
    const timers: Array<() => void> = [];
    const signals: unknown[][] = [];
    Object.defineProperty(process, "platform", { ...originalPlatform, value: "linux" });
    globalThis.setTimeout = ((callback: () => void) => { timers.push(callback); return 0; }) as typeof setTimeout;
    process.kill = ((...args: unknown[]) => { signals.push(args); return true; }) as typeof process.kill;
    try {
      const response = await route.POST(request);
      assert.equal(response.status, 200);
      assert.equal(timers.length, 1);
      assert.deepEqual(signals, []);
      timers[0]();
      assert.deepEqual(signals, [[process.pid, "SIGTERM"]]);
    } finally {
      globalThis.setTimeout = originalTimeout;
      process.kill = originalKill;
      Object.defineProperty(process, "platform", originalPlatform);
    }
  });
}
