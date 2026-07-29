#!/usr/bin/env node
// scripts/perf/baseline-probe.mjs
//
// Statistical baseline probe for OmniRoute endpoints (Closes #443).
//
// Captures a real latency baseline by running three phases against a live
// server:
//
//   1. **Cold-cache** — sequential, 1 request per route. Captures cold-start
//      tail (JIT, connection pool, DB schema warmup).
//   2. **Warm-cache** — sequential, N requests per route. Captures p50/p90/p95/p99
//      with steady-state caches (keyv/sqlite-vec/cb).
//   3. **Concurrency** — K parallel requests across all routes. Captures tail
//      latency under load (queue contention, thread pool saturation).
//
// Output: JSON + Markdown report in `--output` dir.
// Defaults: 5 warm + 10 concurrent + 10000 ms timeout.
//
// Usage:
//   pnpm start &                  # in another shell
//   node scripts/perf/baseline-probe.mjs
//   node scripts/perf/baseline-probe.mjs --target=http://localhost:3000 --warm=10 --concurrency=20
//   node scripts/perf/baseline-probe.mjs --output=./perf-results
//
// This is the capability `#443` requires. The actual baseline numbers require
// running against staging traffic — the harness produces a reproducible local
// baseline that can be diffed against v4 once that's available.

import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── CLI args ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    target: process.env.TARGET || 'http://127.0.0.1:3000',
    warm: 5,
    concurrency: 10,
    timeout: 10000,
    output: './perf-results',
  };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--target') { args.target = next; i++; }
    else if (flag === '--warm') { args.warm = Number(next); i++; }
    else if (flag === '--concurrency') { args.concurrency = Number(next); i++; }
    else if (flag === '--timeout') { args.timeout = Number(next); i++; }
    else if (flag === '--output') { args.output = next; i++; }
  }
  if (!args.target.startsWith('http')) {
    args.target = `http://${args.target}`;
  }
  return args;
}

const ARGS = parseArgs(process.argv);
const TARGET_URL = new URL(ARGS.target);
const OUTPUT_DIR = resolve(ARGS.output);

// ── Routes (#443 — 65 routes) ───────────────────────────────────────────────

const ROUTES = [
  // /api/v1 (8)
  { method: 'GET', path: '/api/v1/models' },
  { method: 'GET', path: '/api/v1/keys' },
  { method: 'POST', path: '/api/v1/chat/completions' },
  { method: 'POST', path: '/api/v1/embeddings' },
  { method: 'POST', path: '/api/v1/images/generations' },
  { method: 'GET', path: '/api/v1/audio/speech' },
  { method: 'POST', path: '/api/v1/moderations' },
  { method: 'GET', path: '/api/v1/files' },
  // /api/health (3)
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/api/health/ping' },
  { method: 'GET', path: '/api/health/deep' },
  // /api/identity (1)
  { method: 'GET', path: '/api/identity' },
  // /api/system (4)
  { method: 'GET', path: '/api/system/version' },
  { method: 'GET', path: '/api/system/env' },
  { method: 'GET', path: '/api/system/info' },
  { method: 'GET', path: '/api/system/status' },
  // /api/keys (3)
  { method: 'GET', path: '/api/keys' },
  { method: 'POST', path: '/api/keys' },
  { method: 'GET', path: '/api/keys/foo' },
  // /api/quota (4)
  { method: 'GET', path: '/api/quota' },
  { method: 'GET', path: '/api/quota/pools' },
  { method: 'GET', path: '/api/quota/plans' },
  { method: 'GET', path: '/api/quota/usage' },
  // /api/memory (5)
  { method: 'POST', path: '/api/memory/upsert' },
  { method: 'POST', path: '/api/memory/search' },
  { method: 'GET', path: '/api/memory/list' },
  { method: 'DELETE', path: '/api/memory/foo' },
  { method: 'POST', path: '/api/memory/batch' },
  // /api/agents (6)
  { method: 'GET', path: '/api/agents' },
  { method: 'POST', path: '/api/agents' },
  { method: 'GET', path: '/api/agents/foo' },
  { method: 'PATCH', path: '/api/agents/foo' },
  { method: 'DELETE', path: '/api/agents/foo' },
  { method: 'POST', path: '/api/agents/foo/run' },
  // /api/skills (4)
  { method: 'GET', path: '/api/skills' },
  { method: 'GET', path: '/api/skills/foo' },
  { method: 'POST', path: '/api/skills/foo/invoke' },
  { method: 'DELETE', path: '/api/skills/foo' },
  // /api/settings (5)
  { method: 'GET', path: '/api/settings' },
  { method: 'PATCH', path: '/api/settings' },
  { method: 'GET', path: '/api/settings/qdrant' },
  { method: 'GET', path: '/api/settings/safety' },
  { method: 'POST', path: '/api/settings/test' },
  // /api/billing (3)
  { method: 'GET', path: '/api/billing/usage' },
  { method: 'GET', path: '/api/billing/plans' },
  { method: 'GET', path: '/api/billing/invoices' },
  // /api/tasks (4)
  { method: 'GET', path: '/api/tasks' },
  { method: 'POST', path: '/api/tasks' },
  { method: 'GET', path: '/api/tasks/foo' },
  { method: 'DELETE', path: '/api/tasks/foo' },
  // /api/observations (4)
  { method: 'GET', path: '/api/observations' },
  { method: 'POST', path: '/api/observations' },
  { method: 'GET', path: '/api/observations/foo' },
  { method: 'DELETE', path: '/api/observations/foo' },
  // /api/effective (2)
  { method: 'GET', path: '/api/effective/settings' },
  { method: 'GET', path: '/api/effective/model' },
  // /api/version-manager (3)
  { method: 'GET', path: '/api/version-manager' },
  { method: 'POST', path: '/api/version-manager/check-update' },
  { method: 'POST', path: '/api/version-manager/apply-update' },
  // /api/secrets (3)
  { method: 'GET', path: '/api/secrets' },
  { method: 'POST', path: '/api/secrets' },
  { method: 'GET', path: '/api/secrets/foo' },
  // misc (4)
  { method: 'GET', path: '/api/rate-limit/config' },
  { method: 'POST', path: '/api/rate-limit/reset' },
  { method: 'POST', path: '/api/cache/invalidate' },
  { method: 'GET', path: '/api/build-info' },
  // dashboard pages (3)
  { method: 'GET', path: '/' },
  { method: 'GET', path: '/dashboard' },
  { method: 'GET', path: '/login' },
  // system pages (1)
  { method: 'GET', path: '/.well-known/agent.json' },
];

// ── Probing ─────────────────────────────────────────────────────────────────

/** @param {{method: string, path: string}} route */
function probeRoute(route) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const req = http.request(
      {
        host: TARGET_URL.hostname,
        port: Number(TARGET_URL.port || 80),
        method: route.method,
        path: route.path,
        timeout: ARGS.timeout,
      },
      (res) => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () =>
          resolve({
            method: route.method,
            path: route.path,
            status: res.statusCode,
            durationMs,
            bytes: body.length,
          }),
        );
      },
    );
    req.on('error', (err) =>
      resolve({
        method: route.method,
        path: route.path,
        status: 'ERR',
        durationMs: Number(process.hrtime.bigint() - start) / 1e6,
        error: err.message,
      }),
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({
        method: route.method,
        path: route.path,
        status: 'TIMEOUT',
        durationMs: ARGS.timeout,
      });
    });
    req.end();
  });
}

/**
 * @param {number[]} durations
 * @returns {Record<string, number>}
 */
function stats(durations) {
  if (durations.length === 0) return { count: 0 };
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const p = (q) => sorted[Math.min(Math.floor(q * sorted.length), sorted.length - 1)];
  return {
    count: sorted.length,
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    mean: Number((sum / sorted.length).toFixed(2)),
    p50: Number(p(0.5).toFixed(2)),
    p90: Number(p(0.9).toFixed(2)),
    p95: Number(p(0.95).toFixed(2)),
    p99: Number(p(0.99).toFixed(2)),
  };
}

// ── Phases ─────────────────────────────────────────────────────────────────

async function phaseCold() {
  const results = [];
  for (const route of ROUTES) {
    results.push(await probeRoute(route));
  }
  return results;
}

async function phaseWarm(n) {
  /** @type {Map<string, number[]>} */
  const samples = new Map();
  for (let i = 0; i < n; i++) {
    for (const route of ROUTES) {
      const key = `${route.method} ${route.path}`;
      const res = await probeRoute(route);
      const arr = samples.get(key) ?? [];
      arr.push(res.durationMs);
      samples.set(key, arr);
    }
  }
  /** @type {Array<{route: string, status: number|'ERR'|'TIMEOUT', stats: any}>} */
  const out = [];
  for (const [key, durs] of samples) {
    const [method, ...path] = key.split(' ');
    const last = await probeRoute({ method, path: path.join(' ') });
    out.push({ route: key, status: last.status, stats: stats(durs) });
  }
  return out;
}

async function phaseConcurrency(k) {
  /** @type {Map<string, number[]>} */
  const samples = new Map();
  for (let i = 0; i < k; i++) {
    const results = await Promise.all(ROUTES.map((r) => probeRoute(r)));
    for (const r of results) {
      const key = `${r.method} ${r.path}`;
      const arr = samples.get(key) ?? [];
      arr.push(r.durationMs);
      samples.set(key, arr);
    }
  }
  return Array.from(samples.entries()).map(([key, durs]) => ({
    route: key,
    stats: stats(durs),
  }));
}

// ── Output ─────────────────────────────────────────────────────────────────

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# Latency Baseline — OmniRoute`);
  lines.push('');
  lines.push(`**Target:** \`${TARGET_URL.href}\`  `);
  lines.push(`**Generated:** ${report.generatedAt}  `);
  lines.push(`**Tool:** \`scripts/perf/baseline-probe.mjs\`  `);
  lines.push(`**Routes:** ${ROUTES.length}  `);
  lines.push(`**Warm phase:** ${ARGS.warm} iterations × ${ROUTES.length} routes = ${ARGS.warm * ROUTES.length} sequential probes  `);
  lines.push(`**Concurrency:** ${ARGS.concurrency} rounds × ${ROUTES.length} parallel probes = ${ARGS.concurrency * ROUTES.length} parallel probes`);
  lines.push('');
  lines.push('## Cold-cache (1 sequential probe per route)');
  lines.push('');
  lines.push('| Status | Method | Path | Duration (ms) |');
  lines.push('|---|---|---|---|');
  for (const r of report.cold) {
    lines.push(`| ${r.status} | ${r.method} | \`${r.path}\` | ${r.durationMs.toFixed(2)} |`);
  }
  lines.push('');
  lines.push(`**Cold total:** ${report.cold.reduce((a, r) => a + r.durationMs, 0).toFixed(2)} ms`);
  lines.push('');
  lines.push('## Warm-cache percentiles (sequential, N=' + ARGS.warm + ')');
  lines.push('');
  lines.push('| Route | p50 | p90 | p95 | p99 | max |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of report.warm.sort((a, b) => b.stats.p95 - a.stats.p95).slice(0, 25)) {
    lines.push(`| \`${r.route}\` | ${r.stats.p50} | ${r.stats.p90} | ${r.stats.p95} | ${r.stats.p99} | ${r.stats.max} |`);
  }
  lines.push('');
  lines.push('## Concurrency (parallel K=' + ARGS.concurrency + ')');
  lines.push('');
  lines.push('| Route | p50 | p90 | p95 | p99 | max |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of report.concurrency.sort((a, b) => b.stats.p95 - a.stats.p95).slice(0, 25)) {
    lines.push(`| \`${r.route}\` | ${r.stats.p50} | ${r.stats.p90} | ${r.stats.p95} | ${r.stats.p99} | ${r.stats.max} |`);
  }
  lines.push('');
  lines.push('## Aggregate');
  lines.push('');
  const allCold = report.cold.map((r) => r.durationMs);
  const allWarm = report.warm.flatMap((r) => r.stats.count ? [r.stats.p95] : []);
  const allConc = report.concurrency.flatMap((r) => r.stats.count ? [r.stats.p95] : []);
  const cs = stats(allCold);
  const ws = stats(allWarm);
  const concs = stats(allConc);
  lines.push('| Phase | p50 | p90 | p95 | p99 |');
  lines.push('|---|---|---|---|---|');
  lines.push(`| Cold (n=${cs.count}) | ${cs.p50} | ${cs.p90} | ${cs.p95} | ${cs.p99} |`);
  lines.push(`| Warm p95 (n=${ws.count}) | ${ws.p50} | ${ws.p90} | ${ws.p95} | ${ws.p99} |`);
  lines.push(`| Concurrency p95 (n=${concs.count}) | ${concs.p50} | ${concs.p90} | ${concs.p95} | ${concs.p99} |`);
  lines.push('');
  lines.push('## Caveats');
  lines.push('');
  lines.push('- **Local baseline**: this captures dev-server performance, not production.');
  lines.push('- **No real v4 comparator**: stage v4 locally with the same harness to get a diff.');
  lines.push('- **Caveats per route**: routes returning 401/403 with sub-1ms latency are auth-rejected at the middleware before the handler runs.');
  return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`▶ Baseline probe → ${TARGET_URL.href}`);
  console.log(`  warm=${ARGS.warm}  concurrency=${ARGS.concurrency}  timeout=${ARGS.timeout}ms`);
  console.log(`  output=${OUTPUT_DIR}`);
  console.log('');

  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`[1/3] Cold-cache phase (${ROUTES.length} sequential probes) ...`);
  const cold = await phaseCold();
  console.log(`  done in ${cold.reduce((a, r) => a + r.durationMs, 0).toFixed(0)}ms`);

  console.log(`[2/3] Warm-cache phase (${ARGS.warm} iters × ${ROUTES.length} routes = ${ARGS.warm * ROUTES.length} probes) ...`);
  const warm = await phaseWarm(ARGS.warm);
  console.log(`  done`);

  console.log(`[3/3] Concurrency phase (${ARGS.concurrency} rounds × ${ROUTES.length} parallel = ${ARGS.concurrency * ROUTES.length} probes) ...`);
  const concurrency = await phaseConcurrency(ARGS.concurrency);
  console.log(`  done`);

  const report = {
    generatedAt: new Date().toISOString(),
    target: TARGET_URL.href,
    config: ARGS,
    cold,
    warm,
    concurrency,
  };

  const jsonPath = resolve(OUTPUT_DIR, 'baseline.json');
  const mdPath = resolve(OUTPUT_DIR, 'baseline.md');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(mdPath, renderMarkdown(report));
  console.log('');
  console.log(`✓ JSON → ${jsonPath}`);
  console.log(`✓ Markdown → ${mdPath}`);

  const ok = (...arr) => arr.every((r) => String(r.status).startsWith('2') || String(r.status).startsWith('3'));
  const cold5xx = cold.filter((r) => !ok(r)).length;
  if (cold5xx > 0) {
    console.log(`⚠ ${cold5xx} cold probes did not return 2xx/3xx — check the markdown report`);
  } else {
    console.log('✓ All routes returning 2xx/3xx');
  }
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
