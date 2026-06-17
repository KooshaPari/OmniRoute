# Boundary Owners — Polyrepo Ecosystem Shape

> **Status:** Living SSOT for *who owns which capability boundary*. Complements
> `ECOSYSTEM_MAP.md` (repo index) and `RATIONALIZATION_EXECUTION.md` (merge wave).
>
> **Rule:** Do not delete or unarchive a repo because it is incomplete, stub, empty,
> broken, or unused. Retire a repo only when the **canonical boundary owner** serves
> the full capability (implementation + scaffolding hooks + consumer repointing).
>
> **Generated:** 2026-06-16 (Tier A observability + resilience + config audit wave)

---

## Three-layer model

| Layer | Role | Canonical homes | What it is *not* |
|-------|------|-----------------|------------------|
| **Scaffold** | Bootstrap repos, folder layouts, CI/governance templates, architectural patterns | `HexaKit`, `phenokits-commons`, `phenotype-org-governance`, `phenotype-infra` | A library warehouse or runtime dependency hub |
| **Domain SDK** | Loose-coupled, optionally installed domain modules (auth, observability, MCP, testing, data, resilience) | `phenotype-python-sdk`, `phenotype-go-sdk`, `phenotype-rust-sdk` (target) | Full product workspaces; duplicate per-repo kit copies |
| **Domain workspace** | Boundaries large enough to justify dedicated repos and release trains | `PhenoObservability`, `Agentora`, `AgilePlus`, `Settly`, `Conft`, `phenoXddLib`, `phenotype-journeys`, `phenotype-tooling` | Generic templates; polyglot facades (those belong in SDK layer) |

### HexaKit (scaffold only)

Per `docs/registries.md` and org direction (2026-06):

- **Owns:** `by-language/`, `by-project/`, `registry.yaml`, `.template.*`, governance
  workflow references, hexagonal **folder** patterns copied into new repos.
- **Does not own:** Runtime metrics, tracing, config engines, resilience implementations.
  Those may appear temporarily as `templates/hexagon/rust/{metrickit,tracingkit,...}` stubs
  only — not full workspace members with independent release cycles.
- **Remediation:** Evict `Metron/`, `Traceon/`, `phenotype-telemetry`, `phenotype-logging`,
  and other domain crates from the HexaKit workspace (3933+ blobs today). Keep template
  paths; move implementations to boundary owners below.

### Domain SDK monorepos (dynamic install)

When a domain module is **too small** for its own repo governance overhead, it lives in an
SDK monorepo as an optional package/crate:

```text
phenotype-python-sdk/packages/{auth-kit,data-kit,mcp-kit,observability-kit,resilience-kit,testing-kit,...}
phenotype-go-sdk/...
phenotype-rust-sdk/...   # target: thin Rust facades + re-exports, not HexaKit
```

Consumers install only what they need (`pip install phenotype-sdk[observability]` pattern).
Per-repo tailoring = distributed config (pyproject extras, `phenotype.toml`, Conft overlays)
— not copying kit trees into every repo.

---

## Boundary owner matrix (Tier A — audited 2026-06-16)

### Observability

| Slice | Canonical owner | Absorb from | Consumer pattern | Coverage | Recommendation |
|-------|-----------------|-------------|------------------|----------|----------------|
| Rust metrics (`metrickit`) | **PhenoObservability** `crates/metrickit` (target) | `Metron`, `HexaKit/Metron/` | `git`/crates.io dep on phenoObservability member | 100% dup in HexaKit; 0% in PO | **MOVE → PO, ARCHIVE Metron**, strip HexaKit copy |
| Rust tracing scaffold (`tracingkit`) | **PhenoObservability** `crates/tracingkit` | `Traceon`, `HexaKit/Traceon/` | Hex domain → tracingkit; prod OTEL → `phenotype-otel` / tracely crates | ~95% code in PO | **KEEP_ARCHIVED** Traceon + redirect |
| Rust OTEL / production tracing | **PhenoObservability** (+ `phenotype-otel` merge) | `phenotype-otel` repo | Fleet services | partial | **MERGE** phenotype-otel into PO |
| Python observability facade | **phenotype-python-sdk** `packages/observability-kit` | `ObservabilityKit`, `PhenoObservability/ObservabilityKit/` | `pip install` / path dep | 100% file parity SDK | **DELETE** archived OK after PO subtree removed |
| Org-wide obs workspace SSOT | **PhenoObservability** | Metron, Traceon, ObservabilityKit subtree, HexaKit telemetry/logging | Tracera, FocalPoint, AgilePlus, OmniRoute | ~55% boundary | **AFFIRM owner** — execute P0–P2 wave |

**Conflict:** `RATIONALIZATION_EXECUTION.md` §1 lists Metron/Traceon → **HexaKit**. That row is
**superseded for runtime libs** by `ECOSYSTEM_MAP.md` Cluster D (PhenoObservability canonical).
HexaKit receives **template mirrors only**.

### Resilience

| Slice | Canonical owner | Absorb from | Coverage | Recommendation |
|-------|-----------------|-------------|----------|----------------|
| Python facade | **phenotype-python-sdk** `packages/resilience-kit` | `ResilienceKit` | 100% file copy; **0%** `pheno_resilience` impl (tests red) | **KEEP_ARCHIVED** until Python impl lands |
| Rust retry / CB / bulkhead | **phenotype-rust-sdk** or dedicated `phenotype-resilience` crate workspace — **not HexaKit** | `ResilienceKit/rust`, `phenotype-tooling` off-canonical copies | ~43% functional, wrong homes | **RELOCATE** Rust out of SDK subtree + tooling into rust-sdk / resilience workspace |

### Configuration

| Slice | Canonical owner | Absorb from | Coverage | Recommendation |
|-------|-----------------|-------------|----------|----------------|
| Rust layered config (`settly`) | **Settly** (boundary name); code today in `HexaKit/crates/settly` — **migrate out** of HexaKit | archived `Settly` | 87/87 paths; 81.6% SHA parity | **KEEP_ARCHIVED**; reconcile drift; eventual standalone or rust-sdk member |
| TypeScript config | **Conft** | — | README/runtime gap | **ACTIVE** — implement PLAN |
| Python config | **phenotype-python-sdk** `packages/phenotype-config` | scattered `phenotype-config-*` | partial | Fold fragments; repoint Pyron |

### Testing / QA (from prior wave — boundary split)

| Slice | Canonical owner |
|-------|----------------|
| MCP QA, pytest plugins, quality CLIs | `phenotype-python-sdk/packages/testing-kit` |
| xDD / BDD / property / mutation (Rust) | `phenoXddLib` (not HexaKit long-term) |
| E2E journey harness | `phenotype-journeys` |
| Per-repo test scaffolds (Playwright, CI harness) | `phenokits-commons` |
| Org CI policy workflows | `phenotype-org-governance` + HexaKit `.template.*` |

**TestingKit** file parity in python-sdk does **not** close the testing boundary. **HOLD delete**
until slices above are explicit consumer defaults.

### Governance / spec-driven development

| Slice | Canonical owner | Absorb from | Coverage | Recommendation |
|-------|-----------------|-------------|----------|----------------|
| Spec lifecycle (specify → ship) | **AgilePlus** | — | CLI + `.agileplus/` | **AFFIRM owner** — repatriate crates from Agentora staging |
| CI/governance templates | **phenokits-commons** `governance/` | PhenoProc `phenotype-governance/templates` | Ported PR #3 | **AFFIRM** — fleet bootstrap source |
| Per-language lint/format configs | **phenokits-commons** `governance/phenoproc-configs/` | PhenoProc configs | Ported PR #3 | Copy-on-bootstrap, not from archives |
| Org reusable CI workflows | **phenotype-org-governance** | scattered | partial | Consolidate consumers |
| Boundary + DAG SSOT | **phenotype-registry** | — | `BOUNDARY_OWNERS`, rationalization docs | **AFFIRM** — merge PR #76 |
| Router monitor product | **phenotype-tooling** `absorption/` | PhenoProc | PR #155 | **AFFIRM** — not Agentora long-term |

**Conflict:** `agileplus-*` staged in **Agentora** `crates/` during PhenoProc wave 5 is **staging only**.
Canonical home is **AgilePlus** per ADR-005. Agentora owns agent/proc runtime — not governance substrate.

### Agent / process plane (PhenoProc absorption)

| Slice | Canonical owner | Status (2026-06-17) | Recommendation |
|-------|-----------------|----------------------|----------------|
| Python `pheno-*` (16 packages) | **Agentora** `agents/phenoagent/python/` | ✅ waves 1–4 | AFFIRM |
| Rust proc runtime (`pheno-proc-*`) | **Agentora** `crates/pheno-proc-runtime/` | ✅ workspace members | AFFIRM |
| Bulk PhenoProc crates (staging) | **Agentora** `crates/` + manifest | ✅ ~98% PR #79 | Staging; `phenotype-*` → HexaKit repoint |
| Go `pheno-cli` | **Agentora** `agents/phenoagent/pheno-cli-go` | ✅ wave 5 | AFFIRM |
| PhenoProc repo | — | absorption complete | **HOLD DELETE** until PR #79 + manifest scan |

---

## Delete / archive gate (replaces file-parity-only rule)

```text
DELETE archived repo  IFF:
  1. CANONICAL_OWNER is named in this doc or ECOSYSTEM_MAP
  2. All INBOUND_ABSORPTIONS merged or explicitly redirected
  3. OUTBOUND_CONSUMERS repointed (manifests, not just copy)
  4. Scaffold hooks exist at owner (template path OR sdk extra OR governance workflow)
  5. No unique boundary slice remains only in source
```

| Repo | Gate status | Verdict |
|------|-------------|---------|
| ObservabilityKit | 2–4 partial (PO subtree, SDK listing) | DELETE after P2 cleanup |
| Metron | 1 yes, 2 partial (wrong home HexaKit), 3 n/a | ARCHIVE after PO `metrickit` |
| Traceon | 2 done in PO | KEEP_ARCHIVED |
| ResilienceKit | 2 file copy only; 4 Python facade missing | KEEP_ARCHIVED |
| Settly | 2 in HexaKit (wrong layer); 3 Pyron open | KEEP_ARCHIVED |
| TestingKit | SDK slice only; testing plane split open | KEEP_ARCHIVED (revised) |
| PhenoProc | 2–3 partial (#79 open, scan pending) | HOLD DELETE after gate |

---

## Priority actions (boundary reshaping)

| Pri | Action |
|-----|--------|
| **P0** | Merge `docs/rationalization/*` + ADR-004..006 (registry PR #76) |
| **P0** | Repatriate `agileplus-*` from Agentora → AgilePlus (ADR-005) |
| **P0** | Fleet-adopt zero-loop session protocol (ADR-006) |
| **P0** | Strip domain workspace members from HexaKit; keep `templates/hexagon/**` only |
| **P0** | Amend `RATIONALIZATION_EXECUTION.md` §1: Metron/Traceon runtime → PhenoObservability |
| **P1** | Subtree Metron → `PhenoObservability/crates/metrickit`; archive standalone Metron |
| **P1** | Implement `pheno_resilience` in python-sdk; strip non-Python from resilience-kit |
| **P1** | Remove `PhenoObservability/ObservabilityKit/` embedded copy |
| **P2** | Migrate `HexaKit/crates/settly` → standalone Settly or `phenotype-rust-sdk` optional crate |
| **P2** | Define `phenotype-rust-sdk` package layout for domains too small for own repo |
| **P3** | Refresh `ECOSYSTEM_MAP.md` Cluster D/I/H from this matrix |
| **P3** | Consumer manifest scan; execute archive shortlist (`RATIONALIZATION_EXECUTION.md`) |

---

## References

- `ECOSYSTEM_MAP.md` — live repo index (wins on role disagreements)
- `docs/registries.md` — HexaKit scaffold role
- `docs/rationalization/ZERO_LOOP_ECOSYSTEM_PLAN.md` — master DAG + phases + metrics
- `docs/rationalization/ECOSYSTEM_DAG.md` — 20-lane parallel recipe
- `docs/rationalization/SESSION_ARTIFACT_PROTOCOL.md` — session folder contract
- `docs/adr/ADR-004-absorption-staging-vs-canonical.md`
- `docs/adr/ADR-005-agileplus-governance-boundary.md`
- `docs/adr/ADR-006-zero-loop-agent-session.md`
- `RATIONALIZATION_EXECUTION.md` — absorption wave (§1 partially superseded here for obs libs)
- Open gap ports: [registry#76](https://github.com/KooshaPari/phenotype-registry/pull/76), [phenokits-commons#3](https://github.com/KooshaPari/phenokits-commons/pull/3), [Agentora#79](https://github.com/KooshaPari/Agentora/pull/79), [phenotype-tooling#155](https://github.com/KooshaPari/phenotype-tooling/pull/155), [PhenoObservability#157](https://github.com/KooshaPari/PhenoObservability/pull/157)
