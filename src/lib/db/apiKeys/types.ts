/**
 * db/apiKeys/types.ts — shared API-key value types.
 *
 * Extracted from db/apiKeys.ts (god-file decomposition): the persisted-row shapes
 * that the host module, the row-parser leaf, and the in-memory cache layer
 * (`./apiKeyCache`) need. Kept as a neutral leaf so every neighbour can import
 * these types without a cycle. apiKeys.ts re-exports these interfaces to
 * preserve its historical public surface.
 */

export interface RateLimitRule {
  limit: number;
  window: number;
}

export interface AccessSchedule {
  enabled: boolean;
  from: string;
  until: string;
  days: number[];
  tz: string;
}

/**
 * The typed metadata record returned by `getApiKeyMetadata()`. Lives here
 * (not in apiKeys.ts) so the in-memory metadata cache in `./apiKeyCache` can
 * type its Map values without importing back into the host module and
 * creating an import cycle.
 */
export interface ApiKeyMetadata {
  id: string;
  name: string;
  machineId: string | null;
  allowedModels: string[];
  blockedModels: string[];
  allowedCombos: string[];
  allowedConnections: string[];
  allowedQuotas: string[];
  noLog: boolean;
  autoResolve: boolean;
  isActive: boolean;
  accessSchedule: AccessSchedule | null;
  maxRequestsPerDay: number | null;
  maxRequestsPerMinute: number | null;
  throttleDelayMs: number | null;
  rateLimits: RateLimitRule[] | null;
  // T08: Per-key max concurrent sticky sessions (0 = unlimited)
  maxSessions: number;
  // Phase 3 lifecycle/policy fields
  revokedAt: string | null;
  expiresAt: string | null;
  ipAllowlist: string[];
  scopes: string[];
  isBanned: boolean;
  keyHash: string | null;
  proxyId: string | null;
  allowedEndpoints: string[];
  streamDefaultMode: "legacy" | "json";
  disableNonPublicModels: boolean;
  allowUsageCommand: boolean;
  usageLimitEnabled: boolean;
  dailyUsageLimitUsd: number | null;
  weeklyUsageLimitUsd: number | null;
}
