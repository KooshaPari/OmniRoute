import test from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";
import { register_system } from "../../bin/cli/api-commands/system.mjs";

for (const operation of ["shutdown", "restart"]) {
  for (const status of [200, 503]) {
    test(`${operation} CLI returns the HTTP outcome without retries (${status})`, async () => {
      const originalFetch = globalThis.fetch;
      const originalExit = process.exitCode;
      const originalWrite = process.stdout.write;
      let calls = 0;
      globalThis.fetch = (async (url, init) => {
        calls++;
        assert.equal(String(url), `https://example.invalid/api/${operation}`);
        assert.equal(init?.method, "POST");
        return Response.json(status === 200 ? { success: true } : { error: "unavailable" }, { status });
      }) as typeof fetch;
      process.stdout.write = (() => true) as typeof process.stdout.write;
      process.exitCode = undefined;
      try {
        const program = new Command();
        program.option("--base-url <url>").option("--api-key <key>");
        register_system(program);
        await program.parseAsync(["node", "test", "--base-url", "https://example.invalid", "--api-key", "synthetic-only", "system", `post-api-${operation}`]);
        assert.equal(calls, 1);
        assert.equal(process.exitCode ?? 0, status === 200 ? 0 : 1);
      } finally {
        globalThis.fetch = originalFetch;
        process.stdout.write = originalWrite;
        process.exitCode = originalExit;
      }
    });
  }

  test(`${operation} CLI does not retry an ambiguous network failure`, async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw Object.assign(new Error("synthetic connection reset"), { code: "ECONNRESET" });
    }) as typeof fetch;
    try {
      const program = new Command();
      program.option("--base-url <url>").option("--api-key <key>");
      register_system(program);
      await assert.rejects(program.parseAsync(["node", "test", "--base-url", "https://example.invalid", "--api-key", "synthetic-only", "system", `post-api-${operation}`]));
      assert.equal(calls, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
