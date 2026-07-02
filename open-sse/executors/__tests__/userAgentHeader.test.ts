import { describe, it, expect } from "vitest";
import {
  getCustomUserAgent,
  setUserAgentHeader,
  applyConfiguredUserAgent,
} from "../userAgentHeader.ts";

describe("getCustomUserAgent", () => {
  it("returns trimmed UA when string is present", () => {
    expect(
      getCustomUserAgent({ customUserAgent: "  my-app/1.0  " }),
    ).toBe("my-app/1.0");
  });
  it("returns null when customUserAgent missing", () => {
    expect(getCustomUserAgent({})).toBeNull();
  });
  it("returns null when customUserAgent is not a string", () => {
    expect(getCustomUserAgent({ customUserAgent: 42 })).toBeNull();
    expect(getCustomUserAgent({ customUserAgent: null })).toBeNull();
    expect(getCustomUserAgent({ customUserAgent: true })).toBeNull();
  });
  it("returns null when customUserAgent is whitespace-only", () => {
    expect(getCustomUserAgent({ customUserAgent: "   " })).toBeNull();
    expect(getCustomUserAgent({ customUserAgent: "" })).toBeNull();
  });
  it("returns null for null/undefined providerSpecificData", () => {
    expect(getCustomUserAgent(null)).toBeNull();
    expect(getCustomUserAgent(undefined)).toBeNull();
  });
});

describe("setUserAgentHeader", () => {
  it("sets canonical User-Agent header", () => {
    const h: Record<string, string> = {};
    setUserAgentHeader(h, "ua/1.0");
    expect(h["User-Agent"]).toBe("ua/1.0");
  });
  it("does not duplicate lowercase key when not present", () => {
    const h: Record<string, string> = {};
    setUserAgentHeader(h, "ua/1.0");
    expect(h).not.toHaveProperty("user-agent");
    expect(Object.keys(h)).toEqual(["User-Agent"]);
  });
  it("mirrors to lowercase when both keys exist", () => {
    const h: Record<string, string> = {
      "User-Agent": "old",
      "user-agent": "old",
    };
    setUserAgentHeader(h, "new");
    expect(h["User-Agent"]).toBe("new");
    expect(h["user-agent"]).toBe("new");
  });
  it("is a no-op for empty UA", () => {
    const h: Record<string, string> = {};
    setUserAgentHeader(h, "");
    expect(h).toEqual({});
  });
});

describe("applyConfiguredUserAgent", () => {
  it("sets UA when providerSpecificData has customUserAgent", () => {
    const h: Record<string, string> = {};
    applyConfiguredUserAgent(h, { customUserAgent: "ua/1.0" });
    expect(h["User-Agent"]).toBe("ua/1.0");
  });
  it("trims whitespace before applying", () => {
    const h: Record<string, string> = {};
    applyConfiguredUserAgent(h, { customUserAgent: "  ua/1.0  " });
    expect(h["User-Agent"]).toBe("ua/1.0");
  });
  it("does not modify headers when no custom UA", () => {
    const h: Record<string, string> = { "X-Keep": "value" };
    applyConfiguredUserAgent(h, {});
    expect(h).toEqual({ "X-Keep": "value" });
  });
  it("handles null providerSpecificData gracefully", () => {
    const h: Record<string, string> = {};
    applyConfiguredUserAgent(h, null);
    expect(h).toEqual({});
  });
  it("mirrors to lowercase when both keys already present", () => {
    const h: Record<string, string> = {
      "User-Agent": "old",
      "user-agent": "old",
    };
    applyConfiguredUserAgent(h, { customUserAgent: "new" });
    expect(h["user-agent"]).toBe("new");
  });
});

describe("integrated", () => {
  it("preserves unrelated headers end-to-end", () => {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: "Bearer x",
    };
    applyConfiguredUserAgent(h, { customUserAgent: "my-ua/2.1" });
    expect(h).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer x",
      "User-Agent": "my-ua/2.1",
    });
  });
});