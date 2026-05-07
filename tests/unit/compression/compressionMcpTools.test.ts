import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "omniroute-mcp-test-"));
process.env.DATA_DIR = tmpDir;

const { handleCompressionStatus, handleCompressionConfigure } =
  await import("../../../open-sse/mcp-server/tools/compressionTools.ts");
const { compressionConfigureTool, compressionStatusTool } =
  await import("../../../open-sse/mcp-server/schemas/tools.ts");

describe("compression MCP tool schemas", () => {
  it("uses canonical read/write compression scopes", () => {
    assert.deepEqual(compressionStatusTool.scopes, ["read:compression"]);
    assert.deepEqual(compressionConfigureTool.scopes, ["write:compression"]);
  });
});

describe("handleCompressionStatus", () => {
  it("returns an object with enabled field", async () => {
    const result = await handleCompressionStatus({});
    assert.ok("enabled" in result);
    assert.equal(typeof result.enabled, "boolean");
  });

  it("returns strategy string", async () => {
    const result = await handleCompressionStatus({});
    assert.equal(typeof result.strategy, "string");
  });

  it("returns settings with maxTokens number", async () => {
    const result = await handleCompressionStatus({});
    assert.ok("settings" in result);
    assert.equal(typeof result.settings.maxTokens, "number");
  });

  it("returns settings with targetRatio 0.7", async () => {
    const result = await handleCompressionStatus({});
    assert.equal(result.settings.targetRatio, 0.7);
  });

  it("returns analytics with totalRequests number", async () => {
    const result = await handleCompressionStatus({});
    assert.ok("analytics" in result);
    assert.equal(typeof result.analytics.totalRequests, "number");
  });

  it("returns analytics with tokensSaved number", async () => {
    const result = await handleCompressionStatus({});
    assert.equal(typeof result.analytics.tokensSaved, "number");
  });

  it("returns cacheStats as null or object", async () => {
    const result = await handleCompressionStatus({});
    assert.ok(result.cacheStats === null || typeof result.cacheStats === "object");
  });

  it("returns analytics compressedRequests as number", async () => {
    const result = await handleCompressionStatus({});
    assert.equal(typeof result.analytics.compressedRequests, "number");
  });
});

describe("handleCompressionConfigure", () => {
  it("returns success=true when called with empty args", async () => {
    const result = await handleCompressionConfigure({});
    assert.equal(result.success, true);
  });

  it("returns settings object after configure", async () => {
    const result = await handleCompressionConfigure({});
    assert.ok("settings" in result);
    assert.equal(typeof result.settings.enabled, "boolean");
  });

  it("returns updated object", async () => {
    const result = await handleCompressionConfigure({ enabled: true });
    assert.ok("updated" in result);
  });

  it("sets enabled=false and returns success", async () => {
    const result = await handleCompressionConfigure({ enabled: false });
    assert.equal(result.success, true);
  });

  it("sets strategy and returns success", async () => {
    const result = await handleCompressionConfigure({ strategy: "aggressive" });
    assert.equal(result.success, true);
  });

  it("sets maxTokens and returns success", async () => {
    const result = await handleCompressionConfigure({ maxTokens: 8000 });
    assert.equal(result.success, true);
    assert.ok("updated" in result);
  });

  it("returns settings.maxTokens as number", async () => {
    const result = await handleCompressionConfigure({ maxTokens: 2000 });
    assert.equal(typeof result.settings.maxTokens, "number");
  });

  it("returns settings.targetRatio as 0.7", async () => {
    const result = await handleCompressionConfigure({});
    assert.equal(result.settings.targetRatio, 0.7);
  });
});
