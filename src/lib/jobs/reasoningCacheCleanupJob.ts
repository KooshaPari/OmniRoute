import { cleanupReasoningCache } from "../../../open-sse/services/reasoningCache.ts";
import { createLogger } from "@/shared/utils/logger";

const log = createLogger("jobs:reasoning-cache-cleanup");

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;

function getIntervalMs() {
  const raw = process.env.OMNIROUTE_REASONING_CACHE_CLEANUP_INTERVAL_MS;
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 60_000 ? parsed : DEFAULT_INTERVAL_MS;
}

export function startReasoningCacheCleanupJob() {
  if (timer) {
    return timer;
  }

  const run = () => {
    try {
      const deleted = cleanupReasoningCache();
      if (deleted > 0) {
        log.info({ deleted }, "reasoning-cache: expired entries removed");
      }
    } catch (error) {
      log.error({ err: error }, "reasoning-cache: cleanup job failed");
    }
  };

  run();
  timer = setInterval(run, getIntervalMs());
  timer.unref?.();
  return timer;
}

export function stopReasoningCacheCleanupJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
