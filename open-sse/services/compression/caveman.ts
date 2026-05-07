import type { CavemanConfig, CavemanRule, CompressionResult, CompressionMode } from "./types.ts";
import { DEFAULT_CAVEMAN_CONFIG } from "./types.ts";
import { CAVEMAN_RULES, getRulesForContext } from "./cavemanRules.ts";
import { extractPreservedBlocks, restorePreservedBlocks } from "./preservation.ts";
import { createCompressionStats, estimateCompressionTokens } from "./stats.ts";

interface ChatMessage {
  role: string;
  content?: string | Array<{ type: string; text?: string }>;
}

interface ChatRequestBody {
  messages?: ChatMessage[];
  [key: string]: unknown;
}

export function applyRulesToText(
  text: string,
  rules: CavemanRule[]
): { text: string; appliedRules: string[] } {
  let result = text;
  const appliedRules: string[] = [];

  for (const rule of rules) {
    const before = result;
    const { pattern, replacement } = rule;
    if (typeof replacement === "function") {
      const fn = replacement;
      result = result.replace(pattern, (...args) => {
        const match = args[0];
        return fn(match, ...args.slice(1, -2));
      });
    } else {
      result = result.replace(pattern, replacement);
    }
    if (result !== before) {
      appliedRules.push(rule.name);
    }
  }

  return { text: result, appliedRules };
}

function cleanupArtifacts(text: string): string {
  let result = text;
  result = result.replace(/  +/g, " ");
  result = result.replace(/ +$/gm, "");
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.replace(/^\n+/, "");
  result = result.replace(/\n+$/, "");
  return result;
}

export function cavemanCompress(
  body: ChatRequestBody,
  options?: Partial<CavemanConfig>
): CompressionResult {
  const startMs = performance.now();
  const config: CavemanConfig = { ...DEFAULT_CAVEMAN_CONFIG, ...options };

  const emptyResult = (): CompressionResult => ({
    body: body as unknown as Record<string, unknown>,
    compressed: false,
    stats: createCompressionStats(
      body as unknown as Record<string, unknown>,
      body as unknown as Record<string, unknown>,
      "standard" as CompressionMode,
      []
    ),
  });

  if (!config.enabled) {
    return emptyResult();
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return emptyResult();
  }

  let totalOriginalTokens = 0;
  let totalCompressedTokens = 0;
  const allAppliedRules: string[] = [];

  const compressedMessages = body.messages.map((msg): ChatMessage => {
    // Only compress simple string content — multi-part messages (arrays)
    // would duplicate compressed text across all text parts if naively handled
    if (typeof msg.content !== "string") {
      const contentStr = Array.isArray(msg.content)
        ? msg.content
            .map((part) => (part.type === "text" && part.text ? part.text : ""))
            .filter(Boolean)
            .join("\n")
        : "";
      totalOriginalTokens += estimateCompressionTokens(contentStr);
      totalCompressedTokens += estimateCompressionTokens(contentStr);
      return msg;
    }

    const contentStr = msg.content;
    totalOriginalTokens += estimateCompressionTokens(contentStr);

    if (!contentStr || contentStr.length < config.minMessageLength) {
      totalCompressedTokens += estimateCompressionTokens(contentStr);
      return msg;
    }

    if (!config.compressRoles.includes(msg.role as "user" | "assistant" | "system")) {
      totalCompressedTokens += estimateCompressionTokens(contentStr);
      return msg;
    }

    const { text: extractedText, blocks } = extractPreservedBlocks(contentStr);

    const rules = getRulesForContext(msg.role).filter(
      (rule) => !config.skipRules.includes(rule.name)
    );
    const { text: rulesApplied, appliedRules } = applyRulesToText(extractedText, rules);
    allAppliedRules.push(...appliedRules);

    const restored = restorePreservedBlocks(rulesApplied, blocks);

    const cleaned = cleanupArtifacts(restored);

    totalCompressedTokens += estimateCompressionTokens(cleaned);

    return { ...msg, content: cleaned };
  });

  const durationMs = performance.now() - startMs;
  const uniqueRules = [...new Set(allAppliedRules)];
  const stats = createCompressionStats(
    body as unknown as Record<string, unknown>,
    { ...body, messages: compressedMessages } as unknown as Record<string, unknown>,
    "standard" as CompressionMode,
    uniqueRules.length > 0 ? ["caveman-rules"] : [],
    uniqueRules.length > 0 ? uniqueRules : undefined,
    Math.round(durationMs * 100) / 100
  );

  const compressed = totalCompressedTokens < totalOriginalTokens;

  const result: CompressionResult = {
    body: { ...body, messages: compressedMessages } as unknown as Record<string, unknown>,
    compressed,
    stats,
  };

  return result;
}
