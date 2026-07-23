import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const API_KEY = "production-bff-key-1234";
let app: (typeof import("./index"))["default"];

beforeAll(async () => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("BFF_API_KEY", API_KEY);
  vi.stubEnv("BFF_CORS_ORIGINS", "http://localhost:4321,https://app.example.com");
  app = (await import("./index")).default;
}, 60_000);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("BFF production security boundary", () => {
  it("protects dashboard and tRPC routes while leaving bounded telemetry public", async () => {
    const anonymousDashboard = await app.request("http://localhost/api/dashboard/providers");
    expect(anonymousDashboard.status).toBe(401);

    const authenticatedDashboard = await app.request("http://localhost/api/dashboard/providers", {
      headers: { authorization: `Bearer ${API_KEY}` },
    });
    expect(authenticatedDashboard.status).toBe(200);

    const sessionDashboard = await app.request("http://localhost/api/dashboard/providers", {
      headers: { cookie: "session=browser-session-token" },
    });
    expect(sessionDashboard.status).toBe(200);

    const anonymousTrpc = await app.request("http://localhost/api/trpc/health");
    expect(anonymousTrpc.status).toBe(401);

    const authenticatedTrpc = await app.request("http://localhost/api/trpc/health", {
      headers: { authorization: `Bearer ${API_KEY}` },
    });
    expect(authenticatedTrpc.status).toBe(200);

    const sessionTrpc = await app.request("http://localhost/api/trpc/health", {
      headers: { cookie: "session=browser-session-token" },
    });
    expect(sessionTrpc.status).toBe(200);

    const telemetry = await app.request("http://localhost/api/v1/telemetry/web-vitals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "public-web-vital",
        name: "LCP",
        value: 1,
        rating: "good",
        delta: 1,
        navigationType: "navigate",
        ts: 1,
      }),
    });
    expect(telemetry.status).toBe(202);
  });

  it("forwards the public auth route without rewriting it to /v1", async () => {
    const upstreamFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await app.request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "secret" }),
    });

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledOnce();
    expect(upstreamFetch.mock.calls[0]?.[0]).toBe("http://localhost:20128/api/auth/login");
  });

  it("forwards auth callback Set-Cookie and accepts the session on dashboard", async () => {
    const upstreamHeaders = new Headers({ "content-type": "application/json" });
    upstreamHeaders.append("set-cookie", "session=callback-session-abc; Path=/; HttpOnly");
    const upstreamFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: upstreamHeaders }),
    );

    const callback = await app.request("http://localhost/api/auth/callback?code=test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "test", state: "s" }),
    });
    expect(callback.status).toBe(200);
    expect(upstreamFetch.mock.calls[0]?.[0]).toBe("http://localhost:20128/api/auth/callback?code=test");
    expect(callback.headers.getSetCookie()).toEqual([
      "session=callback-session-abc; Path=/; HttpOnly",
    ]);

    const followUp = await app.request("http://localhost/api/dashboard/providers", {
      headers: { cookie: "session=callback-session-abc" },
    });
    expect(followUp.status).toBe(200);
  });
});
