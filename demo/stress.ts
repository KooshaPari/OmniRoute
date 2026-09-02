#!/usr/bin/env bun
/**
 * Stress test: burst and sustained phases.
 *
 * Usage:
 *   bun run demo/stress.ts --burst 200 --rps 100 --duration 30
 *   bun run demo/stress.ts --sustained 50 --duration 600
 *
 * Requires the bundled demo provider:
 *   omniroute start --provider demo --port 20128
 */

type Result = { status: number; latencyMs: number }

function pct(xs: number[], p: number): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) * p)]
}

async function callOnce(url: string): Promise<Result> {
  const start = Date.now()
  const res = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer demo',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'demo-fast',
      messages: [{ role: 'user', content: 'stress' }],
    }),
  })
  return { status: res.status, latencyMs: Date.now() - start }
}

interface BurstOpts {
  count: number
  rps: number
  url: string
}

interface SustainedOpts {
  rps: number
  durationSec: number
  url: string
}

async function runBurst(opts: BurstOpts): Promise<void> {
  console.log(`[ok] burst: ${opts.count} reqs at ${opts.rps} rps`)
  const intervalMs = 1000 / opts.rps
  const results: Result[] = []
  for (let i = 0; i < opts.count; i++) {
    const before = Date.now()
    try {
      results.push(await callOnce(opts.url))
    } catch {
      results.push({ status: 0, latencyMs: 0 })
    }
    const elapsed = Date.now() - before
    if (elapsed < intervalMs) {
      await Bun.sleep(intervalMs - elapsed)
    }
  }
  const ok = results.filter((r) => r.status >= 200 && r.status < 300)
  const latencies = ok.map((r) => r.latencyMs)
  const p50 = pct(latencies, 0.5)
  const p99 = pct(latencies, 0.99)
  const errorRate = (results.length - ok.length) / results.length
  console.log(
    `[ok] p50=${p50}ms p99=${p99}ms err=${(errorRate * 100).toFixed(2)}%`,
  )
  if (p99 > 200 || errorRate > 0.01) {
    console.error(`[fail] burst: p99>200ms or errorRate>1%`)
    process.exit(1)
  }
  console.log(`[pass] burst`)
}

async function runSustained(opts: SustainedOpts): Promise<void> {
  console.log(
    `[ok] sustained: ${opts.rps} rps for ${opts.durationSec}s`,
  )
  const intervalMs = 1000 / opts.rps
  const endAt = Date.now() + opts.durationSec * 1000
  const results: Result[] = []
  while (Date.now() < endAt) {
    const before = Date.now()
    try {
      results.push(await callOnce(opts.url))
    } catch {
      results.push({ status: 0, latencyMs: 0 })
    }
    const elapsed = Date.now() - before
    if (elapsed < intervalMs) {
      await Bun.sleep(intervalMs - elapsed)
    }
  }
  const ok = results.filter((r) => r.status >= 200 && r.status < 300)
  const latencies = ok.map((r) => r.latencyMs)
  const p50 = pct(latencies, 0.5)
  const p99 = pct(latencies, 0.99)
  const errorRate = (results.length - ok.length) / results.length
  console.log(
    `[ok] p50=${p50}ms p99=${p99}ms err=${(errorRate * 100).toFixed(2)}%`,
  )
  if (p99 > 250 || errorRate > 0.005) {
    console.error(`[fail] sustained: p99>250ms or errorRate>0.5%`)
    process.exit(1)
  }
  console.log(`[pass] sustained`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const get = (k: string, dflt: string): string => {
    const idx = args.findIndex((a) => a === `--${k}`)
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : dflt
  }
  const url = get('url', 'http://127.0.0.1:20128')
  if (args.includes('--burst')) {
    await runBurst({
      count: parseInt(get('burst', '200'), 10),
      rps: parseInt(get('rps', '100'), 10),
      url,
    })
  } else if (args.includes('--sustained')) {
    await runSustained({
      rps: parseInt(get('sustained', '50'), 10),
      durationSec: parseInt(get('duration', '600'), 10),
      url,
    })
  } else {
    console.error(
      `[err] missing mode. Use --burst or --sustained. See demo/stress-test.md`,
    )
    process.exit(2)
  }
}

await main()
