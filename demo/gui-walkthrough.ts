#!/usr/bin/env bun
/**
 * GUI walkthrough: emits an SVG showing each request's routing decision.
 *
 * Usage:
 *   bun run demo/gui-walkthrough.ts --requests 5 --out ./demo/out
 *
 * Requires the bundled demo provider:
 *   omniroute start --provider demo --port 20128
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type Result = {
  index: number
  provider: string
  status: number
  latencyMs: number
}

function color(status: number): string {
  if (status >= 200 && status < 300) return '#22c55e'
  if (status >= 400 && status < 500) return '#f59e0b'
  return '#ef4444'
}

async function oneCall(url: string, i: number): Promise<Result> {
  const start = Date.now()
  const res = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer demo',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'demo-fast',
      messages: [{ role: 'user', content: `walkthrough #${i}` }],
    }),
  })
  const latencyMs = Date.now() - start
  const body = (await res.json()) as { provider?: string }
  return {
    index: i,
    provider: body.provider ?? 'demo-fast',
    status: res.status,
    latencyMs,
  }
}

function renderSvg(results: Result[]): string {
  const rowH = 40
  const padX = 20
  const width = 640
  const height = 60 + results.length * rowH
  const lines: string[] = []
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
  )
  lines.push(
    `<rect x="0" y="0" width="${width}" height="40" fill="#1f2937" />`,
  )
  lines.push(
    `<text x="${padX}" y="26" fill="white" font-family="ui-monospace,monospace" font-size="14">OmniRoute GUI walkthrough — ${results.length} reqs</text>`,
  )
  results.forEach((r, idx) => {
    const y = 60 + idx * rowH
    lines.push(
      `<rect x="0" y="${y - 20}" width="${width}" height="${rowH - 4}" fill="#0f172a" />`,
    )
    lines.push(
      `<line x1="${padX}" y1="${y}" x2="${padX + 80}" y2="${y}" stroke="${color(r.status)}" stroke-width="3" />`,
    )
    lines.push(
      `<text x="${padX + 100}" y="${y + 5}" fill="#e5e7eb" font-family="ui-monospace,monospace" font-size="13">req #${r.index + 1} → provider=${r.provider} → ${r.status} (${r.latencyMs}ms)</text>`,
    )
  })
  lines.push('</svg>')
  return lines.join('\n')
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const get = (k: string, dflt: string): string => {
    const idx = args.findIndex((a) => a === `--${k}`)
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : dflt
  }
  const requests = parseInt(get('requests', '5'), 10)
  const out = get('out', './demo/out')
  const url = get('url', 'http://127.0.0.1:20128')

  console.log(`[ok] starting GUI walkthrough at ${url}, requests=${requests}`)
  const results: Result[] = []
  for (let i = 0; i < requests; i++) {
    try {
      results.push(await oneCall(url, i))
      console.log(`[ok] req #${i + 1} done`)
    } catch (err) {
      console.error(`[err] req #${i + 1}:`, err)
      results.push({
        index: i,
        provider: 'unknown',
        status: 0,
        latencyMs: 0,
      })
    }
  }

  mkdirSync(out, { recursive: true })
  const svgPath = join(out, 'walkthrough.svg')
  writeFileSync(svgPath, renderSvg(results))
  console.log(`[ok] wrote ${svgPath}`)
  console.log(
    `[ok] summary: ${results.filter((r) => r.status < 300).length}/${results.length} 2xx`,
  )
}

await main()
