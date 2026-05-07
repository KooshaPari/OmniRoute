import { pruneByScore } from "./ultraHeuristic.ts";
import { DEFAULT_ULTRA_CONFIG } from "./types.ts";
import type { UltraConfig, CompressionStats, CompressionMode } from "./types.ts";

const COMPRESSED_PREFIX = "[COMPRESSED:";

export interface SLMInterface {
  compress(text: string, rate: number): Promise<string>;
}

export function createSLMStub(): SLMInterface {
  return {
    async compress(text: string, rate: number): Promise<string> {
      return pruneByScore(text, rate);
    },
  };
}

export interface UltraCompressResult {
  messages: Array<{ role: string; content?: string | unknown[]; [key: string]: unknown }>;
  stats: CompressionStats;
}

type Message = { role: string; content?: string | unknown[]; [key: string]: unknown };

function extractText(content: string | unknown[] | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return (content as Array<{ type?: string; text?: string }>)
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n");
}

function applyTextToContent(
  original: string | unknown[] | undefined,
  compressed: string
): string | unknown[] {
  if (!original || typeof original === "string") return compressed;
  return (original as Array<{ type?: string; text?: string; [k: string]: unknown }>).map((b) =>
    b.type === "text" ? { ...b, text: compressed } : b
  );
}

export function ultraCompress(
  messages: Message[],
  config: Partial<UltraConfig> = {}
): UltraCompressResult {
  const start = Date.now();
  const effectiveConfig: UltraConfig = {
    ...DEFAULT_ULTRA_CONFIG,
    ...config,
  };
  const { compressionRate, minScoreThreshold, maxTokensPerMessage } = effectiveConfig;

  let originalChars = 0;
  let compressedChars = 0;

  const compressed = messages.map((msg) => {
    const text = extractText(msg.content);
    if (!text) return msg;
    if (text.startsWith(COMPRESSED_PREFIX)) return msg;
    if (maxTokensPerMessage > 0 && Math.ceil(text.length / 4) <= maxTokensPerMessage) {
      return msg;
    }

    originalChars += text.length;
    const pruned = pruneByScore(text, compressionRate, minScoreThreshold);
    compressedChars += pruned.length;

    return {
      ...msg,
      content: applyTextToContent(msg.content, pruned),
    };
  });

  const originalTokens = Math.ceil(originalChars / 4);
  const compressedTokens = Math.ceil(compressedChars / 4);
  const savingsPercent =
    originalTokens > 0
      ? Math.round(((originalTokens - compressedTokens) / originalTokens) * 100 * 10) / 10
      : 0;

  const stats: CompressionStats = {
    originalTokens,
    compressedTokens,
    savingsPercent,
    techniquesUsed: ["ultra-heuristic-pruning"],
    mode: "ultra" as CompressionMode,
    timestamp: Date.now(),
    durationMs: Date.now() - start,
  };

  return { messages: compressed, stats };
}
