import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const API_KEY = "production-bff-key-1234";
let app: (typeof import("./index"))["default"];

beforeAll(async () => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("BFF_API_KEY", API_KEY);
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

    const anonymousTrpc = await app.request("http://localhost/api/trpc/health");
    expect(anonymousTrpc.status).toBe(401);

    const authenticatedTrpc = await app.request("http://localhost/api/trpc/health", {
      headers: { authorization: `Bearer ${API_KEY}` },
    });
    expect(authenticatedTrpc.status).toBe(200);

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
});
