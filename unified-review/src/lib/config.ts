import { UnifiedReviewConfig, Tool, ToolConfig, UnifiedReviewConfigSchema } from "./types";
import yaml from "js-yaml";
import pino from "pino";
import { getRepoFile } from "./github";

const logger = pino({ name: "unified-review:config" });

const DEFAULT_CONFIG: UnifiedReviewConfig = {
  reviewers: [
    { name: "copilot", weight: 1.0, quota: { reviews_per_day: 10 }, enabled: true, adapter: "native", config: {} },
    { name: "coderabbit", weight: 1.0, quota: { reviews_per_day: 12 }, enabled: true, adapter: "api", config: {} },
    { name: "cursor", weight: 0.8, quota: { reviews_per_day: 8 }, enabled: true, adapter: "api", config: {} },
    { name: "forge", weight: 1.2, quota: { reviews_per_day: 20 }, enabled: true, adapter: "local", config: {} },
    { name: "kilocode", weight: 1.0, quota: { reviews_per_day: 50 }, enabled: true, adapter: "api", config: {} },
  ],
  mandatory_checks: ["codeql", "codeql-autofix"],
  presentation: {
    primary_surface: "checks_api",
    severity_labels: { P0: "Critical", P1: "Warning", P2: "Info", P3: "Suggestion" },
  },
  incremental: { enabled: true, preserve_findings_on_unchanged_lines: true },
  queue: { max_concurrent: 3, retry_attempts: 2, retry_delay_ms: 5000 },
};

const CONFIG_PATH = ".unified-review.yaml";
const ORG_CONFIG_PATH = ".github/.unified-review.yaml";

interface ConfigCacheEntry {
  config: UnifiedReviewConfig;
  source: "memory" | "repo" | "env" | "default";
  loadedAt: number;
}
const _cache = new Map<string, ConfigCacheEntry>();
const CACHE_TTL_MS = 5 * 60_000;

/** Read org-level env override */
function readEnvOverride(): Partial<UnifiedReviewConfig> | null {
  const raw = process.env.UNIFIED_REVIEW_CONFIG;
  if (!raw) return null;
  try {
    return yaml.load(raw) as Partial<UnifiedReviewConfig>;
  } catch (err) {
    logger.warn({ err }, "Failed to parse UNIFIED_REVIEW_CONFIG env override");
    return null;
  }
}

/** Read .unified-review.yaml from a repo, with graceful 404 */
async function readRepoConfig(owner: string, repo: string): Promise<Partial<UnifiedReviewConfig> | null> {
  // Try repo-root first, then .github/
  for (const path of [CONFIG_PATH, ORG_CONFIG_PATH]) {
    const raw = await getRepoFile(owner, repo, path);
    if (raw) {
      try {
        const parsed = yaml.load(raw) as Partial<UnifiedReviewConfig>;
        logger.info({ owner, repo, path }, "Loaded repo-level config");
        return parsed;
      } catch (err) {
        logger.warn({ err, owner, repo, path }, "Failed to parse repo YAML config");
      }
    }
  }
  return null;
}

/** Merge partial config over default — per-key shallow merge for nested objects */
function deepMerge<T>(base: T, override: Partial<T> | undefined): T {
  if (!override) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const k of Object.keys(override as Record<string, unknown>)) {
    const v = (override as Record<string, unknown>)[k];
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object") {
      out[k] = deepMerge(out[k], v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

/** Resolve config: repo > env > default. Validates with Zod. */
export async function loadConfigForRepo(
  owner: string,
  repo: string,
): Promise<{ config: UnifiedReviewConfig; source: ConfigCacheEntry["source"] }> {
  const cacheKey = `${owner}/${repo}`;
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return { config: cached.config, source: cached.source };
  }

  let merged = DEFAULT_CONFIG;
  let source: ConfigCacheEntry["source"] = "default";

  // 1. Repo-level config
  try {
    const repoConfig = await readRepoConfig(owner, repo);
    if (repoConfig) {
      merged = deepMerge(merged, repoConfig);
      source = "repo";
    }
  } catch (err) {
    logger.warn({ err, owner, repo }, "readRepoConfig failed — using default");
  }

  // 2. Env-level config (highest priority)
  const envOverride = readEnvOverride();
  if (envOverride) {
    merged = deepMerge(merged, envOverride);
    source = "env";
  }

  // 3. Validate with Zod
  const result = UnifiedReviewConfigSchema.safeParse(merged);
  if (!result.success) {
    logger.warn({ errors: result.error.issues }, "Config validation failed — using default");
    _cache.set(cacheKey, { config: DEFAULT_CONFIG, source: "default", loadedAt: Date.now() });
    return { config: DEFAULT_CONFIG, source: "default" };
  }

  _cache.set(cacheKey, { config: result.data, source, loadedAt: Date.now() });
  return { config: result.data, source };
}

/** Synchronous load — uses default config only, for non-webhook code paths */
export function loadConfig(): UnifiedReviewConfig {
  return DEFAULT_CONFIG;
}

export function getEnabledTools(): ToolConfig[] {
  return loadConfig().reviewers.filter((r) => r.enabled);
}

export function getToolConfig(name: Tool): ToolConfig | undefined {
  return loadConfig().reviewers.find((r) => r.name === name);
}

/** Invalidate cache for a specific repo (e.g. on config file change) */
export function invalidateConfig(owner: string, repo: string) {
  _cache.delete(`${owner}/${repo}`);
}
