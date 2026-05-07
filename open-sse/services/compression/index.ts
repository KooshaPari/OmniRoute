export type {
  CompressionMode,
  CompressionConfig,
  CompressionStats,
  CompressionResult,
  CavemanConfig,
  CavemanRule,
  AggressiveConfig,
  AgingThresholds,
  ToolStrategiesConfig,
  SummarizerOpts,
  Summarizer,
} from "./types.ts";

export {
  DEFAULT_COMPRESSION_CONFIG,
  DEFAULT_CAVEMAN_CONFIG,
  DEFAULT_AGGRESSIVE_CONFIG,
} from "./types.ts";

export {
  applyLiteCompression,
  collapseWhitespace,
  dedupSystemPrompt,
  compressToolResults,
  removeRedundantContent,
  replaceImageUrls,
} from "./lite.ts";

export { cavemanCompress, applyRulesToText } from "./caveman.ts";
export { getRulesForContext, CAVEMAN_RULES } from "./cavemanRules.ts";
export { extractPreservedBlocks, restorePreservedBlocks } from "./preservation.ts";

export {
  estimateCompressionTokens,
  createCompressionStats,
  trackCompressionStats,
  getDefaultCompressionConfig,
} from "./stats.ts";

export {
  selectCompressionStrategy,
  getEffectiveMode,
  applyCompression,
  checkComboOverride,
  shouldAutoTrigger,
} from "./strategySelector.ts";

export { RuleBasedSummarizer, createSummarizer } from "./summarizer.ts";

export { compressToolResult } from "./toolResultCompressor.ts";
export type { CompressionResult as ToolCompressionResult } from "./toolResultCompressor.ts";

export { applyAging } from "./progressiveAging.ts";

export { compressAggressive } from "./aggressive.ts";

export { STOPWORDS, FORCE_PRESERVE_RE, scoreToken, pruneByScore } from "./ultraHeuristic.ts";

export type { SLMInterface, UltraCompressResult } from "./ultra.ts";
export { createSLMStub, ultraCompress } from "./ultra.ts";

export type { UltraConfig } from "./types.ts";
export { DEFAULT_ULTRA_CONFIG } from "./types.ts";
