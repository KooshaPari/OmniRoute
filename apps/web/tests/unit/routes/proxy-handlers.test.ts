import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/bff", () => ({ bffUrl: (path: string) => new URL(`http://bff.test${path}`) }));

import { GET } from "../../../src/routes/api/bff/healthz/+server";
import { POST } from "../../../src/routes/api/v1/telemetry/web-vitals/+server";
import { GET as proxyGet, POST as proxyPost } from "../../../src/routes/api/[...path]/+server";

describe("typed proxy route handlers", () => {
  it("preserves the BFF health response", async () => {
    const fetch = vi.fn(
      async () =>
        new Response('{"ok":true}', {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    const response = await GET({ fetch } as unknown as Parameters<typeof GET>[0]);

    expect(fetch).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"ok":true}');
  });

  it("preserves the telemetry request body", async () => {
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Response(init?.body, { status: 202, headers: { "content-type": "application/json" } })
    );
    const request = new Request("http://localhost/api/v1/telemetry/web-vitals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"name":"LCP","value":1}',
    });
    const response = await POST({ request, fetch } as unknown as Parameters<typeof POST>[0]);

    expect(fetch).toHaveBeenCalledOnce();
    expect(response.status).toBe(202);
    expect(await response.text()).toBe('{"name":"LCP","value":1}');
  });

  it("rejects telemetry without content-type as 415", async () => {
    const request = new Request("http://localhost/api/v1/telemetry/web-vitals", {
      method: "POST",
      body: '{"name":"LCP","value":1}',
    });

    await expect(
      POST({ request, fetch: vi.fn() } as unknown as Parameters<typeof POST>[0])
    ).rejects.toMatchObject({ status: 415 });
  });

  it("forwards a browser tRPC read with its session cookie to the BFF", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://bff.test/api/trpc/providers.list?batch=1&input=%7B%7D");
      expect(init?.method).toBe("GET");
      expect(new Headers(init?.headers).get("cookie")).toBe("session_id=browser-session");
      return new Response('{"result":[]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const request = new Request(
      "http://renderer.test/api/trpc/providers.list?batch=1&input=%7B%7D",
      {
        headers: { cookie: "session_id=browser-session" },
      }
    );

    const response = await proxyGet({
      params: { path: "trpc/providers.list" },
      request,
      fetch,
      url: new URL(request.url),
    } as unknown as Parameters<typeof proxyGet>[0]);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"result":[]}');
  });

  it("forwards a dashboard mutation body and session cookie to the BFF", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://bff.test/api/dashboard/settings");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
      expect(new Headers(init?.headers).get("cookie")).toBe("session_id=browser-session");
      expect(await new Response(init?.body).text()).toBe('{"theme":"dark"}');
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const request = new Request("http://renderer.test/api/dashboard/settings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "session_id=browser-session",
      },
      body: '{"theme":"dark"}',
    });

    const response = await proxyPost({
      params: { path: "dashboard/settings" },
      request,
      fetch,
      url: new URL(request.url),
    } as unknown as Parameters<typeof proxyPost>[0]);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"ok":true}');
  });

  it("preserves an auth callback session cookie from the BFF", async () => {
    const fetch = vi.fn(async () => {
      const headers = new Headers({ "content-type": "application/json" });
      headers.append("set-cookie", "session=callback-session; Path=/; HttpOnly; SameSite=Lax");
      return new Response('{"ok":true}', { status: 200, headers });
    });
    const request = new Request("http://renderer.test/api/auth/callback?code=one-time-code");

    const response = await proxyGet({
      params: { path: "auth/callback" },
      request,
      fetch,
      url: new URL(request.url),
    } as unknown as Parameters<typeof proxyGet>[0]);

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("session=callback-session");
  });
});
