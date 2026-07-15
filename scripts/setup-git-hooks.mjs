#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const LEFTHOOK_VERSION = "2.1.9";
const ROOT = process.cwd();
const LEFTHOOK_BIN = resolve(
  ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "lefthook.cmd" : "lefthook",
);
const LEFTHOOK_CONFIG = resolve(ROOT, "lefthook.yml");

const isCI =
  process.env.CI === "1" ||
  process.env.CI === "true" ||
  process.env.SKIP_LEFTHOOK_INSTALL === "1";

if (isCI) {
  process.exit(0);
}

if (!existsSync(LEFTHOOK_CONFIG)) {
  console.error("[hooks] expected lefthook.yml not found at repository root");
  process.exit(1);
}

if (!existsSync(resolve(ROOT, ".git"))) {
  process.exit(0);
}

function runInstaller(command, args, label) {
  const useShell = process.platform === "win32" && command.endsWith(".cmd");
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: useShell,
  });

  if (result.status === 0) {
    console.log(`[hooks] Lefthook installed via ${label}`);
    return true;
  }

  if (result.error?.code === "ENOENT") {
    return false;
  }

  return false;
}

const attempts = [
  [LEFTHOOK_BIN, ["install", "--force"], "local binary"],
  [
    process.platform === "win32" ? "npm.cmd" : "npm",
    [
      "exec",
      "--yes",
      "--package",
      `lefthook@${LEFTHOOK_VERSION}`,
      "lefthook",
      "--",
      "install",
      "--force",
    ],
    "npm exec",
  ],
  [
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", `lefthook@${LEFTHOOK_VERSION}`, "install", "--force"],
    "npx",
  ],
];

let installed = false;

for (const [command, args, label] of attempts) {
  if (command === LEFTHOOK_BIN && !existsSync(command)) {
    continue;
  }

  if (runInstaller(command, args, label)) {
    installed = true;
    break;
  }
}

if (!installed) {
  console.error(
    "\n[hooks] Could not install Lefthook. Install one of: npm, npx, bunx (offline helper).",
  );
  console.error("[hooks] Commit/push hook enforcement is not active.");
  console.error("[hooks] Run this manually after ensuring tooling is available:");
  console.error("[hooks]   npm run hooks:install");
  process.exit(1);
}
