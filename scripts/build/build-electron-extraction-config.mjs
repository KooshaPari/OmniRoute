#!/usr/bin/env node

/**
 * Compile the web-cookie provider extraction config into the Electron app.
 *
 * `open-sse/services/tokenExtractionConfig.ts` is TypeScript-only and lives in
 * the Next.js source tree. The Electron main process is plain CommonJS and a
 * packaged app only ships the files listed in `electron/package.json`
 * `build.files` — so without this step every packaged build fails the desktop
 * login flow with "tokenExtractionConfig module not found" before a provider
 * window is ever opened.
 *
 * The module is types plus a plain config map with no runtime imports, so it
 * bundles standalone. `prepare:bundle` runs this before electron-builder
 * packages the app.
 */

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runBuildTool } from "./buildToolRunner.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

const ENTRY = join(ROOT, "open-sse", "services", "tokenExtractionConfig.ts");
const OUT_FILE = join(ROOT, "electron", "generated", "tokenExtractionConfig.cjs");

mkdirSync(dirname(OUT_FILE), { recursive: true });

// Never spawn `node_modules/.bin/esbuild` directly: that extensionless path is
// a POSIX shell script and does not exist on Windows (ENOENT). See
// buildToolRunner.mjs.
runBuildTool(
  "esbuild",
  "esbuild",
  [
    ENTRY,
    "--bundle",
    "--platform=node",
    "--packages=external",
    "--format=cjs",
    "--target=node20",
    `--outfile=${OUT_FILE}`,
  ],
  { stdio: "inherit" }
);

console.log(`[build-electron-extraction-config] wrote ${OUT_FILE}`);
