import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const workflow = readFileSync(join(ROOT, ".github", "workflows", "electron-release.yml"), "utf8");

test("Electron release caches the pinned pnpm store instead of hand-rolled node_modules", () => {
  // The lockfile of record is pnpm-lock.yaml — the root package-lock.json is
  // gitignored and does not exist in the repository — so the release workflow
  // must use the same package manager as every other workflow in the repo:
  // corepack plus setup-node's pnpm cache. It must not hand-roll a
  // node_modules cache of its own.
  assert.doesNotMatch(workflow, /path:\s*node_modules/);
  assert.match(
    workflow,
    /- name: Enable corepack \(pnpm via packageManager pin\)\s+run: corepack enable/
  );
  assert.match(workflow, /uses:\s*actions\/setup-node@[^\n]+[\s\S]*?cache:\s*pnpm/);
  // `npm ci` cannot run at the repository root without a root npm lockfile.
  assert.doesNotMatch(workflow, /- name: Install dependencies\s+run: npm ci/);
});

test("Electron release installs both dependency trees deterministically", () => {
  // Root tree: the shared pnpm install action, which runs
  // `pnpm install --frozen-lockfile` against pnpm-lock.yaml.
  assert.match(
    workflow,
    /- name: Install dependencies\s+uses: \.\/\.github\/actions\/npm-ci-retry/
  );
  // Electron tree: electron/package-lock.json is tracked, so npm ci is
  // correct (and deterministic) there.
  assert.match(
    workflow,
    /- name: Install Electron dependencies\s+working-directory: electron\s+run: npm ci --no-audit --no-fund/
  );
  assert.doesNotMatch(workflow, /run:\s*npm install --no-audit --no-fund/);
});

test("Electron release retains packaged-app smoke coverage", () => {
  assert.match(workflow, /- name: Smoke packaged Electron app\s+if: matrix\.platform != 'linux'/);
  assert.match(
    workflow,
    /- name: Smoke packaged Electron app \(Linux\)\s+if: matrix\.platform == 'linux'/
  );
});
