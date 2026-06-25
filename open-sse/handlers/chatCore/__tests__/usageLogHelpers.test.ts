import { describe, it, expect } from "vitest";
import {
  toPositiveNumber,
  buildCacheUsageLogMeta,
  attachLogMeta,
  buildExecutorClientHeaders,
} from "../usageLogHelpers";

describe("toPositiveNumber", () => {
  it("returns positive number as-is", () => {
    expect(toPositiveNumber(42)).toBe(42);
    expect(toPositiveNumber(0.5)).toBe(0.5);
  });
  it("returns 0 for zero (zero is not positive)", () => {
    expect(toPositiveNumber(0)).toBe(0);
  });
  it("returns 0 for negative", () => {
    expect(toPositiveNumber(-1)).toBe(0);
    expect(toPositiveNumber(-Infinity)).toBe(0);
  });
  it("returns 0 for NaN", () => {
    expect(toPositiveNumber(NaN)).toBe(0);
  });
  it("returns 0 for Infinity (not finite)", () => {
    expect(toPositiveNumber(Infinity)).toBe(0);
  });
  it("returns 0 for strings (strict: not coerced)", () => {
    expect(toPositiveNumber("42")).toBe(0);
    expect(toPositiveNumber("")).toBe(0);
  });
  it("returns 0 for null/undefined", () => {
    expect(toPositiveNumber(null)).toBe(0);
    expect(toPositiveNumber(undefined)).toBe(0);
  });
  it("returns 0 for objects/arrays/booleans", () => {
    expect(toPositiveNumber({})).toBe(0);
    expect(toPositiveNumber([1])).toBe(0);
    expect(toPositiveNumber(true)).toBe(0);
  });
});

describe("buildCacheUsageLogMeta", () => {
  it("returns null for null/undefined", () => {
    expect(buildCacheUsageLogMeta(null)).toBeNull();
    expect(buildCacheUsageLogMeta(undefined)).toBeNull();
  });
  it("returns null for non-object", () => {
    expect(buildCacheUsageLogMeta("x" as unknown as Record<string, unknown>)).toBeNull();
  });
  it("returns null when no cache fields present", () => {
    expect(buildCacheUsageLogMeta({ prompt_tokens: 100 })).toBeNull();
    expect(buildCacheUsageLogMeta({})).toBeNull();
  });
  it("extracts Anthropic cache_read + creation", () => {
    expect(
      buildCacheUsageLogMeta({
        cache_read_input_tokens: 500,
        cache_creation_input_tokens: 100,
      })
    ).toEqual({ cacheReadTokens: 500, cacheCreationTokens: 100 });
  });
  it("extracts Anthropic cache_read only", () => {
    expect(
      buildCacheUsageLogMeta({ cache_read_input_tokens: 300 })
    ).toEqual({ cacheReadTokens: 300, cacheCreationTokens: 0 });
  });
  it("extracts Gemini cachedTokens (camelCase)", () => {
    expect(
      buildCacheUsageLogMeta({ cachedTokens: 750 })
    ).toEqual({ cacheReadTokens: 750, cacheCreationTokens: 0 });
  });
  it("extracts OpenAI cached_tokens (snake_case)", () => {
    expect(
      buildCacheUsageLogMeta({ cached_tokens: 600 })
    ).toEqual({ cacheReadTokens: 600, cacheCreationTokens: 0 });
  });
  it("extracts OpenAI prompt_tokens_details", () => {
    expect(
      buildCacheUsageLogMeta({
        prompt_tokens_details: { cached_tokens: 400, cache_creation_tokens: 50 },
      })
    ).toEqual({ cacheReadTokens: 400, cacheCreationTokens: 50 });
  });
  it("treats invalid cache values as 0", () => {
    expect(
      buildCacheUsageLogMeta({
        cache_read_input_tokens: "abc",
        cache_creation_input_tokens: null,
      })
    ).toEqual({ cacheReadTokens: 0, cacheCreationTokens: 0 });
  });
  it("prefers Anthropic cache_read over Gemini/OpenAI", () => {
    expect(
      buildCacheUsageLogMeta({
        cache_read_input_tokens: 200,
        cachedTokens: 999,
        cached_tokens: 888,
      })
    ).toEqual({ cacheReadTokens: 200, cacheCreationTokens: 0 });
  });
  it("returns normalized zeros when cache fields are present but 0", () => {
    expect(
      buildCacheUsageLogMeta({
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      })
    ).toEqual({ cacheReadTokens: 0, cacheCreationTokens: 0 });
  });
});

describe("attachLogMeta", () => {
  it("returns the payload unchanged when meta is null", () => {
    const payload: Record<string, unknown> = { a: 1 };
    expect(attachLogMeta(payload, null)).toBe(payload);
  });
  it("returns the payload unchanged when meta is undefined", () => {
    const payload: Record<string, unknown> = { a: 1 };
    expect(attachLogMeta(payload, undefined)).toBe(payload);
  });
  it("returns the payload unchanged when meta is non-object", () => {
    const payload: Record<string, unknown> = { a: 1 };
    expect(attachLogMeta(payload, "x" as unknown as Record<string, unknown>)).toBe(payload);
  });
  it("returns the payload unchanged when meta is empty", () => {
    const payload: Record<string, unknown> = { a: 1 };
    expect(attachLogMeta(payload, {})).toBe(payload);
  });
  it("returns _omniroute envelope when payload is null", () => {
    const result = attachLogMeta(null, { a: 1 });
    expect(result).toEqual({ _omniroute: { a: 1 }, _payload: null });
  });
  it("returns _omniroute envelope when payload is undefined", () => {
    const result = attachLogMeta(undefined, { a: 1 });
    expect(result).toEqual({ _omniroute: { a: 1 }, _payload: null });
  });
  it("returns _omniroute envelope when payload is a non-object (string)", () => {
    const result = attachLogMeta("x" as unknown as Record<string, unknown>, { a: 1 });
    expect(result).toEqual({ _omniroute: { a: 1 }, _payload: "x" });
  });
  it("attaches keys under _omniroute on the payload object", () => {
    const target: Record<string, unknown> = { existing: "x" };
    const result = attachLogMeta(target, { a: 1, b: 2 });
    expect(result).toMatchObject({ existing: "x" });
    expect((result as Record<string, Record<string, unknown>>)._omniroute).toEqual({
      a: 1,
      b: 2,
    });
  });
  it("preserves an existing _omniroute envelope and merges into it", () => {
    const target: Record<string, unknown> = {
      existing: "x",
      _omniroute: { prior: true },
    };
    const result = attachLogMeta(target, { new: 1 });
    expect(result).toMatchObject({ existing: "x" });
    expect((result as Record<string, Record<string, unknown>>)._omniroute).toEqual({
      prior: true,
      new: 1,
    });
  });
  it("strips null/undefined values from meta before attaching", () => {
    const target: Record<string, unknown> = { existing: "x" };
    const result = attachLogMeta(target, { a: 1, b: null, c: undefined });
    expect((result as Record<string, Record<string, unknown>>)._omniroute).toEqual({
      a: 1,
    });
  });
  it("treats arrays as non-object (envelope path)", () => {
    const result = attachLogMeta([] as unknown as Record<string, unknown>, { a: 1 });
    expect(result).toEqual({ _omniroute: { a: 1 }, _payload: [] });
  });
  it("does not mutate the input payload", () => {
    const target: Record<string, unknown> = { existing: "x" };
    const snapshot = JSON.parse(JSON.stringify(target));
    attachLogMeta(target, { a: 1 });
    expect(target).toEqual(snapshot);
  });
});

describe("buildExecutorClientHeaders", () => {
  it("returns null for null/undefined", () => {
    expect(buildExecutorClientHeaders(null)).toBeNull();
    expect(buildExecutorClientHeaders(undefined)).toBeNull();
  });
  it("returns null for empty object", () => {
    expect(buildExecutorClientHeaders({})).toBeNull();
  });
  it("copies a plain record of string values", () => {
    expect(
      buildExecutorClientHeaders({ "x-foo": "bar", "x-baz": "qux" })
    ).toEqual({ "x-foo": "bar", "x-baz": "qux" });
  });
  it("drops non-string values from a plain record", () => {
    expect(
      buildExecutorClientHeaders({
        "x-foo": "bar",
        "x-bad": 42 as unknown as string,
        "x-null": null as unknown as string,
        "x-arr": ["a"] as unknown as string,
      })
    ).toEqual({ "x-foo": "bar" });
  });
  it("extracts entries from a Headers instance", () => {
    const headers = new Headers({ "x-foo": "bar", "x-baz": "qux" });
    const result = buildExecutorClientHeaders(headers);
    expect(result).toEqual({ "x-foo": "bar", "x-baz": "qux" });
  });
  it("adds default user-agent (both casings) when not present and userAgent is provided", () => {
    const result = buildExecutorClientHeaders({}, "openai-cli/1.0");
    expect(result).toEqual({ "user-agent": "openai-cli/1.0", "User-Agent": "openai-cli/1.0" });
  });
  it("does not add a default user-agent when userAgent is empty string", () => {
    const result = buildExecutorClientHeaders({}, "");
    expect(result).toBeNull();
  });
  it("does not add a default user-agent when userAgent is null", () => {
    const result = buildExecutorClientHeaders({}, null);
    expect(result).toBeNull();
  });
  it("does not add a default user-agent when one is already present (lowercase)", () => {
    const result = buildExecutorClientHeaders(
      { "user-agent": "existing/1.0" },
      "default/1.0"
    );
    expect(result).toEqual({ "user-agent": "existing/1.0" });
  });
  it("does not add a default user-agent when one is already present (PascalCase)", () => {
    const result = buildExecutorClientHeaders(
      { "User-Agent": "existing/1.0" },
      "default/1.0"
    );
    expect(result).toEqual({ "User-Agent": "existing/1.0" });
  });
  it("trims userAgent whitespace", () => {
    const result = buildExecutorClientHeaders({}, "  openai-cli/1.0  ");
    expect(result).toEqual({ "user-agent": "openai-cli/1.0", "User-Agent": "openai-cli/1.0" });
  });
  it("treats a non-string userAgent as empty", () => {
    const result = buildExecutorClientHeaders({}, 42 as unknown as string);
    expect(result).toBeNull();
  });
});
