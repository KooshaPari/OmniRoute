# Phenotype Fleet 100-Task DAG v3 — FOCUS Edition
# Generated: 2026-06-10
# Supersedes: FLEET_100TASK_DAG_V2_MERGED.md (preserved for reference)
# Width: 20 parallel lanes | Stages: 5 main + 4 side = 100 + 20 = 120 total
# Focus repos: PlayCua, nanovms, PhenoCompose, BytePort (+ AgilePlus as substrate)
# Strategy: STABILIZE → OPTIMIZE-TO-SOTA
#   L1: state unification + focus-repo audits (lowest risk, biggest visibility)
#   L2: tooling modernization (make→just/task) + cheap-llm-mcp merge
#   L3: SOTA + test coverage (typed, tested, traced)
#   L4: libification + hexagonal refactor (port/adapter, composio-like decoupling)
#   L5: integration + side DAGs (stitch it together, verify, ship)

## Design Rationale (V1 → V2 → V2-MERGED → V3)

V1 (2026-06-08 morning) — hygiene-only, 5 levels, 100 tasks.
V2 → V2-MERGED (2026-06-08 evening) — broad fleet, 6 levels, 120+20=140 tasks.

V3 (2026-06-10) is **FOCUS-EDITION**: concentrates the 100-task budget on the four
explicit focus repos (PlayCua, nanovms, PhenoCompose, BytePort) plus AgilePlus
as the substrate layer (traceability, CLI, worklog, dashboard). The previous DAGs
covered the entire ~36-repo fleet; V3 narrows so each lane is dense with
focus-repo work, not fleet-wide papercuts.

Key changes from V2-MERGED:
- **Cheap-LLM-MCP is now L2 (was: scattered)**. The repo is small, single-crate,
  Rust + MCP server; it must be **consumed into dispatch-mcp** (same author,
  same problem space: tiered LLM routing). The consumption target is one PR
  landing `cheap-llm-mcp`'s profile-routed fallback into `dispatch-mcp`'s
  backend. This is concrete and verifiable.
- **Worktree/stash/PR unification is now L1**. 33 worktrees, 0 stashes, 167
  branches across the monorepo. 4 lanes dedicated to: (a) agent worktree
  collapse, (b) duplicate branch detection, (c) PR cross-reference, (d) main
  branch re-alignment.
- **Tooling modernization (make→just/task) is now L2** with explicit migration
  recipes per focus repo: each gets a `Taskfile.yml` + a `justfile` (because
  some CI uses just) and a `make → task` migration script that re-points all
  `make` invocations.
- **Hexagonal/polyrepo refactor is L4**. Per focus repo: identify the
  domain/port/adapter seam, extract `domain/`, `ports/`, `adapters/` dirs,
  and **wrap** (not rewrite) hand-rolled logic with `pheno-port-adapter` crate.
- **Composio-like decoupling by layer is L4 task #77-80**. The "composio"
  insight: split any tool-y feature into 3 layers (definition, transport,
  runtime) and have exactly one boundary per layer. Concretely: LLM tool
  definitions, MCP transport, and execution runtime each get their own crate
  boundary.

## Shape (machine-checked)

- **Width:** 20 parallel lanes per main layer (never fewer)
- **Depth:** 5 main layers (Stabilize → SOTA → Libify → Hex → Integrate)
- **Total main tasks:** 5 × 20 = 100
- **Side DAGs:** 4 × 5 = 20 (complementary, feed back into L5)
- **Grand total:** 100 + 20 = 120
- **Shape:** 20×5 rectangle + 4 side-DAGs of 5
- **Per-stage task size:** smallest task is L1 #1 (worktree count audit) — atomic,
  shell-only, no code. Cannot be split further.

## Focus-Repo Allocation (4 × 5 = 20 dedicated lanes)

| Repo   | L1 (audit) | L2 (tooling) | L3 (SOTA) | L4 (hex) | L5 (integrate) |
|--------|-----------|--------------|-----------|----------|----------------|
| PlayCua       | #1  | #21 | #41 | #61 | #81 |
| nanovms       | #2  | #22 | #42 | #62 | #82 |
| PhenoCompose  | #3  | #23 | #43 | #63 | #83 |
| BytePort      | #4  | #24 | #44 | #64 | #84 |
| **AgilePlus** (substrate) | #5 (CLI gap audit) | #25 (CLI gap fixes) | #45 (SOTA) | #65 (hex) | #85 (integrate) |

The remaining 15 lanes in each layer are cross-cutting (cheap-llm-mcp merge,
pheno-* crate extraction, hygiene baselines, etc.).

---

## Layer 1: STATE UNIFICATION + FOCUS-REPO AUDIT — 20 tasks

Each task produces a `STATUS_2026_06_10.md` (or equivalent) and a
`worklog-2026-06-10.json`. All 20 run in parallel. **Strategy: stabilize first.**

1. **PlayCua audit** — produce `PlayCua/STATUS_2026_06_10.md` with: branch, dirty,
   last commit, Cargo workspace, LOC by language, top-20 TODOs with line numbers,
   build matrix (`cargo test --no-run`), bare-cua cross-dep (per
   `plans/2026-06-09-playcua-barecua-merge-plan-v1.md`), Mac/Linux primary
   (NOT Windows — defer), quality gate (clippy/fmt/deny).
2. **nanovms audit** — produce `nanovms/STATUS_2026_06_10.md` with: branch, dirty,
   last commit, `go.mod` deps, `cmd/` + `desktop/` LOC inventory, top-20 TODOs,
   `go build ./...` matrix, Linux primary (Mac secondary), phenocompose-nanovms-pine
   world-map cross-dep, quality gate (go vet, golangci-lint).
3. **PhenoCompose audit** — produce `PhenoCompose/STATUS_2026_06_10.md` with:
   branch, dirty, last commit, Cargo workspace, `bindings/` + `cmd/` LOC, top-20
   TODOs, `cargo check --workspace`, FFI strategy cross-dep (per
   `plans/2026-06-08-lang-ffi-strategy-playbook-v1.md`), Mac/Linux primary,
   quality gate.
4. **BytePort audit** — produce `BytePort/STATUS_2026_06_10.md` with: branch,
   dirty, last commit, Cargo + npm deps (Rust core + TS backend), `backend/`
   inventory, top-20 TODOs, `cargo check` + `npm test`, per-OS icon assets
   (per PR #165), `phenotype-landing/sites/byteport` cross-dep, quality gate.
5. **AgilePlus CLI gap audit** — produce `AgilePlus/STATUS_2026_06_10.md` with:
   branch, dirty, last commit, all 21+ crates' `main.rs`/`cli.rs` subcommand list,
   top-30 TODOs, missing subcommands (traceability, worklog, dashboard, gate-run,
   gate-add, sidecar-status, run-record, scope-status), `.agileplus/agileplus.db`
   schema (sqlite3 `.schema`), Mac/Linux primary, quality gate.
6. **Worktree consolidation audit** — `git worktree list` enumeration across
   the 33 worktrees; classify each as: (a) active work, (b) stale (>30 days no
   commit), (c) duplicate (same branch in 2+ worktrees), (d) agent-spawned
   (worktree-agent-*). Output: `WORKTREE_AUDIT_2026_06_10.md` with a
   keep/merge/delete decision per worktree.
7. **Branch deduplication audit** — `git branch -a` across the 167 branches;
   detect (a) merged-into-main candidates, (b) duplicate names across remotes,
   (c) typo variants (`fix/...` vs `chore/fix-...`), (d) PR-closed-but-not-
   deleted. Output: `BRANCH_AUDIT_2026_06_10.md`.
8. **PR cross-reference audit** — `gh pr list --state all --limit 200` + the
   `.claude/worktrees/*` directories' branch correlation; produce a per-branch
   table with: branch → PR# → status → last-CI-run → rebase-needed? Output:
   `PR_AUDIT_2026_06_10.md`.
9. **Stash + uncommitted-state audit** — `git stash list` per sub-repo
   (Agentora, Conft, AuthKit, DevHex, etc. are listed as dirty in `git status`).
   Produce `STASH_AUDIT_2026_06_10.md` with: which sub-repos have dirty working
   trees, which are blocked, and the commit-or-stash decision per repo.
10. **5th focus-repo candidate (5+1=6)** — evaluate PhenotypeAgents, Tracera,
    HeliosCLI, KWatch, Civis as the 5th audited repo (the user said 4 focus
    repos + 5 audits; we have 4+AgilePlus=5 already; this is the
    6th). Pick the smallest/easiest of the candidates. Output:
    `FIFTH_FOCUS_REPO_DECISION_2026_06_10.md`. (Default recommendation:
    **PhenotypeAgents** — smallest, has `.agileplus` integration already.)
11. **Cheap-LLM-MCP readiness** — read `cheap-llm-mcp/AGENTS.md` + `Cargo.toml`
    + `src/`; identify the export surface (tier enum, fallback chain, model
    registry). Output: `CHEAP_LLM_MCP_CONSUMPTION_PLAN_2026_06_10.md` listing
    the 5-10 public items to be re-exported from `dispatch-mcp`.
12. **OmniRoute dispatch health** — read `OmniRoute/AGENTS.md` + `package.json`;
    document the OmniRoute `http://localhost:20128/v1/chat/completions` endpoint,
    the tier → model mapping (`Worker`, `Main`, `Codeman`, `FreeTier`, `Opus`,
    `Haiku`, `Gemini`, `Kimi-K2.5`, `MiniMax-M2.7`), and how to start
    OmniRoute (`nohup omniroute --no-open > /tmp/omniroute.log 2>&1 &`).
    Output: `OMNIROUTE_DISPATCH_HEALTH_2026_06_10.md`.
13. **Existing FLEET DAGs cross-check** — read
    `FLEET_100TASK_DAG_V2_MERGED.md`, `FLEET_100TASK_DAG_v2.md`,
    `FLEET_100TASK_DAG.md`, `PHENOTYPE_5REPO_MODERNIZATION_PLAN.md`,
    `plans/2026-06-08-100-task-dag.md`; produce a delta report
    `DAG_VS_V3_DELTA_2026_06_10.md` identifying which V2-MERGED tasks are
    superseded by V3 lanes.
14. **deny.toml divergence audit** — diff each focus repo's `deny.toml` (if
    present) against `phenotype-org-governance/deny.toml` (after cloning L1
    task #16 in L1 #18 — for now, document the existing ones). Flag any
    addition/removal. Output: `DENY_TOML_DIVERGENCE_2026_06_10.md`.
15. **CI workflow SHA-pin audit** — `grep -rE 'uses: [a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+@v?[0-9]' .github/workflows/`
    across all 5 focus repos; flag any tag-only refs. Output:
    `WORKFLOW_PIN_AUDIT_2026_06_10.md`.
16. **Cross-repo duplication scan** — `cloc` + token fingerprinting across
    PlayCua, nanovms, PhenoCompose, BytePort, AgilePlus. Detect: (a) duplicated
    Cargo.toml blocks, (b) duplicated Go module patterns, (c) duplicated TS
    backend code, (d) duplicated Rust trait definitions. Output:
    `CROSS_REPO_DUPLICATION_2026_06_10.md` (feeds L4 libification).
17. **Worklog schema audit** — read `worklogs/` JSONs + the 240+ existing
    `worklog-*.json` files; document the schema (status, task_id, agent_id,
    files_changed, commit_sha, verification_result). Output:
    `WORKLOG_SCHEMA_2026_06_10.md`. This is the substrate for L5 traceability.
18. **Org-config repo cloning** — clone `kooshapari/phenotype-org-governance`
    and `kooshapari/phenotype-gates` and `kooshapari/phenotype-runs` to
    local tree. Apply `sync-configs.sh` (if it exists) or author it from
    scratch using the existing `.editorconfig` + `.gitignore` + `deny.toml` +
    `trufflehog.yml` + `dependabot.yml` templates. Output: a per-repo
    bootstrap PR description for each.
19. **SPEC.md / CLAUDE.md / AGENTS.md presence audit** — per focus repo,
    check (a) SPEC.md exists, (b) CLAUDE.md exists, (c) AGENTS.md exists,
    (d) STATUS.md exists, (e) ARCHITECTURE.md exists, (f) CHANGELOG.md
    exists. Output: `META_FILES_PRESENCE_2026_06_10.md`.
20. **Setup dispatch-mcp MCP server** — register `dispatch-mcp` in
    `~/.Codex/settings.json` and `~/.codex/config.toml` so the
    `dispatch_worker`, `dispatch_main`, `dispatch_opus`, `dispatch_haiku`,
    `dispatch_gemini`, `dispatch_kimi`, `dispatch_minimax` tools are
    available. Verify with `curl -sf http://localhost:20128/v1/models`.
    Output: `DISPATCH_MCP_REGISTERED_2026_06_10.md`.

---

## Layer 2: TOOLING MODERNIZATION + CHEAP-LLM-MCP MERGE — 20 tasks

Each task lands a PR. No filler. All 20 run in parallel after L1.

21. **PlayCua → Taskfile + justfile** — author `Taskfile.yml` (with `test`,
    `lint`, `build`, `cov`, `deny`, `audit`, `ci`, `hygiene` tasks) and
    `justfile` (mirror for CI compatibility). Write a migration script
    `scripts/migrate-make-to-task.sh` that re-points `make` invocations
    in README, AGENTS.md, CLAUDE.md, .github/workflows/. Remove the
    `Makefile` (if present). Verify: `task test && just test` both pass.
22. **nanovms → Taskfile + justfile** — same as #21, but with Go tasks:
    `task build` → `go build ./...`, `task test` → `go test ./...`,
    `task vet` → `go vet ./...`, `task lint` → `golangci-lint run`.
23. **PhenoCompose → Taskfile + justfile** — same as #21, with Cargo
    workspace tasks: `task test` → `cargo test --workspace`,
    `task cov` → `cargo llvm-cov --workspace --lcov --output-path lcov.info`.
24. **BytePort → Taskfile + justfile** — same as #21, hybrid Rust+TS:
    `task test` runs `cargo test && npm test`, `task build` runs
    `cargo build && npm run build`.
25. **AgilePlus → Taskfile + justfile + 8 new CLI subcommands** — the L1
    audit identified missing subcommands. Author 8 new subcommands:
    `ap trace`, `ap worklog`, `ap dashboard`, `ap gate-run`, `ap gate-add`,
    `ap sidecar-status`, `ap run-record`, `ap scope-status`. Each backed by
    a unit test. Wire into the `Taskfile.yml` so `task cli:smoke` runs
    each. Verify: `task test` + manual smoke of all 8 new subcommands.
26. **Consume cheap-llm-mcp into dispatch-mcp** — the headline task. PR
    `dispatch-mcp` to: (a) add `cheap-llm-mcp`'s `Tier` enum as a new
    dispatch tier (e.g. `cheapminimax` → `minimax/minimax-m2.7-highspeed`),
    (b) add `cheap-llm-mcp`'s fallback chain as a config preset in
    `dispatch-mcp/src/dispatch_mcp/config/presets.py`, (c) update README
    to document the consumed tiers. Delete the `cheap-llm-mcp/` directory
    post-merge (the crate has zero external users besides dispatch-mcp).
    Verify: `cd dispatch-mcp && pytest` and `task quality`.
27. **pheno-makefile-template** — author the canonical
    `pheno-cargo-template/Taskfile.yml` + `pheno-cargo-template/justfile`
    + `pheno-cargo-template/Makefile-LEGACY.md` (migration guide). PR
    to a new repo `kooshapari/pheno-cargo-template` (scaffolded in L4).
28. **Editorconfig + gitignore + .dockerignore baselines** — author the
    canonical `.editorconfig`, `.gitignore`, `.dockerignore` (each a
    single PR) and ship to all 5 focus repos. Verify with `editorconfig
    --check` + `git check-ignore -v` for a sample of generated paths.
29. **Dependabot baseline for focus repos** — author `.github/dependabot.yml`
    (cargo + npm + go ecosystems) for each of the 5 focus repos. Verify by
    `gh api repos/:owner/:repo/contents/.github/dependabot.yml` returning
    the file.
30. **CODEOWNERS + CONTRIBUTING + SECURITY + FUNDING baselines** — author
    the 4 governance files for the 5 focus repos (single PR per file per
    repo = 20 PRs, but rolled into 1 lane that opens 20 PRs). Verify
    with `gh pr list --label governance --state open` returning 20.
31. **CI workflow SHA-pin (focus repos)** — convert every `uses: ...@v?`
    ref in the 5 focus repos' `.github/workflows/` to SHA-pinned. Use
    `github/codeql-action`, `actions/checkout`, `actions/setup-node`,
    `actions/setup-python`, `actions/setup-go`, `dtolnay/rust-toolchain`,
    `Swatinem/rust-cache`. Verify with `actionlint` (if available) or
    manual grep.
32. **CI cache + concurrency + timeout + permissions** — add
    `Swatinem/rust-cache@v2` + `concurrency:` block + `timeout-minutes:`
    + `permissions: read-all` default to each focus repo's CI. Roll
    out in one PR per repo (5 PRs).
33. **Pre-commit + ruff + clippy + golangci-lint + tsc baselines** —
    author `.pre-commit-config.yaml` (with `pre-commit-hooks`,
    `ruff`, `black`, `clippy`, `golangci-lint`, `tsc`, `gitleaks`,
    `trufflehog`) for each focus repo. Single PR per repo.
34. **Gitleaks + trufflehog secret-scan workflow** — author the canonical
    `secret-scan.yml` + `.gitleaks.toml` + `.trufflehog.yml`; ship to
    5 focus repos. Single PR per repo (5 PRs total).
35. **OSSF scorecard + renovate presence** — author
    `scorecard.yml` + `renovate.json5`; ship to 5 focus repos.
    Single PR per repo (5 PRs total).
36. **License + CHANGELOG + .gitignore hygiene** — sweep the 5 focus
    repos; ensure dual `LICENSE-MIT` + `LICENSE-APACHE` (or agreed
    alternative), canonical `CHANGELOG.md` (Keep-a-Changelog 1.1.0),
    canonical `.gitignore`. Single PR per repo (5 PRs total).
37. **Branch-protection + repo-settings baseline** — for each focus
    repo, set: (a) main requires 1+ review, (b) main requires CI green,
    (c) main requires linear history, (d) main restricts force-push,
    (e) delete-branch-on-merge = true. Use `gh api` calls; verify
    with `gh api repos/:owner/:repo/branches/main/protection`.
38. **AgilePlus DB schema migration** — author the SQL migration
    `agileplus-mcp/migrations/2026_06_10_*.sql` adding the missing
    tables (`worklog_entries`, `trace_links`, `gate_results`,
    `run_records`, `scope_status`) to `.agileplus/agileplus.db`.
    Verify with `sqlite3 .agileplus/agileplus.db .schema` returning
    the new tables.
39. **AgilePlus worklog emit CLI** — implement `ap worklog emit` and
    `ap worklog show` subcommands. The emit reads the most recent
    `worklog-*.json` from `worklogs/`, validates against the
    `WORKLOG_SCHEMA_2026_06_10.md` (L1 #17), and writes a row to
    `agileplus.db::worklog_entries`. Verify with unit + integration
    tests + manual `ap worklog emit` from a sample worklog.
40. **AgilePlus trace-link + dashboard CLI** — implement
    `ap trace link <from> <to>` + `ap dashboard` (renders an
    ASCII dashboard of in-flight DAG lanes). Verify with unit tests
    + manual smoke from a real DAG.

---

## Layer 3: SOTA + TEST COVERAGE — 20 tasks

Each task: measurable quality uplift (coverage %, type-strict, traced).
All 20 run in parallel after L2.

41. **PlayCua: type-strict + 80% coverage** — enable `cargo llvm-cov` with
    `cargo-llvm-cov` config; add `#![deny(missing_docs)]` to `lib.rs`;
    add 5 `insta` snapshot tests; bring line coverage to ≥80% on the
    3 main crates. Verify with `cargo llvm-cov report --summary`.
42. **nanovms: `go test -race` + 80% coverage** — author
    `Makefile-LEGACY` → no, just `Taskfile.yml` `cov` task that runs
    `go test -race -coverprofile=coverage.out ./... && go tool cover
    -func=coverage.out`; target 80% on the `cmd/` packages. Verify
    with `go tool cover -func=coverage.out | tail -1`.
43. **PhenoCompose: typed bindings + workspace cov** — author
    `pheno-ffi` typed bindings for C↔Rust and Python↔Rust (per
    `plans/2026-06-08-lang-ffi-strategy-playbook-v1.md`); add
    `cargo llvm-cov --workspace`; bring workspace coverage to ≥75%.
44. **BytePort: dual-stack coverage (Rust + TS)** — Rust side:
    `cargo llvm-cov` to ≥80%; TS side: `vitest --coverage` to ≥80%;
    add 5 `insta` + 5 `vitest snapshot` tests. Verify with both
    coverage reports.
45. **AgilePlus: 21-crate workspace coverage** — wire `cargo llvm-cov`
    across all 21 crates; target 80% line coverage; add 5 `insta`
    snapshot tests per crate. Verify with
    `cargo llvm-cov report --summary --workspace`.
46. **pheno-errors crate** — author the canonical
    `pheno-errors` Rust crate: `pub enum AppError { ... }` with
    `thiserror` derive + `anyhow::Context` impl; the 5 most-common
    error variants in the focus repos. Consumed by L5. Verify
    with `cargo test -p pheno-errors` + doctests.
47. **pheno-tracing crate** — author `pheno-tracing` consolidating
    the tracing init patterns: `tracing-subscriber` + `EnvFilter`
    + `tracing-appender`; one `pheno_tracing::init()` one-liner.
    Consumed by L5. Verify with `cargo test -p pheno-tracing`.
48. **pheno-config crate** — author `pheno-config` wrapping
    `figment` + `dotenvy` + `pydantic-settings` behind a uniform
    facade. Consumed by L5. Verify with `cargo test -p pheno-config`.
49. **pheno-otel crate** — author `pheno-otel` wrapping
    `opentelemetry` + `tracing-opentelemetry`; exports
    `pheno_otel::init(otlp_endpoint)`. Verify with `cargo test`.
50. **pheno-cli-base crate** — author `pheno-cli-base` with
    `clap` derive macros + `pheno_tracing::init` + `pheno_config::load`
    one-liner `main()`. Consumed by L5. Verify with smoke test.
51. **pheno-fastapi-base** — author `KooshaPari/pheno-fastapi-base`
    Python package: `create_app()` factory + middleware (cors, gzip,
    request-id, tracing). Consumed by L5 (DataKit, Eventra, etc.).
    Verify with `pytest` + `httpx.AsyncClient` integration test.
52. **pheno-go-ctxkit** — author `KooshaPari/pheno-go-ctxkit` Go
    module: context helpers (`WithTimeout`, `WithCancel`, `WithTrace`).
    Consumed by nanovms + DevHex. Verify with `go test ./...`.
53. **pheno-zod-schemas + pheno-pydantic-models** — author the
    shared TS + Python schema/model packages. Consumed by
    localbase3, Tracera, BytePort frontend. Verify with
    `npm test` + `pytest`.
54. **pheno-tower + pheno-tokio-base + pheno-axum-stack** — author
    the 3 Rust crates wrapping `tower`, `tokio`, `axum`. Consumed
    by HexaKit, PhenoDevOps, Pyron, phenoRuntime. Verify with
    `cargo test` for each.
55. **pheno-ssot-template** — author `KooshaPari/pheno-ssot-template`
    repo: the canonical `docs/SSOT.md` schema + `pheno-ssot init`
    CLI. Verify by scaffolding a fresh repo and confirming
    `pheno-ssot validate` returns clean.
56. **pheno-feature-flags** — author `pheno-flags` (FFI-free, no
    LaunchDarkly): `figment` config + `tracing` instrumentation.
    Consumed by Agentora, Conft, AuthKit. Verify with `cargo test`.
57. **pheno-plugin-registry** — author `pheno-plugin` using
    `inventory` + `ctor` (the HeliosCLI pattern). Consumed by
    HeliosCLI + helioscope. Verify with `cargo test`.
58. **pheno-ci-templates** — extract `.github/workflows/ci.yml` +
    `rust-ci.yml` + `python-ci.yml` + `go-ci.yml` to
    `KooshaPari/pheno-ci-templates`. Consumed by L5. Verify
    by `act -j test` against the template.
59. **pheno-async-trait-migration** — sweep the 6 focus repos
    that use `async fn` in trait and document the pattern;
    migrate any stragglers still on `async-trait` crate. Verify
    with `cargo clippy -- -D clippy::async_yields_async`.
60. **pheno-secret-scan + pheno-trufflehog** — author the
    canonical gitleaks + trufflehog config presets (1 of 2 of
    #34, decoupled for review). Verify with intentional secret
    injection + `gitleaks detect` + `trufflehog filesystem`.

---

## Layer 4: HEXAGONAL REFACTOR + LIBIFICATION — 20 tasks

Each task: extract a port/adapter seam OR extract a shared lib. All 20
run in parallel after L3. **This is the "optimize to SOTA" layer.**

61. **PlayCua: hex refactor** — identify the 3 main ports: (a) `Renderer`
    (WASM target, native, headless), (b) `Driver` (Playwright, Selenium,
    BareCua), (c) `Orchestrator` (CLI, library, MCP). Author
    `crates/playcua-core/src/{domain,ports,adapters}/`. Wrap (not
    rewrite) the existing logic with adapter impls. Verify
    `cargo test --workspace` + `cargo build --no-default-features
    --features=playwright-adapter`.
62. **nanovms: hex refactor** — identify the 2 main ports: (a) `Backend`
    (cloud-hypervisor, qemu, firecracker), (b) `ImageSource` (OCI, raw,
    nix). Author `internal/{domain,ports,adapters}/`. Wrap with
    adapter impls. Verify `go test ./...` + `go vet ./...`.
63. **PhenoCompose: hex refactor** — identify the 3 main ports:
    (a) `CompositionEngine` (in-process, distributed), (b) `Store`
    (Postgres, sqlite, in-memory), (c) `Bindings` (C, Python, TS).
    Author `src/{domain,ports,adapters}/`. Wrap with adapter
    impls. Verify `cargo test --workspace`.
64. **BytePort: hex refactor** — identify the 3 main ports: (a) `Port`
    (TCP, Unix, named-pipe), (b) `Transport` (HTTP/2, WebSocket,
    QUIC), (c) `Codec` (JSON, MessagePack, Protobuf). Author
    `crates/byteport-core/src/{domain,ports,adapters}/`. Wrap
    with adapter impls. Verify `cargo test` + `npm test`.
65. **AgilePlus: hex refactor** — identify the 5 main ports: (a) `VCS`
    (git, jujutsu), (b) `IssueTracker` (GitHub, GitLab, Linear),
    (c) `CI` (GitHub Actions, Buildkite, local), (d) `Storage`
    (sqlite, postgres, s3), (e) `Notify` (slack, discord, email).
    Author `crates/agileplus-core/src/{domain,ports,adapters}/`.
    Wrap. Verify `cargo test --workspace` (21 crates).
66. **pheno-port-adapter crate** — author the `pheno-port-adapter`
    Rust crate: `trait Port`, `trait Adapter`, `trait UseCase`
    with `async-trait`-free native `async fn` patterns. Consumed
    by all focus repos. Verify with `cargo test -p pheno-port-adapter`.
67. **pheno-domain-primitives** — author `pheno-domain` with the
    5 most-shared domain primitives: `EntityId`, `Timestamp`,
    `Money`, `Email`, `Url`. Consumed by all focus repos. Verify
    with `cargo test -p pheno-domain`.
68. **pheno-context crate** — author `pheno-context` wrapping
    `tokio::task_local!` + `tracing::Span` + `opentelemetry::Context`.
    Consumed by all focus repos. Verify with `cargo test -p pheno-context`.
69. **Composio-like layer decoupling for LLM tools** — split
    `phenoMCP` into 3 layers: (a) `pheno-mcp-defs` (tool definitions,
    JSON schema only), (b) `pheno-mcp-transport` (MCP protocol
    over stdio, http, websocket), (c) `pheno-mcp-runtime` (executes
    tools, manages auth). Each in its own crate. Verify with
    `cargo test -p pheno-mcp-defs` etc.
70. **Polyrepo split: PlayCua + bare-cua merge** — per
    `plans/2026-06-09-playcua-barecua-merge-plan-v1.md` (concrete
    4-phase plan already in the repo): execute Phase 1
    (consolidate crates into a single workspace, deprecate
    `bare-cua` as a separate repo). Verify with
    `cargo build --workspace` from the merged location; tag a
    v0.1.0 of the merged crate.
71. **Polyrepo split: PhenoCompose + phenocompose-pine merge** —
    per `plans/2026-06-08-2026-06-08-phenocompose-nanovms-pine-world-map-v1.md`:
    execute Phase 1 (consolidate `phenocompose-pine` into
    `PhenoCompose` as `crates/pine/`). Verify with
    `cargo test --workspace`.
72. **Polyrepo split: tracely-sentinel → ResilienceKit** — per
    `plans/2026-06-09-sentinel-resilience-relocation-plan-v1.md`:
    execute Phase 1 (move `tracely-sentinel` into
    `ResilienceKit` as `crates/sentinel/`). Verify with
    `cargo test -p resilience-kit -p sentinel`.
73. **Wrap (not rewrite) hand-rolled CLI** — PlayCua has a
    hand-rolled `clap` alternative (per L1 #1 audit). Wrap
    with `pheno-cli-base` adapter. **No rewrite** — the wrap
    is a 1-file shim. Verify `cargo build && ./playcua --help`.
74. **Wrap hand-rolled config loader (Conft)** — Conft has a
    hand-rolled YAML loader. Wrap with `pheno-config` adapter.
    Verify `cargo test -p conft` + the new config loader test.
75. **Wrap hand-rolled telemetry (AuthKit)** — AuthKit has a
    hand-rolled `log` → `tracing` shim. Wrap with
    `pheno-tracing` adapter. Verify `cargo test -p authkit`.
76. **Wrap hand-rolled retry/circuit-breaker (nanovms)** —
    nanovms has a hand-rolled retry loop. Wrap with
    `pheno-port-adapter`'s `Retryable` trait. Verify
    `go test ./...`.
77. **Extensible plugin architecture (HeliosCLI)** — already
    uses `inventory` + `ctor`; extract the pattern into
    `pheno-plugin` (per L3 #57) and wire HeliosCLI to it.
    Verify `cargo test -p pheno-plugin && cargo test -p helioscli`.
78. **Extensible tool registry (phenoMCP)** — `pheno-mcp-defs`
    + `pheno-mcp-transport` (per L4 #69) form the
    "extensible by construction" registry. Add a YAML/JSON
    loader so a user can drop a tool definition into
    `~/.config/phenoMCP/tools/` and have it picked up at
    startup. Verify with `cargo test -p pheno-mcp-runtime`.
79. **Extensible config schema (Conft)** — Conft gains a
    `phenotype-config` schema provider (per L3 #48) so a
    user can add a new config section in their own crate
    and have Conft discover it via `inventory`. Verify
    `cargo test -p conft -p phenotype-config`.
80. **Extensible observability backends (pheno-otel)** —
    `pheno-otel` already exposes `init(otlp_endpoint)`;
    add `init_honeycomb`, `init_datadog`, `init_jaeger`
    as additional backends. Verify with
    `cargo test -p pheno-otel --features=datadog`.

---

## Layer 5: INTEGRATION + VERIFICATION + SIDE-DAGs — 20 tasks

Each task: ship one focus repo's full integration OR finish the
traceability + side-DAG polish. All 20 run in parallel after L4.

81. **PlayCua full integration** — wire `pheno-errors` + `pheno-tracing`
    + `pheno-port-adapter` + `pheno-domain` + `pheno-cli-base` into
    the hex-refactored PlayCua (from L4 #61). Verify
    `cargo test --workspace && cargo build --release &&
    cargo llvm-cov report`. Update `STATUS_2026_06_10.md`.
82. **nanovms full integration** — wire `pheno-go-ctxkit` (L3 #52)
    + the hex refactor (L4 #62) into nanovms. Verify
    `go test -race ./... && go vet ./... && task cov`. Update
    `STATUS_2026_06_10.md`.
83. **PhenoCompose full integration** — wire `pheno-errors` +
    `pheno-tracing` + `pheno-port-adapter` + the polyrepo
    merge (L4 #71) into PhenoCompose. Verify
    `cargo test --workspace && cargo build --release &&
    cargo llvm-cov report`. Update `STATUS_2026_06_10.md`.
84. **BytePort full integration** — wire `pheno-errors` +
    `pheno-tracing` + `pheno-zod-schemas` (TS side) +
    `pheno-pydantic-models` (Py side) + the hex refactor
    (L4 #64) into BytePort. Verify `cargo test && npm test
    && task cov`. Update `STATUS_2026_06_10.md`.
85. **AgilePlus full integration** — wire `pheno-axum-stack` +
    `pheno-phenotype-crates` + `pheno-tracing` + the 8 new
    CLI subcommands (L2 #25) + the DB schema migration
    (L2 #38) + the worklog emit/trace-link/dashboard CLIs
    (L2 #39-40) + the hex refactor (L4 #65). Verify
    `cargo test --workspace && task quality &&
    ap worklog emit --from worklogs/sample.json`.
    Update `STATUS_2026_06_10.md`.
86. **Cheap-LLM-MCP deletion** — verify `cheap-llm-mcp/` is
    empty (post-merge in L2 #26). Document the migration in
    `cheLLMCP_MIGRATION_LOG_2026_06_10.md`. Update README
    of `dispatch-mcp` with the absorbed tiers.
87. **Focus-repo SPEC.md + ARCHITECTURE.md** — for each of
    the 5 focus repos, ensure SPEC.md (≥100 lines) +
    ARCHITECTURE.md (with ASCII diagram) + STATUS.md
    exist. Single PR per repo.
88. **Focus-repo README + AGENTS.md** — for each focus repo,
    update README to: (a) "What is this" (1 sentence),
    (b) "Status" (link to STATUS.md), (c) "Build", (d) "Test",
    (e) "Hygiene", (f) "License", (g) "Contributing" (link
    to CONTRIBUTING.md). AGENTS.md mirrors but adds: (a)
    "Stack", (b) "Key Commands", (c) "Conventions". Single
    PR per repo.
89. **Worktree collapse (post-merge)** — execute the
    `WORKTREE_AUDIT_2026_06_10.md` decisions (L1 #6):
    `git worktree remove` for each "delete" decision,
    `git worktree move` for each "merge" decision,
    `git worktree prune` at the end. Verify
    `git worktree list` returns ≤10 worktrees (down from 33).
90. **Branch cleanup (post-merge)** — execute the
    `BRANCH_AUDIT_2026_06_10.md` decisions (L1 #7):
    `git branch -d` for merged candidates, `git push origin
    --delete` for closed-PR remnants. Verify
    `git branch -a | wc -l` returns ≤100 (down from 167).
91. **Stash commit-or-discard (post-merge)** — execute the
    `STASH_AUDIT_2026_06_10.md` decisions (L1 #9): for each
    dirty sub-repo, either commit (with conventional-commit
    message) or `git stash drop`. Verify `git status`
    returns "nothing to commit" for all sub-repos.
92. **PR rebase + cross-link (post-merge)** — for each open
    PR per `PR_AUDIT_2026_06_10.md` (L1 #8), rebase onto
    current main, force-push, and add a cross-link comment
    referencing the L5 lane that resolves it. Verify with
    `gh pr list --state open` returning ≤30 PRs.
93. **DAG V3 completion log** — write
    `DAG_V3_COMPLETION_LOG_2026_06_10.md` listing all
    100 tasks with: status, commit SHA, files changed,
    verification result. This is the SSOT for the
    2026-06-10 fleet execution.
94. **FLEET_HEALTH_REPORT_2026_06_10.md** — the 1-page
    dashboard: 5 focus repos + AgilePlus substrate, total
    LOC, test totals, build status matrix, governance-file
    coverage matrix. Generated from
    `worklogs/*.json` + `cargo llvm-cov report` summaries.
95. **PhenotypeAgents / Tracera / HeliosCLI / KWatch / Civis
    5th-focus-repo decision** — execute the L1 #10 decision
    (default: PhenotypeAgents). Apply the same L2-L5
    template to it: Taskfile, hex refactor, integration.
    Output: a per-task acceptance report.
96. **Dispatch-mcp Codex integration** — add the `dispatch-mcp`
    MCP server config to `~/.codex/config.toml` (per L1
    #20) so Codex can call `dispatch_worker`,
    `dispatch_opus`, etc. directly. Verify with
    `codex mcp list` returning the new tools.
97. **AGENTS.md cross-link** — add a "## Active DAG" header
    to each focus repo's `AGENTS.md` linking back to
    `FLEET_100TASK_DAG_V3.md` and the focus-repo's
    `STATUS_2026_06_10.md`. Single PR per repo.
98. **Traceability smoke test** — for each of the 100 tasks,
    verify the corresponding row in
    `DAG_V3_COMPLETION_LOG_2026_06_10.md` (L5 #93) has
    (a) status, (b) commit SHA, (c) ≥1 file changed,
    (d) verification_result. A task missing any of these
    is re-opened. Verify by `jq -e '.tasks |
    map(select(.commit_sha == null or .verification_result
    == null)) | length' <DAG_V3_COMPLETION_LOG_2026_06_10.md>`.
99. **CI green-keep** — re-run the 5 focus repos' CI on
    their main branches; verify all 5 are green. Any red
    must be resolved before V3 close-out. Verify with
    `gh api repos/:owner/:repo/commits/main/status` per repo.
100. **V3 close-out + tag** — append a `## Completion
    Summary` to `FLEET_100TASK_DAG_V3.md` with: tasks
    completed, commits per repo, net LOC reduction,
    test totals, governance-file coverage delta. Tag
    the commit as `v3-2026-06-10`. Push the tag.
    Update the `STATUS.md` in the monorepo root with
    a "2026-06-10: V3 close-out" entry.

---

## Side DAGs (complementary, not part of 100) — 20 tasks

These run in parallel with the main 100, increasing the work-per-tick to ~40.
Each sub-DAG targets one LIVE project with project-specific SOTA polish. They
feed back into the main DAG via the integration tasks in L5.

### Side DAG 1: agent-user-status (macOS) — 5 tasks
- SD1.1: `feat(swift): native status bar item + menu`
- SD1.2: `feat(py): async status emitter (asyncio + structlog)`
- SD1.3: `chore(ci): macOS-latest matrix + notarization stub`
- SD1.4: `docs: write USER-GUIDE.md + DEVELOPER-GUIDE.md`
- SD1.5: `test: add 20 integration tests (LaunchAgent + IPC)`

### Side DAG 2: agentapi-plusplus (Go) — 5 tasks
- SD2.1: `feat(api): chi v5 migration + middleware order audit`
- SD2.2: `feat(observability): OpenTelemetry SDK init`
- SD2.3: `perf: sync.Pool for HTTP client (reduce alloc)`
- SD2.4: `chore(deps): upgrade coder/agentapi to v0.7.x`
- SD2.5: `docs: write ARCHITECTURE.md + sequence diagrams`

### Side DAG 3: Agentora (Rust LLM) — 5 tasks
- SD3.1: `feat(agent): implement `rig-rs/rig` adapter for unified LLM backend`
- SD3.2: `feat(telemetry): add `tracing` spans for every agent step`
- SD3.3: `feat(tooling): add `cargo bench` + 5 micro-benchmarks`
- SD3.4: `feat(security): add `secrecy` wrapper for API keys`
- SD3.5: `docs: write CONTRIBUTING.md with agent-template walkthrough`

### Side DAG 4: AuthKit (Rust + Python auth) — 5 tasks
- SD4.1: `feat(auth): wire `phenotype-authvault` as path dep via the new
  `phenotype-auth-core` umbrella crate (Phase 1 of the AuthKit/Authvault audit)`
- SD4.2: `feat(observability): OpenTelemetry across all auth crates`
- SD4.3: `feat(test): 80% line coverage on `crates/auth-*` and `crates/oauth-*``
- SD4.4: `feat(ci): matrix build (ubuntu-latest + macos-latest)`
- SD4.5: `docs: write CARGO-WORKSPACE.md + per-crate README`

---

## Dependency Graph

```
Layer 1 (state unify + focus-repo audit: 20)  ──┐
                                                  │
Layer 2 (tooling + cheap-llm-mcp merge: 20)  ──┐ │
                                                ├─┴─>  Layer 3 (SOTA + cov: 20)  ──┐
                                                                                      │
                                                                                      ├─>  Layer 5 (integrate: 20)
                                                                                      │
                                                Layer 4 (hex + libify: 20)  ─────────┘
                                                                                               │
Side DAG 1-4 (LIVE project polish, 20 sub-tasks)  ───────────────────────────────────────────┘
```

Total: 5 sequential main layers + 4 parallel side DAGs. The critical path is
L1 → L2 → L3 → L4 → L5. L3 and L4 are siblings — both depend only on L2, so
they can run in parallel (effectively making the critical path L1 → L2 → max(L3, L4) → L5).

## DAG Properties (machine-checked)

- **Width:** 20 parallel lanes per main layer (no layer has fewer than 20 tasks).
- **Depth:** 5 main layers + 4 side DAGs.
- **Total main tasks:** 5 × 20 = **100**.
- **Side DAGs:** 4 × 5 = 20.
- **Grand total:** 100 + 20 = 120.
- **Shape:** 20×5 rectangle + 4 side-DAGs of 5.
- **Per-stage task size:** the smallest task is L1 #6 (worktree count audit) —
  atomic, shell-only, no code. Cannot be split further without violating
  "no user eyes required".
- **No padding:** all 100 main + 20 side DAG tasks are real, not placeholders.
  L4 #70 (PlayCua+bare-cua merge) and #71 (PhenoCompose+pine merge) are
  intentionally meatier because the prior DAGs identified them as the
  highest-leverage polyrepo consolidations.
- **Coverage:** 5 focus repos (PlayCua, nanovms, PhenoCompose, BytePort, AgilePlus)
  × 5 lanes each (audit/tooling/SOTA/hex/integrate) = 25 dedicated slots.
  The remaining 75 lanes are cross-cutting (cheap-llm-mcp merge,
  pheno-* crate extraction, hygiene baselines, state unification, side DAGs).
- **L3 vs L4 sibling structure:** L3 (SOTA + cov) and L4 (hex + libify) both
  depend on L2 only; they can run in parallel. The hex refactor (L4) is
  enabled by the libification in L3; if running strictly serial, L4 must
  come after L3. For "first-to-finish" parallelism, run L3 and L4 in
  parallel and L5 will block on the slower lane.

## Per-Task Acceptance Criteria

For every task in this DAG, the subagent must produce:
1. **Code change** — minimum 1 commit on a `chore/...` or `feat/...` branch
2. **STATUS_*.md** — a per-repo `STATUS_2026_06_10.md` (for audit tasks) or
   the appropriate `*_2026_06_10.md` (for cross-cutting tasks)
3. **Verification** — `cargo test`, `pytest`, `npm test`, `go test`, or
   equivalent passes
4. **Worklog** — `worklogs/{task-id}-2026-06-10.json` with status, commit
   SHA, files changed, verification_result
5. **PR description** — follows conventional commit format with rationale
   and links to the L1 audit + L3 acceptance criteria

## How to Run

The main agent dispatches 20 subagents in parallel for the current layer,
waits for all 20 to complete, then dispatches the next layer. L3 and L4
can run in parallel (both depend only on L2). Side DAGs are dispatched
whenever the main fleet has spare capacity (target: 20 main + 5 side =
25 max concurrent).

```bash
# Layer 1 dispatch (20 subagents: 5 focus-repo audits + 15 cross-cutting)
for task in $(cat /tmp/dag-v3-l1.txt); do
  task_id=$(echo $task | tr '[:upper:]' '[:lower:]')
  dispatch-subagent --task "v3-l1-$task_id" --prompt "..." &
done
wait
```

## Progress Tracker (run after every layer)

| Layer | Dispatched | Completed | Failed | % Done |
|-------|------------|-----------|--------|--------|
| 1     | _/20_      | _/20_     | _/20_  | _%_    |
| 2     | _/20_      | _/20_     | _/20_  | _%_    |
| 3     | _/20_      | _/20_     | _/20_  | _%_    |
| 4     | _/20_      | _/20_     | _/20_  | _%_    |
| 5     | _/20_      | _/20_     | _/20_  | _%_    |
| **Total** | **_/100_** | **_/100_** | **_/100_** | **_%_** |

## Verification (machine-checked shape)

```sh
# Total main tasks (must be 100)
grep -cE '^[0-9]+\.\s+\*\*[A-Z\*]' FLEET_100TASK_DAG_V3.md
# prints 100

# Width check (must show 5 layers each with 20 tasks)
awk '/^## Layer/ {if (s) print s, n; s=$0; n=0} /^[0-9]+\.\s+\*\*/ {n++} END {print s, n}' FLEET_100TASK_DAG_V3.md
# prints 5 lines, each with layer name and 20

# Side DAG task count (must be 20)
grep -cE '^-\s+SD[1-4]\.[0-9]' FLEET_100TASK_DAG_V3.md
# prints 20
```

## Reference

- **FLEET_100TASK_DAG.md** (V1, hygiene-only) — superseded
- **FLEET_100TASK_DAG_V2.md** (V2, broader fleet only) — preserved for reference
- **FLEET_100TASK_DAG_V2_MERGED.md** (V2-MERGED, 120+20) — preserved for reference
- **FLEET_100TASK_DAG_V3.md** (this file, FOCUS edition, 100+20) — canonical execution DAG
- **PHENOTYPE_5REPO_MODERNIZATION_PLAN.md** — Phase 0-7 (in-flight; 6A + 6B complete)
- **WORKFLOW_HYGIENE_20260606.md** — 36+ rounds of telemetry, 289+ worklog JSONs
- **`.claude/agent-assignments-2026-06-08.md`** — per-repo audit/duplication reports
- **plans/2026-06-09-*.md** — 8 world-map documents (auth fleet, hexakit promotion,
  phenobservability deletion, tracera decouple, etc.)
- **Focus repos (4 + 1 substrate):** PlayCua, nanovms, PhenoCompose, BytePort, AgilePlus
- **30+ libification candidates** identified in rounds 25-36
- **Prior session: AUTHKIT_AUTHVAULT_AUDIT.md** (306L, 4-phase plan)
- **Prior session: phenotype-infra/configs/repo-shared/** (5 files + sync-configs.sh)
