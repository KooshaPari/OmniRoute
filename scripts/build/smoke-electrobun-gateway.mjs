#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../..", import.meta.url);
const cwd = new URL("desktop-electrobun/", root);
const port = Number(process.env.OMNIROUTE_SMOKE_PORT ?? 20187);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.env.BUN ?? "bun", ["generated/backend/server.mjs"], {
  cwd,
  env: { ...process.env, PORT: String(port) },
  stdio: "inherit",
});

async function request(pathname) {
  return fetch(`${base}${pathname}`, { signal: AbortSignal.timeout(1000) });
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await request("/healthz");
      if (response.ok) return response;
    } catch {
      // The gateway is still starting; the bounded retry is intentional.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`gateway did not become ready at ${base}`);
}

try {
  const health = await waitForHealth();
  const healthBody = await health.json();
  if (healthBody.service !== "argismonitor-bff") {
    throw new Error(`unexpected gateway health payload: ${JSON.stringify(healthBody)}`);
  }

  const rootResponse = await request("/");
  const rootHtml = await rootResponse.text();
  if (!rootResponse.ok || !rootHtml.includes("<title>")) {
    throw new Error(`renderer root failed with HTTP ${rootResponse.status}`);
  }

  const bffHealth = await request("/api/bff/healthz");
  if (!bffHealth.ok)
    throw new Error(`Svelte BFF health route failed with HTTP ${bffHealth.status}`);

  const rawAssetPath = /(?:href|src)=["']((?:\.\/|\/)[_]app\/[^"']+)["']/.exec(rootHtml)?.[1];
  const assetPath = rawAssetPath?.replace(/^\.\//, "/");
  if (!assetPath) throw new Error("renderer root did not reference a bundled asset");
  const asset = await request(assetPath);
  if (!asset.ok) throw new Error(`renderer asset failed with HTTP ${asset.status}: ${assetPath}`);

  // Ensure the staging contract remains explicit even when a build has no
  // generated asset in the root HTML (for example, a minimal CI fixture).
  await readFile(join(cwd.pathname, "generated/web/_app/version.json"));
  console.log(`[electrobun] gateway smoke passed: ${base}, ${assetPath}`);
} finally {
  child.kill("SIGTERM");
}
