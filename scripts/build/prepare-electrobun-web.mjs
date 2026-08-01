#!/usr/bin/env node

import { cp, mkdir, rm, access, rename, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const root = path.resolve(import.meta.dirname, "../..");
const staticSource = path.join(root, "apps/web/.vercel/output/static");
const destination = path.join(root, "desktop-electrobun/generated/web");
const rendererSource = path.join(root, "apps/web/.vercel/output/functions/![-]/catchall.func");
const rendererDestination = path.join(root, "desktop-electrobun/generated/renderer");

try {
  await access(path.join(staticSource, "_app/version.json"));
} catch {
  console.error(
    `[electrobun] apps/web static build output is missing at ${staticSource}. ` +
      "Run `bun --cwd apps/web run build` before preparing the desktop shell.",
  );
  process.exit(1);
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(staticSource, destination, { recursive: true });
await writeFile(
  path.join(destination, "index.html"),
  '<!doctype html><meta charset="utf-8"><title>OmniRoute</title>' +
    '<script>location.replace(window.__OMNIROUTE_SERVER_URL__ || "http://127.0.0.1:20128");</script>\n',
);
console.log(`[electrobun] staged apps/web static output at ${path.relative(root, destination)}`);

// The Vercel adapter emits a self-contained SSR function rather than a root
// index.html. Keep that deployment shape for Vercel, and package the function
// for the native shell where a small Bun gateway can serve it locally.
try {
  await access(path.join(rendererSource, ".svelte-kit/vercel-tmp/index.js"));
} catch {
  console.error(
    `[electrobun] apps/web SSR output is missing at ${rendererSource}. ` +
      "Run `bun --cwd apps/web run build` before preparing the desktop shell.",
  );
  process.exit(1);
}
await rm(rendererDestination, { recursive: true, force: true });
await cp(rendererSource, rendererDestination, { recursive: true });
await cp(staticSource, path.join(rendererDestination, "static"), { recursive: true });
// Electrobun's copy packer ignores dot-directories. Keep the generated SSR
// runtime visible in the app bundle while retaining SvelteKit's output shape.
await rename(
  path.join(rendererDestination, ".svelte-kit"),
  path.join(rendererDestination, "svelte-kit"),
);
console.log(
  `[electrobun] staged apps/web SSR renderer at ${path.relative(root, rendererDestination)}`,
);

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
  `const port = Number(process.env.PORT ?? 20128);\n` +
    `const origin = \`http://127.0.0.1:\${port}\`;\n` +
    `process.env.BFF_ORIGIN ??= origin;\n` +
    `process.env.PUBLIC_OMNIROUTE_BFF_URL ??= origin;\n` +
    `const [{ default: app }, { default: renderer }] = await Promise.all([\n` +
    `  import("./index.js"),\n` +
    `  import("../renderer/svelte-kit/vercel-tmp/index.js"),\n` +
    `]);\n` +
    `const staticRoot = new URL("../renderer/static/", import.meta.url);\n` +
    `const contentTypes = new Map([\n` +
    `  [".css", "text/css; charset=utf-8"], [".js", "text/javascript; charset=utf-8"],\n` +
    `  [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"],\n` +
    `  [".png", "image/png"], [".ico", "image/x-icon"], [".woff2", "font/woff2"],\n` +
    `]);\n` +
    `async function staticAsset(pathname) {\n` +
    `  if (!pathname.startsWith("/_app/") && pathname !== "/favicon.png") return;\n` +
    `  const relative = decodeURIComponent(pathname.slice(1));\n` +
    `  if (relative.includes("..")) return;\n` +
    `  const file = Bun.file(new URL(relative, staticRoot));\n` +
    `  if (!(await file.exists())) return;\n` +
    `  const headers = new Headers();\n` +
    `  const extension = relative.slice(relative.lastIndexOf("."));\n` +
    `  const contentType = contentTypes.get(extension);\n` +
    `  if (contentType) headers.set("content-type", contentType);\n` +
    `  headers.set("cache-control", "public, max-age=31536000, immutable");\n` +
    `  return new Response(file, { headers });\n` +
    `}\n` +
    `const server = Bun.serve({ hostname: "127.0.0.1", port, fetch: async (request) => {\n` +
    `  const url = new URL(request.url);\n` +
    `  if (url.pathname === "/api/bff/healthz") return renderer.fetch(request);\n` +
    `  if (url.pathname === "/healthz" || url.pathname.startsWith("/api/")) return app.fetch(request);\n` +
    `  const asset = await staticAsset(url.pathname);\n` +
    `  return asset ?? renderer.fetch(request);\n` +
    `} });\n` +
    `console.log("[omniroute-gateway] listening on " + origin);\n`,
);
console.log(`[electrobun] staged Hono/Bun backend at ${path.relative(root, backendDestination)}`);
