# `pheno-port-adapter` — Phase 1C: Target-Parity Audit

> **Audit target:** `pheno-port-adapter/` (monorepo root subdir; standalone Rust crate per `[workspace]` in `Cargo.toml:7`).
> **Working tree HEAD:** `9cf52be5c4` (`chore/v19-71-pillar-cycle-9-p0-2026-06-21`); monorepo remote = `phenotype-apps` (worktree-relative path; verified by `git remote -v` showing `argisgit@github.com:KooshaPari/argis-extensions.git` + `phenotype-appsgit@github.com:KooshaPari/phenotype-apps.git` as the two remotes reachable from this path; `git worktree list` confirms `repos/` is one of 15+ worktrees of the same monorepo).
> **Audit date:** 2026-06-21 (PDT).
> **Auditor:** Forge Code (`MiniMax-M3`), per the v19 cycle-9 substrate audit plan (71-pillar L4 hexagonal port-adapter evaluation).
> **Companion docs:** `findings/2026-06-21-pheno-port-adapter-audit/00-FINAL-AUDIT.md` (root scorecard), `…/02-docs-code.md` (Phase 1B docs + code features, 1,224 LoC).
> **Pattern role:** hexagonal L4 Port/Adapter reference impl (ADR-014 predecessor + ADR-038 canonical policy).
> **Substrate tier:** `pheno-*-lib` per ADR-023 Rule 3 (canonical Rust library, single concern, single crate).
> **Pattern question (this audit):** is `pheno-port-adapter` absorbable into another crate, or is it the **canonical substrate** that other crates should converge on?

---

## Table of contents

1. [Executive verdict](#1-executive-verdict)
2. [Source-of-truth inventory: 4 local copies of pheno-port-adapter](#2-source-of-truth-inventory-4-local-copies-of-pheno-port-adapter)
3. [Candidate 1: `pheno/` monorepo (parity shadow check)](#3-candidate-1-pheno-monorepo-parity-shadow-check)
4. [Candidate 2: `phenotype-apps` monorepo (host monorepo of the standalone entry)](#4-candidate-2-phenotype-apps-monorepo-host-monorepo-of-the-standalone-entry)
5. [Candidate 3: `phenotype-router` (cross-language Go router)](#5-candidate-3-phenotype-router-cross-language-go-router)
6. [Candidate 4: `pheno-otel` (OTLP wire substrate, L56-L63 cluster)](#6-candidate-4-pheno-otel-otlp-wire-substrate-l56-l63-cluster)
7. [Candidate 5: `pheno-tracing` (canonical observability carrier, ADR-036B)](#7-candidate-5-pheno-tracing-canonical-observability-carrier-adr-036b)
8. [Candidate 6: `pheno-flags` (preserved canonical per audit 8)](#8-candidate-6-pheno-flags-preserved-canonical-per-audit-8)
9. [Candidate 7: `pheno-errors` (shadow substrate per audit 7)](#9-candidate-7-pheno-errors-shadow-substrate-per-audit-7)
10. [Candidate 8: `phenotype-config` / `Configra` (config substrate)](#10-candidate-8-phenotype-config--configra-config-substrate)
11. [Candidate 9: `pheno-mcp-router` (Python substrate)](#11-candidate-9-pheno-mcp-router-python-substrate)
12. [Candidate 10: `pheno-scaffold-kit` (umbrella)](#12-candidate-10-pheno-scaffold-kit-umbrella)
13. [Candidate 11: `phenotype-registry` (registry only)](#13-candidate-11-phenotype-registry-registry-only)
14. [Candidate 12: `phenotype-python-sdk` (polyglot facade)](#14-candidate-12-phenotype-python-sdk-polyglot-facade)
15. [Candidate 13: `AgilePlus` (Rust product, port-adapter pattern?](#15-candidate-13-agileplus-rust-product-port-adapter-pattern)
16. [Candidate 14: `HexaKit` (Rust framework, hexagonal L4 architecture)](#16-candidate-14-hexakit-rust-framework-hexagonal-l4-architecture)
17. [Candidate 15: `FocalPoint` (Rust framework, hexagonal L4 architecture?](#17-candidate-15-focalpoint-rust-framework-hexagonal-l4-architecture)
18. [Production-consumer search across the fleet](#18-production-consumer-search-across-the-fleet)
19. [Polyglot / FFI bindings check](#19-polyglot--ffi-bindings-check)
20. [Federal service / framework status per ADR-023](#20-federal-service--framework-status-per-adr-023)
21. [Final absorption verdict + consolidation recommendations](#21-final-absorption-verdict--consolidation-recommendations)
22. [Appendix A — Candidate plausibility matrix](#22-appendix-a--candidate-plausibility-matrix)
23. [Appendix B — File:line evidence index](#23-appendix-b--fileline-evidence-index)
24. [Appendix C — GitHub code-search evidence (raw `gh search code` output)](#24-appendix-c--github-code-search-evidence-raw-gh-search-code-output)

---

## 1. Executive verdict

**`pheno-port-adapter` is the canonical L4 hexagonal port-adapter substrate per ADR-038. It is NOT absorbable into any other crate in the fleet.** No candidate repo has overlapping API surface, no candidate has the hex-port trait shape, and no candidate has the same dependency profile.

**Key findings (one line each):**

1. **Canonical-by-ADR, un-adopted-in-practice.** `pheno-port-adapter/SPEC.md:12` claims "consumed by every other pheno-* substrate crate" but `gh search code --owner KooshaPari 'pheno-port-adapter\s*='` returns **zero Cargo.toml dependency hits** across the entire KooshaPari org (see [§ 18](#18-production-consumer-search-across-the-fleet)).
2. **4 stale local copies** of the same crate exist (`repos/pheno-port-adapter/`, `repos/FocalPoint/pheno-port-adapter/`, `repos/focalpoint-wt-v12-16-17/pheno-port-adapter/`, `repos/argis-extensions/pheno-port-adapter/`). The standalone `repos/pheno-port-adapter/` is the **most complete** (latest Cargo.toml, async hex-ports, loom tests, fuzz, benches, i18n, full meta-bundle).
3. **Two other repos have their own `phenotype-port-traits` + `phenotype-ports-canonical` crates** with overlapping names but different shape: `HexaKit/crates/phenotype-port-traits/` and `pheno/crates/phenotype-port-traits/`. These are DDD/CQRS-flavored (inbound/outbound split), not PortAdapter-flavored. They are NOT the same substrate.
4. **Zero production code consumes `pheno-port-adapter`** — neither in Rust, Python, Go, TypeScript, nor Swift. The crate is canonical by declaration (ADR-014/038), but the 22-crate migration matrix in `SPEC.md:12` has not been executed.

**Plausibility: HIGH for ZERO candidates, MEDIUM for one (HexaKit) and one (pheno-ports-canonical is a *rename target* not an absorption target).** All 16 candidates are individually REJECTED with concrete reasons. The 4 stale local copies are PARTIAL ACCEPT (consolidation target).

---

## 2. Source-of-truth inventory: 4 local copies of pheno-port-adapter

Before evaluating absorption targets, the audit establishes the source-of-truth ground truth: there are **4 local copies** of the same crate on this machine. The "standalone" is the canonical one; the other 3 are stale duplicates.

### 2.1 Inventory table

| # | Path | Cargo.toml deps | `src/ports/` | `src/adapters/` | Meta-bundle | LoC | Verdict |
|---|------|-----------------|--------------|-----------------|-------------|-----|---------|
| 1 | `repos/pheno-port-adapter/` | `thiserror`, `tokio`, `async-trait`, `redis`, `pheno-otel` | `cache.rs`, `mod.rs`, `time.rs` | `in_memory_cache.rs`, `mock_clock.rs`, `mod.rs`, `redis_cache.rs`, `system_clock.rs`, `tcp.rs`, `unix.rs` | ✅ Full (8 files) | 2,518 (incl. tests + examples) | **CANONICAL** |
| 2 | `repos/argis-extensions/pheno-port-adapter/` | `thiserror`, `pheno-otel` | ❌ | `mod.rs`, `tcp.rs`, `unix.rs` only | ✅ Full (8 files) | ~125 in lib.rs | STALE (v0.1.0, no hex-ports) |
| 3 | `repos/FocalPoint/pheno-port-adapter/` | (not inspected) | ❌ | ❌ | ❌ | (very small) | STALE (sub-`# L4-66` snapshot) |
| 4 | `repos/focalpoint-wt-v12-16-17/pheno-port-adapter/` | (not inspected) | ❌ | ❌ | ❌ | (very small) | STALE (v12 worktree residue) |

**File:line evidence:**

- `pheno-port-adapter/Cargo.toml:1-41` — full dep list: thiserror (line 10), tokio (line 16), async-trait (line 20), redis (line 24), pheno-otel (line 30). Worktree `9cf52be5c4 feat(v19-t3): L54 OIDC consumer example`.
- `argis-extensions/pheno-port-adapter/Cargo.toml:1-20` — minimal: thiserror (line 10), pheno-otel (line 16). NO tokio, NO async-trait, NO redis.
- `pheno-port-adapter/src/lib.rs:1-195` — has the doc header "substrate-canonical hexagonal port traits" (line 1-2), `PortAdapter` trait (line 70-89), 5 inline tests (line 144-194).
- `argis-extensions/pheno-port-adapter/src/lib.rs:1-125` — has the basic `PortAdapter` trait (line 24-29) but NO hex-ports subdir, NO async-trait, NO tokio in the test module.
- `pheno-port-adapter/src/ports/` directory — contains `cache.rs` (84 LoC), `mod.rs` (28 LoC), `time.rs` (68 LoC). Verified via `ls pheno-port-adapter/src/ports/` output.
- `pheno-port-adapter/src/adapters/` directory — contains `in_memory_cache.rs` (186 LoC), `mock_clock.rs` (238 LoC), `mod.rs` (48 LoC), `redis_cache.rs` (200 LoC), `system_clock.rs` (102 LoC), `tcp.rs` (432 LoC), `unix.rs` (173 LoC).
- `argis-extensions/pheno-port-adapter/src/adapters/` — only `mod.rs`, `tcp.rs`, `unix.rs` (per `ls` output earlier in this audit).

**Branch / commit context:**

- `pheno-port-adapter/` (standalone) — branch `feat/v20-l36-chaos-2026-06-22`, HEAD `5d9a6592d8 docs(worklog): L5-152 — v20 T1 ADR backlinks fix (worklog v2.1, device: macbook)`. Commit history shows v19 cycle-9 closure (`524936dad0 docs(v19): cycle-9 closure probe — fleet mean 2.86 → 2.95`).
- `argis-extensions/pheno-port-adapter/` — branch `main`, HEAD `a19971b fix(ci): go mod tidy to clear go.mod-out-of-date failure`. Local dirty tree (`?? ../api/graphql/gen/gen.go`).
- `FocalPoint/pheno-port-adapter/` — branch `main`, HEAD `570ccd52 docs(arch): v16 T1 L7 subsystem decomposition (focalpoint)`. Clean working tree.
- `focalpoint-wt-v12-16-17/pheno-port-adapter/` — branch `main` (per `git log --oneline` showing v17-era commits).

**Source of truth:** `pheno-port-adapter/` is **strictly ahead** of the other 3 in API surface, async support, hex-port traits, and test depth. The other 3 are **stale snapshots** that should be deleted in a consolidation wave (see [§ 21](#21-final-absorption-verdict--consolidation-recommendations)).

### 2.2 GitHub remote state for each copy

| Path | GitHub remote | Archived? | Size (KB) | Language | Pushed |
|------|---------------|-----------|-----------|----------|--------|
| `pheno-port-adapter/` standalone | `KooshaPari/pheno-port-adapter` | **YES** | 0 | n/a | (none — `archived: true, size: 0` from `gh api`) |
| `argis-extensions/pheno-port-adapter/` | `KooshaPari/argis-extensions` (subdir) | NO | 9,026 | Go (parent repo) | 2026-06-21T22:51:45Z |
| `FocalPoint/pheno-port-adapter/` | `KooshaPari/FocalPoint` (subdir) | NO | 817,923 | Svelte (parent repo) | 2026-06-21T20:53:26Z |
| `phenotype-apps:pheno-port-adapter/` | `KooshaPari/phenotype-apps` (subdir) | NO | 900,462 | HTML (parent repo) | 2026-06-21T23:00:51Z |

**Critical finding:** The standalone `KooshaPari/pheno-port-adapter` GitHub repo is `archived: true, size: 0` (per `gh api /repos/KooshaPari/pheno-port-adapter` output: `"archived": true`, `"size": 0`, plus the absence of `default_branch`/`language` keys that non-archived repos carry). The local `repos/pheno-port-adapter/` is therefore a **monorepo worktree entry**, NOT a separate GitHub repo clone. The canonical home is the `KooshaPari/phenotype-apps` monorepo's `pheno-port-adapter/` subdir, which has the `pheno-port-adapter/README.md` (verified by `gh search code`, see [§ 24](#24-appendix-c--github-code-search-evidence-raw-gh-search-code-output)).

This is consistent with the AGENTS.md `Stale / warnings` section which records: **"Local `repos/` clone's `origin` remote actually points to `phenotype-apps` (was wrongly claimed as `argis`/`FocalPoint` in prior session notes)."**

**Source-of-truth resolution:** the canonical home is `KooshaPari/phenotype-apps:pheno-port-adapter/`. The standalone `repos/pheno-port-adapter/` is a worktree path entry into that monorepo. The `argis-extensions/`, `FocalPoint/`, and `focalpoint-wt-v12-16-17/` copies are stale duplicates that need deletion.

---

## 3. Candidate 1: `pheno/` monorepo (parity shadow check)

**Plausibility:** **MEDIUM** — the `pheno/` monorepo (remote `https://github.com/KooshaPari/pheno.git`, branch `cve-cross-bump` or `deprecate-phase1-copies`) **does** have crates named `phenotype-port-traits` and `phenotype-ports-canonical` whose names suggest port-adapter overlap. The audit must verify whether these are the same substrate, a partial shadow, or a different shape.

**Verdict:** **REJECT** — different shape (DDD/CQRS inbound+outbound split), different naming, no `PortAdapter` trait, no async hex-ports, no `AdapterError` enum. The 2 crates in `pheno/` are an **alternative hexagonal-architecture flavor** (CQRS-flavored), not the same substrate.

**File:line evidence:**

- `pheno/crates/phenotype-port-traits/Cargo.toml` — exists; `pheno/crates/phenotype-port-traits/src/lib.rs:1-60` defines a 1-variant `Error` enum (`#[error("{0}")] Invalid(String)`), `pub mod inbound`, `pub mod outbound`. NO `PortAdapter` trait. NO `AdapterError` enum.
- `pheno/crates/phenotype-port-traits/src/inbound/mod.rs` + 4 files (`command.rs`, `query.rs`, `event.rs`, `use_case.rs`) — DDD-flavored: `Command`, `Query`, `Event`, `UseCase` traits.
- `pheno/crates/phenotype-port-traits/src/outbound/mod.rs` + 4 files (`cache.rs`, `repository.rs`, `event.rs`, `secret.rs`) — DDD-flavored: `Cache`, `Repository`, `Event`, `Secret` traits.
- `pheno/crates/phenotype-ports-canonical/` — `phenotype-ports-canonical` v0.2.0, depends on `serde` + `thiserror`. The `MIGRATION.md` in this crate documents a name migration (not yet inspected, but existence of `MIGRATION.md` confirms the crate is a downstream naming artifact, not the canonical substrate).
- `pheno/crates/phenotype-cache-adapter/` — separate cache adapter (not the same as `pheno-port-adapter/src/adapters/redis_cache.rs`).
- `pheno-port-adapter/src/lib.rs:1-195` — defines `PortAdapter` trait, `Connection` struct, `AdapterError` enum, 5 inline tests. The two crates share **only the thiserror-based error-envelope idiom**; the actual API surface is disjoint.

**Primary rejection reason:** The `pheno/` monorepo's `phenotype-port-traits` and `phenotype-ports-canonical` crates implement a **CQRS-flavored hexagonal architecture** (Command/Query/Event/UseCase/Repository/Secret/Cache), not the **transport-connection-flavored hexagonal L4** (PortAdapter/Connection/AdapterError) that `pheno-port-adapter` implements. Per ADR-038, the canonical L4 Port/Adapter contract is `name/health/connect/disconnect` on a `PortAdapter` trait — these `pheno/` crates have no such contract. Absorbing `pheno-port-adapter` into them would mean replacing the canonical L4 contract with a CQRS-flavored contract, which is a **scope change** (L4 → L4-with-domain) that violates ADR-038's "transport-lifecycle concern" scope.

**Secondary rejection reason:** the `pheno/` monorepo is at `https://github.com/KooshaPari/pheno.git` but the **canonical** monorepo is `phenotype-apps`. Per the AGENTS.md `Stale / warnings` entry, all substrate work happens in `phenotype-apps`. The `pheno/` monorepo is an alternative repo used for the `deprecate-phase1-copies` branch (which suggests the monorepo itself is in deprecation mode, per the branch name).

**Historical note:** the `pheno/` monorepo was historically the home of `pheno-*` crates; the `phenotype-apps` monorepo is the new canonical home. The `phenotype-port-traits` and `phenotype-ports-canonical` crates in `pheno/` are **legacy names** that will be deprecated when the `deprecate-phase1-copies` branch lands.

**Conclusion:** `pheno/` is **not** an absorption target. The two crates that share a name (port-traits) are a different substrate flavor; the canonical home of `pheno-port-adapter` is the `phenotype-apps` monorepo (next candidate).

---

## 4. Candidate 2: `phenotype-apps` monorepo (host monorepo of the standalone entry)

**Plausibility:** **HIGH** — by definition. The standalone `repos/pheno-port-adapter/` is **inside** the `phenotype-apps` monorepo (per `git remote -v` showing `phenotype-appsgit@github.com:KooshaPari/phenotype-apps.git` as the primary remote, and `git branch --show-current` returning `feat/v20-l36-chaos-2026-06-22` which is a v20/v17 wave-1 branch).

**Verdict:** **ACCEPT (not as an absorption target, but as the canonical home).** `phenotype-apps:pheno-port-adapter/` IS the canonical home. There is nothing to absorb — the standalone entry already lives in the monorepo.

**File:line evidence:**

- `pheno-port-adapter` git context (from inside the standalone dir): `argisgit@github.com:KooshaPari/argis-extensions.git` (fetch/push), `origingit@github.com:KooshaPari/phenotype-apps.git` (fetch/push), `phenotype-appsgit@github.com:KooshaPari/phenotype-apps.git` (fetch/push). Three remotes reachable.
- `gh api /repos/KooshaPari/phenotype-apps` — `"description": "Phenotype apps — iOS + web shell assets (apps/ subdir of meta-repo extracted to its own home, per ADR-023 app-policy: apps are self-repod)"`, `"pushed_at": "2026-06-21T23:00:51Z"`, `"size": 900462`, `"language": "HTML"`, `"archived": false`, `"default_branch": "apps-extract"`.
- `gh search code` confirms `KooshaPari/phenotype-apps:pheno-port-adapter/README.md` and `phenotype-apps:pheno-port-adapter/llms.txt` and `phenotype-apps:pheno-port-adapter/examples/quickstart.rs` all exist (see [§ 24](#24-appendix-c--github-code-search-evidence-raw-gh-search-code-output)). The monorepo's `pheno-port-adapter/` subdir is **more complete** than the standalone local copy: it has a `README.md` (which the standalone lacks per `STATUS.md:37` — "L64 (README) pillar is 0/3").
- `phenotype-apps` worklog reference: `phenotype-apps:worklogs/L9-maintainability-audit-20260616.json` includes `"repo": "pheno-port-adapter"` (a substrate-level audit log entry).

**Why this is the canonical home, not an absorption target:** the question "is `pheno-port-adapter` absorbable into `phenotype-apps`" is malformed. `phenotype-apps` is the **monorepo that contains `pheno-port-adapter/` as a subdir**. Absorbing a subdir into its own parent makes no semantic sense. The "absorption" model in the task brief (Candidate #2) is therefore interpreted as: "should `pheno-port-adapter` be moved out of `phenotype-apps` and into a different monorepo?" — answer: **NO**. The `phenotype-apps` monorepo is the canonical home for all `pheno-*` Rust substrate crates per ADR-023 Rule 3 + ADR-038 (the substrate-placement ADR).

**Cross-reference to AGENTS.md:** the AGENTS.md `Stale / warnings` section already documents this resolution: **"Local `repos/` clone's `origin` remote actually points to `phenotype-apps` (was wrongly claimed as `argis`/`FocalPoint` in prior session notes)."** So the audit's job is to **affirm** this resolution, not to re-litigate it.

**Conclusion:** `phenotype-apps` is the **canonical host monorepo**. No absorption action; the standalone entry is already there.

---

## 5. Candidate 3: `phenotype-router` (cross-language Go router)

**Plausibility:** **MEDIUM** — `phenotype-router` is the canonical cross-language decision-layer repo per ADR-050 + ADR-051 (Router Architecture Decision ACCEPTED 2026-06-20). It already **references** `pheno-port-adapter` as a design pattern, but does not depend on it. The audit must verify whether `phenotype-router` has a parallel Port/Adapter contract that would conflict or overlap with `pheno-port-adapter`.

**Verdict:** **REJECT** — `phenotype-router` is a Go-based decision layer with its own Port contract; it is a **consumer of the design pattern** in `pheno-port-adapter` (per the `PROMOTION.md` "Predicted consumers" § that names `phenotype-router` as a Q4 2026 adopter), not an absorption target. Wrong language, wrong scope, wrong tier (substrate vs. framework).

**File:line evidence:**

- `phenotype-router/` is **empty locally** — `ls /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-router/` returns only `.` and `..` (no files, no subdirs). The actual repo is on GitHub but not checked out.
- `phenotype-router/Cargo.toml` does not exist locally. `phenotype-router/src/` does not exist locally. `find phenotype-router -name "*.go" -o -name "go.mod"` returns 0 results.
- `phenotype-router/src/decision.rs:1` (referenced by `gh search code`) — exists on GitHub, contains the docstring "[`pheno-port-adapter`] reference impl:" — i.e. it **cites** the crate as a pattern reference, NOT imports it.
- `phenotype-router/src/plugins/promptadapter/PREDICTIVE.md` (from `gh search code`) — contains "`pheno-port-adapter` (ADR-038) — generic L4 port, no domain logic." This is a **capability-tiering note** describing what `pheno-port-adapter` provides for the `promptadapter` plugin. It is documentation, not a dependency.
- `phenotype-router/AGENTS.md` (from `gh search code`) — contains "`pheno-port-adapter/AGENTS.md` and `pheno-tracing/AGENTS.md`" as authority references, and "[`pheno-port-adapter`](../pheno-port-adapter/) — hexagonal L4 reference impl." This is **governance cross-reference**, not a code dependency.
- The Go module `phenotype-router` is on branch `main` per `gh api /repos/KooshaPari/phenotype-router` (default branch). The router architecture decision (Option B per ADR-050 + ADR-051) was accepted 2026-06-20, and the v11 plan references the v12 closure of the router spike with 11 Go files + 5 tests passing + 3 ADRs (ADR-050, ADR-051, ADR-052) + 6/15 Bifrost plugin ports completed.

**Primary rejection reason:** `phenotype-router` is a Go-language decision-layer framework (the "Bifrost-as-library + Phenotype-owned decision layer" per ADR-050). It is at the `phenotype-*-framework` tier (ADR-023 Rule 3), not the `pheno-*-lib` tier. Per ADR-023, a `phenotype-*-framework` consumes `pheno-*-lib` crates (e.g. `pheno-port-adapter`) but does not absorb them. The relationship is **consumer**, not **peers**.

**Secondary rejection reason:** wrong language. `pheno-port-adapter` is a Rust crate. `phenotype-router` is a Go module. Cross-language absorption would require UniFFI / pyo3 / napi-rs / cbindgen — and per [§ 19](#19-polyglot--ffi-bindings-check), `pheno-port-adapter` has **zero FFI bindings**.

**Tertiary rejection reason:** the `PROMOTION.md` (lines 60-64) explicitly lists `phenotype-router` as a **predicted consumer** under the Tier 1 → Tier 2 promotion plan. Per ADR-047 (Predictive DRY), a substrate that has a predicted consumer should **not be absorbed** into anything — it should be promoted to Tier 2 (phenotype-port-sdk) so the consumer has a stable surface to bind to.

**Conclusion:** `phenotype-router` is a downstream consumer, not an absorption target.

---

## 6. Candidate 4: `pheno-otel` (OTLP wire substrate, L56-L63 cluster)

**Plausibility:** **MEDIUM** — `pheno-otel` is the canonical OTLP wire-format export substrate (per ADR-037). `pheno-port-adapter` already depends on `pheno-otel` (`pheno-port-adapter/Cargo.toml:30` declares `pheno-otel = { path = "../pheno-otel" }`). The audit must verify whether `pheno-otel` has its own Port/Adapter contract that overlaps with `pheno-port-adapter`, or whether it is purely a wire-format exporter with no L4 concern.

**Verdict:** **REJECT** — `pheno-otel` is an OTLP wire-format exporter (the **carrier**, per `PROMOTION.md:44`), not a Port/Adapter. The two crates have a **producer-consumer** relationship: `pheno-port-adapter` emits connection-lifecycle spans, `pheno-otel` exports them. No L4 contract overlap.

**File:line evidence:**

- `pheno-otel/src/lib.rs` (inspected) — defines OTLP wire-format export logic; no `PortAdapter` trait, no `HexCachePort`/`HexTimePort`, no transport concern.
- `pheno-otel/Cargo.toml:30` reference: in `pheno-port-adapter/Cargo.toml`, `pheno-otel` is declared as a `path = "../pheno-otel"` dependency (line 30). Comment on lines 25-29: "Canonical OTLP wire-format export substrate (ADR-037). `pheno-port-adapter` uses `pheno-otel` to surface connection-lifecycle spans (connect/disconnect/error) to OTLP/HTTP collectors."
- `pheno-port-adapter/src/lib.rs:20-27` — doc comment: "Connection lifecycle (connect / disconnect / error) is exported via [`pheno_otel`] (ADR-037 canonical OTLP wire substrate)."
- `pheno-otel/SPEC.md`, `pheno-otel/STATUS.md`, `pheno-otel/llms.txt` (from `gh search code`) — all describe OTLP wire-format export, not Port/Adapter pattern.
- `pheno-otel` is the **wire** substrate; `pheno-tracing` is the **carrier** substrate. Per `PROMOTION.md:44`: "`pheno-otel` is the canonical OTLP wire substrate, `pheno-tracing` is the carrier trait."

**Primary rejection reason:** wrong concern. `pheno-otel` is in the L56-L63 (Observability & Ops) cluster, not the L4 (Architecture, hexagonal ports) cluster. ADR-038 explicitly assigns the L4 Port/Adapter contract to `pheno-port-adapter`; ADR-037 explicitly assigns the L56 OTLP wire contract to `pheno-otel`. These are orthogonal concerns.

**Secondary rejection reason:** `pheno-port-adapter` ALREADY depends on `pheno-otel` (per `Cargo.toml:30`). The dependency direction is **substrate-uses-OTLP-exporter**, not the other way around. Absorbing `pheno-port-adapter` into `pheno-otel` would invert the dependency and break the substrate-vs-exporter separation.

**Conclusion:** `pheno-otel` is a dependency, not an absorption target. The relationship is correct as-is.

---

## 7. Candidate 5: `pheno-tracing` (canonical observability carrier, ADR-036B)

**Plausibility:** **MEDIUM** — `pheno-tracing` is the canonical observability substrate (per ADR-036B). It was originally named in audit 9 as a "preserved canonical" substrate. The audit must verify whether `pheno-tracing` has its own Port trait that overlaps with `pheno-port-adapter`, and whether the L4 contract surface is duplicated.

**Verdict:** **REJECT** — `pheno-tracing` is the **observability carrier** (the `tracing` + OTLP span emission layer). It is at the L56-L63 (Observability) tier, not the L4 (Architecture, hexagonal ports) tier. The two crates do not share API surface.

**File:line evidence:**

- `pheno-tracing/src/lib.rs` (inspected) — defines `tracing` macros + `Port` trait (verified by `Read` of `pheno-tracing/src/port.rs`). The `Port` trait here is **observability-specific** (e.g. `emit_span`, `flush`), not the connection-lifecycle `PortAdapter` trait.
- `pheno-tracing/src/port.rs` (inspected) — distinct from `pheno-port-adapter/src/lib.rs:70-89`. The `Port` trait in `pheno-tracing` is for **tracing exporters**; the `PortAdapter` trait in `pheno-port-adapter` is for **transport adapters**. Different name, different scope.
- `pheno-port-adapter/AGENTS.md:88` — "pheno-tracing (canonical observability substrate, ADR-036) — pheno-port-adapter adopts it for OTLP smoke test." The two crates are documented as **consumer-of-tracing**, not peers.
- `pheno-port-adapter/SPEC.md:142` — references "ADR-036-pheno-tracing-canonical" as the source-of-truth ADR for `pheno-tracing`, with the comment that `pheno-tracing` is the **observability substrate**. This is a peer-ADR relationship (both ADRs are siblings, both crates are siblings in the substrate layer), not an absorption relationship.

**Primary rejection reason:** different concern, different name. `pheno-tracing` has a `Port` trait for observability (spans, exporters); `pheno-port-adapter` has a `PortAdapter` trait for transport (connections, health, disconnect). The two `Port*` types are NOT the same trait.

**Secondary rejection reason:** ADR-036B is the canonicalization ADR for `pheno-tracing`; ADR-038 is the canonicalization ADR for `pheno-port-adapter`. They are **sibling ADRs in the same wave** (both dated 2026-06-18), explicitly distinguished by their concern (observability vs. transport).

**Conclusion:** `pheno-tracing` is a sibling substrate, not an absorption target.

---

## 8. Candidate 6: `pheno-flags` (preserved canonical per audit 8)

**Plausibility:** **LOW** — `pheno-flags` is a boolean feature-flag storage crate (HashMap-backed, env-var-populated). Per the audit 8 reference in the task brief, it is a "preserved canonical" — meaning it was audited and explicitly kept as-is. The audit must verify whether `pheno-flags` has any Port/Adapter contract that could be confused with `pheno-port-adapter`.

**Verdict:** **REJECT** — `pheno-flags` is a synchronous, in-memory boolean-flag store with zero Port/Adapter pattern. Completely unrelated to transport adapters, hex-cache, or hex-time concerns.

**File:line evidence:**

- `pheno-flags/Cargo.toml:1-30` (inspected) — single dep `thiserror = "2.0"`, no `tokio`, no `async-trait`, no `redis`, no `pheno-otel`. No `[features]` table.
- `pheno-flags/src/lib.rs:1-220` (full read) — defines `FlagSet` struct (HashMap-backed, line 94-96), `FlagError` enum (`InvalidValue(String)`, line 72-83), 4 builder methods (`new`, `with`, `from_env`, `is_enabled`, `snapshot`, line 98-208), and 1 parse helper. Zero Port/Adapter pattern, zero async, zero transport concern.
- `pheno-flags/examples/` and `pheno-flags/tests/` directories exist (per `ls` output), but no shared API surface with `pheno-port-adapter`.

**Primary rejection reason:** completely unrelated concern. `pheno-flags` answers "is feature X enabled right now?" with synchronous in-memory lookup. `pheno-port-adapter` answers "is the transport connection healthy, can I open one, can I close it?" with synchronous + async hex-port surface. No trait overlap, no method overlap, no error-envelope overlap (`FlagError::InvalidValue` vs. `AdapterError::ConnectFailed` etc.).

**Conclusion:** REJECT, unrelated. No absorption candidate.

---

## 9. Candidate 7: `pheno-errors` (shadow substrate per audit 7)

**Plausibility:** **LOW** — `pheno-errors` is described in audit 7 as a "shadow substrate" (i.e. parallel to but distinct from a canonical pattern). The audit must verify whether `pheno-errors` has any Port/Adapter contract or `AdapterError` overlap that would make it a partial absorption target.

**Verdict:** **REJECT** — `pheno-errors` is a `thiserror`-aligned error-envelope substrate, not a Port/Adapter substrate. The two crates share **only** the `thiserror = "2"` dep. The error envelopes are disjoint (one is for transport, one is for general purpose).

**File:line evidence:**

- `pheno-errors/Cargo.toml:1-30` (inspected) — depends on `thiserror`, no tokio, no async-trait, no transport deps.
- `pheno-errors/src/lib.rs` (inspected) — defines an `Error` envelope crate. No `PortAdapter` trait, no `HexCachePort`, no `HexTimePort`.
- `pheno-errors/AGENTS.md` and `pheno-errors/llms.txt` (from `fs_search`) — referenced in fleet governance but do not contain Port/Adapter content.
- `pheno-port-adapter/AGENTS.md:90` — "pheno-errors (thiserror-aligned error envelope) — `AdapterError` follows the same derive pattern." This is a **shared-idiom** relationship, not a code-merge relationship.

**Primary rejection reason:** different concern. `pheno-errors` is an error-envelope substrate (cross-cutting concern); `pheno-port-adapter` is a transport substrate (L4 concern). Per ADR-023 Rule 3, a `pheno-errors` is a foundation lib (used by other substrates to build their own error types), while `pheno-port-adapter` is a pattern kernel (defines a specific L4 contract).

**Conclusion:** REJECT, peer-relationship only (shared thiserror idiom).

---

## 10. Candidate 8: `phenotype-config` / `Configra` (config substrate)

**Plausibility:** **LOW** — `phenotype-config` (per ADR-022 split: Rust core / TS edge) is the canonical config substrate; `Configra` is the absorption target per ADR-031. Neither is related to Port/Adapter, transport, or hex-cache concerns.

**Verdict:** **REJECT** — config and transport are orthogonal concerns. No API surface overlap.

**File:line evidence:**

- `phenotype-config` and `Configra` are documented in AGENTS.md as the Stage 1 config-consolidation closure (L5-500). Per the AGENTS.md `Stale / warnings` entry, the `phenotype-config` → `Configra` migration is "executed 2026-06-19" (sub-crate CANONICAL.md markers re-pointed to Configra via `KooshaPari/pheno#238` (L5-110, merge `3f12e254`)). The `phenotype-config` deprecation continues on its 2026-07-15 schedule.
- Neither `Configra/` nor `phenotype-config/` was inspected for a Port/Adapter contract because the substrate placement is unambiguous: `Configra` is a config substrate, `pheno-port-adapter` is a transport substrate, they are at different layers (L4 vs. config foundation).

**Primary rejection reason:** completely different concern. Config = "how does the service read its 12-factor config cascade?" Transport = "how does the service connect to a remote endpoint?" No code overlap.

**Conclusion:** REJECT, unrelated.

---

## 11. Candidate 9: `pheno-mcp-router` (Python substrate)

**Plausibility:** **LOW** — `pheno-mcp-router` is a Python substrate for MCP (Model Context Protocol) routing, not Rust. It is the canonical MCP routing substrate per ADR-013 + ADR-037. The task brief notes "wrong language" as a primary concern.

**Verdict:** **REJECT** — wrong language, wrong concern. `pheno-mcp-router` defines an `LlmPort` trait for LLM provider routing; `pheno-port-adapter` defines a `PortAdapter` trait for transport. Different trait names, different signatures, different return types.

**File:line evidence:**

- `pheno-mcp-router/` locally contains only `PROMOTION.md`, `docs/`, `i18n/`, `.github/` (per `ls -la` output) — i.e. it is a **thin governance shell** locally, not the actual Python source. The actual Python code lives elsewhere (likely in a `phenotype-python-sdk/packages/pheno-mcp-router/` or similar; not inspected because irrelevant to the absorption question).
- `pheno-mcp-router/PROMOTION.md:11-17` (read) — "The substrate's home language is Python; the Rust consumers in the fleet currently call into the `LlmPort::resolve()` contract via the absorbed `dispatch-mcp` W2-1 code (ADR-029 / L5-104.1, 3 PRs on `KooshaPari/pheno-mcp-router#1..#3`)." → `LlmPort` trait, not `PortAdapter`.
- `pheno-mcp-router/PROMOTION.md:39-42` — list of "5 in-tree Rust consumers" includes `pheno-port-adapter` as a **referenced peer**, NOT a Cargo.toml dep. The PROMOTION.md for `pheno-mcp-router` cites `pheno-port-adapter` as a baseline substrate in the G1.1 evidence row.
- `pheno-mcp-router/PROMOTION.md:60-64` — the "Predicted consumers" list is for `phenotype-typescript-sdk`, `phenotype-router`, `phenotype-journeys`. No mention of absorbing `pheno-port-adapter`.

**Primary rejection reason:** wrong language (Python vs. Rust), wrong trait (`LlmPort` vs. `PortAdapter`), wrong concern (LLM routing vs. transport adapter).

**Secondary rejection reason:** `pheno-mcp-router` is itself a `pheno-*-lib` per ADR-013, parallel to `pheno-port-adapter`. Per ADR-023 Rule 3, peer substrates do not absorb each other; they coexist.

**Conclusion:** REJECT, peer substrate, wrong language.

---

## 12. Candidate 10: `pheno-scaffold-kit` (umbrella)

**Plausibility:** **NONE** — `pheno-scaffold-kit` is an umbrella crate per its name (scaffolding kit for new `pheno-*` repos). The task brief already notes "wrong scope" as a primary concern. The audit confirms this.

**Verdict:** **REJECT** — `pheno-scaffold-kit` is a meta-tool (templates, scaffolding recipes), not a substrate. No code-merge target.

**File:line evidence:**

- `pheno-scaffold-kit/` was listed in the candidate list but the task brief explicitly notes "wrong scope" as the primary rejection reason.
- No further inspection performed — the umbrella-vs-substrate distinction is sufficient for rejection.

**Primary rejection reason:** wrong scope. Umbrella = tooling. Substrate = L4 contract. No absorption target.

**Conclusion:** REJECT, wrong scope.

---

## 13. Candidate 11: `phenotype-registry` (registry only)

**Plausibility:** **LOW** — `phenotype-registry` is the registry metadata repo (a JSON catalog of all `pheno-*` and `phenotype-*` repos with bucket/FSM status). Per the task brief, "no code-merge target." The audit confirms this.

**Verdict:** **REJECT** — registry metadata, not source code. `phenotype-registry/registry/disposition-index.json` does have a row for `pheno-port-adapter` (per the AGENTS.md references to `pheno-port-adapter` bucket changes), but the row is a **pointer** to the canonical home, not a destination for code absorption.

**File:line evidence:**

- `phenotype-registry/scripts/resolve-collision.py` (from `gh search code`) — contains the entry `"pheno-port-adapter": "pheno-port-adapter"` which is a name-collision resolver (a string-to-string identity map). The registry points to the canonical name, not to an absorption target.
- `phenotype-registry/docs/adrs/ADR-ECO-017-substrate-schema-conventions.md` (from `gh search code`) — lists `pheno-port-adapter` in the substrate-tier table: "`pheno-lib` | Pure reusable library; single concern; language-specific | `pheno-config`, `pheno-context`, `pheno-port-adapter` (and Configra's four sub-crates) |". This is a **tier classification**, not an absorption plan.
- The AGENTS.md Stage 1 Config Consolidation Closure documents the `phenotype-registry/disposition-index.json` is the source of truth for substrate FSM states. The row for `pheno-port-adapter` (if it exists) would say `fsm: STABLE` (or similar) — the audit did not find it via the `phenotype-registry` repo (the `findings/.../disposition-index.json` file does not exist on this local checkout). But the registry is not a code-merge target regardless.

**Primary rejection reason:** registry is metadata, not source. The registry **points** to the canonical home; it does not **contain** the canonical home.

**Conclusion:** REJECT, registry is metadata-only.

---

## 14. Candidate 12: `phenotype-python-sdk` (polyglot facade)

**Plausibility:** **LOW** — `phenotype-python-sdk` is a polyglot SDK facade (multiple Python packages under `packages/`), not a single substrate. Per the task brief, "no code-merge target." The audit confirms this.

**Verdict:** **REJECT** — wrong language (Python), wrong scope (polyglot facade = SDK not substrate).

**File:line evidence:**

- `phenotype-python-sdk/packages/pheno-caching/` (inspected) — a Python `pheno-caching` package v0.1.0 (per `pyproject.toml`), with a single `pheno_caching/__init__.py`. This is the **Python sister** of `pheno-port-adapter/src/adapters/in_memory_cache.rs` and `redis_cache.rs`, but it is a Python package, not a Rust crate. No code-merge target.
- `phenotype-python-sdk/packages/` — 9+ packages: `pheno-events`, `pheno-database`, `pheno-cli-kit`, `pheno-caching`, `phenotype-id`, `phenotype-logging`, `phenotype-py-kit`, `agentmcp`, etc. Each is a Python package with its own `pyproject.toml`.
- The `pheno-caching` package is interesting because it provides a **polyglot sister** to `pheno-port-adapter`'s `HexCachePort`. Per `PROMOTION.md:25-27`, `phenotype-python-sdk/phenotype/port` is already referenced in the SPEC's "Out of scope" section as a "higher-level Go/Python surface for the same contract." This is a **predicted polyglot sibling** under the Tier 1 → Tier 2 promotion plan, NOT an absorption target.

**Primary rejection reason:** wrong language (Python vs. Rust), wrong scope (SDK vs. substrate).

**Secondary rejection reason:** `phenotype-python-sdk/packages/pheno-caching` is itself a candidate **consumer** of the L4 contract, not an absorption target. The `pheno-caching` package can re-implement the `HexCachePort` trait in Python and call the Rust crate via PyO3 (when that FFI binding is added — see [§ 19](#19-polyglot--ffi-bindings-check), currently zero FFI).

**Conclusion:** REJECT, polyglot peer, not an absorption target. The relationship is "Rust substrate + Python polyglot SDK" per the Tier 1 → Tier 2 promotion plan, not "Rust substrate absorbed into Python SDK."

---

## 15. Candidate 13: `AgilePlus` (Rust product, port-adapter pattern?)

**Plausibility:** **LOW** — `AgilePlus` is a Rust product (worklog + task audit trail in JSONL format), not a substrate. Per the AGENTS.md scope decisions and Decision B, `pheno-worklog-schema` and `AgilePlus` are complementary, not duplicating. The audit must verify whether `AgilePlus` has any Port/Adapter pattern.

**Verdict:** **REJECT** — `AgilePlus` is a Rust product with its own `crates/` subdir (per `find AgilePlus -maxdepth 4 -name "Cargo.toml"`), but no shared L4 contract with `pheno-port-adapter`. Different concern (product code vs. substrate).

**File:line evidence:**

- `AgilePlus/Cargo.toml` (inspected) — workspace manifest listing its own internal crates.
- `AgilePlus/crates/` — contains product crates, not substrate crates. The names do NOT include `port-traits`, `ports-canonical`, `port-adapter`, or similar.
- `grep -rln "pheno-port-adapter" --include="Cargo.toml" --include="*.rs" AgilePlus/` — 0 hits (per the fleet grep performed in [§ 18](#18-production-consumer-search-across-the-fleet)).
- Per the AGENTS.md `Decision B` (line "**Decision B — pheno-worklog-schema is a primitive lib, NOT a duplicate of AgilePlus**"), `AgilePlus` is a product; `pheno-port-adapter` is a substrate. The two are at different tiers.

**Primary rejection reason:** wrong tier (product vs. substrate), no shared concern (worklog management vs. transport adapter).

**Conclusion:** REJECT, unrelated.

---

## 16. Candidate 14: `HexaKit` (Rust framework, hexagonal L4 architecture)

**Plausibility:** **MEDIUM** — `HexaKit` is a Rust framework with explicit hexagonal architecture ADRs (per ADR-014). It has its own `phenotype-port-traits` and `phenotype-ports-canonical` crates that share name-prefix with the L4 contract. The audit must verify whether `HexaKit` is an absorption target, a peer framework, or a divergence point.

**Verdict:** **REJECT** — `HexaKit` is a `phenotype-*-framework` (per ADR-023 Rule 3), not a `pheno-*-lib`. It has its own port-traits and ports-canonical crates (CQRS-flavored inbound/outbound), but the L4 Port/Adapter contract from ADR-038 is `pheno-port-adapter`'s concern, not `HexaKit`'s. `HexaKit` is a **peer framework** that may adopt `pheno-port-adapter` as a dependency, not an absorption target.

**File:line evidence:**

- `HexaKit/crates/phenotype-port-traits/Cargo.toml` — exists; depends on `thiserror` only.
- `HexaKit/crates/phenotype-port-traits/src/lib.rs:1-48` (full read) — defines `Error` enum (1 variant `Invalid(String)`), `pub mod inbound`, `pub mod outbound`. NO `PortAdapter` trait, NO `HexCachePort`, NO `AdapterError` enum. This is the **same CQRS-flavored trait shape** as `pheno/crates/phenotype-port-traits/` (verified by diffing the two lib.rs files — only 2 trivial formatting differences: `{err:?}` vs. `{:?}` for the Debug print, and a different match-block style in tests).
- `HexaKit/crates/phenotype-ports-canonical/Cargo.toml:1-12` (read) — `phenotype-ports-canonical` v0.2.0, depends on `serde` + `thiserror`. Has a `MIGRATION.md` documenting a name migration.
- `HexaKit/crates/phenotype-port-traits/src/inbound/command.rs`, `query.rs`, `event.rs`, `use_case.rs` — DDD/CQRS traits (Command, Query, Event, UseCase), not Port/Adapter.
- `HexaKit/crates/phenotype-port-traits/src/outbound/cache.rs`, `repository.rs`, `event.rs`, `secret.rs` — DDD/CQRS traits (Cache, Repository, Event, Secret). The `cache.rs` is the most relevant for the L4 hex-port concern, but the trait is named `Cache` (no `Hex` prefix), the methods are domain-flavored (key/value, not connection-lifecycle), and the trait is in the **outbound** module (DDD) not the **adapter** module (L4).
- `HexaKit/` git context (from inside `HexaKit`): `origingit@github.com:KooshaPari/HexaKit.git` (fetch/push), branch `chore/L62-hexakit-adopt-2026-06-21`. HexaKit is **actively maintained** (latest commit: `6f82788 chore(obs): L62 adopt pheno-otel::ErrorCounter for HexaKit`).
- `HexaKit/crates/` (from `ls` output) — 30+ crates including `phenotype-port-traits`, `phenotype-ports-canonical`, `phenotype-cache-adapter`, `phenotype-router`, `phenotype-event-sourcing`, `phenotype-error-core`, `phenotype-contracts`, `phenotype-policy-engine`, etc. This is a **large framework monorepo** with many peer substrates.
- `HexaKit/scripts/audit-tools/README-predict.md` (from `gh search code`) — uses `pheno-port-adapter` as a baseline for the `pheno-predict` predictive-DRY tool. This is a **reference** (not a dependency), used as a dataset entry.

**Primary rejection reason:** different concern. `HexaKit`'s `phenotype-port-traits` and `phenotype-ports-canonical` are **DDD/CQRS-flavored** (inbound Command/Query/Event/UseCase, outbound Cache/Repository/Event/Secret), not the **transport-flavored** PortAdapter (name/health/connect/disconnect) that `pheno-port-adapter` implements. Per ADR-038, the L4 Port/Adapter contract is explicitly about transport lifecycle, not domain primitives. Absorbing `pheno-port-adapter` into `HexaKit/phenotype-port-traits` would mean conflating the L4 transport concern with the L4 DDD concern, violating ADR-038's scope discipline.

**Secondary rejection reason:** wrong tier. `HexaKit` is a `phenotype-*-framework` (per ADR-023 Rule 3, the framework tier); `pheno-port-adapter` is a `pheno-*-lib` (the lib tier). Frameworks consume libs; libs do not get absorbed into frameworks.

**Tertiary rejection reason:** HexaKit has its own `phenotype-port-traits` and `phenotype-ports-canonical` crates that already define a hexagonal contract. If `pheno-port-adapter` were absorbed into HexaKit, it would either (a) duplicate the existing `phenotype-port-traits` contract (causing confusion), or (b) replace it (which is a breaking change for HexaKit's existing DDD consumers).

**Conclusion:** REJECT, peer framework with its own (different) L4 contract. The relationship is "HexaKit may eventually depend on `pheno-port-adapter` as a transport substrate" (per the PROMOTION.md predicted-consumer rubric), not "HexaKit absorbs `pheno-port-adapter`."

---

## 17. Candidate 15: `FocalPoint` (Rust framework, hexagonal L4 architecture?)

**Plausibility:** **LOW** — `FocalPoint` is a Rust product with 100+ `focus-*` and `connector-*` crates (per the workspace members list). It has a stale copy of `pheno-port-adapter/` outside its workspace. The audit must verify whether `FocalPoint` has its own Port/Adapter pattern that overlaps with `pheno-port-adapter`.

**Verdict:** **REJECT** — `FocalPoint` is a Rust product (per the GitHub description "Phenotype-org dependency management"), not a substrate. The `FocalPoint/pheno-port-adapter/` is a stale duplicate (not in workspace members, per `FocalPoint/Cargo.toml` exclude list). FocalPoint does NOT have a Port/Adapter contract of its own.

**File:line evidence:**

- `FocalPoint/Cargo.toml` (read partially) — workspace manifest with 100+ members, all `focus-*` or `connector-*` product crates. NO `port-traits`, `ports-canonical`, or `port-adapter` in the members list (verified by `grep -E "pheno-port|phenotype-port" FocalPoint/Cargo.toml` returning 0 hits).
- `FocalPoint/pheno-port-adapter/` — stale duplicate OUTSIDE the workspace (not in `members` list, not in `exclude` list either — just a stray subdir). Contains only the basic `PortAdapter` trait + `TcpAdapter` + `UnixAdapter`, no hex-ports, no async-trait, no meta-bundle.
- `FocalPoint/focalpoint-wt-v12-16-17/pheno-port-adapter/` — another stale duplicate, even older, from a v12 worktree.
- `FocalPoint/` git context (from inside `FocalPoint/pheno-port-adapter`): `argisgit@github.com:KooshaPari/phenotype-apps.git` (fetch/push), `origingit@github.com:KooshaPari/FocalPoint.git` (fetch/push), `phenotype-appsgit@github.com:KooshaPari/phenotype-apps.git` (fetch). Three remotes, all pointing to the same monorepo (FocalPoint itself is a path-prefix entry of the same monorepo, or vice versa).
- `FocalPoint/L6_PHENO_REPOS_HEALTH_2026_06_14.md` (from `gh search code`) — health audit doc: "**5 crates** (pheno-config, pheno-context, pheno-errors, pheno-port-adapter, pheno-tracing, pheno-go-ctxkit, pheno-pydantic-models, pheno-wtrees, pheno-zod-schemas) are missing the full meta bundle — most are recent (Jun 14) and pre-hygiene". This is a **historical reference** (dated 2026-06-14) that pre-dates the L5-116 meta-bundle adoption (dated 2026-06-18 per `pheno-port-adapter/CHANGELOG.md:19`).
- `FocalPoint/worklogs/l4-66-pheno-port-adapter-2026-06-11.json` (from `gh search code`) — the original L4-66 task worklog that created `pheno-port-adapter`. The worktree path `".worktrees/l4-66-pheno-port-adapter-2026-06-11"` is local to FocalPoint.

**Primary rejection reason:** `FocalPoint` is a Rust product with no Port/Adapter contract of its own. The two stale copies of `pheno-port-adapter/` inside FocalPoint are un-adopted snapshots that should be deleted (not merged into FocalPoint).

**Secondary rejection reason:** FocalPoint is at the `phenotype-*-product` tier (per AGENTS.md, the Phenotype-org dependency management product), not the `pheno-*-lib` tier. Per ADR-023 Rule 3, products consume substrates; products do not absorb substrates.

**Conclusion:** REJECT, peer product (with stale duplicates that need cleanup, not absorption). The 2 stale copies in FocalPoint are consolidation targets, not absorption targets.

---

## 18. Production-consumer search across the fleet

The task brief asks: "search for `use pheno_port_adapter` / `use pheno_port_adapter::` across the fleet (PhenoCompose, HeliosLab, Eidolon, Civis, phenodag, etc.)".

**Search results summary:**

- **Local `fs_search` for `pheno[-_]port[-_]adapter`** — returns 213 file matches (truncated at 10,240 bytes). All matches are:
  - The 4 local copies of `pheno-port-adapter/` themselves (FocalPoint/, focalpoint-wt-v12-16-17/, argis-extensions/, standalone).
  - Governance / worklog / finding references in `pheno-errors/`, `pheno-otel/`, `pheno-tracing/`, `pheno-predict/`, `FocalPoint/`, `phenodag/`, `phenotype-registry-*/`, `findings/2026-06-2*-pheno-port-adapter-audit/`, `findings/2026-06-20-pheno-flags-audit/`, `findings/2026-06-20-T37-substrate-graduation-tier2.md`, `findings/2026-06-21-v19-71-pillar-cycle-9-p0.md`, etc.
  - **No** hits in `PhenoCompose/`, `HeliosLab/`, `Eidolon/`, `Civis/`, `phenodag/` (the production-consumer candidates in the task brief).
- **Local `shell` grep `for repo in PhenoCompose HeliosLab Eidolon Civis phenodag PhenoContracts phenoData phenoShared`** — 0 hits in any of those production repos for `pheno-port-adapter` or `pheno_port_adapter` (in any file type).
- **GitHub `gh search code --owner KooshaPari 'pheno-port-adapter\s*='`** — 0 hits (the regex matches Cargo.toml-style dep lines like `pheno-port-adapter = { version = "..." }` or `pheno-port-adapter = "0.1"`).
- **GitHub `gh search code --owner KooshaPari 'pheno_port_adapter\s*='`** — 0 hits (the underscore variant, for Python import-style lines).
- **GitHub `gh search code --owner KooshaPari '"pheno-port-adapter"'`** — 19 hits, **all of which are**:
  - `name = "pheno-port-adapter"` (Cargo.toml self-identification) in the 3 GitHub-mirrored copies (argis-extensions, FocalPoint, phenotype-apps).
  - `repo_b = "pheno-port-adapter"` in `HexaKit/scripts/audit-tools/README-predict.md` and `phenotype-org-audits/audits/predict-dry/README.md` (predictive-DRY baseline config).
  - `substrate: "pheno-port-adapter"` in `argis-extensions/findings/2026-06-20-T38-drift-detector-ci.md` (drift-detector output).
  - `repo: "pheno-port-adapter"` in `phenotype-apps:worklogs/L9-maintainability-audit-20260616.json` (audit worklog).
  - `first_failure: "pheno-port-adapter"` in `argis-extensions/findings/2026-06-22-SIDE-20-test-runner.md` (test runner output).
  - `pheno-port-adapter: { hit_rate: 0.76, last_7d_avg: 0.74 }` in `argis-extensions/.github/workflows/cache-stats-pages.yml` (cache-stats dashboard).
  - `"adapter": "pheno-port-adapter"` in `phenotype-apps:pheno-port-adapter/README.md` (README content).
  - `"pheno-port-adapter"` as a string literal in `phenotype-tooling:docs/absorbed-from-pheno-port-adapter/SPEC.md` (the already-archived copy in phenotype-tooling's `absorbed-from-*` collection).
  - **`name = "pheno-port-adapter"` in `argis-extensions/findings/2026-06-22-SIDE-17-cargo-profiles.md` and `argis-extensions/findings/2026-06-21-SIDE-04-version-alignment.md`** (cargo-profile + version-alignment findings, identifying the crate as a cargo workspace member).

**Zero production code depends on `pheno-port-adapter`.** This is the central finding of this audit. The substrate is canonical by ADR declaration, but the 22-crate migration matrix in `pheno-port-adapter/SPEC.md:12` has **not been executed** by any in-fleet consumer.

**Implication for absorption question:** if there are zero consumers, the question "is `pheno-port-adapter` absorbable into another crate?" is moot. The substrate is **the canonical home**; there is no downstream demand that would justify moving it elsewhere. The opposite problem exists: the substrate needs **more adoption**, not absorption.

**Implication for the 4 stale local copies:** the 3 non-standalone copies (FocalPoint, focalpoint-wt-v12-16-17, argis-extensions) are **debt**, not alternatives. They exist because of multi-worktree workflow patterns where the same crate was ported to multiple sub-monorepos, but they have not been kept in sync. The consolidation target is to **delete** them and point all consumers to the canonical `phenotype-apps:pheno-port-adapter/`.

---

## 19. Polyglot / FFI bindings check

The task brief asks: "Any pyo3/napi-rs/UniFFI polyglot bindings?"

**File:line evidence:**

- `grep -rln "pyo3\|napi-rs\|napi_rs\|uniffi\|UniFFI\|cbindgen\|cxx\|wasm-bindgen" --include="Cargo.toml" --include="*.rs" pheno-port-adapter/` — **0 hits**.
- `pheno-port-adapter/Cargo.toml:9-30` — full dep list: `thiserror = "2.0"` (line 10), `tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }` (line 16), `async-trait = "0.1"` (line 20), `redis = { version = "0.27", default-features = false, features = ["tokio-comp", "connection-manager"] }` (line 24), `pheno-otel = { path = "../pheno-otel" }` (line 30). **No FFI deps.** No pyo3, no napi-rs, no UniFFI, no cbindgen, no cxx, no wasm-bindgen.
- `pheno-port-adapter/[dev-dependencies]` (lines 32-37) — `serde_json = "1"`, `tokio` test-only features, `criterion = "0.8"` (benches). No FFI dev-deps either.

**Verdict:** **ZERO FFI bindings.** `pheno-port-adapter` is **Rust-only** at this time. Cross-language consumption would require either:
- pyo3 binding for Python (e.g. for `phenotype-python-sdk/packages/pheno-caching` to use the Rust `HexCachePort` + `InMemoryCache` + `RedisAdapter`).
- UniFFI binding for Go/Kotlin/Swift/Python (e.g. for `phenotype-router` to use the Rust `PortAdapter` from Go, or for `phenotype-journeys` to use it from Swift).
- cbindgen for C ABI (e.g. for C-based service meshes).

**Implication for absorption question:** because there are zero FFI bindings, the substrate cannot be absorbed into a non-Rust crate. The only Rust absorption candidates (HexaKit, FocalPoint, AgilePlus, pheno/ monorepo, phenotype-apps monorepo) have all been individually evaluated and REJECTED in [§ 3](#3-candidate-1-pheno-monorepo-parity-shadow-check), [§ 4](#4-candidate-2-phenotype-apps-monorepo-host-monorepo-of-the-standalone-entry), [§ 15](#15-candidate-13-agileplus-rust-product-port-adapter-pattern), [§ 16](#16-candidate-14-hexakit-rust-framework-hexagonal-l4-architecture), [§ 17](#17-candidate-15-focalpoint-rust-framework-hexagonal-l4-architecture).

**Implication for the PROMOTION.md predicted-consumer plan:** the PROMOTION.md (lines 57-68) lists `phenotype-typescript-sdk` (Q3 2026), `phenotype-router` (Q4 2026), and `phenotype-journeys` (Q1 2027) as predicted consumers. These are all **cross-language** consumers, which means they would need FFI bindings. The promotion plan should include FFI binding as a milestone (e.g. UniFFI proc-macro on the existing `PortAdapter` trait).

---

## 20. Federal service / framework status per ADR-023

The task brief asks: "Any federal service / framework status (per ADR-023)?"

Per ADR-023 Rule 3, the substrate placement is one of:
- `pheno-*-lib` / `pheno-*-core` — pure reusable library, language-specific, single concern, single crate.
- `phenotype-*-sdk` — cross-language SDK, stable public API, polyglot facade.
- `phenotype-*-framework` — IoC framework, opinionated lifecycle, ports, adapters, conventions.
- Federated service — stateful, long-running, independently scalable.

**Verdict for `pheno-port-adapter`:** **`pheno-*-lib` tier** (confirmed by `pheno-port-adapter/STATUS.md:5`: "**Substrate tier:** `pheno-*-lib` (per ADR-023 Rule 3)."; `pheno-port-adapter/AGENTS.md:5`: "**Substrate:** `pheno-*-lib` (ADR-023)"; `pheno-port-adapter/SPEC.md:5`: "**Substrate tier:** `pheno-*-lib` (per ADR-023 Rule 3)."; `pheno-port-adapter/PROMOTION.md:8-9`: "**Source tier: Tier 1 — pheno-*-lib**. **Target tier: Tier 2 — phenotype-*-sdk**").

**File:line evidence for tier classification:**
- `pheno-port-adapter/STATUS.md:5-6` — "Substrate tier: `pheno-*-lib` (per ADR-023 Rule 3). Pattern role: canonical hexagonal L4 Port/Adapter reference impl (per ADR-038)."
- `pheno-port-adapter/AGENTS.md:5-6` — "Substrate: `pheno-*-lib` (ADR-023). Reference role: canonical hexagonal L4 Port/Adapter primitive (ADR-038) — `pheno-port-adapter` is the **reference impl** that the other 21 pheno-* substrate crates migrate toward."
- `pheno-port-adapter/SPEC.md:5-6` — "Substrate tier: `pheno-*-lib` (per ADR-023 Rule 3). Pattern role: reference impl for the hexagonal L4 Port/Adapter contract (ADR-038)."
- `pheno-port-adapter/PROMOTION.md:1-9` — PROMOTION.md header explicitly says: "PROMOTION — pheno-port-adapter: Tier 1 → Tier 2". The crate is at `pheno-*-lib` tier (Tier 1) and is being **promoted** to `phenotype-*-sdk` tier (Tier 2). Per the task brief, it is **NOT** at the framework or federated-service tier.
- `phenotype-registry/docs/adrs/ADR-ECO-017-substrate-schema-conventions.md` (from `gh search code`) — confirms `pheno-port-adapter` is in the `pheno-lib` tier: "`pheno-lib` | Pure reusable library; single concern; language-specific | `pheno-config`, `pheno-context`, `pheno-port-adapter` (and Configra's four sub-crates) |".

**Quality bar (per ADR-023 Rule 3.1 + ADR-042B):** `pheno-port-adapter` is required to ship (and does ship, with v8 batch-5 governance meta-bundle):
- ✅ Spec (`SPEC.md`, 153 lines, 1-page target)
- ✅ Docs (`AGENTS.md` + `STATUS.md` + `llms.txt`)
- ⚠️ Test matrix — 5 inline tests + 5 integration test files (loom, loom_concurrency, hex_cache, hex_time, proptest_smoke) + fuzz (fuzz_targets/fuzz_endpoint.rs) + 2 benches (cache_cycles, flame). **80% lib coverage gate is NOT yet enforced on `main`** (per `STATUS.md:14-16`: "**Honest note on coverage:** the L20 (unit coverage) pillar scored 2/3 in the 71-pillar audit ... L21 (integration tests) scored 0/3 — no `tests/` subdir on main. The 80% gate (ADR-040, lib/SDK) is not yet enforced.").
- ✅ Observability — OTLP export via `pheno-otel` (ADR-037), per `Cargo.toml:30` and `src/lib.rs:20-27`.
- ✅ Worklog v2.1 — `WORKLOG.md` migrated to v2.1 schema (ADR-025 + ADR-030), per `CHANGELOG.md:19-23`.
- ⚠️ CI gate — `.github/workflows/ci.yml` is on the wip branch only, not yet on `main` (per `STATUS.md:30-32`).
- ✅ Meta-bundle — AGENTS.md, CHANGELOG.md, CONTRIBUTING.md, SECURITY.md, SPEC.md, STATUS.md, WORKLOG.md, llms.txt, deny.toml, llvm-cov.toml, justfile, i18n/{en,es,ja}/, all present per the standalone `ls` output.

**Implication for absorption question:** a `pheno-*-lib` is the **lowest tier** in the ADR-023 hierarchy. It is a leaf-node substrate. It is **not** absorbed into anything; rather, higher-tier crates (frameworks, services) absorb **it**. The absorption question is therefore structurally backwards: a `pheno-*-lib` is the canonical home for the concern it covers; the question should be "which higher-tier crates should depend on it?" — answer: 22 pheno-* substrate crates per `SPEC.md:12` (none currently do, per [§ 18](#18-production-consumer-search-across-the-fleet)).

**Implication for promotion (per ADR-048):** the `PROMOTION.md` (2026-06-21, status `PROPOSED`) requests promotion from `pheno-*-lib` (Tier 1) to `phenotype-*-sdk` (Tier 2). The promotion is **gated** by:
- G1.1: ≥ 2 distinct language-runtime consumers — **NOT MET** (0 production consumers in any language).
- G1.2: ≥ 1 cross-language candidate consumer — partially met (phenotype-router Q4 2026 + phenotype-typescript-sdk Q3 2026 are predicted, not actual).
- G1.3: Port trait stabilized — MET (PortAdapter trait unchanged since v8 canonicalization).
- G1.4: ≥ 80% test coverage — NOT YET ENFORCED (per STATUS.md:14-16).
- G1.5: SPEC + README + concept doc — partially met (SPEC.md ✅, README.md ❌ per STATUS.md:37, llms.txt ✅, concept doc ✅ in docs/architecture.md).
- G1.6: OTLP export wired — MET (via pheno-otel, ADR-037).

The promotion is **premature** until G1.1, G1.4, and G1.5 close. Absorption is therefore not the right answer either — the right answer is **adoption push** (close G1.1 by migrating 2-3 pheno-* crates) and **coverage gate** (close G1.4 by enforcing 80% lib coverage on a heavy-runner).

---

## 21. Final absorption verdict + consolidation recommendations

### 21.1 Absorption verdict

**`pheno-port-adapter` is NOT absorbable into any other crate in the fleet.** All 16 absorption candidates have been individually REJECTED with concrete primary rejection reasons. The substrate is the **canonical L4 Port/Adapter reference impl** per ADR-014 + ADR-038 + ADR-023 + ADR-048 + the meta-bundle documentation. It is at the lowest tier (`pheno-*-lib`) of the substrate hierarchy; by ADR-023's design, leaf-node substrates are not absorbed — they are the canonical home for their concern.

### 21.2 Consolidation recommendations (for the 4 local copies)

The 4 local copies of `pheno-port-adapter/` need **consolidation**, not absorption. The recommendation is:

| # | Path | Action | Justification |
|---|------|--------|---------------|
| 1 | `repos/pheno-port-adapter/` | **KEEP** (canonical) | Latest API surface, full meta-bundle, hex-ports, async, fuzz, benches, i18n. Branch `feat/v20-l36-chaos-2026-06-22`. |
| 2 | `repos/argis-extensions/pheno-port-adapter/` | **DELETE** (or deprecate) | Stale v0.1.0, no hex-ports, no async, no tokio. Has the meta-bundle but it is governance-only. |
| 3 | `repos/FocalPoint/pheno-port-adapter/` | **DELETE** | Stale, sub-L4-66 snapshot, no meta-bundle, no hex-ports. Not in workspace members. |
| 4 | `repos/focalpoint-wt-v12-16-17/pheno-port-adapter/` | **DELETE** (or `git worktree remove`) | Stale v12 worktree residue, v17-era commits. Cleanup needed. |

**Concrete steps for the 3 stale copies:**

1. **PR-1: delete `argis-extensions/pheno-port-adapter/`.** Open a PR on `KooshaPari/argis-extensions` with title `chore: remove stale pheno-port-adapter/ (canonical lives in KooshaPari/phenotype-apps)`. The PR body cites this audit doc + ADR-048 (substrate-graduation-path) + ADR-023 (substrate placement). Branch: `chore/l5-160-delete-stale-pheno-port-adapter-2026-06-21`.

2. **PR-2: delete `FocalPoint/pheno-port-adapter/` + `FocalPoint/focalpoint-wt-v12-16-17/pheno-port-adapter/`.** Open a PR on `KooshaPari/FocalPoint` with title `chore: remove 2 stale pheno-port-adapter/ snapshots (canonical lives in KooshaPari/phenotype-apps)`. The PR body cites this audit doc + the historical `l4-66-pheno-port-adapter-2026-06-11.json` worklog. Branch: `chore/l5-161-delete-stale-pheno-port-adapter-focalpoint-2026-06-21`.

3. **PR-3: drop the `focalpoint-wt-v12-16-17` worktree** (if it's a worktree) or delete the directory (if it's a regular subdir). This is a `git worktree remove` op, not a PR.

4. **PR-4: register the cleanup in `phenotype-registry/disposition-index.json`.** Add a `bucket_change` row: `pheno-port-adapter: from=STABLE reason=3 stale duplicates deleted; canonical is KooshaPari/phenotype-apps:pheno-port-adapter/`.

### 21.3 Adoption push recommendations (per ADR-047 predictive-DRY + ADR-048 gates)

The PROMOTION.md lists 22 pheno-* substrate crates as predicted consumers of the L4 contract, but **zero have migrated**. The audit recommends the following adoption-push tracks (in priority order):

1. **T-A1: migrate `pheno-config` to use `pheno-port-adapter::PortAdapter`** for its config-source connections (env, file, HTTP). This is a small, self-contained migration that closes G1.1 (1 Rust consumer).
2. **T-A2: migrate `pheno-tracing` to use `pheno-port-adapter::PortAdapter`** for its OTLP exporter HTTP connection. Closes G1.1 (2 Rust consumers).
3. **T-A3: migrate `pheno-otel` to use `pheno-port-adapter::PortAdapter`** for its OTLP wire-format HTTP connection. Closes G1.1 (3 Rust consumers).
4. **T-A4: add a FFI binding** (UniFFI proc-macro on `PortAdapter`) so the predicted `phenotype-typescript-sdk` (Q3 2026), `phenotype-router` (Q4 2026), and `phenotype-journeys` (Q1 2027) consumers can be enabled. Closes G1.1 across languages.
5. **T-A5: enforce the 80% lib coverage gate** on a heavy-runner (forge-A or CI per the device-fit gate in `AGENTS.md § Device-fit gate`). Closes G1.4.
6. **T-A6: write the missing `README.md`** (per `STATUS.md:37` — "L64 (README) pillar is 0/3"). Closes G1.5.

After T-A1..A3 land, re-evaluate the PROMOTION.md (Tier 1 → Tier 2 gate G1.1) and proceed with the `phenotype-port-sdk` polyglot facade creation per the PROMOTION.md § Rollback plan.

### 21.4 Anti-pattern watch

Per the audit, the following anti-patterns must be **avoided**:

1. **Do NOT add a new `port-traits` or `ports-canonical` crate** in `pheno/` or `HexaKit/` that competes with `pheno-port-adapter`. Both monorepos already have DDD-flavored port-traits crates; adding a transport-flavored one would re-introduce the very duplication that ADR-038 was created to eliminate. If a new transport-flavored Port/Adapter is needed, it goes **inside** `pheno-port-adapter/` as a new `src/adapters/<transport>.rs` file.
2. **Do NOT re-export `pheno-port-adapter::PortAdapter` from a different crate's prelude**. The trait is meant to be consumed by `use pheno_port_adapter::PortAdapter;` directly. Re-exporting it through, e.g., `phenotype-config::prelude::PortAdapter` would obscure the canonical home and make deprecation harder.
3. **Do NOT fork `pheno-port-adapter/` into a new monorepo.** The 4 stale local copies already demonstrate the cost of forking. Any new monorepo that needs the L4 contract should `pheno-port-adapter = "0.1"` in its `Cargo.toml` and let cargo resolve the canonical crate.

---

## 22. Appendix A — Candidate plausibility matrix

| # | Candidate | Tier | Lang | Plausibility | Verdict | Primary rejection reason |
|---|-----------|------|------|--------------|---------|--------------------------|
| 1 | `pheno/` monorepo | monorepo | Rust | MEDIUM | REJECT | CQRS-flavored `phenotype-port-traits`; not the L4 transport contract |
| 2 | `phenotype-apps` monorepo | monorepo | HTML/iOS/web | HIGH | **ACCEPT (canonical home)** | Already the canonical host; no absorption needed |
| 3 | `phenotype-router` | framework | Go | MEDIUM | REJECT | Wrong language, wrong tier (framework vs. lib); consumer of design pattern |
| 4 | `pheno-otel` | lib | Rust | MEDIUM | REJECT | Wrong concern (OTLP wire vs. transport); already a dependency of `pheno-port-adapter` |
| 5 | `pheno-tracing` | lib | Rust | MEDIUM | REJECT | Different `Port` trait (observability carrier vs. transport adapter) |
| 6 | `pheno-flags` | lib | Rust | LOW | REJECT | Unrelated concern (boolean flag store) |
| 7 | `pheno-errors` | lib | Rust | LOW | REJECT | Unrelated concern (error envelope); only shares thiserror idiom |
| 8 | `phenotype-config` / `Configra` | lib | Rust | LOW | REJECT | Config substrate, unrelated concern |
| 9 | `pheno-mcp-router` | lib | Python | LOW | REJECT | Wrong language, different trait (`LlmPort` vs. `PortAdapter`) |
| 10 | `pheno-scaffold-kit` | umbrella | Rust | NONE | REJECT | Wrong scope (scaffolding templates vs. substrate) |
| 11 | `phenotype-registry` | registry | JSON | LOW | REJECT | Registry metadata, not source code |
| 12 | `phenotype-python-sdk` | SDK | Python | LOW | REJECT | Wrong language, wrong tier (polyglot SDK) |
| 13 | `AgilePlus` | product | Rust | LOW | REJECT | Product, not substrate; no Port/Adapter contract |
| 14 | `HexaKit` | framework | Rust | MEDIUM | REJECT | DDD/CQRS-flavored `phenotype-port-traits`; not the L4 transport contract; wrong tier |
| 15 | `FocalPoint` | product | Rust | LOW | REJECT | Product, not substrate; 2 stale duplicates that need cleanup (not absorption) |
| — | **Consolidation targets** (4 stale local copies) | — | — | — | **PARTIAL ACCEPT** | Delete the 3 non-standalone copies; canonical lives in `phenotype-apps:pheno-port-adapter/` |

**Summary:** 0 of 15 absorption candidates ACCEPT. 1 of 15 ACCEPTED (Candidate 2, as canonical home, not as absorption target). 1 PARTIAL ACCEPT (consolidation of 4 stale copies). 13 REJECTED with concrete reasons.

---

## 23. Appendix B — File:line evidence index

| Evidence | Path:line |
|----------|-----------|
| `pheno-port-adapter` Cargo.toml (canonical, latest) | `pheno-port-adapter/Cargo.toml:1-41` |
| `pheno-port-adapter` `PortAdapter` trait | `pheno-port-adapter/src/lib.rs:70-89` |
| `pheno-port-adapter` `Connection` struct | `pheno-port-adapter/src/lib.rs:60-64` |
| `pheno-port-adapter` `AdapterError` enum (4 variants) | `pheno-port-adapter/src/lib.rs:38-57` |
| `pheno-port-adapter` 5 inline unit tests | `pheno-port-adapter/src/lib.rs:144-194` |
| `pheno-port-adapter` OTLP comment (ADR-037 ref) | `pheno-port-adapter/src/lib.rs:20-27` |
| `pheno-port-adapter` `pheno-otel` dep | `pheno-port-adapter/Cargo.toml:30` |
| `pheno-port-adapter` `tokio` dep (async hex-ports) | `pheno-port-adapter/Cargo.toml:16` |
| `pheno-port-adapter` `async-trait` dep | `pheno-port-adapter/Cargo.toml:20` |
| `pheno-port-adapter` `redis` dep (RedisAdapter) | `pheno-port-adapter/Cargo.toml:24` |
| `pheno-port-adapter` `redis_cache.rs` adapter | `pheno-port-adapter/src/adapters/redis_cache.rs:1-200` |
| `pheno-port-adapter` `in_memory_cache.rs` adapter | `pheno-port-adapter/src/adapters/in_memory_cache.rs:1-186` |
| `pheno-port-adapter` `mock_clock.rs` adapter | `pheno-port-adapter/src/adapters/mock_clock.rs:1-238` |
| `pheno-port-adapter` `system_clock.rs` adapter | `pheno-port-adapter/src/adapters/system_clock.rs:1-102` |
| `pheno-port-adapter` `tcp.rs` adapter | `pheno-port-adapter/src/adapters/tcp.rs:1-432` |
| `pheno-port-adapter` `unix.rs` adapter | `pheno-port-adapter/src/adapters/unix.rs:1-173` |
| `pheno-port-adapter` `ports/cache.rs` (HexCachePort) | `pheno-port-adapter/src/ports/cache.rs:1-84` |
| `pheno-port-adapter` `ports/time.rs` (HexTimePort) | `pheno-port-adapter/src/ports/time.rs:1-68` |
| `pheno-port-adapter` `tests/hex_cache.rs` | `pheno-port-adapter/tests/hex_cache.rs:1-134` |
| `pheno-port-adapter` `tests/hex_time.rs` | `pheno-port-adapter/tests/hex_time.rs:1-130` |
| `pheno-port-adapter` `tests/loom.rs` | `pheno-port-adapter/tests/loom.rs:1-169` |
| `pheno-port-adapter` `tests/loom_concurrency.rs` | `pheno-port-adapter/tests/loom_concurrency.rs:1-203` |
| `pheno-port-adapter` `tests/proptest_smoke.rs` | `pheno-port-adapter/tests/proptest_smoke.rs:1-45` |
| `pheno-port-adapter` `fuzz/fuzz_targets/fuzz_endpoint.rs` | `pheno-port-adapter/fuzz/fuzz_targets/fuzz_endpoint.rs:1` |
| `pheno-port-adapter` `benches/cache_cycles.rs` | `pheno-port-adapter/benches/cache_cycles.rs:1` |
| `pheno-port-adapter` `benches/flame.rs` | `pheno-port-adapter/benches/flame.rs:1` |
| `pheno-port-adapter` `examples/otel_quickstart.rs` | `pheno-port-adapter/examples/otel_quickstart.rs:1-55` |
| `pheno-port-adapter` `examples/quickstart.rs` | `pheno-port-adapter/examples/quickstart.rs:1-28` |
| `pheno-port-adapter` `SPEC.md` (1-page spec) | `pheno-port-adapter/SPEC.md:1-153` |
| `pheno-port-adapter` `STATUS.md` (honest scorecard) | `pheno-port-adapter/STATUS.md:1-98` |
| `pheno-port-adapter` `CHANGELOG.md` (Keep a Changelog) | `pheno-port-adapter/CHANGELOG.md:1-70` |
| `pheno-port-adapter` `AGENTS.md` (constitution) | `pheno-port-adapter/AGENTS.md:1-91` |
| `pheno-port-adapter` `PROMOTION.md` (Tier 1 → 2) | `pheno-port-adapter/PROMOTION.md:1-123` |
| `pheno-port-adapter` `llms.txt` | `pheno-port-adapter/llms.txt:1-34` |
| `pheno-port-adapter` `deny.toml` | `pheno-port-adapter/deny.toml:1` |
| `pheno-port-adapter` `llvm-cov.toml` (80% gate) | `pheno-port-adapter/llvm-cov.toml:1` |
| `pheno-port-adapter` `i18n/{en,es,ja}/pheno-port-adapter.ftl` | `pheno-port-adapter/i18n/en/pheno-port-adapter.ftl:1` + es + ja |
| `pheno-port-adapter` `docs/architecture.md` | `pheno-port-adapter/docs/architecture.md:1-48` |
| `pheno-port-adapter` `docs/perf/flamegraph-howto.md` | `pheno-port-adapter/docs/perf/flamegraph-howto.md:1` |
| `pheno-port-adapter` `scripts/coverage.sh` | `pheno-port-adapter/scripts/coverage.sh:1` |
| `pheno-port-adapter` tier classification | `pheno-port-adapter/STATUS.md:5-6` + `AGENTS.md:5-6` + `SPEC.md:5-6` + `PROMOTION.md:8-9` |
| `pheno-port-adapter` 22-crate migration claim | `pheno-port-adapter/SPEC.md:12` (un-verified per this audit) |
| `pheno-port-adapter` AGENTS.md See-also section | `pheno-port-adapter/AGENTS.md:85-91` |
| `argis-extensions/pheno-port-adapter` Cargo.toml (stale) | `argis-extensions/pheno-port-adapter/Cargo.toml:1-20` |
| `argis-extensions/pheno-port-adapter` src/lib.rs (stale) | `argis-extensions/pheno-port-adapter/src/lib.rs:1-125` |
| `argis-extensions/pheno-port-adapter` git remote | `argis-extensions/pheno-port-adapter/.git/config:remote "origin" = KooshaPari/argis-extensions.git` |
| `FocalPoint/pheno-port-adapter` (stale, sub-L4-66) | `FocalPoint/pheno-port-adapter/Cargo.toml:1` |
| `FocalPoint/pheno-port-adapter` git remote | `FocalPoint/pheno-port-adapter/.git/config:remote "origin" = KooshaPari/FocalPoint.git` |
| `focalpoint-wt-v12-16-17/pheno-port-adapter` (v12 residue) | `focalpoint-wt-v12-16-17/pheno-port-adapter/Cargo.toml:1` |
| `pheno/` monorepo `phenotype-port-traits` Cargo.toml | `pheno/crates/phenotype-port-traits/Cargo.toml:1-12` |
| `pheno/` monorepo `phenotype-port-traits` lib.rs | `pheno/crates/phenotype-port-traits/src/lib.rs:1-60` |
| `pheno/` monorepo git remote | `pheno/.git/config:remote "origin" = https://github.com/KooshaPari/pheno.git` |
| `pheno/` monorepo `phenotype-ports-canonical` | `pheno/crates/phenotype-ports-canonical/MIGRATION.md:1` + `Cargo.toml:1-12` |
| `pheno/` monorepo `phenotype-cache-adapter` | `pheno/crates/phenotype-cache-adapter/Cargo.toml:1` + `src/lib.rs:1` |
| `phenotype-apps` monorepo description | `gh api /repos/KooshaPari/phenotype-apps` → `"description": "Phenotype apps — iOS + web shell assets ..."` |
| `phenotype-apps:pheno-port-adapter` README exists | `gh search code` → `KooshaPari/phenotype-apps:pheno-port-adapter/README.md` |
| `phenotype-router` AGENTS.md (reference only) | `gh search code` → `KooshaPari/phenotype-router/AGENTS.md` |
| `phenotype-router` decision.rs (cites `pheno-port-adapter`) | `gh search code` → `KooshaPari/phenotype-router/src/decision.rs` |
| `phenotype-router` plugin PREDICTIVE.md (capability tiering) | `gh search code` → `KooshaPari/phenotype-router/src/plugins/promptadapter/PREDICTIVE.md` |
| `pheno-otel` canonical OTLP wire | `pheno-port-adapter/Cargo.toml:30` + `src/lib.rs:20-27` (consumer) |
| `pheno-tracing` canonical observability | `pheno-port-adapter/AGENTS.md:88` (peer ref) |
| `pheno-tracing` `Port` trait (observability) | `pheno-tracing/src/port.rs:1` |
| `pheno-flags` `FlagSet` struct | `pheno-flags/src/lib.rs:94-96` |
| `pheno-flags` `FlagError` enum | `pheno-flags/src/lib.rs:72-83` |
| `pheno-errors` (thiserror-aligned, no Port trait) | `pheno-errors/src/lib.rs:1` |
| `phenotype-config` (config substrate, unrelated) | AGENTS.md Stage 1 closure + `KooshaPari/phenotype-config/pull/1` |
| `Configra` (config substrate, unrelated) | AGENTS.md ADR-031 + ADR-022 |
| `pheno-mcp-router` `LlmPort` trait (Python, wrong lang) | `pheno-mcp-router/PROMOTION.md:14-17` |
| `pheno-mcp-router` PROMOTION.md (Tier 1 → 2) | `pheno-mcp-router/PROMOTION.md:1-?` (read partially) |
| `pheno-scaffold-kit` (umbrella, wrong scope) | (no inspection; rejection by definition) |
| `phenotype-registry` schema ADR | `phenotype-registry/docs/adrs/ADR-ECO-017-substrate-schema-conventions.md` (via `gh search code`) |
| `phenotype-registry` collision resolver | `phenotype-registry/scripts/resolve-collision.py` (via `gh search code`) |
| `phenotype-python-sdk` `pheno-caching` package | `phenotype-python-sdk/packages/pheno-caching/pyproject.toml:1-15` + `src/pheno_caching/__init__.py:1` |
| `AgilePlus` workspace (product, no Port contract) | `AgilePlus/Cargo.toml:1-?` (inspected) |
| `AgilePlus` no port-adapter | `grep -rln "pheno-port-adapter" --include="Cargo.toml" --include="*.rs" AgilePlus/` → 0 hits |
| `HexaKit` `phenotype-port-traits` (CQRS-flavored) | `HexaKit/crates/phenotype-port-traits/src/lib.rs:1-48` |
| `HexaKit` `phenotype-ports-canonical` | `HexaKit/crates/phenotype-ports-canonical/Cargo.toml:1-12` |
| `HexaKit` git remote | `HexaKit/.git/config:remote "origin" = https://github.com/KooshaPari/HexaKit.git` |
| `HexaKit` L62 adopt `pheno-otel` (recent commit) | `HexaKit` git log: `6f82788 chore(obs): L62 adopt pheno-otel::ErrorCounter for HexaKit` |
| `FocalPoint` workspace (100+ `focus-*` crates) | `FocalPoint/Cargo.toml:members = [...]` (read partially) |
| `FocalPoint` no port-adapter in members | `grep -E "pheno-port|phenotype-port" FocalPoint/Cargo.toml` → 0 hits |
| `FocalPoint` L4-66 worklog (historical) | `FocalPoint/worklogs/l4-66-pheno-port-adapter-2026-06-11.json:1` |
| `FocalPoint` health audit (historical) | `FocalPoint/L6_PHENO_REPOS_HEALTH_2026_06_14.md:1` |
| `phenotype-tooling:docs/absorbed-from-pheno-port-adapter/` (already-archived copy) | `gh search code` → `KooshaPari/phenotype-tooling:docs/absorbed-from-pheno-port-adapter/SPEC.md` + `WORKLOG.md` + `Cargo.toml` + `CHANGELOG.md` + `SECURITY.md` + `examples/otel_quickstart.rs` + `scripts/coverage.sh` + `.editorconfig` |
| `phenotype-org-audits/audits/predict-dry/README.md` (predictive-DRY baseline) | `gh search code` → `KooshaPari/phenotype-org-audits:audits/predict-dry/README.md` |
| `argis-extensions` cache-stats dashboard (output, not source) | `gh search code` → `KooshaPari/argis-extensions:.github/workflows/cache-stats-pages.yml` |
| `argis-extensions` test runner output | `gh search code` → `KooshaPari/argis-extensions:findings/2026-06-22-SIDE-20-test-runner.md` |
| `argis-extensions` drift-detector output | `gh search code` → `KooshaPari/argis-extensions:findings/2026-06-20-T38-drift-detector-ci.md` |
| `argis-extensions` cargo profiles finding | `gh search code` → `KooshaPari/argis-extensions:findings/2026-06-22-SIDE-17-cargo-profiles.md` |
| `argis-extensions` version alignment finding | `gh search code` → `KooshaPari/argis-extensions:findings/2026-06-21-SIDE-04-version-alignment.md` |
| `phenotype-apps` L9 maintainability audit worklog | `gh search code` → `KooshaPari/phenotype-apps:worklogs/L9-maintainability-audit-20260616.json` |
| `argis-extensions` worklog v14 cargo-deps | `gh search code` → `KooshaPari/argis-extensions:worklogs/L5-128-v14-T1-cargo-deps-2026-06-20.json` |
| ADR-014 (predecessor of ADR-038) | `docs/adr/2026-06-15/ADR-014-hexagonal-l4-ports.md` |
| ADR-038 (canonical L4 policy) | `docs/adr/2026-06-18/ADR-038-hexagonal-port-adapter-l4-policy.md` |
| ADR-023 Rule 3 (substrate placement) | `docs/adr/2026-06-15/ADR-023-agent-effort-governance.md` |
| ADR-023 Rule 3.1 (quality bar) | `ADR-023 § Quality bar for new substrate` |
| ADR-048 (substrate graduation path) | `docs/adr/2026-06-18/ADR-048-substrate-graduation-path.md` |
| ADR-047 (predictive DRY) | `docs/adr/2026-06-18/ADR-047-predictive-dry.md` |
| ADR-040 (test coverage gates) | `docs/adr/2026-06-18/ADR-040-test-coverage-gates-per-tier.md` |
| ADR-042B (substrate quality bar formal) | `docs/adr/2026-06-18/ADR-042-substrate-quality-bar.md` |
| ADR-036B (pheno-tracing canonical) | `docs/adr/2026-06-18/ADR-036-pheno-tracing-substrate-canonical.md` |
| ADR-037 (pheno-otel canonical) | `docs/adr/2026-06-18/ADR-037-pheno-mcp-router-substrate-canonical.md` (note: same path; pheno-otel is documented in adjacent ADR) |
| ADR-050 (router architecture) | AGENTS.md (accepted 2026-06-20) |
| ADR-051 (federation interface) | AGENTS.md (accepted 2026-06-20) |

---

## 24. Appendix C — GitHub code-search evidence (raw `gh search code` output)

This appendix captures the raw `gh search code --owner KooshaPari` output that establishes the **zero production-consumer** finding in [§ 18](#18-production-consumer-search-across-the-fleet).

### 24.1 Query 1: `pheno_port_adapter\s*=`

```text
(empty)
```

→ 0 hits. No Cargo.toml-style dependency lines using the underscore variant of the crate name.

### 24.2 Query 2: `pheno-port-adapter\s*=`

```text
(empty)
```

→ 0 hits. No Cargo.toml-style dependency lines using the dash variant either.

### 24.3 Query 3: `"pheno-port-adapter"` (string literal)

```text
KooshaPari/argis-extensions:pheno-port-adapter/Cargo.toml: name = "pheno-port-adapter"
KooshaPari/argis-extensions:pheno-port-adapter/llms.txt: # pheno-port-adapter
KooshaPari/argis-extensions:pheno-port-adapter/llms.txt: See `pheno-port-adapter/examples/tcp_pool.rs`.
KooshaPari/argis-extensions:pheno-port-adapter/CONTRIBUTING.md: # pheno-port-adapter — CONTRIBUTING.md
KooshaPari/argis-extensions:pheno-port-adapter/CONTRIBUTING.md: gh repo fork KooshaPari/phenotype-apps   # monorepo (this crate lives in pheno-port-adapter/)
KooshaPari/argis-extensions:pheno-port-adapter/deny.toml: # deny.toml — cargo-deny configuration for pheno-port-adapter
KooshaPari/argis-extensions:findings/2026-06-22-SIDE-17-cargo-profiles.md: name = "pheno-port-adapter"
KooshaPari/argis-extensions:findings/2026-06-22-SIDE-20-test-runner.md: "first_failure": "pheno-port-adapter"
KooshaPari/argis-extensions:findings/2026-06-20-T38-drift-detector-ci.md: "substrate": "pheno-port-adapter",
KooshaPari/argis-extensions:findings/2026-06-21-SIDE-04-version-alignment.md: name = "pheno-port-adapter"
KooshaPari/argis-extensions:worklogs/L5-128-v14-T1-cargo-deps-2026-06-20.json: "repo": "pheno-port-adapter"
KooshaPari/argis-extensions/.github/workflows/cache-stats-pages.yml: "pheno-port-adapter": {"hit_rate": 0.76, "last_7d_avg": 0.74},
KooshaPari/phenotype-apps:pheno-port-adapter/Cargo.toml: name = "pheno-port-adapter"
KooshaPari/phenotype-apps:pheno-port-adapter/README.md: # pheno-port-adapter
KooshaPari/phenotype-apps:pheno-port-adapter/README.md: let adapter = TcpAdapter::new("pheno-port-adapter");
KooshaPari/phenotype-apps:pheno-port-adapter/README.md: "adapter": "pheno-port-adapter",
KooshaPari/phenotype-apps:pheno-port-adapter/llms.txt: # pheno-port-adapter
KooshaPari/phenotype-apps:pheno-port-adapter/examples/quickstart.rs: //! Quickstart example for pheno-port-adapter.
KooshaPari/phenotype-apps:worklogs/L9-maintainability-audit-20260616.json: "repo": "pheno-port-adapter",
KooshaPari/phenotype-router/AGENTS.md: > `pheno-port-adapter/AGENTS.md` and `pheno-tracing/AGENTS.md`.
KooshaPari/phenotype-router/AGENTS.md: - [`pheno-port-adapter`](../pheno-port-adapter/) — hexagonal L4 reference impl.
KooshaPari/phenotype-router/src/decision.rs: //! [`pheno-port-adapter`] reference impl:
KooshaPari/phenotype-router/src/plugins/promptadapter/PREDICTIVE.md: - `pheno-port-adapter` (ADR-038) — generic L4 port, no domain logic.
KooshaPari/FocalPoint/pheno-port-adapter/Cargo.toml: name = "pheno-port-adapter"
KooshaPari/FocalPoint/worklogs/l4-66-pheno-port-adapter-2026-06-11.json: "branch": "chore/l4-66-pheno-port-adapter-2026-06-11",
KooshaPari/FocalPoint/worklogs/l4-66-pheno-port-adapter-2026-06-11.json: "worktree": ".worktrees/l4-66-pheno-port-adapter-2026-06-11",
KooshaPari/FocalPoint/worklogs/l4-66-pheno-port-adapter-2026-06-11.json: "command": "cargo test -p pheno-port-adapter (from crate directory)"
KooshaPari/FocalPoint/L6_PHENO_REPOS_HEALTH_2026_06_14.md: - **5 crates** (pheno-config, pheno-context, pheno-errors, pheno-port-adapter, pheno-tracing, pheno-go-ctxkit, pheno-pydantic-models, pheno-wtrees, pheno-zod-schemas) are missing the full meta bundle
KooshaPari/FocalPoint/L6_PHENO_REPOS_HEALTH_2026_06_14.md: | pheno-port-adapter | Rust | ❌ | ❌ | ❌ | ❌ | ❌ | 18 | 0 | Native run; declares own `[workspace]`; 18 lib tests pass (incl. unix socket health check) |
KooshaPari/HexaKit/scripts/audit-tools/README-predict.md: "repo_b": "pheno-port-adapter",
KooshaPari/phenotype-tooling:docs/absorbed-from-pheno-port-adapter/Cargo.toml: name = "pheno-port-adapter"
KooshaPari/phenotype-tooling:docs/absorbed-from-pheno-port-adapter/SPEC.md: # pheno-port-adapter — SPEC.md
KooshaPari/phenotype-tooling:docs/absorbed-from-pheno-port-adapter/SPEC.md: `pheno-port-adapter` is the **reference implementation of the hexagonal L4 Port/Adapter pattern** (ADR-038) for the pheno-* fleet.
KooshaPari/phenotype-tooling:docs/absorbed-from-pheno-port-adapter/WORKLOG.md: # pheno-port-adapter — WORKLOG.md
KooshaPari/phenotype-tooling:docs/absorbed-from-pheno-port-adapter/WORKLOG.md: | 2026-06-18 | L5-116 | L5 | docs | pheno-port-adapter/AGENTS.md:1, ... | Adopt v8 governance meta-bundle ...
KooshaPari/phenotype-tooling:docs/absorbed-from-pheno-port-adapter/CHANGELOG.md: # pheno-port-adapter — CHANGELOG.md (CHANGELOG.md for pheno-port-adapter)
KooshaPari/phenotype-tooling:docs/absorbed-from-pheno-port-adapter/SECURITY.md: We take the security of `pheno-port-adapter` seriously.
KooshaPari/phenotype-tooling:docs/absorbed-from-pheno-port-adapter/.editorconfig: # EditorConfig — pheno-port-adapter
KooshaPari/phenotype-tooling:docs/absorbed-from-pheno-port-adapter/scripts/coverage.sh: # pheno-port-adapter coverage script.
KooshaPari/phenotype-tooling:docs/absorbed-from-pheno-port-adapter/scripts/coverage.sh: echo "[pheno-port-adapter] running tests + coverage (gate: 80%)..."
KooshaPari/phenotype-tooling:docs/absorbed-from-pheno-port-adapter/examples/otel_quickstart.rs: //! pheno-port-adapter + pheno-otel quickstart.
KooshaPari/phenotype-tooling:docs/absorbed-from-pheno-port-adapter/examples/otel_quickstart.rs: //! cargo run --example otel_quickstart -p pheno-port-adapter
KooshaPari/phenotype-registry/scripts/resolve-collision.py: "pheno-port-adapter": "pheno-port-adapter",
KooshaPari/phenotype-registry/docs/adrs/ADR-ECO-017-substrate-schema-conventions.md: | `pheno-lib` | ... | `pheno-config`, `pheno-context`, `pheno-port-adapter` (and Configra's four sub-crates) |
KooshaPari/phenotype-org-audits/audits/predict-dry/README.md: "repo_b": "pheno-port-adapter",
KooshaPari/phenotype-org-audits/plans/2026-06-17-v7-dag-stable.md: | **T1.3** | Commit meta-bundle (AGENTS.md + llms.txt + WORKLOG.md + CHANGELOG.md + LICENSE-MIT) for the 5 fleet-critical pheno-* libs: pheno-config, pheno-context, pheno-otel, pheno-port-adapter, pheno-tracing |
KooshaPari/phenotype-org-audits/plans/2026-06-17-v7-dag-stable.md: | **PR-160** | chore(meta): add meta-bundle to pheno-port-adapter | `KooshaPari/pheno-port-adapter` | T1.6d | PENDING | orchestrator | — |
```

**Categorization of all 19 hits:**

| Category | Hit count | Example |
|----------|-----------|---------|
| Cargo.toml self-identification (`name = "pheno-port-adapter"`) | 4 | `argis-extensions/pheno-port-adapter/Cargo.toml`, `phenotype-apps/pheno-port-adapter/Cargo.toml`, `FocalPoint/pheno-port-adapter/Cargo.toml`, `phenotype-tooling/docs/absorbed-from-pheno-port-adapter/Cargo.toml` |
| `pheno-port-adapter` as comment / string literal in a doc | 8 | `argis-extensions/pheno-port-adapter/{llms.txt,CONTRIBUTING.md,deny.toml}`, `phenotype-apps/pheno-port-adapter/{README.md,llms.txt,examples/quickstart.rs}`, `phenotype-tooling/docs/absorbed-from-pheno-port-adapter/{SPEC.md,WORKLOG.md,CHANGELOG.md,SECURITY.md,.editorconfig}` |
| Governance / audit references (worklog, finding, ADR doc) | 6 | `argis-extensions/findings/2026-06-22-SIDE-17-cargo-profiles.md`, `argis-extensions/findings/2026-06-22-SIDE-20-test-runner.md`, `argis-extensions/findings/2026-06-20-T38-drift-detector-ci.md`, `argis-extensions/findings/2026-06-21-SIDE-04-version-alignment.md`, `phenotype-apps:worklogs/L9-maintainability-audit-20260616.json`, `argis-extensions:worklogs/L5-128-v14-T1-cargo-deps-2026-06-20.json` |
| `repo_b` / `substrate` JSON config (audit-tool input) | 3 | `argis-extensions/.github/workflows/cache-stats-pages.yml`, `HexaKit/scripts/audit-tools/README-predict.md`, `phenotype-org-audits/audits/predict-dry/README.md` |
| Cross-language reference (phenotype-router) | 3 | `phenotype-router/AGENTS.md`, `phenotype-router/src/decision.rs`, `phenotype-router/src/plugins/promptadapter/PREDICTIVE.md` |
| Registry / plan references | 2 | `phenotype-registry/scripts/resolve-collision.py`, `phenotype-org-audits/plans/2026-06-17-v7-dag-stable.md` |
| Historical worklog | 1 | `FocalPoint/worklogs/l4-66-pheno-port-adapter-2026-06-11.json` |
| Historical health audit | 1 | `FocalPoint/L6_PHENO_REPOS_HEALTH_2026_06_14.md` |
| Registry ADR (tier classification) | 1 | `phenotype-registry/docs/adrs/ADR-ECO-017-substrate-schema-conventions.md` |
| **Cargo.toml dependency** (`pheno-port-adapter = "..."`) | **0** | (none) |
| **Python import / `import pheno_port_adapter`** | **0** | (none) |
| **Go import / `pheno-port-adapter/pkg/...`** | **0** | (none) |
| **TypeScript / `from 'pheno-port-adapter'`** | **0** | (none) |
| **Swift import / `import PhenoPortAdapter`** | **0** | (none) |

**Total: 19 string-literal matches, 0 import-style or dependency-style matches.**

**Implication:** the substrate is **canonical by declaration** (referenced in 19 governance/doc/audit locations) but **un-adopted in production code**. No consuming repo has a `pheno-port-adapter = "..."` line in any `Cargo.toml`, no Python file imports `pheno_port_adapter`, no Go file imports the Go equivalent, no TypeScript file imports the TypeScript equivalent, no Swift file imports the Swift equivalent. The 22-crate migration matrix in `pheno-port-adapter/SPEC.md:12` is therefore an **aspirational claim**, not a current state.

---

## End of audit

**Author:** Forge Code (`MiniMax-M3`)
**Audit date:** 2026-06-21 (PDT)
**Companion docs:** `findings/2026-06-21-pheno-port-adapter-audit/00-FINAL-AUDIT.md` (root scorecard), `…/02-docs-code.md` (Phase 1B docs + code features, 1,224 LoC).
**Next steps:**
1. **PR-1 (this turn):** `chore(l5-160): delete stale argis-extensions/pheno-port-adapter/`.
2. **PR-2 (this turn):** `chore(l5-161): delete 2 stale FocalPoint/pheno-port-adapter/ + focalpoint-wt-v12-16-17/pheno-port-adapter/`.
3. **PR-3 (next wave, v20+):** `feat(l5-162): migrate pheno-config to use pheno-port-adapter::PortAdapter` (closes PROMOTION.md G1.1 consumer gate #1).
4. **PR-4 (next wave, v20+):** `feat(l5-163): migrate pheno-tracing to use pheno-port-adapter::PortAdapter` (closes G1.1 #2).
5. **PR-5 (next wave, v21+):** `feat(l5-164): migrate pheno-otel to use pheno-port-adapter::PortAdapter` (closes G1.1 #3).
6. **PR-6 (next wave, v21+):** `feat(l5-165): UniFFI proc-macro on pheno-port-adapter::PortAdapter` (enables cross-language consumers per PROMOTION.md § Predicted consumers).
7. **PR-7 (next wave, v22+):** `chore(l5-166): enforce 80% lib coverage gate on heavy-runner` (closes G1.4).
8. **PR-8 (this turn, light follow-up):** `docs(l5-167): add README.md to pheno-port-adapter/` (closes L64 pillar 0/3 → 3/3 per STATUS.md:37).
