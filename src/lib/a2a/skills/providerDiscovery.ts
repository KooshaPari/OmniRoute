/**
 * Provider Discovery A2A Skill
 *
 * Catalog-based discovery over the provider catalog at
 * `src/shared/constants/providers.ts` (10 sections: NOAUTH/OAUTH/APIKEY/
 * WEB_COOKIE/LOCAL/SEARCH/AUDIO_ONLY/UPSTREAM_PROXY/CLOUD_AGENT/SYSTEM).
 * As of v3.8.24 the catalog contains 234 providers.
 *
 * The skill is read-only: it never makes network calls. For `health` it
 * only inspects `process.env` (or a caller-supplied `envSnapshot`) and
 * returns a `status: "unknown"` marker when no health cache is reachable.
 *
 * Actions (via task.metadata.action, default `"list"`):
 *   - list       — filter the catalog by capability, auth type, freeOnly,
 *                  streaming, minContextWindow; optionally restrict to a
 *                  caller-supplied whitelist of provider IDs.
 *   - recommend  — score and rank the catalog for a query, return the
 *                  top three with a one-line rationale per pick.
 *   - health     — for each provider in `task.metadata.providers`, report
 *                  the expected env-var name, whether it is set, and a
 *                  `status` of `"configured" | "missing" | "unknown"`
 *                  (the last is returned when no health cache exists —
 *                  we never guess at network reachability).
 *
 * Inputs (via task.metadata):
 *   - action         (optional, default "list")
 *   - query          (optional, ProviderQuery) — capability, authType,
 *                     minContextWindow, supportsStreaming, freeOnly
 *   - providers      (optional, string[]) — whitelist for `list`; required
 *                     for `health` (returns an error if missing)
 *   - envSnapshot    (optional, Record<string,string>) — test override
 *                     for the `health` action; defaults to process.env
 *
 * Output (A2ASkillResult.artifacts[0].content is JSON):
 *   - list:       { providers: ProviderSummary[], totalCount, filteredCount }
 *   - recommend:  { recommendations: Array<{ provider, rationale, score }> }
 *   - health:     { results: HealthResult[] }
 *
 * ProviderSummary shape:
 *   { id, name, authType, capabilities, contextWindow, freeTier,
 *     defaultModel, status, section }
 *
 * HealthResult shape:
 *   { id, status, envVar, envPresent, lastCheckedAt }
 */

import { A2ATask } from "../taskManager";
import { A2ASkillResult } from "../taskExecution";
import {
  NOAUTH_PROVIDERS,
  OAUTH_PROVIDERS,
  APIKEY_PROVIDERS,
  WEB_COOKIE_PROVIDERS,
  LOCAL_PROVIDERS,
  SEARCH_PROVIDERS,
  AUDIO_ONLY_PROVIDERS,
  UPSTREAM_PROXY_PROVIDERS,
  CLOUD_AGENT_PROVIDERS,
  SYSTEM_PROVIDERS,
  type ServiceKind,
} from "@/shared/constants/providers";
import { DEFAULT_PRICING, getPricingForModel } from "@/shared/constants/pricing";

// ── Public types ────────────────────────────────────────────────────────────

export type DiscoveryAction = "list" | "recommend" | "health";

export type ProviderAuthType = "api_key" | "oauth" | "self_hosted" | "free";

export type ProviderStatus = "active" | "beta" | "deprecated";

/**
 * Capability tags. The catalog uses the typed `ServiceKind` enum
 * (`llm | embedding | image | imageToText | tts | stt | webSearch |
 * webFetch | video | music`), and we map it to a friendlier public
 * string. The mapping is one-to-one for most kinds, with two aliases:
 * `llm` → `chat` and `embedding` → `embeddings`.
 */
export type ProviderCapability =
  | "chat"
  | "embeddings"
  | "image"
  | "imageToText"
  | "tts"
  | "stt"
  | "webSearch"
  | "webFetch"
  | "video"
  | "music"
  | "vision"
  | "tools"
  | "streaming";

export interface ProviderQuery {
  capability?: ProviderCapability;
  authType?: ProviderAuthType;
  minContextWindow?: number;
  supportsStreaming?: boolean;
  freeOnly?: boolean;
}

export interface ProviderSummary {
  id: string;
  name: string;
  authType: ProviderAuthType;
  capabilities: ProviderCapability[];
  contextWindow: number | null;
  freeTier: boolean;
  defaultModel: string | null;
  status: ProviderStatus;
  section: string;
}

export interface HealthResult {
  id: string;
  status: "configured" | "missing" | "unknown";
  envVar: string | null;
  envPresent: boolean;
  lastCheckedAt: number;
}

export interface ListOutput {
  providers: ProviderSummary[];
  totalCount: number;
  filteredCount: number;
}

export interface RecommendationOutput {
  recommendations: Array<{
    provider: ProviderSummary;
    rationale: string;
    score: number;
  }>;
}

export interface HealthOutput {
  results: HealthResult[];
}

// ── Internal types ──────────────────────────────────────────────────────────

interface RawProvider {
  id: string;
  name: string;
  alias?: string;
  noAuth?: boolean;
  hasFree?: boolean;
  freeNote?: string;
  deprecated?: boolean;
  deprecationReason?: string;
  subscriptionRisk?: boolean;
  riskNoticeVariant?: string;
  anonymousFallback?: boolean;
  serviceKinds?: ServiceKind[];
  website?: string;
  apiHint?: string;
  authHint?: string;
  passthroughModels?: boolean;
  isEmbeddedService?: boolean;
  [k: string]: unknown;
}

type SectionId =
  | "NOAUTH"
  | "OAUTH"
  | "APIKEY"
  | "WEB_COOKIE"
  | "LOCAL"
  | "SEARCH"
  | "AUDIO_ONLY"
  | "UPSTREAM_PROXY"
  | "CLOUD_AGENT"
  | "SYSTEM";

interface Section {
  id: SectionId;
  map: Record<string, RawProvider>;
}

const SECTIONS: Section[] = [
  { id: "NOAUTH", map: NOAUTH_PROVIDERS as unknown as Record<string, RawProvider> },
  { id: "OAUTH", map: OAUTH_PROVIDERS as unknown as Record<string, RawProvider> },
  { id: "APIKEY", map: APIKEY_PROVIDERS as unknown as Record<string, RawProvider> },
  { id: "WEB_COOKIE", map: WEB_COOKIE_PROVIDERS as unknown as Record<string, RawProvider> },
  { id: "LOCAL", map: LOCAL_PROVIDERS as unknown as Record<string, RawProvider> },
  { id: "SEARCH", map: SEARCH_PROVIDERS as unknown as Record<string, RawProvider> },
  { id: "AUDIO_ONLY", map: AUDIO_ONLY_PROVIDERS as unknown as Record<string, RawProvider> },
  { id: "UPSTREAM_PROXY", map: UPSTREAM_PROXY_PROVIDERS as unknown as Record<string, RawProvider> },
  { id: "CLOUD_AGENT", map: CLOUD_AGENT_PROVIDERS as unknown as Record<string, RawProvider> },
  { id: "SYSTEM", map: SYSTEM_PROVIDERS as unknown as Record<string, RawProvider> },
];

// Provider ID → DEFAULT_PRICING key overrides. Some providers price
// under a short alias (cc, gh, kmc, kmca) rather than the full
// provider ID; the catalog exposes both via `alias`.
const PRICING_ALIAS_OVERRIDES: Record<string, string> = {
  claude: "cc",
  github: "gh",
  "kimi-coding": "kmc",
  "kimi-coding-apikey": "kmca",
};

// Provider ID → well-known env-var name overrides. The default is
// `${id.toUpperCase()}_API_KEY`; this map covers the handful that don't
// follow the convention.
const ENV_VAR_OVERRIDES: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY",
  cohere: "COHERE_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  xai: "XAI_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  together: "TOGETHER_API_KEY",
  fireworks: "FIREWORKS_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  nvidia: "NVIDIA_API_KEY",
  nebius: "NEBIUS_API_KEY",
  siliconflow: "SILICONFLOW_API_KEY",
  hyperbolic: "HYPERBOLIC_API_KEY",
  ollama: "OLLAMA_API_KEY",
  "ollama-cloud": "OLLAMA_CLOUD_API_KEY",
  huggingface: "HUGGINGFACE_API_KEY",
  voyage: "VOYAGE_API_KEY",
  jina: "JINA_API_KEY",
  replicate: "REPLICATE_API_TOKEN",
  stability: "STABILITY_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY",
  claude: "CLAUDE_CODE_OAUTH_TOKEN",
  codex: "OPENAI_API_KEY",
  cursor: "CURSOR_API_KEY",
  antigravity: "ANTIGRAVITY_API_KEY",
  qoder: "QODER_API_KEY",
  kiro: "KIRO_API_KEY",
  agy: "ANTIGRAVITY_API_KEY",
  cloudflare: "CLOUDFLARE_API_TOKEN",
  bedrock: "AWS_BEARER_TOKEN_BEDROCK",
  "azure-openai": "AZURE_OPENAI_API_KEY",
  "azure-ai": "AZURE_AI_API_KEY",
  vertex: "GOOGLE_APPLICATION_CREDENTIALS",
  github: "GITHUB_TOKEN",
  "github-models": "GITHUB_TOKEN",
  moonshot: "MOONSHOT_API_KEY",
  kimi: "MOONSHOT_API_KEY",
  "kimi-coding": "KIMI_CODING_OAUTH_TOKEN",
  "kimi-coding-apikey": "KIMI_CODING_API_KEY",
  gitlab: "GITLAB_TOKEN",
  "gitlab-duo": "GITLAB_DUO_OAUTH_CLIENT_ID",
};

// ServiceKind → public capability. Most map 1:1; two are renamed for
// the public API.
const SERVICE_KIND_TO_CAPABILITY: Record<ServiceKind, ProviderCapability> = {
  llm: "chat",
  embedding: "embeddings",
  image: "image",
  imageToText: "imageToText",
  tts: "tts",
  stt: "stt",
  webSearch: "webSearch",
  webFetch: "webFetch",
  video: "video",
  music: "music",
};

// Best-effort context windows for the heavy hitters. The catalog has
// no per-provider context window field, so this is a curated table.
const KNOWN_CONTEXT_WINDOWS: Record<string, number> = {
  openai: 128_000,
  anthropic: 200_000,
  gemini: 1_048_576,
  vertex: 1_048_576,
  mistral: 128_000,
  cohere: 128_000,
  groq: 128_000,
  deepseek: 64_000,
  xai: 131_072,
  perplexity: 127_000,
  together: 32_000,
  fireworks: 128_000,
  cerebras: 128_000,
  ollama: 32_000,
  "ollama-cloud": 128_000,
  kimi: 262_144,
  moonshot: 262_144,
  minimax: 204_800,
  glm: 128_000,
  zai: 128_000,
  qwen: 128_000,
  longcat: 128_000,
  inclusionai: 262_144,
  voyage: 32_000,
  jina: 8_000,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function inferAuthType(provider: RawProvider, sectionId: SectionId): ProviderAuthType {
  if (sectionId === "NOAUTH" || provider.noAuth === true) return "free";
  if (sectionId === "LOCAL") return "self_hosted";
  if (sectionId === "OAUTH" || sectionId === "WEB_COOKIE") return "oauth";
  if (sectionId === "APIKEY" && provider.hasFree === true) return "free";
  return "api_key";
}

function inferStatus(provider: RawProvider): ProviderStatus {
  if (provider.deprecated === true) return "deprecated";
  // Heuristic: providers with `anonymousFallback` (e.g. pollinations,
  // opencode-zen, opencode-go) are still in active use, but the catalog
  // explicitly tags them as the public free tier of an in-flight service.
  // Treat them as "beta" so UI can flag them.
  if (provider.anonymousFallback === true) return "beta";
  return "active";
}

function inferCapabilities(provider: RawProvider, sectionId: SectionId): ProviderCapability[] {
  const caps = new Set<ProviderCapability>();
  const kinds = provider.serviceKinds ?? [];
  for (const k of kinds) {
    const cap = SERVICE_KIND_TO_CAPABILITY[k];
    if (cap) caps.add(cap);
  }
  // For LLM chat providers (the vast majority of APIKEY/OAUTH/WEB_COOKIE
  // entries) we add the standard `chat` capability and a few near-universal
  // bonus caps (`streaming`, `tools`). These mirror what the underlying
  // SDKs expose; treating them as implicit keeps `recommend` useful even
  // when a provider row omits `serviceKinds`.
  if (kinds.length === 0) {
    const llmSections: SectionId[] = [
      "NOAUTH",
      "OAUTH",
      "APIKEY",
      "WEB_COOKIE",
      "LOCAL",
      "CLOUD_AGENT",
      "SYSTEM",
      "UPSTREAM_PROXY",
    ];
    if (llmSections.includes(sectionId)) {
      caps.add("chat");
      caps.add("streaming");
      caps.add("tools");
    }
  } else if (kinds.includes("llm")) {
    caps.add("streaming");
    caps.add("tools");
  }
  return Array.from(caps);
}

function inferContextWindow(providerId: string): number | null {
  if (providerId in KNOWN_CONTEXT_WINDOWS) return KNOWN_CONTEXT_WINDOWS[providerId];
  return null;
}

function inferDefaultModel(providerId: string): string | null {
  // Try the override (handles cc, gh, kmc, kmca) first, then the raw id.
  const pricingKey = PRICING_ALIAS_OVERRIDES[providerId] ?? providerId;
  const table = (DEFAULT_PRICING as Record<string, Record<string, unknown>>)[pricingKey];
  if (table && typeof table === "object") {
    const models = Object.keys(table);
    if (models.length > 0) return models[0];
  }
  // As a final fallback, try the raw provider id under both keys.
  const fallback = getPricingForModel(pricingKey, "default");
  if (fallback) return "default";
  return null;
}

function expectedEnvVar(providerId: string): string {
  if (providerId in ENV_VAR_OVERRIDES) return ENV_VAR_OVERRIDES[providerId];
  // Most providers follow `${ID_UPPER}_API_KEY`; multi-word IDs use `_`.
  return `${providerId.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}_API_KEY`;
}

function buildSummary(provider: RawProvider, sectionId: SectionId): ProviderSummary {
  return {
    id: provider.id,
    name: provider.name,
    authType: inferAuthType(provider, sectionId),
    capabilities: inferCapabilities(provider, sectionId),
    contextWindow: inferContextWindow(provider.id),
    freeTier: provider.hasFree === true || provider.noAuth === true,
    defaultModel: inferDefaultModel(provider.id),
    status: inferStatus(provider),
    section: sectionId,
  };
}

function enumerateCatalog(): ProviderSummary[] {
  const out: ProviderSummary[] = [];
  for (const section of SECTIONS) {
    for (const provider of Object.values(section.map)) {
      out.push(buildSummary(provider, section.id));
    }
  }
  return out;
}

function getById(id: string): { provider: RawProvider; section: SectionId } | null {
  for (const section of SECTIONS) {
    const p = section.map[id];
    if (p) return { provider: p, section: section.id };
  }
  return null;
}

function matchesQuery(p: ProviderSummary, q: ProviderQuery): boolean {
  if (q.capability) {
    const cap = q.capability;
    // `image` and `imageToText` are both image-related; allow either match.
    if (cap === "image") {
      if (!p.capabilities.includes("image") && !p.capabilities.includes("imageToText")) {
        return false;
      }
    } else if (!p.capabilities.includes(cap)) {
      return false;
    }
  }
  if (q.authType && p.authType !== q.authType) return false;
  if (q.freeOnly && !p.freeTier) return false;
  if (q.supportsStreaming && !p.capabilities.includes("streaming")) return false;
  if (
    typeof q.minContextWindow === "number" &&
    q.minContextWindow > 0 &&
    p.contextWindow !== null &&
    p.contextWindow < q.minContextWindow
  ) {
    return false;
  }
  return true;
}

// Recommendation scoring: a transparent, deterministic additive function.
// Higher = better fit. The top three non-deprecated providers are returned;
// if everything is deprecated we relax that and return the best three.
function scoreProvider(p: ProviderSummary, q: ProviderQuery): number {
  let score = 0;
  if (q.capability && p.capabilities.includes(q.capability)) score += 100;
  // Bonus: free-tier providers get a +50 when freeOnly is set.
  if (q.freeOnly && p.freeTier) score += 50;
  // Auth preferences: api_key > oauth > self_hosted for general queries.
  if (p.authType === "api_key") score += 30;
  else if (p.authType === "oauth") score += 20;
  else if (p.authType === "self_hosted") score += 10;
  // Status penalty.
  if (p.status === "deprecated") score -= 200;
  else if (p.status === "beta") score -= 10;
  // Streaming support when requested.
  if (q.supportsStreaming && p.capabilities.includes("streaming")) score += 20;
  // Context window: providers that meet `minContextWindow` get +5, larger
  // is better, capped at +20.
  if (
    typeof q.minContextWindow === "number" &&
    q.minContextWindow > 0 &&
    p.contextWindow !== null
  ) {
    if (p.contextWindow >= q.minContextWindow) score += 5;
    score += Math.min(20, Math.floor((p.contextWindow - q.minContextWindow) / 32_000));
  }
  return score;
}

function rationaleFor(p: ProviderSummary, q: ProviderQuery, rank: number): string {
  const bits: string[] = [];
  if (q.capability) bits.push(`supports \`${q.capability}\``);
  if (p.freeTier) bits.push("free tier available");
  if (p.status === "active") bits.push("active");
  if (q.supportsStreaming && p.capabilities.includes("streaming")) bits.push("streaming");
  if (
    typeof q.minContextWindow === "number" &&
    q.minContextWindow > 0 &&
    p.contextWindow !== null
  ) {
    bits.push(`${p.contextWindow.toLocaleString()}-token context`);
  }
  if (p.status === "deprecated") bits.push("deprecated — included as fallback");
  if (rank === 0) bits.unshift("best overall fit");
  else if (rank === 1) bits.unshift("strong alternative");
  else bits.unshift("third pick");
  return bits.join("; ");
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function executeProviderDiscovery(task: A2ATask): Promise<A2ASkillResult> {
  const meta = task.metadata ?? {};
  const action = (typeof meta.action === "string" ? meta.action : "list") as DiscoveryAction;
  const query = (meta.query && typeof meta.query === "object" ? meta.query : {}) as ProviderQuery;
  const providers = Array.isArray(meta.providers)
    ? (meta.providers as unknown[]).filter((p): p is string => typeof p === "string")
    : undefined;
  const envSnapshot =
    meta.envSnapshot && typeof meta.envSnapshot === "object"
      ? (meta.envSnapshot as Record<string, string>)
      : undefined;

  try {
    let payload: unknown;
    if (action === "list") {
      payload = handleList(query, providers);
    } else if (action === "recommend") {
      payload = handleRecommend(query);
    } else if (action === "health") {
      if (!providers || providers.length === 0) {
        return {
          artifacts: [
            {
              type: "text",
              content: JSON.stringify({
                error: "missing_providers",
                message:
                  "health action requires task.metadata.providers to be a non-empty string[]",
              }),
            },
          ],
        };
      }
      payload = handleHealth(providers, envSnapshot);
    } else {
      return {
        artifacts: [
          {
            type: "text",
            content: JSON.stringify({
              error: "unknown_action",
              message: `Unknown action '${action}'. Expected one of: list, recommend, health.`,
            }),
          },
        ],
      };
    }

    return {
      artifacts: [
        {
          type: "text",
          content: JSON.stringify(payload),
        },
      ],
      metadata: {
        action,
        ...(action === "list"
          ? {
              totalCount: (payload as ListOutput).totalCount,
              filteredCount: (payload as ListOutput).filteredCount,
            }
          : action === "recommend"
            ? { recommendationCount: (payload as RecommendationOutput).recommendations.length }
            : { healthCount: (payload as HealthOutput).results.length }),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      artifacts: [
        {
          type: "text",
          content: JSON.stringify({ error: "internal_error", message }),
        },
      ],
    };
  }
}

function handleList(query: ProviderQuery, whitelist: string[] | undefined): ListOutput {
  const all = enumerateCatalog();
  let filtered = all.filter((p) => matchesQuery(p, query));
  if (whitelist && whitelist.length > 0) {
    const allow = new Set(whitelist);
    filtered = filtered.filter((p) => allow.has(p.id));
  }
  return {
    providers: filtered,
    totalCount: all.length,
    filteredCount: filtered.length,
  };
}

function handleRecommend(query: ProviderQuery): RecommendationOutput {
  const all = enumerateCatalog();
  const eligible = all.filter((p) => matchesQuery(p, query));
  const ranked = eligible
    .map((p) => ({ provider: p, score: scoreProvider(p, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return {
    recommendations: ranked.map((r, i) => ({
      provider: r.provider,
      rationale: rationaleFor(r.provider, query, i),
      score: r.score,
    })),
  };
}

function handleHealth(ids: string[], envSnapshot: Record<string, string> | undefined): HealthOutput {
  const env = envSnapshot ?? (process.env as Record<string, string>);
  const results: HealthResult[] = ids.map((id) => {
    const found = getById(id);
    if (!found) {
      return {
        id,
        status: "unknown",
        envVar: null,
        envPresent: false,
        lastCheckedAt: Date.now(),
      };
    }
    const envVar = expectedEnvVar(id);
    const envPresent = typeof env[envVar] === "string" && env[envVar].length > 0;
    return {
      id,
      status: envPresent ? "configured" : "missing",
      envVar,
      envPresent,
      lastCheckedAt: Date.now(),
    };
  });
  return { results };
}

// Re-export internal types for downstream testing without forcing the
// test to traverse the file's module graph.
export type { SectionId };
