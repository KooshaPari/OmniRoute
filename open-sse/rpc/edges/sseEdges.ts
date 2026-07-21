/**
 * SSE chunking edge — T3 (FFI) primary, F4.
 *
 * The hot inner loop in `open-sse/handlers/chatCore.ts` around line ~1042
 * (`while (true) { await reader.read(); ... }`) reads upstream chunks and
 * frames them into the SSE wire format with the `[DONE]` sentinel. Per
 * `AGENTS.md` and the L5-110 hot-path profiling, this is one of the
 * largest CPU contributors under sustained load.
 *
 * Per ADR-032 § "SSE chunking (the `while(true)` inner loop)":
 *   - Default tier T3 via the `omniroute_ffi_sse_chunking` crate
 *     (Rust + `futures::stream::StreamExt` + SIMD-accelerated JSON
 *     framing via `simd-json`).
 *   - In-process TypeScript fast-path when the crate is missing.
 *
 * See `dispatch.omniidc` "service sse" for the wire shape.
 * See `crates/omniroute-ffi/crates/sse-chunking/src/lib.rs` for the crate.
 */

import { registerEdge } from "../dispatchEdges.ts";
import type { EdgeTier } from "../dispatchEdges.ts";

export const SSE_CHUNKING_EDGE_TIER: EdgeTier = "T3";

export interface SseChunkRequest {
  /** Raw bytes pulled from the upstream provider response. */
  rawBody: string;
  /** Max chunk bytes per SSE frame. Default 4096 (server-push max). */
  maxChunkBytes?: number;
  /** Whether to emit the trailing `data: [DONE]` sentinel. */
  keepOpen?: boolean;
}

export interface SseChunkResponse {
  chunks: string[];
  totalBytes: number;
  durationMicros: number;
}

/**
 * TypeScript reference implementation. Splits the raw body into SSE frames
 * each terminated by `\n\n`, with a trailing `[DONE]` sentinel when
 * `keepOpen` is true. Mirrors `open-sse/handlers/chatCore.ts`'s framing
 * logic so the FFI crate can be a drop-in.
 */
function t1SseChunkHandler(input: SseChunkRequest): SseChunkResponse {
  const start = performance.now();
  const maxBytes = input.maxChunkBytes ?? 4096;
  const keepOpen = input.keepOpen ?? true;

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < input.rawBody.length) {
    const slice = input.rawBody.slice(cursor, cursor + maxBytes);
    if (!slice) break;
    // Frame each chunk as a JSON object if the upstream produced a bare
    // chunk; otherwise pass through.
    const dataPayload = /^[\{\[]/.test(slice.trim())
      ? slice
      : JSON.stringify({ choices: [{ delta: { content: slice } }] });
    chunks.push(`data: ${dataPayload}\n\n`);
    cursor += slice.length;
  }
  if (keepOpen) chunks.push("data: [DONE]\n\n");

  return {
    chunks,
    totalBytes: input.rawBody.length,
    durationMicros: Math.round((performance.now() - start) * 1000),
  };
}

export const SSE_CHUNKING = registerEdge<SseChunkRequest, SseChunkResponse>({
  name: "sse.chunk.sseStream",
  defaultTier: SSE_CHUNKING_EDGE_TIER,
  http: { path: "/api/internal/edges/sse/chunk", timeoutMs: 10 },
  uds: { method: "sse.chunk.sseStream", timeoutMs: 5 },
  ffi: { crate: "omniroute_ffi_sse_chunking", symbol: "chunk_sse_stream", timeoutMs: 3 },
  healthcheck: async () => {
    const r = t1SseChunkHandler({ rawBody: "hello world", keepOpen: true });
    return r.chunks.length >= 2 ? null : "sse chunking smoke produced <2 frames";
  },
});
