// @ts-ignore - ioredis lacks types in this project
import { Redis } from "ioredis";
import pino from "pino";
import { Tool, ReviewRequest, UnifiedReviewConfig } from "./types";
import { loadConfig, getEnabledTools } from "./config";
import { getQuotaState, getDefaultQuota, QuotaState } from "./quota";
import { getLabels, addLabels, removeLabel } from "./github";

const logger = pino({ name: "unified-review:selector" });
const LABEL_PREFIX = "reviewer:";

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    _redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    _redis.connect().catch((e: any) => logger.warn({ err: e }, "Redis connect failed"));
    return _redis;
  } catch {
    return null;
  }
}
const memAssignments = new Map<string, string>();

function assignKey(owner: string, repo: string, prNumber: number) {
  return `assign:${owner}:${repo}:${prNumber}`;
}

export async function getAssignedTool(owner: string, repo: string, prNumber: number): Promise<Tool | null> {
  const k = assignKey(owner, repo, prNumber);
  const redis = getRedis();
  if (redis?.status === "ready") {
    try {
      const v = await redis.get(k);
      if (v) return v as Tool;
    } catch (err) { logger.warn({ err }, "redis get failed"); }
  }
  const cached = memAssignments.get(k);
  if (cached) return cached as Tool;
  // Check labels
  try {
    const labels = await getLabels(owner, repo, prNumber);
    const found = labels.find((l) => l.startsWith(LABEL_PREFIX));
    if (found) {
      const t = found.replace(LABEL_PREFIX, "") as Tool;
      memAssignments.set(k, t);
      return t;
    }
  } catch (err) { logger.warn({ err }, "label check failed"); }
  return null;
}

export async function assignTool(owner: string, repo: string, prNumber: number, tool: Tool) {
  const k = assignKey(owner, repo, prNumber);
  memAssignments.set(k, tool);
  const redis = getRedis();
  if (redis?.status === "ready") {
    try { await redis.set(k, tool); await redis.expire(k, 30 * 24 * 60 * 60); }
    catch (err) { logger.warn({ err }, "redis assign failed"); }
  }
  // Sync label
  try {
    const labels = await getLabels(owner, repo, prNumber);
    const old = labels.filter((l) => l.startsWith(LABEL_PREFIX));
    for (const o of old) await removeLabel(owner, repo, prNumber, o);
    await addLabels(owner, repo, prNumber, [`${LABEL_PREFIX}${tool}`]);
  } catch (err) { logger.warn({ err }, "label sync failed"); }
}

export async function clearAssignment(owner: string, repo: string, prNumber: number) {
  const k = assignKey(owner, repo, prNumber);
  memAssignments.delete(k);
  const redis = getRedis();
  if (redis?.status === "ready") {
    try { await redis.del(k); }
    catch (err) { logger.warn({ err }, "redis clear failed"); }
  }
  try {
    const labels = await getLabels(owner, repo, prNumber);
    const old = labels.filter((l) => l.startsWith(LABEL_PREFIX));
    for (const o of old) await removeLabel(owner, repo, prNumber, o);
  } catch (err) { logger.warn({ err }, "label clear failed"); }
}

/** Weighted random selection, biased by remaining quota */
export async function selectReviewerForPR(request: ReviewRequest, config?: UnifiedReviewConfig): Promise<Tool> {
  const tools = config ? config.reviewers.filter((r) => r.enabled) : getEnabledTools();
  const candidates: Array<{ name: Tool; weight: number; state: QuotaState }> = [];

  for (const cfg of tools) {
    const state = await getQuotaState(cfg.name, getDefaultQuota(cfg.name), request.pr.owner);
    if (state.remaining > 0 && !state.degraded) {
      candidates.push({ name: cfg.name, weight: cfg.weight, state });
    }
  }

  if (candidates.length === 0) {
    // Fallback: pick any enabled (will be marked degraded or run anyway)
    const fallback = tools[0]?.name || "codeql";
    logger.warn({ request: request.pr.number }, "All tools exhausted/degraded, falling back");
    return fallback as Tool;
  }

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight * Math.max(0, c.state.remaining), 0);
  if (totalWeight === 0) return candidates[0].name;

  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  for (const c of candidates) {
    cumulative += c.weight * Math.max(0, c.state.remaining);
    if (rand < cumulative) return c.name;
  }
  return candidates[candidates.length - 1].name;
}

/** Get existing assignment or pick a new one */
export async function getOrAssignTool(request: ReviewRequest, config?: UnifiedReviewConfig): Promise<Tool> {
  const { owner, repo, number } = request.pr;

  // User override
  if (request.preferred_tool) {
    await assignTool(owner, repo, number, request.preferred_tool);
    return request.preferred_tool;
  }

  // Existing assignment check
  const existing = await getAssignedTool(owner, repo, number);
  if (existing) {
    const state = await getQuotaState(existing, getDefaultQuota(existing), owner);
    if (state.remaining > 0 && !state.degraded) return existing;
    // Quota exhausted — reassign
    await clearAssignment(owner, repo, number);
  }

  const selected = await selectReviewerForPR(request, config);
  await assignTool(owner, repo, number, selected);
  return selected;
}
