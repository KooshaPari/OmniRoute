import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted() runs BEFORE vi.mock() factories (which are themselves hoisted),
// so the mock state needs to live here.
const { executorsByName, getExecutorMock } = vi.hoisted(() => {
  const map = new Map<string, { execute: ReturnType<typeof vi.fn> }>();
  const mock = vi.fn((name: string) => {
    let e = map.get(name);
    if (!e) {
      e = { execute: vi.fn() };
      map.set(name, e);
    }
    return e;
  });
  return { executorsByName: map, getExecutorMock: mock };
});

// Mock comboContextCache BEFORE the SUT imports it. The SUT calls
// getUpstreamProxyConfigCached(prov) and the mock below is provider-aware so
// each test can configure a different routing strategy per provider.
vi.mock("../comboContextCache", () => ({
  getUpstreamProxyConfigCached: vi.fn(),
}));

// The settings cache is mocked to avoid touching disk/SQLite.
vi.mock("@/lib/db/readCache", () => ({
  getCachedSettings: vi.fn(),
}));

// Mock the executors registry so we don't pull in the full executor graph.
// The mock returns a stable object per provider name (mirroring the real
// lookup-based registry), with a controllable execute function.
vi.mock("../../../executors/index", () => ({
  getExecutor: getExecutorMock,
}));

import {
  resolveExecutorWithProxy,
  isRetryableStatus,
  DEFAULT_CLIPROXYAPI_FALLBACK_CODES,
} from "../resolveExecutorProxy";
import { getUpstreamProxyConfigCached } from "../comboContextCache";
import { getCachedSettings } from "@/lib/db/readCache";
import { getExecutor } from "../../../executors/index";

const proxyMock = vi.mocked(getUpstreamProxyConfigCached);
const settingsMock = vi.mocked(getCachedSettings);
const registryMock = vi.mocked(getExecutor);

beforeEach(() => {
  vi.clearAllMocks();
  executorsByName.clear();
  // Default: native mode (matches comboContextCache.ts default).
  proxyMock.mockImplementation(async (prov: string) => ({
    provider: prov,
    enabled: false,
    mode: "native" as const,
  }));
  settingsMock.mockResolvedValue({} as Awaited<ReturnType<typeof getCachedSettings>>);
});

describe("resolveExecutorWithProxy", () => {
  it("returns the native executor when proxy routing is disabled", async () => {
    const wrapper = await resolveExecutorWithProxy("openai");
    expect(wrapper).toBeDefined();
    expect(wrapper.execute).toBeDefined();
    expect(registryMock).toHaveBeenCalledWith("openai");
  });

  it("returns the native executor when mode is 'native'", async () => {
    proxyMock.mockResolvedValueOnce({
      provider: "openai",
      enabled: true,
      mode: "native" as const,
    });
    const wrapper = await resolveExecutorWithProxy("openai");
    // Same identity as the registered executor for "openai".
    expect(wrapper.execute).toBe(registryMock.mock.results[0]?.value.execute);
  });

  it("routes through CLIProxyAPI when mode is 'cliproxyapi'", async () => {
    proxyMock.mockResolvedValueOnce({
      provider: "openai",
      enabled: true,
      mode: "cliproxyapi" as const,
    });
    await resolveExecutorWithProxy("openai");
    expect(registryMock).toHaveBeenCalledWith("cliproxyapi");
  });

  it("builds a fallback wrapper when mode is 'fallback'", async () => {
    proxyMock.mockResolvedValueOnce({
      provider: "openai",
      enabled: true,
      mode: "fallback" as const,
    });
    const wrapper = await resolveExecutorWithProxy("openai");
    // The fallback wrapper is a *new* object — not the same identity as either
    // registered executor. We just verify that .execute is a function.
    expect(typeof wrapper.execute).toBe("function");
    expect(registryMock).toHaveBeenCalledWith("openai");
    expect(registryMock).toHaveBeenCalledWith("cliproxyapi");
  });

  it("does not consult the settings cache when proxy routing is disabled", async () => {
    await resolveExecutorWithProxy("openai");
    expect(settingsMock).not.toHaveBeenCalled();
  });

  it("does not consult the settings cache in cliproxyapi passthrough mode", async () => {
    proxyMock.mockResolvedValueOnce({
      provider: "openai",
      enabled: true,
      mode: "cliproxyapi" as const,
    });
    await resolveExecutorWithProxy("openai");
    expect(settingsMock).not.toHaveBeenCalled();
  });

  it("consults the settings cache in fallback mode (for readCliproxyapiFallbackCodes)", async () => {
    proxyMock.mockResolvedValueOnce({
      provider: "openai",
      enabled: true,
      mode: "fallback" as const,
    });
    await resolveExecutorWithProxy("openai");
    expect(settingsMock).toHaveBeenCalledTimes(1);
  });
});

describe("isRetryableStatus", () => {
  it("returns true for status 0 (exception path)", () => {
    expect(isRetryableStatus(0)).toBe(true);
  });

  it("returns true for every default fallback code", () => {
    for (const code of DEFAULT_CLIPROXYAPI_FALLBACK_CODES) {
      expect(isRetryableStatus(code)).toBe(true);
    }
  });

  it("returns false for non-fallback 4xx codes", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });

  it("returns false for non-fallback 2xx success codes", () => {
    expect(isRetryableStatus(200)).toBe(false);
    expect(isRetryableStatus(201)).toBe(false);
    expect(isRetryableStatus(204)).toBe(false);
  });

  it("honors a custom fallback-code list", () => {
    expect(isRetryableStatus(418, [418])).toBe(true);
    expect(isRetryableStatus(429, [418])).toBe(false);
  });
});

describe("DEFAULT_CLIPROXYAPI_FALLBACK_CODES", () => {
  it("is frozen", () => {
    expect(Object.isFrozen(DEFAULT_CLIPROXYAPI_FALLBACK_CODES)).toBe(true);
  });

  it("contains the documented retryable codes", () => {
    expect(DEFAULT_CLIPROXYAPI_FALLBACK_CODES).toEqual([429, 500, 502, 503, 504]);
  });
});
