import { afterEach, describe, expect, it, vi } from "vitest";

import { dashboardRoutes } from "../../../src/routes/dashboard";

type RouteEntry = { method: string; path: string };

function collectRouteManifest(): RouteEntry[] {
  const seen = new Set<string>();
  const manifest: RouteEntry[] = [];
  for (const route of dashboardRoutes.routes ?? []) {
    const key = `${route.method} ${route.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    manifest.push({ method: route.method, path: route.path });
  }
  return manifest.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

function parseSseBlock(block: string) {
  const lines = block.split("\n").filter(Boolean);
  const event: { id?: string; event?: string; data?: string } = {};
  for (const line of lines) {
    if (line.startsWith("id:")) event.id = line.slice(3).trim();
    else if (line.startsWith("event:")) event.event = line.slice(6).trim();
    else if (line.startsWith("data:")) event.data = line.slice(5).trim();
  }
  return event;
}

async function readSseEvents(
  response: Response,
  {
    stopAfter,
    onEvent,
  }: {
    stopAfter?: number;
    onEvent?: (event: ReturnType<typeof parseSseBlock>) => void | Promise<void>;
  } = {},
) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: ReturnType<typeof parseSseBlock>[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let splitAt = buffer.indexOf("\n\n");
    while (splitAt !== -1) {
      const block = buffer.slice(0, splitAt);
      buffer = buffer.slice(splitAt + 2);
      if (block.trim()) {
        const parsed = parseSseBlock(block);
        events.push(parsed);
        await onEvent?.(parsed);
        if (stopAfter !== undefined && events.length >= stopAfter) {
          await reader.cancel();
          return events;
        }
      }
      splitAt = buffer.indexOf("\n\n");
    }
  }
  return events;
}

const VALID_PROVIDER = {
  id: "prov-1",
  name: "Test Provider",
  type: "openai",
  config: {},
};

const VALID_COMBO = {
  id: "combo-1",
  name: "Test Combo",
  primary: "claude-sonnet-4",
  fallbacks: [],
  strategy: "first-success",
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("dashboard route manifest", () => {
  it("registers the current unique method-path manifest", () => {
    const manifest = collectRouteManifest();
    expect(manifest).toMatchSnapshot();
    expect(manifest).toHaveLength(59);
  });
});

describe("dashboard route contracts", () => {
  it("returns the health envelope", async () => {
    const response = await dashboardRoutes.request("http://localhost/health");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["status", "ts"]);
    expect(body.status).toBe("healthy");
  });

  it("fails closed for unavailable combo persistence", async () => {
    const response = await dashboardRoutes.request("http://localhost/combos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_COMBO),
    });
    expect(response.status).toBe(501);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["combo", "ok", "source", "status"]);
    expect(body).toMatchObject({ ok: false, status: "unavailable", source: "no-combo-store" });
  });

  it("fails closed for unavailable key creation", async () => {
    const response = await dashboardRoutes.request("http://localhost/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "ci-key" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["key", "ok", "source", "status"]);
    expect(body).toMatchObject({ ok: false, status: "unavailable", source: "no-key-store", key: null });
  });

  it("preserves unavailable cache metrics shape", async () => {
    const response = await dashboardRoutes.request("http://localhost/cache");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["evictions", "hits", "misses", "sizeMb", "source", "status"]);
    expect(body).toMatchObject({
      status: "unavailable",
      source: "no-cache-metrics-source",
      hits: null,
      misses: null,
      sizeMb: null,
      evictions: null,
    });
  });

  it("rejects invalid settings payloads", async () => {
    const response = await dashboardRoutes.request("http://localhost/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: "neon" }),
    });
    expect(response.status).toBe(400);
  });

  it("accepts provider payloads validated by the shared contract", async () => {
    const response = await dashboardRoutes.request("http://localhost/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_PROVIDER),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["ok", "provider"]);
    expect(body.ok).toBe(true);
    expect(body.provider).toEqual(VALID_PROVIDER);
  });
});

describe("dashboard playground SSE", () => {
  it("streams tokens in order and finishes with calculated cost metadata", async () => {
    vi.useFakeTimers();
    const response = await dashboardRoutes.request("http://localhost/playground/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4",
        systemPrompt: "sys",
        userPrompt: "hello world",
        temperature: 0.2,
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const tokens: string[] = [];
    let donePayload: { tokens: number; cost: number } | null = null;
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const readLoop = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let splitAt = buffer.indexOf("\n\n");
        while (splitAt !== -1) {
          const block = buffer.slice(0, splitAt);
          buffer = buffer.slice(splitAt + 2);
          if (!block.trim()) continue;
          const event = parseSseBlock(block);
          if (event.event === "token" && event.data) {
            tokens.push(JSON.parse(event.data).token);
          }
          if (event.event === "done" && event.data) {
            donePayload = JSON.parse(event.data);
          }
          splitAt = buffer.indexOf("\n\n");
        }
      }
    })();

    for (let i = 0; i < 8; i++) {
      await vi.advanceTimersByTimeAsync(30);
    }
    await readLoop;

    expect(tokens.join("")).toBe("Echo from claude-sonnet-4: hello world... ");
    expect(donePayload).toEqual({ tokens: 5, cost: 5 * 0.00003 });
    expect(vi.getTimerCount()).toBe(0);
  }, 15_000);
});

describe("dashboard health SSE", () => {
  it("emits an initial event, heartbeats on cadence, and monotonic ids", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const response = await dashboardRoutes.request("http://localhost/health/stream", {
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const events: ReturnType<typeof parseSseBlock>[] = [];
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const readLoop = (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let splitAt = buffer.indexOf("\n\n");
          while (splitAt !== -1) {
            const block = buffer.slice(0, splitAt);
            buffer = buffer.slice(splitAt + 2);
            if (block.trim()) events.push(parseSseBlock(block));
            splitAt = buffer.indexOf("\n\n");
          }
        }
      } catch {
        // aborted stream
      }
    })();

    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => expect(events.length).toBeGreaterThanOrEqual(1));
    expect(events[0]?.event).toBe("health");
    expect(JSON.parse(events[0]!.data!).message).toBe("SSE stream connected");
    expect(events[0]?.id).toBe("0");

    await vi.advanceTimersByTimeAsync(5000);
    await vi.waitFor(() => expect(events.length).toBeGreaterThanOrEqual(2));
    expect(events[1]?.id).toBe("1");
    expect(events[1]?.event).toBe("health");

    const ids = events.map((event) => Number(event.id));
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]!);
    }

    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    await reader.cancel();
    await readLoop;
    expect(vi.getTimerCount()).toBe(0);
  }, 15_000);

  it("characterizes pre-hardening abort cleanup where heartbeats can continue", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const response = await dashboardRoutes.request("http://localhost/health/stream", {
      signal: controller.signal,
    });

    const events: ReturnType<typeof parseSseBlock>[] = [];
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const readLoop = (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let splitAt = buffer.indexOf("\n\n");
          while (splitAt !== -1) {
            const block = buffer.slice(0, splitAt);
            buffer = buffer.slice(splitAt + 2);
            if (block.trim()) events.push(parseSseBlock(block));
            splitAt = buffer.indexOf("\n\n");
          }
        }
      } catch {
        // aborted stream
      }
    })();

    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => expect(events.length).toBeGreaterThanOrEqual(1));

    controller.abort();
    const countAfterAbort = events.length;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(events.length).toBeGreaterThan(countAfterAbort);
    await reader.cancel();
    await readLoop;
    expect(vi.getTimerCount()).toBe(0);
  }, 15_000);
});
