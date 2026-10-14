// @vitest-environment jsdom
/**
 * #13245 — the web-search mini-playground must send the selected provider in the
 * request BODY (`provider`), not only in the `x-connection-id` header: the
 * /api/v1/search route selects the provider from body.provider and otherwise
 * silently falls back to the default provider.
 *
 * This exercises the real component. `buildBody()` is a local closure inside
 * WebSearchExampleCard, so it is reached by rendering the card and clicking Run,
 * then inspecting the fetch() call the component makes. A prior synthetic test
 * (tests/unit/search-provider-body-13245.test.ts) only re-implemented buildBody
 * and therefore cannot fail if the component regresses.
 */

import React from "react";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/components", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/app/(dashboard)/dashboard/providers/hooks/useApiKey", () => ({
  useApiKey: () => ({ apiKey: "", setApiKey: () => {}, keys: [], loading: false }),
}));

import { WebSearchExampleCard } from "@/app/(dashboard)/dashboard/media-providers/components/WebSearchExampleCard";

const PROVIDER_ID = "brave-search";
const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

describe("WebSearchExampleCard sends provider in the request body (#13245)", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("includes body.provider === providerId when Run posts to /api/v1/search", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<WebSearchExampleCard providerId={PROVIDER_ID} />);

    const runButton = screen.getByRole("button", { name: /Run/i });
    fireEvent.click(runButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/search");
    expect(init.method).toBe("POST");

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    // The branch behavior: the provider id travels in the body so the route
    // resolves it explicitly instead of defaulting.
    expect(body.provider).toBe(PROVIDER_ID);
    // Pre-existing fields remain intact.
    expect(typeof body.query).toBe("string");
    expect(body.max_results).toBe(5);

    // The header is retained for call-log attribution.
    const headers = init.headers as Record<string, string>;
    expect(headers["x-connection-id"]).toBe(PROVIDER_ID);
  });
});
