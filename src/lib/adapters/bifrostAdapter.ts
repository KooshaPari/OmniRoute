/**
 * BifrostAdapter — wraps the bifrost gateway (KooshaPari/bifrost) as a
 * RouterPort. Bifrost exposes an OpenAI-compatible HTTP API, so this adapter
 * calls /v1/chat/completions on the configured base URL and translates the
 * response into the canonical RouteResult shape.
 *
 * ADR-001: bifrost is the default routing substrate for OmniRoute.
 * Swap to ClipproxyAdapter or NativeAdapter by injecting a different
 * RouterPort implementation.
 *
 * @module lib/adapters/bifrostAdapter
 */

import type {
  RouterPort,
  RouterConfig,
  RouteRequest,
  RouteResult,
  ProviderName,
  ProviderRuntimeMetrics,
  PerformanceRoutingMetrics,
  PerformanceWeights,
  RoutingMode,
} from "../../domain/router/port.ts";
import { DEFAULT_PERFORMANCE_WEIGHTS, DEFAULT_ROUTER_CONFIG } from "../../domain/router/port.ts";

type PerformanceMetricKey = keyof PerformanceRoutingMetrics;

interface WeightedPerformanceMetric {
  key: PerformanceMetricKey;
  higherIsBetter: boolean;
}

const PERFORMANCE_METRICS: WeightedPerformanceMetric[] = [
  { key: "ttftMs", higherIsBetter: false },
  { key: "tps", higherIsBetter: true },
  { key: "e2eLatencyMs", higherIsBetter: false },
  { key: "health", higherIsBetter: true },
  { key: "failureRate", higherIsBetter: false },
  { key: "stability", higherIsBetter: true },
];

// ---------------------------------------------------------------------------
// Config / env resolution
// ---------------------------------------------------------------------------

export interface BifrostAdapterConfig {
  /** Base URL of the running bifrost gateway (default: env BIFROST_BASE_URL). */
  baseUrl?: string;
  /** Bearer token / API key for bifrost auth (default: env BIFROST_API_KEY). */
  apiKey?: string;
  /** RouterConfig for provider priority + fallback policy. */
  router?: RouterConfig;
}

function resolveBaseUrl(cfg: BifrostAdapterConfig): string {
  return (
    cfg.baseUrl ??
    (typeof process !== "undefined" ? process.env["BIFROST_BASE_URL"] : undefined) ??
    "http://localhost:8080"
  );
}

function resolveApiKey(cfg: BifrostAdapterConfig): string | undefined {
  return (
    cfg.apiKey ??
    (typeof process !== "undefined" ? process.env["BIFROST_API_KEY"] : undefined)
  );
}

// ---------------------------------------------------------------------------
// OpenAI-compat types (minimal — bifrost follows this spec)
// ---------------------------------------------------------------------------

interface OAIChatMessage {
  role: string;
  content: string;
}

interface OAIChatRequest {
  model: string;
  messages: OAIChatMessage[];
  max_tokens?: number;
  stream?: boolean;
  [k: string]: unknown;
}

interface OAIChatResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
  // bifrost adds x-provider header, reflected here when available
  _provider?: string;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class BifrostAdapter implements RouterPort {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly routerConfig: RouterConfig;

  constructor(cfg: BifrostAdapterConfig = {}) {
    this.baseUrl = resolveBaseUrl(cfg).replace(/\/$/, "");
    this.apiKey = resolveApiKey(cfg);
    this.routerConfig = { ...DEFAULT_ROUTER_CONFIG, ...(cfg.router ?? {}) };
  }

  // -------------------------------------------------------------------------
  // RouterPort: route
  // -------------------------------------------------------------------------

  async route(req: RouteRequest): Promise<RouteResult> {
    const startMs = Date.now();

    // Build provider priority list: tier override → global priority
    const priority = this._resolveProviderPriority(req);
    const timeoutMs = this.routerConfig.timeoutMs ?? 30_000;

    let lastError: RouteResult["error"] | undefined;

    for (let i = 0; i < priority.length; i++) {
      const provider = priority[i]!;
      const usedFallback = i > 0;

      try {
        const body: OAIChatRequest = {
          model: req.model,
          messages: req.messages,
          ...(req.maxTokens !== undefined ? { max_tokens: req.maxTokens } : {}),
          ...(req.stream !== undefined ? { stream: req.stream } : {}),
          ...(req.params ?? {}),
        };

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          // bifrost uses x-provider header to select the backend
          "x-provider": provider,
        };
        if (this.apiKey) {
          headers["Authorization"] = `Bearer ${this.apiKey}`;
        }

        const ac = new AbortController();
        const tid = setTimeout(() => ac.abort(), timeoutMs);

        let resp: Response;
        try {
          resp = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: ac.signal,
          });
        } finally {
          clearTimeout(tid);
        }

        if (!resp.ok) {
          const errText = await resp.text().catch(() => resp.statusText);
          const code =
            resp.status === 429
              ? "rate_limit"
              : resp.status >= 500
              ? "provider_error"
              : "unknown";
          lastError = {
            code,
            message: `bifrost returned ${resp.status}: ${errText}`,
            provider,
            retriable: resp.status === 429 || resp.status >= 500,
          };
          if (this.routerConfig.enableFallback && lastError.retriable) {
            continue; // try next provider
          }
          return { ok: false, error: lastError };
        }

        const data = (await resp.json()) as OAIChatResponse;
        const text = data.choices[0]?.message?.content ?? "";
        const resolvedProvider: ProviderName =
          resp.headers.get("x-provider") ?? data._provider ?? provider;

        return {
          ok: true,
          value: {
            text,
            provider: resolvedProvider,
            model: data.model ?? req.model,
            inputTokens: data.usage?.prompt_tokens,
            outputTokens: data.usage?.completion_tokens,
            latencyMs: Date.now() - startMs,
            usedFallback,
            raw: data,
          },
        };
      } catch (err) {
        const isAbort =
          err instanceof Error && err.name === "AbortError";
        lastError = {
          code: isAbort ? "timeout" : "provider_error",
          message: err instanceof Error ? err.message : String(err),
          provider,
          retriable: true,
          cause: err,
        };
        if (this.routerConfig.enableFallback) {
          continue;
        }
        return { ok: false, error: lastError };
      }
    }

    return {
      ok: false,
      error: lastError ?? {
        code: "config_error",
        message: "No providers configured",
        retriable: false,
      },
    };
  }

  // -------------------------------------------------------------------------
  // RouterPort: listAvailableProviders
  // -------------------------------------------------------------------------

  async listAvailableProviders(): Promise<ProviderName[]> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

      const resp = await fetch(`${this.baseUrl}/v1/providers`, { headers });
      if (!resp.ok) return [...this.routerConfig.providerPriority];

      const data = (await resp.json()) as { providers?: string[] };
      return data.providers ?? [...this.routerConfig.providerPriority];
    } catch {
      // bifrost not reachable — return config list
      return [...this.routerConfig.providerPriority];
    }
  }

  // -------------------------------------------------------------------------
  // RouterPort: listModels
  // -------------------------------------------------------------------------

  async listModels(provider?: ProviderName): Promise<string[]> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;
      if (provider) headers["x-provider"] = provider;

      const resp = await fetch(`${this.baseUrl}/v1/models`, { headers });
      if (!resp.ok) return [];

      const data = (await resp.json()) as { data?: Array<{ id: string }> };
      return (data.data ?? []).map((m) => m.id);
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _resolveProviderPriority(req: RouteRequest): ProviderName[] {
    const mode = this.routerConfig.routingMode ?? "priority";
    const withOverride = this._providerOrderWithTierOverride(req);

    if (mode === "priority") {
      return withOverride;
    }

    const hasTierOverride = req.fitnessTier && this.routerConfig.tierOverrides && this.routerConfig.tierOverrides[req.fitnessTier];

    if (!hasTierOverride) {
      return this._sortByMetrics(withOverride, mode, req.model);
    }

    const [overrideProvider, ...rest] = withOverride;
    return [overrideProvider, ...this._sortByMetrics(rest, mode, req.model)];
  }

  private _providerOrderWithTierOverride(req: RouteRequest): ProviderName[] {
    if (req.fitnessTier && this.routerConfig.tierOverrides) {
      const override = this.routerConfig.tierOverrides[req.fitnessTier];
      if (override) {
        // Put tier-preferred provider first, rest follow
        const rest = this.routerConfig.providerPriority.filter((p) => p !== override);
        return [override, ...rest];
      }
    }
    return [...this.routerConfig.providerPriority];
  }

  private _sortByMetrics(
    providers: ProviderName[],
    mode: Exclude<RoutingMode, "priority">,
    model?: string,
  ): ProviderName[] {
    if (mode === "performance") {
      return this._sortByPerformanceMetrics(providers, model);
    }

    const scored = providers.map((provider, index) => {
      const metric = this._getMetric(provider, mode);
      return { provider, index, metric };
    });

    return scored
      .sort((a, b) => {
        const aValid = typeof a.metric === "number" && Number.isFinite(a.metric);
        const bValid = typeof b.metric === "number" && Number.isFinite(b.metric);

        if (!aValid && !bValid) {
          return a.index - b.index;
        }

        if (!aValid) {
          return 1;
        }

        if (!bValid) {
          return -1;
        }

        if (a.metric === b.metric) {
          return a.index - b.index;
        }

        return mode === "latency" ? a.metric - b.metric : b.metric - a.metric;
      })
      .map((entry) => entry.provider);
  }

  private _getMetric(
    provider: ProviderName,
    mode: Exclude<RoutingMode, "priority">,
    model?: string,
  ): number | undefined {
    const metrics = this.routerConfig.providerMetrics?.[provider] ?? {};
    if (mode === "latency") {
      return metrics.latencyMs;
    }
    if (mode === "performance") {
      if (!model) {
        return undefined;
      }
      const modelMetrics = metrics.modelMetrics?.[model];
      return undefined;
    }
    return metrics.reliability;
  }

  private _resolvePerformanceWeights(): PerformanceWeights {
    const configured = this.routerConfig.performanceWeights ?? {};
    const merged: PerformanceWeights = {
      ...DEFAULT_PERFORMANCE_WEIGHTS,
      ...configured,
    };
    const active: Array<[keyof PerformanceWeights, number]> = Object.entries(merged).map(([key, weight]) => {
      const value = Number(weight);
      if (value > 0) {
        return [key as keyof PerformanceWeights, value];
      }
      return undefined;
    }).filter((entry): entry is [keyof PerformanceWeights, number] => Boolean(entry));

    if (active.length === 0) {
      return DEFAULT_PERFORMANCE_WEIGHTS;
    }

    const totalWeight = active.reduce((sum, [, value]) => sum + value, 0);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
      return DEFAULT_PERFORMANCE_WEIGHTS;
    }

    const normalized = active.reduce<Record<keyof PerformanceWeights, number>>(
      (acc, [key, value]) => {
        acc[key] = value / totalWeight;
        return acc;
      },
      {} as Record<keyof PerformanceWeights, number>,
    );

    return {
      ttftMs: normalized.ttftMs ?? DEFAULT_PERFORMANCE_WEIGHTS.ttftMs,
      tps: normalized.tps ?? 0,
      e2eLatencyMs: normalized.e2eLatencyMs ?? 0,
      health: normalized.health ?? 0,
      failureRate: normalized.failureRate ?? 0,
      stability: normalized.stability ?? 0,
    };
  }

  private _getPerformanceMetric(
    provider: ProviderName,
    metric: PerformanceMetricKey,
    model: string,
  ): number | undefined {
    const metrics = this.routerConfig.providerMetrics?.[provider];
    if (!metrics) {
      return undefined;
    }

    const modelMetrics = metrics.modelMetrics?.[model];
    const modelValue = modelMetrics?.[metric];
    if (typeof modelValue === "number" && Number.isFinite(modelValue)) {
      return modelValue;
    }

    const providerValue = metrics[metric];
    if (typeof providerValue === "number" && Number.isFinite(providerValue)) {
      return providerValue;
    }

    return undefined;
  }

  private _sortByPerformanceMetrics(
    providers: ProviderName[],
    model?: string,
  ): ProviderName[] {
    if (!model || providers.length === 0) {
      return [...providers];
    }

    const weights = this._resolvePerformanceWeights();
    const finiteMetricProviders = new Map<PerformanceMetricKey, Array<number>>();
    PERFORMANCE_METRICS.forEach((entry) => {
      finiteMetricProviders.set(
        entry.key,
        providers
          .map((provider) => this._getPerformanceMetric(provider, entry.key, model))
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      );
    });

    const entries = providers.map((provider, index) => {
      let score = 0;
      let hasFiniteContribution = false;

      for (const metric of PERFORMANCE_METRICS) {
        const weight = weights[metric.key];
        if (!Number.isFinite(weight) || weight <= 0) {
          continue;
        }

        const values = finiteMetricProviders.get(metric.key) ?? [];
        if (values.length === 0) {
          continue;
        }

        const value = this._getPerformanceMetric(provider, metric.key, model);
        if (!Number.isFinite(value)) {
          continue;
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        let normalized = 0.5;
        if (Number.isFinite(min) && Number.isFinite(max) && max !== min) {
          normalized = metric.higherIsBetter
            ? (value - min) / (max - min)
            : (max - value) / (max - min);
        }

        score += normalized * weight;
        hasFiniteContribution = true;
      }

      return {
        provider,
        index,
        score: hasFiniteContribution ? score : undefined,
      };
    });

    return entries
      .sort((a, b) => {
        const aHasScore = typeof a.score === "number";
        const bHasScore = typeof b.score === "number";

        if (!aHasScore && !bHasScore) {
          return a.index - b.index;
        }

        if (!aHasScore) {
          return 1;
        }

        if (!bHasScore) {
          return -1;
        }

        if (a.score === b.score) {
          return a.index - b.index;
        }

        return b.score - a.score;
      })
      .map((entry) => entry.provider);
  }
}
