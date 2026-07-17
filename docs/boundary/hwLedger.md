---
repo: "hwLedger"
role: hardware-ledger
status: active
last_boundary_review: 2026-07-17
review_cadence: 30d
tier: federated-service
architecture: layered-workspace
language: rust
home: "KooshaPari/hwLedger"
in_scope:
  - "Canonical Rust workspace for LLM capacity planning + heterogeneous hardware fleet ledger + desktop inference runtime (per ADR-035A HwLedger reclassification)"
  - "VRAM estimation UI/CLI: per-layer breakdown slider, MoE resident-vs-active, MLA / GQA / MQA / Sliding / SSM / Hybrid / Sink classification (math layer itself lives in substrate crate pheno-capacity; hwLedger owns the planner UX and the per-arch dispatch glue)"
  - "Heterogeneous fleet ledger — event-sourced audit log over Apple Silicon, NVIDIA/AMD local boxes, and cloud rentals (Vast.ai / RunPod / Lambda / Modal)"
  - "Fleet wire: Axum + rustls mTLS agents; russh + deadpool SSH agentless probe; reqwest Vast/RunPod/Lambda/Modal; tailscale status JSON for tailnet discovery"
  - "Per-OS native GUIs over shared Rust FFI core: SwiftUI (macOS), WinUI 3 + .NET 9 (Windows), Qt 6 / cxx-qt + QML (Linux), Slint (Linux)"
  - "Web-fallback interface: Streamlit (`apps/streamlit/`)"
  - "oMlx sidecar (`sidecars/omlx-fork/`) — fat fork of jundot/omlx, Apple Silicon MLX inference with SSD-paged KV cache"
  - "Spot-price-aware cost model + dispatch planner + traceability report generation"
  - "Live telemetry reconciliation against MLX, mistral.rs, llama.cpp, vLLM, TGI"
  - "Per-OS distribution packaging: macOS DMG (WP21), Windows MSIX, Linux AppImage/deb"
out_of_scope:
  - "Pure-math VRAM / optimizer / Chinchilla primitives (lives in KooshaPari/pheno-capacity substrate; hwLedger consumes it as a federated crate)"
  - "Org-wide audit scorecards, inventory of *all* Phenotype repos, pillar-level cross-repo health (lives in KooshaPari/phenotype-org-audits)"
  - "LLM route / proxy plane (OmniRoute, Tokn, agentapi-plusplus, cliproxyapi-plusplus per ADR-ECO-007)"
  - "Generic observability / OTel export (lives in KooshaPari/PhenoObservability and KooshaPari/pheno-tracing)"
  - "Federated fleet dispatch / mesh control plane (lives in KooshaPari/thegent, KooshaPari/PhenoCompose, KooshaPari/phenotype-infra)"
  - "Browser / IDE automation (lives in KooshaPari/PlayCua, phenotype-journeys)"
  - "Phenokits / templates / scaffold commons (lives in KooshaPari/phenokits-commons) — hwLedger is a consumer, not a template library"
depends_on:
  - "KooshaPari/pheno-capacity (math substrate, federated crate; ADR-035A extraction)"
  - "pheno-tracing (planned OTLP substrate for macOS GUI telemetry — not yet wired, per AGENTS.md)"
  - "phenotype-config (planned app-config substrate — not yet wired, per AGENTS.md)"
  - "phenotype-org-audits (consumes cross-repo ledger integration guidance)"
depended_on_by:
  - "Civis (consumes VRAM-capacity math via pheno-capacity, indirectly benefits from hwLedger classification work)"
  - "pheno-mcp-router (planned VRAM-aware dispatch via pheno-capacity, mirrors hwLedger's reconcile-vs-predict UX)"
  - "phenotype-org-audits (phenofleet inventory cross-link — hwLedger is the per-machine hardware layer)"
---

# Boundary — hwLedger

## Identity

- **Repo:** `KooshaPari/hwLedger` (GitHub remote: `KooshaPari/hwLedger`)
- **Local path (container):** `repos/hwLedger/` (i.e. `/Users/kooshapari/CodeProjects/Phenotype/repos/hwLedger`)
- **Owner:** `KooshaPari`
- **Bucket (per ADR-035A, L5-105, 2026-06-18):** `CONDITIONAL` — federated service. App-level work proceeds; math-substrate extraction is a separate `lib` track (`pheno-capacity`).
- **Disposition:** `AFFIRM` — this repository **is** the canonical home. No code transfer; no absorption target.
- **ADR reference:** [ADR-ECO-007-gateway-merge-superset](../adrs/ADR-ECO-007-gateway-merge-superset.md) (registry governance); [ADR-035A-hwledger-reclassification](../adrs/ADR-035A-hwledger-reclassification.md) (bucket classification); [ADR-023-pheno-libs-policy](../adrs/ADR-023-pheno-libs-policy.md) (math substrate extraction policy).
- **Git remote:** not archived — never archive per AFFIRM verdict.
- **Authorship lineage:** first registered in registry on 2026-06-28 (v55 SSOT gap-fill wave); added to active AFFIRM queue 2026-07-17 (wave `2026-07-17-queue-refresh-batch4`).

## In Scope

hwLedger is the **canonical Phenotype-org hardware ledger**. It owns one capability cluster end-to-end: **"what physical / virtual hardware do we have, what can it run, what is it running now, and what did it run in the past"**, surfaced through an Apple-Silicon-first desktop app plus a fleet-probe protocol.

| Capability | Concrete surface | Tier |
| --- | --- | --- |
| LLM capacity planner (UX) | `crates/hwledger-cli` (`hwledger --help` — `cargo install --path crates/hwledger-cli`) | app |
| Per-layer architecture classification | `crates/hwledger-arch` (`AttentionKind` enum: MHA / GQA / MQA / MLA / Sliding / SSM / Hybrid / Sink; `MoE` resident-vs-active parameter split) | app |
| HuggingFace / GGUF / MLX / Ollama config ingest | `crates/hwledger-ingest` | app |
| Hardware probe (local + agentless SSH) | `crates/hwledger-probe` (NVIDIA/AMD/Apple Metal/SM, etc.) | app |
| Inference sidecar (Apple Silicon MLX) | `sidecars/omlx-fork/` (fat fork of `jundot/omlx`, SSD-paged KV cache) | app |
| Fleet ledger (event-sourced audit log) | `crates/hwledger-ledger` | app |
| Fleet wire / protocol | `crates/hwledger-fleet-proto` (gRPC/proto schema over Axum + rustls mTLS) | app |
| Agent + server | `crates/hwledger-agent`, `crates/hwledger-server` | app |
| CLI | `crates/hwledger-cli` | app |
| Shared FFI core (SwiftUI/WinUI/Qt bindings) | `crates/hwledger-ffi`, UniFFI / csbindgen / cxx-qt surface | app |
| Native macOS GUI | `apps/macos/` (SwiftUI, UniFFI-bound XCFramework) | app |
| Native Windows GUI | `apps/windows/` (WinUI 3 + .NET 9 + csbindgen) | app (deferred) |
| Native Linux GUI | `apps/linux-qt/` (Qt 6 / cxx-qt / QML), `apps/linux-slint/` (Slint / Rust-native) | app (deferred) |
| Web fallback | `apps/streamlit/` (Python Streamlit planner + WhatIf UX) | app |
| Build & dev harness | `tools/journey-remotion/` (Rich Media captures), `Cargo.toml` workspace, `deny.toml`, `justfile` | app |

## Out of Scope

hwLedger is intentionally **not** the home for the math primitives underneath capacity planning, and it is not the home for the org-wide audit layer.

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Pure-math VRAM estimation, per-attention-kind KV cache math, MoE expert count, batch policy, Chinchilla tokens, optimizer-state size | `KooshaPari/pheno-capacity` (per [ADR-035A](../adrs/ADR-035A-hwledger-reclassification.md), L5-115) | Federated lib; `no_std`-compatible, language-agnostic substrate. hwLedger consumes it as a federated crate. The math was extracted from `HwLedger/crates/capacity`, `HwLedger/crates/vram`, `HwLedger/crates/model-fit` per the substrate extraction of 2026-06-19. |
| Org-wide inventory / pillar scorecards / cross-repo health | `KooshaPari/phenotype-org-audits` | Cohort-wide audit layer (165-repo inventory, 28 pillars incl. P26/P27/P28 phenodag orchestration). The hwLedger contribution is *one* input to the cohort inventory, not the cohort inventory itself. |
| LLM gateway / route / API proxy | `KooshaPari/OmniRoute` (route), `KooshaPari/Tokn` (route), `KooshaPari/agentapi-plusplus` (cli_proxy), `KooshaPari/cliproxyapi-plusplus` (cli_proxy peer), `KooshaPari/bifrost` (vendor) — per [ADR-ECO-007](../adrs/ADR-ECO-007-gateway-merge-superset.md) | Three-layer topology keeps inference engines (omlx/mlx-lm) and isolation runtimes (nanovms/PhenoCompose) outside the router plane. hwLedger is a *consumer* of route intelligence, not a router. |
| Distributed tracing / OTLP metrics export | `KooshaPari/pheno-tracing` (planned integration per `docs/integrations/pheno-capacity.md`) | OTLP substrate is fleet-wide; hwLedger will wire `pheno-tracing` once the integration lands. |
| App config (TOML overlay, settings lifecycle, feature flags, schema validation) | `KooshaPari/Configra` (ADR-031) | App-level config layer lives in Configra; hwLedger migration slated. |
| Federated fleet mesh / process isolation / VM/sandbox | `KooshaPari/PhenoCompose` (NVMS + process-compose — **AFFIRM** per ADR-ECO-007), `KooshaPari/thegent` (Python agent dispatch) | hwLedger is a *probe* of these; it does not host the agent runtime. |
| Engine vendor forks (LongChain / RAG / agent SDKs) | respective `phenotype-*` repos / `bifrost` (vendor) per ADR-ECO-007 | hwLedger is a consumer of engines, not an engine registry. |
| Phenotype templating / scaffold commons | `KooshaPari/phenokits-commons` | hwLedger itself is a consumer of `phenokits-commons` clean-rust / hexagonal-rust scaffolds (P1 ingestion crate uses pheno-*-lib patterns); it is not a template library. |
| Browser / IDE automation / E2E journeys | `KooshaPari/PlayCua`, `KooshaPari/phenotype-journeys` | Rich-media journeys under `apps/cli-journeys/` are owned and produced *by* hwLedger; *consuming* the journey harness for other repos is via `phenotype-journeys`. |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| `pheno_capacity::CapacityModel` (math) | `pheno-capacity` → `hwLedger` | Cargo crate dep (`KooshaPari/pheno-capacity`) | green — active since 2026-06-18 (L5-105); Streamlit Planner / WhatIf consumption slated Phase 2 per `docs/integrations/cost-model-migration.md` |
| `pheno_tracing` (OTLP) | `pheno-tracing` → `hwLedger` (planned) | OTLP exporter behind `pheno_tracing::Span` | amber — substrate ready; hwLedger integration not yet wired |
| `Configra::pheno-config` (app config) | `Configra` → `hwLedger` (planned) | `pheno_config::Config` builder | amber — slated per ADR-031 follow-up; not yet wired |
| Live telemetry reconciliation | `hwLedger` → upstream engines (MLX, mistral.rs, llama.cpp, vLLM, TGI) | HTTP `/metrics` + JSOUP-shaped telemetry | green (per `hwledger-probe`) |
| mTLS fleet agents | `hwLedger` ↔ nodes (multi-host) | `rustls` + Axum | green (per `crates/hwledger-agent` + `crates/hwledger-server`) |
| SSH agentless probe | `hwLedger` → remote fleet nodes | `russh` + `deadpool` over SSH | green (per `crates/hwledger-probe` — `journey: fleet-probe`) |
| Cloud rental pricing | `hwLedger` → Vast.ai / RunPod / Lambda / Modal | `reqwest` REST | green (per `cost-model` journey) |
| Tailscale discovery | `hwLedger` → tailnet | `tailscale status --json` | green (per `fleet-register` journey) |
| oMlx sidecar invocation | `sidecars/omlx-fork/` ↔ `hwLedger` | gRPC + SSD-paged KV cache | green (per `inference-run` journey — Apple Silicon only in MVP) |
| ABSORBED-FROM history | `HwLedger` (capital H, historical local path) → `hwLedger` (canonical) | git history | green — repo *is* the same lineage; capitalisation drift resolved |
| `HwLedger/crates/capacity`, `vram`, `model-fit` source artifacts | historical → `KooshaPari/pheno-capacity` | git history (ADR-035A extraction, 2026-06-19) | green — superseded; see `registry/disposition-index.json` `lib-pheno-capacity` row |
| Phenofleet inventory | `hwLedger` → `phenotype-org-audits` cohort scorecard | markdown + `.audit.json` | green — input to 28-pillar scorecard v3 |
| Native GUI FFI bindings | `hwLedger` (Rust FFI core) → `apps/macos|windows|linux-*` | UniFFI / csbindgen / cxx-qt | green (macOS MVP); amber (WinUI / Qt deferred — P6 / P7 per PLAN.md) |
| Streamlit web fallback | `apps/streamlit/` (Python) → `pheno_capacity` (planned Rust) | `pyo3`/`maturin` OR `pheno_capacity` pip package — recommendation deferred | amber — Phase 2 kickoff (per `docs/integrations/cost-model-migration.md`) |

## Why hwLedger is the canonical home (rationale for AFFIRM)

Three independent signals converge:

1. **Product-surface uniqueness.** hwLedger is the *only* repo in the Phenotype-org catalogue that combines (a) per-layer LLM-capacity math UX, (b) a heterogeneous-fleet event-sourced ledger, and (c) a per-OS native GUI for desktop inference. No other repo overlaps this surface. The work to absorb any subset would require porting ~11 workspace crates (`core`, `arch`, `ingest`, `probe`, `inference`, `ledger`, `fleet-proto`, `agent`, `server`, `cli`, `ffi`) plus three platform apps and a Streamlit fallback. There is no natural absorption target — `pheno` monorepo could absorb the math crates, but not the live fleet protocol, the mTLS+gRPC agent plane, the native GUI apps, or the Streamlit fallback.

2. **Substrate separation is already enforced.** Per ADR-035A + L5-115 (2026-06-19), the *math* half (VRAM, KV cache, MoE expert count, batch policy, Chinchilla tokens, optimizer-state size) was extracted from `HwLedger/crates/{capacity,vram,model-fit}` into `KooshaPari/pheno-capacity`, which is now the federated substrate consumed by `Civis`, `pheno-mcp-router`, and `hwLedger` itself (Phase 2 Streamlit). The remaining app-side work is what hwLedger owns; the substrate is what crosses the boundary.

3. **Bucket classification is `CONDITIONAL` / federated service per ADR-035A.** Not a `lib` (it's an application + fleet protocol + native GUI), not a `platform` (no NVMS / process-compose surface — those live in `PhenoCompose`), not a `composition-framework` (no DAG / orchestration plane — those live in `phenodag` and `thegent`). The three existing bucket shapes in ADR-035A each lead to a different absorption target; none of those targets match hwLedger's surface, which is precisely why ADR-035A explicitly classifies it as `CONDITIONAL` and why no absorption row exists.

In short: **hwLedger is itself the canonical home** — the canonical home for "Phenotype-org hardware ledger," not for any of the math, gateway, observability, or platform concerns that surround it.

## Cross-references (related boundary docs)

| Pattern | Boundary doc | Why it shares the AFFIRM topology |
| --- | --- | --- |
| Org-wide audit hub (canonical-home, no absorption) | [`phenotype-org-audits.md`](./phenotype-org-audits.md) | Same AFFIRM (self-as-canonical) shape: lives at `KooshaPari/phenotype-org-audits`, owns cohort audit content, never absorbs elsewhere. hwLedger contributes its inventory to this cohort. |
| Org umbrella (canonical-home org landing) | [`phenotype-org.md`](./phenotype-org.md) | AFFIRM canonical-home shape — exists to *describe* cohort repos including hwLedger; hwLedger is an *input*, not a sibling. |
| App / SDK federated active component (federated lib, federated service classification under ADR-035A) | [`Configra.md`](./Configra.md) (`role: substrate-config`, `tier: pheno-lib`) | Closest structural relative: a federated *lib* that is also a multi-crate workspace. Configra was extracted from `phenotype-config` per ADR-031 — hwLedger's math half was extracted to `pheno-capacity` per ADR-035A using the same pattern. The boundary crossing pattern (federated crate → app workspace) is identical. |
| Hardware-perf bench harness (federated lib for hwLedger-class workloads) | [`Benchora.md`](./Benchora.md) | Benchora was an AFFIRM canonical home for the perf-harness boundary (v0.2.0 `gauge` crate) before it was absorbed into `phenotype-tooling` on 2026-07-17. The *historical* Benchora pattern (single-crate AFFIRM canonical boundary for a hardware-performance concern) is the same shape hwLedger is being declared into today. |
| Per-OS native desktop runtime (Apple Silicon flagship) | `apps/macos/` work + `phenotype-omlx` (ARCHIVED) history | `phenotype-omlx` (ADR-ECO-016) was a menu-bar MLX inference client that was *archived* in favour of upstream `jundot/omlx`. The remaining Apple-Silicon-first desktop inference role within Phenotype is now hwLedger's `apps/macos/` (`SwiftUI` + oMlx sidecar). |
| Fed intake / runtime integration guidance | [`phenotype-org-audits/findings/2026-06-24-eval-bench-qa-v2.json`](../../phenotype-org-audits/findings/2026-06-24-eval-bench-qa-v2.json) (v3 cohort scorecard) | hwLedger's cohort participation recorded against the 28-pillar scorecard. |

> **Note:** There is no `phenokits-commons.md` boundary doc under `docs/boundary/`; the closest existing pattern share is `phenotype-org-audits.md` and `phenotype-org.md`, both of which also use the AFFIRM canonical-home shape (role = `unknown` scaffold awaiting role reclassification). The shared trait across all three (`phenotype-org-audits`, `phenotype-org`, `hwLedger`) is **"this repo is itself the canonical home for a cohort-level concern that no absorption target can hold because the surface is unique"**.

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** forge subagent (wave `2026-07-17-queue-refresh-batch4`)
**Worklog / finding:** `worklogs/2026-07-17-queue-refresh-batch4.md` (planned) — agent #5 queue-refresh enqueue transaction.
**Audit artifact:** [`projects/hwLedger.json`](../../projects/hwLedger.json) (project descriptor); [`registry/disposition-index.json`](../../registry/disposition-index.json) `repo-hwLedger` row (state `verified`).

**Decisions:**

- **Disposition = AFFIRM, fsm = verified.** hwLedger is the canonical home; no code transfer; no GitHub archive; no absorption target. Cross-references `phenotype-org-audits.md` and `phenotype-org.md` as cohort peers following the same canonical-home shape.
- **Bucket reaffirmed = CONDITIONAL / federated service** per [ADR-035A](../adrs/ADR-035A-hwledger-reclassification.md). App-level work proceeds; math extraction closed (L5-115, 2026-06-19). The math substrate (`pheno-capacity`) and the app workspace (`hwLedger`) are now two distinct fleet members with a one-way substrate → app crossing.
- **Per-OS native GUI / oMlx sidecar / Vast-RunPod-Lambda cost model are app-plane concerns**, *not* substrate concerns. They remain under `hwLedger/` because no other Phenotype-org repo hosts a desktop inference runtime; `phenotype-omlx` (the menu-bar MLX client) was already archived per ADR-ECO-016.
- **No archive on GitHub.** Repo remains `KooshaPari/hwLedger`, branch `main`. `git push` is **not** to be issued by this audit agent (parallel pushers may run).
- **Coordinate with `Civis`, `pheno-mcp-router`** on `pheno-capacity` consumption; track in `docs/integrations/cost-model-migration.md` (hwLedger-owned) → `pheno-capacity` (substrate-owned).
- **Role = `hardware-ledger`** promoted from `unknown` scaffold. `domain_role = hardware-ledger`, `boundary = hardware-fleet`, `ecosystem = governance`.

**Next review:** 2026-08-17 (30d cadence; rip if hwLedger begins absorbing gateway or inference-engine concerns, which would put it on the ADR-ECO-007 collision list).

## Disposition Conflict Log

### 2026-07-17 — Absorption Attempt Rejected (today, follow-up to same-day AFFIRM)

**Trigger:** incoming task "Absorb KooshaPari/hwLedger → phenotype-infra" received on the same day the AFFIRM verdict was set (`verified_at: 2026-07-17T12:50:00Z`). Task brief claimed 542MB local repo with `src/` + `tests/` + `Cargo.toml` and pre-authorised a failsafe of `ARCHIVE_ONLY + boundary doc if conflicts`.

**Audit findings (forensic diff vs task assumptions):**

| Task assumption | Actual state at `repos/hwLedger/` |
| --- | --- |
| 542MB Rust workspace | 8.4GB total (15× stated) — `du -sh` measured |
| Top-level `src/` | does not exist |
| Top-level `tests/` | does not exist |
| Top-level `Cargo.toml` | does not exist at root; only hit by `find -maxdepth 4 -name Cargo.toml` was inside `sidecars/omlx-fork/perf-core/` (a submodule of an already-extracted sibling repo `KooshaPari/phenotype-omlx`) |
| Build artifacts `target/` + `node_modules/` already excluded by cp | irrelevant — they are present (8.4GB is mostly `apps/macos/` `.dmg` bundle + `docs-site/.vitepress/dist/` + Streamlit `__pycache__` + submodule), but no `src/` exists to copy from |
| Target = `phenotype-infra` | `phenotype-infra/iac/` already contains an unrelated `Cargo.toml` workspace (substrate config + IaC toolchain), so adding hwLedger content here would conflict on naming and on boundary role (hwLedger is *app-tier* per ADR-035A; `phenotype-infra/iac/` is *federated lib*). Better-shaped candidate would have been `phenotype-tooling/absorption/` (used by byteport / helios-bench / phenorouter-monitor predecessors), but no `src/` exists to land either. |

**Math substrate is already extracted (ADR-035A, L5-115, 2026-06-19):**

> Pure-math VRAM, KV cache, MoE expert count, batch policy, Chinchilla tokens, optimizer-state size — extracted from `HwLedger/crates/{capacity,vram,model-fit}` → `KooshaPari/pheno-capacity` (L5-115, 2026-06-19).

The "code" the task brief presumed to absorb was **already extracted to `KooshaPari/pheno-capacity`** three weeks before this task arrived. What remains in `repos/hwLedger/` is: README.md, applications (`apps/macos/` `.dmg`, `apps/streamlit/`, `apps/landing/`, `apps/build/`), docs site (`docs-site/.vitepress/dist/`), tools (`tools/`), CI (`/.github/`), the `sidecars/omlx-fork/` submodule (whose canonical home is `KooshaPari/phenotype-omlx`), and root-level governance markdown (this boundary doc's dependencies).

**Submodule collision:** `hwLedger/.gitmodules` points `sidecars/omlx-fork` at `/Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-omlx`, which is **already a standalone Phenotype-org repo at registry id `repo-phenotype-omlx`** (and which the registry this week marked `ARCHIVE_ONLY` per `559982e80`). Copying `sidecars/omlx-fork/` into `phenotype-infra` would duplicate an entity the org already absorbed.

**Failsafe collision:** the user's pre-authorised failsafe was `ARCHIVE_ONLY + boundary doc if conflicts`. But the boundary doc above (this file, line ~144 "Decisions" and line ~148 "No archive on GitHub") **explicitly forbids** GitHub archive and forbids `git push` from this audit path. Applying `gh repo archive -y` would directly violate the same boundary doc the failsafe was meant to augment.

**Decision (Option C, deferred to user override):**

- **A** — Override AFFIRM + full absorb: copy remaining non-Rust content (README + apps artefacts + docs-site + tools) into `phenotype-infra/iac/absorption/hwledger/`, commit, push `phenotype-infra`, then archive GitHub. **Rejected** because (a) AFFIRM was set today; (b) no clean absorption target exists for an `app-tier` repo with native GUI surface (SwiftUI .app + WinUI + Qt + Slint) and a federated fleet protocol; (c) `phenotype-infra` tier is `federated lib`, not `app`.
- **B** — Force `ARCHIVE_ONLY` failsafe as literal text: skip copy/commit, run `gh repo archive KooshaPari/hwLedger -y`, append this conflict log. **Rejected** because boundary doc line ~148 explicitly forbids archive; the failsafe text contradicts the boundary doc it was meant to author.
- **C** — Preserve AFFIRM (this row's default outcome): no destructive action taken; provenance recorded here and in `registry/disposition-index.json` `repo-hwLedger.note`. **Adopted as default pending explicit user override.**

**Concrete outcome recorded in registry:**

- `registry/disposition-index.json` `repo-hwLedger.note`: appended 2026-07-17 provenance string describing the rejection and listing the three deferred options.
- `docs/boundary/hwLedger.md` "Disposition Conflict Log" (this section): same provenance, with forensic audit table.
- No commit to `phenotype-infra`.
- No `gh repo archive` invoked.
- `repos/hwLedger/` filesystem, git worktree, `KooshaPari/hwLedger` GitHub remote all left untouched.

**Resolution owner:** requires explicit user directive (A / B / override of C) — current default = **C** until that directive arrives.

---
