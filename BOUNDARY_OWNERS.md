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
| **Domain workspace** | Boundaries large enough to justify dedicated repos and release trains | `PhenoObservability`, `Agentora`, `AgilePlus`, `phenotype-config`, `Conft`, `phenotype-journeys`, `phenotype-tooling` | Generic templates; polyglot facades (those belong in SDK layer); **not** `phenoShared` |

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

### phenoShared (DECOMPOSE — not a boundary owner)

Per [ADR-ECO-014](docs/adrs/ADR-ECO-014-phenoshared-decompose.md) (2026-06-17):

- **Not** a domain SDK, framework, or shared-lib SSOT.
- **Interim staging only** for crates evicted from HexaKit during P3; each crate must land in a **role owner** (`phenotype-config`, `phenotype-resilience`, `PhenoObservability`, `phenotype-types`, `Eventra`, …).
- Fleet repoints from `pheno` / HexaKit must **not** terminate on `phenoShared` as final target.
- DELETE gate: all crates relocated + 0 external refs → archive/delete `KooshaPari/phenoShared`.

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

### Gateway / agent control plane (audited 2026-06-17, wave 15)

| Slice | Canonical owner | Layer | Consumer / integration | Recommendation |
|-------|-----------------|-------|------------------------|----------------|
| LLM routing policy (TS) | **OmniRoute** | Platform `route` | phenoAI consumer | **AFFIRM** — never archive |
| Rust routing substrate | **Tokn** `tokenledger::routing` | Platform `route` | pareto router ports | **AFFIRM** — not bifrost |
| Agent terminal HTTP API | **agentapi-plusplus** | Platform `cli_proxy` | substrate `engine-agentapi`, sharecli | **UNIFY** — G15 superset merge |
| CLI subscription proxy | **cliproxyapi-plusplus** | Platform `cli_proxy` | go-sdk `third_party`, argis-extensions | **UNIFY** — G16 superset + pin |
| Fleet dispatch runtime | **substrate** | Platform `connect` | driver-http/argv, engine-agentapi | **AFFIRM** |
| Archived agentapi tombstone | **agentapi** | — | redirect only | **KEEP_ARCHIVED** |
| Vendor AI gateway | **bifrost** | Engine vendor | optional experiments only | **VENDOR-KEEP** — G17 pin `phenotype/vendor-2026-06`; never merge into OmniRoute |
| macOS MLX client UX | **phenotype-omlx** | Platform `inference` | registry/landing refs | **SPLIT** — ADR-ECO-008; unarchive when staffed |
| MLX inference engine | **jundot/omlx** upstream | Engine | phenotype-omlx client | Monthly upstream sync; not HexaKit |

**Conflict:** `RATIONALIZATION_PLAN.md` Step 1 previously archived OmniRoute and agentapi++. **Superseded** by [ADR-ECO-007](docs/adrs/ADR-ECO-007-gateway-merge-superset.md) and [wave15-execution](docs/operations/wave15-execution-2026-06-17.md).

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
| McpKit | 1 yes (PhenoFastMCP/PhenoMCPServers/substrate per ADR-017), 2 done (SUPERSEDED_PARITY × 5: Rust framework→PhenoFastMCP-rust, Py framework→PhenoFastMCP, impls→PhenoMCPServers, runtime→substrate, AgentMCP→Agentora), 3 done (catalog/registry.yaml), 4 done (PhenoMCPServers `mcp-server` template + python-sdk `[connect]`), 5 yes (registry.yaml explicit retirement row + PhenoMCPServers catalog) | **DELETE after registry#156 merge** — Go/TS SDK scaffold-only = NO_MERIT, no absorption target |
| phenoShared | 1 yes (DOMAIN_ROLES per ADR-ECO-014), 2 done (P4 decompose), 3 **fail** (15 fleet git deps post–HexaKit#277), 4 partial (slice owners landed; generic contracts interim), 5 **fail** (11 HexaKit interim pins + PO/ResilienceKit/python-sdk) | **HOLD DELETE** — archive only after zero-dep; never hard-delete without explicit policy |

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


### Interaction (added 2026-06-23)
- **Canonical owner:** `KooshaPari/eyetracker`
- **Stack:** Rust + UniFFI bindings (Kotlin + Swift)
- **Boundary:** Eye-tracking framework, calibration, fixation detection, dwell-click accessibility
- **Status:** active (v0.1.0-alpha, 16/16 FRs defined, released 2026-06-20 per PR #64)
- **Absorb from:** —
- **Consumer pattern:** Pyron shim for Python edge; direct UniFFI bindings for Kotlin/Swift consumers
- **Coverage:** macOS webcam (nokhwa + core-graphics) only — Win/Linux/iOS/Android/Web gaps to close (BEN-EYE-001..006)
- **Recommendation:** **KEEP_ACTIVE** — establish per-platform SOTA gap closure roadmap

### Event-bus Runtime (added 2026-06-23)
- **Canonical owner:** `KooshaPari/Eventra`
- **Stack:** Rust (CQRS + Event Sourcing)
- **Boundary:** Rust event-bus runtime (`phenotype-event-bus` + `phenotype-event-sourcing` + `phenotype-event-contracts`)
- **Status:** active (Wave 5b absorbed from phenoShared 2026-06; **KEEP_COMPAT** per `docs/disposition/phenotype-event-bus-runtime-boundary.md`)
- **Absorb from:** phenoShared (Wave 5b)
- **Consumer pattern:** In-memory bus + envelope-shaped events; new runtime features delegate to phenoEvents
- **Coverage:** in-memory only (sqlx/sqlite adapter modules missing despite feature flags)
- **Recommendation:** **KEEP_ACTIVE** — implement persistence adapters + observability (open ISS #22, #23, #24)

### Configuration (Rust) (refreshed 2026-06-23)
- **Canonical owner:** `KooshaPari/Configra`
- **Stack:** Rust
- **Boundary:** Rust config framework (typed layered config, hot-reload, schema validation)
- **Status:** active (v0.4.0; supersedes phenotype-config per ADR-031)
- **Absorb from:** phenotype-config-loader, OKF, config-schema, settly (migrated from HexaKit 2026-06-17)
- **Consumer pattern:** Configra consumed by phenotype-ops + future phenotype-rust-sdk; Conft TS overlay interop
- **Coverage:** hot-reload missing (no notify); schema validation minimal; encryption at rest claim vs zero crypto dep (gap)
- **Recommendation:** **KEEP_ACTIVE** — add notify + figment + schemars + aes-gcm; reconcile README encryption-at-rest claim

### Performance / Benchmark Harness (added 2026-06-23)
- **Canonical owner:** `KooshaPari/Benchora`
- **Stack:** Rust (criterion)
- **Boundary:** Perf-harness framework, regression gating, baseline matrix for owned scope
- **Status:** active (v0.2.0, single crate `gauge`)
- **Absorb from:** —
- **Consumer pattern:** Criterion re-wrap; provides perf baseline matrix for eyetracker/eventra/authvault/configra/quillr
- **Coverage:** no CI regression gating, no flamegraph, no historical trend store, no allocation tracking
- **Recommendation:** **KEEP_ACTIVE** — add github-action-benchmark + cargo-flamegraph + dhat/iai

### HTTP Middleware (added 2026-06-23)
- **Canonical owner:** `KooshaPari/Quillr`
- **Stack:** Rust (httpora-core) + TypeScript (@kooshapari/quillts)
- **Boundary:** HTTP toolkit — Tower middleware (rate-limit/retry/CB/CORS) + TS client
- **Status:** active (v0.1.0; httpora absorbed 2026-06-20 per #28)
- **Absorb from:** Httpora (folded per Quillr#27)
- **Consumer pattern:** HTTP middleware consumed by Eventra outbox + Authvault audit forwarder + Configra remote sync
- **Coverage:** no reqwest/hyper backend, no HTTP/2/3, no OTel export, no moka cache, no mTLS helpers
- **Recommendation:** **KEEP_ACTIVE** — add reqwest + quinn/h3 + tracing-opentelemetry + moka

### Auth Runtime (refreshed 2026-06-24)
- **Canonical owner:** `KooshaPari/AuthKit` (active; successor to archived Authvault)
- **Historical owner:** `KooshaPari/Authvault` (archived 2026-06-20, commit c7994b9)
- **Stack:** Rust (OAuth2/OIDC/JWT/RBAC/ABAC, multi-tenant)
- **Boundary:** Rust auth framework — PKCE, JWS, vault, KMS, audit
- **Status:** AuthKit active (v0.1.0, FR-AUTHV-018 landed 2026-06-24 commit 064b310); Authvault read-only history
- **Absorb from:** AuthKit created 2026-06-24 to receive the 3 unmerged GAP worktrees (gap008 PKCE, gap009 brute-force, gap010 middleware-adapter); gap009 + gap010 were already merged into Authvault main, gap008 landed in AuthKit
- **Consumer pattern:** Repointed by eyetracker (consent+SSO), eventra (tenant_id), configra (VaultStore), quillr (token introspection)
- **Coverage:** Strong on internal JWT/RBAC/PKCE state binding; weak on OIDC/ABAC/WebAuthn/TOTP/KMS/DPoP/audit hash-chain
- **Recommendation:** **KEEP_ACTIVE** — AUT-SOTA-001..007 (key rotation, OIDC, WebAuthn, TOTP, KMS, DPoP, rate-limiting)

