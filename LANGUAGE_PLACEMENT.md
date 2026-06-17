# Language Placement Policy

> Every repo with a **platform role** documents language choices in `docs/sota/technical.md`.

## Tiers

### Tier 1 — Core (default for systems code)

| Language | Use |
|----------|-----|
| **Rust** | Long-lived libraries, agents, infra, correctness-critical paths |
| **Zig** | Low-level tooling, alloc-control, C interop, template native layers |
| **Mojo** | Numeric/AI kernel experiments where SOTA justifies |

New feature? **Start here** unless an edge tier wins in SOTA.

### Tier 2 — Product edges (default for SDKs and iteration)

| Stack | Use |
|-------|-----|
| **Python 3.14 + uv** | SDK packages, scripting, data/ML glue, test harnesses |
| **Bun + TypeScript 7 preview** | CLIs, dashboards, rapid UI-adjacent tooling |

### Tier 3 — Justified edges (requires SOTA paragraph)

| Language | Allowed when |
|----------|--------------|
| **Go** | Ecosystem lock-in (devenv, K8s operators, existing Go module surface), team velocity on platform role only |
| **C# / Java** | Interop microservices, enterprise integration, vendor SDK wrappers — **not** for reimplementing core domain |

### Tier 4 — Forbidden without ADR

- New standalone `*Kit` GitHub repos (use role workspace + optional install)
- Domain logic in HexaKit `crates/` (genesis role only)
- Second Go codebase for same role without merge plan

## Decision template (paste in `docs/sota/technical.md`)

```markdown
## Language placement

| Component | Lang | Tier | Rationale |
|-----------|------|------|-----------|
| settly core | Rust | 1 | … |
| devenv CLI | Go | 3 | K8s/ecosystem … |
| testing-kit | Py/uv | 2 | … |
```

## Examples (fleet)

| Component | Choice | Why |
|-----------|--------|-----|
| KodeVibe `engine/` | Go | **Tier 3** — existing analyzer; documented in KodeVibe SOTA |
| phenotype-otel init | Rust | **Tier 1** — thin OTLP bridge |
| Conft | TS/Bun | **Tier 2** — npm publish surface |
| PlatformKit devenv | Go | **Tier 3** — devhex/devenv ecosystem |
| Traceon hexagonal core | Rust | **Tier 1** — moves to `observe` role, not HexaKit |

## Genesis templates

HexaKit `templates/{rust,zig,mojo,python,typescript,go}/` provide per-language scaffolds.  
`templates/genesis/` adds charter, review, intent, SOTA, OKF on every new repo.
