/**
 * Bifrost Provider Map + BifrostBackend Executor tests.
 *
 * Covers:
 *  - bifrostProviderMap: direct match, alias, model override, unsupported,
 *    list helpers, edge cases (unknown provider, null bifrostId).
 *  - BifrostBackend executor: env gating (BIFROST_ENABLED), unsupported
 *    provider throws, execute() forwards correct headers + body shape,
 *    Authorization header set from credentials.apiKey vs accessToken,
 *    modelOverride applied.
 *
 * Reference: docs/adr/0031-bifrost-tier1-router.md, ADR-031.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  BIFROST_PROVIDER_IDS,
  BIFROST_PROVIDER_MAP,
  applyBifrostModelOverride,
  getBifrostEntry,
  isBifrostSupported,
  listBifrostSupportedProviders,
  listBifrostUnsupportedProviders,
  resolveBifrostProviderId,
} from "../../open-sse/executors/bifrostProviderMap.ts";
import { BifrostBackendExecutor } from "../../open-sse/executors/bifrost.ts";
import {
  BifrostNoFallbackError,
  createBifrostBackedExecutor,
  dispatchBifrostWithFallback,
  shouldRouteViaBifrost,
} from "../../open-sse/executors/bifrost.ts";
import { BaseExecutor } from "../../open-sse/executors/base.ts";

describe("bifrostProviderMap", () => {
  it("exports a non-empty catalog of Bifrost provider IDs", () => {
    expect(BIFROST_PROVIDER_IDS.length).toBeGreaterThanOrEqual(23);
    expect(BIFROST_PROVIDER_IDS).toContain("openai");
    expect(BIFROST_PROVIDER_IDS).toContain("anthropic");
    expect(BIFROST_PROVIDER_IDS).toContain("gemini");
  });

  it("returns null for unknown provider (not in map)", () => {
    expect(getBifrostEntry("totally-unknown-provider-xyz")).toBeNull();
    expect(resolveBifrostProviderId("totally-unknown-provider-xyz")).toBeNull();
    expect(isBifrostSupported("totally-unknown-provider-xyz")).toBe(false);
  });

  it("maps direct-match providers (openai, anthropic, gemini)", () => {
    expect(resolveBifrostProviderId("openai")).toBe("openai");
    expect(resolveBifrostProviderId("anthropic")).toBe("anthropic");
    expect(resolveBifrostProviderId("gemini")).toBe("gemini");
    expect(isBifrostSupported("openai")).toBe(true);
    expect(isBifrostSupported("anthropic")).toBe(true);
  });

  it("maps legacy aliases (claude → anthropic, gpt → openai, palm → gemini)", () => {
    expect(resolveBifrostProviderId("claude")).toBe("anthropic");
    expect(resolveBifrostProviderId("gpt")).toBe("openai");
    expect(resolveBifrostProviderId("palm")).toBe("gemini");
    expect(resolveBifrostProviderId("palm2")).toBe("gemini");
    expect(resolveBifrostProviderId("bard")).toBe("gemini");
  });

  it("returns null for web-cookie and custom executors (unsupported)", () => {
    expect(resolveBifrostProviderId("claude-web")).toBeNull();
    expect(resolveBifrostProviderId("chatgpt-web")).toBeNull();
    expect(resolveBifrostProviderId("cliproxyapi")).toBeNull();
    expect(resolveBifrostProviderId("cursor")).toBeNull();
    expect(isBifrostSupported("claude-web")).toBe(false);
  });

  it("applies Azure model override (deployment-name → model-id)", () => {
    expect(applyBifrostModelOverride("azure-gpt4", "gpt-4o-deployment-prod")).toBe("gpt-4o");
    expect(applyBifrostModelOverride("azure-gpt4", "GPT-4-TURBO-0613")).toBe("gpt-4-turbo");
    expect(applyBifrostModelOverride("azure-gpt4", "gpt-35-turbo-version-2")).toBe("gpt-35-turbo");
    expect(applyBifrostModelOverride("azure-gpt4", "unknown-model-name")).toBe(
      "unknown-model-name"
    );
  });

  it("returns input unchanged when no model override is defined", () => {
    expect(applyBifrostModelOverride("openai", "gpt-4o")).toBe("gpt-4o");
    expect(applyBifrostModelOverride("anthropic", "claude-3-5-sonnet-20241022")).toBe(
      "claude-3-5-sonnet-20241022"
    );
  });

  it("lists supported providers (excludes unsupported)", () => {
    const supported = listBifrostSupportedProviders();
    expect(supported.length).toBeGreaterThan(10);
    expect(supported.every((p) => p.bifrostId !== null)).toBe(true);
    expect(supported.find((p) => p.omnirouteId === "claude-web")).toBeUndefined();
  });

  it("lists unsupported providers (excludes supported)", () => {
    const unsupported = listBifrostUnsupportedProviders();
    expect(unsupported.length).toBeGreaterThan(5);
    expect(unsupported.find((p) => p.omnirouteId === "claude-web")).toBeDefined();
    expect(unsupported.find((p) => p.omnirouteId === "openai")).toBeUndefined();
  });

  it("every entry in BIFROST_PROVIDER_MAP has a valid status", () => {
    const validStatuses = new Set(["native", "alias", "passthrough", "unsupported"]);
    for (const [, entry] of Object.entries(BIFROST_PROVIDER_MAP)) {
      expect(validStatuses.has(entry.status)).toBe(true);
    }
  });
});

describe("BifrostBackend executor (env gating)", () => {
  const originalBifrostEnabled = process.env.BIFROST_ENABLED;
  const originalBifrostBaseUrl = process.env.BIFROST_BASE_URL;

  beforeEach(() => {
    delete process.env.BIFROST_ENABLED;
    delete process.env.BIFROST_BASE_URL;
  });

  afterEach(() => {
    if (originalBifrostEnabled === undefined) delete process.env.BIFROST_ENABLED;
    else process.env.BIFROST_ENABLED = originalBifrostEnabled;
    if (originalBifrostBaseUrl === undefined) delete process.env.BIFROST_BASE_URL;
    else process.env.BIFROST_BASE_URL = originalBifrostBaseUrl;
  });

  it("throws when BIFROST_ENABLED is unset", async () => {
    const exec = new BifrostBackendExecutor("openai", {});
    await expect(
      exec.execute({
        model: "gpt-4o",
        body: { model: "gpt-4o", messages: [] },
        stream: false,
        credentials: {},
      })
    ).rejects.toThrow(/Bifrost is not enabled/);
  });

  it("throws when provider is not in Bifrost provider map", async () => {
    process.env.BIFROST_ENABLED = "1";
    const exec = new BifrostBackendExecutor("claude-web", {});
    await expect(
      exec.execute({
        model: "claude-3-5-sonnet",
        body: { model: "claude-3-5-sonnet", messages: [] },
        stream: false,
        credentials: {},
      })
    ).rejects.toThrow(/not in the Bifrost provider map/);
  });

  it("accepts BIFROST_ENABLED=true", () => {
    process.env.BIFROST_ENABLED = "true";
    // No throw; the executor is created without error.
    expect(() => new BifrostBackendExecutor("openai", {})).not.toThrow();
  });

  it("accepts BIFROST_ENABLED=1", () => {
    process.env.BIFROST_ENABLED = "1";
    expect(() => new BifrostBackendExecutor("openai", {})).not.toThrow();
  });

  it("rejects BIFROST_ENABLED=false", () => {
    process.env.BIFROST_ENABLED = "false";
    const exec = new BifrostBackendExecutor("openai", {});
    return expect(
      exec.execute({
        model: "gpt-4o",
        body: { model: "gpt-4o" },
        stream: false,
        credentials: {},
      })
    ).rejects.toThrow(/Bifrost is not enabled/);
  });
});

describe("Bifrost dispatcher-facing helpers", () => {
  const originalBifrostEnabled = process.env.BIFROST_ENABLED;

  afterEach(() => {
    if (originalBifrostEnabled === undefined) delete process.env.BIFROST_ENABLED;
    else process.env.BIFROST_ENABLED = originalBifrostEnabled;
  });

  it("routes via Bifrost when globally enabled or when providerSpecificData opts in", () => {
    delete process.env.BIFROST_ENABLED;
    expect(shouldRouteViaBifrost("openai")).toBe(false);
    expect(
      shouldRouteViaBifrost("openai", {
        providerSpecificData: { bifrostMode: true },
      })
    ).toBe(true);

    process.env.BIFROST_ENABLED = "1";
    expect(shouldRouteViaBifrost("openai")).toBe(true);
  });

  it("creates an executor with the dispatcher-compatible surface", () => {
    const exec = createBifrostBackedExecutor("openai");

    expect(exec.getProvider()).toBe("openai");
    expect(typeof exec.execute).toBe("function");
  });
});

describe("BifrostBackend executor (healthCheck)", () => {
  const originalBifrostEnabled = process.env.BIFROST_ENABLED;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.BIFROST_ENABLED;
  });

  afterEach(() => {
    if (originalBifrostEnabled === undefined) delete process.env.BIFROST_ENABLED;
    else process.env.BIFROST_ENABLED = originalBifrostEnabled;
    globalThis.fetch = originalFetch;
  });

  it("returns ok=false with reason when Bifrost not enabled", async () => {
    const exec = new BifrostBackendExecutor("openai", {});
    const result = await exec.healthCheck();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not enabled/);
  });

  it("probes /health when Bifrost is enabled and reachable", async () => {
    process.env.BIFROST_ENABLED = "1";
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", version: "1.2.3" }), { status: 200 })
      );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const exec = new BifrostBackendExecutor("openai", {});
    const result = await exec.healthCheck();
    expect(result.ok).toBe(true);
    expect(result.version).toBe("1.2.3");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = (mockFetch.mock.calls[0]?.[0] as string) ?? "";
    expect(calledUrl).toMatch(/\/health$/);
  });

  it("returns ok=false with HTTP status when Bifrost returns non-OK", async () => {
    process.env.BIFROST_ENABLED = "1";
    const mockFetch = vi.fn().mockResolvedValue(new Response("nope", { status: 503 }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const exec = new BifrostBackendExecutor("openai", {});
    const result = await exec.healthCheck();
    expect(result.ok).toBe(false);
    expect(result.error).toBe("HTTP 503");
  });

  it("returns ok=false when Bifrost is unreachable (network error)", async () => {
    process.env.BIFROST_ENABLED = "1";
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const exec = new BifrostBackendExecutor("openai", {});
    const result = await exec.healthCheck();
    expect(result.ok).toBe(false);
    expect(result.error).toBe("ECONNREFUSED");
  });
});

describe("BifrostBackend executor (execute body shape)", () => {
  const originalBifrostEnabled = process.env.BIFROST_ENABLED;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.BIFROST_ENABLED = "1";
    process.env.BIFROST_BASE_URL = "http://bifrost.test:8080";
  });

  afterEach(() => {
    if (originalBifrostEnabled === undefined) delete process.env.BIFROST_ENABLED;
    else process.env.BIFROST_ENABLED = originalBifrostEnabled;
    delete process.env.BIFROST_BASE_URL;
    globalThis.fetch = originalFetch;
  });

  it("POSTs to /v1/chat/completions with the expected URL and headers", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response('{"id":"x","choices":[]}', { status: 200 }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const exec = new BifrostBackendExecutor("openai", {});
    await exec.execute({
      model: "gpt-4o",
      body: { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] },
      stream: false,
      credentials: { apiKey: "sk-test-123" },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = mockFetch.mock.calls[0] ?? [];
    expect(calledUrl).toBe("http://bifrost.test:8080/v1/chat/completions");
    expect((init as RequestInit)?.method).toBe("POST");
    const headers = (init as RequestInit)?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Bifrost-Provider"]).toBe("openai");
    expect(headers["X-OmniRoute-Provider"]).toBe("openai");
    expect(headers["Authorization"]).toBe("Bearer sk-test-123");
  });

  it("uses accessToken as bearer when apiKey is absent (OAuth providers)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const exec = new BifrostBackendExecutor("anthropic", {});
    await exec.execute({
      model: "claude-3-5-sonnet-20241022",
      body: { model: "claude-3-5-sonnet-20241022", messages: [] },
      stream: false,
      credentials: { accessToken: "ya29.OAuthToken" },
    });

    const [, init] = mockFetch.mock.calls[0] ?? [];
    const headers = (init as RequestInit)?.headers as Record<string, string>;
    expect(headers["X-Bifrost-Provider"]).toBe("anthropic");
    expect(headers["Authorization"]).toBe("Bearer ya29.OAuthToken");
  });

  it("does NOT set Authorization header when no credentials are supplied", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const exec = new BifrostBackendExecutor("gemini", {});
    await exec.execute({
      model: "gemini-1.5-pro",
      body: { model: "gemini-1.5-pro" },
      stream: false,
      credentials: {},
    });

    const [, init] = mockFetch.mock.calls[0] ?? [];
    const headers = (init as RequestInit)?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
    expect(headers["X-Bifrost-Provider"]).toBe("gemini");
  });

  it("applies model override (Azure deployment-name → model-id)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const exec = new BifrostBackendExecutor("azure-gpt4", {});
    await exec.execute({
      model: "gpt-4o-deployment-prod",
      body: { model: "gpt-4o-deployment-prod", messages: [] },
      stream: false,
      credentials: { apiKey: "azure-key" },
    });

    const [calledUrl, init] = mockFetch.mock.calls[0] ?? [];
    expect(calledUrl).toBe("http://bifrost.test:8080/v1/chat/completions");
    const body = JSON.parse((init as RequestInit)?.body as string);
    expect(body.model).toBe("gpt-4o");
    const headers = (init as RequestInit)?.headers as Record<string, string>;
    expect(headers["X-Bifrost-Provider"]).toBe("azure");
  });

  it("merges upstreamExtraHeaders over defaults", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const exec = new BifrostBackendExecutor("openai", {});
    await exec.execute({
      model: "gpt-4o",
      body: { model: "gpt-4o" },
      stream: false,
      credentials: {},
      upstreamExtraHeaders: {
        "X-Tenant-Id": "tenant-acme",
        "User-Agent": "MyApp/1.0",
      },
    });

    const [, init] = mockFetch.mock.calls[0] ?? [];
    const headers = (init as RequestInit)?.headers as Record<string, string>;
    expect(headers["X-Tenant-Id"]).toBe("tenant-acme");
    expect(headers["User-Agent"]).toBe("MyApp/1.0");
  });

  it("inherits BaseExecutor", () => {
    const exec = new BifrostBackendExecutor("openai", {});
    expect(exec).toBeInstanceOf(BaseExecutor);
    expect(exec.provider).toBe("openai");
  });

  // B9 wiring: BifrostBackendExecutor must consult the kill switch before
  // dispatch and record an observation after every request (success or fail).
  // These two tests lock the B9 wiring contract. Ref: BIFROST-BACKEND.md §B9.
  it("B9: throws and does NOT call fetch when the kill switch is active for this provider", async () => {
    process.env.BIFROST_ENABLED = "1";
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { forceActivate, forceDeactivate, isActive } =
      await import("../../open-sse/services/bifrostKillSwitch.ts");
    forceDeactivate("openai");
    forceActivate("openai");

    expect(isActive("openai")).toBe(true);

    const exec = new BifrostBackendExecutor("openai", {});
    await expect(
      exec.execute({
        model: "gpt-4o",
        body: { model: "gpt-4o", messages: [] },
        stream: false,
        credentials: { apiKey: "sk-x" },
      })
    ).rejects.toThrow(/BIFROST_KILL_SWITCH_ACTIVE/);

    expect(mockFetch).not.toHaveBeenCalled();

    forceDeactivate("openai");
  });

  it("B9: records an observation after a successful dispatch (windowStats.totalSamples incremented, ok rate reflects success)", async () => {
    process.env.BIFROST_ENABLED = "1";
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response('{"id":"x","choices":[]}', { status: 200 }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { resetProvider, getState } =
      await import("../../open-sse/services/bifrostKillSwitch.ts");
    resetProvider("anthropic");

    const exec = new BifrostBackendExecutor("anthropic", {});
    await exec.execute({
      model: "claude-3-5-sonnet-20241022",
      body: { model: "claude-3-5-sonnet-20241022", messages: [] },
      stream: false,
      credentials: { accessToken: "tok" },
    });

    const state = getState("anthropic");
    expect(state).toBeDefined();
    expect(state?.windowStats.totalSamples).toBeGreaterThanOrEqual(1);
    expect(state?.windowStats.errorSamples).toBe(0);
    expect(state?.windowStats.avgLatencyMs).toBeGreaterThanOrEqual(0);
    expect(state?.windowStats.p99LatencyMs).toBeGreaterThanOrEqual(0);

    resetProvider("anthropic");
  });
});

// ── Dispatcher fallback wrapper (B9 wiring closure) ────────────────
// Ref: docs/frameworks/BIFROST-BACKEND.md §B9 (kill switch fallback).
describe("dispatchBifrostWithFallback", () => {
  const originalBifrostEnabled = process.env.BIFROST_ENABLED;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.BIFROST_ENABLED = "1";
    process.env.BIFROST_BASE_URL = "http://bifrost.test:8080";
  });

  afterEach(() => {
    if (originalBifrostEnabled === undefined) delete process.env.BIFROST_ENABLED;
    else process.env.BIFROST_ENABLED = originalBifrostEnabled;
    delete process.env.BIFROST_BASE_URL;
    globalThis.fetch = originalFetch;
  });

  it("falls back to the legacy executor when the kill switch trips for the resolved provider", async () => {
    process.env.BIFROST_ENABLED = "1";
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "chatcmpl-fallback", choices: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const { forceActivate, forceDeactivate, resetProvider } =
      await import("../../open-sse/services/bifrostKillSwitch.ts");
    forceDeactivate("openai");
    forceActivate("openai");

    const exec = new BifrostBackendExecutor("openai", {});
    const input = {
      model: "gpt-4o",
      body: { model: "gpt-4o", messages: [] },
      stream: false,
      credentials: { apiKey: "sk-test" },
    };

    const result = await dispatchBifrostWithFallback(exec, input);
    // getExecutor("openai") returns DefaultExecutor which extends BaseExecutor
    // and returns the standard { response, url, headers, transformedBody } shape.
    expect(result).toBeDefined();
    expect(result.response).toBeInstanceOf(Response);
    expect(result.url).toContain("openai");

    // Only the legacy OpenAI executor may call fetch; Bifrost must be skipped.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])).toContain(
      "openai.com"
    );

    forceDeactivate("openai");
    resetProvider("openai");
  });

  it("reports an invalid legacy fetch result without dereferencing response.status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(undefined);
    const { forceActivate, forceDeactivate, resetProvider } =
      await import("../../open-sse/services/bifrostKillSwitch.ts");
    forceActivate("openai");

    const exec = new BifrostBackendExecutor("openai", {});
    const input = {
      model: "gpt-4o",
      body: { model: "gpt-4o", messages: [] },
      stream: false,
      credentials: { apiKey: "sk-test" },
    };

    await expect(dispatchBifrostWithFallback(exec, input)).rejects.toThrow(
      /Upstream fetch returned an invalid response/
    );

    forceDeactivate("openai");
    resetProvider("openai");
  });

  it("propagates non-kill-switch errors unchanged (no fallback for unrelated failures)", async () => {
    process.env.BIFROST_ENABLED = "0"; // isBifrostEnabled() returns false → throws "Bifrost is not enabled"
    globalThis.fetch = vi.fn();

    const exec = new BifrostBackendExecutor("openai", {});
    const input = {
      model: "gpt-4o",
      body: { model: "gpt-4o" },
      stream: false,
      credentials: {},
    };

    await expect(dispatchBifrostWithFallback(exec, input)).rejects.toThrow(
      /Bifrost is not enabled/
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("BifrostNoFallbackError surfaces a distinct, operator-readable error when no legacy fallback exists", () => {
    // The error name MUST be stable so callers can `instanceof` check it
    // for surfacing a clean 503 vs a generic 500.
    const err = new BifrostNoFallbackError("openai", "kill switch tripped");
    expect(err.name).toBe("BifrostNoFallbackError");
    expect(err.message).toContain("openai");
    expect(err.message).toContain("kill switch tripped");
    expect(err).toBeInstanceOf(Error);
  });
});
