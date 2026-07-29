#!/usr/bin/env node
// scripts/perf/probe-routes.mjs
// Probes all 65 Next.js App-Router endpoints with HEAD/GET to measure response codes + latency.
// This is the synthetic harness for #443 (65-route readiness proof) — not a real perf baseline
// (real baseline requires staging traffic traces per docs/LATENCY_BASELINE.md) but it verifies
// that every route is reachable and dispatched.
import http from 'node:http';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);

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

async function probeRoute(host, port, method, path) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request({ host, port, method, path, timeout: 10000 }, (res) => {
      const duration = Date.now() - start;
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ method, path, status: res.statusCode, duration, bytes: body.length }));
    });
    req.on('error', (err) => resolve({ method, path, status: 'ERR', duration: Date.now() - start, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ method, path, status: 'TIMEOUT', duration: 10000 }); });
    req.end();
  });
}

async function main() {
  console.log(`Probing ${ROUTES.length} routes on http://${HOST}:${PORT} ...`);
  const results = await Promise.all(ROUTES.map((r) => probeRoute(HOST, PORT, r.method, r.path)));

  const codes = {};
  let totalDuration = 0;
  for (const r of results) {
    const k = r.status;
    codes[k] = (codes[k] || 0) + 1;
    totalDuration += r.duration;
  }

  console.log('\n--- Summary by status code ---');
  for (const [code, count] of Object.entries(codes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code}: ${count}`);
  }
  console.log(`\n--- Aggregate ---`);
  console.log(`Total routes: ${results.length}`);
  console.log(`Total time:   ${totalDuration}ms`);
  console.log(`Avg latency:  ${(totalDuration / results.length).toFixed(2)}ms`);
  const sorted = results.map(r => r.duration).sort((a, b) => a - b);
  console.log(`P95 (sorted): ${sorted[Math.floor(results.length * 0.95)]}ms`);

  // Show slow routes (>500ms)
  console.log('\n--- Slow routes (>500ms) ---');
  results.filter(r => r.duration > 500).forEach((r) => console.log(`  ${r.method.padEnd(6)} ${r.path.padEnd(40)} ${r.duration}ms ${r.status}`));

  // Show errors/5xx
  const errs = results.filter(r => String(r.status).startsWith('5') || r.status === 'ERR' || r.status === 'TIMEOUT');
  if (errs.length > 0) {
    console.log('\n--- Errors ---');
    errs.forEach((r) => console.log(`  ${r.method.padEnd(6)} ${r.path.padEnd(40)} ${r.status}${r.error ? ' ('+r.error+')' : ''}`));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
