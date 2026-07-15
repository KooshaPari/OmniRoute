// Re-export from open-sse with localDb integration
<<<<<<< Updated upstream
import {
  getModelAliases,
  getComboByName,
  getComboById,
  getComboByNameInsensitive,
  getProviderNodes,
  getCustomModels,
} from "@/lib/localDb";
import { getCachedSettings } from "@/lib/localDb";
import { parseModel, getModelInfoCore } from "@omniroute/open-sse/services/model.ts";
import { REGISTRY } from "@omniroute/open-sse/config/providerRegistry.ts";
=======
import { getModelAliases, getComboByName, getProviderNodes, getCustomModels } from "@/lib/localDb";
import { getSettings } from "@/lib/localDb";
import { getComboStepTarget } from "@/lib/combos/steps";
import {
  parseModel,
  resolveModelAliasFromMap,
  getModelInfoCore,
} from "@omniroute/open-sse/services/model.ts";
>>>>>>> Stashed changes

export { parseModel };

/**
<<<<<<< Updated upstream
 * Reserved provider prefixes — built-in provider ids + aliases. User-defined
 * compatible-node prefixes must not be allowed to shadow these, otherwise a
 * node with prefix="cf" would hijack cloudflare-ai requests (and similar for
 * every built-in provider). Ported from upstream 9router 047fdc89.
 *
 * Built lazily so the registry is only walked once per process.
 */
let _reservedProviderPrefixes: Set<string> | null = null;
function getReservedProviderPrefixes(): Set<string> {
  if (_reservedProviderPrefixes) return _reservedProviderPrefixes;
  const reserved = new Set<string>();
  for (const entry of Object.values(REGISTRY)) {
    if (entry?.id) reserved.add(entry.id);
    if (entry?.alias) reserved.add(entry.alias);
  }
  _reservedProviderPrefixes = reserved;
  return reserved;
}

/**
 * Build a combined model alias map that merges both alias stores:
 * 1. DB-namespace aliases (key_value WHERE namespace='modelAliases') — set via
 *    /api/models/alias/ and seeded at startup.
 * 2. Settings-based aliases (settings.modelAliases) — set via the Settings UI and
 *    /api/settings/model-aliases/ (stored as a JSON blob in namespace='settings').
 *
 * Settings-based aliases take priority so that UI configuration always wins.
 * Without this merge, aliases configured via the Settings UI were never consulted
 * during provider routing, causing provider inference (e.g. /^gpt-/ → openai) to
 * silently override them (issue #2618 / #2208).
 */
async function getCombinedModelAliases(): Promise<Record<string, unknown>> {
  const [dbAliases, settings] = await Promise.all([
    getModelAliases().catch(() => ({})),
    getCachedSettings().catch(() => ({}) as Record<string, unknown>),
  ]);

  const settingsAliases =
    settings.modelAliases &&
    typeof settings.modelAliases === "object" &&
    !Array.isArray(settings.modelAliases)
      ? (settings.modelAliases as Record<string, unknown>)
      : {};

  // Settings-based aliases win over DB-namespace aliases on key collision
  return { ...dbAliases, ...settingsAliases };
}

/**
 * Look up custom-model metadata from the DB in a single read:
 *  - apiFormat: "responses" when the model is configured for the Responses API.
 *  - targetFormat: the optional per-model wire format override (#2905).
=======
 * Resolve model alias from localDb
 */
export async function resolveModelAlias(alias) {
  const aliases = await getModelAliases();
  return resolveModelAliasFromMap(alias, aliases);
}

/**
 * Look up the apiFormat for a custom model from the DB.
 * Returns "responses" if the model is configured for the Responses API, otherwise undefined.
>>>>>>> Stashed changes
 */
async function lookupCustomModelApiFormat(
  providerId: string,
  modelId: string
): Promise<string | undefined> {
  try {
    const models = await getCustomModels(providerId);
    if (!Array.isArray(models)) return undefined;
    const match = models.find((m: any) => m.id === modelId);
    return match?.apiFormat === "responses" ? "responses" : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get full model info (parse or resolve)
 */
export async function getModelInfo(modelStr) {
  const parsed = parseModel(modelStr);
  const { extendedContext } = parsed;

  // Check custom provider nodes first (for both alias and non-alias formats)
  if (parsed.providerAlias || parsed.provider) {
    // Ensure prefixToCheck is always a concise identifier, not a full model string
    const prefixToCheck = parsed.providerAlias || parsed.provider;

<<<<<<< Updated upstream
    // Compatible-node prefixes are user-defined. They must not be allowed to
    // shadow built-in provider ids/aliases (e.g. `cf` → cloudflare-ai). When
    // prefixToCheck matches a built-in registry id/alias, skip the compatible-
    // node prefix lookup so the request still routes to the built-in provider.
    // Internal UUID-prefixed node ids (e.g. "openai-compatible-responses-...")
    // are never in the reserved set, so the #2778 combo path still works.
    // Ported from upstream 9router 047fdc89.
    const reserved = getReservedProviderPrefixes();
    const isReservedPrefix = typeof prefixToCheck === "string" && reserved.has(prefixToCheck);

    if (!isReservedPrefix) {
      // Check OpenAI Compatible nodes
      // Match by node.prefix (user-defined alias) OR node.id (internal UUID id stored by
      // combo steps), so that combo targets using the internal node id still resolve
      // correctly (#2778).
      const openaiNodes = await getProviderNodes({ type: "openai-compatible" });
      const matchedOpenAI = openaiNodes.find(
        (node) => node.prefix === prefixToCheck || node.id === prefixToCheck
=======
    // Check OpenAI Compatible nodes
    const openaiNodes = await getProviderNodes({ type: "openai-compatible" });
    const matchedOpenAI = openaiNodes.find((node) => node.prefix === prefixToCheck);
    if (matchedOpenAI) {
      const apiFormat = await lookupCustomModelApiFormat(
        matchedOpenAI.id as string,
        parsed.model as string
>>>>>>> Stashed changes
      );
      return {
        provider: matchedOpenAI.id,
        model: parsed.model,
        extendedContext,
        ...(apiFormat && { apiFormat }),
      };
    }

    // Check Anthropic Compatible nodes
    const anthropicNodes = await getProviderNodes({ type: "anthropic-compatible" });
    const matchedAnthropic = anthropicNodes.find((node) => node.prefix === prefixToCheck);
    if (matchedAnthropic) {
      const apiFormat = await lookupCustomModelApiFormat(
        matchedAnthropic.id as string,
        parsed.model as string
      );
      return {
        provider: matchedAnthropic.id,
        model: parsed.model,
        extendedContext,
        ...(apiFormat && { apiFormat }),
      };
    }

    // stripModelPrefix: if enabled, strip provider prefix and re-resolve
    // the bare model name using existing heuristics (claude-* → anthropic, etc.)
    try {
      const settings = await getSettings();
      if (settings.stripModelPrefix === true) {
        const strippedResult = await getModelInfoCore(parsed.model, getModelAliases);
        return { ...strippedResult, extendedContext };
      }
    } catch {
      // If settings read fails, fall through to normal resolution
    }
  }

  if (!parsed.isAlias) {
    return getModelInfoCore(modelStr, null);
  }

  return getModelInfoCore(modelStr, getModelAliases);
}

/**
 * Check if model is a combo and return the full combo object
 * @returns {Promise<Object|null>} Full combo object or null if not a combo
 */
export async function getCombo(modelStr) {
  // Try exact match first (supports combos actually named "combo/ANY")
  let combo = await getComboByName(modelStr);
  if (combo && combo.models && combo.models.length > 0) {
    return combo;
  }

  // Fallback: Strip combo/ prefix if present
  if (modelStr.startsWith("combo/")) {
    const nameToSearch = modelStr.substring(6);
    combo = await getComboByName(nameToSearch);
    if (combo && combo.models && combo.models.length > 0) {
      return combo;
    }
  }

  return null;
}

/**
 * Check if model matches a combo by name OR by model-combo mapping pattern.
 * This augments getCombo() with glob-based model-to-combo resolution (#563).
 *
 * Resolution order:
 * 1. Exact combo name match (existing behavior)
 * 2. Model-combo mapping pattern match (new — glob patterns by priority)
 * 3. null (no combo — single-model request)
 */
export async function getComboForModel(modelStr) {
  // 1. Existing behavior — exact combo name match
  const combo = await getCombo(modelStr);
  if (combo) return combo;

  // 2. NEW — check model-combo mappings table (pattern match)
  try {
    const { resolveComboForModel } = await import("@/lib/localDb");
    const mapped = await resolveComboForModel(modelStr);
    if (mapped && (mapped as any).models?.length > 0) {
      return mapped;
    }
  } catch {
    // If the mappings table doesn't exist yet (pre-migration), continue gracefully
  }

  return null;
}
