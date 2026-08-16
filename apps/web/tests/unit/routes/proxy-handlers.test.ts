import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/bff", () => ({ bffUrl: (path: string) => new URL(`http://bff.test${path}`) }));

import { GET } from "../../../src/routes/api/bff/healthz/+server";
import { POST } from "../../../src/routes/api/v1/telemetry/web-vitals/+server";
import {
  DELETE as proxyDelete,
  GET as proxyGet,
  POST as proxyPost,
  PUT as proxyPut,
} from "../../../src/routes/api/[...path]/+server";

function responseCookies(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  return getSetCookie
    ? getSetCookie.call(headers)
    : [headers.get("set-cookie")].filter((cookie): cookie is string => cookie !== null);
}

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

  it("forwards a browser tRPC read with the BFF session and trusted request metadata", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://bff.test/api/trpc/providers.list?batch=1&input=%7B%7D");
      expect(init?.method).toBe("GET");
      const headers = new Headers(init?.headers);
      expect(headers.get("cookie")).toBe("session=browser-session");
      expect(headers.get("x-forwarded-proto")).toBe("https");
      expect(headers.get("x-forwarded-host")).toBe("renderer.test");
      expect(headers.get("x-forwarded-for")).toBe("203.0.113.7");
      expect(headers.get("x-request-id")).toBe("requestid123");
      return new Response('{"result":[]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const request = new Request(
      "https://renderer.test/api/trpc/providers.list?batch=1&input=%7B%7D",
      {
        headers: {
          cookie: "session=browser-session",
          "x-forwarded-for": "198.51.100.9",
          "x-forwarded-host": "spoofed.example",
          "x-forwarded-proto": "http",
          "x-request-id": "requestid123",
        },
      }
    );

    const response = await proxyGet({
      params: { path: "trpc/providers.list" },
      request,
      fetch,
      url: new URL(request.url),
      getClientAddress: () => "203.0.113.7",
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

  it("forwards PUT and DELETE requests with their bodies and preserves transport response headers", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("PUT");
      expect(await new Response(init?.body).text()).toBe('{"theme":"light"}');
      return new Response(null, {
        status: 201,
        headers: {
          location: "/api/dashboard/settings/next",
          "cache-control": "no-store",
          "retry-after": "30",
          "set-cookie": "session=updated-session; Path=/; HttpOnly",
        },
      });
    });
    const putRequest = new Request("https://renderer.test/api/dashboard/settings", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: "session=browser-session" },
      body: '{"theme":"light"}',
    });

    const putResponse = await proxyPut({
      params: { path: "dashboard/settings" },
      request: putRequest,
      fetch,
      url: new URL(putRequest.url),
      getClientAddress: () => "203.0.113.7",
    } as unknown as Parameters<typeof proxyPut>[0]);

    expect(putResponse.status).toBe(201);
    expect(putResponse.headers.get("location")).toBe("/api/dashboard/settings/next");
    expect(putResponse.headers.get("cache-control")).toBe("no-store");
    expect(putResponse.headers.get("retry-after")).toBe("30");

    const deleteFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("DELETE");
      expect(await new Response(init?.body).text()).toBe('{"reason":"logout"}');
      const headers = new Headers({ "cache-control": "no-store" });
      headers.append("set-cookie", "session=; Path=/; Max-Age=0");
      headers.append("set-cookie", "csrf=rotated-token; Path=/; SameSite=Lax");
      return new Response(null, { status: 204, headers });
    });
    const deleteRequest = new Request("https://renderer.test/api/dashboard/sessions/current", {
      method: "DELETE",
      headers: { "content-type": "application/json", cookie: "session=browser-session" },
      body: '{"reason":"logout"}',
    });

    const deleteResponse = await proxyDelete({
      params: { path: "dashboard/sessions/current" },
      request: deleteRequest,
      fetch: deleteFetch,
      url: new URL(deleteRequest.url),
      getClientAddress: () => "203.0.113.7",
    } as unknown as Parameters<typeof proxyDelete>[0]);

    expect(deleteResponse.status).toBe(204);
    expect(responseCookies(deleteResponse.headers)).toEqual([
      "session=; Path=/; Max-Age=0",
      "csrf=rotated-token; Path=/; SameSite=Lax",
    ]);
  });

  it("rejects route families that are not BFF-owned before fetching", async () => {
    const fetch = vi.fn();
    const request = new Request("http://renderer.test/api/v1/telemetry/web-vitals");

    await expect(
      proxyGet({
        params: { path: "v1/telemetry/web-vitals" },
        request,
        fetch,
        url: new URL(request.url),
      } as unknown as Parameters<typeof proxyGet>[0])
    ).rejects.toMatchObject({ status: 404 });

    expect(fetch).not.toHaveBeenCalled();
  });
});
