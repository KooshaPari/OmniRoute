// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/components", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

vi.mock("@/lib/display/useProviderNodeMap", () => ({
  useProviderNodeMap: () => new Map(),
  resolveProviderName: (provider: string) => provider,
}));

const { default: ProviderStatsPage } =
  await import("../../../src/app/(dashboard)/dashboard/provider-stats/page");

const cleanupCallbacks: Array<() => void> = [];

function jsonResponse(data: unknown) {
  return { ok: true, json: async () => data } as Response;
}

async function waitForText(text: string, timeoutMs = 3000) {
  const startedAt = Date.now();
  while (!document.body.textContent?.includes(text)) {
    if (Date.now() - startedAt > timeoutMs) throw new Error(`Timed out waiting for ${text}`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
}

describe("ProviderStatsPage Bifrost connection metrics", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/observability/bifrost-route-metrics") {
        return Promise.resolve(
          jsonResponse({
            metrics: [
              {
                provider: "openai",
                model: "gpt-4o-mini",
                connectionId: "connection-a",
                e2eLatencyMs: 100,
                failureRate: 0,
                sampleCount: 1,
                avgTtftMs: null,
                avgTokensPerSecond: null,
                updatedAtMs: 1,
              },
              {
                provider: "openai",
                model: "gpt-4o-mini",
                connectionId: null,
                e2eLatencyMs: 120,
                failureRate: 0,
                sampleCount: 1,
                avgTtftMs: null,
                avgTokensPerSecond: null,
                updatedAtMs: 2,
              },
            ],
          })
        );
      }
      if (url === "/api/provider-stats") {
        return Promise.resolve(
          jsonResponse({
            providers: [],
            models: [],
            comboMetrics: {},
            telemetry: {},
            toolLatency: {},
          })
        );
      }
      return Promise.resolve(jsonResponse({ nodes: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    while (cleanupCallbacks.length) cleanupCallbacks.pop()?.();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("renders separate connection and shared legacy labels for identical provider-model routes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanupCallbacks.push(() => {
      act(() => root.unmount());
      container.remove();
    });

    await act(async () => {
      root.render(<ProviderStatsPage />);
    });

    await waitForText("connection-a");
    expect(document.body.textContent).toContain("Connection: connection-a");
    expect(document.body.textContent).toContain("Connection: Shared / legacy");
    expect(document.body.textContent).toContain("2 routes");
  });
});
