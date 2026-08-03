#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../..", import.meta.url);
const cwd = new URL("desktop-electrobun/", root);
const backendPort = Number(process.env.OMNIROUTE_SMOKE_BFF_PORT ?? 20187);
const rendererPort = Number(process.env.OMNIROUTE_SMOKE_RENDERER_PORT ?? 20188);
const backendBase = `http://127.0.0.1:${backendPort}`;
const rendererBase = `http://127.0.0.1:${rendererPort}`;
const bun = process.env.BUN ?? "bun";
const backend = spawn(bun, ["generated/backend/server.mjs"], {
  cwd,
  env: { ...process.env, PORT: String(backendPort) },
  stdio: "inherit",
});
const renderer = spawn(bun, ["index.js"], {
  cwd: new URL("desktop-electrobun/generated/renderer/", root),
  env: {
    ...process.env,
    PORT: String(rendererPort),
    HOST: "127.0.0.1",
    ORIGIN: rendererBase,
    BFF_ORIGIN: backendBase,
    PUBLIC_OMNIROUTE_BFF_URL: backendBase,
  },
  stdio: "inherit",
});

async function request(base, pathname) {
  return fetch(`${base}${pathname}`, { signal: AbortSignal.timeout(1000) });
}

async function waitFor(base, pathname) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await request(base, pathname);
      if (response.ok) return response;
    } catch {
      // The local process is still starting; the bounded retry is intentional.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`local process did not become ready at ${base}${pathname}`);
}

try {
  const health = await waitFor(backendBase, "/healthz");
  const healthBody = await health.json();
  if (healthBody.service !== "argismonitor-bff") {
    throw new Error(`unexpected gateway health payload: ${JSON.stringify(healthBody)}`);
  }

  const rootResponse = await waitFor(rendererBase, "/");
  const rootHtml = await rootResponse.text();
  if (!rootResponse.ok || !rootHtml.includes("<title>")) {
    throw new Error(`renderer root failed with HTTP ${rootResponse.status}`);
  }

  const bffHealth = await request(backendBase, "/api/bff/healthz");
  if (!bffHealth.ok)
    throw new Error(`Svelte BFF health route failed with HTTP ${bffHealth.status}`);

  const rawAssetPath = /(?:href|src)=["']((?:\.\/|\/)_app\/[^"']+)["']/.exec(rootHtml)?.[1];
  const assetPath = rawAssetPath?.replace(/^\.\//, "/");
  if (!assetPath) throw new Error("renderer root did not reference a bundled asset");
  const asset = await request(rendererBase, assetPath);
  if (!asset.ok) throw new Error(`renderer asset failed with HTTP ${asset.status}: ${assetPath}`);

  // Ensure the staging contract remains explicit even when a build has no
  // generated asset in the root HTML (for example, a minimal CI fixture).
  await readFile(join(cwd.pathname, "generated/web/_app/version.json"));
  console.log(
    `[electrobun] gateway + renderer smoke passed: ${backendBase}, ${rendererBase}, ${assetPath}`,
  );
} finally {
  backend.kill("SIGTERM");
  renderer.kill("SIGTERM");
}
