# RFC 001 — Traceon hexagonal core → `observe` role

| Field | Value |
|-------|-------|
| **Status** | Proposed |
| **Role** | `observe` |
| **Canonical owner** | **PhenoObservability** (workspace) |
| **Thin OTLP bridge** | **phenotype-otel** (unchanged scope) |
| **Supersedes** | HexaKit absorption of Traceon as genesis `crates/` |
| **Authority** | [DOMAIN_ROLES.md](../../DOMAIN_ROLES.md), [LANGUAGE_PLACEMENT.md](../../LANGUAGE_PLACEMENT.md) |

## Summary

Move the **Traceon hexagonal tracing core** (`tracingkit` crate, formerly `KooshaPari/Traceon`) out of HexaKit `crates/` into the **`observe` role workspace** owned by **PhenoObservability**. **phenotype-otel** remains a **thin OTLP init bridge** — it must not absorb domain tracing logic.

This RFC explicitly rejects:

- Parking Traceon in HexaKit (genesis-only boundary).
- A `phenotype-rust-sdk` junk-drawer monorepo.
- Expanding phenotype-otel beyond OTLP subscriber wiring.

## Problem

Traceon was subtree-merged into HexaKit as transitional `Traceon/` → `tracingkit` while the fleet rationalized. HexaKit charter now scopes **genesis only**; domain crates in `crates/` and `Traceon/` violate [DOMAIN_ROLES.md](../../DOMAIN_ROLES.md).

Current chokepoints ([RATIONALIZATION_EXECUTION.md](../../RATIONALIZATION_EXECUTION.md)):

| Consumer | Today | Blocker |
|----------|-------|---------|
| PhenoObservability | HexaKit `tracingkit` git/path dep | Must repoint to observe-role workspace |
| phenotype-otel | Standalone thin init | Must stay thin; may depend on observe core optionally |

PhenoObservability already hosts a partial `tracingkit` tree (~15 paths vs Traceon’s 18). The observe role needs one canonical Rust hexagonal core, not two divergent copies.

## Decision

| Layer | Repo / crate | Responsibility |
|-------|--------------|----------------|
| **Role workspace** | `PhenoObservability` | Observe role home: tracing/metrics domain crates, dashboards, higher-level exporters |
| **Hexagonal core** | `crates/tracingkit` (name retained) | Traceon domain: Span, Tracer port, processors, propagators, exporter adapters |
| **Thin init** | `phenotype-otel` (`pheno_otel::init`) | OTLP HTTP exporter + `tracing-subscriber` registry + global `TracerProvider` |
| **Python edge** | `phenotype-python-sdk` `[observe]` extra | ObservabilityKit facade (Tier 2) |
| **Genesis** | HexaKit | Templates only — **no** Traceon/tracing domain code after migration |

**Owner rationale:** PhenoObservability already consumes tracingkit, hosts Metron-adjacent observability stacks, and is the fleet’s observe-role application workspace. phenotype-otel is intentionally minimal (single-crate OTLP bootstrap) and should remain installable without pulling the full hexagonal framework.

## Language placement

Per [LANGUAGE_PLACEMENT.md](../../LANGUAGE_PLACEMENT.md):

| Component | Lang | Tier | Rationale |
|-----------|------|------|-----------|
| Traceon hexagonal core (`tracingkit`) | Rust | **1** | Long-lived tracing domain, correctness-critical propagation |
| Metron / metrics crates (same workspace) | Rust | **1** | Co-located observe core |
| phenotype-otel init | Rust | **1** | Thin OTLP bridge; no domain logic |
| ObservabilityKit | Python 3.14 / uv | **2** | SDK edge, rapid iteration |
| Dashboards / CLI adjacency | TS / Bun | **2** | Product edge where applicable |

Document final choices in PhenoObservability `docs/sota/technical.md` using the policy template.

## Target layout (PhenoObservability workspace)

```
PhenoObservability/
├── crates/
│   ├── tracingkit/          # Traceon hexagonal core (from HexaKit/Traceon)
│   ├── metrickit/           # metrics domain (from HexaKit/Metron where applicable)
│   └── …                    # existing observe crates unchanged unless duplicated
├── docs/sota/technical.md   # language placement table (required)
└── Cargo.toml               # workspace root
```

phenotype-otel stays standalone:

```
phenotype-otel/
└── src/lib.rs               # init(), shutdown(), re-exports only
```

Optional dependency edge: `phenotype-otel` may depend on `tracingkit` for shared propagator types; it must not duplicate hexagonal layers.

## Migration phases

### Phase 0 — Freeze & inventory (no moves)

- [ ] Mark HexaKit `Traceon/` and `crates/tracingkit` as **transitional** in HexaKit SOTA.
- [ ] Diff HexaKit `Traceon/` vs PhenoObservability `crates/tracingkit`; produce merge checklist.
- [ ] Confirm no new deps on HexaKit tracing paths (CI grep / dep-guard).

### Phase 1 — Canonical tree in observe workspace

- [ ] Subtree or path-copy Traceon hexagonal core into PhenoObservability `crates/tracingkit` (history-preserving preferred).
- [ ] Resolve naming: crate stays `tracingkit`; repo folder may read `traceon/` internally if docs require, but **publish name unchanged** for repoint compatibility.
- [ ] `cargo check --workspace` green in PhenoObservability.
- [ ] Add language placement table to PhenoObservability SOTA.

### Phase 2 — Consumer repoint

- [ ] Repoint PhenoObservability internal crates from HexaKit git dep → workspace path.
- [ ] Repoint any external consumers found by org-wide manifest search to PhenoObservability/tracingkit.
- [ ] Verify phenotype-otel still builds; add workspace/path dep only if types require it.

### Phase 3 — HexaKit excision

- [ ] Remove `Traceon/` from HexaKit workspace `Cargo.toml`.
- [ ] Remove tracing domain from HexaKit `crates/` (genesis-only enforcement).
- [ ] HexaKit CI green; update charter transitional note.
- [ ] Archive `KooshaPari/Traceon` if not already archived (verify zero external deps).

### Phase 4 — Python edge & docs

- [ ] Confirm ObservabilityKit in phenotype-python-sdk tracks observe workspace APIs.
- [ ] Update [DOMAIN_ROLES.md](../../DOMAIN_ROLES.md) chokepoint table: PhenoObservability → observe workspace (done when PR merges).
- [ ] Close related absorption tasks in RATIONALIZATION_PLAN that assumed HexaKit retention.

## Non-goals

- Creating `phenotype-rust-sdk` or any language-monorepo junk drawer.
- Merging phenotype-otel into PhenoObservability (init stays thin).
- Moving Metron/dashboard assets in the same PR as tracingkit (may parallelize under same role owner).

## Success criteria

1. Zero tracing **domain** code in HexaKit after Phase 3.
2. Single canonical `tracingkit` source in PhenoObservability.
3. phenotype-otel crate remains ≤ thin-init scope (no Span/Tracer domain types in public API unless re-exported intentionally).
4. PhenoObservability `docs/sota/technical.md` documents language placement.
5. All org consumers off HexaKit tracing paths.

## References

- [DOMAIN_ROLES.md](../../DOMAIN_ROLES.md) — `observe` role map
- [LANGUAGE_PLACEMENT.md](../../LANGUAGE_PLACEMENT.md) — Tier 1 Rust for Traceon core
- [RATIONALIZATION_EXECUTION.md](../../RATIONALIZATION_EXECUTION.md) — PhenoObservability chokepoint
- HexaKit `Traceon/` — transitional hexagonal core (source)
- phenotype-otel — thin OTLP init (stays)
