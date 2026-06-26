// Step-1 PR1: bun + hono entrypoint.
//
// Replaces Next.js routing. Exposes the same surface that `src/app/api/*`
// used to expose, but with explicit per-provider dispatch via the bifrost
// sidecar (instead of the legacy Next.js + hand-rolled provider code).
import { Hono } from "hono";
import { chat, listModels, probeBifrost } from "./bifrost-client.js";
import { probeAllProviders } from "./discovery.js";
import { listProviders } from "./catalog.js";
import type { ChatRequest, ProviderId } from "./types.js";

const BIFROST_URL = process.env["BIFROST_URL"] ?? "http://127.0.0.1:49152";
const PORT = Number(process.env["PORT"] ?? "3000");

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, ts: Date.now(), stack: "bun+hono+ts7+bifrost" }));

app.get("/v1/providers", (c) => c.json({ providers: probeAllProviders() }));

app.get("/v1/catalog", (c) => c.json({ providers: listProviders() }));

app.get("/v1/:provider/models", async (c) => {
  const bifrost = await probeBifrost(BIFROST_URL);
  const provider = c.req.param("provider") as ProviderId;
  try {
    const models = await listModels(bifrost, provider);
    return c.json({ provider, models });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 502);
  }
});

app.post("/v1/:provider/chat", async (c) => {
  const bifrost = await probeBifrost(BIFROST_URL);
  const provider = c.req.param("provider") as ProviderId;
  let body: ChatRequest;
  try {
    body = (await c.req.json()) as ChatRequest;
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  try {
    const out = await chat(bifrost, provider, body);
    return c.json(out);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 502);
  }
});

// Bun-native server: keeps the runtime aligned with the user's "switch
// from Next.js → bun + TS7 native preview" directive. (Node entrypoint
// is in dist/server.js for the legacy fallback path.)
export default {
  port: PORT,
  fetch: app.fetch,
};

// Allow `bun run src/server.ts` to actually start the server.
if (import.meta.main) {
  console.log(`[step-1] bun+hono listening on http://localhost:${PORT}`);
  console.log(`[step-1] bifrost sidecar expected at ${BIFROST_URL}`);
}
