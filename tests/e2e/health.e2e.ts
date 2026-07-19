/**
 * E2E: Health Endpoint
 *
 * Verifies that the Next.js health/ping route handler returns 200
 * when the database is alive, and 503 when it is not.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database ping — must be declared before the route import
vi.mock("@/lib/db/core", () => ({
  pingDb: vi.fn(),
}));

import { GET } from "@/app/api/health/ping/route";
import { pingDb } from "@/lib/db/core";

const mockPingDb = vi.mocked(pingDb);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("E2E: /api/health/ping", () => {
  it("returns 200 with status ok when database is alive", async () => {
    mockPingDb.mockReturnValue(true);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("latencyMs");
    expect(typeof body.latencyMs).toBe("number");
  });

  it("returns 503 when database ping fails", async () => {
    mockPingDb.mockReturnValue(false);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("error");
    expect(body.error).toBe("db_query_failed");
  });

  it("returns 503 when the handler throws unexpectedly", async () => {
    mockPingDb.mockImplementation(() => {
      throw new Error("unexpected db crash");
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("error");
    expect(body.error).toBe("ping_failed");
  });

  it("sets no-store cache-control header on success", async () => {
    mockPingDb.mockReturnValue(true);

    const res = await GET();

    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
