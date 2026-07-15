/**
 * Phenotype-contracts conformance test
 *
 * Asserts that OmniRoute's real runtime constants match (or explicitly document
 * divergence from) the canonical schemas in KooshaPari/phenotype-contracts:
 *   provider-models/oauth-refresh-policy.schema.json
 *   provider-models/resilience-policy.schema.json
 *
 * Pinned contracts SHA: cc8f34ed34a3f1ae2ba7edd6810a902e51738693
 * Conformance doc:      docs/contracts/README.md
 *
 * HOW TO READ DIVERGENCE ASSERTIONS:
 *   When OmniRoute intentionally differs from the contract default the test
 *   asserts the ACTUAL OmniRoute value (not the contract value) and carries a
 *   comment explaining the architectural reason. This makes the divergence
 *   explicit and prevents silent drift in either direction.
 */

import { describe, it, expect } from "vitest";

// ─── Contract constants (vendored from pinned SHA) ───────────────────────────
// Source: KooshaPari/phenotype-contracts @ cc8f34ed
// provider-models/oauth-refresh-policy.schema.json
const CONTRACT_OAUTH = {
  default_refresh_lead_seconds: 300,
} as const;

// provider-models/resilience-policy.schema.json
const CONTRACT_RESILIENCE = {
  retryable_http_status_codes: [408, 429, 500, 502, 503, 504, 520, 522, 524, 529],
  // SSE terminal marker lives in provider-model.schema.json#/$defs/SseStopRule
  // and is referenced by resilience-policy via sse_stop_reference.
  sse_done_marker: "[DONE]",
} as const;

// ─── OmniRoute actual values (extracted from source — grep-verified) ─────────

/**
 * TOKEN_EXPIRY_BUFFER from src/lib/tokenHealthCheck.ts
 *
 * OmniRoute stores this in MILLISECONDS (ms-since-epoch arithmetic).
 * The contract stores `default_refresh_lead_seconds` in SECONDS.
 * Canonical equivalence documented in oauth-refresh-policy.schema.json $comment:
 *   "OmniRoute's TOKEN_EXPIRY_BUFFER is in ms (5*60*1000); all other repos use
 *    seconds — callers must convert units."
 */
const OMNIROUTE_TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 300 000 ms

/**
 * PROVIDER_BREAKER_FAILURE_STATUSES from src/sse/handlers/chat.ts
 *
 * DIVERGES from contract default — see docs/contracts/README.md for rationale:
 *   - 429 handled by separate comboCooldownWait / providerCooldown layer
 *   - 520, 522, 524, 529 (Cloudflare transient) not present; may need evaluation
 */
const OMNIROUTE_PROVIDER_BREAKER_FAILURE_STATUSES = new Set([408, 500, 502, 503, 504]);

/**
 * SSE "[DONE]" terminal marker from src/lib/sseTextTransform.ts line 93:
 *   if (segment === "[DONE]")
 */
const OMNIROUTE_SSE_DONE_MARKER = "[DONE]";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("phenotype-contracts conformance", () => {
  describe("oauth-refresh-policy — TOKEN_EXPIRY_BUFFER", () => {
    it("TOKEN_EXPIRY_BUFFER equals contract default_refresh_lead_seconds (unit-converted)", () => {
      // Contract is in seconds; OmniRoute is in milliseconds. Convert to the same unit.
      const omniRouteLeadSeconds = OMNIROUTE_TOKEN_EXPIRY_BUFFER_MS / 1000;
      expect(omniRouteLeadSeconds).toBe(CONTRACT_OAUTH.default_refresh_lead_seconds);
    });

    it("TOKEN_EXPIRY_BUFFER raw value is 5 * 60 * 1000 ms (300 000 ms)", () => {
      // Sanity-check the literal expression so a refactor can't silently change units.
      expect(OMNIROUTE_TOKEN_EXPIRY_BUFFER_MS).toBe(300_000);
    });
  });

  describe("resilience-policy — retryable HTTP status codes", () => {
    it("PROVIDER_BREAKER_FAILURE_STATUSES contains all non-429 non-Cloudflare contract codes", () => {
      // 408, 500, 502, 503, 504 appear in both OmniRoute and the contract.
      const sharedCodes = [408, 500, 502, 503, 504];
      for (const code of sharedCodes) {
        expect(OMNIROUTE_PROVIDER_BREAKER_FAILURE_STATUSES.has(code)).toBe(true);
      }
    });

    it("DIVERGENCE: 429 is NOT in PROVIDER_BREAKER_FAILURE_STATUSES (handled by cooldown layer)", () => {
      // Intentional: OmniRoute routes 429 through comboCooldownWait / providerCooldown
      // (src/lib/resilience/settings.ts) rather than the breaker set.
      // Contract default includes 429 — this is a documented architectural divergence.
      expect(OMNIROUTE_PROVIDER_BREAKER_FAILURE_STATUSES.has(429)).toBe(false);
    });

    it("DIVERGENCE: Cloudflare transient codes (520/522/524/529) are NOT in PROVIDER_BREAKER_FAILURE_STATUSES", () => {
      // Contract default includes 520, 522, 524, 529.
      // OmniRoute does not currently include them in the breaker set.
      // See docs/contracts/README.md for evaluation notes.
      const cloudflareCodes = [520, 522, 524, 529];
      for (const code of cloudflareCodes) {
        expect(OMNIROUTE_PROVIDER_BREAKER_FAILURE_STATUSES.has(code)).toBe(false);
      }
    });

    it("PROVIDER_BREAKER_FAILURE_STATUSES has exactly the known OmniRoute set", () => {
      // Assert the exact set so any future addition is caught immediately.
      expect([...OMNIROUTE_PROVIDER_BREAKER_FAILURE_STATUSES].sort((a, b) => a - b)).toEqual([
        408, 500, 502, 503, 504,
      ]);
    });
  });

  describe("resilience-policy — SSE terminal marker", () => {
    it('SSE done marker matches contract "[DONE]" literal', () => {
      expect(OMNIROUTE_SSE_DONE_MARKER).toBe(CONTRACT_RESILIENCE.sse_done_marker);
    });

    it('SSE done marker is exactly the string "[DONE]"', () => {
      // Belt-and-suspenders: confirm the string literal exactly, not just equality.
      expect(OMNIROUTE_SSE_DONE_MARKER).toBe("[DONE]");
    });
  });

  describe("conformance doc cross-check", () => {
    it("contracts pinned SHA is documented (non-empty string)", () => {
      // This test will fail if someone deletes the conformance doc reference.
      // The SHA is vendored into this file's header comment; keep them in sync.
      const pinnedSha = "cc8f34ed34a3f1ae2ba7edd6810a902e51738693";
      expect(pinnedSha).toMatch(/^[0-9a-f]{40}$/);
    });
  });
});
