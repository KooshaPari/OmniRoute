# Threat Model — Phenotype Router Protocol

This document describes the trust boundaries, threat actors, and security
considerations for the **phenotype router A2A wire protocol** as defined in
this spec repository. It is intended to inform implementers (substrate,
adapters, other runtimes) about where and how security controls are needed.

> **Note:** This spec repo defines only the protocol wire format. The
> runtime security controls (authn, rate-limiting, transport-layer protection)
> are implemented by phenotype-router and adapters. This document covers
> threats at the *protocol design* level.

---

## Trust boundaries

```
  ┌──────────────┐     ┌──────────────────┐     ┌────────────────┐
  │  Agent / CLI  │ ──▶ │  Router (spec)   │ ──▶ │  Engine / AI   │
  │  (caller)     │     │  (dispatch +     │     │  (callee)      │
  │               │ ◀── │   mailbox)       │ ◀── │                │
  └──────────────┘     └──────────────────┘     └────────────────┘
          │                      │                       │
          └──────────────────────┴───────────────────────┘
                                ▲
                     Trace & Artifact bus
                         (observability)
```

**Boundary A** — Caller ↔ Router (dispatch + mailbox):
- Untrusted caller submits `RouterRequest` over the transport
- Router must validate the request structure before routing

**Boundary B** — Router ↔ Engine (mailbox):
- Router forwards validated `RouterDispatch` to engines
- Engines return mailbox events (status, errors, artifacts)

**Boundary C** — All parties ↔ Trace/Artifact bus:
- Trace events flow from router and engines to an observability sink
- Artifacts are structured outputs returned on completion

---

## STRIDE analysis by envelope

### RouterDispatch / RouterRequest (dispatch.json)

| Threat | Risk | Mitigation |
|---|---|---|
| **Spoofing** | Attacker sends forged `RouterRequest` impersonating a trusted caller | Transport-level auth (out of spec scope); implementers must add caller identity |
| **Tampering** | Attacker modifies `policy` fields (max_retries, timeout) to exhaust resources | Router must enforce server-side caps on `policy` values; reject out-of-bounds |
| **Repudiation** | Caller denies sending a request | Router should log `task_id` + caller identity; trace events provide non-repudiation |
| **Information disclosure** | `context_budget_tokens` or prompt content leaked over insecure transport | Transport-layer encryption (TLS) required by all implementations |
| **Denial of service** | Flood of `RouterRequest` with large context budgets | Server-side rate limiting; `context_budget_tokens` must be bounded |
| **Elevation of privilege** | Crafted `RouterDispatch` routes work to unintended engine | Router must validate engine availability + access rights before dispatch |

### RouterMailbox (mailbox.json)

| Threat | Risk | Mitigation |
|---|---|---|
| **Spoofing** | Fake mailbox events injected into event stream | Use monotonically increasing `seq` + caller session binding; reject out-of-order events |
| **Tampering** | Malformed `error` payload triggers improper engine shutdown | Router must validate error `code` against known enum; treat unparseable errors as `engine_error` |
| **Information disclosure** | Engine leaks internal state in error `message` | Errors should carry opaque codes, not implementation details |
| **Denial of service** | Rapid cancel/heartbeat events overwhelm router | Server-side rate limiting per connection; heartbeat is advisory |
| **Elevation of privilege** | Engine emits dispatcher-level events | Router enforces that mailbox events come only from the assigned engine for that task |

### RouterTrace (trace.json)

| Threat | Risk | Mitigation |
|---|---|---|
| **Information disclosure** | Trace payloads contain task content or engine internals | Trace consumers must apply redaction before external export; trace is OTLP-compatible for pipeline filtering |
| **Tampering** | Forged trace events create false audit trail | Trace events should be emitted only by the router; consumers verify `task_id` binding |
| **Denial of service** | High-volume trace events waste observability pipeline | Trace is sample/advisory; implementations should rate-limit emission |

### RouterArtifact (artifact.json)

| Threat | Risk | Mitigation |
|---|---|---|
| **Tampering** | Malformed artifact envelope with spoofed URLs or diffs | Router must verify artifact integrity; URLs should point to known-scope locations |
| **Information disclosure** | Artifact contains sensitive data from engine output | Implementers should apply content filtering before returning artifacts |
| **Denial of service** | Excessively large artifact collection | Server-side limit on artifact count and size per task |

---

## Security properties by design

- **Structured envelopes**: All four wire types use JSON Schema with required
  fields, enum constraints, and type validation — malformed payloads are
  rejected at parse time before reaching business logic.
- **Monotonic sequencing**: Mailbox events carry a monotonically increasing
  `seq` number, making replay and reordering detectable.
- **Task identity**: Every envelope is bound to a `task_id` — cross-task
  injection requires forging this identifier at the transport level.
- **Error codes are typed**: Mailbox `error` payload uses a `code` enum
  rather than free-form text, reducing information leakage.

---

## Out-of-scope (covered by implementers)

- Transport-layer auth (API keys, mTLS, OAuth)
- Transport-layer encryption (TLS)
- Rate limiting and connection management
- Secrets management and credential rotation
- Supply-chain security for runtime dependencies
