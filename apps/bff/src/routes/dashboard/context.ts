import { Hono } from "hono";

/**
 * Batch 5 BFF routes — Context dashboard.
 *
 * Provides mock/placeholder data for the SvelteKit Context pages:
 *   - GET /context                list all context modes
 *   - GET /context/settings       global context settings
 *   - GET /context/:mode          per-mode configuration & stats
 *   - GET /context/:mode/stats    live stats for a mode
 *   - GET /context/:mode/preview  preview compression for a mode
 */
export const contextRoutes = new Hono()

  /** List all available context/compression modes. */
  .get("/", (c) => c.json({
    modes: [
      { id: "lite", name: "Lite", description: "Fast, lightweight compression (~10-15% savings)", color: "bg-blue-100 text-blue-800" },
      { id: "standard", name: "Standard", description: "Balanced compression with semantic awareness", color: "bg-green-100 text-green-800" },
      { id: "aggressive", name: "Aggressive", description: "Maximum compression, may lose nuance", color: "bg-red-100 text-red-800" },
      { id: "ultra", name: "Ultra", description: "Ultra-aggressive with ML-assisted summarization", color: "bg-purple-100 text-purple-800" },
      { id: "caveman", name: "Caveman", description: "Rule-based semantic condensation with language packs", color: "bg-amber-100 text-amber-800" },
      { id: "rtk", name: "RTK", description: "Terminal/tool-output compression with JSON DSL filters", color: "bg-orange-100 text-orange-800" },
      { id: "llmlingua", name: "LLMLingua", description: "LLM-based compression with iterative refinement", color: "bg-pink-100 text-pink-800" },
      { id: "omniglyph", name: "Omniglyph", description: "Symbolic token replacement for code/markup", color: "bg-indigo-100 text-indigo-800" },
      { id: "ccr", name: "CCR", description: "Context-aware condensation & redundancy removal", color: "bg-teal-100 text-teal-800" },
      { id: "headroom", name: "Headroom", description: "Keeps only context within token budget", color: "bg-cyan-100 text-cyan-800" },
      { id: "session-dedup", name: "Session Dedup", description: "Removes repeated content across conversation turns", color: "bg-lime-100 text-lime-800" },
      { id: "combos", name: "Combos", description: "Stacked multi-engine compression pipelines", color: "bg-violet-100 text-violet-800" },
    ],
  }))

  /** Global context settings. */
  .get("/settings", (c) => c.json({
    defaultMode: "lite",
    autoTriggerThreshold: 0.7,
    maxTokensBeforeCompress: 8000,
    enableStackedPipelines: true,
    fallbackMode: "lite",
    compressionComboId: null,
  }))

  /** Per-mode configuration & stats. */
  .get("/:mode", (c) => {
    const mode = c.req.param("mode");
    const configs: Record<string, any> = {
      lite: { techniques: ["collapseWhitespace", "dedupSystemPrompt", "compressToolResults", "removeRedundantContent", "replaceImageUrls"], targetSavingsPct: 12, avgLatencyMs: 2 },
      standard: { techniques: ["semanticDedup", "summarizeToolOutputs", "pruneVerboseSections"], targetSavingsPct: 25, avgLatencyMs: 15 },
      aggressive: { techniques: ["aggressiveSummarize", "dropLowPriority", "compressCodeBlocks"], targetSavingsPct: 45, avgLatencyMs: 40 },
      ultra: { techniques: ["mlSummarize", "extractKeyFacts", "reconstructMinimal"], targetSavingsPct: 60, avgLatencyMs: 120 },
      caveman: { techniques: ["cavemanCondense", "languagePackRules", "semanticCluster"], targetSavingsPct: 35, avgLatencyMs: 30, languagePacks: ["en", "zh", "es", "fr", "de", "ja", "ko"] },
      rtk: { techniques: ["commandOutputClassify", "jsonFilterPacks", "dedupRepeatedLines", "stripAnsiCodeNoise", "preserveErrors"], targetSavingsPct: 50, avgLatencyMs: 25, filterPacks: ["default", "kubernetes", "docker", "terraform", "ci-cd"] },
      llmlingua: { techniques: ["iterativeRefinement", "tokenImportanceScoring", "contextAwarePruning"], targetSavingsPct: 40, avgLatencyMs: 200, model: "gpt-4o-mini" },
      omniglyph: { techniques: ["symbolicReplace", "patternMatch", "restoreOnDecode"], targetSavingsPct: 30, avgLatencyMs: 10, patterns: ["code", "markup", "json", "yaml"] },
      ccr: { techniques: ["contextAwareCondense", "redundancyDetection", "crossTurnDedup"], targetSavingsPct: 28, avgLatencyMs: 50 },
      headroom: { techniques: ["tokenBudgetEnforce", "priorityRetention", "progressiveTruncate"], targetSavingsPct: 35, avgLatencyMs: 5 },
      "session-dedup": { techniques: ["crossTurnHash", "semanticSimilarity", "rollingWindow"], targetSavingsPct: 20, avgLatencyMs: 8, windowTurns: 10 },
      combos: { techniques: ["stackedPipeline", "engineRegistry", "adaptiveSelection"], targetSavingsPct: 55, avgLatencyMs: 60, engines: ["caveman", "rtk"] },
    };
    return c.json(configs[mode] ?? { error: "Unknown mode", mode });
  })

  /** Live stats for a mode. */
  .get("/:mode/stats", (c) => {
    const mode = c.req.param("mode");
    return c.json({
      mode,
      requestsTotal: 1247,
      tokensOriginal: 45_231_000,
      tokensCompressed: 31_145_000,
      savingsPct: 31.1,
      avgLatencyMs: 28,
      p50LatencyMs: 12,
      p99LatencyMs: 145,
      errorRate: 0.003,
      lastUpdated: new Date().toISOString(),
    });
  })

  /** Preview compression for a mode. */
  .get("/:mode/preview", async (c) => {
    const mode = c.req.param("mode");
    const text = c.req.query("text") ?? "Sample text for compression preview.";
    return c.json({
      mode,
      original: text,
      compressed: `[${mode.toUpperCase()}] ${text.slice(0, 50)}...`,
      originalTokens: Math.ceil(text.length / 4),
      compressedTokens: Math.ceil(text.length / 6),
      savingsPct: 33,
      latencyMs: 5,
    });
  });