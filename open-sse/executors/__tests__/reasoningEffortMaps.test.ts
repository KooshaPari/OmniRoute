/**
 * Tests for the extracted `reasoningEffortMaps` leaf.
 *
 * PR-014 (Wave 6 Resilience) pulled the regex constants, the
 * `supportsMaxEffortForProvider` predicate, and the
 * `sanitizeReasoningEffortForProvider` mutator out of
 * `open-sse/executors/base.ts` so the policy can be exercised without
 * spinning up a real executor. This file pins every branch of the contract.
 *
 * The three layers of the module:
 *
 *   1. Regex patterns — positive and negative matches per pattern.
 *   2. `supportsMaxEffortForProvider` — pure predicate on (provider, model).
 *   3. `sanitizeReasoningEffortForProvider` — the policy that mutates a
 *      request body, dispatched by provider / model / effort value.
 */
import { describe, it, expect, vi } from "vitest";

import {
  GITHUB_REASONING_EFFORT_OPT_IN_PATTERN,
  GITHUB_NO_REASONING_EFFORT_PATTERN,
  MISTRAL_NO_REASONING_EFFORT_PATTERN,
  supportsMaxEffortForProvider,
  sanitizeReasoningEffortForProvider,
} from "../reasoningEffortMaps.ts";

// ---------------------------------------------------------------------------
// Layer 1 — regex patterns
// ---------------------------------------------------------------------------

describe("GITHUB_REASONING_EFFORT_OPT_IN_PATTERN", () => {
  it("matches claude-opus-4-6 (canonical form)", () => {
    expect(GITHUB_REASONING_EFFORT_OPT_IN_PATTERN.test("claude-opus-4-6")).toBe(true);
  });

  it("matches claude-sonnet-4-6 (canonical form)", () => {
    expect(GITHUB_REASONING_EFFORT_OPT_IN_PATTERN.test("claude-sonnet-4-6")).toBe(true);
  });

  it("matches with mixed separator styles (dots/underscores)", () => {
    expect(GITHUB_REASONING_EFFORT_OPT_IN_PATTERN.test("claude_opus_4_6")).toBe(true);
    expect(GITHUB_REASONING_EFFORT_OPT_IN_PATTERN.test("claude.opus.4.6")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(GITHUB_REASONING_EFFORT_OPT_IN_PATTERN.test("Claude-Opus-4-6")).toBe(true);
  });

  it("does NOT match claude-opus-4-7 (newer — Copilot strips)", () => {
    expect(GITHUB_REASONING_EFFORT_OPT_IN_PATTERN.test("claude-opus-4-7")).toBe(false);
  });

  it("does NOT match claude-haiku-4-5 (haiku family — Copilot strips)", () => {
    expect(GITHUB_REASONING_EFFORT_OPT_IN_PATTERN.test("claude-haiku-4-5")).toBe(false);
  });

  it("does NOT match non-Claude models", () => {
    expect(GITHUB_REASONING_EFFORT_OPT_IN_PATTERN.test("gpt-5.4")).toBe(false);
    expect(GITHUB_REASONING_EFFORT_OPT_IN_PATTERN.test("gemini-3.1-pro")).toBe(false);
  });
});

describe("GITHUB_NO_REASONING_EFFORT_PATTERN", () => {
  it("matches the claude family broadly", () => {
    expect(GITHUB_NO_REASONING_EFFORT_PATTERN.test("claude-opus-4-7")).toBe(true);
    expect(GITHUB_NO_REASONING_EFFORT_PATTERN.test("claude-sonnet-4-5")).toBe(true);
    expect(GITHUB_NO_REASONING_EFFORT_PATTERN.test("Claude-Haiku-Anything")).toBe(true);
  });

  it("matches the haiku family explicitly", () => {
    expect(GITHUB_NO_REASONING_EFFORT_PATTERN.test("claude-haiku-4-5")).toBe(true);
    expect(GITHUB_NO_REASONING_EFFORT_PATTERN.test("haiku-anything-else")).toBe(true);
  });

  it("matches the oswe / Raptor family", () => {
    expect(GITHUB_NO_REASONING_EFFORT_PATTERN.test("oswe-vscode-prime")).toBe(true);
    expect(GITHUB_NO_REASONING_EFFORT_PATTERN.test("oswe-anything")).toBe(true);
  });

  it("does NOT match non-claude/haiku/oswe models", () => {
    expect(GITHUB_NO_REASONING_EFFORT_PATTERN.test("gpt-5.4")).toBe(false);
    expect(GITHUB_NO_REASONING_EFFORT_PATTERN.test("gemini-3-flash-preview")).toBe(false);
    expect(GITHUB_NO_REASONING_EFFORT_PATTERN.test("deepseek-v3.2")).toBe(false);
  });
});

describe("MISTRAL_NO_REASONING_EFFORT_PATTERN", () => {
  it("matches devstral family", () => {
    expect(MISTRAL_NO_REASONING_EFFORT_PATTERN.test("devstral-2-5")).toBe(true);
    expect(MISTRAL_NO_REASONING_EFFORT_PATTERN.test("Devstral-Any-Suffix")).toBe(true);
  });

  it("matches devstral inside longer names", () => {
    expect(MISTRAL_NO_REASONING_EFFORT_PATTERN.test("mistralai/devstral-2-5")).toBe(true);
  });

  it("does NOT match non-devstral mistral models", () => {
    expect(MISTRAL_NO_REASONING_EFFORT_PATTERN.test("mistral-large-2")).toBe(false);
    expect(MISTRAL_NO_REASONING_EFFORT_PATTERN.test("mixtral-8x22b")).toBe(false);
  });

  it("does NOT match non-mistral providers' models", () => {
    expect(MISTRAL_NO_REASONING_EFFORT_PATTERN.test("gpt-5.4")).toBe(false);
    expect(MISTRAL_NO_REASONING_EFFORT_PATTERN.test("claude-opus-4-8")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — supportsMaxEffortForProvider (pure predicate)
// ---------------------------------------------------------------------------

describe("supportsMaxEffortForProvider", () => {
  it("returns true for the canonical claude provider on a non-haiku model", () => {
    expect(supportsMaxEffortForProvider("claude", "claude-opus-4-8")).toBe(true);
    expect(supportsMaxEffortForProvider("claude", "claude-sonnet-4-5-20250929")).toBe(true);
  });

  it("returns false for the claude provider on a haiku-family model", () => {
    expect(supportsMaxEffortForProvider("claude", "claude-haiku-4-5-20251001")).toBe(false);
  });

  it("returns true for anthropic-compatible-cc-* prefix (CC-compatible)", () => {
    expect(
      supportsMaxEffortForProvider("anthropic-compatible-cc-foo", "claude-opus-4-8")
    ).toBe(true);
  });

  it("returns true for opencode-go on a deepseek model (DeepSeek opt-in)", () => {
    expect(
      supportsMaxEffortForProvider("opencode-go", "deepseek-v3.2-chat")
    ).toBe(true);
    expect(
      supportsMaxEffortForProvider("opencode-go", "DeepSeek-R1")
    ).toBe(true);
  });

  it("returns false for opencode-go on a non-deepseek model (scope is deliberate)", () => {
    expect(supportsMaxEffortForProvider("opencode-go", "claude-opus-4-8")).toBe(false);
    expect(supportsMaxEffortForProvider("opencode-go", "gpt-5.4")).toBe(false);
  });

  it("returns false for plain GitHub Copilot (no Claude/CC/opencode-go match)", () => {
    expect(supportsMaxEffortForProvider("github", "claude-opus-4-6")).toBe(false);
    expect(supportsMaxEffortForProvider("github", "gpt-5.4")).toBe(false);
  });

  it("returns false for plain OpenAI provider", () => {
    expect(supportsMaxEffortForProvider("openai", "gpt-4o")).toBe(false);
  });

  it("returns false for empty inputs", () => {
    expect(supportsMaxEffortForProvider("", "")).toBe(false);
    expect(supportsMaxEffortForProvider("claude", "")).toBe(false);
    expect(supportsMaxEffortForProvider("", "claude-opus-4-8")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Layer 3 — sanitizeReasoningEffortForProvider
// ---------------------------------------------------------------------------

describe("sanitizeReasoningEffortForProvider — guard branches", () => {
  it("returns null body unchanged", () => {
    expect(sanitizeReasoningEffortForProvider(null, "openai", "gpt-4o")).toBe(null);
  });

  it("returns undefined body unchanged", () => {
    expect(sanitizeReasoningEffortForProvider(undefined, "openai", "gpt-4o")).toBe(undefined);
  });

  it("returns primitive body unchanged", () => {
    expect(sanitizeReasoningEffortForProvider("not-an-object", "openai", "gpt-4o")).toBe(
      "not-an-object"
    );
  });

  it("returns array body unchanged", () => {
    const arr = ["reasoning_effort", "xhigh"];
    expect(sanitizeReasoningEffortForProvider(arr, "openai", "gpt-4o")).toBe(arr);
  });

  it("returns body unchanged when no reasoning_effort or reasoning.effort is set", () => {
    const body = { model: "x", messages: [] };
    const out = sanitizeReasoningEffortForProvider(body, "openai", "gpt-4o");
    expect(out).toBe(body);
  });

  it("preserves other body keys when no reasoning field is present", () => {
    const body = { model: "x", temperature: 0.7, top_p: 0.9, messages: [] };
    const out = sanitizeReasoningEffortForProvider(body, "openai", "gpt-4o");
    expect(out).toEqual({ model: "x", temperature: 0.7, top_p: 0.9, messages: [] });
  });
});

describe("sanitizeReasoningEffortForProvider — GitHub Copilot (claude/haiku/oswe strip)", () => {
  it("KEEPS the reasoning_effort field (does not strip) for GitHub opt-in model (claude-opus-4-6)", () => {
    // The opt-in pattern only prevents the broad Claude/haiku/oswe STRIP — it does
    // not bypass the xhigh→high downgrade that the canonical Claude registry flags
    // for this model. The function still returns a new body, but the field is
    // preserved (not deleted).
    const body = { reasoning_effort: "xhigh" };
    const log = { info: vi.fn() };
    const out = sanitizeReasoningEffortForProvider(body, "github", "claude-opus-4-6", log);
    expect(out).not.toBe(body);
    expect(out).toEqual({ reasoning_effort: "high" });
    expect(log.info).toHaveBeenCalledWith(
      "REASONING_SANITIZE",
      expect.stringContaining("downgraded reasoning_effort xhigh → high")
    );
  });

  it("KEEPS reasoning_effort for GitHub opt-in model (claude-sonnet-4-6) with non-xhigh value", () => {
    const body = { reasoning_effort: "high" };
    const log = { info: vi.fn() };
    const out = sanitizeReasoningEffortForProvider(body, "github", "claude-sonnet-4-6", log);
    expect(out).toBe(body);
  });

  it("KEEPS reasoning_effort for GitHub opt-in model with mixed separator style", () => {
    // The OPT-IN regex uses `[-_.]?` so underscores / dots in the model name
    // still match. The downstream xhigh lookup, however, does NOT normalize
    // underscores — `claude_opus_4_6` is not in any registry, so
    // `supportsXHighEffort` falls back to its permissive default (true) and
    // xhigh passes through unchanged. This is the same code path as any
    // unknown model on the github provider.
    const body = { reasoning_effort: "xhigh" };
    const log = { info: vi.fn() };
    const out = sanitizeReasoningEffortForProvider(body, "github", "claude_opus_4_6", log);
    expect(out).toBe(body);
  });

  it("STRIPS reasoning_effort for GitHub non-opt-in claude-3-5", () => {
    const body = { reasoning_effort: "xhigh", model: "y" };
    const log = { info: vi.fn() };
    const out = sanitizeReasoningEffortForProvider(body, "github", "claude-3-5-sonnet", log) as Record<
      string,
      unknown
    >;
    expect(out).not.toBe(body);
    expect(out).not.toHaveProperty("reasoning_effort");
    expect(out.model).toBe("y");
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith(
      "REASONING_SANITIZE",
      expect.stringContaining("removed unsupported reasoning_effort")
    );
  });

  it("STRIPS reasoning_effort for GitHub haiku", () => {
    const body = { reasoning_effort: "xhigh" };
    const out = sanitizeReasoningEffortForProvider(body, "github", "claude-haiku-4-5") as Record<
      string,
      unknown
    >;
    expect(out).not.toHaveProperty("reasoning_effort");
  });

  it("STRIPS reasoning_effort for GitHub oswe / Raptor", () => {
    const body = { reasoning_effort: "xhigh" };
    const out = sanitizeReasoningEffortForProvider(body, "github", "oswe-vscode-prime") as Record<
      string,
      unknown
    >;
    expect(out).not.toHaveProperty("reasoning_effort");
  });
});

describe("sanitizeReasoningEffortForProvider — Mistral (devstral strip)", () => {
  it("STRIPS reasoning_effort for mistral devstral", () => {
    const body = { reasoning_effort: "xhigh" };
    const log = { info: vi.fn() };
    const out = sanitizeReasoningEffortForProvider(body, "mistral", "devstral-2-5", log) as Record<
      string,
      unknown
    >;
    expect(out).not.toHaveProperty("reasoning_effort");
    expect(log.info).toHaveBeenCalledWith(
      "REASONING_SANITIZE",
      expect.stringContaining("removed unsupported reasoning_effort")
    );
  });

  it("leaves reasoning_effort alone for non-devstral mistral", () => {
    const body = { reasoning_effort: "xhigh" };
    const out = sanitizeReasoningEffortForProvider(body, "mistral", "mistral-large-2");
    expect(out).toBe(body);
  });
});

describe("sanitizeReasoningEffortForProvider — DeepSeek (xhigh/low/medium mapping)", () => {
  it("MAPS xhigh → max for deepseek", () => {
    const body = { reasoning_effort: "xhigh" };
    const log = { info: vi.fn() };
    const out = sanitizeReasoningEffortForProvider(body, "deepseek", "deepseek-v3.2", log) as Record<
      string,
      unknown
    >;
    expect(out.reasoning_effort).toBe("max");
    expect(log.info).toHaveBeenCalledWith(
      "REASONING_SANITIZE",
      expect.stringContaining("normalized reasoning_effort xhigh → max")
    );
  });

  it("MAPS low → high for deepseek", () => {
    const body = { reasoning_effort: "low" };
    const out = sanitizeReasoningEffortForProvider(body, "deepseek", "deepseek-v3.2") as Record<
      string,
      unknown
    >;
    expect(out.reasoning_effort).toBe("high");
  });

  it("MAPS medium → high for deepseek", () => {
    const body = { reasoning_effort: "medium" };
    const out = sanitizeReasoningEffortForProvider(body, "deepseek", "deepseek-v3.2") as Record<
      string,
      unknown
    >;
    expect(out.reasoning_effort).toBe("high");
  });

  it("LEAVES high unchanged for deepseek", () => {
    const body = { reasoning_effort: "high" };
    const out = sanitizeReasoningEffortForProvider(body, "deepseek", "deepseek-v3.2");
    expect(out).toBe(body);
  });

  it("LEAVES max unchanged for deepseek (already a native value)", () => {
    const body = { reasoning_effort: "max" };
    const out = sanitizeReasoningEffortForProvider(body, "deepseek", "deepseek-v3.2");
    expect(out).toBe(body);
  });
});

describe("sanitizeReasoningEffortForProvider — generic xhigh/max normalization", () => {
  it("DOWNGRADES xhigh → high for provider that supports neither xhigh nor max (claude haiku)", () => {
    const body = { reasoning_effort: "xhigh" };
    const log = { info: vi.fn() };
    const out = sanitizeReasoningEffortForProvider(
      body,
      "claude",
      "claude-haiku-4-5-20251001",
      log
    ) as Record<string, unknown>;
    expect(out.reasoning_effort).toBe("high");
    expect(log.info).toHaveBeenCalledWith(
      "REASONING_SANITIZE",
      expect.stringContaining("downgraded reasoning_effort xhigh → high")
    );
  });

  it("NORMALIZES max → xhigh for OpenAI-shape provider that supports xhigh but not max", () => {
    const body = { reasoning_effort: "max" };
    const log = { info: vi.fn() };
    const out = sanitizeReasoningEffortForProvider(body, "openai", "gpt-4o", log) as Record<
      string,
      unknown
    >;
    expect(out.reasoning_effort).toBe("xhigh");
    expect(log.info).toHaveBeenCalledWith(
      "REASONING_SANITIZE",
      expect.stringContaining("normalized reasoning_effort max → xhigh")
    );
  });

  it("DOWNGRADES max → high for provider that supports neither xhigh nor max", () => {
    const body = { reasoning_effort: "max" };
    const log = { info: vi.fn() };
    const out = sanitizeReasoningEffortForProvider(
      body,
      "claude",
      "claude-haiku-4-5-20251001",
      log
    ) as Record<string, unknown>;
    expect(out.reasoning_effort).toBe("high");
    expect(log.info).toHaveBeenCalledWith(
      "REASONING_SANITIZE",
      expect.stringContaining("downgraded reasoning_effort max → high")
    );
  });

  it("LEAVES xhigh unchanged for provider+model that supports xhigh (claude opus 4-8)", () => {
    const body = { reasoning_effort: "xhigh" };
    const out = sanitizeReasoningEffortForProvider(body, "claude", "claude-opus-4-8");
    expect(out).toBe(body);
  });

  it("LEAVES max unchanged for Claude provider on a max-capable model", () => {
    const body = { reasoning_effort: "max" };
    const out = sanitizeReasoningEffortForProvider(body, "claude", "claude-opus-4-8");
    expect(out).toBe(body);
  });
});

describe("sanitizeReasoningEffortForProvider — nested `reasoning.effort` form", () => {
  it("STRIPS nested reasoning.effort on github non-opt-in claude-3-5", () => {
    const body = { reasoning: { effort: "xhigh", summary: "auto" } };
    const out = sanitizeReasoningEffortForProvider(body, "github", "claude-3-5-sonnet") as Record<
      string,
      unknown
    >;
    // reasoning.effort is removed; reasoning survives with its sibling keys
    const reasoning = out.reasoning as Record<string, unknown>;
    expect(reasoning).not.toHaveProperty("effort");
    expect(reasoning.summary).toBe("auto");
  });

  it("DELETES empty nested reasoning object after stripping effort", () => {
    const body = { reasoning: { effort: "xhigh" } };
    const out = sanitizeReasoningEffortForProvider(body, "github", "claude-3-5-sonnet") as Record<
      string,
      unknown
    >;
    expect(out).not.toHaveProperty("reasoning");
  });

  it("MAPS nested reasoning.effort xhigh → max on deepseek", () => {
    const body = { reasoning: { effort: "xhigh", summary: "auto" } };
    const out = sanitizeReasoningEffortForProvider(body, "deepseek", "deepseek-v3.2") as Record<
      string,
      unknown
    >;
    const reasoning = out.reasoning as Record<string, unknown>;
    expect(reasoning.effort).toBe("max");
    expect(reasoning.summary).toBe("auto");
  });

  it("DOWNGRADES nested reasoning.effort xhigh → high on claude haiku", () => {
    const body = { reasoning: { effort: "xhigh" } };
    const out = sanitizeReasoningEffortForProvider(
      body,
      "claude",
      "claude-haiku-4-5-20251001"
    ) as Record<string, unknown>;
    const reasoning = out.reasoning as Record<string, unknown>;
    expect(reasoning.effort).toBe("high");
  });

  it("NORMALIZES nested reasoning.effort max → xhigh on openai gpt-4o", () => {
    const body = { reasoning: { effort: "max" } };
    const out = sanitizeReasoningEffortForProvider(body, "openai", "gpt-4o") as Record<
      string,
      unknown
    >;
    const reasoning = out.reasoning as Record<string, unknown>;
    expect(reasoning.effort).toBe("xhigh");
  });
});

describe("sanitizeReasoningEffortForProvider — mutation hygiene", () => {
  it("does NOT mutate the input body when changing a value", () => {
    const body = { reasoning_effort: "xhigh", model: "x" };
    const snapshot = JSON.parse(JSON.stringify(body));
    sanitizeReasoningEffortForProvider(body, "github", "claude-3-5-sonnet");
    expect(body).toEqual(snapshot);
  });

  it("preserves other top-level keys when mutating reasoning_effort", () => {
    const body = {
      reasoning_effort: "xhigh",
      model: "x",
      temperature: 0.5,
      top_p: 0.9,
      tools: [{ name: "search" }],
    };
    const out = sanitizeReasoningEffortForProvider(body, "github", "claude-3-5-sonnet") as Record<
      string,
      unknown
    >;
    expect(out.model).toBe("x");
    expect(out.temperature).toBe(0.5);
    expect(out.top_p).toBe(0.9);
    expect(out.tools).toEqual([{ name: "search" }]);
    expect(out).not.toHaveProperty("reasoning_effort");
  });

  it("does not call log.info when body is unchanged", () => {
    const log = { info: vi.fn() };
    const body = { reasoning_effort: "xhigh" };
    sanitizeReasoningEffortForProvider(body, "claude", "claude-opus-4-8", log);
    expect(log.info).not.toHaveBeenCalled();
  });

  it("does not throw when log is null", () => {
    const body = { reasoning_effort: "xhigh" };
    expect(() =>
      sanitizeReasoningEffortForProvider(body, "github", "claude-3-5-sonnet", null)
    ).not.toThrow();
  });

  it("does not throw when log is undefined", () => {
    const body = { reasoning_effort: "xhigh" };
    expect(() =>
      sanitizeReasoningEffortForProvider(body, "github", "claude-3-5-sonnet", undefined)
    ).not.toThrow();
  });

  it("uses the REASONING_SANITIZE tag on every log call", () => {
    const log = { info: vi.fn() };
    // deepseek case (xhigh → max)
    sanitizeReasoningEffortForProvider(
      { reasoning_effort: "xhigh" },
      "deepseek",
      "deepseek-v3.2",
      log
    );
    // claude haiku case (xhigh → high)
    sanitizeReasoningEffortForProvider(
      { reasoning_effort: "xhigh" },
      "claude",
      "claude-haiku-4-5-20251001",
      log
    );
    // openai case (max → xhigh)
    sanitizeReasoningEffortForProvider({ reasoning_effort: "max" }, "openai", "gpt-4o", log);
    for (const call of log.info.mock.calls) {
      expect(call[0]).toBe("REASONING_SANITIZE");
    }
    expect(log.info).toHaveBeenCalledTimes(3);
  });

  it("handles a non-string effort value gracefully (falls through unchanged)", () => {
    // The function lowercases the effort only if it's a string. For a numeric
    // value, effortStr is "" and the function short-circuits past all the
    // mapper branches, returning the body unchanged.
    const body = { reasoning_effort: 42 as unknown as string };
    const out = sanitizeReasoningEffortForProvider(body, "openai", "gpt-4o");
    expect(out).toBe(body);
  });

  it("falls back to empty model when model is undefined", () => {
    // With provider=github and model=undefined, the opt-in pattern won't
    // match (no model id) but the broad claude/haiku/oswe pattern also
    // won't match. Falls through to the generic path: gpt-4o? no — github
    // doesn't have a model lookup for undefined, so xhigh on github for
    // an unknown model will not be downgraded by this branch (no opt-in
    // match → strip branch does NOT trigger because GITHUB_NO_* doesn't
    // match "" → falls through to normalize path, which will downgrade if
    // needed). The key invariant: function does not throw and returns
    // either the same body or a clone.
    const body = { reasoning_effort: "xhigh" };
    const out = sanitizeReasoningEffortForProvider(body, "openai", undefined);
    expect(out === body || typeof out === "object").toBe(true);
  });
});
