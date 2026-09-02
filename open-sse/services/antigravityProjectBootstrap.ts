/**
 * Antigravity project bootstrap — loadCodeAssist + onboardUser.
 *
 * The Google Cloud Code Assist API (/v1internal:models) requires a prior
 * /v1internal:loadCodeAssist call to assign a project context to the
 * OAuth token. Without this bootstrap, :models returns 404.
 *
 * This module provides an idempotent ensureAntigravityProjectAssigned()
 * helper that is called once per access-token before every discovery
 * attempt. Results are memoized per-token for the process lifetime to
 * avoid redundant round-trips.
 *
 * When loadCodeAssist returns no project (account never onboarded),
 * the fallback calls onboardUser to create the project, then retries.
 */

import {
  getAntigravityContentHeaders,
  getAntigravityLoadCodeAssistMetadata,
} from "./antigravityHeaders.ts";
import { extractCodeAssistOnboardTierId } from "./codeAssistSubscription.ts";
import type { AntigravityClientProfile } from "./antigravityClientProfile.ts";
import {
  ANTIGRAVITY_BOOTSTRAP_BASE_URLS,
  getAntigravityOnboardUrls,
} from "../config/antigravityUpstream.ts";

const LOAD_CODE_ASSIST_PATH = "/v1internal:loadCodeAssist";
const BOOTSTRAP_TIMEOUT_MS = 8_000;
const ONBOARD_TIMEOUT_MS = 15_000;
const DEFAULT_TIER_ID = "legacy-tier";

/** Ordered list of loadCodeAssist endpoint URLs. */
export function getAntigravityLoadCodeAssistUrls(): string[] {
  return ANTIGRAVITY_BOOTSTRAP_BASE_URLS.map((base) => `${base}${LOAD_CODE_ASSIST_PATH}`);
}

/** Max entries in the per-token caches (prevents unbounded growth). */
const MAX_CACHE_SIZE = 256;

/** LRU-style Map: deleting and re-inserting moves the key to the end. */
function evictOldest(cache: Map<string, unknown>): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/** Per-token memoization cache (lives for the process lifetime). */
const projectCache = new Map<string, string>();

/** Per-key lock to prevent concurrent onboard attempts for the same token. */
const onboardLocks = new Map<string, Promise<void>>();

/**
 * Sentinel returned by ensureAntigravityProjectAssigned when Google's
 * onboardUser completed but did NOT return a project id — no automatic
 * project creation for standard-tier (personal) accounts (tracked in #8491),
 * so Google requires a user-defined GCP project (BYOP). The
 * caller must fail fast with a clear "enter your GCP project id" error
 * instead of retrying (a fabricated id gets a delayed 429 RESOURCE_EXHAUSTED).
 */
export const ANTIGRAVITY_REQUIRES_MANUAL_PROJECT = "__REQUIRES_GCP_PROJECT__";

/**
 * Per-token cache of accounts Google told us to Bring Your Own Project.
 * Permanent for the process lifetime (LRU-capped): re-running onboardUser
 * for such an account is a pointless ~18s quota-check round-trip that
 * always comes back empty. Cleared by clearAntigravityProjectCache(); a
 * manually-entered project id (stored on the connection) short-circuits
 * before this is consulted.
 */
const requiresManualProjectCache = new Set<string>();

function markRequiresManualProject(key: string): void {
  if (requiresManualProjectCache.size >= MAX_CACHE_SIZE) {
    const oldest = requiresManualProjectCache.values().next().value;
    if (oldest !== undefined) requiresManualProjectCache.delete(oldest);
  }
  requiresManualProjectCache.add(key);
}

/** Outcome of an onboardUser attempt — three-way so the caller can distinguish
 * "transient failure (retry later)" from "Google says bring your own project". */
type AntigravityOnboardStatus = "onboarded" | "requires_manual_project" | "failed";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

function getProjectCacheKey(accessToken: string, clientProfile: AntigravityClientProfile): string {
  return `${clientProfile}:${accessToken}`;
}

type LoadCodeAssistResult = { projectId: string | null; tierId: string };

/**
 * Attempt loadCodeAssist against each known base URL in order.
 * Returns the discovered project id and tier id, or null projectId if all endpoints fail.
 */
async function tryLoadCodeAssist(
  accessToken: string,
  fetchImpl: FetchLike,
  clientProfile: AntigravityClientProfile,
  signal?: AbortSignal
): Promise<LoadCodeAssistResult> {
  const urls = getAntigravityLoadCodeAssistUrls();
  const headers = getAntigravityContentHeaders(clientProfile, accessToken);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (signal?.aborted) throw signal.reason;
    try {
      const timeoutSignal = AbortSignal.timeout(BOOTSTRAP_TIMEOUT_MS);
      const response = await fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ metadata: getAntigravityLoadCodeAssistMetadata() }),
        signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
      });

      if (!response.ok) {
        console.warn(
          `[models] antigravity loadCodeAssist failed at ${url} (${response.status}) — trying next`
        );
        continue;
      }

      const data = (await response.json()) as Record<string, unknown>;

      // cloudaicompanionProject may be a plain string or an object with an id field.
      const raw = data.cloudaicompanionProject;
      const projectId =
        typeof raw === "string"
          ? raw.trim()
          : raw &&
              typeof raw === "object" &&
              typeof (raw as Record<string, unknown>).id === "string"
            ? ((raw as Record<string, unknown>).id as string).trim()
            : "";

      const tierId = extractCodeAssistOnboardTierId(data) || DEFAULT_TIER_ID;

      if (projectId) {
        return { projectId, tierId };
      }

      // Continue to next URL if available — a different endpoint might
      // have the project. Only return empty when this is the last URL.
      if (i === urls.length - 1) {
        return { projectId: null, tierId };
      }
      console.warn(
        `[models] antigravity loadCodeAssist at ${url} returned no project id — trying next`
      );
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw signal?.reason ?? error;
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[models] antigravity loadCodeAssist threw for ${url}: ${msg} — trying next`);
    }
  }
  return { projectId: null, tierId: DEFAULT_TIER_ID };
}

/**
 * Attempt onboardUser to create a Cloud Code project for the account.
 * Called when loadCodeAssist returns no project — the account has never
 * been onboarded. Returns true if any endpoint reports success.
 */
async function tryOnboardUser(
  accessToken: string,
  fetchImpl: FetchLike,
  clientProfile: AntigravityClientProfile,
  tierId: string,
  signal?: AbortSignal
): Promise<AntigravityOnboardStatus> {
  const urls = getAntigravityOnboardUrls();
  const headers = getAntigravityContentHeaders(clientProfile, accessToken);

  for (const url of urls) {
    if (signal?.aborted) throw signal.reason;
    try {
      const timeoutSignal = AbortSignal.timeout(ONBOARD_TIMEOUT_MS);
      const response = await fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          tier_id: tierId,
          metadata: getAntigravityLoadCodeAssistMetadata(),
        }),
        signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
      });

      if (response.ok) {
        // Accounts Google expects to Bring Their Own Project: onboardUser
        // returns 200 without a `cloudaicompanionProject` in the body — no
        // automatic project creation for standard-tier/personal accounts
        // (tracked in #8491). Detect that so we can fail fast with a clear
        // instruction instead of retrying forever or fabricating an id that
        // Google later rejects with a delayed 429 RESOURCE_EXHAUSTED.
        const body = await response.text().catch(() => "");
        if (body && !/cloudaicompanionProject/.test(body)) {
          console.warn(
            `[models] antigravity onboardUser done but no project in response at ${url} — Google BYOP (user-defined GCP project) required`
          );
          return "requires_manual_project";
        }
        return "onboarded";
      }

      console.warn(
        `[models] antigravity onboardUser failed at ${url} (${response.status}) — trying next`
      );
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw signal?.reason ?? error;
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[models] antigravity onboardUser threw for ${url}: ${msg} — trying next`);
    }
  }
  return "failed";
}

/**
 * Per-token failure backoff for the onboardUser creation path.
 *
 * A FAILED onboard attempt must never be memoized as "done": a transient
 * upstream/network error would otherwise poison the account for the whole
 * process lifetime, so every later request 422s with "Missing Google
 * projectId" even though onboarding would succeed on retry. Instead we record
 * WHEN a failure happened and only skip re-attempts while the short backoff
 * window is open — the account heals itself on the next request after it
 * expires. Successful discoveries are memoized in `projectCache` (with LRU
 * eviction) and clear any pending failure marker.
 */
const onboardFailureAt = new Map<string, number>();
const ONBOARD_RETRY_BACKOFF_MS = 5 * 60 * 1000;

function markOnboardFailure(key: string): void {
  if (onboardFailureAt.size >= MAX_CACHE_SIZE) {
    const oldest = onboardFailureAt.keys().next().value;
    if (oldest !== undefined) onboardFailureAt.delete(oldest);
  }
  onboardFailureAt.set(key, Date.now());
}

function isOnboardOnBackoff(key: string): boolean {
  const failedAt = onboardFailureAt.get(key);
  if (failedAt === undefined) return false;
  if (Date.now() - failedAt >= ONBOARD_RETRY_BACKOFF_MS) {
    onboardFailureAt.delete(key);
    return false;
  }
  return true;
}

/**
 * Ensure a project is assigned to the given access token by calling
 * loadCodeAssist if not already cached. Idempotent — repeated calls
 * for the same token return the cached result without a network round-trip.
 *
 * Failures are non-fatal: the caller should proceed with the :models
 * request regardless (the stored project_id in the DB may still be valid).
 *
 * @param accessToken  The OAuth bearer token for the current connection.
 * @param fetchImpl    Injected fetch implementation (defaults to globalThis.fetch).
 */
export async function ensureAntigravityProjectAssigned(
  accessToken: string,
  fetchImpl: FetchLike = fetch,
  clientProfile: AntigravityClientProfile = "ide",
  signal?: AbortSignal
): Promise<string | undefined> {
  const cacheKey = getProjectCacheKey(accessToken, clientProfile);
  if (projectCache.has(cacheKey)) {
    const cached = projectCache.get(cacheKey)!;
    // Touch on read: delete+reinsert moves this entry to the end (LRU).
    projectCache.delete(cacheKey);
    projectCache.set(cacheKey, cached);
    return cached;
  }

  const { projectId: initialProjectId, tierId } = await tryLoadCodeAssist(
    accessToken,
    fetchImpl,
    clientProfile,
    signal
  );

  let projectId = initialProjectId;

  // Google told us this account must Bring Its Own Project — fail fast with
  // the sentinel instead of repeating the pointless ~18s onboard round-trip.
  if (!projectId && requiresManualProjectCache.has(cacheKey)) {
    return ANTIGRAVITY_REQUIRES_MANUAL_PROJECT;
  }

  // loadCodeAssist is read-only — if the account was never onboarded, it returns
  // empty. Call onboardUser to create the project, then retry discovery.
  // Re-attempts are bounded by a short failure backoff (not a permanent memo),
  // so a transient onboard failure heals on the next request. Accounts Google
  // marks BYOP are cached permanently and short-circuit above.
  if (!projectId && !isOnboardOnBackoff(cacheKey)) {
    // Per-key lock: concurrent calls for the same token share one onboard attempt.
    let lock = onboardLocks.get(cacheKey);
    if (!lock) {
      lock = (async () => {
        let aborted = false;
        let succeeded = false;
        let requiresManual = false;
        try {
          const status = await tryOnboardUser(
            accessToken,
            fetchImpl,
            clientProfile,
            tierId,
            signal
          );
          if (status === "requires_manual_project") {
            markRequiresManualProject(cacheKey);
            requiresManual = true;
            return;
          }
          if (status === "onboarded") {
            const retry = await tryLoadCodeAssist(accessToken, fetchImpl, clientProfile, signal);
            if (retry.projectId) {
              evictOldest(projectCache);
              projectCache.set(cacheKey, retry.projectId);
              succeeded = true;
              return;
            }
          }
        } catch (e) {
          aborted = signal?.aborted === true;
          return;
        } finally {
          onboardLocks.delete(cacheKey);
          if (!aborted && !requiresManual) {
            if (succeeded) onboardFailureAt.delete(cacheKey);
            else markOnboardFailure(cacheKey);
          }
        }
      })();
      onboardLocks.set(cacheKey, lock);
    }
    await lock;
    if (projectCache.has(cacheKey)) return projectCache.get(cacheKey);
    if (requiresManualProjectCache.has(cacheKey)) return ANTIGRAVITY_REQUIRES_MANUAL_PROJECT;
  }

  if (projectId) {
    evictOldest(projectCache);
    projectCache.set(cacheKey, projectId);
    return projectId;
  }
  return undefined;
}

/** Exported for tests. */
export function clearAntigravityProjectCache(): void {
  projectCache.clear();
  onboardFailureAt.clear();
  requiresManualProjectCache.clear();
  onboardLocks.clear();
}

/** Test-only: clear the onboard failure backoff (simulates backoff expiry). */
export function clearAntigravityOnboardBackoff(key?: string): void {
  if (key) onboardFailureAt.delete(key);
  else onboardFailureAt.clear();
}

/** Exported for tests — inspect cache state. */
export function getAntigravityProjectFromCache(
  accessToken: string,
  clientProfile: AntigravityClientProfile = "ide"
): string | undefined {
  return projectCache.get(getProjectCacheKey(accessToken, clientProfile));
}
