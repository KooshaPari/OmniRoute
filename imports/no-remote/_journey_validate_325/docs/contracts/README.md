# Phenotype Contracts Conformance

OmniRoute (TypeScript) conforms to the canonical provider-model schemas published in
[KooshaPari/phenotype-contracts](https://github.com/KooshaPari/phenotype-contracts).

The contracts repo is the single source of truth (SSOT) for shared behavioural constants
across the Phenotype org (forgecode/Rust · OmniRoute/TypeScript · cliproxy/Go).

**Pinned SHA**: `cc8f34ed34a3f1ae2ba7edd6810a902e51738693`

---

## Schema files (provider-models/)

| Schema | Path in contracts repo |
|--------|------------------------|
| `provider-model.schema.json` | `provider-models/provider-model.schema.json` |
| `oauth-refresh-policy.schema.json` | `provider-models/oauth-refresh-policy.schema.json` |
| `resilience-policy.schema.json` | `provider-models/resilience-policy.schema.json` |

---

## Conformance status

### oauth-refresh-policy — `TOKEN_EXPIRY_BUFFER`

| Contract field | Contract value | OmniRoute value | Status |
|----------------|---------------|-----------------|--------|
| `default_refresh_lead_seconds` | 300 s | `5 * 60 * 1000` ms = 300 000 ms (≡ 300 s) | **CONFORMS** |

Source: `src/lib/tokenHealthCheck.ts` — `const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000;`

Unit note: the contract stores the value in **seconds**; OmniRoute stores it in **milliseconds**
(`ms since epoch` arithmetic). The canonical equivalence is documented in the schema's
`$comment` field: "OmniRoute's TOKEN_EXPIRY_BUFFER is in ms (5×60×1000); all other repos use
seconds — callers must convert units."

---

### resilience-policy — retryable HTTP status set

| Contract field | Contract default | OmniRoute value | Status |
|----------------|-----------------|-----------------|--------|
| `retryable_http_status_codes` | `[408, 429, 500, 502, 503, 504, 520, 522, 524, 529]` | `[408, 500, 502, 503, 504]` (PROVIDER_BREAKER_FAILURE_STATUSES in `src/sse/handlers/chat.ts`) | **DIVERGES** |

**Documented divergence**: OmniRoute's `PROVIDER_BREAKER_FAILURE_STATUSES` set omits the following
codes that the contract classifies as retryable:

- **429** (Rate Limited) — OmniRoute handles 429 through a separate, dedicated cooldown layer
  (`src/lib/resilience/settings.ts`, `comboCooldownWait`/`providerCooldown`) rather than the
  generic breaker set. This is an intentional architectural split, not an oversight.
- **520, 522, 524, 529** (Cloudflare transient codes) — not present in OmniRoute's breaker set.
  These may be tunnelled through the upstream as generic 5xx or handled by the provider-specific
  error classifiers. Teams should evaluate whether to add them to `PROVIDER_BREAKER_FAILURE_STATUSES`.

The conformance test asserts the actual value (not the contract default) and documents the delta.

---

### resilience-policy — SSE terminal marker `[DONE]`

| Contract ref | Contract value | OmniRoute value | Status |
|--------------|---------------|-----------------|--------|
| `sse_stop_reference.terminal_marker_schema_ref` → `SseStopRule` | `"[DONE]"` literal as SSE stream terminator | Handled in `src/lib/sseTextTransform.ts` line 93: `if (segment === "[DONE]")` | **CONFORMS** |

Additionally, `checkIfStopSignal()` in the same file covers provider-specific stop events
(`finish_reason`, `message_stop`, `content_block_stop`, `response.done`, etc.).

---

## Keeping this document current

1. Run `npm test -- tests/unit/phenotype-contracts-conformance.test.ts` to verify all assertions.
2. When phenotype-contracts publishes a new schema version, update the **Pinned SHA** above,
   re-run the conformance test, and reconcile any new divergences in this file.
3. Divergences that are intentional architectural decisions (e.g. the 429 split above) MUST be
   documented here before the conformance test can be updated to assert the actual value.
