#!/usr/bin/env node

import { cp, mkdir, rm, access, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
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
