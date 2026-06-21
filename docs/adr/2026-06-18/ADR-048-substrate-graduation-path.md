# ADR-048 — Substrate graduation path (4-tier gate table)

**Status:** ACTIVE (governing section in AGENTS.md § "Substrate graduation path")
**Date:** 2026-06-18 (last rebuilt 2026-06-21 after disk-loss event)
**Owner:** orch-w1-a (L5-113)
**Layer:** 71-pillar L73 (Predictive Architecture)
**Tool:** `KooshaPari/pheno-framework-lint` (L73)

> **Rebuilds note (2026-06-21):** This file was restored after a disk-loss event.
> Governance definition unchanged. Cross-references to ADR-038, ADR-012, ADR-046,
> ADR-047 and to AGENTS.md § "Substrate graduation path" all preserved.

## Context

A new prime (per ADR-047) starts life as a single-crate library
(`pheno-*-lib`). As the fleet adopts it, it may need to be promoted across
substrate tiers to reflect its actual surface area:

| Tier | Naming | Surface | Example |
|---|---|---|---|
| 1 | `pheno-*-lib` / `pheno-*-core` | Single-language, single crate | `pheno-config` |
| 2 | `phenotype-*-sdk` | Cross-language polyglot facade | `phenotype-go-sdk` |
| 3 | `phenotype-*-framework` | Inversion-of-control; lifecycle, ports, conventions | `phenotype-hub` |
| 4 | **Federated service** | Stateful, long-running, independently scalable | `phenoMCP` |

Without a graduation policy, two failure modes recur:
- **Framework lock-in** — a library is prematurely promoted to framework,
  forcing consumers into its lifecycle. Reverting is costly.
- **Lib sprawl** — a library that is actually consumed across 4 languages
  stays a single-crate lib forever, duplicating adapters in every consumer.

This ADR establishes the gates for each transition and forbids tier-skipping.

## Decision

A prime **graduates one tier at a time**, meeting the gates below for each
transition. Tier-skipping is forbidden (e.g., a lib cannot jump to a
federated service without first being an SDK and a framework).

### `pheno-*-lib` → `phenotype-*-sdk`
**Trigger:** the prime has polyglot consumers (≥ 2 distinct languages).
**Gates (ALL required):**
1. Stable public API on the origin language (semver-respected, ≥ 6 months).
2. ≥ 2 polyglot consumers in production, each ≥ 30 days stable.
3. Each polyglot consumer has a corresponding adapter crate
   (`phenotype-{lang}-sdk`) that satisfies L40 i18n (or N/A per UI rules).
4. SDK README has the "5-language quickstart" pattern (5 LOC per language).
5. `pheno-framework-lint check-all --tier=lib` reports 0 errors (violations ok).

### `phenotype-*-sdk` → `phenotype-*-framework`
**Trigger:** the SDK has opinionated lifecycle needs (startup/shutdown,
config cascade, port injection).
**Gates (ALL required):**
1. ≥ 3 consumers use ≥ 3 distinct ports from the framework.
2. Each port has ≥ 2 adapter implementations in the fleet.
3. The framework has a documented startup hook order (lifecycle contract).
4. A migration guide exists for any consumer moving from SDK-direct calls
   to framework-mediated calls.
5. `pheno-framework-lint check-all --tier=sdk` reports 0 errors.

### `phenotype-*-framework` → federated service
**Trigger:** the framework needs persistent state, multi-node consensus,
or independently scalable workloads.
**Gates (ALL required):**
1. State requirements are explicitly documented (what's stored, where,
   retention, encryption-at-rest).
2. The service has a documented deployment topology (single-node vs cluster,
   consensus protocol, scaling limits).
3. Health endpoints (`/health`, `/ready`) and OTLP observability are wired
   per ADR-012.
4. Federation auth is in place per ADR-046 (mTLS or OIDC).
5. `pheno-framework-lint check-all --tier=framework` reports 0 errors.

## Anti-patterns (forbidden)

- **Tier-skipping** — promoting from lib to framework or service without
  passing through SDK. The intermediate stages force the API to mature.
- **Promotion without consumers** — promoting a prime that no fleet repo
  consumes. Each transition requires a minimum consumer count.
- **Promotion without observability** — promoting a prime that does not
  emit OTLP traces (per ADR-012). Tier 3+ requires federation-grade
  observability.
- **Self-certification without artifact** — promoting via PR description
  alone; the `PROMOTION.md` artifact is required (template in
  `pheno-ci-templates/PROMOTION.md`).

## Tooling

- **`KooshaPari/pheno-framework-lint`** — 10-rule linter that infers the
  current tier from crate metadata (`Cargo.toml` `[package.metadata.phenotype]`
  or `pyproject.toml` `[tool.phenotype]`) and flags tier-skipping or
  promotion-without-gates.
- **`PROMOTION.md` template** — required artifact in any promotion PR;
  author checks each gate, CI verifies the file is present, reviewer
  verifies each checkbox.

## Workflow

```
1. Author writes PROMOTION.md; checks each gate that applies to the transition
2. PR opened; predictive-dry-check.yml + framework-lint CI run
3. If any gate unchecked OR framework-lint errors → CI fails
4. Reviewer verifies each gate; merge requires all ✓
5. After merge, fleet's `pheno-framework-lint check-all` weekly aggregate
   updates the scoreboard (findings/71-pillar-cycle-N.md)
```

## Current fleet readiness (as of 2026-06-21)

| Prime | Current tier | Ready for next? | Top unlock |
|---|---|---|---|
| `pheno-tracing` | lib | **YES — SDK** | Author PROMOTION.md with 3 polyglot consumers |
| `pheno-mcp-router` | lib (Python) | **YES — SDK** | Stabilize Go/Rust adapters |
| `pheno-config` | lib (Rust) | **YES — SDK** | Stabilize Python adapter, add TS adapter |
| `phenotype-port-interfaces` | SDK (Rust) | **YES — framework** | Author lifecycle contract |
| `phenotype-hub` | framework | **YES — service** | Document state + topology |
| `phenoMCP` | service | (terminal) | — |

## Companion ADRs

- **ADR-023** — Agent-effort governance (substrate placement taxonomy)
- **ADR-038** — Hexagonal port-adapter L4 policy (SDK→framework gates 1-2 require ports)
- **ADR-012** — pheno-tracing canonical (tier 3+ requires OTLP)
- **ADR-046** — Federation mTLS/OIDC (tier 4 requires federation auth)
- **ADR-047** — Predictive DRY (extraction precedes promotion)
- **ADR-049** — App-substrate drift detector (reverse case: extraction candidate source)

## References

- `findings/71-pillar-2026-06-17-schema.md` § 3.10 (PAX domain, L73 definition)
- `findings/2026-06-18-L8-008-substrate-graduation.md` (decision log)
- `KooshaPari/pheno-framework-lint/README.md` (tool docs + 10-rule reference)
- `pheno-ci-templates/PROMOTION.md` (template)
- AGENTS.md § "Substrate graduation path" (governance section)
