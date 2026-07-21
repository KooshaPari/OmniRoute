#!/usr/bin/env node
/**
 * sse-chunking.bench.ts — TS while(true) vs zero-copy Rust (ADR-032 / F4)
 *
 * The SSE hot path in `open-sse/handlers/chatCore.ts:1042-1058` processes
 * upstream bytes one-at-a-time. This benchmark simulates the inner loop
 * with varying payload sizes to measure per-byte overhead.
 *
 * The TS baseline: `Buffer.from(line).toString();` per chunk.
 * The T3 target: zero-copy view into a Rust `Vec<u8>`.
 *
 * Usage:
 *   node --import tsx/esm benches/dispatch/sse-chunking.bench.ts
 */

import { bench } from "./shared.ts";

// ── Fabricated SSE data ────────────────────────────────────────────
// Simulate 50 lines of varying sizes, typical of an LLM streaming response.
const SSE_LINES: string[] = [];
for (let i = 0; i < 50; i++) {
  const size = 10 + (i * 7 + (i * i) % 30) % 500;
  const padding = "x".repeat(Math.max(0, size));
  const line = `data: {"choices":[{"delta":{"content":"token_${i}_${padding}"}}]}`;
  SSE_LINES.push(line);
}

const ITERATIONS = 3000;
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

let lineIdx = 0;

// TS baseline: encode → buffer → decode per chunk
const result = await bench({
  name: "sse-chunking-ts-encode-decode",
  tier: "T3",
  edge: "sse.chunk.sseStream",
  description:
    "TS TextEncoder + TextDecoder per SSE line (matches chatCore hot path)",
  iterations: ITERATIONS,
  run: () => {
    const line = SSE_LINES[lineIdx++ % SSE_LINES.length];
    const encoded = ENCODER.encode(line);
    const decoded = DECODER.decode(encoded);
    return decoded.length;
  },
});

console.log(JSON.stringify(result, null, 2));
