/**
 * #13430 — requiresReasoningReplay model-pattern matching for DeepSeek v4.1
 * and the command-code provider.
 *
 * Split out of tests/unit/reasoning-cache.test.ts, which is size-frozen and
 * cannot grow. This is a self-contained concern: pure model/provider pattern
 * matching with no database, cache, or translator state, so it needs none of
 * the harness that file sets up.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isDeepSeekReasoningModel,
  requiresReasoningReplay,
} from "../../open-sse/services/reasoningCache.ts";

// ──────────── #13430: v4.1 model regex + command-code provider ────────────

describe("requiresReasoningReplay — v4.1 model patterns (#13430)", () => {
  it("matches deepseek-v4.1-flash via model pattern", () => {
    assert.equal(
      requiresReasoningReplay({
        provider: "some-provider",
        model: "deepseek-v4.1-flash",
        thinkingEnabled: true,
      }),
      true
    );
  });

  it("matches deepseek-v4.1-pro via model pattern", () => {
    assert.equal(
      requiresReasoningReplay({
        provider: "some-provider",
        model: "deepseek-v4.1-pro",
        thinkingEnabled: true,
      }),
      true
    );
  });

  it("matches command-code/deepseek-v4.1-flash", () => {
    assert.equal(
      requiresReasoningReplay({
        provider: "command-code",
        model: "deepseek-v4.1-flash",
      }),
      true
    );
  });

  it("matches command-code/deepseek-v4-flash (no minor version)", () => {
    assert.equal(
      requiresReasoningReplay({
        provider: "command-code",
        model: "deepseek-v4-flash",
      }),
      true
    );
  });

  it("isDeepSeekReasoningModel matches v4.1-flash with thinking enabled", () => {
    assert.equal(
      isDeepSeekReasoningModel({
        provider: "command-code",
        model: "deepseek-v4.1-flash",
        thinkingEnabled: true,
      }),
      true
    );
  });

  it("isDeepSeekReasoningModel does NOT match without thinking enabled", () => {
    assert.equal(
      isDeepSeekReasoningModel({
        provider: "command-code",
        model: "deepseek-v4.1-flash",
        thinkingEnabled: false,
      }),
      false
    );
  });

  it("still matches legacy deepseek-v4-flash (no dot)", () => {
    assert.equal(
      requiresReasoningReplay({
        provider: "deepseek",
        model: "deepseek-v4-flash",
      }),
      true
    );
  });
});
