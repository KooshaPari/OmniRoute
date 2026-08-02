#!/usr/bin/env node
/**
 * scripts/bun-test-runner.mjs
 *
 * Optional Bun test runner for OmniRoute — runs the same vitest suite under
 * Bun's test runtime for parity verification. Non-blocking: Bun is opt-in
 * (NOT a hard dependency). CI runs Node + Bun in parallel lanes.
 *
 * Comparison: pnpm test:unit (Node) vs this (Bun). Both produce a JSON
 * summary; CI diffs the timings.
 *
 * Usage:
 *   bun run scripts/bun-test-runner.mjs
 *   node scripts/bun-test-runner.mjs  # fallback to Node if Bun absent
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname || new URL('.', import.meta.url).pathname, '..');

function bunAvailable() {
  try {
    execSync('command -v bun', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function runUnderBun() {
  const start = Date.now();
  try {
    // Bun's test runner is invoked with `bun test`. For our vitest-based
    // suite, we run vitest under bun (faster startup, native TS support).
    const output = execSync(
      'bun x vitest run --reporter=verbose --reporter=json',
      { cwd: REPO_ROOT, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } }
    );
    return { exitCode: 0, durationMs: Date.now() - start };
  } catch (err) {
    return { exitCode: err.status ?? 1, durationMs: Date.now() - start, error: err.message };
  }
}

function runUnderNode() {
  const start = Date.now();
  try {
    execSync('node_modules/.bin/vitest run', { cwd: REPO_ROOT, stdio: 'inherit' });
    return { exitCode: 0, durationMs: Date.now() - start };
  } catch (err) {
    return { exitCode: err.status ?? 1, durationMs: Date.now() - start, error: err.message };
  }
}

const result = bunAvailable() ? runUnderBun() : runUnderNode();
console.log(`\n[runner] ${bunAvailable() ? 'bun' : 'node'} test run: ${result.exitCode === 0 ? 'PASS' : 'FAIL'} (${result.durationMs}ms)`);
if (result.error) console.error(`[runner] error: ${result.error}`);
process.exit(result.exitCode);
