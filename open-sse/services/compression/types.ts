/**
 * Compression Pipeline Types — Phase 1 (Lite) + Phase 2 (Standard/Caveman) + Phase 3 (Aggressive) + Phase 4 (Ultra)
 *
 * Shared type definitions for the compression pipeline.
 * Phase 1: 'off' and 'lite' modes.
 * Phase 2: 'standard' mode (caveman engine).
 * Phase 3: 'aggressive' mode (summarization + tool compression + aging).
 * Phase 4: 'ultra' mode (heuristic token pruning + optional SLM tier).
 */

export type CompressionMode = "off" | "lite" | "standard" | "aggressive" | "ultra";

export interface CavemanRule {
  name: string;
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
  context: "all" | "user" | "system" | "assistant";
  preservePatterns?: RegExp[];
}

export interface CavemanConfig {
  enabled: boolean;
  compressRoles: ("user" | "assistant" | "system")[];
  skipRules: string[];
  minMessageLength: number;
  preservePatterns: string[];
}

export interface CompressionConfig {
  enabled: boolean;
  defaultMode: CompressionMode;
  autoTriggerTokens: number;
  cacheMinutes: number;
  preserveSystemPrompt: boolean;
  comboOverrides: Record<string, CompressionMode>;
  cavemanConfig?: CavemanConfig;
  aggressive?: AggressiveConfig;
  ultra?: UltraConfig;
}

export interface CompressionStats {
  originalTokens: number;
  compressedTokens: number;
  savingsPercent: number;
  techniquesUsed: string[];
  mode: CompressionMode;
  timestamp: number;
  rulesApplied?: string[];
  durationMs?: number;
  aggressive?: {
    summarizerSavings: number;
    toolResultSavings: number;
    agingSavings: number;
  };
}

export interface CompressionResult {
  body: Record<string, unknown>;
  compressed: boolean;
  stats: CompressionStats | null;
}

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  enabled: false,
  defaultMode: "off",
  autoTriggerTokens: 0,
  cacheMinutes: 5,
  preserveSystemPrompt: true,
  comboOverrides: {},
};

export const DEFAULT_CAVEMAN_CONFIG: CavemanConfig = {
  enabled: true,
  compressRoles: ["user"],
  skipRules: [],
  minMessageLength: 50,
  preservePatterns: [],
};

/** Aging thresholds for progressive message degradation (Phase 3) */
export interface AgingThresholds {
  fullSummary: number;
  moderate: number;
  light: number;
  verbatim: number;
}

/** Tool result compression strategy toggles (Phase 3) */
export interface ToolStrategiesConfig {
  fileContent: boolean;
  grepSearch: boolean;
  shellOutput: boolean;
  json: boolean;
  errorMessage: boolean;
}

/** Configuration for aggressive compression mode (Phase 3) */
export interface AggressiveConfig {
  thresholds: AgingThresholds;
  toolStrategies: ToolStrategiesConfig;
  summarizerEnabled: boolean;
  maxTokensPerMessage: number;
  minSavingsThreshold: number;
}

/** Options for the Summarizer interface (Phase 3) */
export interface SummarizerOpts {
  maxLen?: number;
  preserveCode?: boolean;
}

/** Summarizer interface — rule-based default, LLM-ready for future drop-in (Phase 3) */
export interface Summarizer {
  summarize(messages: unknown[], opts?: SummarizerOpts): string;
}

/** Default aggressive configuration (Phase 3) */
export const DEFAULT_AGGRESSIVE_CONFIG: AggressiveConfig = {
  thresholds: { fullSummary: 5, moderate: 3, light: 2, verbatim: 2 },
  toolStrategies: {
    fileContent: true,
    grepSearch: true,
    shellOutput: true,
    json: true,
    errorMessage: true,
  },
  summarizerEnabled: true,
  maxTokensPerMessage: 2048,
  minSavingsThreshold: 0.05,
};

// ─── Phase 4: Ultra Compression ──────────────────────────────────────────────

export interface UltraConfig {
  /** Enable ultra compression (disabled by default). */
  enabled: boolean;
  /**
   * Fraction of tokens to keep after heuristic pruning (0–1).
   * Default 0.5 = keep 50 % of scored tokens.
   */
  compressionRate: number;
  /**
   * Minimum score threshold below which a token is eligible for pruning.
   * Tokens scoring below this value are candidates for removal.
   */
  minScoreThreshold: number;
  /**
   * When true, fall back to aggressive mode if SLM tier is requested but
   * no modelPath is configured.
   */
  slmFallbackToAggressive: boolean;
  /**
   * Optional path to a local SLM ONNX model file.
   * When absent, only the heuristic (Tier A) is used.
   */
  modelPath?: string;
  /**
   * Maximum tokens per message before ultra compression is applied.
   * 0 = always apply when mode is "ultra".
   */
  maxTokensPerMessage: number;
}

export const DEFAULT_ULTRA_CONFIG: UltraConfig = {
  enabled: false,
  compressionRate: 0.5,
  minScoreThreshold: 0.3,
  slmFallbackToAggressive: true,
  maxTokensPerMessage: 0,
};
