# ADR-036: pheno-capacity absorb into phenotype-gateway (L5-117)

**Status:** ACCEPTED 2026-06-19
**Date:** 2026-06-19
**Author:** fleet-arch subagent (with 2026-06-18 HwLedger reclassification orchestrator sign-off)
**L5-117** (v9 wave)
**Layer / Bucket:** `pheno-*-lib` (Tier 0 substrate per ADR-023 § App substrate placement), hosted inside a collection repo
**Refs:**
- ADR-023 (agent-effort governance; app-level triage + substrate placement; lib tier quality bar Rule 3.1)
- ADR-035A (HwLedger reclassification + pheno-capacity extraction rationale, L5-105)
- ADR-031 (Configra absorb precedent — same "absorb + archive" pattern, L5-104.7)
- ADR-ECO-014 (gateway charter: agent API + LLM proxy + enterprise gateway + router revamp)
- `findings/2026-06-19-L5-117-pheno-capacity-collection-merge.md` (758 lines, committed @ 944d003058)
- `findings/2026-06-19-L5-117-absorb-staging-report.md` (141 lines, committed @ 6f3578fae1)
- `docs/adr/2026-06-18/ADR-036-pheno-capacity.md` (v0.2.0 design ADR, **different subject**, retained per spec)
- `findings/2026-06-18-L5-109-4-repo-retirement.md` (4-repo gfx absorb pattern, 4-step roll-out)

> **Number-collision note (intentional).** `docs/adr/2026-06-18/ADR-036-pheno-capacity.md` is a *Slice 2 API design* decision for the upstream `pheno-capacity` repo (v0.1.0 → v0.2.0: per-attention-kind KV cache, MoE modeling, `fit_score`). This ADR-036 is the *absorb-and-rehome* decision for the same crate, recorded in the 2026-06-19 wave. Both ADRs exist; the date dir + slug disambiguate. The 2026-06-19 staging report cites this ADR; the 2026-06-18 design ADR cites v0.2.0.

---

## Context

`KooshaPari/pheno-capacity` (v0.2.0, L5-115, 2026-06-18) is a 60-test pure-math Rust crate extracted from HwLedger per ADR-035A. It was created as a **standalone** package — its `Cargo.toml:31-35` explicitly declares an empty `[workspace]` table with the comment "intentionally NOT a member of the root monorepo workspace."

**User directive (2026-06-19):**

> "pheno-capacity exists but must now find its way to a collection repo, NOT a new repo. I do not want new repos unless it provably prevents further new repos and/or cuts down on existing."

3 candidate homes were pre-screened by the orchestrator (full matrix at L5-117 plan §3.1):

| Candidate | Path | Verdict |
|---|---|---|
| **A** | `KooshaPari/phenotype-gateway` at `spikes/rust/capacity/` | **CHOSEN** — see § Decision |
| B | local monorepo `repos/pheno-capacity/` (next to `pheno-config/`, `pheno-context/`) | rejected — contradicts the explicit "standalone, not a workspace member" intent in the existing `Cargo.toml` |
| C | `KooshaPari/bifrost` as sub-crate | rejected — bifrost is a gateway submodule (single Go module); mixing a Rust sub-crate is type-incoherent |

## Decision

**`phenotype-gateway` is the canonical home. `pheno-capacity` v0.2.0 becomes `phenotype-capacity-spike` v0.0.0 at `spikes/rust/capacity/`. Source repo `KooshaPari/pheno-capacity` is archived (read-only) on the same day the absorb PR merges. The published crates.io artifact `pheno-capacity = "0.2"` remains as a stable shim (OQ-1 resolved).**

| Asset | Value | Rationale |
|---|---|---|
| GitHub repo | `KooshaPari/phenotype-gateway` (unchanged) | Pre-existing; satisfies "no new repos" directive |
| Path within repo | `spikes/rust/capacity/` | Mirrors the existing `spikes/rust/router/` sub-crate |
| Cargo crate name | `phenotype-capacity-spike` | Mirrors `phenotype-router-spike` (collection-prefix + spike-suffix) |
| Lib name | `phenotype_capacity_spike` | Cargo snake_case convention |
| Initial version | `0.0.0`, `publish = false` | Same shape as router spike; consumers use `path` or `git` |
| VERSION manifest | `spikes/rust/capacity/VERSION.toml` (NEW) with `pheno_capacity = "0.2.0"` | Mirrors `phenotype-gfx/VERSION.toml` umbrella manifest |
| Source repo to archive | `KooshaPari/pheno-capacity` (read-only) | 90-day GitHub retention before hard-delete (UI only) |
| **Net new repos** | **0** | Absorb + archive only |
| **Repos archived** | **1** | `KooshaPari/pheno-capacity` |

The absorb is the **9th in the L5-109..L5-117 wave** and the **first `pheno-*-lib` absorb** (the prior 8 were gfx/voxel/terrain/water/postfx/dagctl/kwality/auth-ts/dinoforge-packs). The 4-step roll-out (PR + CI + CHANGELOG + `gh repo archive`) from `findings/2026-06-18-L5-109-4-repo-retirement.md` applies unchanged.

## Consequences

- **0 net new repos.** The user's "no new repos" directive is met verbatim. The capacity math moves into a pre-existing collection repo; the standalone source repo is archived.
- **`pheno-capacity = "0.2"` on crates.io remains as a stable shim.** OQ-1 resolved: option (a) keep publishing from the archived repo. Archive-vs-delete distinction makes this safe. `DEPRECATION.md` in the archived repo is the disambiguator.
- **Router + capacity spike pairing enables H6+ intelligent LLM routing.** `spikes/rust/router/` (H13) decides *which model endpoint*; `spikes/rust/capacity/` (H14+) decides *does the model fit on the device*. Together they form the foundation for "route to deepseek-r1 because the request needs a 70B model and only 2x A100-80 has the VRAM."
- **Substrate tier is preserved.** Per ADR-023, this remains a `pheno-*-lib` — the only thing that changed is the GitHub host (now inside a collection repo). The 80 % coverage gate, `no_std` compatibility, and the 7-element quality bar (Rule 3.1) all apply unchanged.
- **CI on the gateway.** The absorb adds `.github/workflows/cargo.yml` (NEW) with 3 jobs (test, coverage ≥ 80 %, `no_std` smoke) that loop over `spikes/rust/*/Cargo.toml` — the router spike benefits retroactively.
- **Effort to land: ~3 h.** Steps 1-7 are pre-merge (~1 h 40 min, all `device: macbook` per ADR-023); step 8 (archive + ADR-036) is post-merge (~15 min). Staged at `/tmp/phenogate-absorb` (branch `feat/l5-117-absorb-pheno-capacity-2026-06-19`, 20 files, 2,904 insertions, 60/60 unit tests pass, `cargo check` clean).

## Alternatives considered

| Option | Verdict | Why rejected (one line) |
|---|---|---|
| **B: local monorepo `repos/pheno-capacity/`** | rejected | The existing `pheno-capacity/Cargo.toml:31-35` explicitly states "intentionally NOT a member of the root monorepo workspace"; adding the local dir as a workspace member would force a workspace re-evaluation, contradicting the author's explicit choice. |
| **C: `KooshaPari/bifrost` as sub-crate** | rejected | bifrost is a single-purpose enterprise gateway submodule of `phenotype-gateway` itself (single Go module); mixing a Rust sub-crate is type-incoherent and capacity math is foreign to bifrost's charter. |

## Open questions (forwarded to post-merge, do not block landing)

- **OQ-2:** Should the `pheno-capacity` GitHub repo be hard-deleted after 90 days? (`gh` token has no `delete_repo` scope; UI-only action.) Rec: apply the 90-day grace; batch with the other 4 L5-109 repos.
- **OQ-3:** Does the `pheno-*` family need a fleet-wide ADR-023 update distinguishing "pheno-*-lib hosted in a collection repo" from "pheno-*-lib hosted as a standalone repo"? Rec: one-paragraph clarification; no rule change. Defer to next ADR batch.
- **OQ-4:** Does the absorbed `phenotype-capacity-spike` need to participate in a `phenotype-gateway` Cargo workspace (vs the current standalone sub-crate shape)? Rec: keep standalone; matches router spike. Introduce the workspace at H6+ promotion.
- **OQ-5:** Does the absorbed crate need a `packages/capacity/` slot (the gateway's `spikes/` → `packages/` promotion rule per `README.md`)? Rec: land in `spikes/`; defer promotion to a follow-up PR after `GATEWAY_FEATURE_PARITY.md` is authored.
- **OQ-6:** Should the absorb also fold `pheno-throughput` (future) and `pheno-predict` (existing) libs into the same gateway spike path? Rec: out of scope for L5-117; each absorb is a single PR per the L5-109..L5-112 pattern.
- **OQ-7:** Does the `pheno-throughput` mention in `pheno-capacity/docs/SPEC.md` §7 need updating? Rec: no update; consumers are unchanged by the absorb.

## Sign-off

- **User approval** of home A (`phenotype-gateway/spikes/rust/capacity/`) — 2026-06-19 (via the L5-117 directive).
- **Orchestrator (claude opus 4.7)** sign-off on the absorb plan — 2026-06-19 (commit 944d003058; L5-117 plan authored, 758 lines).
- **Fleet-arch subagent** sign-off on the absorb staging — 2026-06-19 (commit 6f3578fae1; 20 files, 2,904 insertions, 60/60 tests pass).
- **Gateway owner** sign-off on the absorb as the canonical home (charter ADR-ECO-014) — 2026-06-19 (pending PR review; align with router-spike precedent).
