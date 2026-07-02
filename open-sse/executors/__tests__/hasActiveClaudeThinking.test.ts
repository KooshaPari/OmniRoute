/**
 * Unit tests for `hasActiveClaudeThinking` (PR-015).
 *
 * NOTE ON SCOPE
 * -------------
 * The original PR-015 spec described this leaf as reading
 * `getThinkingBudgetConfig()` and gating on `thinking_mode in {'auto','enabled'}`.
 * On inspection of v3.8.34 the actual inline function in
 * `open-sse/executors/base.ts` is a 4-line predicate that checks
 * `body.thinking.type in {'enabled','adaptive'}` — it does NOT touch the
 * budget config (that happens upstream in `applyThinkingBudget`).
 * These tests pin the *actual* behavior of the extracted leaf so the
 * refactor is a behavior-preserving rename + relocate.
 *
 * If a future change broadens the predicate to also read
 * `getThinkingBudgetConfig()`, these tests will need to be extended with
 * `vi.mock("../../open-sse/services/thinkingBudget.ts", ...)`.
 */
import { describe, it, expect } from "vitest";
import { hasActiveClaudeThinking } from "../hasActiveClaudeThinking.ts";

describe("hasActiveClaudeThinking", () => {
  // ---------- thinking.type variants ----------

  it("returns true when thinking.type is 'enabled'", () => {
    const body = { model: "claude-opus-4-6", thinking: { type: "enabled", budget_tokens: 32000 } };
    expect(hasActiveClaudeThinking(body)).toBe(true);
  });

  it("returns true when thinking.type is 'adaptive'", () => {
    const body = { model: "claude-opus-4-8", thinking: { type: "adaptive" } };
    expect(hasActiveClaudeThinking(body)).toBe(true);
  });

  it("returns false when thinking.type is 'disabled'", () => {
    const body = { model: "claude-opus-4-6", thinking: { type: "disabled" } };
    expect(hasActiveClaudeThinking(body)).toBe(false);
  });

  it("returns false for an unknown thinking.type value", () => {
    const body = { model: "claude-opus-4-6", thinking: { type: "auto" } };
    expect(hasActiveClaudeThinking(body)).toBe(false);
  });

  it("returns false when thinking.type is an empty string", () => {
    const body = { model: "claude-opus-4-6", thinking: { type: "" } };
    expect(hasActiveClaudeThinking(body)).toBe(false);
  });

  it("returns false when thinking.type is a non-string value", () => {
    const body = { model: "claude-opus-4-6", thinking: { type: 1 } };
    expect(hasActiveClaudeThinking(body)).toBe(false);
  });

  // ---------- missing / malformed thinking block ----------

  it("returns false when thinking block is missing entirely", () => {
    const body = { model: "claude-opus-4-6", messages: [] };
    expect(hasActiveClaudeThinking(body)).toBe(false);
  });

  it("returns false when thinking block is null", () => {
    const body = { model: "claude-opus-4-6", thinking: null };
    expect(hasActiveClaudeThinking(body)).toBe(false);
  });

  it("returns false when thinking block is a primitive (string)", () => {
    const body = { model: "claude-opus-4-6", thinking: "enabled" };
    expect(hasActiveClaudeThinking(body)).toBe(false);
  });

  it("returns false when body is empty {}", () => {
    expect(hasActiveClaudeThinking({})).toBe(false);
  });

  // ---------- Claude family coverage ----------
  // The 'enabled' / 'adaptive' thinking types apply uniformly across the
  // Claude family in the request body — model identity is decided by the
  // upstream normalization, not by this leaf. We pin that here to guard
  // against future regressions that try to special-case model strings
  // inside the predicate.

  it("returns true for claude-opus-4-7 with adaptive thinking", () => {
    const body = { model: "claude-opus-4-7", thinking: { type: "adaptive" } };
    expect(hasActiveClaudeThinking(body)).toBe(true);
  });

  it("returns true for claude-haiku-4-5 with enabled thinking", () => {
    const body = { model: "claude-haiku-4-5", thinking: { type: "enabled", budget_tokens: 4096 } };
    expect(hasActiveClaudeThinking(body)).toBe(true);
  });

  it("returns true for claude-sonnet-4-6 with enabled thinking", () => {
    const body = { model: "claude-sonnet-4-6", thinking: { type: "enabled", budget_tokens: 16000 } };
    expect(hasActiveClaudeThinking(body)).toBe(true);
  });

  it("returns false for claude-opus-4-7 with disabled thinking", () => {
    const body = { model: "claude-opus-4-7", thinking: { type: "disabled" } };
    expect(hasActiveClaudeThinking(body)).toBe(false);
  });

  // ---------- non-Claude model names ----------

  it("returns true for non-Claude model when thinking.type is 'enabled'", () => {
    // The predicate intentionally does not gate on model name — it only
    // looks at the thinking block. This is by design: model-specific
    // normalization happens upstream.
    const body = { model: "gpt-5", thinking: { type: "enabled", budget_tokens: 8000 } };
    expect(hasActiveClaudeThinking(body)).toBe(true);
  });

  it("returns false for non-Claude model with no thinking block", () => {
    const body = { model: "gpt-5", messages: [] };
    expect(hasActiveClaudeThinking(body)).toBe(false);
  });

  // ---------- body with extra unrelated fields ----------

  it("returns true when body carries output_config alongside enabled thinking", () => {
    const body = {
      model: "claude-opus-4-6",
      thinking: { type: "enabled", budget_tokens: 64000 },
      output_config: { effort: "high" },
      messages: [],
    };
    expect(hasActiveClaudeThinking(body)).toBe(true);
  });

  it("returns false when body carries output_config but no thinking block", () => {
    const body = {
      model: "claude-opus-4-6",
      output_config: { effort: "high" },
      messages: [],
    };
    expect(hasActiveClaudeThinking(body)).toBe(false);
  });

  it("returns true when thinking block also has max_tokens (extended form)", () => {
    const body = {
      model: "claude-opus-4-7",
      thinking: { type: "enabled", budget_tokens: 4096, max_tokens: 8000 },
    };
    expect(hasActiveClaudeThinking(body)).toBe(true);
  });

  // ---------- consistency / idempotence ----------

  it("multiple consecutive calls on the same body return identical results", () => {
    const body = { model: "claude-opus-4-6", thinking: { type: "enabled", budget_tokens: 32000 } };
    const first = hasActiveClaudeThinking(body);
    const second = hasActiveClaudeThinking(body);
    const third = hasActiveClaudeThinking(body);
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(third).toBe(true);
  });

  it("does not mutate the input body", () => {
    const body = { model: "claude-opus-4-6", thinking: { type: "enabled", budget_tokens: 32000 } };
    const snapshot = JSON.parse(JSON.stringify(body));
    hasActiveClaudeThinking(body);
    expect(body).toEqual(snapshot);
  });

  it("does not mutate the input body when thinking is missing", () => {
    const body = { model: "claude-opus-4-6" };
    const snapshot = JSON.parse(JSON.stringify(body));
    hasActiveClaudeThinking(body);
    expect(body).toEqual(snapshot);
  });

  // ---------- Bedrock / provider-prefixed aliases ----------

  it("returns true for Bedrock-prefixed claude alias with adaptive thinking", () => {
    const body = { model: "anthropic.claude-opus-4-8", thinking: { type: "adaptive" } };
    expect(hasActiveClaudeThinking(body)).toBe(true);
  });

  it("returns false for non-Anthropic provider with no thinking block", () => {
    const body = { model: "openai.gpt-5", messages: [] };
    expect(hasActiveClaudeThinking(body)).toBe(false);
  });

  // ---------- Fable 5 migration spec ----------

  it("Fable 5 claude with adaptive thinking is detected as active", () => {
    const body = { model: "claude-fable-5", thinking: { type: "adaptive" } };
    expect(hasActiveClaudeThinking(body)).toBe(true);
  });

  it("Fable 5 claude with 'enabled' thinking is also detected (legacy compat)", () => {
    // Even though Fable 5 rejects enabled upstream, the leaf here is a pure
    // predicate — the rejection is enforced by normalizeClaudeAdaptiveThinking,
    // not by this function. Pin this behavior.
    const body = { model: "claude-fable-5", thinking: { type: "enabled", budget_tokens: 1000 } };
    expect(hasActiveClaudeThinking(body)).toBe(true);
  });
});
