/**
 * Shared multi-account rotation mechanics for noauth executors that round-robin
 * across several "accounts" (fingerprints), each with an optional dedicated
 * proxy — currently `OpencodeExecutor`.
 *
 * Extracted after both executors independently implemented the same
 * pickAccount/markCooldown/markSuccess skeleton with the same exponential
 * backoff, and independently needed the same fix for the same latent bug (a
 * network exception was treated as account-scoped rotation fodder even for
 * accounts sharing the default egress — see `isNetworkErrorRotatable`).
 */

// Reuses the repo's established "transient, not clearly attributable" failure
// cooldown (already used by accountFallback.ts for network-error dedup, see
// its "one transient blip opens the whole-provider breaker" comment) instead
// of inventing a separate constant — same magnitude the codebase already
// applies whether the failure is a 429 or a network-level throw.
import { TRANSIENT_COOLDOWN_MS, COOLDOWN_MS } from "../config/errorConfig.ts";

/** Per-account proxy configuration, persisted by NoAuthAccountCard under
 * `providerSpecificData.accountProxies` (keyed by the account id, which the UI
 * stores in `providerSpecificData.fingerprints`). */
export interface AccountProxyConfig {
  fingerprint: string;
  proxy: {
    type: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
    relayAuth?: string;
  } | null;
}

/** The subset of per-account state the rotation mechanics need. Executors may
 * carry additional fields (e.g. mimocode's `jwt`/`expiresAt`) — this is the
 * minimum shape `pickAccount`/`markCooldown`/`markSuccess` operate on. */
export interface RotatableAccount {
  fingerprint: string;
  cooldownUntil: number;
  consecutiveFails: number;
  proxy: AccountProxyConfig["proxy"];
  evictedAt?: number | null;
}

export type CooldownKind = "transient" | "terminal";

const EVICT_AFTER_TERMINAL = 3;

export function isAccountEvicted(account: RotatableAccount): boolean {
  return account.evictedAt != null;
}

const COOLDOWN_BASE_MS = TRANSIENT_COOLDOWN_MS;
const COOLDOWN_MAX_MS = COOLDOWN_MS.transientMax;

export function isAccountReady(account: RotatableAccount): boolean {
  return account.cooldownUntil <= Date.now();
}

/** Round-robin pick, skipping accounts not `isReady`; falls back to the next
 * index (even if not ready) so a caller always gets an account rather than
 * hanging when every account is unavailable. Mutates `state.nextAccountIdx`.
 *
 * `isReady` defaults to the plain cooldown check (`isAccountReady`); pass a
 * custom predicate when readiness depends on more than cooldown (e.g.
 * mimocode's JWT-freshness-aware variant). */
export function pickAccount<T extends RotatableAccount>(
  accounts: T[],
  state: { nextAccountIdx: number },
  isReady: (account: T) => boolean = isAccountReady
): T {
  for (let i = 0; i < accounts.length; i++) {
    const idx = (state.nextAccountIdx + i) % accounts.length;
    const acct = accounts[idx];
    if (isReady(acct)) {
      state.nextAccountIdx = (idx + 1) % accounts.length;
      return acct;
    }
  }
  const fallbackIdx = state.nextAccountIdx % accounts.length;
  state.nextAccountIdx = (state.nextAccountIdx + 1) % accounts.length;
  return accounts[fallbackIdx];
}

export function markCooldown(account: RotatableAccount, kind: CooldownKind = "transient"): void {
  account.consecutiveFails++;
  const backoff = Math.min(
    COOLDOWN_BASE_MS * Math.pow(2, account.consecutiveFails - 1),
    COOLDOWN_MAX_MS
  );
  account.cooldownUntil = Date.now() + backoff + Math.random() * 1000;
  if (kind === "terminal" && account.consecutiveFails >= EVICT_AFTER_TERMINAL) {
    account.evictedAt = Date.now();
  }
}

export function markSuccess(account: RotatableAccount): void {
  account.consecutiveFails = 0;
  account.evictedAt = null;
}

/** Mask an account id for logs (UI calls it a fingerprint). */
export function maskAccountId(fingerprint: string): string {
  if (!fingerprint) return "direct";
  return `${fingerprint.slice(0, 8)}…`;
}

/**
 * Whether a network exception (timeout, connection refused/reset) on this
 * account should trigger rotation to the next account, vs propagating.
 *
 * Only true when the account has its own egress (a configured proxy) — that's
 * the case a dead/unreachable proxy genuinely justifies rotating away from.
 * Accounts sharing the default egress (no proxy) can all fail at once on a
 * real network outage: rotating there would just retry the same failure
 * against every account while poisoning each one's cooldown for a cause that
 * isn't theirs.
 */
export function isNetworkErrorRotatable(account: RotatableAccount): boolean {
  return account.proxy !== null;
}

/**
 * Detect an *empty* upstream rejection: a 400 whose body carries no usable
 * completion — the kind `OpencodeExecutor` must rotate/retry on instead of
 * propagating as a fatal success.
 *
 * Signature is deliberately strict and scoped to the observed malformed
 * envelope (`choices[0].message` with no `error`, no real `content`,
 * `finish_reason: null`):
 *  - status must be exactly 400 (anything else → false);
 *  - body must parse and contain a `choices` array with at least one entry
 *    holding a `message` object;
 *  - an `error` field (present or empty) → false, so genuine 400s keep
 *    propagating immediately (#10460 precedent: classify by signature before
 *    rotating);
 *  - `tool_calls` / `reasoning_content` → false (real content);
 *  - `message.content` absent / null / "" → eligible; any other value
 *    (non-empty text, number, block array…) → false (conservative);
 *  - a literal `finish_reason` (not null) → false (a completed, if empty, turn).
 *
 * Does NOT reuse `detectMalformedNonStream` (diagnostics.ts): that classifier
 * also flags `{error:{…}}` bodies as `empty_choices`, which would rotate on
 * real errors — a false-positive class with a history here.
 */
export function isEmptyUpstreamRejection(status: number, bodyText: string): boolean {
  if (status !== 400) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return false;
  }
  const choices = (parsed as { choices?: unknown })?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return false;
  const first = choices[0] as { message?: unknown; finish_reason?: unknown };
  if (typeof first !== "object" || first === null) return false;
  const rawMessage = (first as { message?: unknown }).message;
  if (typeof rawMessage === "undefined" || rawMessage === null) return false;
  if (typeof parsed !== "object" || parsed === null) return false;
  if ("error" in (parsed as Record<string, unknown>)) return false;
  const msg = rawMessage as Record<string, unknown>;
  if ("tool_calls" in msg) return false;
  if ("reasoning_content" in msg) return false;
  const content = msg.content;
  if (content !== undefined && content !== null && content !== "") return false;
  if (first.finish_reason !== null && first.finish_reason !== undefined) return false;
  return true;
}

/** Best-effort extraction of the upstream `chatcmpl_*` id from a response body,
 * for observability logging. Returns `"unknown"` when absent or unparseable. */
export function extractChatcmplId(bodyText: string): string {
  const match = /"id"\s*:\s*"(chatcmpl_[^"]+)"/.exec(bodyText);
  return match ? match[1] : "unknown";
}
