/**
 * claudeIdentity inline-helper unit tests.
 *
 * Tests the user-agent / identity-injection helpers that live at the top of
 * `open-sse/executors/base.ts` and are consumed by the native `claude` provider
 * when it has to spoof a Claude-Code-shaped request (User-Agent, X-Claude-*
 * headers, billing-header build hash, etc.). These helpers are the *inline*
 * companion to `claudeIdentity.ts` (the larger module base.ts imports for
 * `CLAUDE_CODE_VERSION`, `buildHashFor`, `passthroughUpstreamSessionId`, etc.).
 *
 * Imports are intentionally kept to `../base.ts` only — this file must not
 * reach into the sibling `claudeIdentity.ts` module, matching the PR-024
 * scope ("Tests must import functions directly from base.ts via relative
 * path. Do NOT modify base.ts.").
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyConfiguredUserAgent,
  BaseExecutor,
  getCustomUserAgent,
  mergeAbortSignals,
  mergeUpstreamExtraHeaders,
  sanitizeReasoningEffortForProvider,
  setUserAgentHeader,
} from "../base.ts";

// ---------- setUserAgentHeader ----------------------------------------------

describe("setUserAgentHeader (User-Agent / user-agent dual-case)", () => {
  it("sets User-Agent on a fresh headers map", () => {
    const headers: Record<string, string> = {};
    setUserAgentHeader(headers, "claude-cli/2.1.158 (external, cli)");
    assert.equal(headers["User-Agent"], "claude-cli/2.1.158 (external, cli)");
  });

  it("overwrites an existing User-Agent header", () => {
    const headers: Record<string, string> = { "User-Agent": "old/1.0" };
    setUserAgentHeader(headers, "new/2.0");
    assert.equal(headers["User-Agent"], "new/2.0");
  });

  it("dual-cases user-agent when lowercase key was already present", () => {
    const headers: Record<string, string> = { "user-agent": "old/1.0" };
    setUserAgentHeader(headers, "claude-cli/2.1.158 (external, cli)");
    // Both keys reflect the new value — Anthropic and some proxies only match
    // the lowercase variant, so we keep them synchronized.
    assert.equal(headers["User-Agent"], "claude-cli/2.1.158 (external, cli)");
    assert.equal(headers["user-agent"], "claude-cli/2.1.158 (external, cli)");
  });

  it("preserves sibling identity headers (X-Claude-Code-Session-Id)", () => {
    const headers: Record<string, string> = {
      "X-Claude-Code-Session-Id": "11111111-2222-3333-4444-555555555555",
      "Authorization": "Bearer x",
    };
    setUserAgentHeader(headers, "claude-cli/2.1.158 (external, cli)");
    assert.equal(headers["X-Claude-Code-Session-Id"], "11111111-2222-3333-4444-555555555555");
    assert.equal(headers["Authorization"], "Bearer x");
  });
});

// ---------- getCustomUserAgent ----------------------------------------------

describe("getCustomUserAgent (providerSpecificData extraction)", () => {
  it("returns null when providerSpecificData is undefined", () => {
    assert.equal(getCustomUserAgent(undefined), null);
  });

  it("returns null when providerSpecificData is null", () => {
    assert.equal(getCustomUserAgent(null), null);
  });

  it("returns null when customUserAgent field is missing", () => {
    assert.equal(getCustomUserAgent({ other: "value" }), null);
  });

  it("returns null when customUserAgent is the empty string", () => {
    assert.equal(getCustomUserAgent({ customUserAgent: "" }), null);
  });

  it("returns null when customUserAgent is whitespace-only", () => {
    assert.equal(getCustomUserAgent({ customUserAgent: "   \t\n  " }), null);
  });

  it("returns the trimmed value for a valid customUserAgent string", () => {
    assert.equal(
      getCustomUserAgent({ customUserAgent: "  my-agent/1.4.2  " }),
      "my-agent/1.4.2"
    );
  });

  it("returns null when customUserAgent is not a string (number)", () => {
    assert.equal(getCustomUserAgent({ customUserAgent: 42 as unknown as string }), null);
  });

  it("preserves a single-space difference (no .trim() destroys it)", () => {
    // Whitespace at the ends is stripped, but interior spaces stay.
    assert.equal(
      getCustomUserAgent({ customUserAgent: "Acme Agent/3.0 production" }),
      "Acme Agent/3.0 production"
    );
  });
});

// ---------- applyConfiguredUserAgent ----------------------------------------

describe("applyConfiguredUserAgent (providerName normalization → headers)", () => {
  it("does nothing when no customUserAgent is set", () => {
    const headers: Record<string, string> = { "User-Agent": "default/1.0" };
    applyConfiguredUserAgent(headers, { other: "x" });
    assert.equal(headers["User-Agent"], "default/1.0");
  });

  it("applies the configured user-agent when present", () => {
    const headers: Record<string, string> = {};
    applyConfiguredUserAgent(headers, { customUserAgent: "my-proxy/0.1" });
    assert.equal(headers["User-Agent"], "my-proxy/0.1");
  });

  it("accepts lowercase user-agent key and synchronizes both cases", () => {
    const headers: Record<string, string> = { "user-agent": "old/1.0" };
    applyConfiguredUserAgent(headers, { customUserAgent: "new/2.0" });
    assert.equal(headers["User-Agent"], "new/2.0");
    assert.equal(headers["user-agent"], "new/2.0");
  });
});

// ---------- mergeUpstreamExtraHeaders ---------------------------------------

describe("mergeUpstreamExtraHeaders (claudeIdentity X-Claude-* pass-through)", () => {
  it("returns silently when extra headers are null/undefined", () => {
    const headers: Record<string, string> = { "User-Agent": "default/1.0" };
    mergeUpstreamExtraHeaders(headers, null);
    mergeUpstreamExtraHeaders(headers, undefined);
    assert.equal(headers["User-Agent"], "default/1.0");
  });

  it("passes through X-Claude-Code-Session-Id verbatim", () => {
    const headers: Record<string, string> = {};
    mergeUpstreamExtraHeaders(headers, {
      "X-Claude-Code-Session-Id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    assert.equal(
      headers["X-Claude-Code-Session-Id"],
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    );
  });

  it("sets the canonical User-Agent on a fresh headers map", () => {
    const headers: Record<string, string> = {};
    mergeUpstreamExtraHeaders(headers, {
      "User-Agent": "claude-cli/2.1.158 (external, cli)",
    });
    // Canonical-case key is set; lowercase sibling is not (it is only
    // materialized when the caller previously populated the lowercase form).
    assert.equal(headers["User-Agent"], "claude-cli/2.1.158 (external, cli)");
    assert.equal("user-agent" in headers, false);
  });

  it("lower-cases an incoming 'user-agent' key onto the canonical User-Agent", () => {
    const headers: Record<string, string> = {};
    mergeUpstreamExtraHeaders(headers, { "user-agent": "my-agent/9" });
    assert.equal(headers["User-Agent"], "my-agent/9");
  });

  it("skips entries whose value is not a string", () => {
    const headers: Record<string, string> = {};
    mergeUpstreamExtraHeaders(headers, {
      "X-Claude-Code-Session-Id": 123 as unknown as string,
    });
    assert.equal("X-Claude-Code-Session-Id" in headers, false);
  });

  it("skips entries whose key is empty", () => {
    const headers: Record<string, string> = {};
    mergeUpstreamExtraHeaders(headers, { "": "value" });
    assert.deepEqual(Object.keys(headers), []);
  });

  it("preserves sibling identity headers across merges", () => {
    const headers: Record<string, string> = { "Authorization": "Bearer x" };
    mergeUpstreamExtraHeaders(headers, {
      "X-Claude-Code-Session-Id": "11111111-2222-3333-4444-555555555555",
      "User-Agent": "claude-cli/2.1.158 (external, cli)",
    });
    assert.equal(headers["Authorization"], "Bearer x");
    assert.equal(
      headers["X-Claude-Code-Session-Id"],
      "11111111-2222-3333-4444-555555555555"
    );
    assert.equal(headers["User-Agent"], "claude-cli/2.1.158 (external, cli)");
  });
});

// ---------- sanitizeReasoningEffortForProvider ------------------------------
// This is the *providerName-normalization* layer that runs after the
// claudeIdentity helpers have stamped their headers. The fixtures below exercise
// the Claude/Opus/Sonnet/Haiku branches the user explicitly called out.

describe("sanitizeReasoningEffortForProvider (providerName normalization)", () => {
  it("returns body unchanged when reasoning_effort is absent", () => {
    const body = { model: "claude-opus-4-8" };
    const out = sanitizeReasoningEffortForProvider(body, "claude", "claude-opus-4-8");
    assert.equal(out, body);
  });

  it("returns body unchanged for non-objects", () => {
    // Non-objects are returned by reference (function guards against JSON
    // parsing them as objects).
    const arr = [1, 2];
    assert.equal(sanitizeReasoningEffortForProvider(null, "claude", "x"), null);
    assert.equal(sanitizeReasoningEffortForProvider("string", "claude", "x"), "string");
    assert.equal(sanitizeReasoningEffortForProvider(arr, "claude", "x"), arr);
  });

  it("strips reasoning_effort for Haiku under GitHub (model-family rejection)", () => {
    const body = { model: "claude-haiku-4-5", reasoning_effort: "high" };
    const out = sanitizeReasoningEffortForProvider(
      body,
      "github",
      "claude-haiku-4-5"
    ) as Record<string, unknown>;
    assert.equal("reasoning_effort" in out, false);
  });

  it("keeps reasoning_effort for Claude Opus/Sonnet 4.6 under GitHub (opt-in)", () => {
    const body = { model: "claude-opus-4-6", reasoning_effort: "high" };
    const out = sanitizeReasoningEffortForProvider(
      body,
      "github",
      "claude-opus-4-6"
    ) as Record<string, unknown>;
    assert.equal(out.reasoning_effort, "high");
  });

  it("strips reasoning_effort for Claude Haiku (oswe family) under GitHub", () => {
    const body = { model: "oswe-7b", reasoning_effort: "low" };
    const out = sanitizeReasoningEffortForProvider(body, "github", "oswe-7b") as Record<
      string,
      unknown
    >;
    assert.equal("reasoning_effort" in out, false);
  });

  it("strips reasoning_effort for devstral under mistral", () => {
    const body = { model: "devstral-small", reasoning_effort: "medium" };
    const out = sanitizeReasoningEffortForProvider(
      body,
      "mistral",
      "devstral-small"
    ) as Record<string, unknown>;
    assert.equal("reasoning_effort" in out, false);
  });

  it("rewrites xhigh→max for native DeepSeek (and inverse for non-DeepSeek)", () => {
    const body = { model: "deepseek-chat", reasoning_effort: "xhigh" };
    const out = sanitizeReasoningEffortForProvider(
      body,
      "deepseek",
      "deepseek-chat"
    ) as Record<string, unknown>;
    assert.equal(out.reasoning_effort, "max");
  });

  it("rewrites low→high on native DeepSeek (below enum floor)", () => {
    const body = { model: "deepseek-chat", reasoning_effort: "low" };
    const out = sanitizeReasoningEffortForProvider(
      body,
      "deepseek",
      "deepseek-chat"
    ) as Record<string, unknown>;
    assert.equal(out.reasoning_effort, "high");
  });

  it("rewrites max→xhigh on a non-DeepSeek, non-Claude provider that supports xhigh", () => {
    // openrouter supports xhigh but not max; max normalizes to xhigh.
    const body = { model: "any-model", reasoning_effort: "max" };
    const out = sanitizeReasoningEffortForProvider(
      body,
      "openrouter",
      "any-model"
    ) as Record<string, unknown>;
    assert.equal(out.reasoning_effort, "xhigh");
  });

  it("downgrades xhigh→high for a Claude Sonnet 4.5 model routed through openrouter", () => {
    // claude-sonnet-4-5-20250929 is in the Claude registry with
    // supportsXHighEffort: false. openrouter is not a Claude provider, so
    // supportsMax=false too. With both flags false, xhigh falls back to high.
    const body = { model: "claude-sonnet-4-5-20250929", reasoning_effort: "xhigh" };
    const out = sanitizeReasoningEffortForProvider(
      body,
      "openrouter",
      "claude-sonnet-4-5-20250929"
    ) as Record<string, unknown>;
    assert.equal(out.reasoning_effort, "high");
  });

  it("keeps effort inside an explicit reasoning object when present", () => {
    const body = {
      model: "deepseek-chat",
      reasoning: { effort: "xhigh", budget_tokens: 1024 },
    };
    const out = sanitizeReasoningEffortForProvider(
      body,
      "deepseek",
      "deepseek-chat"
    ) as Record<string, unknown>;
    const reasoning = out.reasoning as Record<string, unknown>;
    assert.equal(reasoning.effort, "max");
    assert.equal(reasoning.budget_tokens, 1024);
  });

  it("drops an empty reasoning object when its only field is the effort", () => {
    const body = {
      model: "claude-haiku-4-5",
      reasoning: { effort: "low" },
    };
    const out = sanitizeReasoningEffortForProvider(
      body,
      "github",
      "claude-haiku-4-5"
    ) as Record<string, unknown>;
    assert.equal("reasoning" in out, false);
  });
});

// ---------- BaseExecutor: providerName + buildHeaders (env-override) -------

describe("BaseExecutor providerName normalization + env-driven User-Agent", () => {
  it("getProvider returns the constructor-supplied provider name verbatim", () => {
    const exec = new BaseExecutor("claude", { baseUrl: "https://api.example/v1" });
    assert.equal(exec.getProvider(), "claude");
  });

  it("preserves hyphenated provider ids (anthropic-compatible-*)", () => {
    const exec = new BaseExecutor("anthropic-compatible-foo", { baseUrl: "x" });
    assert.equal(exec.getProvider(), "anthropic-compatible-foo");
  });

  it("buildHeaders emits the provider-specific env-override User-Agent (claude)", () => {
    const prev = process.env.CLAUDE_USER_AGENT;
    process.env.CLAUDE_USER_AGENT = "my-claude-relay/4.2";
    try {
      const exec = new BaseExecutor("claude", { baseUrl: "https://x/y" });
      const headers = exec.buildHeaders({ apiKey: "k" });
      assert.equal(headers["User-Agent"], "my-claude-relay/4.2");
    } finally {
      if (prev === undefined) delete process.env.CLAUDE_USER_AGENT;
      else process.env.CLAUDE_USER_AGENT = prev;
    }
  });

  it("buildHeaders lowercases the env-derived User-Agent key when it pre-existed", () => {
    const prev = process.env.CLAUDE_USER_AGENT;
    process.env.CLAUDE_USER_AGENT = "my-relay/1.0";
    try {
      const exec = new BaseExecutor("claude", {
        baseUrl: "https://x/y",
        headers: { "user-agent": "stale/0.0" },
      });
      const headers = exec.buildHeaders({ apiKey: "k" });
      assert.equal(headers["User-Agent"], "my-relay/1.0");
      assert.equal(headers["user-agent"], "my-relay/1.0");
    } finally {
      if (prev === undefined) delete process.env.CLAUDE_USER_AGENT;
      else process.env.CLAUDE_USER_AGENT = prev;
    }
  });

  it("buildHeaders normalizes provider-id characters when deriving env-key", () => {
    // Punctuation must be stripped & uppercased: "openai-compatible-foo" →
    // OPENAI_COMPATIBLE_FOO_USER_AGENT (not OPENAI-COMPATIBLE-FOO_USER_AGENT).
    const prev = process.env.OPENAI_COMPATIBLE_FOO_USER_AGENT;
    process.env.OPENAI_COMPATIBLE_FOO_USER_AGENT = "compat-relay/7.7";
    try {
      const exec = new BaseExecutor("openai-compatible-foo", { baseUrl: "https://x/y" });
      const headers = exec.buildHeaders({ apiKey: "k" });
      assert.equal(headers["User-Agent"], "compat-relay/7.7");
    } finally {
      if (prev === undefined) delete process.env.OPENAI_COMPATIBLE_FOO_USER_AGENT;
      else process.env.OPENAI_COMPATIBLE_FOO_USER_AGENT = prev;
    }
  });

  it("buildHeaders falls back to config.headers['User-Agent'] when no env override", () => {
    const exec = new BaseExecutor("claude", {
      baseUrl: "https://x/y",
      headers: { "User-Agent": "config-default/2.0" },
    });
    const headers = exec.buildHeaders({ apiKey: "k" });
    assert.equal(headers["User-Agent"], "config-default/2.0");
  });

  it("buildHeaders sets Bearer Authorization from credentials.accessToken", () => {
    const exec = new BaseExecutor("claude", { baseUrl: "https://x/y" });
    const headers = exec.buildHeaders({ accessToken: "tok-abc" });
    assert.equal(headers["Authorization"], "Bearer tok-abc");
  });

  it("buildHeaders picks application/json Accept when stream=false", () => {
    const exec = new BaseExecutor("claude", { baseUrl: "https://x/y" });
    const headers = exec.buildHeaders({ apiKey: "k" }, false);
    assert.equal(headers["Accept"], "application/json");
  });

  it("buildHeaders picks text/event-stream Accept when stream=true", () => {
    const exec = new BaseExecutor("claude", { baseUrl: "https://x/y" });
    const headers = exec.buildHeaders({ apiKey: "k" }, true);
    assert.equal(headers["Accept"], "text/event-stream");
  });

  it("buildHeaders trims a whitespace-only env override (no-op)", () => {
    const prev = process.env.CLAUDE_USER_AGENT;
    process.env.CLAUDE_USER_AGENT = "   ";
    try {
      const exec = new BaseExecutor("claude", {
        baseUrl: "https://x/y",
        headers: { "User-Agent": "config-fallback/1.0" },
      });
      const headers = exec.buildHeaders({ apiKey: "k" });
      assert.equal(headers["User-Agent"], "config-fallback/1.0");
    } finally {
      if (prev === undefined) delete process.env.CLAUDE_USER_AGENT;
      else process.env.CLAUDE_USER_AGENT = prev;
    }
  });
});

// ---------- mergeAbortSignals ----------------------------------------------
// Identity-bearing requests often run under a dual AbortSignal (client +
// server timeout). The combined controller must surface the first abort that
// fires so the upstream Claude request is torn down promptly.

describe("mergeAbortSignals", () => {
  it("returns an unsignalled signal when both inputs are unsignalled", () => {
    const a = new AbortController();
    const b = new AbortController();
    const merged = mergeAbortSignals(a.signal, b.signal);
    assert.equal(merged.aborted, false);
  });

  it("aborts immediately when the primary is already aborted", () => {
    const a = new AbortController();
    a.abort(new Error("primary"));
    const b = new AbortController();
    const merged = mergeAbortSignals(a.signal, b.signal);
    assert.equal(merged.aborted, true);
  });

  it("aborts immediately when the secondary is already aborted", () => {
    const a = new AbortController();
    const b = new AbortController();
    b.abort(new Error("secondary"));
    const merged = mergeAbortSignals(a.signal, b.signal);
    assert.equal(merged.aborted, true);
  });

  it("propagates aborts from the primary asynchronously", () => {
    const a = new AbortController();
    const b = new AbortController();
    const merged = mergeAbortSignals(a.signal, b.signal);
    assert.equal(merged.aborted, false);
    a.abort(new Error("primary later"));
    assert.equal(merged.aborted, true);
  });

  it("propagates aborts from the secondary asynchronously", () => {
    const a = new AbortController();
    const b = new AbortController();
    const merged = mergeAbortSignals(a.signal, b.signal);
    assert.equal(merged.aborted, false);
    b.abort(new Error("secondary later"));
    assert.equal(merged.aborted, true);
  });
});