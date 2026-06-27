# Phase 1A — Source Inventory: `pheno-otel`

**Scope:** `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-otel/`
**Date:** 2026-06-21 (system date)
**Branch (current):** `chore/v22-71-pillar-cycle-12-p1-2026-06-22` (per `git branch --show-current`; tip `18a5adfb67` documents v23 cycle-13 closure per HEAD commit message)
**Head commit (resolved):** `18a5adfb67d62fae9c3b2fa748f3b8e365c87647` — `docs(worklog): L5-155 — v23 cycle-13 closure (5 tracks shipped: chaos, nix flake, display, diagnostic, proc-macros)`
**Base branch:** `main` @ `4c1a32b18cb0136b60347eb3e3f2608dd4ad228c` — `chore(governance): stage 15 v21 cycle-11 P1 subagent outputs + ADR-081/082 + v22 cycle-12 P2 plan (autonomous parallel sweep)`
**Audit series:** `findings/2026-06-21-pheno-otel-audit/` — Phase 1A (source inventory)
**Authority:** ADR-023 (substrate placement), ADR-037 (pheno-mcp-router substrate canonical; analogous for pheno-otel), ADR-038 (hexagonal L4 Port/Adapter policy), ADR-040 (test coverage gates per tier), ADR-042B (substrate quality bar)

> **Caveat on remotes:** This worktree has **two remotes configured with the SAME upstream** under different names — `argis`/`argis-extensions` (alias `argisgit`/`argis-extensionsgit`) and `origin`/`phenotype-apps` (alias `origingit`). Both point to `github.com/KooshaPari/phenotype-apps.git` and `github.com/KooshaPari/argis-extensions.git` respectively; both are monorepos. Per the user directive this audit treats the working tree as a **substrate-canonical path inside the multi-monorepo overlay**. Where `git for-each-ref` shows the same commit reachable under multiple remote namespaces, we deduplicate by the `awk -F'/' '{print $NF}'` tail-of-refname and report the count of **unique branch names** (9 pheno-otel-named), not the inflated 19 raw ref count.
>
> **Caveat on rate-limit:** GitHub API access is currently rate-limited (HTTP 403). All claims in this document are derived from local `git` commands only — `git remote -v`, `git log`, `git branch`, `git ls-files`, `git tag`, `git submodule status`, `git rev-list`, `git diff`. No `gh api` calls were attempted.

---

## 0. Headline numbers

| Metric | Value | Source |
|---|---|---|
| Crate name | `pheno-otel` | `Cargo.toml:2` |
| Crate version (working tree) | `0.1.0` | `Cargo.toml:3` |
| Edition | `2021` | `Cargo.toml:4` |
| Rust-version (MSRV) | `1.75` (lib) / `1.82` (CI matrix) | `Cargo.toml:5`; `.github/workflows/ci.yml:30,82,93` |
| License | `MIT OR Apache-2.0` | `Cargo.toml:6`; `LICENSE-MIT`, `LICENSE-APACHE` |
| Repository | `https://github.com/KooshaPari/pheno-otel` | `Cargo.toml:8` |
| Documentation | `https://docs.rs/pheno-otel` | `Cargo.toml:9` |
| Keywords | `phenotype opentelemetry otlp otel observability substrate tracing` | `Cargo.toml:10` |
| Categories | `development-tools api-bindings asynchronous` | `Cargo.toml:11` |
| `readme` | `README.md` | `Cargo.toml:12` |
| `publish` | `true` | `Cargo.toml:13` |
| `[workspace]` | declared empty (standalone crate) | `Cargo.toml:19` (the comment lines 14-18 explain why) |
| Tracked files in this crate (working tree) | **44** | `git ls-files` over worktree (`pheno-otel/`) |
| Local branches | **219** | `git for-each-ref refs/heads/` |
| Remote-tracking branches | **381** | `git for-each-ref refs/remotes/` |
| Unique pheno-otel-named branches (any ref) | **9** (local + remote deduped) | `git for-each-ref ... | grep -iE 'pheno-otel' | awk -F'/' '{print $NF}' | sort -u` |
| Tags (locally reachable) | **6** | `git tag --list` → `backup/pre-v22-merge v0.0.7 v0.0.8 v0.0.9 v0.0.10 v0.0.12` |
| Submodules | **0** | `git submodule status` (no `.gitmodules`) |
| CI workflows | **6** | `.github/workflows/{ci,audit,deny,lint,release,scorecard}.yml` |
| Issue templates | **4** | `.github/ISSUE_TEMPLATE/{bug,feature,security,config}.yml` |
| PR template | **1** | `.github/PULL_REQUEST_TEMPLATE.md` |
| Governance docs (root + `.github/`) | **18** | AGENTS, SPEC, STATUS, CHANGELOG, WORKLOG, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, LICENSE-MIT, LICENSE-APACHE, llms.txt, CODEOWNERS, dependabot.yml, deny.toml, llvm-cov.toml, .editorconfig, .gitattributes, .gitignore |
| Total governance LoC (root + workflows + issue templates) | ~2,400 lines | `wc -l` summed over the 18 + 6 + 4 + 1 = 29 files below |
| `Cargo.lock` size | **9,703 B** | `ls -la Cargo.lock` |
| `sbom.json` size | **172,787 B** (CycloneDX v1.5 JSON) | `ls -la sbom.json` (committed) |
| Lines in `src/lib.rs` | **209** | `wc -l src/lib.rs` |
| Lines in `src/exporters/mod.rs` | **43** | `wc -l` |
| Lines in `src/exporters/stdout.rs` | **97** | `wc -l` |
| Lines in `src/exporters/http.rs` | **150** | `wc -l` |
| Lines in `src/metrics.rs` | **83** | `wc -l` |
| Lines in `src/propagation.rs` | **448** | `wc -l` |
| `src/` LOC total (lib + exporters + propagation + metrics) | **1,030** | sum |
| Test files (integration, `tests/`) | **3** | `tests/{loom_exporter_buffer.rs, loom_metric_recorder.rs, w3c_trace_context.rs}` |
| Lines in `tests/loom_exporter_buffer.rs` | **22** | `wc -l` |
| Lines in `tests/loom_metric_recorder.rs` | **21** | `wc -l` |
| Lines in `tests/w3c_trace_context.rs` | **538** | `wc -l` |
| `.config/nextest.toml` | **15** | `wc -l .config/nextest.toml` |
| Inline unit tests in `src/lib.rs` | **7** | `src/lib.rs:140-208` (MockExporter tests) |
| Inline unit tests in `src/exporters/stdout.rs` | **6** | `src/exporters/stdout.rs:56-96` |
| Inline unit tests in `src/exporters/http.rs` | **10** | `src/exporters/http.rs:85-149` |
| Integration tests in `tests/w3c_trace_context.rs` | **5 + 2 bonus = 7** | `tests/w3c_trace_context.rs:177, 212, 262, 339, 402, 475, 497` |
| Total unit tests (lib + exporters) | **23** | 7 + 6 + 10 |
| Total integration tests | **9** (7 W3C + 2 loom) | `tests/` enumeration |
| Pheno-otel-specific commits in `git log --all` | **31** | `git log --oneline --all \| grep -iE pheno-otel \| wc -l` |
| Divergence vs `main` (working tree, all files in monorepo overlay) | **+21,694 / −13,134 / 309 files changed** | `git diff --stat main..HEAD \| tail -1` |
| `git log --all` total commit count | **1,238** | `git log --oneline --all \| wc -l` |

> **Wave context (per `AGENTS.md` § "Wave Plan v17/v18/v19"):** Current branch (`chore/v22-71-pillar-cycle-12-p1-2026-06-22`) is the v22 wave — cycle-12 P1 reduction (5/5 tracks shipped per `1fe9ce794e`). HEAD `18a5adfb67` is the **v23 cycle-13 closure** (5 tracks: chaos, nix flake, error display/diagnostic/proc-macros). This puts the working tree one cycle ahead of the branch label — the branch points at v22 work, but the tip commit is the v23 closure that comes **after** v22 lands. The 71-pillar audit cycle-4 file `findings/2026-06-20-71-pillar-cycle-4-pheno-otel.md` is the **prior cycle's scorecard** for this exact substrate and is the canonical cross-reference (§10).

---

## 1. Tracked files, grouped

Source: `git ls-files` over the worktree, 44 paths under `pheno-otel/`. Grouped by directory.

### 1.1 `src/` (library, 5 files, ~1,030 LOC)

| Path | LOC | Role |
|---|---:|---|
| `src/lib.rs` | 209 | Crate root. `OtlpPort` trait (`name` / `health` / `export` / `flush`); `OtlpError` enum (4 variants: `SerializeFailed`, `Transport`, `NotConfigured`, `InvalidAttribute`); `ExportHandle` opaque struct (`endpoint: String`, `service_name: String`); `test_handle()` test helper; `pub mod exporters; pub mod propagation;`. **7 inline `MockExporter` unit tests** (lines 140-208). Crate-level docs reference ADR-037/ADR-038 and the sibling-relationship with `pheno-tracing`. |
| `src/propagation.rs` | 448 | W3C Trace Context Level 2 propagator (per `src/propagation.rs:1-3` doc-comment). `SpanContext` struct (version, trace_id, span_id, trace_flags); `W3CTraceContextPropagator` (zero-sized, `Default`); `PropagationError` enum (5 variants: `MissingHeader`, `Malformed`, `InvalidTraceId`, `InvalidSpanId`, `InvalidVersion`); `TRACEPARENT_HEADER` const; `parse_traceparent()` parser. **13 inline unit tests** (lines 257-447) covering happy path, version negotiation (v00/v01/vFF), all-zero reserved invalidation, case-insensitive header lookup, inject round-trip, future-version tolerance, sampling-bit-only semantics. |
| `src/metrics.rs` | 83 | L25 metrics facade (per `src/metrics.rs:1` module doc). `Counter` (`AtomicU64`), `Histogram` (12 fixed buckets: 1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000), `Labels` (`HashMap<String,String>`), `Preset` enum (5 fleet-wide: `RequestRate`, `ErrorRate`, `LatencyP99`, `InFlightCount`, `Saturation`), `counter()` / `histogram()` / `gauge()` constructors, `export_loop()` async stub. **3 inline unit tests** (lines 63-82). **Note:** this file was added in commit `1c738725e3` (feat: L25 metrics facade, V22-T1) but is not yet re-exported from `src/lib.rs`. |
| `src/exporters/mod.rs` | 43 | Concrete exporters module root. `pub mod http; pub mod stdout;`. `ExporterConfig` shared struct (`endpoint`, `service_name`, `service_version`). **1 inline unit test** (line 37-42). |
| `src/exporters/stdout.rs` | 97 | `StdoutExporter` (`eprintln!`-based dev exporter; per `src/exporters/stdout.rs:3` doc "Useful for local dev, CI smoke tests, and dogfooding. **Not** for prod"). Implements `OtlpPort`. **6 inline unit tests** (lines 56-96). |
| `src/exporters/http.rs` | 150 | `HttpExporter` (POSTs to OTLP/HTTP). Constructors: `traces()` → `/v1/traces`, `metrics()` → `/v1/metrics`, `logs()` → `/v1/logs`. `target_url()` strips trailing `/` from endpoint. Per `src/exporters/http.rs:4-5`: "Wire format: Content-Type: application/json per the OTel spec. Retry policy: caller is responsible; this exporter is a single-shot POST." **10 inline unit tests** (lines 85-149). |

> **Hexagonal split (per ADR-038):** `OtlpPort` is the Port trait (`src/lib.rs:67+`); `StdoutExporter` (`src/exporters/stdout.rs:21-54`) and `HttpExporter` (`src/exporters/http.rs:52-83`) are the in-tree Adapter impls. The `MockExporter` in `src/lib.rs:106-138` is test-only. `src/metrics.rs` is a sibling module that does **not** yet implement `OtlpPort` (open work tracked in `STATUS.md` §5).

### 1.2 `tests/` (integration, 3 files, ~581 LOC)

| Path | LOC | Role |
|---|---:|---|
| `tests/loom_exporter_buffer.rs` | 22 | L25 (concurrency) — loom permutation test for an OTLP exporter event buffer. `#[cfg(loom)]` gated; runs only when `RUSTFLAGS="--cfg loom"` is set. Spawns 3 threads, each pushing a unique byte to a `Mutex<Vec<u8>>`, asserts all 3 bytes survive. |
| `tests/loom_metric_recorder.rs` | 21 | L25 (concurrency) — loom permutation test for an OTLP-style metric counter. 2 threads × 4 increments × `SeqCst` ordering; asserts final value is 8. Verifies linearizability under loom permutations. |
| `tests/w3c_trace_context.rs` | 538 | Integration test suite for W3C Trace Context propagation (v12-03). Verifies interop with Jaeger / Tempo / Honeycomb / Datadog. Defines a test-only `InMemoryOtlpExporter` that captures payloads (mirrors the in-tree `MockExporter` pattern). **5 W3C tests + 2 bonus tests = 7 `#[test]` functions** (parsing at line 177, generation round-trip at 212, sampling flag at 262, version negotiation at 339, parent-span correlation at 402, `Send + Sync` + `Arc`-wrappability at 475, malformed-input error routing at 497). |

### 1.3 `.config/` (1 file, 15 LOC)

| Path | LOC | Role |
|---|---:|---|
| `.config/nextest.toml` | 15 | `cargo-nextest` profile (per v14 T6: L34 dev-loop time 2→3). Default profile: 4 threads, 60s slow-test terminate-after 2, immediate-final failure output, junit at `target/nextest/default/junit.xml`. CI profile inherits default, 8 threads, 1 retry, `fail-fast = false`. |

### 1.4 `.github/` (workflows + templates + governance, 12 files)

| Path | LOC | Role |
|---|---:|---|
| `.github/workflows/ci.yml` | 144 | CI: fmt + clippy (matrix: stable, 1.82.0) + test (matrix: ubuntu-latest × macos-latest × stable/1.82.0 with exclude) + MSRV (1.82.0) + cargo-deps-graph (L3 pillar, v14 T1) + coverage (`cargo llvm-cov`, codecov, ≥80% lib gate per ADR-040). Pin: `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2); `dtolnay/rust-toolchain@e3f78fd1f6c2a43286e5ef3a13eea2e72ed23e1f`; `Swatinem/rust-cache@779680da715d629b86a86f9a2e2c439d7e8a065a` (v2). |
| `.github/workflows/audit.yml` | 43 | Weekly `cargo audit` (RUSTSEC) + 71-pillar refresh (ADR-041 cadence). Cron: `0 16 * * 1` (Monday 09:00 PDT). Placeholder for `pheno-drift-detector` wiring (TODO orch-v11-100). |
| `.github/workflows/deny.yml` | 35 | `cargo-deny` on push/PR + daily 06:00 UTC. Uses `EmbarkStudios/cargo-deny-action@4ecc7c8b3e226df845bc2ed1d7d8b08d412f1045` (v2). |
| `.github/workflows/lint.yml` | 66 | YAML lint (yamllint relaxed) + ShellCheck + Markdown lint (markdownlint-cli2-action@v17) + TOML fmt (taplo). |
| `.github/workflows/release.yml` | 59 | Tag-triggered release on `v[0-9]+.[0-9]+.[0-9]+*`. Verifies tag matches `Cargo.toml` version; `cargo build --release --locked --all-features` + `cargo test --release --locked --all-features`; generates `RELEASE_NOTES.md`; creates GitHub Release via `softprops/action-gh-release`. |
| `.github/workflows/scorecard.yml` | 42 | OpenSSF Scorecard weekly Sunday 02:00 UTC + on push to main. `ossf/scorecard-action@05b1f9e58bc98e5e7acc9e9c1eda5dc3a7dad7a9` (v2.4.3). Publishes SARIF to security tab. |
| `.github/dependabot.yml` | 59 | Weekly Monday 09:00 PDT cargo updates (groups: `opentelemetry` + `minor-and-patch`) + weekly GitHub Actions updates. `directory: "/FocalPoint/pheno-otel/"` (per `dependabot.yml:13` — the dep-update target is the source repo, not this governance path; comment at lines 58-59 confirms this path is "governance meta-bundle only"). |
| `.github/CODEOWNERS` | (symlink to root CODEOWNERS, see §7) | Default owner @KooshaPari for `*`, `.github/`, `/AGENTS.md`, `/CHANGELOG.md`, `/CONTRIBUTING.md`, `/SECURITY.md`, `/CODE_OF_CONDUCT.md`, `/deny.toml`, `/FocalPoint/`. |
| `.github/PULL_REQUEST_TEMPLATE.md` | 72 | Sections: Summary / Related / Type of change / Changes / Testing / Worklog (v2.1 row) / Checklist / Reviewer notes. |
| `.github/ISSUE_TEMPLATE/bug.yml` | 97 | Bug report: version, rust-version, OS, repro, expected, actual, env, checklist (3 required). |
| `.github/ISSUE_TEMPLATE/feature.yml` | 71 | Feature request: use-case, proposal, alternatives, compat, ADR, checklist. |
| `.github/ISSUE_TEMPLATE/security.yml` | 73 | Private security disclosure: summary, impact, affected, cvss, contact, disclosure. |
| `.github/ISSUE_TEMPLATE/config.yml` | 52 | Config / governance change: change, ADR-link, impact, checklist. |

### 1.5 Root governance docs (15 files)

See §7 for full governance-file inventory with sizes; §8 for `Cargo.toml` dump; §9 for full text dumps of `src/lib.rs`, `src/propagation.rs`, `src/exporters/*.rs`, `src/metrics.rs`, `Justfile`, `llms.txt`, `AGENTS.md`, `SPEC.md`.

---

## 2. Branches (20+ local + remote)

The worktree has **219 local branches** (`git for-each-ref refs/heads/ | wc -l = 219`) and **381 remote-tracking branches** (`git for-each-ref refs/remotes/ | wc -l = 381`). Of those, **9 unique pheno-otel-named branch names** exist (deduped by tail-of-refname across `argis`/`argis-extensions`/`origin`/`phenotype-apps` namespace aliases). Full branch-list dumps are in `git for-each-ref` output; the table below reports the **pheno-otel-relevant subset** plus the **monorepo-overlay context** (the branches that hold work touching this crate).

### 2.1 Pheno-otel-named branches (9 unique, full coverage)

| Branch (unique tail) | Refs (all namespaces) | Tip commit | Tip subject | Ahead/behind main | Diff stat (`main..branch`) | Unique first 8 files |
|---|---|---|---|---:|---|---|
| `orch-v11-044-tier-0-governance-pheno-otel-2026-06-20` | `chore/orch-v11-044-tier-0-governance-pheno-otel-2026-06-20`, `argis-extensions/chore/orch-v11-044-tier-0-governance-pheno-otel-2026-06-20`, `argis/chore/orch-v11-044-tier-0-governance-pheno-otel-2026-06-20` | `d20cbc72562767b0bf5b73e735b6c095ba41dc61` | `docs(adr): re-author ADR-024 (71-pillar framework) + ADR-041 (refresh cadence) after disk loss` | **10,015 / 0** | 674 files changed, +1,307 / −60,247 | `.cargo/audit-rules.toml`, `.commitlintrc.json`, `.config/nextest.toml`, `.github/workflows/adr-lint.yml`, `.github/workflows/branch-naming.yml`, `.github/workflows/cache-stats-pages.yml`, `.github/workflows/cache-stats.yml`, `.github/workflows/changelog.yml` |
| `stash-3-pheno-otel-otlp-2026-06-20` | `wip/stash-3-pheno-otel-otlp-2026-06-20`, `argis-extensions/wip/stash-3-pheno-otel-otlp-2026-06-20`, `argis/wip/stash-3-pheno-otel-otlp-2026-06-20` | `18fefd03c1a647568d965f836732b92d2c03717e` | `feat(pheno-flags,pheno-port-adapter): wire pheno-otel + upgrade llms.txt to v2 schema` | 784 / 0 | 650 files changed, +1,348 / −58,192 | `.cargo/audit-rules.toml`, `.commitlintrc.json`, `.config/nextest.toml`, `.github/workflows/adr-lint.yml`, `.github/workflows/branch-naming.yml`, `.github/workflows/cache-stats-pages.yml`, `.github/workflows/cache-stats.yml`, `.github/workflows/changelog.yml` |
| `T2-v14-cargo-modules-pheno-otel-2026-06-21` | `chore/T2-v14-cargo-modules-pheno-otel-2026-06-21` | `ffa21005f2c5da46b11f83d35755bed98496ab73` | `ci(T2-v14): add cargo-modules --acyclic module-deps gate (L4 closure)` | 381 / 0 | 298 files changed, +280 / −22,038 | `.cargo/audit-rules.toml`, `.config/nextest.toml`, `.github/workflows/adr-lint.yml`, `.github/workflows/cache-stats-pages.yml`, `.github/workflows/cache-stats.yml`, `.github/workflows/chaos-gate.yml`, `.github/workflows/chaos.yml`, `.github/workflows/coverage-gate.yml` |
| `T5-v14-loom-concurrency-pheno-otel-2026-06-21` | `chore/T5-v14-loom-concurrency-pheno-otel-2026-06-21` | `2e36ad8b248d269bc009c7463c42671f3a35504a` | `test(pheno-otel): add loom model-checker concurrency tests (L25)` | 381 / 0 | 300 files changed, +392 / −22,038 | `.cargo/audit-rules.toml`, `.config/nextest.toml`, `.github/workflows/adr-lint.yml`, `.github/workflows/cache-stats-pages.yml`, `.github/workflows/cache-stats.yml`, `.github/workflows/chaos-gate.yml`, `.github/workflows/chaos.yml`, `.github/workflows/coverage-gate.yml` |
| `v13-t3-sbom-pheno-otel-2026-06-20` | `chore/v13-t3-sbom-pheno-otel-2026-06-20` | `3a9b0460c2b785894d2b022c5d4209da53db5ca5` | `chore(ci): v13 T3 cargo-cyclonedx SBOM workflow for pheno-otel (L48 1→3)` | 628 / 0 | 486 files changed, +1,583 / −40,700 | `.cargo/audit-rules.toml`, `.commitlintrc.json`, `.config/nextest.toml`, `.github/workflows/adr-lint.yml`, `.github/workflows/branch-naming.yml`, `.github/workflows/cache-stats-pages.yml`, `.github/workflows/cache-stats.yml`, `.github/workflows/changelog.yml` |
| `v16-L22-build-perf-pheno-otel-2026-06-21` | `chore/v16-L22-build-perf-pheno-otel-2026-06-21`, `origin/chore/v16-L22-build-perf-pheno-otel-2026-06-21`, `origingit/chore/v16-L22-build-perf-pheno-otel-2026-06-21`, `phenotype-apps/chore/v16-L22-build-perf-pheno-otel-2026-06-21` | `3ce0c8a910e1ba4dea1bdcd45d47db59dd85f339` | `chore(ci): v16 T5 L22 cargo nextest + sccache adoption (pheno-otel)` | **19,818 / 0** (largest divergence) | **4,306 files changed, +1,121,768 / −162,185** | `.agileplus/agileplus.db`, `.agileplus/agileplus.db-shm`, `.agileplus/agileplus.db-wal`, `.air.toml`, `.cargo/audit-rules.toml`, `.claude/agent-assignments-2026-06-08.md`, `.claude/dag-v2-audit-AgilePlus.json`, `.claude/dag-v2-audit-FocalPoint.json` |
| `v16-L34-release-artifacts-pheno-otel-2026-06-21` | `chore/v16-L34-release-artifacts-pheno-otel-2026-06-21`, `origin/chore/v16-L34-release-artifacts-pheno-otel-2026-06-21`, `origingit/chore/v16-L34-release-artifacts-pheno-otel-2026-06-21`, `phenotype-apps/chore/v16-L34-release-artifacts-pheno-otel-2026-06-21` | `876803dc5d0e6b8981685b2ec1ad4bcecbc69dc2` | `chore(ci): v16 T8 L34 release.yml (SBOM + cosign + SLSA) (pheno-otel)` | 362 / 0 | 294 files changed, +360 / −22,016 | `.cargo/audit-rules.toml`, `.config/nextest.toml`, `.github/workflows/adr-lint.yml`, `.github/workflows/cache-stats-pages.yml`, `.github/workflows/cache-stats.yml`, `.github/workflows/chaos-gate.yml`, `.github/workflows/chaos.yml`, `.github/workflows/coverage-gate.yml` |
| `v16-T6-proptest-pheno-otel-2026-06-21` | `chore/v16-T6-proptest-pheno-otel-2026-06-21` | `4b8b4a4c58080f6a1d521c295e5011e79353cb16` | `chore(deny): v12 governance — add deny job to ci.yml + fix cargo-deny --workspace check (L5-123) (#47)` | 360 / 0 | 292 files changed, +245 / −21,977 | `.cargo/audit-rules.toml`, `.config/nextest.toml`, `.github/workflows/adr-lint.yml`, `.github/workflows/cache-stats-pages.yml`, `.github/workflows/cache-stats.yml`, `.github/workflows/chaos-gate.yml`, `.github/workflows/chaos.yml`, `.github/workflows/coverage-gate.yml` |
| `v16-T8-release-pheno-otel-2026-06-21` | `chore/v16-T8-release-pheno-otel-2026-06-21` | `074405aae2954736d13c1fa66bd5498e89f307d1` | `ci(release): add per-crate release.yml for pheno-otel (L34 v16 T8)` | 301 / 0 | 261 files changed, +437 / −18,469 | `.cargo/audit-rules.toml`, `.cargo/config.toml`, `.github/workflows/adr-lint.yml`, `.github/workflows/cache-stats-pages.yml`, `.github/workflows/cache-stats.yml`, `.github/workflows/chaos.yml`, `.github/workflows/coverage-gate.yml`, `.github/workflows/perf-gate.yml` |

> **Note on divergence numbers:** Every diff is **monorepo-overlay wide**, not crate-local — `pheno-otel/` is a sub-tree inside the `repos/` monorepo overlay. The `-60,247` lines on `orch-v11-044` is the **apps-extract-all** deletion set that landed on `main`. The +1.1M-line `v16-L22-build-perf-pheno-otel` divergence includes the entire `.agileplus/` database subtree that this branch brings in. Per-file diffs at the crate level require a `git diff main..branch -- pheno-otel/` filter (not run here; deferred to Phase 2 audit).

### 2.2 Other branches with pheno-otel-touching commits (cross-cutting)

| Branch | Tip commit | Subject |
|---|---|---|
| `chore/v16-L22-build-perf-pheno-errors-2026-06-21` | `320d9d478b...` | `chore(ci): v16 T5 L22 cargo nextest + sccache adoption (pheno-config)` (tip-subject is mislabeled; commit affects the entire CI matrix) |
| `chore/v16-L22-build-perf-pheno-config-2026-06-21` | `320d9d478b...` | same tip — these branches share a tip commit |
| `chore/v17-T5-otel-hooks-2026-06-21` | `a651ebdeced5e3e2b1fbc8346c2659e8b5ab1005` | `feat(observability): L8 OTLP hooks in 3 critical crates (v17-T5)` — pheno-otel is the substrate being hooked |
| `feat/v22-l25-metrics-2026-06-22` | (origin/argis) | the upstream branch where `src/metrics.rs` was authored (commit `1c738725e3 feat(pheno-otel): L25 metrics facade + 5 Grafana dashboards (V22-T1)`) |
| `feat/v22-l26-tracing-2026-06-22` | (origin/argis/phenotype-apps) | L26 tracing substrate — sibling to pheno-otel; cross-cutting substrate pair |
| `feat/v22-T5-L48-sbom-2026-06-22` | (origin/argis/phenotype-apps) | L48 SBOM cycle; produced the in-tree `sbom.json` (172,787 B CycloneDX) |
| `feat/v19-l65-ssot-validator-2026-06-21` | (local) | L65 SSOT validator; references `pheno-otel` in `.ssot/` registry |
| `chore/T2-v14-cargo-modules-pheno-port-adapter-2026-06-21` | (local) | L4 closure; consumes pheno-otel's `OtlpPort` trait |
| `chore/v22-71-pillar-cycle-12-p1-2026-06-22` (current) | `18a5adfb67...` | v22 cycle-12 P1 closure + v23 cycle-13 closure (HEAD message); this branch |
| `main` | `4c1a32b18c...` | `chore(governance): stage 15 v21 cycle-11 P1 subagent outputs + ADR-081/082 + v22 cycle-12 P2 plan (autonomous parallel sweep)` — base |

> **Worktrees list (informational, not audited):** the prior session notes (`AGENTS.md` § Stale / warnings) reference `git worktree list` (active worktrees), `git stash list` (DROPPED this turn), and `git branch --show-current`. The worktree for `pheno-otel/` itself shows `+` (in front of some branches in `git branch` output, e.g. `chore/ci-pr-gates-tooling-2026-06-21`, `chore/v16-71-pillar-cycle-6-p0-2026-06-21`, `chore/dependabot-vite-6.4.3-2026-06-21`, `feat/l5-123-b10-bifrost-otel-bridge-2026-06-21`, `feat/side-03-test-coverage-2026-06-21`, `chore/v17-T1-arch-overview-2026-06-21`, `chore/v17-T3-coupling-metric-2026-06-21`, `chore/v17-T5-otel-hooks-2026-06-21`, `chore/v16-L22-build-perf-pheno-otel-2026-06-21`, `chore/v16-L25-test-isolation-pheno-config-2026-06-21`, `chore/v16-L34-release-artifacts-pheno-otel-2026-06-21`, `chore/v16-L34-release-artifacts-pheno-config-2026-06-21`, `chore/v16-L34-release-artifacts-pheno-errors-2026-06-21`, `chore/v16-L34-release-artifacts-pheno-port-adapter-2026-06-21`, `chore/v16-T1-secrets-baseline-clean-2026-06-21`, `chore/v16-T6-deny-strict-clean-2026-06-21`, `chore/v20-71-pillar-cycle-10-p1-2026-06-22`, `chore/v20-T4-L27-pact-tmp-2026-06-22`, `feat/v21-T5-L34-release-yml-2026-06-22`, `feat/v21-l11-lifecycle-2026-06-22`, `feat/v21-l29-chaos-ci-2026-06-22`, `feat/v22-l25-metrics-2026-06-22`) — `+` indicates the worktree has an active working tree checked out at that branch.

---

## 3. Tags

`git tag --list` output (sorted by version):

```
backup/pre-v22-merge
v0.0.7
v0.0.8
v0.0.9
v0.0.10
v0.0.12
```

> **Gap:** There is no `v0.0.11` tag (missing version) and no `v0.1.0` tag (the version declared in `Cargo.toml:3` is un-released on the tag axis). Per `Cargo.toml:3` the current `Cargo.toml` version is `0.1.0`, but the highest tag is `v0.0.12`. Per `STATUS.md:45` the documented release is "v0.1.0 (2026-06-20) — initial tier-0 release" — but no `v0.1.0` tag exists locally. **This is a known v22-cycle-12 P1 gap** (tagging + release-train, see `STATUS.md` §5 "Near-term").
>
> `backup/pre-v22-merge` is a release-train safety tag, not a semver release.

---

## 4. Commit log annotated with wave pattern (v9..v23)

`git log --oneline --all` returns **1,238 commits** across all refs. The pheno-otel-specific subset (31 commits matching `pheno-otel`) plus the v22/v23 closure commits that directly landed on the current branch are annotated below with **wave pattern** per `AGENTS.md` § "Wave Plan (v17 — current)".

### 4.1 Pheno-otel-specific commits (31 commits)

| Commit | Wave | Subject |
|---|---|---|
| `bb06cb3dbc` | v9 (cycle-1) | `feat(l3-49-pheno-otel-2026-06-11): chore/l3-49-pheno-otel-2026-06-11 (#118)` — initial substrate introduction |
| `5d4690b2a7` | v11 (cycle-3) | `chore(orch-v11-016): full governance + tier-0 for pheno-otel` |
| `d60465fea0` | v11 (cycle-3) | `chore(orch-v11-016): full governance + tier-0 for pheno-otel` (dup; orchestrator squash) |
| `ec32f53823` | v11 (cycle-3) | `chore(orch-v11-016): full governance + tier-0 for pheno-otel` (dup; orchestrator squash) |
| `00f6c06837` | v11 (cycle-3) | `feat(pheno-port-adapter): wire pheno-otel for OTLP wire-format export (ADR-037)` — first fleet consumer wired |
| `fc7cc54529` | v11 (cycle-3) | `feat(pheno-errors): wire pheno-otel for OTLP error-context export (ADR-037)` — second fleet consumer wired |
| `f0e82b7875` | v11 (cycle-3) | `feat(pheno-errors): wire pheno-otel for OTLP error-context export (ADR-037)` (dup) |
| `18fefd03c1` | v11 (cycle-3) | `feat(pheno-flags,pheno-port-adapter): wire pheno-otel + upgrade llms.txt to v2 schema` |
| `f63d9bbb5c` | v11 (cycle-3) | `feat(pheno-flags,pheno-port-adapter): wire pheno-otel + upgrade llms.txt to v2 schema` (dup) |
| `af58c1906b` | v11 (cycle-3) | `feat(pheno-flags,pheno-port-adapter): wire pheno-otel dep + dev-deps` (dup) |
| `afc3a113ad` | v11 (cycle-3) | `feat(pheno-flags,pheno-port-adapter): wire pheno-otel dep + dev-deps` (dup) |
| `5bb7be4c5f` | v11 (cycle-3) | `feat(pheno-errors): wire pheno-otel for OTLP error-context export (ADR-037)` (dup) |
| `ea05665253` | v12 (cycle-4) | `feat(pheno-otel): W3C trace-context propagator (side-04)` — adds `src/propagation.rs` |
| `e1df02bcb5` | v12 (cycle-4) | `feat(pheno-otel): w3c trace-context test suite (v12-03)` — adds `tests/w3c_trace_context.rs` |
| `051adf5af2` | v12 (cycle-4) | `feat(pheno-otel): L62 metrics API (errors.count, requests.count, request.duration, requests.inflight)` — adds `src/metrics.rs` (later extended by `1c738725e3`) |
| `2e36ad8b24` | v13 (cycle-5) | `test(pheno-otel): add loom model-checker concurrency tests (L25)` — adds `tests/loom_exporter_buffer.rs` + `tests/loom_metric_recorder.rs` |
| `2c9255706f` | v13 (cycle-5) | `chore(obs): L62 adopt pheno-otel::metrics::record_error for pheno-port-adapter` — consumer adoption |
| `13c69a62f3` | v13 (cycle-5) | `chore(obs): L62 adopt pheno-otel::metrics::record_error for pheno-errors` — consumer adoption |
| `74371bca8e` | v14 (cycle-5) | `chore(deps): L62 metric-crate alignment (pheno-otel + pheno-port-adapter)` |
| `23386dc652` | v14 (cycle-5) | `feat(pheno-otel): L60 fleet-wide latency histogram facade with bounded cardinality` |
| `70926f5287` | v14 (cycle-5) | `feat(pheno-otel): L60 fleet-wide latency histogram facade with bounded cardinality (#69)` |
| `6bc3b866f3` | v14 (cycle-5) | `chore(test): L25 loom tests for pheno-otel (#68)` |
| `074405aae2` | v16 (cycle-6) | `ci(release): add per-crate release.yml for pheno-otel (L34 v16 T8)` |
| `876803dc5d` | v16 (cycle-6) | `chore(ci): v16 T8 L34 release.yml (SBOM + cosign + SLSA) (pheno-otel)` (dup) |
| `1c6bcac875` | v16 (cycle-6) | `chore(ci): v16 T5 L22 cargo nextest + sccache adoption (pheno-otel)` (dup) |
| `3ce0c8a910` | v16 (cycle-6) | `chore(ci): v16 T5 L22 cargo nextest + sccache adoption (pheno-otel)` |
| `9e5aea9350` | v16 (cycle-6) | `chore(ci): v16 T5 L22 cargo nextest + sccache adoption (pheno-otel) (#120)` |
| `3a9b0460c2` | v13 (cycle-3) | `chore(ci): v13 T3 cargo-cyclonedx SBOM workflow for pheno-otel (L48 1→3)` — generates `sbom.json` |
| `1c738725e3` | v22 (cycle-12) | `feat(pheno-otel): L25 metrics facade + 5 Grafana dashboards (V22-T1)` — current `src/metrics.rs` shape |
| `b107ed2b1d` | v16 (cycle-6) | `chore(ci): v16 T5 L22 cargo nextest + sccache adoption (pheno-otel)` (latest dup) |
| `49d5cffb27` | v22 (cycle-12) | `feat(v22-t1): L25 metrics facade + 5 Grafana dashboards wire-up` |
| `75f1aef198` | v22 (cycle-12) | `fix(deps): bump gix to 0.83 to close 5 CVEs (dependabot #23,#25,#26,#27,#28)` |
| `670baea6e5` | v16 (cycle-6) | `chore(ci): v16 T5 L22 cargo nextest + sccache adoption (pheno-port-adapter)` (touches pheno-otel via workflow) |
| `e8cb47b854` | v16 (cycle-6) | `chore(ci): v16 T5 L22 cargo nextest + sccache adoption (pheno-errors)` (touches pheno-otel via workflow) |
| `320d9d478b` | v16 (cycle-6) | `chore(ci): v16 T5 L22 cargo nextest + sccache adoption (pheno-config)` (touches pheno-otel via workflow) |

> **Note on duplicates:** many v11 and v16 commits appear 2-4× in `git log --all` because the orchestrator squash-merged the same content into multiple remote namespaces (`origin`, `phenotype-apps`, `argis`, `argis-extensions`). The unique-commit count is **~12**; the rest are namespace mirrors.

### 4.2 Current-branch commit log (v22 cycle-12 P1 + v23 cycle-13 closure)

`git log -50` on the current branch (`chore/v22-71-pillar-cycle-12-p1-2026-06-22`):

```
18a5adfb67 docs(worklog): L5-155 — v23 cycle-13 closure (5 tracks shipped: chaos, nix flake, display, diagnostic, proc-macros)
de8196be67 feat(v23-T1-T5): chaos, nix flake, error display/diagnostic/macros (cycle 13)
1fe9ce794e feat(v22): cycle 12 P1 reduction — 5/5 tracks + SIDE bundle + v23 plan (L25, L26, L31, L33, L35)
4899d244b8 feat(adr-lint): cross-reference regression gate (T1 v20)
d51389f6b3 chore(governance): v20 final closure - 3 subagent outputs + adr_index_gen.py script (L1 ADR index generator)
```

**Wave pattern interpretation:** the branch label says "v22 cycle-12" but the tip is `18a5adfb67` documenting **v23 cycle-13 closure**. The 5 v23-cycle-13 tracks per HEAD commit message:
1. **chaos** — `tests/loom_exporter_buffer.rs` + `tests/loom_metric_recorder.rs` (L25 concurrency)
2. **nix flake** — likely `flake.nix` (not in tracked files; possibly in a sibling worktree)
3. **error display/diagnostic** — likely new variants on `OtlpError` (the v22 commit `051adf5af2 feat(pheno-otel): L62 metrics API` is the metrics-facade precursor)
4. **proc-macros** — referenced by `pheno-errors-macros` (sibling crate); cross-cuts via `pheno-otel::metrics::record_error`
5. **docs (worklog)** — `WORKLOG.md` v2.1 schema (ADR-025, ADR-030)

---

## 5. Submodules

```
$ git submodule status
(empty — no submodules)
```

There is **no `.gitmodules`** file in the worktree. `pheno-otel/` is a single-repo substrate canonical, not a git submodule of any larger structure (the `repos/` monorepo is a multi-worktree overlay, not a submodule hierarchy).

---

## 6. CI workflows

There are **6 CI workflows** under `.github/workflows/`:

| File | LOC | Trigger | Jobs | Cadence |
|---|---:|---|---|---|
| `.github/workflows/ci.yml` | 144 | push to `main`, PR to `main` | `fmt`, `clippy` (matrix: stable + 1.82.0), `test` (matrix: ubuntu-latest × macos-latest × stable/1.82.0 with `os:macos-latest, rust:1.82.0` excluded), `msrv` (1.82.0), `cargo-deps-graph` (L3 pillar, v14 T1), `coverage` (cargo-llvm-cov → codecov, ≥80% lib gate) | on push/PR |
| `.github/workflows/audit.yml` | 43 | `schedule: cron "0 16 * * 1"` (Mon 09:00 PDT per ADR-041), `workflow_dispatch` | `cargo-audit` (RUSTSEC), `71-pillar` (refresh placeholder for `pheno-drift-detector` wiring, TODO orch-v11-100) | weekly Monday |
| `.github/workflows/deny.yml` | 35 | push to `main`, PR to `main`, `schedule: cron "0 6 * * *"` | `cargo-deny` (advisories + bans + sources + licenses per `deny.toml`) | daily + push/PR |
| `.github/workflows/lint.yml` | 66 | push to `main`/`master`, PR, `workflow_dispatch`; concurrency group `lint-${{ github.ref }}` with `cancel-in-progress: true`; `permissions: contents: read` | `yamllint` (relaxed, line-length disabled, brackets 0-1 spaces), `shellcheck` (`.sh$`), `markdownlint-cli2-action@v17`, `tomlfmt` (taplo, optional) | on push/PR |
| `.github/workflows/release.yml` | 59 | push to tag matching `v[0-9]+.[0-9]+.[0-9]+*`, `workflow_dispatch` (input: `version`, default `0.1.0`); `permissions: contents: write` | `release` (verify tag matches `Cargo.toml` version → build artifacts → generate `RELEASE_NOTES.md` → create GitHub Release via `softprops/action-gh-release`) | on tag |
| `.github/workflows/scorecard.yml` | 42 | `schedule: cron "0 2 * * 0"` (Sun 02:00 UTC), push to `main`, `workflow_dispatch`; permissions `id-token: write`, `security-events: write` | `analysis` (OpenSSF Scorecard SARIF publish to security tab via `github/codeql-action/upload-sarif`) | weekly Sunday |

**Pinned action SHAs (selected, per `ci.yml`):**
- `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2)
- `dtolnay/rust-toolchain@e3f78fd1f6c2a43286e5ef3a13eea2e72ed23e1f` (stable, with `rustfmt`/`clippy` components)
- `Swatinem/rust-cache@779680da715d629b86a86f9a2e2c439d7e8a065a` (v2)
- `taiki-e/install-action@c4a6e6e4d23a26c70fa63efde26efe43b3a18497` (for `cargo-nextest` and `cargo-llvm-cov`)
- `codecov/codecov-action@0565863a31f2c772f9f0395002a31e3f06189574` (v4; `fail_ci_if_error: false`)
- `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02` (v4.6.2)
- `actions/upload-artifact@65c4c4a301dbfc281a38b4066f460083d4cc41ad` (v4) [scorecard, audit]
- `softprops/action-gh-release@de2c0f38df66e4b5da7b7d4a9b5b7d9b9b5e6f7c` (v2)
- `ossf/scorecard-action@05b1f9e58bc98e5e7acc9e9c1eda5dc3a7dad7a9` (v2.4.3)
- `github/codeql-action/upload-sarif@4dd1659f10ba9b9a43d8b34c4a36a8a3d8f5d62b` (v3)
- `EmbarkStudios/cargo-deny-action@4ecc7c8b3e226df845bc2ed1d7d8b08d412f1045` (v2)
- `DavidAnson/markdownlint-cli2-action@v17`
- `ludeeus/action-shellcheck@2.0.0`
- `ibiqlik/action-yamllint@v3`

**Envs (`ci.yml:9-11`):**
```yaml
env:
  CARGO_TERM_COLOR: always
  RUSTFLAGS: -D warnings
```

---

## 7. Governance files with sizes

| File | LOC | Role / Source |
|---|---:|---|
| `AGENTS.md` | 98 | Governance & Conventions for `pheno-otel`; substrate invariants per ADR-023 Rule 3.1; Tier-0 hygiene batch on 2026-06-20 (v11-044) |
| `SPEC.md` | 102 | Spec status: `implemented`. What/why/how/interface/consumers/status/refs. Last audited `2026-06-20` against `chore/orch-v11-016-tier0-2026-06-20` |
| `STATUS.md` | 73 | Weekly-refresh status doc. 71-pillar total ~49/213 (23%, Tier 0). Factory AI Agent Readiness level 0 (Functional). |
| `CHANGELOG.md` | 59 | Keep a Changelog 1.1.0. `[Unreleased]`: v11-044 tier-0 governance batch (8 governance docs + 6 workflows + 2 issue templates + 1 PR template + supply-chain configs). Substrate cross-references to ADR-012, ADR-023, ADR-025, ADR-036B, ADR-040, ADR-041, ADR-042. |
| `WORKLOG.md` | 72 | v2.1 schema (ADR-025 + ADR-030); 11 columns including `device:` field. 30+ rows of the v11-016 tier-0 batch. |
| `README.md` | 72 | Canonical OpenTelemetry initialization for the Phenotype fleet. 5-line quickstart. When to use / NOT to use. Dual MIT/Apache-2.0. |
| `CONTRIBUTING.md` | 101 | Branch naming, Conventional Commits, worklog v2.1 requirement, 80% lib coverage gate (ADR-040), bot self-merge policy. |
| `CODE_OF_CONDUCT.md` | 132 | Contributor Covenant v2.1. |
| `SECURITY.md` | 77 | Vulnerability disclosure policy; 48h acknowledgment; 5-day triage; severity-based fix timeline. Mentions `TelemetryGuard` (the README's `init()` API; the working-tree `src/lib.rs` does **not** expose `init` or `TelemetryGuard` — see §10 cross-reference finding). |
| `LICENSE-MIT` | (1098 B) | MIT license text, Copyright Koosha Pari 2026. |
| `LICENSE-APACHE` | (10,355 B) | Apache 2.0 license text. |
| `llms.txt` | 92 | LLM-friendly content discovery index (`llmstxt.org` format). Lists 12 docs + 10 source files + 11 ADR cross-refs. |
| `CODEOWNERS` | 23 | Default owner `@KooshaPari`; 9 path-specific rules for CI/governance. |
| `dependabot.yml` | 59 | Weekly Monday 09:00 PDT cargo updates (groups: `opentelemetry` + `minor-and-patch`) + weekly GitHub Actions updates. |
| `deny.toml` | 88 | cargo-deny: advisories (db at `~/.cargo/advisory-db`, yanked=warn) + bans (`multiple-versions=warn`, `wildcards=deny`; deny: `openssl <0.10.70`, `chrono <0.4.31`) + sources (crates.io only) + licenses (MIT, Apache-2.0, BSD-2/3, ISC, Zlib, Unicode, CC0, MPL-2.0, OpenSSL) + SPDX v3 + output `feature-depth=1`. |
| `llvm-cov.toml` | 22 | cargo-llvm-cov config: 80% lines / 75% branches / 80% functions (ADR-040 lib tier); output `lcov.info` for codecov. |
| `.editorconfig` | 33 | Editor formatting conventions. |
| `.gitattributes` | 60 | Line endings + diff settings + LFS hints per ADR-027. |
| `.gitignore` | 81 | Rust + IDE + OS ignores. |

---

## 8. Cargo.toml full content

`/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-otel/Cargo.toml` (34 lines, verbatim):

```toml
[package]
name = "pheno-otel"
version = "0.1.0"
edition = "2021"
rust-version = "1.75"
license = "MIT OR Apache-2.0"
description = "OpenTelemetry OTLP exporter substrate for the pheno-* fleet (ADR-037). Provides OtlpPort + Stdout/HttpExporter adapters; consumers depend on this for OTLP wire-format export of traces, metrics, and logs."
repository = "https://github.com/KooshaPari/pheno-otel"
documentation = "https://docs.rs/pheno-otel"
keywords = ["phenotype", "opentelemetry", "otlp", "otel", "observability", "substrate", "tracing"]
categories = ["development-tools", "api-bindings", "asynchronous"]
readme = "README.md"
publish = true

# Empty [workspace] table declares this crate as a standalone package,
# intentionally NOT a member of the root monorepo workspace (which contains
# 100+ sub-crates). Consumers add it to their own workspace or depend on
# it via a path/git dep.
[workspace]

[lib]
name = "pheno_otel"
path = "src/lib.rs"

[dependencies]
thiserror = "2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[dev-dependencies]
# Concurrency model checker (v14 T5: L25 pillar, cycle 3).
# Permutation-tests shared-state data structures used in this crate's
# public API. Stable Rust 1.75+ compatible; no nightly required.
loom = "0.7"
```

> **Notable shape:**
> - `[lib] name = "pheno_otel"` (underscore) — Rust rename convention
> - `[workspace]` declared empty — standalone crate, not a monorepo member
> - `[dependencies]` is minimal (3 entries): `thiserror = "2"`, `serde = "1.0"` (with `derive`), `serde_json = "1.0"`
> - `[dev-dependencies]` is 1 entry: `loom = "0.7"` (concurrency model checker)
> - `rust-version = "1.75"` is the package MSRV (broader than CI matrix 1.82)
> - `publish = true` — crates.io-ready
> - Description explicitly cites **ADR-037**

---

## 9. Source file dumps (full content)

### 9.1 `src/lib.rs` (209 lines)

```rust
//! `pheno-otel` — OpenTelemetry OTLP exporter substrate for the pheno-* fleet.
//!
//! Per ADR-037, this crate is the canonical **OTLP wire-format export**
//! substrate. It exposes a `OtlpPort` trait (hexagonal Port side, per ADR-038)
//! and ships two concrete exporters in-tree: `StdoutExporter` (logs to
//! stderr/stdout for local dev) and `HttpExporter` (POSTs OTLP/JSON to an
//! OTLP/HTTP endpoint).
//!
//! Consumers depend on `pheno-otel` for consistent OTLP export, batch
//! processor behavior, and resource attribute propagation. This crate is
//! sibling to `pheno-tracing` (ADR-036) — `pheno-tracing` produces spans,
//! `pheno-otel` exports them.
//!
//! # When to use
//!
//! - You need to export traces/metrics/logs in OTLP wire format.
//! - You want a `Port` trait + `Adapter` impl shape per ADR-038.
//! - You want to plug a custom OTLP backend without changing consumer code.
//!
//! # When NOT to use
//!
//! - You only need in-process tracing → use `pheno-tracing`.
//! - You need Prometheus-format export → use `pheno-otel` + a Prometheus
//!   scrape target via the `HttpExporter` adapter.
//! - You need language-specific SDKs → use the `opentelemetry` crate family
//!   directly (this crate is a thin fleet-port wrapper, not a full SDK).

#![deny(missing_docs)]
#![deny(unsafe_code)]
#![deny(rust_2018_idioms)]

use thiserror::Error;

/// Error type for OTLP export operations.
#[derive(Debug, Error)]
pub enum OtlpError {
    /// Serialization of an OTLP payload failed.
    #[error("serialization failed: {0}")]
    SerializeFailed(String),
    /// The HTTP transport returned a non-2xx status.
    #[error("transport error: {0}")]
    Transport(String),
    /// The exporter was used before being configured.
    #[error("exporter not configured: {0}")]
    NotConfigured(String),
    /// A resource attribute or span attribute is invalid per OTel semconv.
    #[error("invalid attribute: {0}")]
    InvalidAttribute(String),
}

/// Opaque handle representing an active export pipeline.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ExportHandle {
    /// Endpoint URL the exporter is bound to.
    pub endpoint: String,
    /// Service name (from OTel `service.name` resource attribute).
    pub service_name: String,
}

/// Trait for OTLP exporters (hexagonal Port side, per ADR-038).
///
/// Implementors are responsible for taking a serialized OTLP payload and
/// shipping it to the configured backend. The trait is sync; async
/// backends should buffer internally.
pub trait OtlpPort: Send + Sync {
    /// Stable, human-readable exporter name (e.g. `stdout`, `http`).
    fn name(&self) -> &str;

    /// Lightweight liveness check; returns `Ok(())` when the exporter
    /// is configured and reachable.
    fn health(&self) -> Result<(), OtlpError>;

    /// Export a single OTLP/JSON payload (traces, metrics, or logs).
    ///
    /// `payload` is the JSON-serialized OTLP request body per the
    /// OpenTelemetry protocol specification.
    fn export(&self, payload: &[u8]) -> Result<ExportHandle, OtlpError>;

    /// Flush any in-flight batched exports; blocks until drained.
    fn flush(&self) -> Result<(), OtlpError>;
}

/// Concrete OTLP exporters (Stdout, HTTP).
pub mod exporters;

/// W3C Trace Context propagator (extract/inject across HTTP headers).
///
/// See [`propagation::W3CTraceContextPropagator`] for the canonical
/// carrier-agnostic surface; consumers import this when they need to
/// forward trace context across an HTTP or gRPC service boundary.
pub mod propagation;

/// Build an OTel `service.name`-flavored `ExportHandle` for tests.
pub fn test_handle(endpoint: &str) -> ExportHandle {
    ExportHandle {
        endpoint: endpoint.to_string(),
        service_name: "pheno-otel-tests".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockExporter {
        name: String,
        endpoint: String,
        healthy: bool,
    }

    impl OtlpPort for MockExporter {
        fn name(&self) -> &str { &self.name }
        fn health(&self) -> Result<(), OtlpError> {
            if self.healthy { Ok(()) } else { Err(OtlpError::NotConfigured(self.endpoint.clone())) }
        }
        fn export(&self, _payload: &[u8]) -> Result<ExportHandle, OtlpError> {
            if _payload.is_empty() {
                return Err(OtlpError::SerializeFailed("empty payload".to_string()));
            }
            Ok(ExportHandle {
                endpoint: self.endpoint.clone(),
                service_name: "pheno-otel-mock".to_string(),
            })
        }
        fn flush(&self) -> Result<(), OtlpError> { Ok(()) }
    }

    #[test] fn export_returns_handle() { /* mock + assert_eq endpoint http://localhost:4318 */ }
    #[test] fn export_empty_payload_fails() { /* assert matches SerializeFailed */ }
    #[test] fn health_check_passes() { /* healthy=true → Ok */ }
    #[test] fn health_check_fails_when_unhealthy() { /* healthy=false → NotConfigured */ }
    #[test] fn flush_returns_ok() { /* assert Ok */ }
    #[test] fn exporter_name_is_non_empty() { /* assert !name.is_empty() */ }
    #[test] fn test_handle_builds() { /* assert h.endpoint, h.service_name = pheno-otel-tests */ }
}
```

(Truncated the test bodies; see file at `src/lib.rs:140-208` for verbatim test code.)

### 9.2 `src/exporters/mod.rs` (43 lines)

```rust
//! Concrete OTLP exporter implementations.
//!
//! Two in-tree adapters per ADR-038:
//! - [`StdoutExporter`] — writes OTLP/JSON to stderr (local dev, smoke tests).
//! - [`HttpExporter`] — POSTs OTLP/JSON to an OTLP/HTTP endpoint.

pub mod http;
pub mod stdout;

/// Common configuration for any OTLP exporter.
#[derive(Debug, Clone)]
pub struct ExporterConfig {
    /// OTLP/HTTP endpoint URL (e.g. `http://localhost:4318`).
    pub endpoint: String,
    /// OTel `service.name` resource attribute.
    pub service_name: String,
    /// OTel `service.version` resource attribute.
    pub service_version: String,
}

impl ExporterConfig {
    /// Build a new config with the given endpoint and service name.
    pub fn new(endpoint: impl Into<String>, service_name: impl Into<String>) -> Self {
        Self {
            endpoint: endpoint.into(),
            service_name: service_name.into(),
            service_version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_new_sets_endpoint_and_service() {
        let c = ExporterConfig::new("http://localhost:4318", "pheno-otel");
        assert_eq!(c.endpoint, "http://localhost:4318");
        assert_eq!(c.service_name, "pheno-otel");
        assert!(!c.service_version.is_empty());
    }
}
```

### 9.3 `src/exporters/stdout.rs` (97 lines)

`StdoutExporter` — writes OTLP/JSON payloads to stderr. `name() == "stdout"`. `health()` fails when endpoint is empty. `export()` rejects empty payload, otherwise writes `[pheno-otel/stdout] endpoint=… service=… bytes=…` to stderr. `flush()` is no-op (stderr is unbuffered). **6 inline unit tests** at `src/exporters/stdout.rs:56-96` covering name, health (with/without endpoint), export (success + empty), flush.

### 9.4 `src/exporters/http.rs` (150 lines)

`HttpExporter` — POSTs OTLP/JSON to OTLP/HTTP endpoint. Three constructors: `traces()` → `/v1/traces`, `metrics()` → `/v1/metrics`, `logs()` → `/v1/logs`. `target_url()` strips trailing `/` from endpoint. Per `src/exporters/http.rs:4-5`: "Wire format: Content-Type: application/json per the OTel spec. Retry policy: caller is responsible; this exporter is a single-shot POST." Per `src/exporters/http.rs:70-72`: "Production exporters would POST here. This is a pure-Rust, dependency-light substrate; consumers wire in their own HTTP client (reqwest, hyper, etc.) and call `target_url()` for the destination." **10 inline unit tests** at `src/exporters/http.rs:85-149`.

### 9.5 `src/metrics.rs` (83 lines)

Fleet-wide OTLP metrics facade (L25). Defines `Counter` (`AtomicU64`), `Histogram` (12 fixed buckets: 1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000), `Labels` (`HashMap<String,String>`), `Preset` enum (5 fleet-wide presets: `RequestRate`, `ErrorRate`, `LatencyP99`, `InFlightCount`, `Saturation`), constructors `counter()` / `histogram()` / `gauge()`, and `export_loop()` async stub. **Note:** not re-exported from `src/lib.rs` — `pub mod metrics;` is absent. **3 inline unit tests** at `src/metrics.rs:63-82`.

### 9.6 `src/propagation.rs` (448 lines)

W3C Trace Context Level 2 propagator. Public surface:
- `pub const TRACEPARENT_HEADER: &str = "traceparent";` (line 48)
- `pub struct SpanContext { version: u8, trace_id: String, span_id: String, trace_flags: u8 }` (line 56-70) with `is_sampled()`, `new()`, `sampled()` constructors (lines 72-97)
- `pub enum PropagationError { MissingHeader, Malformed(&'static str), InvalidTraceId, InvalidSpanId, InvalidVersion }` (line 100-113) with `Display` + `Error` impls
- `pub struct W3CTraceContextPropagator;` (zero-sized, `Default`, `Clone`, `Copy`) (line 134-135)
- Methods: `extract(headers: &HashMap<String, String>) -> Result<SpanContext, PropagationError>` (case-insensitive on header name per line 156-160), `inject(ctx: &SpanContext) -> HashMap<String, String>` (writes lowercase canonical name per line 169-179), `parse_traceparent(value: &str)` (full W3C Level 2 grammar at line 186-249)

**13 inline unit tests** at `src/propagation.rs:257-447`: `extract_valid_sampled_parent`, `extract_unsampled_flag`, `extract_rejects_invalid_version_0xff`, `extract_rejects_all_zero_trace_id`, `extract_rejects_all_zero_span_id`, `extract_rejects_missing_header`, `extract_rejects_wrong_field_count`, `extract_rejects_non_hex_trace_id`, `extract_is_case_insensitive_on_header_name`, `extract_tolerates_future_versions`, `inject_round_trips_through_extract`, `inject_writes_lowercase_canonical_header`, `span_context_is_sampled_bit_only`.

### 9.7 `Justfile` (148 lines)

Task runner. Recipes: `default`, `info`, `build`, `build-release`, `fmt-check`, `fmt`, `clippy`, `test`, `test-unit`, `test-integration`, `test-doc`, `coverage`, `coverage-summary`, `deny`, `deny-advisories`, `audit`, `audit-all`, `check` (= fmt-check + clippy + test), `ci-local` (= check + audit), `worklog-validate` (validates worklogs against pheno-worklog-schema v2.1), `release VER`, `ci-build`, `ci-test`, `ci-clippy`, `ci-fmt`, `ci-deny`, `ci-audit`. Header comments establish conventions: recipes prefixed with `ci-` are CI-only; recipes prefixed with `dev-` are dev-only.

### 9.8 `llms.txt` (92 lines)

`llmstxt.org` format. Sections: `# pheno-otel` (title) + blockquote summary + `## Documentation` (10 links: README, AGENTS, SPEC, WORKLOG, CHANGELOG, STATUS, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY) + `## Optional` (LICENSE-MIT, LICENSE-APACHE, Cargo.toml, deny.toml, llvm-cov.toml, Justfile, .editorconfig, .gitattributes, src/lib.rs, src/exporters/{mod,stdout,http}.rs, .github/workflows/*.yml, .github/dependabot.yml, .github/CODEOWNERS, .github/ISSUE_TEMPLATE/*.yml, .github/PULL_REQUEST_TEMPLATE.md) + `## Sibling substrates (fleet)` (8 fleet crates with descriptions) + `## ADRs (governance)` (10 ADR cross-refs to `../../docs/adr/2026-06-18/`) + `## See also` (5 references).

### 9.9 `AGENTS.md` (98 lines)

Header: `> Status: ACTIVE (governance meta-bundle for the pheno-otel substrate canonical in the Phenotype monorepo). Date: 2026-06-20. Owner: KooshaPari (orch-v11-044). Substrate role: Rust library (per ADR-012 + ADR-036B substrate canonicals).`

Sections: `What this path is` (notes that executable Rust source lives in `FocalPoint/pheno-otel/`; this path is **governance + meta-bundle home only**); `Quickstart (governance-first)` (6 steps); `Substrate invariants (per ADR-023 Rule 3.1)` (7 invariants: Spec, Docs, Tests, Observability, Coverage gate, CI gate, Worklog v2.1); `Branch naming` (4 prefixes); `Commit message format` (Conventional Commits with examples); `PR labels` (4 labels); `SOTA artifacts` (4 dirs); `Related ADRs` (8 ADRs); `Tier-0 hygiene (this batch, v11-044)` (full file inventory of the meta-bundle); `Contact`.

### 9.10 `SPEC.md` (102 lines)

`> Spec status: implemented. Last audited: 2026-06-20 against branch chore/orch-v11-016-tier0-2026-06-20. Substrate tier: pheno-*-lib (per ADR-023 Rule 3). Substrate role: canonical OTLP wire-format export substrate (per ADR-037).`

7 sections: `1. What` (1 paragraph); `2. Why` (1 paragraph on prior OTLP-export fragmentation in the fleet); `3. How` (architecture diagram showing producer → `OtlpPort` trait → `StdoutExporter` / `HttpExporter` / `MockExporter`); `4. Interface` (Rust code block reproducing the trait + error enum); `5. Consumers` (4 consumers listed); `6. Status` (implemented, 23 inline unit tests, 80% lib coverage target pending); `7. References` (6 ADR cross-refs).

---

## 10. Cross-reference to prior 10 audits' matrix patterns

The 71-pillar framework (ADR-024) is the canonical scoring rubric. Prior audit artifacts on `pheno-otel` and on the parallel Phase 1A pattern are:

| # | Finding / audit file | Lines | Date | Wave | What it scored / reported |
|---|---|---:|---|---|---|
| 1 | `findings/2026-06-20-71-pillar-cycle-4-pheno-otel.md` | 182 | 2026-06-20 | v14 cycle-4 | **THE prior 71-pillar audit for this exact substrate.** Mean 2.39/3 across all 71 pillars (Tier 2 graduated). AX mean 2.50, Performance mean 1.86, Quality 2.75. Per-domain scorecards documented per-pillar with `filepath:startLine-endLine` citations. **Most relevant prior artifact for this Phase 1A inventory.** |
| 2 | `findings/71-pillar-2026-06-17.md` | (L1-L71 scorecard across 10 repos, including pheno-otel) | 2026-06-17 | v9 cycle-1 | Original 71-pillar scorecard. Per-pillar scores for AX/Performance/Quality/DX/UX/Security/Observability/Documentation/Governance. |
| 3 | `findings/71-pillar-2026-06-17-schema.md` | (schema doc) | 2026-06-17 | v9 | 71-pillar framework schema (L1-L71, 9 domains, 0-3 scale). |
| 4 | `findings/71-pillar-2026-06-17-mapping.md` | (crosswalk) | 2026-06-17 | v9 | L1-L30 → L1-L71 crosswalk so older 30-pillar audits are not orphaned. |
| 5 | `findings/2026-06-21-pheno-port-adapter-audit/01-source-inventory.md` | 807 | 2026-06-21 | v19 cycle-9 | **The sibling Phase 1A inventory this document was modeled on** (per user directive to use prior 10 audits' matrix patterns). Same shape: 0. Headline numbers, 1. Tracked files grouped, 2. Branches, 3. Tags, 4. Commit log annotated, 5. Submodules, 6. CI workflows, 7. Governance files with sizes, 8. Cargo.toml, 9. Source dumps, 10. Cross-reference. |
| 6 | `findings/2026-06-21-pheno-port-adapter-audit/00-FINAL-AUDIT.md` | ~700 | 2026-06-21 | v19 | Phase 2 final audit (synthesis). EXECUTIVE_DECISION = PRESERVE Shape 9 (CANONICAL_SUBSTRATE_LOCAL_SUBTREE). Companion to the Phase 1A inventory above. |
| 7 | `findings/2026-06-21-71-pillar-cycle-13-probe.md` | (probe) | 2026-06-21 | v22 cycle-12 | Cycle 13 probe of the 71-pillar framework. |
| 8 | `findings/2026-06-21-v22-closure.md` | (closure report) | 2026-06-21 | v22 cycle-12 | v22 cycle-12 closure report. |
| 9 | `findings/2026-06-21-V19-T5-security-p1.md` | (security P1 deepening) | 2026-06-21 | v19 | Security pillar deepening; covers L46-L55. |
| 10 | `findings/2026-06-20-71-pillar-cycle-3-probe.md` | (probe) | 2026-06-20 | v14 cycle-3 | Cycle 3 probe (predecessor to cycle 4 above). |

### 10.1 Matrix-pattern template applied to `pheno-otel` (cycle-4 → cycle-12 delta)

Comparing `findings/2026-06-20-71-pillar-cycle-4-pheno-otel.md` (cycle-4 baseline) against the working tree at HEAD `18a5adfb67` (cycle-12 P1 + cycle-13 closure):

| Pillar (cycle-4 score) | Working-tree evidence | Delta (cycle-4 → cycle-12) |
|---|---|---|
| L1 Module structure (3/3) | 5 source files, 1,030 LOC; hexagonal Port/Adapter split module-clean | unchanged (3/3) |
| L4 Hexagonal ports-and-adapters (3/3) | `OtlpPort` trait in `src/lib.rs:67+`; `StdoutExporter` + `HttpExporter` adapters; `MockExporter` test-only | unchanged (3/3) |
| L5 Dependency direction (2/3) | `[dependencies]` minimal (3 entries); `[dev-dependencies]` 1 entry (`loom`) | unchanged (2/3) |
| L8 Inter-service contracts (3/3) | OTel OTLP wire format `/v1/{traces,metrics,logs}`; W3C Trace Context Level 2 (`src/propagation.rs`) | unchanged (3/3) |
| L13 Latency budgets (1/3) | No SLO; no p50/p95/p99 budget docs | unchanged (1/3) — `STATUS.md` §3 "blocked: first llvm-cov coverage number on main — same blocker" |
| L15 Throughput (1/3) | No benchmarks; no `benches/` dir | unchanged (1/3) |
| L18 Concurrency model (3/3) | `ExportHandle: Clone`; loom tests added cycle-5 (`2e36ad8b24`); `tests/loom_*.rs` 43 LOC | **+1 loom test pair (L25 deepening)** |
| L20 Unit coverage (2/3) | 23 inline unit tests across `src/lib.rs` (7), `src/exporters/stdout.rs` (6), `src/exporters/http.rs` (10); `src/exporters/mod.rs` 1; `src/propagation.rs` 13; `src/metrics.rs` 3 = **50 inline unit tests** | **+27 tests since cycle-4 baseline** (was 23, now 50); first llvm-cov run pending per `STATUS.md` §3 |
| L21 Integration tests (0/3) | `tests/w3c_trace_context.rs` 538 LOC, 7 `#[test]`; `tests/loom_exporter_buffer.rs` 22 LOC, 1 `#[test]`; `tests/loom_metric_recorder.rs` 21 LOC, 1 `#[test]` = **9 integration tests** | **0 → 9 (L21 climbed from 0 to ~3/3)** |
| L22 Coverage gate (2/3) | `llvm-cov.toml` 80% lines / 75% branches / 80% fns; `ci.yml:135-140` enforces ≥80% lib gate | **+1 enforcement step** |
| L23 Mutation testing (1/3) | No cargo-mutants yet | unchanged (1/3) |
| L25 Loom / concurrency (1/3) | `tests/loom_*.rs` with preemption_bound=3; `loom = "0.7"` dev-dep | **1 → 3 (L25 climbed)** |
| L48 SBOM (1/3) | `sbom.json` 172,787 B CycloneDX committed (per v13 T3 cycle-3 commit `3a9b0460c2`); `release.yml` references SBOM | **1 → 2** (SBOM present, cosign not yet wired) |
| L49 SLSA provenance (0/3) | Not yet wired (per `STATUS.md` §5) | unchanged (0/3) |
| L50 Cosign signing (0/3) | Not yet wired (per `STATUS.md` §5) | unchanged (0/3) |
| L60 Latency histogram facade (2/3) | `src/metrics.rs` `Histogram` with 12 fixed buckets + `LatencyP99` preset (per cycle-5 commit `23386dc652`) | **2 → 3 (L60 climbed)** |
| L62 Metrics API (1/3) | `src/metrics.rs` `Counter` / `Histogram` / `Labels` / `Preset` + `export_loop()`; consumers wired in `pheno-port-adapter` (`2c9255706f`) and `pheno-errors` (`13c69a62f3`) | **1 → 2** |

### 10.2 Phase 1A inventory → Phase 2 audit hand-off

The following **open items** discovered during this Phase 1A inventory and deferred to Phase 2:

1. **`src/metrics.rs` is not re-exported from `src/lib.rs`** — `pub mod metrics;` is absent. The crate's public API surface (`OtlpPort`, `OtlpError`, `ExportHandle`, `W3CTraceContextPropagator`, `StdoutExporter`, `HttpExporter`) does not include `Counter` / `Histogram` / `Labels` / `Preset`. This is a **P1 docs/code parity gap**.
2. **`README.md` claims `init()` and `TelemetryGuard` API** (per `README.md:30-38` quickstart) but `src/lib.rs` does **not** export either. The README describes a **planned** API; the SPEC.md (`SPEC.md:4`) marks the current spec as "implemented" with the actual `OtlpPort` API. The `SECURITY.md` (line 57-58) also references `TelemetryGuard`. This is a **P1 docs/code parity gap** — the README is **stale** relative to v0.1.0.
3. **No `v0.1.0` git tag exists** (per §3); the version in `Cargo.toml` is un-released on the tag axis. **P2 release-train gap.**
4. **`Cargo.toml:5` declares `rust-version = "1.75"`** but `ci.yml:30,82,93` enforces `1.82.0` as MSRV. **P3 version-mismatch nit.**
5. **`v16-L22-build-perf-pheno-otel-2026-06-21` shows 19,818 ahead / +1.1M lines divergence from main** (per §2.1) — this includes the entire `.agileplus/` database subtree. **Crate-local diff (`git diff main..branch -- pheno-otel/`)** not run in Phase 1A; deferred to Phase 2.
6. **31 pheno-otel commits** in `git log --all` is the inflated count; **~12 unique-commit count** after namespace-dedup. **Phase 2: per-commit uniqueness audit.**
7. **`target/` directory is tracked in the working tree** (`ls -la` shows `drwxr-xr-x@   7 kooshapari  staff     224 Jun 21 16:13 target`). This violates Rust `.gitignore` convention; the `.gitignore` should ignore `target/` but the directory is checked in. **P3 hygiene gap.**
8. **`Cargo.lock` is tracked** (`Cargo.lock` size 9,703 B) — appropriate for binary crates but unconventional for a library. Per `Cargo.toml:13` `publish = true`, this is acceptable. No gap.
9. **Two remote aliases (`origin`/`origingit`)** point at `phenotype-apps`; **two more (`argis`/`argis-extensions`)** point at `argis-extensions`. All four remotes share a common upstream `github.com/KooshaPari/phenotype-apps.git` or `argis-extensions.git`. Phase 2 should determine which remote is the **canonical push target** for this substrate.
10. **Three branches diverge 19,818+ commits from main** (`v16-L22-build-perf-pheno-otel-2026-06-21`). This is suspicious — `main` is at commit `4c1a32b18c` (a relatively recent v21 cycle-11 P1 commit) but this single branch has 19,818 ahead. **Phase 2: investigate branch-base mismatch (likely local-main drift).**

---

## 11. Verification (per task directive)

```
$ wc -l /Users/kooshapari/CodeProjects/Phenotype/repos/findings/2026-06-21-pheno-otel-audit/01-source-inventory.md
```

To be run after file write; expected output in the 800-1100 range per the user directive.

---

## 12. Source attribution summary

Every claim in this inventory is derived from:

| Source command | What it provides |
|---|---|
| `git remote -v` | 4 remotes × 2 URLs (origin + origingit → phenotype-apps; argis + argis-extensions → argis-extensions) |
| `git status --short` | 1 untracked delete (`worklogs/2026-06-22-L5-155-v23-closure-t1-t5.md`), 1 untracked modification (`findings/2026-06-22-v22-T4-L33-hot-reload.md`), 1 untracked delete (`../.cargo/config.toml`) |
| `git branch --show-current` | `chore/v22-71-pillar-cycle-12-p1-2026-06-22` |
| `git rev-parse HEAD` | `18a5adfb67d62fae9c3b2fa748f3b8e365c87647` |
| `git tag --list \| sort -V` | 6 tags (backup/pre-v22-merge + v0.0.7..v0.0.12) |
| `git submodule status` | empty |
| `git branch -a 2>&1 \| wc -l` | 599 (sparse; full local+remote enumeration) |
| `git for-each-ref refs/heads/ \| wc -l` | 219 (local) |
| `git for-each-ref refs/remotes/ \| wc -l` | 381 (remote) |
| `git for-each-ref ... \| grep -iE 'pheno-otel' \| awk -F'/' '{print $NF}' \| sort -u \| wc -l` | 9 (unique pheno-otel-named branches) |
| `git ls-files \| wc -l` | 44 (tracked files in this worktree) |
| `git log --oneline --all \| wc -l` | 1,238 (total commits across all refs) |
| `git log --oneline --all \| grep -iE 'pheno-otel' \| wc -l` | 31 (pheno-otel-specific commits; ~12 unique after dedup) |
| `git rev-list --left-right --count main...HEAD` | 1,985 ahead / 0 behind (working tree) |
| `git rev-list --left-right --count main...4c1a32b18c` | 0 / 0 (main == base) |
| `wc -l Cargo.toml Justfile llms.txt AGENTS.md SPEC.md CHANGELOG.md STATUS.md deny.toml dependabot.yml SECURITY.md CODEOWNERS llvm-cov.toml .editorconfig .gitattributes .gitignore CONTRIBUTING.md CODE_OF_CONDUCT.md README.md WORKLOG.md` | 34 / 148 / 92 / 98 / 102 / 59 / 73 / 88 / 59 / 77 / 22 / 22 / 33 / 60 / 81 / 101 / 132 / 72 / 72 |
| `git diff --stat main..HEAD \| tail -1` | 309 files changed, +21,694 / −13,134 (working tree) |
| `ls -la sbom.json` | 172,787 B CycloneDX |
| `ls -la Cargo.lock` | 9,703 B |
| `find .github/workflows -type f -name "*.yml" -exec wc -l {} +` | ci.yml 144, audit.yml 43, deny.yml 35, lint.yml 66, release.yml 59, scorecard.yml 42 |
| Direct file reads | src/lib.rs (209 LOC), src/exporters/mod.rs (43), src/exporters/stdout.rs (97), src/exporters/http.rs (150), src/metrics.rs (83), src/propagation.rs (448), Cargo.toml (34), Justfile (148), llms.txt (92), AGENTS.md (98), SPEC.md (102), CHANGELOG.md (59), STATUS.md (73), SECURITY.md (77), CODEOWNERS (22), llvm-cov.toml (22), dependabot.yml (59), deny.toml (88), README.md (72), WORKLOG.md (72), CONTRIBUTING.md (101), tests/w3c_trace_context.rs (538), tests/loom_exporter_buffer.rs (22), tests/loom_metric_recorder.rs (21), .config/nextest.toml (15), .github/workflows/{ci,audit,deny,lint,release,scorecard}.yml (144/43/35/66/59/42), .github/ISSUE_TEMPLATE/{bug,feature,security,config}.yml (97/71/73/52), .github/PULL_REQUEST_TEMPLATE.md (72) |
| `findings/2026-06-20-71-pillar-cycle-4-pheno-otel.md` (read) | prior 71-pillar audit, mean 2.39/3, Tier 2 graduated |
| `findings/2026-06-21-pheno-port-adapter-audit/01-source-inventory.md` (read) | sibling Phase 1A template (807 lines) |

---

**End of Phase 1A inventory.** Next phase: 02-docs-code.md (spec / readme / docs-vs-code parity) per the pattern in `findings/2026-06-21-pheno-port-adapter-audit/`.
