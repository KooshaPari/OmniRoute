#!/usr/bin/env node

import { cp, mkdir, rm, access, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const root = path.resolve(import.meta.dirname, "../..");
const source = path.join(root, "apps/web/.svelte-kit/output/client");
const destination = path.join(root, "desktop-electrobun/generated/web");

try {
  await access(path.join(source, "_app/version.json"));
} catch {
  console.error(
    `[electrobun] apps/web client build output is missing at ${source}. ` +
      "Run `bun --cwd apps/web run build` before preparing the desktop shell."
  );
  process.exit(1);
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
await writeFile(
  path.join(destination, "index.html"),
  '<!doctype html><meta charset="utf-8"><title>OmniRoute</title>' +
    '<script>location.replace(window.__OMNIROUTE_SERVER_URL__ || "http://127.0.0.1:20128");</script>\n'
);
console.log(`[electrobun] staged apps/web static output at ${path.relative(root, destination)}`);

// The desktop app owns its local control plane: package the Hono/Bun BFF next
// to the static Svelte renderer so the app does not depend on a dev server.
const backendSource = path.join(root, "apps/bff/dist/index.js");
const backendDestination = path.join(root, "desktop-electrobun/generated/backend");
try {
  await execFileAsync("bun", ["run", "build"], { cwd: path.join(root, "apps/bff") });
  await access(backendSource);
} catch (error) {
  console.error("[electrobun] failed to build Hono/Bun backend:", error);
  process.exit(1);
}
await rm(backendDestination, { recursive: true, force: true });
await mkdir(backendDestination, { recursive: true });
await cp(backendSource, path.join(backendDestination, "index.js"));
await writeFile(
  path.join(backendDestination, "server.mjs"),
  `import app from "./index.js";\n` +
    `const port = Number(process.env.PORT ?? 20128);\n` +
    `const server = Bun.serve({ hostname: "127.0.0.1", port, fetch: app.fetch });\n` +
    `console.log("[omniroute-bff] listening on http://127.0.0.1:" + server.port);\n`,
);
console.log(`[electrobun] staged Hono/Bun backend at ${path.relative(root, backendDestination)}`);
