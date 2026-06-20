/**
 * Regression tests for `PUT /api/combos/[id]` and `POST /api/combos`.
 *
 * Pre-fix behavior (commit `05924441a` deleted `src/app/api/combos/route.ts`
 * and `src/app/api/combos/[id]/route.ts`):
 *   - Any combo save via the GUI returned a Next.js 404
 *   - The 404 was rendered as 400 in some MetaMask/SSE noise layers
 *   - The "MaxListenersExceededWarning" + ObjectMultiplex "orphaned data"
 *     warnings in the browser console were the side-effect
 *
 * Post-fix behavior (L5-121):
 *   - The routes are restored at the original paths
 *   - The `comboRuntimeConfigSchema` `.strict()` mode is preserved
 *   - Unknown keys in `body.config` are stripped before validation
 *     via `sanitizeComboRuntimeConfig` in the route (avoids 400 on
 *     legacy combos with fields the new schema doesn't enumerate)
 *   - Legacy `compressionOverride` (top-level) still moves into
 *     `config.compressionMode` (existing convention)
 *
 * Run with:
 *   DISABLE_SQLITE_AUTO_BACKUP=true AUTH_TOKEN=test-token \
 *     bun test tests/unit/combos-routes-regression.test.ts
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

describe("regression: combos routes restored after 05924441a deletion", () => {
  test("route file present and exports PUT/GET/DELETE", async () => {
    const route = await import("../../src/app/api/combos/[id]/route.ts");
    expect(typeof route.GET).toBe("function");
    expect(typeof route.PUT).toBe("function");
    expect(typeof route.DELETE).toBe("function");
  });

  test("main route file present and exports GET/POST", async () => {
    const route = await import("../../src/app/api/combos/route.ts");
    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
  });

  test("PUT { isActive: false } toggles active state and returns 200", async () => {
    const id = await seedCombo(`toggle-${Date.now()}`);
    const r = await callRoute("PUT", `/api/combos/${id}`, { isActive: false });
    expect(r.status).toBe(200);
    const combo = await getComboById(id);
    expect(combo?.isActive).toBe(false);
  });

  test("PUT with unknown field in config no longer returns 400 (sanitized)", async () => {
    const id = await seedCombo(`unknown-${Date.now()}`);
    const r = await callRoute("PUT", `/api/combos/${id}`, {
      config: {
        compressionMode: "lite",
        maxRetries: 2,
        unknownFieldFromLegacyDB: "ignored",
        caching: { strategy: "aggressive" },
      } as any,
    });
    // Pre-fix: 400 ("Unrecognized key: unknownFieldFromLegacyDB")
    // Post-fix: 200 (unknown keys are stripped before validation)
    expect(r.status).toBe(200);
    const combo = await getComboById(id);
    // (compressionMode + maxRetries are kept; unknownFieldFromLegacyDB + caching are dropped)
    expect((combo?.config as any)?.compressionMode).toBe("lite");
    expect((combo?.config as any)?.maxRetries).toBe(2);
    expect((combo?.config as any)?.unknownFieldFromLegacyDB).toBeUndefined();
  });

  test("PUT with zero-latency config returns 400 with structured error (no opt-in)", async () => {
    const id = await seedCombo(`zero-lat-${Date.now()}`);
    const r = await callRoute("PUT", `/api/combos/${id}`, {
      config: {
        hedging: true,
      } as any,
    });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.data)).toMatch(/zeroLatencyOptimizationsEnabled/);
  });

  test("PUT with zero-latency opt-in flag succeeds", async () => {
    const id = await seedCombo(`zero-optin-${Date.now()}`);
    const r = await callRoute("PUT", `/api/combos/${id}`, {
      config: {
        hedging: true,
        zeroLatencyOptimizationsEnabled: true,
      } as any,
    });
    expect(r.status).toBe(200);
  });

  test("PUT with legacy top-level compressionOverride migrates to config.compressionMode", async () => {
    const id = await seedCombo(`override-${Date.now()}`);
    const r = await callRoute("PUT", `/api/combos/${id}`, {
      compressionOverride: "lite",
    });
    expect(r.status).toBe(200);
    const combo = await getComboById(id);
    expect((combo?.config as any)?.compressionMode).toBe("lite");
  });

  test("PUT with compressionOverride: null clears the override (set to 'off')", async () => {
    const id = await seedCombo(`override-null-${Date.now()}`);
    await callRoute("PUT", `/api/combos/${id}`, { compressionOverride: "lite" });
    const r = await callRoute("PUT", `/api/combos/${id}`, { compressionOverride: null });
    expect(r.status).toBe(200);
    const combo = await getComboById(id);
    expect((combo?.config as any)?.compressionMode).toBe("off");
  });

  test("PUT with invalid JSON body returns 400 with 'Invalid JSON body'", async () => {
    const id = await seedCombo(`badjson-${Date.now()}`);
    const res = await fetch(`${BASE}/api/combos/${id}`, {
      method: "PUT",
      headers: AUTH,
      body: "{ this is not json",
    });
    expect(res.status).toBe(400);
  });

  test("PUT on missing combo returns 404 (not 400)", async () => {
    const r = await callRoute("PUT", "/api/combos/does-not-exist-uuid", {
      isActive: true,
    });
    expect(r.status).toBe(404);
  });

  test("DELETE removes a combo and returns 200", async () => {
    const id = await seedCombo(`delete-${Date.now()}`);
    const r = await callRoute("DELETE", `/api/combos/${id}`);
    expect(r.status).toBe(200);
    const combo = await getComboById(id);
    expect(combo).toBeNull();
  });

  test("GET returns the combo by id", async () => {
    const id = await seedCombo(`get-${Date.now()}`);
    const r = await callRoute("GET", `/api/combos/${id}`);
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(id);
  });

  test("POST creates a new combo (main route restored)", async () => {
    const name = `create-${Date.now()}`;
    const r = await callRoute("POST", "/api/combos", {
      name,
      models: [{ provider: "openai", model: "gpt-4o", weight: 100 }],
      strategy: "priority",
    });
    expect(r.status).toBe(200);
    expect(r.data.name).toBe(name);
  });

  test("GET on main route lists all combos", async () => {
    const r = await callRoute("GET", "/api/combos");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data)).toBe(true);
  });
});
