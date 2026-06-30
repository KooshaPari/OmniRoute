/**
 * Tests for the extracted `stripVersionedToolModelPrefix` leaf (PR-016).
 *
 * Extracted from `open-sse/executors/base.ts` (the function used to live
 * inline at line ~378 in the v3.8.34 tag) and given a dedicated test
 * surface so the prefix-stripping behavior on versioned built-in tool
 * entries is locked in.
 *
 * The function is intentionally narrow: it only touches tool entries whose
 * `type` matches the Anthropic versioned-built-in pattern
 * `^[a-z][a-z0-9_]*_\d{8}$` AND whose `model` is a string containing a `/`.
 * Every test below pins one of those invariants or one of the edge cases
 * the prefix-stripping code must remain safe against.
 */
import { describe, it, expect } from "vitest";
import { stripVersionedToolModelPrefix } from "../stripVersionedToolModelPrefix.ts";

describe("stripVersionedToolModelPrefix", () => {
  // ---------- empty / non-array inputs ----------

  it("empty array is a no-op", () => {
    const tools: unknown[] = [];
    stripVersionedToolModelPrefix(tools);
    expect(tools).toEqual([]);
  });

  it("non-array input is silently ignored (does not throw)", () => {
    expect(() => stripVersionedToolModelPrefix(undefined)).not.toThrow();
    expect(() => stripVersionedToolModelPrefix(null)).not.toThrow();
    expect(() => stripVersionedToolModelPrefix("claude-opus-4-8")).not.toThrow();
    expect(() => stripVersionedToolModelPrefix(42)).not.toThrow();
    expect(() =>
      stripVersionedToolModelPrefix({ type: "advisor_20260301" }),
    ).not.toThrow();
  });

  // ---------- plain (unprefixed) models ----------

  it("plain unprefixed model on a versioned tool is left unchanged", () => {
    const tools = [{ type: "advisor_20260301", model: "claude-opus-4-8" }];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("claude-opus-4-8");
  });

  // ---------- versioned-name / provider-prefix cases ----------

  it("strips a single provider prefix from a versioned tool", () => {
    const tools = [{ type: "advisor_20260301", model: "cc/claude-opus-4-8" }];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("claude-opus-4-8");
  });

  it("strips a provider prefix from another versioned tool (bash)", () => {
    const tools = [
      { type: "bash_20250124", model: "anthropic/claude-3-5-sonnet" },
    ];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("claude-3-5-sonnet");
  });

  it("strips the last segment of a multi-segment prefix", () => {
    // `t.model.split("/").pop()` is greedy on the last `/`, so a path-style
    // provider name is collapsed to just the trailing model id.
    const tools = [
      { type: "advisor_20260301", model: "team-a/cc/claude-opus-4-8" },
    ];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("claude-opus-4-8");
  });

  it("strips prefix on a model whose name itself contains dashes", () => {
    const tools = [
      {
        type: "advisor_20260301",
        model: "cc/claude-3-5-sonnet-20241022",
      },
    ];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("claude-3-5-sonnet-20241022");
  });

  it("strips prefix on a model whose name contains many dashes", () => {
    const tools = [
      {
        type: "advisor_20260301",
        model: "cc/claude-opus-4-8-extended-context",
      },
    ];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("claude-opus-4-8-extended-context");
  });

  // ---------- type-pattern gating ----------

  it("non-versioned tool type is left untouched even with a prefix", () => {
    // `web_search` (no `_YYYYMMDD` suffix) is a custom tool, not a
    // versioned built-in. The stripper must not touch it.
    const tools = [{ type: "web_search", model: "cc/claude-opus-4-8" }];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("cc/claude-opus-4-8");
  });

  it("non-versioned tool type with non-8-digit date suffix is left untouched", () => {
    // 6 digits and 9 digits both fail the `_\\d{8}$` anchor.
    const six = [{ type: "advisor_202603", model: "cc/claude-opus-4-8" }];
    stripVersionedToolModelPrefix(six);
    expect(six[0].model).toBe("cc/claude-opus-4-8");

    const nine = [
      { type: "advisor_202603011", model: "cc/claude-opus-4-8" },
    ];
    stripVersionedToolModelPrefix(nine);
    expect(nine[0].model).toBe("cc/claude-opus-4-8");
  });

  it("versioned tool type whose name starts with a digit is not matched", () => {
    // `^[a-z]` requires a leading letter.
    const tools = [
      { type: "1dvisor_20260301", model: "cc/claude-opus-4-8" },
    ];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("cc/claude-opus-4-8");
  });

  it("versioned tool type with uppercase letter is not matched", () => {
    // `[a-z]` is lowercase only; `Bash_20250124` must not be classified as
    // a versioned built-in.
    const tools = [
      { type: "Bash_20250124", model: "cc/claude-3-5-sonnet" },
    ];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("cc/claude-3-5-sonnet");
  });

  // ---------- missing / non-string model ----------

  it("versioned tool without a model field is left untouched", () => {
    const tools = [{ type: "advisor_20260301" }];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBeUndefined();
  });

  it("versioned tool with non-string model is left untouched", () => {
    const tools: Array<Record<string, unknown>> = [
      { type: "advisor_20260301", model: 42 },
      { type: "advisor_20260301", model: null },
      { type: "advisor_20260301", model: { id: "x" } },
    ];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe(42);
    expect(tools[1].model).toBeNull();
    expect(tools[2].model).toEqual({ id: "x" });
  });

  it("versioned tool whose model has no slash is left untouched", () => {
    const tools = [{ type: "advisor_20260301", model: "claude-opus-4-8" }];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("claude-opus-4-8");
  });

  it("versioned tool with empty-string model is left untouched", () => {
    // `""` does not contain `/`, so the stripper skips it.
    const tools = [{ type: "advisor_20260301", model: "" }];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("");
  });

  // ---------- edge cases: leading, trailing, multiple slashes ----------

  it("trailing slash in model collapses to an empty string", () => {
    // `"cc/".split("/").pop()` returns `""` — that is the literal
    // behavior of the function, so we lock it in.
    const tools = [{ type: "advisor_20260301", model: "cc/" }];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("");
  });

  it("leading slash in model becomes the only segment", () => {
    // `"/claude-opus-4-8".split("/").pop()` is `"claude-opus-4-8"`.
    const tools = [{ type: "advisor_20260301", model: "/claude-opus-4-8" }];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("claude-opus-4-8");
  });

  it("lone slash in model collapses to an empty string", () => {
    const tools = [{ type: "advisor_20260301", model: "/" }];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("");
  });

  it("multiple consecutive slashes collapse to the final segment", () => {
    // The function only keeps the final segment; intermediate empties are
    // dropped, but the very last segment survives.
    const tools = [
      { type: "advisor_20260301", model: "a//b///claude-opus-4-8" },
    ];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("claude-opus-4-8");
  });

  // ---------- batch / ordering / idempotency ----------

  it("multiple versioned tools in one array are each stripped", () => {
    const tools = [
      { type: "advisor_20260301", model: "cc/claude-opus-4-8" },
      { type: "bash_20250124", model: "anthropic/claude-3-5-sonnet" },
      { type: "web_search_20250305", model: "openai/gpt-4o" },
    ];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("claude-opus-4-8");
    expect(tools[1].model).toBe("claude-3-5-sonnet");
    expect(tools[2].model).toBe("gpt-4o");
  });

  it("mixed array: only versioned types get stripped", () => {
    const tools = [
      { type: "web_search", model: "cc/claude-opus-4-8" }, // custom → untouched
      { type: "advisor_20260301", model: "cc/claude-opus-4-8" }, // versioned → stripped
      { type: "bash_20250124", model: "claude-3-5-sonnet" }, // versioned, no prefix → untouched
      { type: "memory_20250818", model: "team/memory-1" }, // versioned → stripped
    ];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("cc/claude-opus-4-8");
    expect(tools[1].model).toBe("claude-opus-4-8");
    expect(tools[2].model).toBe("claude-3-5-sonnet");
    expect(tools[3].model).toBe("memory-1");
  });

  it("mutates the input array in place (no return value)", () => {
    const tools = [{ type: "advisor_20260301", model: "cc/claude-opus-4-8" }];
    const ref = tools;
    const ret = stripVersionedToolModelPrefix(tools);
    expect(ret).toBeUndefined();
    expect(tools).toBe(ref);
    expect(tools[0].model).toBe("claude-opus-4-8");
  });

  it("repeated calls are idempotent once stripped", () => {
    const tools = [{ type: "advisor_20260301", model: "cc/claude-opus-4-8" }];
    stripVersionedToolModelPrefix(tools);
    stripVersionedToolModelPrefix(tools);
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("claude-opus-4-8");
  });

  // ---------- property preservation ----------

  it("extra fields on a tool entry are preserved", () => {
    const tools = [
      {
        type: "advisor_20260301",
        model: "cc/claude-opus-4-8",
        name: "advisor",
        input_schema: { type: "object" },
        cache_control: { type: "ephemeral" },
      },
    ];
    stripVersionedToolModelPrefix(tools);
    expect(tools[0].model).toBe("claude-opus-4-8");
    expect(tools[0].name).toBe("advisor");
    expect(tools[0].input_schema).toEqual({ type: "object" });
    expect(tools[0].cache_control).toEqual({ type: "ephemeral" });
  });
});
