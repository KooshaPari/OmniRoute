/**
 * Unit tests for `liveServerAllowList`.
 *
 * Bug #1 (plans/2026-06-23-omniroute-v3.8.34-deep-audit.md) introduced the
 * `LIVE_WS_ALLOWED_HOSTS` opt-in for LAN/Tailscale deployments. These tests
 * pin down the contract: defaults remain loopback-only; the env var extends
 * the allow-list with bare hostnames or `host:port` pairs; the absence of
 * Origin is still only acceptable on loopback.
 */

import { describe, it, expect } from "vitest";
import {
  buildAllowedOrigins,
  buildAllowedHosts,
  isOriginAllowed,
  originHost,
  originHostMatches,
  parseCsvEnv,
  DEFAULT_ALLOWED_ORIGINS,
} from "@/server/ws/liveServerAllowList";

const EMPTY_ENV: NodeJS.ProcessEnv = {};

describe("parseCsvEnv", () => {
  it("returns empty set for undefined", () => {
    expect(parseCsvEnv(undefined).size).toBe(0);
  });

  it("returns empty set for empty string", () => {
    expect(parseCsvEnv("").size).toBe(0);
  });

  it("trims whitespace and drops empty entries", () => {
    const out = parseCsvEnv("  a , b ,, c  ");
    expect([...out]).toEqual(["a", "b", "c"]);
  });

  it("deduplicates entries", () => {
    const out = parseCsvEnv("a,a,b");
    expect([...out]).toEqual(["a", "b"]);
  });
});

describe("buildAllowedOrigins", () => {
  it("includes the loopback defaults", () => {
    const out = buildAllowedOrigins(EMPTY_ENV);
    for (const origin of DEFAULT_ALLOWED_ORIGINS) {
      expect(out.has(origin)).toBe(true);
    }
  });

  it("extends defaults with LIVE_WS_ALLOWED_ORIGINS", () => {
    const env = { ...EMPTY_ENV, LIVE_WS_ALLOWED_ORIGINS: "https://dash.example.com,https://other.example.com" };
    const out = buildAllowedOrigins(env);
    expect(out.has("https://dash.example.com")).toBe(true);
    expect(out.has("https://other.example.com")).toBe(true);
    // Defaults remain.
    expect(out.has("http://localhost:20128")).toBe(true);
  });
});

describe("buildAllowedHosts", () => {
  it("returns empty set when env is not set", () => {
    expect(buildAllowedHosts(EMPTY_ENV).size).toBe(0);
  });

  it("parses comma-separated hosts", () => {
    const env = { ...EMPTY_ENV, LIVE_WS_ALLOWED_HOSTS: "100.96.135.160,desktop.tailnet.ts.net" };
    const out = buildAllowedHosts(env);
    expect(out.has("100.96.135.160")).toBe(true);
    expect(out.has("desktop.tailnet.ts.net")).toBe(true);
  });
});

describe("originHost", () => {
  it("returns host and hostname for a valid URL", () => {
    expect(originHost("http://100.96.135.160:20128")).toEqual({
      host: "100.96.135.160:20128",
      hostname: "100.96.135.160",
    });
  });

  it("returns null for an invalid URL", () => {
    expect(originHost("not a url")).toBeNull();
  });
});

describe("originHostMatches", () => {
  it("returns false when the allow-list is empty", () => {
    expect(originHostMatches("http://100.96.135.160:20128", new Set())).toBe(false);
  });

  it("matches by exact host:port", () => {
    const allow = new Set(["100.96.135.160:20128"]);
    expect(originHostMatches("http://100.96.135.160:20128", allow)).toBe(true);
  });

  it("matches by bare hostname regardless of port", () => {
    const allow = new Set(["100.96.135.160"]);
    expect(originHostMatches("http://100.96.135.160:20128", allow)).toBe(true);
    expect(originHostMatches("http://100.96.135.160:55555", allow)).toBe(true);
  });

  it("returns false for a non-matching host", () => {
    const allow = new Set(["100.96.135.160"]);
    expect(originHostMatches("http://10.0.0.5:20128", allow)).toBe(false);
  });

  it("returns false for an unparseable origin", () => {
    const allow = new Set(["100.96.135.160"]);
    expect(originHostMatches("not-a-url", allow)).toBe(false);
  });
});

describe("isOriginAllowed", () => {
  it("rejects any non-loopback origin by default", () => {
    expect(isOriginAllowed("http://100.96.135.160:20128", EMPTY_ENV)).toBe(false);
  });

  it("accepts the default loopback origins", () => {
    expect(isOriginAllowed("http://127.0.0.1:20128", EMPTY_ENV)).toBe(true);
    expect(isOriginAllowed("http://localhost:20128", EMPTY_ENV)).toBe(true);
    expect(isOriginAllowed("http://[::1]:20128", EMPTY_ENV)).toBe(true);
  });

  it("accepts an Origin matching LIVE_WS_ALLOWED_ORIGINS", () => {
    const env = { ...EMPTY_ENV, LIVE_WS_ALLOWED_ORIGINS: "https://dash.example.com" };
    expect(isOriginAllowed("https://dash.example.com", env)).toBe(true);
  });

  it("accepts a Tailscale Origin when LIVE_WS_ALLOWED_HOSTS is set", () => {
    const env = { ...EMPTY_ENV, LIVE_WS_ALLOWED_HOSTS: "100.96.135.160" };
    expect(isOriginAllowed("http://100.96.135.160:20128", env)).toBe(true);
  });

  it("accepts a Tailscale Origin matched by host:port when LIVE_WS_ALLOWED_HOSTS is set", () => {
    const env = { ...EMPTY_ENV, LIVE_WS_ALLOWED_HOSTS: "100.96.135.160:20128" };
    expect(isOriginAllowed("http://100.96.135.160:20128", env)).toBe(true);
  });

  it("does NOT accept a Tailscale Origin when LIVE_WS_ALLOWED_HOSTS is unset", () => {
    // Critical security invariant: without explicit opt-in, the LAN/Tailscale
    // surface is closed even though the listener is reachable.
    expect(isOriginAllowed("http://100.96.135.160:20128", EMPTY_ENV)).toBe(false);
  });

  it("rejects a missing Origin when bound to LAN (0.0.0.0)", () => {
    // A CLI client that omits Origin should NOT be accepted when the
    // operator opted into LAN exposure. Browsers always send Origin, so the
    // empty-Origin path is for non-browser callers; the security stance is
    // "refuse unless loopback".
    const env = { ...EMPTY_ENV, LIVE_WS_HOST: "0.0.0.0" };
    expect(isOriginAllowed(undefined, env)).toBe(false);
  });

  it("accepts a missing Origin on loopback (CLI/MCP)", () => {
    // CLI/MCP clients running on the same host omit Origin. The default
    // listener (127.0.0.1) accepts them.
    expect(isOriginAllowed(undefined, EMPTY_ENV)).toBe(true);
  });

  it("accepts a missing Origin on ::1 / localhost hosts", () => {
    const env1 = { ...EMPTY_ENV, LIVE_WS_HOST: "::1" };
    expect(isOriginAllowed(undefined, env1)).toBe(true);
    const env2 = { ...EMPTY_ENV, LIVE_WS_HOST: "localhost" };
    expect(isOriginAllowed(undefined, env2)).toBe(true);
  });
});
