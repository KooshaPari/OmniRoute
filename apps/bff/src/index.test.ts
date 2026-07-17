import { describe, expect, it } from "vitest";

import app from "./index";

describe("BFF health endpoint", () => {
  it("reports the service as healthy", async () => {
    const response = await app.request("http://localhost/healthz");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "argismonitor-bff",
    });
  });
});

describe("BFF web-vitals endpoint", () => {
  const metric = {
    id: "journey-metric-1",
    name: "LCP",
    value: 123.4,
    rating: "good",
    delta: 123.4,
    navigationType: "navigate",
    ts: 1,
  };

  it("accepts a bounded valid metric", async () => {
    const response = await app.request("http://localhost/api/v1/telemetry/web-vitals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(metric),
    });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ accepted: true, id: metric.id });
  });

  it("rejects invalid content types and schemas", async () => {
    const wrongType = await app.request("http://localhost/api/v1/telemetry/web-vitals", {
      method: "POST",
      body: JSON.stringify(metric),
    });
    expect(wrongType.status).toBe(415);
    const invalid = await app.request("http://localhost/api/v1/telemetry/web-vitals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...metric, name: "SECRET" }),
    });
    expect(invalid.status).toBe(400);
  });

  it("rejects oversized payloads", async () => {
    const response = await app.request("http://localhost/api/v1/telemetry/web-vitals", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "4097" },
      body: "{}",
    });
    expect(response.status).toBe(413);
  });
});

describe("BFF observability placeholders", () => {
  it.each([
    "/api/dashboard/observability/overview",
    "/api/dashboard/observability/timeseries",
    "/api/dashboard/observability/top-endpoints",
    "/api/dashboard/performance",
    "/api/dashboard/cache",
    "/api/dashboard/compression/stats",
    "/api/dashboard/diagnostics/full",
    "/api/dashboard/keys/test-key/usage",
    "/api/dashboard/sessions",
    "/api/dashboard/keys/test-key",
  ])("does not present fabricated telemetry from %s", async (path) => {
    const response = await app.request(`http://localhost${path}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; source: string };
    expect(body.status).toBe("unavailable");
    expect(body.source).toMatch(/^no-/);
  });

  it.each([
    ["/api/dashboard/keys", { name: "test" }],
    ["/api/dashboard/keys-rotation", {}],
  ])("does not fabricate key material from POST %s", async (path, payload) => {
    const response = await app.request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; source: string; key?: unknown; newKey?: unknown };
    expect(body.status).toBe("unavailable");
    expect(body.source).toBe("no-key-store");
    expect("key" in body ? body.key : body.newKey).toBeNull();
  });

  it("does not pretend to revoke a key without a key store", async () => {
    const response = await app.request("http://localhost/api/dashboard/keys/test-key/revoke", { method: "POST" });
    const body = (await response.json()) as { ok: boolean; status: string; source: string };
    expect(body).toMatchObject({ ok: false, status: "unavailable", source: "no-key-store" });
  });
});
