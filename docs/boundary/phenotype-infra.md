---
repo: "phenotype-infra"
role: tooling
status: active
last_boundary_review: 2026-06-23
review_cadence: 30d
in_scope:
  - IaC for the Phenotype compute mesh (OCI lottery, OCI post-acquire,
    Cloudflare tunnel, Tailscale mesh join, landing bootstrap)
  - Shared observability crate (`iac/observability/`)
  - Lightweight logging stub (`iac/phenotype-logging-stub/`)
  - Daemon binary per provisioning concern (no long-running services)
out_of_scope:
  - Multi-language SDK surface (lives in `phenotype-registry`)
  - Public HTTP API (none — all daemons are single-shot CLIs)
  - Application-level state machines (lives in `phenodag`)
  - Container images (lives in `phenotype-platform-core`)
---

# Boundary — phenotype-infra

## In Scope (2026-06-23 audit)

The `phenotype-infra` repository is the **central IaC** for the Phenotype
compute mesh. It owns:

1. **`iac/oci-lottery/`** — picks the next OCI free-tier instance for
   low-cost compute, persists state in `state.json`, posts a webhook on
   acquire.
2. **`iac/oci-post-acquire/`** — once an OCI instance is acquired,
   sets up Cloudflare tunnel, Tailscale mesh, and bootstraps the
   `phenodag` state machine on the new host.
3. **`iac/landing-bootstrap/`** — first-time setup of a fresh OCI
   ARM instance: installs Nix, Rust toolchain, Node, pnpm, and clones
   the Phenotype spine repos. Uses `ureq` (synchronous, minimal binary).
4. **`iac/tailscale/tailscale-keygen/`** — generates ephemeral Tailscale
   pre-auth keys (used by `oci-post-acquire`).
5. **`iac/observability/`** — shared crate providing `init_tracing`,
   `init_tracing_for_test`, JSON log formatting, and OTel layer wiring.
6. **`iac/phenotype-logging-stub/`** — in-workspace stub that
   re-exports `tracing` + `tracing-subscriber` + `tracing-bunyan-formatter`
   so all daemons can build offline without depending on a `git`-pinned
   `pheno-tracing` (which transitively depends on unpublished `pheno-otel`).
   Re-migration to `pheno-tracing v0.5.0` is tracked in **ADR-036**.

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Long-running services | `phenodag`, `thegent` | DAG state machines and agent runtimes are separate concerns |
| Multi-language SDK surface | `phenotype-registry`, `phenoSDK` | Public API is owned by the spine |
| Container image builds | `phenotype-platform-core` | `Dockerfile` / `Containerfile` are in the platform repo |
| Cloud bill reconciliation | `phenotype-org-finance` | Cost & invoicing concerns |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| `oci-lottery` → OCI | this→cloud | OCI SDK over HTTPS | green |
| `oci-lottery` → phenodag webhook | this→other | JSON HTTP POST | green |
| `oci-post-acquire` → Cloudflare | this→cloud | CF API token + tunnel install | green |
| `oci-post-acquire` → Tailscale | this→cloud | pre-auth key from `tailscale-keygen` | green |
| `oci-post-acquire` → phenodag | this→other | git clone + `cargo run` | green |
| `landing-bootstrap` → GitHub | this→other | HTTPS git clone | green |
| `landing-bootstrap` → Nix | this→system | `nix-env` install | green |
| All daemons → `phenotype-logging-stub` | internal | Rust crate | green |
| All daemons → `observability` | internal | Rust crate | green |
| `observability` → `pheno-tracing` (future) | this→other | Rust crate | amber (ADR-036) |

## 71-Pillar Scorecard (2026-06-23)

See `phenotype-infra/worklog/2026-06-23-71-pillar-scorecard.md` for the
per-pillar rollup. **Score: 49/60 (81.7%)** — exceeds the 71+ target.

Strongest pillars: L0 (workspace topology), L1 (module structure),
L5 (testing), L7 (security), L9 (dep hygiene), L11 (docs).
Weakest pillars: L8 (single-threaded daemons — no async), L17
(dependabot/renovate absent), L18 (issue templates absent),
L20 (devcontainer absent), L21 (SBOM absent).

## Last Boundary Review

**Date:** 2026-06-23
**Reviewer:** forge session (Phase 1 of `plans/2026-06-22-compute-infra-dag-v1.md`)
**Worklog / finding:** `phenotype-infra/worklog/2026-06-23-71-pillar-scorecard.md` + `infra-research/worklog/2026-06-23-compute-infra-phase1.md`
**Decisions:**
- PI-001..007 (path-dep fix, in-workspace stub) MERGED (commit `b53bbe3`)
- PI-080 (CI workflow) MERGED (commit `3fc0e1f`)
- PC-001 (PhenoCompose dead cuda feature) MERGED
- BP-001 (BytePort dead code + security) MERGED
- NV-001..020 (nanovms portable module + sandbox hardening) MERGED
- 4 open questions deferred to user (ureq→reqwest, pheno-tracing re-migration, etc.)

**Next review:** 2026-07-23
