/**
 * apiKeyRotator.ts — T07: API Key Round-Robin
 *
 * Rotates between a primary API key and extra API keys stored in
 * providerSpecificData.extraApiKeys[]. Uses round-robin by default.
 *
 * Extra keys are stored as plain strings in providerSpecificData.extraApiKeys.
 * Example: { extraApiKeys: ["sk-abc...", "sk-def...", "sk-ghi..."] }
 *
 * The in-memory rotation index resets on process restart, which is intentional —
 * it ensures even distribution across restarts without persistence overhead.
 */

// In-memory round-robin index per connection
const _keyIndexes = new Map<string, number>();

/**
 * Get the next API key in round-robin rotation for a given connection.
 * If no extra keys are configured, returns the primary key unchanged.
 *
 * @param connectionId - Unique connection identifier (for index isolation)
 * @param primaryKey - The main api_key from the connection
 * @param extraKeys - Additional API keys from providerSpecificData.extraApiKeys
 * @returns The selected API key (may be primary or one of the extras)
 */
export function getRotatingApiKey(
  connectionId: string,
  primaryKey: string,
  extraKeys: string[] = []
): string {
  const validExtras = extraKeys.filter((k) => typeof k === "string" && k.trim().length > 0);

  // Only 1 key available → no rotation needed
  if (validExtras.length === 0) return primaryKey;

  const allKeys = [primaryKey, ...validExtras].filter(Boolean);
  if (allKeys.length <= 1) return primaryKey;

  const current = _keyIndexes.get(connectionId) ?? 0;
  const idx = current % allKeys.length;
  _keyIndexes.set(connectionId, current + 1);

  return allKeys[idx];
}

/**
<<<<<<< Updated upstream
 * Record a failed authentication attempt for a key.
 * Increments failure count and marks as "invalid" if threshold exceeded.
 *
 * @param connectionId - Connection scope for health state isolation
 * @param keyId - Key identifier ("primary" | "extra_0" | ...)
 * @returns Updated health status
 */
export function recordKeyFailure(connectionId: string, keyId: string): KeyHealth {
  const health = getOrCreateHealth(connectionId, keyId);
  health.failures++;
  health.totalRequests++;
  health.totalFailures++;
  health.lastFailure = new Date().toISOString();

  if (health.failures >= FAILURE_THRESHOLD) {
    health.status = "invalid";
  } else if (health.failures > 0) {
    health.status = "warning";
  }

  return { ...health };
}

/**
 * Record a terminal failure for a key — e.g. HTTP 402 "Insufficient account
 * balance". Unlike recordKeyFailure() (which only invalidates after
 * FAILURE_THRESHOLD consecutive failures), this marks the key "invalid"
 * immediately in a single call, because the condition will not recover
 * mid-session (the depleted key must not be returned by the rotator again
 * until credits are added / an operator resets it).
 *
 * @param connectionId - Connection scope for health state isolation
 * @param keyId - Key identifier ("primary" | "extra_0" | ...)
 * @returns Updated health status
 */
export function recordKeyTerminal(connectionId: string, keyId: string): KeyHealth {
  const health = getOrCreateHealth(connectionId, keyId);
  health.failures = Math.max(health.failures + 1, FAILURE_THRESHOLD);
  health.totalRequests++;
  health.totalFailures++;
  health.lastFailure = new Date().toISOString();
  health.status = "invalid";

  return { ...health };
}

/**
 * Record a successful authentication attempt for a key.
 * Resets failure count and marks as "active".
 *
 * @param connectionId - Connection scope for health state isolation
 * @param keyId - Key identifier ("primary" | "extra_0" | ...)
 * @returns Updated health status
 */
export function recordKeySuccess(connectionId: string, keyId: string): KeyHealth {
  const health = getOrCreateHealth(connectionId, keyId);
  health.failures = 0;
  health.totalRequests++;
  health.lastSuccess = new Date().toISOString();
  health.status = "active";

  return { ...health };
}

/**
 * Get count of invalid keys (for notification).
 */
export function getInvalidKeyCount(health?: Record<string, KeyHealth>): number {
  if (!health) return 0;
  return Object.values(health).filter((h) => h.status === "invalid").length;
}

/**
 * Get health statistics for display.
 */
export function getKeyHealthStats(
  connectionId: string,
  primaryKey: string,
  extraKeys: string[] = [],
  health?: Record<string, KeyHealth>
): {
  total: number;
  active: number;
  warning: number;
  invalid: number;
} {
  const total = (primaryKey ? 1 : 0) + extraKeys.filter((k) => k.trim().length > 0).length;
  const keys = ["primary", ...extraKeys.map((_, i) => `extra_${i}`)];

  let active = 0;
  let warning = 0;
  let invalid = 0;

  for (const keyId of keys) {
    const h = health?.[keyId] || getOrCreateHealth(connectionId, keyId);
    if (h.status === "active") active++;
    else if (h.status === "warning") warning++;
    else if (h.status === "invalid") invalid++;
  }

  return { total, active, warning, invalid };
}

/**
 * Reset a key's health status to active.
 * Called manually from Dashboard to recover from false positives.
 */
export function resetKeyStatus(connectionId: string, keyId: string): KeyHealth {
  const health = getOrCreateHealth(connectionId, keyId);
  health.failures = 0;
  health.status = "active";
  health.lastFailure = null;
  return { ...health };
}

/**
 * Get full health status for all keys.
 */
export function getAllKeyHealth(): Record<string, KeyHealth> {
  const result: Record<string, KeyHealth> = {};
  for (const [keyId, health] of _keyHealth.entries()) {
    result[keyId] = { ...health };
  }
  return result;
}

/**
 * Sync health status from DB (on connection load).
 */
export function syncHealthFromDB(connectionId: string, health?: Record<string, KeyHealth>): void {
  if (!health) return;

  for (const [keyId, keyHealth] of Object.entries(health)) {
    const scopedKey = `${connectionId}:${keyId}`;
    if (!_keyHealth.has(scopedKey) && _keyHealth.size >= MAX_KEY_HEALTH_ENTRIES) {
      const oldest = _keyHealth.keys().next().value;
      if (oldest !== undefined) _keyHealth.delete(oldest);
    }
    _keyHealth.set(scopedKey, keyHealth);
  }
}

/**
=======
>>>>>>> Stashed changes
 * Reset the rotation index for a connection.
 * Call this when a key fails (401/403) to skip the bad key next time.
 *
 * @param connectionId - Connection to reset
 */
export function resetRotationIndex(connectionId: string): void {
  _keyIndexes.delete(connectionId);
}

/**
 * Get the total number of API keys available for a connection.
 * Used for logging/observability.
 */
export function getApiKeyCount(primaryKey: string, extraKeys: string[] = []): number {
  const validExtras = extraKeys.filter((k) => typeof k === "string" && k.trim().length > 0);
  return (primaryKey ? 1 : 0) + validExtras.length;
}
