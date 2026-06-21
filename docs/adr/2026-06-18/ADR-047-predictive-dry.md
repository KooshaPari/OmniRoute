# ADR-047 — Predictive DRY discipline (4-criterion rule)

**Status:** ACTIVE (governing section in AGENTS.md § "Predictive DRY")
**Date:** 2026-06-18 (last rebuilt 2026-06-21 after disk-loss event)
**Owner:** orch-w1-a (L5-112)
**Layer:** 71-pillar L72 (Predictive Architecture)
**Tool:** `KooshaPari/pheno-predict` (L72)

> **Rebuilds note (2026-06-21):** This file was restored after a disk-loss event.
> Governance definition unchanged. Cross-references to ADR-023, ADR-038, ADR-042,
> ADR-044, ADR-048, ADR-049 and to AGENTS.md § "Predictive DRY" all preserved.

## Context

The fleet accumulates shared code via two paths:
1. **Reactive DRY** — a 2nd consumer appears, then the prime is extracted. Safe
   but introduces a refactor tax every time the prime is promoted.
2. **Predictive DRY** — extract a prime with only 1 current consumer because a 2nd
   consumer is **named, dated, and scoped** in a plan. High-leverage but is the
   primary vector for speculative-DRY waste.

This ADR governs the predictive-DRY case: when it is authorized, and what
discipline must be applied.

## Decision

A **predictive extract is authorized** when **ALL FOUR** criteria are met.

### Criterion 1 — At least one current consumer
Working code in the candidate surface. Not a wishlist, not a sketch — running,
tested, deployed code that has been stable for at least 30 days.

- **Pass:** `pheno-config` exists, v0.3.0 released, used by 3 fleet-critical repos. ✓
- **Fail:** "We might need a vector DB client someday." ✗

### Criterion 2 — At least one predicted consumer
At least one additional consumer is **named** (specific repo or app),
**dated** (target quarter), and **scoped** (specific capability to consume).

- **Pass:** "pheno-mcp-router will adopt `pheno-config` for its provider
  configuration by 2026-Q3." ✓
- **Fail:** "Other repos might use this." ✗

### Criterion 3 — Clean abstraction boundary
The shared surface is a `Port` trait (per ADR-038), not a free function or a
god-module. The trait has ≤ 5 methods, has a `MockAdapter` for tests, and can
be exercised without depending on a specific runtime.

- **Pass:** `LlmPort` (async send/stream/cancel/healthcheck/cost). ✓
- **Fail:** "We'll extract the whole `models/` directory and call it shared." ✗

### Criterion 4 — Bounded reversal cost
If the predicted consumer never materializes, the prime is reversible in
≤ 1 day of work. Reversal means: delete the new crate, point the current
consumer back at its local copy, and update docs.

- **Pass:** 200 LOC, single `Port` trait, 1 consumer → trivially copy-pasted back. ✓
- **Fail:** 2,000 LOC with cross-crate CI plumbing and a 6-method trait —
  reversal would be 1 week. ✗

## Anti-patterns (forbidden)

- **Speculative DRY** — extracting because "we might need it someday" with no
  named consumer. Direct violation of Criterion 2.
- **Premature abstraction** — extracting before there is a stable interface to
  share. Violation of Criterion 3.
- **Hyrum's-law preventive over-extraction** — adding flexibility "just in case"
  the API ever needs to vary. Violation of Criterion 4.
- **Cross-org extract without a contract** — promoting code from one org's app
  into a cross-org substrate without an explicit federation agreement
  (ADR-046). Out of scope for predictive DRY.

## Tooling

- **`KooshaPari/pheno-predict`** (fleet-wide similar-code scanner) — runs weekly
  on the heavy-runner (Mon 09:00 PDT per ADR-044). Produces a ranked list of
  "two repos with similar code" candidates. Each candidate is a *signal*; the
  4 criteria above decide whether it becomes a prime.
- **`pheno-ci-templates/.github/workflows/predictive-dry-check.yml`** — runs on
  every PR to a substrate repo; fails the PR if the 4-criterion checklist is
  not completed in the PR body (via `PREDICTIVE.md` template).

## Workflow

```
1. Substrate author writes PREDICTIVE.md (template in pheno-ci-templates)
2. PR is opened; predictive-dry-check.yml runs; if any criterion unchecked → fail
3. PR review verifies each criterion; merging requires all four ✓
4. After merge, pheno-predict weekly scan updates the candidate list
5. Quarterly review: how many predictive extracts shipped? Did Criterion 2
   predictions materialize? (reported in findings/71-pillar-cycle-N.md)
```

## Companion ADRs

- **ADR-023** — Agent-effort governance (substrate placement taxonomy)
- **ADR-038** — Hexagonal port-adapter L4 policy (Criterion 3 requires a `Port` trait)
- **ADR-042** — Substrate audit cadence (bi-weekly substrate health check)
- **ADR-044** — Cron deployment schedule (predict scan runs Mon 09:00 PDT)
- **ADR-048** — Substrate graduation path (post-extract, the prime may be promoted
  to SDK/framework/service tier per its tier gates)
- **ADR-049** — App-substrate drift detector (reverse case: extract from app to
  prime)

## References

- `findings/71-pillar-2026-06-17-schema.md` § 3.10 (PAX domain, L72 definition)
- `findings/2026-06-18-L8-007-predictive-dry.md` (decision log)
- `KooshaPari/pheno-predict/README.md` (tool docs + cron template)
- AGENTS.md § "Predictive DRY" (governance section)
