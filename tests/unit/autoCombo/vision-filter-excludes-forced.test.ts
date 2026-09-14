/**
 * Regression: the vision-category candidate filter must exclude registry
 * entries whose catalog OVERSTATES vision support (opencode-go/opencode-zen/
 * tokenrouter backends are text-only and are forced through the vision bridge
 * by isVisionBridgeForcedModel). Otherwise `auto/best-vision` pools include
 * models that can never process images (e.g. deepseek-v4-flash-max), breaking
 * the vision bridge describe/reroute.
 */
import { describe, it, expect } from "vitest";
import { buildAutoCandidateFilter } from "../../../open-sse/services/autoCombo/suffixComposition";

describe("buildAutoCandidateFilter — vision category", () => {
  it("keeps genuinely vision-capable models", () => {
    const filter = buildAutoCandidateFilter("vision");
    expect(filter).not.toBeNull();
    // MiniMax M3 is a real multimodal model (format claude, supportsVision: true).
    expect(filter?.({ provider: "minimax", model: "MiniMax-M3" })).toBe(true);
  });

  it("rejects models whose catalog entry overstates vision (forced through the bridge)", () => {
    const filter = buildAutoCandidateFilter("vision");
    // opencode-go/deepseek-v4-flash-max is in FORCED_VISION_BRIDGE_MODELS —
    // the catalog claims vision but the backend is text-only.
    expect(filter?.({ provider: "opencode-go", model: "deepseek-v4-flash-max" })).toBe(false);
    expect(filter?.({ provider: "opencode-go", model: "deepseek-v4-flash" })).toBe(false);
    expect(filter?.({ provider: "opencode-zen", model: "deepseek-v4-flash" })).toBe(false);
  });

  it("rejects models with no confirmed vision support", () => {
    const filter = buildAutoCandidateFilter("vision");
    // Unknown catalog entry → no confirmed vision → must be rejected.
    expect(filter?.({ provider: "acme", model: "acme-text" })).toBe(false);
  });

  it("non-vision categories are unaffected", () => {
    const filter = buildAutoCandidateFilter("coding");
    expect(filter).toBeNull();
  });
});
