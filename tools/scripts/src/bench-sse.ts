/**
 * Measure SSE latency (ms first token, ms total) against a running gateway.
 */
import pc from 'picocolors';

const url = process.env.GATEWAY_URL ?? 'http://127.0.0.1:20128/v1/chat/completions';
const runs = Number(process.env.RUNS ?? 5);

async function once(): Promise<{ firstMs: number; totalMs: number; tokens: number }> {
  const start = performance.now();
  let first = 0;
  let tokens = 0;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'ping' }], stream: true }),
  });
  if (!r.body) throw new Error('no body');
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (first === 0) first = performance.now() - start;
    buf += dec.decode(value, { stream: true });
    tokens += (buf.match(/\b\d+\b/g) ?? []).length;
    buf = '';
  }
  return { firstMs: first, totalMs: performance.now() - start, tokens };
}

async function main() {
  const results = [];
  for (let i = 0; i < runs; i++) {
    try {
      results.push(await once());
    } catch (e) {
      console.error(pc.red(`run ${i} failed: ${String(e)}`));
    }
  }
  if (results.length === 0) process.exit(1);
  const avg = (key: keyof (typeof results)[number]) => results.reduce((s, r) => s + r[key], 0) / results.length;
  console.log(pc.green(`bench: ${results.length} runs @ ${url}`));
  console.log(`  first-token avg: ${avg('firstMs').toFixed(1)}ms`);
  console.log(`  total avg:       ${avg('totalMs').toFixed(1)}ms`);
  console.log(`  tokens avg:      ${avg('tokens').toFixed(0)}`);
}

main();
