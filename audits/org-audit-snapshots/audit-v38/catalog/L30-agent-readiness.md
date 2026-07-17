# L30 — Agent Readiness & Factory Operability

**Tier:** 1 (foundational; must pass before assigning a repo to an autonomous agent fleet)
**Cross-cuts:** L1 (module structure as agent navigation surface), L4 (test coverage as guardrail), L8 (docs quality as agent context), L13 (contributor DX), L29 (governance substrate)

## Scope

Can an autonomous agent work ALONE on this repo — plan a change, implement it, verify it, and open a PR — without human hand-holding? This pillar tests the repo's *agent-operability surface*: how much friction the agent encounters when navigating spec, decomposing tasks, using tests as guardrails, consuming docs as context, and — critically — detecting not just bugs but **user-story gaps / user-friction** and **visual/creative polish gaps**.

This is a rubric, not a snapshot of a specific repo. Evidence fields describe *what to look for* and *where to find it*.

## SOTA 2026

- **Anthropic Claude Code** (claude-code-sdk-rs): `AGENTS.md` + `CLAUDE.md` at repo root + worktree isolation via `-w` flag; `task test` one-liner; `cargo check` pre-edit; FR files in `docs/` linked to test IDs via tracera-style traceability.
- **gastown/bd** (steveyegge/gastown, 2026): machine-readable `manifest.toml` per agent bead with a `description`, `skills[]`, `tools[]`, and `required_context[]` listing; agents can self-describe their capability surface.
- **phenotype-governance** (`23_ARCHITECTURAL_GOVERNANCE.md`): mandates agent-readable spec in `docs/functional_requirements.md` + per-feature FR-IDs + FR→test traceability.
- **Factory / Dark-Factory / Octopusgarden** (Phenotype shared 2026): every PR carries a `Factory-spec:` trailer linking to the FR ID and acceptance test; CI gate asserts the link is not dangling.
- **SWE-bench + SWE-RL** (2026): reproducibility of agent-driven code changes requires a lockfile-pinned env, hermetic test runner, and task-decomposable specs — "a test harness the agent can run end-to-end without human intervention".
- **OpenDevin / Agentless** (2026): agent-operability is highest when: (a) README has a one-liner dev-setup, (b) every public function is doc-commented, (c) test names read as requirement sentences, (d) the linter auto-fixes most issues.

## Sub-Pillars

### L30.1 — Spec & FR Clarity

**Name:** Functional Requirements are machine-readable and agent-consumable.

**Acceptance criterion:** A `docs/functional_requirements.md` (or equivalent) exists, is structured (section-per-FR with an `FR-NNN` ID, an `as a <role>` sentence, and at least one acceptance test reference), and covers ≥80% of the observable public surface. The FR document must not require human interpretation to extract task decompositions.

**Evidence model:**
- `docs/functional_requirements.md` present and non-stub (`wc -l > 50`)
- Every FR entry has the form `## FR-NNN — <Title>` + `As a <role>, I want … so that …` + `Acceptance: <test-id or test-file:line>`
- Cross-reference: `grep -rn "FR-[0-9]" tests/` returns ≥1 hit per FR (traceability)
- `AGENTS.md` or `CLAUDE.md` references the FR file path

**Soft-optimizing goal:** FR coverage tool (e.g., Tracera) reports ≥85% traceability; FR-IDs appear in commit messages and PR titles.

---

### L30.2 — Task Decomposability

**Name:** Every feature / user story is decomposable into ≤1-day atomic tasks an agent can claim independently.

**Acceptance criterion:** The repo's backlog or issue tracker contains issues tagged with effort estimates ≤ "M" (≤4h of agent work), each referencing an FR-ID and having a clear "done when" statement. Alternatively, a `PLAN.md` or `WORK_DAG.md` with DAG-structured tasks satisfies this.

**Evidence model:**
- GitHub Issues: `gh issue list --label "effort:S,effort:M"` returns ≥5 issues, each with `Closes FR-NNN` in the body
- OR `PLAN.md` / `docs/changes/*.md` with a DAG (tasks referencing predecessor task IDs)
- No task that mixes multiple FRs without a sub-task breakdown

**Soft-optimizing goal:** Every open issue has a DAG predecessor list; issues blocked by infra gaps are tagged `blocker:infra`; new FRs auto-open issues via a GitHub Action.

---

### L30.3 — Test-as-Guardrail Coverage

**Name:** The test suite runs fast, hermetically, and provides meaningful signal to an agent that its change is correct.

**Acceptance criterion:** `task test` (or `cargo test`/`pytest`/`bun test`) exits in ≤3 min on a clean checkout; overall coverage ≥70% (line); tests are named as `<subject>_<scenario>_<expected_outcome>` (a readable sentence); no test that requires a running external service (all network calls mocked or behind a feature flag).

**Evidence model:**
- `Taskfile.yml` or `justfile` has a `test:` task with no manual setup steps
- `tarpaulin.toml` / `.pytest.ini` / `vitest.config.ts` present and reports coverage threshold
- `grep -rn "#\[ignore\]" src/` or `pytest --collect-only | grep skip` — count skipped tests (≤10%)
- `cargo test -- --list 2>&1 | head -20` — verify names read as sentences
- No `sleep()` in test code; no hardcoded ports without `portpicker`

**Soft-optimizing goal:** Coverage ≥85%; test names match FR-IDs (`test_fr042_*`); a `cargo mutants` nightly gate is wired; flaky tests tracked in `docs/flaky-test-log.md`.

---

### L30.4 — Docs-as-Agent-Context

**Name:** Documentation is structured so an agent can index it without reading every file.

**Acceptance criterion:** `README.md` has a ≤20-line quick-start that actually works; `AGENTS.md` exists and lists: working dir, build command, test command, lint command, key files/dirs; every public function/type has a doc comment (≥80% coverage by `cargo doc --document-private-items 2>&1 | grep "warning: missing"` count).

**Evidence model:**
- `AGENTS.md` present, non-stub (`wc -l > 10`)
- `README.md` has a `## Quick Start` or `## Getting Started` section whose commands succeed on a fresh clone
- `cargo doc --document-private-items 2>&1 | grep "warning: missing" | wc -l` ≤ 20 for Rust repos; `pydoc-markdown` or `sphinx` for Python
- `llms.txt` present (per llms.txt spec 2026) listing key files for LLM consumption

**Soft-optimizing goal:** `llms.txt` is machine-generated from the FR file; every module has an `//! Module overview` rustdoc; docs deployed as a VitePress/MkDocs site with a search index.

---

### L30.5 — Build & Setup Hermetics

**Name:** A fresh agent (no prior state, no env vars except those listed in `.env.example`) can build and test the repo.

**Acceptance criterion:** `cp .env.example .env && task dev` (or equivalent) succeeds; no undocumented env vars break the build; a `mise.toml` or `.tool-versions` pins every tool version; `cargo check` exits 0 with no warnings suppressed by `#[allow(...)]` unless each has a tracking issue.

**Evidence model:**
- `.env.example` present with every required var documented
- `mise.toml` or `.tool-versions` pinning Rust/Python/Node/Go versions
- `cargo check 2>&1 | grep "^warning" | wc -l` ≤ 5 (or 0 with justification)
- `grep -rn "#\[allow(" src/ | grep -v "//.*tracking:" | wc -l` — count undocumented suppressions (target: 0)

**Soft-optimizing goal:** Zero warnings; `cargo deny check` passes; `Dockerfile.dev` or `.devcontainer/` for hermetic setup; `mise x -- cargo check` produces identical output across macOS + Linux.

---

### L30.6 — User-Story Gap Detection Readiness

**Name:** The repo's observability surface makes it possible for an agent to identify WHERE users are experiencing friction — not just where bugs exist.

**Acceptance criterion:** User-facing error messages are non-generic (contain context, a cause, and a suggested action); `CHANGELOG.md` or `USER_JOURNEYS.md` exists and maps features to user stories; any crash or unexpected exit emits a structured log event that links back to a FR-ID or user journey step; at least one "user journey" integration test exercises the product from outside-in (CLI invocation / API endpoint / UI action), not just internal unit logic.

**Evidence model:**
- `USER_JOURNEYS.md` or `docs/user_journeys/` present with ≥3 journey definitions
- Error structs/enums have a `help()` or `hint` field that returns a non-empty actionable string
- `grep -rn "todo!()" src/` or `grep -rn "unimplemented!()" src/` returns 0 for any code path reachable from the public API
- At least one test file named `*_journey_*` or `*_e2e_*` with a user-visible scenario

**Soft-optimizing goal:** Every `AppError` variant has a user-visible message + a `docs_url`; error messages tested via snapshot tests; `USER_JOURNEYS.md` auto-generated from acceptance tests.

---

### L30.7 — Visual / Creative Polish Gap Detection Readiness

**Name:** For repos with a UI surface, the repo includes visual acceptance criteria so an agent can detect when the UI lacks polish — not just when it crashes.

**Acceptance criterion:** A `VISUAL_SPEC.md` or `docs/visual/` directory exists with: color palette + typography decisions; expected empty-state designs (what the user sees with no data); expected loading/skeleton states; expected error states; at least one screenshot or Figma-export reference per major view. For CLI/TUI repos: expected terminal color scheme, expected output structure for each command, and a golden-output test.

**Evidence model:**
- `VISUAL_SPEC.md` or `docs/visual/` present with ≥5 sections
- Presence of `*.png` / `*.svg` / `*.figma` references or asset links in the doc
- For CLI repos: `tests/golden/` directory with `*.txt` or `*.snap` expected-output files per command
- No UI component missing a `data-testid` attribute (for web UIs); no unnamed TUI widget

**Soft-optimizing goal:** Visual spec reviewed quarterly; golden tests cover all major views; Storybook / Dioxus preview / ratatui-test screenshot tests block merge if they regress.

---

### L30.8 — Autonomous PR Quality

**Name:** PRs opened by agents are indistinguishable (in quality) from human PRs.

**Acceptance criterion:** A `.github/PULL_REQUEST_TEMPLATE.md` exists with required sections (`## What`, `## Why`, `## How tested`, `## FR-IDs`, `## Risk`, `## Rollback`); CI gates must pass (no `--no-verify`); PR body must reference at least one FR-ID; the PR description accurately describes the diff (cross-checked by `gh pr diff` summary).

**Evidence model:**
- `.github/PULL_REQUEST_TEMPLATE.md` with all 6 required sections
- Branch protection ruleset requires PR + ≥1 approval + no force-push
- `required-checks.json` lists ≥3 required checks including a linting check
- Agent-opened PRs in history: `gh pr list --state closed --author "app/claude-code" | head -5` — inspect quality

**Soft-optimizing goal:** AI-authored PRs auto-tagged `agent:claude`; PR description quality gate (readability score); semantic diff check ensures description matches code.

---

### L30.9 — Conflict & Concurrency Safety

**Name:** The repo's structure allows multiple agents to work concurrently without trampling each other.

**Acceptance criterion:** Worktree support documented in `AGENTS.md` (e.g., `git worktree add ../repo-wtrees/topic`); no global mutable state in test setup that prevents parallel test runs; database fixtures are per-test-run (e.g., temp DB files, not a shared `test.db`); lockfile strategy documented.

**Evidence model:**
- `AGENTS.md` includes a "Worktree" or "Parallel agents" section
- Test DB setup uses `tempfile::NamedTempFile` or pytest `tmp_path` (no shared `test.db`)
- `cargo test` exits 0 with `RUST_TEST_THREADS=8` (or Python's `pytest -n 8`)
- No test that writes to `./output/` without a run-ID prefix

**Soft-optimizing goal:** `.git/config` has `worktree.prune = true`; CI runs tests with maximum parallelism; a `claim-lock` mechanism (e.g., phenofleet atomic INSERT) guards shared resources.

---

### L30.10 — Feedback Loop Speed

**Name:** An agent's edit-verify cycle is fast enough that autonomous iteration is practical.

**Acceptance criterion:** `cargo check` (or equivalent fast lint) exits in ≤30s on a warmed cache; the full unit test suite exits in ≤3 min; incremental tests (`cargo test <specific_crate>`) exit in ≤30s; `task lint` exits in ≤60s.

**Evidence model:**
- `hyperfine 'cargo check'` median ≤30s (measured on M-series Mac or equivalent)
- `hyperfine 'cargo test --lib'` median ≤180s
- `Taskfile.yml` has a `lint:fast` or `check:` task that skips slow checks
- No test that `sleep()`s for >1s without a clear timeout

**Soft-optimizing goal:** Incremental compile cache (sccache/mold) configured; CI caches `~/.cargo/registry`; `cargo nextest` used for parallel test execution; median CI feedback loop ≤5 min.

---

### L30.11 — Agent Context Entrypoint

**Name:** A single entrypoint file tells an agent everything it needs to start working.

**Acceptance criterion:** `AGENTS.md` exists at repo root and contains: (1) working directory, (2) build command, (3) test command, (4) lint command, (5) key file paths (spec, domain model, main entry), (6) forbidden operations (no `rm -rf`, no direct main-branch commits), (7) agent-specific gotchas (e.g., "run `cargo check` before `Edit`").

**Evidence model:**
- `AGENTS.md` present at repo root
- `wc -l AGENTS.md` ≥ 30 (non-trivial)
- Sections: grep for "build", "test", "lint", "forbidden" — all 4 present
- `llms.txt` present as a sibling to `AGENTS.md` (per llms.txt 2026 spec)

**Soft-optimizing goal:** `AGENTS.md` is auto-validated by a CI job; `llms.txt` is auto-regenerated from `AGENTS.md` + `docs/functional_requirements.md`; a `make validate-agents` or `task validate:agents` target exists.

---

### L30.12 — Story-Gap & Friction Detection Tooling

**Name:** The repo ships or references tooling that can surface user-story gaps and friction (not just bugs).

**Acceptance criterion:** At least one of: (a) a traceability tool (`tracera`, custom script) that maps code coverage to FR-IDs and surfaces uncovered FRs; (b) a user-journey test that exercises the "unhappy path" for each major journey (missing data, invalid input, network timeout); (c) a `friction-log.md` or `docs/friction-log.md` that records known UX friction and links to issues; (d) a structured user-feedback intake (GitHub Discussions / issue template `user-friction.yml`).

**Evidence model:**
- `docs/friction-log.md` present OR `.github/ISSUE_TEMPLATE/user-friction.yml` present
- At least one test file with `_error_`, `_missing_`, `_invalid_`, `_timeout_` in the name (unhappy-path coverage)
- `tracera` integration OR `cargo tarpaulin --map-to-fr-ids` (or equivalent) in CI
- FR coverage report in CI output showing ≥1 uncovered FR identified and linked to an issue

**Soft-optimizing goal:** Automated FR gap report posted as a PR comment; user-friction issues auto-triaged with `friction:UX` label; monthly friction review in `CHANGELOG.md`.
