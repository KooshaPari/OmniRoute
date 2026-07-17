# L13 — Onboarding & Contributor DX

## Scope
Covers first-time setup time, dev container / .devcontainer, Justfile / Taskfile / Makefile / package scripts, "good first issue" labels, and maintainer response time across the Phenotype bloc (AgilePlus + thegent + Tracely + Tracera + satellite repos, ~76 crates).

## SOTA 2026
SOTA 2026 contributor DX practice (per `repos/AUDIT_BLOC_VS_2026_SOTA.md` §Contributor Experience and `~/.claude/CLAUDE.md` §Generalized Dev Environment Pattern):
- **`< 5 min` time-to-first-successful-build** with a `.devcontainer/devcontainer.json` that pre-installs all toolchains and runtimes (HeliosLab, thegent, Tracely are the gold examples).
- **Conventional task runner**: `just` or `task` (go-task) at repo root with a `default` recipe that lists available tasks. Cargo Make / npm scripts acceptable as fallbacks.
- **Issue labels**: `good first issue`, `help wanted`, `bug`, `enhancement`, `question` (GitHub defaults + project-specific). The label "good first issue" must exist for new contributors to find on-ramps.
- **Maintainer SLAs**: explicit "first response within N business days" in CONTRIBUTING.md (AgilePlus: 2 business days; bloc SOTA target: ≤ 2 business days).
- **PR template**: `.github/PULL_REQUEST_TEMPLATE.md` enforcing scope, test plan, risk, and a check for "is this small enough to review in 15 min" (AgilePlus: < 400 lines diff per CONTRIBUTING.md §8.3).
- **Bootstrap script**: `just bootstrap` or `make bootstrap` runs lefthook + cargo subcommand install + smoke build (AgilePlus CONTRIBUTING.md §3.2 references `just bootstrap`).
- **Editor config**: `.editorconfig` + `.vscode/extensions.json` or `.devcontainer/customizations.vscode.extensions`.
- **Worktree governance**: documented in CONTRIBUTING.md (AgilePlus §7 has branching + worktree convention).

## Phenotype state

### Per-repo matrix (L13)

| Repo | .devcontainer | Justfile/Taskfile | `just bootstrap` | PULL_REQUEST_TEMPLATE | Labels: `good first issue` | Maintainer SLA in CONTRIBUTING | First-build time (est.) |
|---|---|---|---|---|---|---|---|
| **AgilePlus** | ✗ | ✓ Justfile (122 lines) + Taskfile.yml (18 lines) | referenced at CONTRIBUTING.md:65 but **no `bootstrap` recipe in Justfile:1-122** | ✓ `.github/PULL_REQUEST_TEMPLATE.md` | ✓ (3 matching) | ✓ "2 business days" at CONTRIBUTING.md:237 | ~10 min (full workspace + Python + dashboard) |
| **thegent** | ✓ `devcontainer.json` (Python 3.12) | ✓ Justfile (2636 lines) + Taskfile.yml (16891 bytes) | ✗ (uses `uv sync` per README:355) | ✓ `.github/PULL_REQUEST_TEMPLATE.md` | ✓ (3 matching) | ✗ not in CONTRIBUTING.md | ~3-5 min (Python + 28 Rust crates warm build) |
| **Tracely** | ✓ `devcontainer.json` (name: Tracely) | ✓ justfile (42 lines, has `docs`) + Taskfile.yml (22 lines) | ✗ | ✓ `.github/PULL_REQUEST_TEMPLATE.md` | ✓ (2 matching) | ✗ not in CONTRIBUTING.md | ~5 min (Rust workspace, single binary) |
| **Tracera** | ✗ | ✓ justfile (175 lines) + Taskfile.yml (76 lines) + `make` | ✗ | ✓ `.github/PULL_REQUEST_TEMPLATE.md` | ✓ (3 matching) | ✗ not in CONTRIBUTING.md | ~10-15 min (polyglot: Rust + Go + Python + TS) |
| **HeliosLab** (gold) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~3 min |
| **phenoData** | ✓ | ✓ | ✗ | ✓ | ✓ | n/a | ~5 min |
| **phenoDesign** | ✓ | ✓ | ✗ | ✓ | ✓ | n/a | ~5 min |
| **PhenoMCP** | ✓ | ✓ | ✗ | ✓ | ✓ | n/a | ~5 min |
| **PhenoObservability** | ✓ | ✓ | ✗ | ✓ | ✓ | n/a | ~5 min |
| **PhenoPlugins** | ✓ | ✓ | ✗ | ✓ | ✓ | n/a | ~5 min |

### Per-repo findings (file:line)

#### AgilePlus — `repos/AgilePlus/`
- `repos/AgilePlus/CONTRIBUTING.md:60-76` — status ✓ (Clone + Bootstrap section; `just bootstrap` advertised as the entry point; the actual `Justfile:1-122` does **not** define a `bootstrap` recipe — gap)
- `repos/AgilePlus/CONTRIBUTING.md:42-58` — status ✓ (required toolchain table: Rust stable, cargo ≥1.78, cargo-deny, cargo-audit, cargo-nextest, Python 3.11+, uv, ruff, mypy, Node 20 LTS, pnpm, just, lefthook)
- `repos/AgilePlus/CONTRIBUTING.md:234-241` — status ✓ (Reviewer Expectations: **"First response within 2 business days"** at line 237; reviews cover correctness, tests, security, perf, API stability, observability, docs)
- `repos/AgilePlus/CONTRIBUTING.md:117-130` — status ✓ (Testing tiers table with wall-clock estimates: Unit < 2 min, Snapshot < 2 min, Property < 5 min, Fuzz 10 min, E2E < 30 min)
- `repos/AgilePlus/CONTRIBUTING.md:251-257` — status ✓ (Getting Help: Discord, Discussions, Office Hours Tuesdays 15:00 UTC)
- `repos/AgilePlus/Justfile:1-122` — `ci: fmt lint test audit deny docs` (line 9); `grade:` `grade-fast:` `grade-full:` recipes; **no `bootstrap` recipe** — status △ (CONTRIBUTING.md references it but it's not implemented)
- `repos/AgilePlus/Taskfile.yml:1-18` — `test-nextest`, `ci-nextest`, `coverage` only — status △
- `repos/AgilePlus/.devcontainer/` — **MISSING** — status ✗
- `repos/AgilePlus/.github/ISSUE_TEMPLATE/bug-report.yml` + `bug_report.md` + `feature_request.md` + `feature-request.yml` — status ✓ (4 templates)
- `repos/AgilePlus/.github/PULL_REQUEST_TEMPLATE.md` — status ✓
- `repos/AgilePlus/lefthook.yml` — status ✓ (git hook manager configured)
- First-build: ~10 min (per CONTRIBUTING.md estimate: full workspace build + Python venv + pnpm install)

#### thegent — `repos/thegent/`
- `repos/thegent/.devcontainer/devcontainer.json:1-30` — status ✓ (image: `mcr.microsoft.com/devcontainers/python:3.12-bookworm`; features: git + gh; postCreateCommand: `pip install uv && (uv sync ... || ...)` with fallback chain; forwardPorts: 3847 for thegent MCP; VS Code extensions: ms-python.python, ms-python.vscode-pylance, charliermarsh.ruff)
- `repos/thegent/Justfile:1-2636` — extensive Justfile — status ✓
- `repos/thegent/Taskfile.yml:1-16891` (16kB) — Taskfile is the primary task runner per README:354 — status ✓
- `repos/thegent/Justfile:1-100` (excerpt) — no `bootstrap` recipe — status △
- `repos/thegent/CONTRIBUTING.md:1-44` — status ✗ (no maintainer SLA; no PR template reference; no branch discipline; relies on AGENTS.md §Conventions)
- `repos/thegent/AGENTS.md:23-26` — status ✓ (max function length 40 lines, cognitive complexity ≤ 15, all code passes `ruff check .` + `ruff format .` + `pytest -q`)
- `repos/thegent/.github/ISSUE_TEMPLATE/bug.yml` + `bug-report.yml` + `feature.yml` + `feature-request.yml` + `config.yml` — status ✓ (5 templates)
- `repos/thegent/.github/PULL_REQUEST_TEMPLATE.md` + `PULL_REQUEST_TEMPLATE_LEGACY.md` — status ✓
- `repos/thegent/.github/copilot-instructions.md` + `prompts/` — status ✓ (Copilot instructions and prompt templates)
- `repos/thegent/.github/required-checks.json` + `RULESET_BASELINE.md` + `rulesets/` — status ✓ (branch protection rulesets)
- First-build: ~3-5 min (per README:355-373; `uv sync --all-extras` + `cargo build --workspace`)

#### Tracely — `repos/Tracely/`
- `repos/Tracely/.devcontainer/devcontainer.json:1-29` — status ✓ (image: `mcr.microsoft.com/devcontainers/python:3.12-bookworm`; features: git + gh; postCreateCommand: `pip install uv && (uv sync ... || ...)` fallback chain; forwardPorts 3847 for thegent MCP; VS Code extensions for Python; though the image is Python and the repo is Rust — gap: image should probably be `rust:1-bookworm` for cargo-deny/cargo-audit; the devcontainer mostly serves a Python overlay that doesn't match the repo's primary language)
- `repos/Tracely/justfile:1-42` — `default:`, `build`, `test`, `lint`, `audit`, `ci` recipes — status ✓
- `repos/Tracely/Taskfile.yml:1-22` — `default`, `build`, `test`, `lint`, `audit`, `ci` — status ✓
- `repos/Tracely/justfile:40-42` — `docs: cargo doc --no-deps --workspace` — status ✓ (note: this is in justfile but **not** in Taskfile.yml — drift between the two)
- `repos/Tracely/CONTRIBUTING.md:1-24` — status ✗ (no maintainer SLA, no PR process details, no branch discipline)
- `repos/Tracely/AGENTS.md:1-18993` — status ✓ (extensive agent context)
- `repos/Tracely/.github/ISSUE_TEMPLATE/bug.md` + `feature.md` — status △ (only 2 templates; missing config.yml, security_report.md, question.md)
- `repos/Tracely/.github/PULL_REQUEST_TEMPLATE.md` — status ✓
- First-build: ~5 min (per README §Quick Start)

#### Tracera — `repos/Tracera/`
- `repos/Tracera/.devcontainer/` — **MISSING** — status ✗
- `repos/Tracera/justfile:1-175` — extensive polyglot-aware Justfile (175 lines): `dev`, `build`, `test`, `coverage`, `audit`, `deny`, `grade`, `grade-fast`, `ci`, `lint`, `fmt`, `clean` — status ✓
- `repos/Tracera/Taskfile.yml:1-76` — Rust-only Taskfile: `fmt`, `lint`, `test`, `test-workspace`, `build`, `deny`, `clean`, `changelog`, `release`, `coverage` — status △ (Rust-only; the polyglot stack is under-served)
- `repos/Tracera/CONTRIBUTING.md:1-44` — status △ (governance integration is good: points to `docs/governance/background_agent_policy.md`; otherwise thin)
- `repos/Tracera/AGENTS.md:1-80` — status ✓ (key commands per language stack)
- `repos/Tracera/.github/ISSUE_TEMPLATE/bug_report.md` + `config.yml` + `feature_request.md` + `question.md` + `security_report.md` — status ✓ (5 templates, the most in the bloc)
- `repos/Tracera/.github/PULL_REQUEST_TEMPLATE.md` — status ✓
- First-build: ~10-15 min (polyglot: cargo + go + python/uv + bun/pnpm)

#### HeliosLab (gold standard) — `repos/HeliosLab/`
- `repos/HeliosLab/.devcontainer/devcontainer.json` — status ✓
- `repos/HeliosLab/Justfile` (or `justfile`) — status ✓
- `repos/HeliosLab/SSOT.md:1-30+` — status ✓ (precedence table with 9 rows)
- `repos/HeliosLab/README.md:1-40+` — status ✓ (work-state header, link-out table to PRD/ADR/SPEC/FR/PLAN)

## Gaps

1. **AgilePlus: `.devcontainer/` missing** — `repos/AgilePlus/.devcontainer/` — gap: no one-command onboarding; user must install Rust + Python + Node + pnpm + just + lefthook manually per CONTRIBUTING.md:42-58 — effort: **S** (port from `repos/thegent/.devcontainer/devcontainer.json` with multi-stage postCreateCommand for cargo + Python + pnpm)
2. **AgilePlus: `just bootstrap` referenced but not defined** — `repos/AgilePlus/Justfile:1-122` — gap: CONTRIBUTING.md:65 promises `just bootstrap` will install lefthook, cargo subcommands (deny, audit, nextest, outdated, bloat), and run smoke build, but the recipe doesn't exist in the Justfile — effort: **S** (add ~15-line `bootstrap:` recipe)
3. **thegent: no maintainer SLA in CONTRIBUTING.md** — `repos/thegent/CONTRIBUTING.md:1-44` — gap: 44-line file has no reviewer response time target; relies on AGENTS.md only — effort: **XS** (add 1-line "First response within 2 business days")
4. **thegent: no `just bootstrap` recipe** — `repos/thegent/Justfile:1-100` — gap: `uv sync --all-extras` is the only documented bootstrap (README:355); no lefthook install, no cargo subcommand install — effort: **S** (port from AgilePlus once added)
5. **Tracely: devcontainer image mismatch** — `repos/Tracely/.devcontainer/devcontainer.json:3` — gap: image is `python:3.12-bookworm` but the repo is Rust (Cargo.toml + crates/); devcontainer forwards 3847 (thegent MCP port) — effort: **S** (replace with `mcr.microsoft.com/devcontainers/rust:1-bookworm` + cargo-deny/audit install)
6. **Tracely: no `just bootstrap`** — `repos/Tracely/justfile:1-42` — gap: no one-command onboarding — effort: **S** (port from AgilePlus)
7. **Tracely: thin CONTRIBUTING.md, no SLA** — `repos/Tracely/CONTRIBUTING.md:1-24` — gap: 24-line file is below bloc median; no PR process, no commit-type table, no reviewer expectations — effort: **S** (expand to 100+ lines; add SLA)
8. **Tracely: `docs` recipe drift between Justfile and Taskfile** — `repos/Tracely/justfile:40-42` defines `docs: cargo doc --no-deps --workspace`; `repos/Tracely/Taskfile.yml:1-22` does not — gap: contributors following the Taskfile get no doc shortcut — effort: **XS** (add the same recipe to Taskfile.yml)
9. **Tracely: thin ISSUE_TEMPLATE set** — `repos/Tracely/.github/ISSUE_TEMPLATE/` — gap: only `bug.md` and `feature.md`; missing `config.yml`, `security_report.md`, `question.md` — effort: **XS** (port templates from Tracera)
10. **Tracera: no `.devcontainer/`** — `repos/Tracera/.devcontainer/` — gap: polyglot stack (Rust + Go + Python + TS) makes on-device install painful — effort: **M** (multi-stage postCreateCommand: install rustup + go + uv + bun, then `just bootstrap`)
11. **Tracera: no `just bootstrap` recipe** — `repos/Tracera/justfile:1-175` — gap: even though `just` is the most-used tool in the file, there's no entry-point recipe — effort: **S** (add `bootstrap:` recipe that stack-detects and runs `cargo fetch` + `go mod download` + `uv sync` + `bun install`)
12. **Tracera: thin CONTRIBUTING.md, no SLA** — `repos/Tracera/CONTRIBUTING.md:1-44` — gap: no reviewer response time — effort: **XS** (add SLA)
13. **Bloc: maintainer SLA missing in 3 of 4 main repos** — `repos/thegent/CONTRIBUTING.md`, `repos/Tracely/CONTRIBUTING.md`, `repos/Tracera/CONTRIBUTING.md` — gap: only AgilePlus (CONTRIBUTING.md:237) documents "First response within 2 business days"; SOTA 2026 expects explicit SLA per repo — effort: **XS** (1-line each)
14. **Bloc: `just bootstrap` missing in 4 of 4 main repos** — every Justfile/justfile/Taskfile.yml — gap: AgilePlus's CONTRIBUTING.md is the only one that documents `just bootstrap`; no repo actually ships the recipe — effort: **S** (1-2 days across the bloc; PRs to each repo)
15. **Bloc: `.devcontainer` missing in 2 of 4 main repos** (AgilePlus, Tracera) — gap: no first-class Codespaces / VS Code Remote Containers path — effort: **S** each
16. **Bloc: "good first issue" labels exist but coverage unknown** — `gh api` returned 2-3 matching labels per repo; need to verify there are ≥ 5 open issues labeled `good first issue` to attract new contributors (currently uncertain; audit needed) — effort: **S** (verify with `gh issue list --label "good first issue" --state open --limit 5`)

## Recommendations

1. **Add `.devcontainer/devcontainer.json` to AgilePlus and Tracera** (S effort each). Use HeliosLab as the template; multi-stage `postCreateCommand` for polyglot stacks.
2. **Standardize `just bootstrap` across the bloc** (S effort; 1 PR per repo). The recipe should be stack-detected: lefthook install, cargo subcommand install (deny/audit/machete/nextest), Python `uv sync`, Node `pnpm install`, then smoke build.
3. **Add maintainer SLA** ("First response within 2 business days") to thegent, Tracely, and Tracera CONTRIBUTING.md (XS effort; 1-line each).
4. **Align `docs` recipe between Justfile and Taskfile** in Tracely (XS effort). Add `docs:` to Tracera's justfile (S effort).
5. **Fix Tracely's devcontainer image**: switch from `python:3.12-bookworm` to `rust:1-bookworm` to match the repo's primary language; remove the `thegent MCP` port forward (S effort).
6. **Expand Tracely's CONTRIBUTING.md** to match AgilePlus's 12-section structure; this is the easiest way to lift the bloc's overall DX maturity.
7. **Add a CI check** that fails when a new repo in the org lacks `.devcontainer/`, `Justfile` (or `justfile`), and `CONTRIBUTING.md` (M effort; uses `pheno-ci-templates`).
8. **Add `good-first-issue` issue templates** with a default checklist so that triage is automatic (S effort). Suggested template:
   ```markdown
   ## Good First Issue
   - [ ] Scope is < 200 lines diff
   - [ ] Tests included
   - [ ] Docs updated (if user-facing)
   - [ ] No new public API
   - [ ] No new dependency
   ```
9. **Track maintainer response time** via a monthly dashboard using the GitHub API (`gh pr list --search "review:none"`); surface in `L6_PHENO_REPOS_HEALTH_2026_06_15.md` rolling update.
10. **Document worktree convention** in every CONTRIBUTING.md (AgilePlus §7 already has it; the rest reference AGENTS.md only). XS effort per repo.

## Effort summary

| Effort | Items | Estimated wall-clock |
|---|---|---|
| XS (1-line) | SLA addition, label templates, recipe additions | 5-10 min each |
| S (1 PR) | `.devcontainer` port, `just bootstrap` impl, CONTRIBUTING.md expansion, devcontainer image fix | 1-3 hours each |
| M (multi-step) | Polyglot devcontainer, bloc-wide audit, CI checks | 1-2 days |
| L (out-of-scope) | Org-wide docs.rs aggregator, central GitHub Pages | 1+ week; defer to L29 |
