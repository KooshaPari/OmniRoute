import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Trigger edge module registration
import "../../open-sse/rpc/edges/usageEdges.js";
import "../../open-sse/rpc/edges/pricingEdges.js";
import "../../open-sse/rpc/edges/webhookEdges.js";
import "../../open-sse/rpc/edges/metricsEdges.js";
import "../../open-sse/rpc/edges/schedulerEdges.js";
import "../../open-sse/rpc/edges/configEdges.js";

const EDGE_REGISTRY_SYMBOL = "__resetEdgeRegistryForTests";

describe("dispatch expanded edges (Option E)", () => {
  async function loadEdgeModuleAndCheck(name: string) {
    const { getEdgeTier } = await import("../../open-sse/rpc/dispatchEdges.js");
    const tier = getEdgeTier(name);
    assert.ok(tier !== undefined, `${name} should be registered (got tier=${tier})`);
    assert.ok(tier >= 1 && tier <= 3, `tier ${tier} for ${name} should be 1-3`);
  }

  it("usage.sync registers", () => loadEdgeModuleAndCheck("usage.sync"));
  it("pricing.sync registers", () => loadEdgeModuleAndCheck("pricing.sync"));
  it("webhook.dispatch registers", () => loadEdgeModuleAndCheck("webhook.dispatch"));
  it("metrics.render registers", () => loadEdgeModuleAndCheck("metrics.render"));
  it("scheduler.tick registers", () => loadEdgeModuleAndCheck("scheduler.tick"));
  it("config.reload registers", () => loadEdgeModuleAndCheck("config.reload"));
});
