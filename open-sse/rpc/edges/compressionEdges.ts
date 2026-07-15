/**
 * Compression edges — T2 (UDS RPC) primary, F3.
 *
 * Wraps the Lite techniques + RTK so they can run in a co-located Rust
 * process over UDS, with an in-process TypeScript fast-path fallback for
 * low-RPS deployments (no UDS server = no benefit).
 *
 * See `polyglot.omniidc` "service compression" for the wire shape.
 * See `open-sse/services/compression/lite.ts` for the TS reference impl.
 * See ADR-032 § "Prompt compression (lite / caveman / rtk)" — T2 tier.
 */

import { registerEdge } from "../polyglotEdges.ts";
import type { EdgeTier } from "../polyglotEdges.ts";
import type { LiteCompressionOptions } from "../../services/compression/lite.ts";
import {
  collapseWhitespace,
  compressToolResults,
  dedupSystemPrompt,
  removeRedundantContent,
  replaceImageUrls,
} from "../../services/compression/lite.ts";

export const COMPRESSION_EDGE_TIER: EdgeTier = "T2";

export interface CompressionLiteRequest {
  body: {
    messages?: Array<{ role: string; content: string }>;
  };
  options?: LiteCompressionOptions;
}

export interface CompressionLiteResponse {
  body: { messages?: Array<{ role: string; content: string }> };
  applied: boolean;
  technique: string;
  originalTokens: number;
  compressedTokens: number;
  version: number;
}

export interface RtkRequest {
  output: string;
  command?: string | null;
  intensity?: "minimal" | "standard" | "aggressive";
}

export interface RtkResponse {
  output: string;
  applied: boolean;
  technique: string;
  originalTokens: number;
  compressedTokens: number;
  version: number;
}

function estimateTokens(text: string): number {
  // ~4 chars/token heuristic; matches the Lite technique's own estimate.
  return Math.ceil(text.length / 4);
}

function t1LiteHandler(input: CompressionLiteRequest): CompressionLiteResponse {
  const result = collapseWhitespace(input.body as never, input.options ?? {});
  return {
    body: result.body as CompressionLiteResponse["body"],
    applied: result.applied,
    technique: "collapseWhitespace",
    originalTokens: estimateTokens(JSON.stringify(input.body)),
    compressedTokens: estimateTokens(JSON.stringify(result.body)),
    version: 1,
  };
}

async function t1RtkHandler(input: RtkRequest): Promise<RtkResponse> {
  // Lazy import: the RTK engine depends on 'typescript' which may not be
  // available in all environments. We fall back to a no-op pass-through
  // when the import fails (e.g. missing typescript package).
  let processRtkText:
    | ((
        text: string,
        options?: {
          command?: string | null;
          config?: { intensity?: "minimal" | "standard" | "aggressive" };
        }
      ) => {
        text: string;
        compressed: boolean;
        originalTokens: number;
        compressedTokens: number;
      })
    | null = null;
  try {
    const m = await import("../../services/compression/engines/rtk/index.ts");
    processRtkText = m.processRtkText;
  } catch {
    // RTK unavailable (typescript missing, network-less env, etc.) — pass through.
  }
  if (!processRtkText) {
    return {
      output: input.output,
      applied: false,
      technique: "rtk:unavailable",
      originalTokens: estimateTokens(input.output),
      compressedTokens: estimateTokens(input.output),
      version: 1,
    };
  }
  const result = processRtkText(input.output, {
    command: input.command ?? null,
    config: input.intensity ? { intensity: input.intensity } : undefined,
  });
  return {
    output: result.text,
    applied: result.compressed,
    technique: "rtk:terminal",
    originalTokens: result.originalTokens,
    compressedTokens: result.compressedTokens,
    version: 1,
  };
}

export const COMPRESSION_LITE_COLLAPSE = registerEdge<CompressionLiteRequest, CompressionLiteResponse>({
  name: "compression.lite.collapseWhitespace",
  defaultTier: COMPRESSION_EDGE_TIER,
  http: { path: "/api/internal/edges/compression/lite", timeoutMs: 100 },
  uds: { method: "lite.collapseWhitespace", timeoutMs: 50 },
  healthcheck: async () => {
    const r = collapseWhitespace({ messages: [{ role: "user", content: "ok" }] }, {});
    return r.applied !== undefined ? null : "lite.collapseWhitespace smoke test failed";
  },
});

export const COMPRESSION_LITE_TOOL_RESULTS = registerEdge<CompressionLiteRequest, CompressionLiteResponse>({
  name: "compression.lite.compressToolResults",
  defaultTier: COMPRESSION_EDGE_TIER,
  http: { path: "/api/internal/edges/compression/lite", timeoutMs: 100 },
  uds: { method: "lite.compressToolResults", timeoutMs: 50 },
});

export const COMPRESSION_LITE_DEDUP_SYSTEM = registerEdge<CompressionLiteRequest, CompressionLiteResponse>({
  name: "compression.lite.dedupSystemPrompt",
  defaultTier: COMPRESSION_EDGE_TIER,
  http: { path: "/api/internal/edges/compression/lite", timeoutMs: 100 },
  uds: { method: "lite.dedupSystemPrompt", timeoutMs: 50 },
});

export const COMPRESSION_LITE_REDUNDANT = registerEdge<CompressionLiteRequest, CompressionLiteResponse>({
  name: "compression.lite.removeRedundantContent",
  defaultTier: COMPRESSION_EDGE_TIER,
  http: { path: "/api/internal/edges/compression/lite", timeoutMs: 100 },
  uds: { method: "lite.removeRedundantContent", timeoutMs: 50 },
});

export const COMPRESSION_LITE_IMAGE_URLS = registerEdge<CompressionLiteRequest, CompressionLiteResponse>({
  name: "compression.lite.replaceImageUrls",
  defaultTier: COMPRESSION_EDGE_TIER,
  http: { path: "/api/internal/edges/compression/lite", timeoutMs: 100 },
  uds: { method: "lite.replaceImageUrls", timeoutMs: 50 },
});

export const COMPRESSION_RTK_TERMINAL = registerEdge<RtkRequest, RtkResponse>({
  name: "compression.rtk.compressTerminalOutput",
  defaultTier: COMPRESSION_EDGE_TIER,
  http: { path: "/api/internal/edges/compression/rtk", timeoutMs: 200 },
  uds: { method: "rtk.compressTerminalOutput", timeoutMs: 100 },
  healthcheck: async () => {
    const out = await t1RtkHandler({ output: "$ ls\na\nb\nc", command: "ls" });
    return out.applied === undefined ? "rtk smoke failed" : null;
  },
});

// In-process handlers — bound into the UDS server when the process binds one.
export const compressionHandlers = {
  "lite.collapseWhitespace": t1LiteHandler,
  "lite.compressToolResults": (input: CompressionLiteRequest) => {
    const r = compressToolResults(input.body as never);
    return {
      body: r.body as CompressionLiteResponse["body"],
      applied: r.applied,
      technique: "compressToolResults",
      originalTokens: estimateTokens(JSON.stringify(input.body)),
      compressedTokens: estimateTokens(JSON.stringify(r.body)),
      version: 1,
    };
  },
  "lite.dedupSystemPrompt": (input: CompressionLiteRequest) => {
    const r = dedupSystemPrompt(input.body as never, input.options ?? {});
    return {
      body: r.body as CompressionLiteResponse["body"],
      applied: r.applied,
      technique: "dedupSystemPrompt",
      originalTokens: estimateTokens(JSON.stringify(input.body)),
      compressedTokens: estimateTokens(JSON.stringify(r.body)),
      version: 1,
    };
  },
  "lite.removeRedundantContent": (input: CompressionLiteRequest) => {
    const r = removeRedundantContent(input.body as never, input.options ?? {});
    return {
      body: r.body as CompressionLiteResponse["body"],
      applied: r.applied,
      technique: "removeRedundantContent",
      originalTokens: estimateTokens(JSON.stringify(input.body)),
      compressedTokens: estimateTokens(JSON.stringify(r.body)),
      version: 1,
    };
  },
  "lite.replaceImageUrls": (input: CompressionLiteRequest) => {
    const r = replaceImageUrls(
      input.body as never,
      input.options?.model ?? "gpt-4o"
    );
    return {
      body: r.body as CompressionLiteResponse["body"],
      applied: r.applied,
      technique: "replaceImageUrls",
      originalTokens: estimateTokens(JSON.stringify(input.body)),
      compressedTokens: estimateTokens(JSON.stringify(r.body)),
      version: 1,
    };
  },
  "rtk.compressTerminalOutput": t1RtkHandler,
} as const;
