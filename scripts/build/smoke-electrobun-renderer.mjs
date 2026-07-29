#!/usr/bin/env node

import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const renderer = path.join(root, "desktop-electrobun/generated/renderer");
const entrypoint = path.join(renderer, "index.js");
const port = process.env.OMNIROUTE_RENDERER_PORT ?? "20129";
const url = `http://127.0.0.1:${port}/`;

await access(entrypoint);
await access(path.join(renderer, "node_modules", "@sveltejs", "kit"));

const env = { ...process.env, HOST: "127.0.0.1", PORT: port, ORIGIN: `http://127.0.0.1:${port}` };
delete env.NODE_PATH;
const child = spawn(process.execPath, [entrypoint], {
  cwd: renderer,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

const stop = () => {
  if (!child.killed) child.kill("SIGTERM");
};
try {
  let response;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`renderer exited with ${child.exitCode}: ${stderr.trim()}`);
    }
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.status < 500) break;
    } catch {
      // The adapter-node server may need a few attempts to bind.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!response || response.status >= 500) {
    throw new Error(`renderer did not return a healthy response from ${url}: ${stderr.trim()}`);
  }
  const body = await response.text();
  if (!body.trim()) throw new Error("renderer returned an empty document");
  console.log(`[electrobun] renderer smoke passed: ${response.status} ${url}`);
} finally {
  stop();
}
