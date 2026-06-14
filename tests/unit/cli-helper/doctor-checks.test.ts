import { describe, it, before } from "node:test";
import assert from "node:assert";
import { collectCliToolChecks } from "../../../src/lib/cli-helper/doctor/checks.ts";
import * as toolDetector from "../../../src/lib/cli-helper/tool-detector.ts";

describe("doctor checks - collectCliToolChecks", () => {
  before(() => {
    // @ts-expect-error - internal test hook
    toolDetector.__setExecFileImpl(async (cmd) => {
      if (cmd === "claude") {
        return { stdout: "v0.9.0\n" };
      }
      if (cmd === "codex") {
        return { stdout: "v1.2.3\n" };
      }
      if (cmd === "which") {
        return { stdout: "/usr/bin/claude\n" };
      }
      throw new Error("Command not found");
    });
  });

  it("returns warn for uninstalled tools", async () => {
    const results = await collectCliToolChecks();
    const opencode = results.find((r) => r.name === "CLI: OpenCode");
    assert.ok(opencode, "Expected OpenCode check result");
    assert.strictEqual(opencode.status, "warn");
    assert.ok(opencode.message.includes("not installed"));
    assert.strictEqual(opencode.details.installed, false);
  });

  it("returns warn for installed but unconfigured tools", async () => {
    const results = await collectCliToolChecks();
    const claude = results.find((r) => r.name === "CLI: Claude Code");
    assert.ok(claude, "Expected Claude Code check result");
    assert.strictEqual(claude.status, "warn");
    assert.ok(claude.message.includes("not configured"));
    assert.strictEqual(claude.details.configured, false);
  });

  it("returns consistent DoctorCheckResult shape for every tool", async () => {
    const results = await collectCliToolChecks();
    assert.ok(results.length > 0, "Expected at least one check result");
    for (const r of results) {
      assert.ok(r.name.startsWith("CLI: "), `Expected CLI prefix in name: ${r.name}`);
      assert.ok(["ok", "warn", "fail"].includes(r.status), `Expected valid status: ${r.status}`);
      assert.strictEqual(typeof r.message, "string");
      assert.strictEqual(typeof r.details, "object");
      assert.ok("id" in r.details);
    }
  });
});
