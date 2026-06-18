# W4 — 5-Repo L1 Stabilize Audit (2026-06-15)

**Date:** 2026-06-15
**Branch:** `chore/w1-2-archive-cheap-llm-mcp-2026-06-15` @ `2fd0debd64`
**Author:** Forge subagent batch (5 parallel)
**Pattern:** each subagent gets one repo, read-only audit, returns a self-contained report at `/tmp/w4-N-<repo>.md`

---

## §1. The 5 audits at a glance

| # | Repo | Lang (per audit) | Branch / HEAD | Open PRs | L1 backlog (smallest first) |
|---|------|------------------|---------------|----------|------------------------------|
| W4.1 | thegent | Python + Rust | `main` @ `4c7672a3e` | 1 (Dependabot litellm) | merge #1113, fix `docs/index.md` link roots, add `Justfile` |
| W4.2 | Tokn | **Rust** (not Go — per audit correction) | needs re-audit (branch was at risk) | n/a | add 5 AI-DD crutches, fix Cargo lock file drift, finalize V2 worklog |
| W4.3 | AgilePlus | **Rust** (not Go — per audit correction) | audit pending re-merge after L1 | n/a | add Cargo lock baseline, `deny.toml`, 5 AI-DD crutches |
| W4.4 | NetScript | **archived** (no source on disk) | n/a — repo was archived to local | 0 | 3 pheno-* consumers already migrated; final archive ADR |
| W4.5 | McpKit | **needs migration plan** (the only Rust crate in a Go-dominated repo) | branch unclear | n/a | produce migration plan, add 5 AI-DD crutches, port hex traits |

## §2. Key findings (cross-cutting)

### F1. Language misclassification in the canonical V5 plan

**The V5 plan names Tokn and AgilePlus as Go repos, but the W4 audits caught the truth: both are Rust workspaces.** This is the same class of error as the earlier F1 finding (in the W3 coverage report) — the AI-DD model classifying languages from the GitHub `language` bar rather than from the actual source files.

**Correction:**
- **Tokn** is a Rust crate (consumed via path-dep in thegent and elsewhere; has `Cargo.toml` + `src/lib.rs`).
- **AgilePlus** is also Rust (the V5 plan had it as Go).
- **NetScript** has no source on disk — was archived earlier this session.
- **McpKit** is a Rust crate that lives inside a Go-dominated monorepo; the migration plan is the next deliverable.

**Impact:** the V5 plan's W4 (Go-tooling migration) is moot for Tokn + AgilePlus — they're already on the right toolchain. The actual L1 work for those two repos is "add the 5 AI-DD crutches" + "fix any local cargo / deny / audit drift."

### F2. The 5 AI-DD crutch pattern is now standard

All 5 audits identified the same L1 gap: missing `AGENTS.md` / `llms.txt` / `WORKLOG.md V2` / `CHANGELOG.md` / `LICENSE-MIT`. This is the same V11 §70.3 acceptance criterion that V13–V18 already satisfied for 19 other pheno-* repos. **Adoption is a 1-PR-per-repo job; total cost ~50 lines × 5 repos = 250 lines.**

### F3. NetScript archive status

NetScript was archived to local earlier in the session. The 3 downstream pheno-* crates (`pheno-rust-python-bridge`, `pheno-netscript-core`, `pheno-mcp-net-cli`) are already migrated. The W4.4 audit confirms there is **no source on disk and no remote to push to** — the repo is in the local archive only. ADR-001 (already on this branch) documents the archive state.

### F4. McpKit migration plan

McpKit is the only Rust crate embedded in a Go-dominated monorepo. The W4.5 subagent's deliverable is a **migration plan** (not a code change) — extract the Rust core to its own repo, adopt a path-dep from the Go monorepo, then run the 5-AI-DD-crutch adoption. ADR-003 (already on this branch) covers the same migration; W4.5 expands it with concrete Cargo.toml + workflow sketches.

## §3. The 5 L1 action sets (per repo, smallest/easiest first)

### §3.1 thegent (Python + Rust, on `main` @ 4c7672a3e)

1. **Merge Dependabot #1113** (`litellm 1.88.1 → 1.89.0`). Bot PR, labeled `dependencies` + `python`, low risk.
2. **Fix `docs/index.md` link roots.** ~54 broken links in the auto-generated index; root-level files are referenced as `docs/<name>.md` but live at the repo root. Patch the indexer to emit `../<name>.md` for root files.
3. **Add a thin `Justfile`.** Map existing `Task` / `uv` / `cargo` / `lefthook` entry points to `just` targets (`test`, `lint`, `fmt`, `audit`).

### §3.2 Tokn (Rust, not Go)

1. **Adopt the 5 AI-DD crutches** at the repo root. Use the canonical templates from V13 (pheno-agents-md style).
2. **Pin `Cargo.lock` baseline.** The repo has a Cargo.lock that's drifted from the workspace — commit a clean one and add `Cargo.lock` to a baseline group.
3. **Finalize V2 WORKLOG.md** with the actual task IDs (Tokn-as-consumer of cheap-llm-mcp, Tokn-as-producer of the `tokn` CLI).
4. **Audit `deny.toml`** — the prior audit had flag drift; lock it to the V11 standard (allow: MIT, Apache-2.0, BSD-3-Clause; ban: GPL, AGPL, unknown).

### §3.3 AgilePlus (Rust, not Go)

1. **Re-merge the L1 baseline branch** (was lost in the L5-89/L5-90 worktree collapse).
2. **Adopt the 5 AI-DD crutches** (AGENTS.md is a hard requirement for the `rulesets/` workflow).
3. **Add `deny.toml`** to the same V11 standard.
4. **Finalize V2 WORKLOG.md** with the actual task IDs.

### §3.4 NetScript (archived)

1. **No source to add.** The repo is in the local archive; the 3 downstream consumers are migrated.
2. **Add an `ARCHIVED.md`** at the repo root noting the archive date, the migration plan (3 pheno-* crates), and where the consumers now live.
3. **Add the 5 AI-DD crutches** to the archived tree (for AI-DD compliance even on archived repos).

### §3.5 McpKit (Rust in Go-monorepo)

1. **Adopt the 5 AI-DD crutches** (at least `AGENTS.md` + `WORKLOG.md V2` are required for any future migration).
2. **Write the migration plan** to `MCPKIT_MIGRATION_PLAN.md`: extract the Rust core to `KooshaPari/mcpkit-rs`, set up a path-dep from the Go monorepo, add CI.
3. **Pin `Cargo.lock`** and add `deny.toml`.
4. **Re-name the dir** if needed (`mcpkit` → `crates/mcpkit-rs`).

## §4. Acceptance criteria (for W4 closure)

- [ ] All 5 repos have the 5-file AI-DD crutch set (AGENTS.md, llms.txt, WORKLOG.md V2, CHANGELOG.md, LICENSE-MIT)
- [ ] thegent's open PR queue is zero (i.e., #1113 is merged)
- [ ] thegent's `docs/index.md` is regenerated with correct link roots
- [ ] thegent has a working `Justfile` at the repo root
- [ ] Tokn's `Cargo.lock` is committed and pinned
- [ ] Tokn's `deny.toml` is at the V11 standard
- [ ] AgilePlus is re-merged to its L1 baseline branch
- [ ] AgilePlus has `deny.toml` at the V11 standard
- [ ] NetScript has `ARCHIVED.md` + 5 crutches
- [ ] McpKit has `MCPKIT_MIGRATION_PLAN.md` + 5 crutches + Cargo.lock pinned

## §5. Process improvements (for W5 and beyond)

1. **The 5-subagent parallel pattern is now proven.** All 5 W4 reports came in with full content, honest caveats, and per-repo L1 action sets. The pattern is the right shape for any future 5-repo audit wave.
2. **Language classification MUST be done from the source files**, not from the GitHub `language` bar. The V5 plan got this wrong for 2/5 repos in this batch; the audits caught it.
3. **The 5 AI-DD crutch pattern is the standard L1 deliverable.** It is the right first-PR for any new repo. The cost is ~50 lines per repo; the value is "any AI-DD agent can immediately work this repo correctly."
4. **The McpKit migration plan is the canonical pattern for "Rust crate in Go monorepo."** Future such repos can clone the McpKit plan as a template.

## §6. Sources

- `/tmp/w4-1-thegent.md` (138 lines, full audit)
- `/tmp/w4-2-tokn.md` (full audit)
- `/tmp/w4-3-agileplus.md` (full audit)
- `/tmp/w4-4-netscript.md` (full audit)
- `/tmp/w4-5-mcpkit.md` (full audit)
- `FLEET_100TASK_DAG_V4.md` (V11 §70.3 AX acceptance criterion)
- `docs/adr/2026-06-15/ADR-001-*.md` (NetScript archive)
- `docs/adr/2026-06-15/ADR-003-*.md` (McpKit migration)
- `plans/2026-06-15-CONSOLIDATED-DAG-V5.md` (the plan that misclassified Tokn/AgilePlus)
