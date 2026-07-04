/**
 * Tests for `PUT /api/combos/[id]` and `POST /api/combos`.
 *
 * Restored routes (L5-121, commit `9093a241a`):
 *   - `src/app/api/combos/route.ts` (GET, POST)
 *   - `src/app/api/combos/[id]/route.ts` (GET, PUT, DELETE)
 *
 * The GUI's combos page (`src/app/(dashboard)/dashboard/combos/page.tsx`)
 * still issues fetch calls to these legacy paths; the routes must remain
 * in place until the GUI migrates to `/v1/combos` + `/api/combos/auto`.
 *
 * This is the canonical test file. The earlier-named
 * `combos-routes-regression.test.ts` was created during the L5-121
 * investigation; this file is the merged, definitive set of 13 cases.
 *
 * Run with:
 *   DISABLE_SQLITE_AUTO_BACKUP=true AUTH_TOKEN=test-token \
 *     bun test tests/unit/combos-routes.test.ts
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ensureDbInitialized, resetDbInstance } from "@/lib/db/stateReset";
import { createCombo, getComboById } from "@/lib/localDb";

const BASE = "http://localhost:3000";
const AUTH = { "Content-Type": "application/json", "X-Forwarded-For": "127.0.0.1" };

beforeAll(async () => {
  process.env.AUTH_TOKEN = "test-token";
  process.env.DISABLE_SQLITE_AUTO_BACKUP = "true";
  await ensureDbInitialized();
});

afterAll(async () => {
  await resetDbInstance();
});

async function callRoute(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: AUTH,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* keep as text */
  }
  return { status: res.status, data };
}

async function seedCombo(name: string, extras: Record<string, unknown> = {}) {
  const id = await createCombo({
    name,
    models: [{ provider: "openai", model: "gpt-4o", weight: 100 }],
    strategy: "priority",
    config: { compressionMode: "off", maxRetries: 1 },
    ...extras,
  } as any);
  return id as string;
}

describe("[id]/route.ts handlers are exported", () => {
  test("exports GET, PUT, DELETE", async () => {
    const route = await import("../../src/app/api/combos/[id]/route.ts");
    expect(typeof route.GET).toBe("function");
    expect(typeof route.PUT).toBe("function");
    expect(typeof route.DELETE).toBe("function");
  });
});

describe("combos/route.ts handlers are exported", () => {
  test("exports GET, POST", async () => {
    const route = await import("../../src/app/api/combos/route.ts");
    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
  });
});

describe("PUT /api/combos/[id] — happy paths (200)", () => {
  test("toggles isActive", async () => {
    const id = await seedCombo(`toggle-${Date.now()}`);
    const r = await callRoute("PUT", `/api/combos/${id}`, { isActive: false });
    expect(r.status).toBe(200);
    const combo = await getComboById(id);
    expect(combo?.isActive).toBe(false);
  });

  test("strips unknown config keys (the .strict() 400 fix)", async () => {
    const id = await seedCombo(`unknown-${Date.now()}`);
    const r = await callRoute("PUT", `/api/combos/${id}`, {
      config: {
        compressionMode: "lite",
        maxRetries: 2,
        unknownFieldFromLegacyDB: "ignored",
        caching: { strategy: "aggressive" },
      } as any,
    });
    expect(r.status).toBe(200);
    const combo = await getComboById(id);
    expect((combo?.config as any)?.compressionMode).toBe("lite");
    expect((combo?.config as any)?.maxRetries).toBe(2);
    expect((combo?.config as any)?.unknownFieldFromLegacyDB).toBeUndefined();
  });

  test("zero-latency config with opt-in flag succeeds", async () => {
    const id = await seedCombo(`zero-optin-${Date.now()}`);
    const r = await callRoute("PUT", `/api/combos/${id}`, {
      config: {
        hedging: true,
        zeroLatencyOptimizationsEnabled: true,
      } as any,
    });
    expect(r.status).toBe(200);
  });

  test("legacy top-level compressionOverride migrates to config.compressionMode", async () => {
    const id = await seedCombo(`override-${Date.now()}`);
    const r = await callRoute("PUT", `/api/combos/${id}`, {
      compressionOverride: "lite",
    });
    expect(r.status).toBe(200);
    const combo = await getComboById(id);
    expect((combo?.config as any)?.compressionMode).toBe("lite");
  });

  test("compressionOverride: null clears the override (sets to 'off')", async () => {
    const id = await seedCombo(`override-null-${Date.now()}`);
    await callRoute("PUT", `/api/combos/${id}`, { compressionOverride: "lite" });
    const r = await callRoute("PUT", `/api/combos/${id}`, { compressionOverride: null });
    expect(r.status).toBe(200);
    const combo = await getComboById(id);
    expect((combo?.config as any)?.compressionMode).toBe("off");
  });
});

describe("PUT /api/combos/[id] — 400 triggers", () => {
  test("zero-latency config without opt-in returns 400 with structured error", async () => {
    const id = await seedCombo(`zero-lat-${Date.now()}`);
    const r = await callRoute("PUT", `/api/combos/${id}`, {
      config: { hedging: true } as any,
    });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.data)).toMatch(/zeroLatencyOptimizationsEnabled/);
  });

  test("invalid JSON body returns 400 with 'Invalid JSON body'", async () => {
    const id = await seedCombo(`badjson-${Date.now()}`);
    const res = await fetch(`${BASE}/api/combos/${id}`, {
      method: "PUT",
      headers: AUTH,
      body: "{ this is not json",
    });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/combos/[id] — 404 paths", () => {
  test("missing combo returns 404 (not 400)", async () => {
    const r = await callRoute("PUT", "/api/combos/does-not-exist-uuid", {
      isActive: true,
    });
    expect(r.status).toBe(404);
  });
});

describe("DELETE /api/combos/[id]", () => {
  test("removes a combo and returns 200", async () => {
    const id = await seedCombo(`delete-${Date.now()}`);
    const r = await callRoute("DELETE", `/api/combos/${id}`);
    expect(r.status).toBe(200);
    const combo = await getComboById(id);
    expect(combo).toBeNull();
  });
});

describe("GET /api/combos/[id]", () => {
  test("returns the combo by id", async () => {
    const id = await seedCombo(`get-${Date.now()}`);
    const r = await callRoute("GET", `/api/combos/${id}`);
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(id);
  });
});

describe("POST /api/combos", () => {
  test("creates a new combo", async () => {
    const name = `create-${Date.now()}`;
    const r = await callRoute("POST", "/api/combos", {
      name,
      models: [{ provider: "openai", model: "gpt-4o", weight: 100 }],
      strategy: "priority",
    });
    expect(r.status).toBe(200);
    expect(r.data.name).toBe(name);
  });
});

describe("GET /api/combos", () => {
  test("lists all combos", async () => {
    const r = await callRoute("GET", "/api/combos");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data)).toBe(true);
  });
});
