# 3-Repo Retirement — KLA + KVirtualStage + KWatch (L5-200)

**Date:** 2026-06-22
**Status:** AUDIT + PLAN (awaiting user approval before migration PRs)
**Pattern reference:** `findings/2026-06-18-L5-109-4-repo-retirement.md` (kwality + 3 others; same wave-merge-archive-delete shape)
**Override policy:** `KVirtualStage` README "STRICTLY DO NOT DELETE NOR UNARCHIVE" is overridden by the user's higher-level org consolidation directive. Mirrors the kwality precedent (L5-109 § "Policy decisions").

---

## 1. Executive summary

3 source repos, 3 absorption target repos, 3 migration PRs, 1 audit doc, 3 GitHub-UI deletes.

| # | Source repo | Lang | LOC | Target repo | Absorption path | Migration PR (planned) |
|---|---|---|---|---|---|---|
| 1 | `KooshaPari/KommandLineAutomation` (KLA) | Rust | ~2,357 | `KooshaPari/helios-cli` | `crates/harness_recorder/` (new crate in existing CLI workspace) | `KooshaPari/helios-cli#<n>` |
| 2 | `KooshaPari/KVirtualStage` (KVS) | Rust + Go | ~16,000 | `KooshaPari/phenotype-tooling` | `absorption/kvirtualstage/` (collection under existing kwality pattern) | `KooshaPari/phenotype-tooling#<n>` |
| 3 | `KooshaPari/KWatch` | Go | ~18,289 | `KooshaPari/phenotype-ops` | `agent-devops-setups/kwatch/` (federated service) | `KooshaPari/phenotype-ops#<n>` |

**No new repos.** Per user directive (no new repos) + ADR-023 Rule 3 (reusable capabilities go into existing substrate, not a new "phenoShared").

**KVS "STRICTLY DO NOT DELETE NOR UNARCHIVE" override:**
- User's directive in this turn is the higher-authority instruction. The repo-level README cannot override org-level governance.
- The source repo will be archived (read-only marker) + user-deleted via GitHub UI (90-day retention tombstone applies).
- All source, tests, docs, and architecture artifacts are preserved in the absorption path.

---

## 2. Source inventory

### 2.1 KLA — `KooshaPari/KommandLineAutomation`

**Description:** Rust PTY CLI recorder (Playwright-for-CLI). Records terminal sessions to screenshots / GIFs / scripted demos.

**Language:** Rust 2021, MIT, single-crate workspace.

**Code (2,357 LOC, all under `src/`):**

| Path | LOC | Capability |
|---|---|---|
| `src/main.rs` | (entry) | Binary `kla` |
| `src/lib.rs` | (root) | Public API |
| `src/cli/{commands,mod}.rs` | (CLI) | clap-derived subcommands |
| `src/pty/{capture,controller,mod}.rs` | (PTY) | Cross-platform PTY spawn/capture (`portable-pty`) |
| `src/capture/*` (via `media/`) | (capture) | Terminal capture engine |
| `src/media/{recorder,gif,screenshot,mod}.rs` | 549 | PNG/GIF generation (`image` + `gif` crates) |
| `src/script/{types,loader,mod}.rs` | (script) | YAML script parser (VHS-style `.kla.yaml`) |
| `src/terminal.rs` | (terminal) | `vt100` terminal emulation |
| `src/error.rs` | (errors) | `thiserror` types |
| `ARCHITECTURE.md` | (arch doc) | 4-component breakdown (script/pty/capture/cli) |
| `CHANGELOG.md`, `README.md`, `SECURITY.md`, `LICENSE`, `Cargo.toml`, `Cargo.lock` | (meta) | Standard meta-bundle |
| `examples/*.kla.yaml` (5 files) | (examples) | Demo scripts (git-workflow, simple-demo, recursive-demo, meta-demo, kla-showcase) |
| `demos/*.png` (10 PNGs) | (media) | Demo screenshots |

**Existing org wiring:** Already depends on `KooshaPari/rich-cli-kit` (rck-core) — i.e., the recorder is **already integrated with the org's CLI substrate**. This is the strongest signal that KLA belongs in the helios-cli workspace, not in a new repo.

**Dependencies:** `portable-pty`, `crossterm`, `clap`, `tokio`, `serde`, `image`, `gif`, `vt100`, `rck-core` (git), `anyhow`, `thiserror`. All crate.io or already-org-vendored.

**Preserve:** All `.rs`, `Cargo.toml`, `Cargo.lock`, `ARCHITECTURE.md`, `CHANGELOG.md`, `LICENSE`, `examples/*.kla.yaml`. ARCHITECTURE.md should become the new crate's `docs/architecture.md`.

**Drop:** `demos/*.png` (regenerable from example scripts on first build). `.github/workflows/ci.yml` (target repo will have its own CI).

### 2.2 KVirtualStage — `KooshaPari/KVirtualStage`

**Description:** Multi-crate desktop automation platform + agent-computer interface. "STRICTLY DO NOT DELETE NOR UNARCHIVE" in repo description — **user override applies**.

**Languages:** Rust (4 sub-crates) + Go (1 sub-crate). Mixed MIT/Apache.

**Code (~16,000 LOC across sub-crates):**

| Sub-crate | Lang | LOC | Capability |
|---|---|---|---|
| `credential_manager/` | Rust | 3,099 | Vault + crypto (ring, argon2, chacha20poly1305) + OAuth + sled/sqlx storage + TOTP + QR codes |
| `kvirtualdesktop-core/` | Rust | 2,067 | MCP protocol types, security, transport (json + http + ws) |
| `kvirtualdesktop/` | Rust | 3,107 | Main `kvd` binary, docker_manager, resource_manager (libvirt/bollard features), TUI |
| `kvirtualdesktop-mcp-server/` | Rust | 595 | MCP server surface (connects to `kvirtualdesktop-core`) |
| `kvirtualstage-go/` | Go | 6,368 | `cmd/{tui,server,cli}` + `internal/{api,cli,middleware,tui,config}` + Gin server + GraphQL + Prometheus + JWT |
| **Subtotal (code)** | | **~15,236** | |

**Documentation (markdown, keep selectively):**

| Path | Keep? | Why |
|---|---|---|
| `README.md` | YES (as `absorption/kvirtualstage/README.md`) | Repo entry-point |
| `architecture/*.md` (8 files: media_recording, animation_timing, audio_virtualization, intent_simulation, export_format_optimization, ffmpeg_pipeline, natural_interaction, automation_engine) | YES (as `absorption/kvirtualstage/architecture/`) | Core system architecture |
| `KVIRTUALSTAGE_SYSTEM_ARCHITECTURE.md` | YES | Top-level arch |
| `VIRTUAL_DESKTOP_ARCHITECTURE.md` | YES | Desktop-specific |
| `AUTOMATION_ENGINE_SUMMARY.md` | YES | Engine summary |
| `MEDIA_RECORDING_ARCHITECTURE_SUMMARY.md` | YES | Media recording |
| `ENTERPRISE_PRODUCTION_*` (4 files) | SELECTIVELY (just the canonical one) | Mostly validation reports; keep `ENTERPRISE_PRODUCTION_READINESS_VALIDATION.md` only |
| `CAPTURE_EXECUTION_REPORT.md` | NO (or move to subdir) | One-off validation log |
| `ENTERPRISE_PRODUCTION_FINAL_STATUS.md` | NO | Validation log |
| `KVIRTUALSTAGE_ENTERPRISE_VIDEO_STRATEGY.md` | NO | Marketing/strategy, not code |
| `KVIRTUALSTAGE_EVOLUTION_PLAN.md` | NO | Aspirational roadmap |
| `enterprise-user-stories.md` | NO | User stories, not spec |
| `feature_gap_analysis_summary.md` | NO | Analysis, not spec |
| `FEATURE_VALIDATION_REPORT.md` | NO | Validation log |
| `VALIDATION_SUMMARY.md` | NO | Validation log |
| `research_findings_desktop_automation.md` | NO | Research |
| `research_output/` (dir) | NO | Research artifacts |
| `security_credentials_research.md` | NO | Research |
| `technical_architecture_recommendations.md` | NO | Recommendations (vs. canonical architecture docs) |
| `Cargo.toml.bak` | NO | Vestigial |
| `setup.sh` | YES (as `absorption/kvirtualstage/setup.sh`) | Setup script |
| `claude-flow.{bat,ps1}` | NO | Claude-Flow plugin artifacts |
| `kvirtualdesktop/{scripts,dockerfiles}/` | YES (as `absorption/kvirtualstage/kvirtualdesktop/{scripts,dockerfiles}/`) | Docker + scripts for desktop container |
| `kvirtualdesktop-mcp-server/` | See sub-crate above | |
| `kvirtualdesktop-core/` | See sub-crate above | |
| `kvirtualstage/` | (only has `.DS_Store` in shallow clone) | Empty? |
| `kvirtualstage-go/` | See sub-crate above | |
| `AGENTS.md`, `CLAUDE.md`, `.gitignore` | NO | Target repo has its own |

**Capability fit assessment:**

| KVS capability | Best fit in target |
|---|---|
| `credential_manager` (Rust crypto/vault/oauth) | Could become standalone substrate `pheno-credentials` — but per "no new repos" directive, absorb into tooling collection |
| `kvirtualdesktop-mcp-server` | Could slot into `pheno-mcp-router` — but per "no new repos" directive, absorb into tooling collection |
| `kvirtualstage-go` (Gin + GraphQL + Prometheus) | Could slot into existing Go federated service — but per "no new repos" directive, absorb into tooling collection |

**Per "no new repos" rule**: All 5 sub-crates go into `phenotype-tooling/absorption/kvirtualstage/` as a **collection** (mirrors `phenotype-tooling/docs/absorbed-from-kwality/` from L5-109). This preserves the full multi-crate structure without scattering pieces across multiple substrates.

### 2.3 KWatch — `KooshaPari/KWatch`

**Description:** Go-only process watchdog + CLI. Monitors TypeScript/JavaScript project build status with TUI, HTTP API, MCP server, and security policy engine. Local clone at `repos/KWatch/`.

**Language:** Go 1.25, dual Apache-2.0 + MIT, single-module workspace.

**Code (18,289 LOC across `*.go` + `*.md` + `*.yml`):**

| Path | LOC | Capability |
|---|---|---|
| `main.go` | 15 | Entry shim → `cmd.Execute()` |
| `cmd/{root,daemon,run,status,history,security,mcp,config,cmd_test}.go` | (CLI) | Cobra subcommand tree (`root`, `daemon`, `run`, `status`, `history`, `security`, `mcp`, `config`) |
| `config/{config,config_test}.go` | (config) | YAML loader, env/CLI overrides, defaults |
| `runner/{runner,parser,types,runner_test,parser_test,types_test}.go` | (runner) | Watchdog engine — process supervision, exit-code handling, restart policy, signals, history |
| `server/{server,handlers,middleware,types,security_handlers}.go` | (server) | Long-lived daemon HTTP API (`/status`, `/status/compact`, `/run`, `/history`, `/health`) |
| `tui/{tui,model,update,view,styles,tui_test,watch_loop_integration_test}.go` | (TUI) | Bubbletea TUI panel reading runner state |
| `security/{patterns,scanner,git,types,database,security_test,helpers_test}.go` | (security) | Command allow/deny + secret scanning + audit log |
| `mcp/{server,server_test}.go` | (MCP) | MCP server surface for AI tool-call integration |
| `docs/ARCHITECTURE.md` | (arch doc) | Module layout, data flow, concurrency model |
| `docs/OPERATIONS.md`, `docs/FAQ.md`, `docs/SSOT.md`, `docs/index.md` | (ops docs) | Standard |
| `docs/boundary/KWatch.md`, `docs/intent/KWatch.md` | (boundary/intent) | Per `phenotype-ops` boundary + intent doc pattern |
| `CHANGELOG.md`, `README.md`, `SECURITY.md`, `SUPPORT.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE-{APACHE,MIT}`, `CITATION.cff`, `CLAUDE.md`, `AGENTS.md` | (meta) | Standard meta-bundle |
| `Makefile`, `Justfile` | (build) | Make + just recipes |
| `audit_scorecard.json` | NO (regenerable) | Per ADR-041 cadence |
| `.grade-reports/*.log` (6 files) | NO (regenerable) | Per `just grade` |
| `.kwatch/{kwatch.yaml,kwatch.log}` | NO (runtime) | Runtime artifacts |
| `.proc-history.json` (20 MB!) | NO (runtime) | Runtime artifact, regenerable |
| `kwatch` (binary) | NO (build artifact) | Regenerable |
| `screenshots/*` (binary assets) | NO (regenerable) | Regenerable |
| `node_modules/` | NO | Drop (was vestigial post-`e7eff93` TS layer removal) |
| `.claude/commands/*` (swarm/, sparc/) | NO | Target repo's choice |
| `.roomodes`, `.mcp.json` | NO | Target repo's choice |
| `VIBECODING_GUARD_BASELINE_2026_06_12.md` | NO | Per-repo baseline, not portable |
| `examples/` | YES (as `agent-devops-setups/kwatch/examples/`) | Example configs |
| `.pre-commit-config.yaml` | YES (inherited) | Pre-commit hooks |

**Existing org wiring:** Already standalone, no KooshaPari deps. Module path: `kwatch`.

**Dependencies (per `go.mod`):** `bubbletea v1.3.10`, `lipgloss v1.1.0`, `fsnotify v1.10.1`, `cobra v1.10.2`, `golang.org/x/term v0.44.0`, `yaml.v2`. All vanilla.

**Capability fit:** KWatch is a **process watchdog + CLI surface**. `phenotype-ops` is a federated service for ops/devops tooling. `agent-devops-setups/` already has `llama-cpp/` (one-off agent setups). Adding `agent-devops-setups/kwatch/` fits the existing pattern exactly.

---

## 3. Absorption targets — why these repos

### 3.1 KLA → `KooshaPari/helios-cli`

**Why helios-cli:**
1. **Already a Rust CLI workspace** with `crates/harness_*` convention (harness_queue, harness_runner, harness_spec, harness_verify, etc.). Adding `harness_recorder` follows the existing crate naming.
2. **Already wired to `rich-cli-kit` (rck-core)** — KLA's `Cargo.toml` already imports rck-core from `KooshaPari/rich-cli-kit`. helios-cli is the workspace that owns rck-core usage; KLA becoming a workspace member means it shares the same dependency resolution.
3. **KLA is a "Playwright-for-CLI"** — a recorder belongs with CLI tooling, not in a separate substrate.
4. **`pheno-cli-base`** would be an alternative, but it's a more abstract base crate (per `pheno-cli-base` naming pattern). A recorder is concrete + standalone, fits `harness_recorder` better.

**Absorption shape:** Single workspace member `crates/harness_recorder/` containing all KLA source + examples. helios-cli's root `Cargo.toml` adds `"crates/harness_recorder"` to `members`. Workspace-level `Cargo.lock` merges.

**Drop:** `demos/*.png`, `.github/workflows/ci.yml` (use helios-cli's CI).

### 3.2 KVirtualStage → `KooshaPari/phenotype-tooling`

**Why phenotype-tooling:**
1. **kwality precedent (L5-109)**: `phenotype-tooling/docs/absorbed-from-kwality/` absorbed 29,422 LOC of kwality source in a single PR. The pattern is proven.
2. **Multi-crate absorption**: KVS has 5 sub-crates (4 Rust + 1 Go). Putting them under `absorption/kvirtualstage/` mirrors the kwality collection shape.
3. **No new repos** directive: per user instruction "no new repos" — KVS becomes a collection, not a substrate.
4. **Capability coupling**: credential_manager + kvirtualdesktop-core + kvirtualdesktop + kvirtualdesktop-mcp-server are tightly coupled (the credential_manager is used by kvirtualdesktop-mcp-server via the protocol layer). Splitting them across substrates would break the dependency graph.

**Absorption shape:**
```
phenotype-tooling/absorption/kvirtualstage/
├── README.md                          # KVS entry-point (with override note)
├── ARCHITECTURE.md                    # Top-level
├── absorption.md                      # Per-source absorption record
├── setup.sh
├── credential_manager/                # Full Rust sub-crate
├── kvirtualdesktop-core/              # Full Rust sub-crate
├── kvirtualdesktop/                   # Full Rust sub-crate + docker + scripts
├── kvirtualdesktop-mcp-server/        # Full Rust sub-crate
├── kvirtualstage-go/                  # Full Go sub-crate
└── architecture/                      # 8 architecture docs (media_recording, animation_timing, ...)
```

**Drop:** Validation logs, research output, enterprise strategy docs, claude-flow scripts, target-owned meta files (AGENTS.md, CLAUDE.md, .gitignore), Cargo.toml.bak.

### 3.3 KWatch → `KooshaPari/phenotype-ops`

**Why phenotype-ops:**
1. **Existing federated service** for ops/devops tooling. Has `tools/{phenotype-manifest,phenotype-pin}` (Go devops tools) and `agent-devops-setups/llama-cpp/` (one-off agent setups).
2. **KWatch is exactly an "agent-devops-setup"**: a process watchdog + TUI + HTTP API + MCP server that monitors project build status. The pattern matches.
3. **`phenoObservability`** is for OTel/metrics/tracing/logging — KWatch is process supervision, not metric collection. Not the right fit.
4. **`phenotype-tooling`** could absorb KWatch as another collection, but KWatch is a complete runnable tool, not a collection of substrates. `phenotype-ops/agent-devops-setups/kwatch/` is the right shape.

**Absorption shape:**
```
phenotype-ops/agent-devops-setups/kwatch/
├── README.md                          # KWatch entry-point
├── ARCHITECTURE.md                    # (from docs/ARCHITECTURE.md)
├── OPERATIONS.md                      # (from docs/OPERATIONS.md)
├── FAQ.md
├── SSOT.md
├── boundary/KWatch.md
├── intent/KWatch.md
├── cmd/                               # Cobra subcommands
├── config/                            # Config loader
├── runner/                            # Watchdog engine
├── server/                            # HTTP API
├── tui/                               # Bubbletea TUI
├── security/                          # Policy engine
├── mcp/                               # MCP server
├── examples/                          # Example configs
├── Makefile
├── Justfile
├── go.mod                             # Module path: kwatch (unchanged)
├── go.sum
├── .pre-commit-config.yaml
├── LICENSE-APACHE
├── LICENSE-MIT
└── CITATION.cff
```

**Drop:** `.grade-reports/`, `.kwatch/` (runtime), `.proc-history.json` (runtime, 20 MB), `kwatch` binary, `screenshots/`, `node_modules/`, `.claude/commands/`, `.roomodes`, `.mcp.json`, `VIBECODING_GUARD_BASELINE_*.md`, `audit_scorecard.json`, `CLAUDE.md`/`AGENTS.md` (target has its own), `.grade-reports/`, `package.json` (vestigial post-`e7eff93`).

---

## 4. Migration plan

### 4.1 Wave ordering

Sequential PRs (independent — can be parallelized as 3 separate PRs):

| PR | Source → Target | Branch name | Estimated size |
|---|---|---|---|
| 1 | KLA → helios-cli | `feat/l5-200-kla-as-harness-recorder-2026-06-22` | +2,357 LOC |
| 2 | KWatch → phenotype-ops | `feat/l5-200-kwatch-as-agent-devops-2026-06-22` | +18,289 LOC |
| 3 | KVirtualStage → phenotype-tooling | `feat/l5-200-kvirtualstage-collection-2026-06-22` | +16,000 LOC |

### 4.2 Per-PR steps (canonical)

For each PR, the migration sequence is:

1. **Pre-flight**: Confirm target repo branch protection allows force-push-free merge (these are additive PRs).
2. **Cut branch** on the **target** repo from `main`.
3. **Copy source files** preserving git history (use `git subtree add` or `git remote add` + `git fetch` + `git merge --allow-unrelated-histories`):
   - `git remote add <src-slug> https://github.com/KooshaPari/<src>.git`
   - `git fetch <src-slug> main`
   - `git merge --allow-unrelated-histories <src-slug>/main --no-commit`
   - Resolve conflicts (likely none for additive paths), commit.
4. **Drop dead files** per the per-repo "Drop" list above.
5. **Update manifests**:
   - helios-cli: add `crates/harness_recorder` to workspace `members`, run `cargo check`
   - phenotype-ops: add `agent-devops-setups/kwatch/go.mod` to the federation if applicable (probably just colocate, no workspace)
   - phenotype-tooling: add `absorption/kvirtualstage/README.md` index
6. **Smoke tests**:
   - KLA: `cargo build -p harness_recorder`, `cargo test -p harness_recorder`
   - KWatch: `go build ./...` in `agent-devops-setups/kwatch/`, `go test ./...`
   - KVS: `cargo check` per Rust sub-crate, `go build ./...` in `kvirtualstage-go/`
7. **Open PR** with description linking this audit doc.
8. **Self-merge** per user directive (Track 8 pattern, bot merges with no HITL gate).
9. **Archive source repo** via `gh repo archive KooshaPari/<src> -y` (Dmouse92 token has `repo` scope for archive; archive-only since `delete_repo` scope is absent).

### 4.3 Post-archive (manual user step)

Once 3 PRs are merged and 3 source repos are archived, user completes deletion via GitHub UI (per L5-109 precedent — `delete_repo` scope is absent on the active token):

- https://github.com/KooshaPari/KommandLineAutomation/settings#dangerZone
- https://github.com/KooshaPari/KVirtualStage/settings#dangerZone
- https://github.com/KooshaPari/KWatch/settings#dangerZone

90-day GitHub retention applies to soft-delete tombstones.

### 4.4 Registry updates

Add 3 disposition rows to `phenotype-registry/registry/disposition-index.json` (after PRs merge):

```json
{
  "KooshaPari/KommandLineAutomation": {
    "fsm": "archived",
    "absorbed_to": "KooshaPari/helios-cli",
    "absorbed_path": "crates/harness_recorder/",
    "pr": "KooshaPari/helios-cli#<n>",
    "relocated_date": "2026-06-22",
    "note": "KLA → harness_recorder (per L5-200 audit)"
  },
  "KooshaPari/KVirtualStage": {
    "fsm": "archived",
    "absorbed_to": "KooshaPari/phenotype-tooling",
    "absorbed_path": "absorption/kvirtualstage/",
    "pr": "KooshaPari/phenotype-tooling#<n>",
    "relocated_date": "2026-06-22",
    "note": "KVS → tooling collection (per L5-200 audit; README STRICTLY DO NOT DELETE overridden by user directive; mirrors L5-109 kwality precedent)"
  },
  "KooshaPari/KWatch": {
    "fsm": "archived",
    "absorbed_to": "KooshaPari/phenotype-ops",
    "absorbed_path": "agent-devops-setups/kwatch/",
    "pr": "KooshaPari/phenotype-ops#<n>",
    "relocated_date": "2026-06-22",
    "note": "KWatch → agent-devops-setups (per L5-200 audit)"
  }
}
```

### 4.5 Audit / verification

After each merge, the orchestrator verifies per ADR-029 § 4.5 pattern:
- `git fetch target main && git rev-list --count source..target/main -- absorption-path/`
- Confirm all source-tree files are present in target
- Confirm zero new source-only files in target (no contamination)

### 4.6 What this plan does NOT do

- **No new repos created** (per user directive).
- **No source code rewritten** — pure relocation + de-duplication of dead files.
- **No CODEOWNERS / branch protection changes** on the 3 source repos (they're being deleted anyway).
- **No GitHub releases / tags migrated** — releases stay on the (archived → deleted) source repo; new work happens in target repos going forward.

---

## 5. Pre-deletion checklist (per source repo)

For each of the 3 source repos, all 6 of these must be `done` before the user-initiated GitHub UI delete:

- [ ] Migration PR merged on target repo
- [ ] Smoke tests pass on target repo (build + lint + unit tests for the absorbed code)
- [ ] Source repo archived (`gh repo archive KooshaPari/<src> -y`)
- [ ] Registry disposition row added
- [ ] This audit doc cross-referenced from `AGENTS.md` § "PAUSED APPs" (or new "RETIRED" section)
- [ ] User has manually deleted via GitHub UI (Settings → Danger Zone → Delete this repository)

---

## 6. Risks + mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| KLA build breaks when merged into helios-cli workspace (dependency conflicts) | Medium | Run `cargo check -p harness_recorder` before opening PR; resolve rck-core version pin if needed |
| KWatch's Go module path (`kwatch`) collides with another module in `phenotype-ops` | Low | `agent-devops-setups/kwatch/` is a sibling directory; no Go workspace at the federation root |
| KVS `credential_manager` uses `sled` (deprecated) + `sqlx` (heavy) — may not build in 2026 | Medium | Document as "frozen at absorption; do not update" in `absorption/kvirtualstage/README.md` |
| KVS README "STRICTLY DO NOT DELETE" causes user hesitation | High (already raised in directive) | Document override policy in absorption doc (mirrors kwality precedent) |
| `git subtree` loses source commit history | Low | Use `--allow-unrelated-histories` merge to preserve; document commit count delta in PR |
| 20 MB `.proc-history.json` gets committed accidentally | Low | Add to `.gitignore` of target repo + `git rm --cached` if it slipped through |
| KWatch `node_modules/` gets committed accidentally | Low | Already in `.gitignore` of target repo; `git rm --cached` if present |
| Source repo's open issues / PRs get lost on delete | Medium | Audit open issues/PRs first; triage / close / migrate before delete |
| GitHub UI delete is perma-destructive | High | Document the 90-day retention explicitly in PR description |

---

## 7. Approval gate

This is the **plan**. Migration PRs (4.1) are NOT opened until the user confirms:

> "Approved — proceed with the 3 migrations"

After approval, execute 4.1 → 4.5 sequentially (or in parallel if user prefers speed over ordering). User then handles the GitHub UI deletes (4.3).

---

## 8. Related

- `findings/2026-06-18-L5-109-4-repo-retirement.md` — kwality + 3 others retirement (pattern reference)
- `docs/adr/2026-06-15/ADR-023-agent-effort-governance.md` — substrate placement rules
- `docs/adr/2026-06-17/ADR-029-dmouse92-to-kooshapari.md` — migration discipline (zero net content loss)
- `AGENTS.md` § "4-repo retirement (2026-06-18)" — pattern summary
