import { DEFAULT_PRICING } from "./pricing/default-pricing";

export { DEFAULT_PRICING } from "./pricing/default-pricing";
// Default pricing rates for AI models
// All rates are in dollars per million tokens ($/1M tokens)
// Based on user-provided pricing for Antigravity models and industry standards for others

// Shared pricing constants to reduce duplication

type ProviderPricingTable = Record<string, Record<string, unknown>>;

/**
 * Get pricing for a specific provider and model
 * @param {string} provider - Provider ID (e.g., "openai", "cc", "antigravity")
 * @param {string} model - Model ID
 * @returns {object|null} Pricing object or null if not found
 */
export function getPricingForModel(
  provider: string,
  model: string
): Record<string, unknown> | null {
  if (!provider || !model) return null;

  const providerPricing = (DEFAULT_PRICING as ProviderPricingTable)[provider];
  if (!providerPricing) return null;

  const modelPricing = providerPricing[model];
  if (!modelPricing || typeof modelPricing !== "object") return null;
  return modelPricing as Record<string, unknown>;
}

/**
 * Get all pricing data
 * @returns {object} All default pricing
 */
export function getDefaultPricing() {
  return DEFAULT_PRICING;
}

/**
 * Calculate cost in USD from token counts and a pricing row.
 *
 * @param tokens - Token usage counts (prompt, completion, cached, reasoning, etc.)
 * @param pricing - Pricing row from getPricingForModel() (rates in $/1M tokens) or null
 * @returns Estimated cost in USD
 */
export function calculateCostFromTokens(
  tokens: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cached_tokens?: number;
    reasoning_tokens?: number;
    cache_creation_input_tokens?: number;
  },
  pricing: Record<string, unknown> | null,
): number {
  if (!pricing) return 0;

  const inputRate = typeof pricing.input === "number" ? pricing.input : 0;
  const outputRate = typeof pricing.output === "number" ? pricing.output : 0;
  const cachedRate = typeof pricing.cached === "number" ? pricing.cached : 0;
  const reasoningRate = typeof pricing.reasoning === "number" ? pricing.reasoning : 0;
  const cacheCreationRate = typeof pricing.cache_creation === "number" ? pricing.cache_creation : 0;

  const promptTokens = tokens.prompt_tokens ?? 0;
  const completionTokens = tokens.completion_tokens ?? 0;
  const cachedTokens = tokens.cached_tokens ?? 0;
  const reasoningTokens = tokens.reasoning_tokens ?? 0;
  const cacheCreationTokens = tokens.cache_creation_input_tokens ?? 0;

  // Non-cached input tokens are billed at the full input rate.
  const nonCachedInput = Math.max(0, promptTokens - cachedTokens);

  const inputCost = (nonCachedInput * inputRate) / 1_000_000;
  const cachedCost = (cachedTokens * cachedRate) / 1_000_000;
  const cacheCreationCost = (cacheCreationTokens * cacheCreationRate) / 1_000_000;
  const outputCost = (completionTokens * outputRate) / 1_000_000;
  const reasoningCost = (reasoningTokens * reasoningRate) / 1_000_000;

  return inputCost + cachedCost + cacheCreationCost + outputCost + reasoningCost;
}

export { formatCost } from "../utils/formatting";
