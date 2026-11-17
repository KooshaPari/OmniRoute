/**
 * OpenRouter-compatible provider routing preferences.
 *
 * Reads the `provider` object from a request body, filters a candidate list by
 * `only` / `ignore` / `quantizations`, and orders providers by `order`.
 * `providerOptions` is parsed as a per-provider option bag.
 *
 * Ported from thegent-routing's provider_preferences.py. Pricing-dependent
 * filters (`sort`, `max_price`) are parsed and serialized but are not applied
 * here; callers with live pricing can apply them around this module.
 */

export type ProviderSort = "price" | "throughput" | "latency";
export type DataCollection = "allow" | "deny";

export interface PriceConstraint {
  prompt?: number | null;
  completion?: number | null;
}

export interface ProviderPreferences {
  order: string[];
  only: string[];
  ignore: string[];
  allowFallbacks: boolean;
  dataCollection: DataCollection;
  quantizations: string[];
  sort?: ProviderSort | null;
  maxPrice: PriceConstraint;
}

export interface ProviderOptions {
  options: Record<string, Record<string, unknown>>;
}

export interface ProviderCandidate {
  provider: string;
  model: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseSort(value: unknown): ProviderSort | null | undefined {
  if (value === null || value === undefined) return value;
  if (value === "price" || value === "throughput" || value === "latency") return value;
  return undefined;
}

export function extractProviderPreferences(
  body: Record<string, unknown>
): ProviderPreferences | null {
  const raw = body.provider;
  if (!isPlainObject(raw)) return null;

  const maxPriceRaw = isPlainObject(raw.max_price) ? raw.max_price : {};
  const maxPrice: PriceConstraint = {
    ...(optionalNumber(maxPriceRaw.prompt) !== undefined
      ? { prompt: optionalNumber(maxPriceRaw.prompt) }
      : {}),
    ...(optionalNumber(maxPriceRaw.completion) !== undefined
      ? { completion: optionalNumber(maxPriceRaw.completion) }
      : {}),
  };

  return {
    order: stringArray(raw.order),
    only: stringArray(raw.only),
    ignore: stringArray(raw.ignore),
    allowFallbacks: raw.allow_fallbacks !== false,
    dataCollection: raw.data_collection === "deny" ? "deny" : "allow",
    quantizations: stringArray(raw.quantizations),
    sort: parseSort(raw.sort) ?? null,
    maxPrice,
  };
}

export function extractProviderOptions(body: Record<string, unknown>): ProviderOptions | null {
  const raw = body.providerOptions;
  if (!isPlainObject(raw)) return null;
  const options: Record<string, Record<string, unknown>> = {};
  for (const [provider, value] of Object.entries(raw)) {
    if (isPlainObject(value)) options[provider] = { ...value };
  }
  return { options };
}

/** Provider component of a `provider/model` string. Bare names stay whole. */
export function providerOf(modelString: string): string {
  const slash = modelString.indexOf("/");
  return slash >= 0 ? modelString.slice(0, slash) : modelString;
}

function matchesQuantization(model: string, quantizations: string[]): boolean {
  return quantizations.some((quantization) => model.includes(quantization));
}

function orderedByProvider<T>(
  entries: T[],
  provider: (entry: T) => string,
  order: string[],
  allowFallbacks: boolean
): T[] {
  const priority: T[] = [];
  const fallback: T[] = [];
  for (const entry of entries) {
    if (order.includes(provider(entry))) priority.push(entry);
    else fallback.push(entry);
  }
  priority.sort((left, right) => order.indexOf(provider(left)) - order.indexOf(provider(right)));
  return allowFallbacks ? [...priority, ...fallback] : priority;
}

export function filterModelsByPreferences(
  models: readonly string[],
  prefs: ProviderPreferences
): string[] {
  let result = [...models];

  if (prefs.only.length > 0) {
    const only = new Set(prefs.only);
    result = result.filter((model) => only.has(providerOf(model)));
  }
  if (prefs.ignore.length > 0) {
    const ignore = new Set(prefs.ignore);
    result = result.filter((model) => !ignore.has(providerOf(model)));
  }
  if (prefs.quantizations.length > 0) {
    result = result.filter((model) => matchesQuantization(model, prefs.quantizations));
  }
  if (prefs.order.length > 0) {
    result = orderedByProvider(result, providerOf, prefs.order, prefs.allowFallbacks);
  }
  return result;
}

/**
 * Native variant for OmniRoute's `{ provider, model }` candidate objects.
 * Quantization matching uses the model name, matching the string variant.
 */
export function filterCandidatesByPreferences<T extends ProviderCandidate>(
  candidates: readonly T[],
  prefs: ProviderPreferences
): T[] {
  let result = [...candidates];

  if (prefs.only.length > 0) {
    const only = new Set(prefs.only);
    result = result.filter((candidate) => only.has(candidate.provider));
  }
  if (prefs.ignore.length > 0) {
    const ignore = new Set(prefs.ignore);
    result = result.filter((candidate) => !ignore.has(candidate.provider));
  }
  if (prefs.quantizations.length > 0) {
    result = result.filter((candidate) => matchesQuantization(candidate.model, prefs.quantizations));
  }
  if (prefs.order.length > 0) {
    result = orderedByProvider(result, (candidate) => candidate.provider, prefs.order, prefs.allowFallbacks);
  }
  return result;
}

/** Serialize to the OpenRouter `provider` wire object. */
export function toOpenRouterProviderBody(prefs: ProviderPreferences): Record<string, unknown> {
  const body: Record<string, unknown> = {
    order: [...prefs.order],
    only: [...prefs.only],
    ignore: [...prefs.ignore],
    allow_fallbacks: prefs.allowFallbacks,
    data_collection: prefs.dataCollection,
    quantizations: [...prefs.quantizations],
  };
  if (prefs.sort !== undefined && prefs.sort !== null) body.sort = prefs.sort;

  const maxPrice: Record<string, number> = {};
  if (prefs.maxPrice.prompt !== undefined && prefs.maxPrice.prompt !== null) {
    maxPrice.prompt = prefs.maxPrice.prompt;
  }
  if (prefs.maxPrice.completion !== undefined && prefs.maxPrice.completion !== null) {
    maxPrice.completion = prefs.maxPrice.completion;
  }
  if (Object.keys(maxPrice).length > 0) body.max_price = maxPrice;

  return body;
}
