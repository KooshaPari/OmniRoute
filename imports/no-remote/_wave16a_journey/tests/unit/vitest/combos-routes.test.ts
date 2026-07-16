/**
 * Tests for `PUT /api/combos/[id]` and `POST /api/combos`.
 *
 * Invokes Next route handlers directly (no live server).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-combos-routes-"));
process.env.DATA_DIR = TEST_DATA_DIR;
delete process.env.AUTH_TOKEN;
process.env.DISABLE_SQLITE_AUTO_BACKUP = "true";

const core = await import("../../../src/lib/db/core.ts");
const { createCombo, getComboById } = await import("../../../src/lib/localDb.ts");
const listRoute = await import("../../../src/app/api/combos/route.ts");
const idRoute = await import("../../../src/app/api/combos/[id]/route.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

beforeAll(async () => {
  await core.ensureDbInitialized();
});

beforeEach(async () => {
  await resetStorage();
});

afterAll(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

async function callRoute(
  method: "GET" | "POST" | "PUT" | "DELETE",
  pathName: string,
  body?: unknown,
  rawBody?: string
): Promise<{ status: number; data: any }> {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
  };
  if (rawBody !== undefined) {
    init.body = rawBody;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const request = new Request(`http://127.0.0.1${pathName}`, init);
  const idMatch = pathName.match(/^\/api\/combos\/([^/?]+)/);
  let res: Response;
  if (pathName === "/api/combos" || pathName === "/api/combos/") {
    res = method === "POST" ? await listRoute.POST(request) : await listRoute.GET(request);
  } else if (idMatch) {
    const params = Promise.resolve({ id: decodeURIComponent(idMatch[1]!) });
    if (method === "GET") res = await idRoute.GET(request, { params });
    else if (method === "PUT") res = await idRoute.PUT(request, { params });
    else if (method === "DELETE") res = await idRoute.DELETE(request, { params });
    else throw new Error(`unsupported ${method} ${pathName}`);
  } else {
    throw new Error(`unsupported path ${pathName}`);
  }
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
  test("exports GET, PUT, DELETE", () => {
    expect(typeof idRoute.GET).toBe("function");
    expect(typeof idRoute.PUT).toBe("function");
    expect(typeof idRoute.DELETE).toBe("function");
  });
});

describe("combos/route.ts handlers are exported", () => {
  test("exports GET, POST", () => {
    expect(typeof listRoute.GET).toBe("function");
    expect(typeof listRoute.POST).toBe("function");
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
    const r = await callRoute("PUT", `/api/combos/${id}`, undefined, "{ this is not json");
    expect(r.status).toBe(400);
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
