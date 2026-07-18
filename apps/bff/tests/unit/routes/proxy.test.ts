import { afterEach, describe, expect, it, vi } from "vitest";

import { createAuthProxyRoutes, createProxyRoutes } from "../../../src/routes/proxy";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("proxy routes", () => {
  it("preserves routing, query, method, body, and rollout overrides", async () => {
    let forwardedBody = "";
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      forwardedBody = await new Response(init?.body).text();
      expect(String(url)).toBe("https://upstream.test/v1/chat/completions?stream=true");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("x-proxied-by")).toBe("argismonitor-bff");
      return new Response("upstream", { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const routes = createProxyRoutes({ upstream: "https://upstream.test/" });
    const response = await routes.request("http://localhost/api/v1/chat/completions?stream=true", {
      method: "POST",
      headers: { cookie: "web_stack=svelte", "content-type": "text/plain" },
      body: "request-body",
    });

    expect(response.status).toBe(201);
    expect(await response.text()).toBe("upstream");
    expect(forwardedBody).toBe("request-body");

    const nextResponse = await routes.request("http://localhost/api/v1/models", {
      headers: { cookie: "web_stack=next" },
    });
    expect(nextResponse.status).toBe(410);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves public auth paths without applying web-stack rollout", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("https://upstream.test/api/auth/callback?code=test");
      return new Response("ok");
    });
    vi.stubGlobal("fetch", fetchMock);

    const routes = createAuthProxyRoutes({ upstream: "https://upstream.test", rollout: 0 });
    const response = await routes.request("http://localhost/api/auth/callback?code=test", {
      headers: { cookie: "web_stack=next" },
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("removes hop-by-hop and connection-nominated headers in both directions", async () => {
    const upstreamHeaders = new Headers({
      connection: "x-upstream-remove",
      "keep-alive": "timeout=5",
      "x-upstream-remove": "private",
      "x-upstream-keep": "public",
    });
    upstreamHeaders.append("set-cookie", "session=abc; Path=/; HttpOnly");
    upstreamHeaders.append("set-cookie", "expires=later; Expires=Wed, 21 Oct 2026 07:28:00 GMT");
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("connection")).toBeNull();
      expect(headers.get("keep-alive")).toBeNull();
      expect(headers.get("x-request-remove")).toBeNull();
      expect(headers.get("x-request-keep")).toBe("public");
      return new Response("ok", { headers: upstreamHeaders });
    });
    vi.stubGlobal("fetch", fetchMock);

    const routes = createProxyRoutes({ upstream: "https://upstream.test" });
    const response = await routes.request("http://localhost/api/v1/models", {
      headers: {
        connection: "x-request-remove",
        "keep-alive": "timeout=5",
        "x-request-remove": "private",
        "x-request-keep": "public",
      },
    });

    expect(response.headers.get("connection")).toBeNull();
    expect(response.headers.get("keep-alive")).toBeNull();
    expect(response.headers.get("x-upstream-remove")).toBeNull();
    expect(response.headers.get("x-upstream-keep")).toBe("public");
    expect(response.headers.get("x-proxied-by")).toBe("argismonitor-bff");
    expect(response.headers.getSetCookie()).toEqual([
      "session=abc; Path=/; HttpOnly",
      "expires=later; Expires=Wed, 21 Oct 2026 07:28:00 GMT",
    ]);
  });

  it("returns the upstream stream without waiting for completion", async () => {
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));

    const routes = createProxyRoutes({ upstream: "https://upstream.test" });
    const response = await routes.request("http://localhost/api/v1/stream");
    const reader = response.body!.getReader();

    streamController.enqueue(new TextEncoder().encode("first"));
    const first = await reader.read();

    expect(new TextDecoder().decode(first.value)).toBe("first");
    expect(first.done).toBe(false);
    streamController.close();
  });

  it("propagates downstream cancellation to the upstream signal", async () => {
    let upstreamSignal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      upstreamSignal = init!.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        upstreamSignal.addEventListener("abort", () => reject(new Error("client_aborted")), { once: true });
      });
    }));

    const downstream = new AbortController();
    const routes = createProxyRoutes({ upstream: "https://upstream.test" });
    const responsePromise = routes.request(
      new Request("http://localhost/api/v1/stream", { signal: downstream.signal }),
    );
    await vi.waitFor(() => expect(upstreamSignal).toBeDefined());

    downstream.abort(new Error("client_aborted"));
    const response = await responsePromise;

    expect(upstreamSignal.aborted).toBe(true);
    expect(response.status).toBe(499);
    expect(await response.text()).toBe("");
  });

  it("does not start an already-aborted downstream request", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect((init?.signal as AbortSignal).aborted).toBe(true);
      throw new Error("sensitive-client-reason");
    });
    vi.stubGlobal("fetch", fetchMock);

    const downstream = new AbortController();
    downstream.abort(new Error("sensitive-client-reason"));
    const routes = createProxyRoutes({ upstream: "https://upstream.test" });
    const response = await routes.request(
      new Request("http://localhost/api/v1/models", { signal: downstream.signal }),
    );

    expect(response.status).toBe(499);
    expect(await response.text()).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("applies a bounded deadline with a stable timeout response", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      const signal = init!.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }));

    const routes = createProxyRoutes({ upstream: "https://upstream.test", timeoutMs: 50 });
    const responsePromise = routes.request("http://localhost/api/v1/slow");
    await vi.advanceTimersByTimeAsync(50);
    const response = await responsePromise;

    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({
      error: "upstream_timeout",
      message: "Upstream request timed out",
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
