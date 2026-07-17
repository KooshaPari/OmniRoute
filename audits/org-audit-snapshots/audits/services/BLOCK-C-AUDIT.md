# Block-C Audit — KooshaPari/services

**Audit date:** 2026-06-15
**Repo:** https://github.com/KooshaPari/services
**Clone target:** `E:\bc-audit-blockc\services`
**Default branch (remote):** `chore/dependabot-2026-06-08`
**HEAD at audit:** `0d7262cd605638a18cc5a000e8c42858d1bbc6fc`
**Repo description (per GitHub):** "Phenotype services registry — CycloneDX SBOMs for fleet third-party services"
**Archived:** false · **Stars:** 0 · **Disk:** 67 KB · **Last push:** 2026-06-12T10:06:17Z

> **TL;DR — This is NOT a buildable service.** The repository is a pure data
> registry: two CycloneDX 1.3 SBOM JSON files plus governance scaffolding
> (AGENTS, STATUS, Taskfile, CI, LICENSE, dependabot). There is no Rust, Go,
> Node, Python, or any other source code in the working tree. `cargo build`,
> `go build`, and `npm run build` all fail (no manifest / no source).
> The repo's own quality gate (`task validate` / `task verify`) is also broken
> due to a YAML parse error in `Taskfile.yml`. The repo advertises an R3
> spec that does not exist on disk.

---

## 1. Inventory & LOC

### 1.1 Working tree (default branch)

```
.github/dependabot.yml
.github/workflows/ci.yml
AGENTS.md
LICENSE-APACHE
LICENSE-MIT
README.md
STATUS.md
Taskfile.yml
graphql-gateway/focus-graphql-gateway.cdx.json
templates-registry/templates-registry.cdx.json
```

10 tracked files. **Zero source code files** (`*.rs`, `*.go`, `*.ts`, `*.js`,
`*.py`, `*.java`, `Cargo.toml`, `go.mod`, `package.json`, `pyproject.toml` —
all absent).

### 1.2 LOC by file

| File | Lines | Bytes |
|------|------:|------:|
| `graphql-gateway/focus-graphql-gateway.cdx.json` | 11,140 | 385,630 |
| `templates-registry/templates-registry.cdx.json` | 10,972 | 368,674 |
| `.github/dependabot.yml` | 94 | n/a |
| `.github/workflows/ci.yml` | 45 | n/a |
| `AGENTS.md` | 50 | 1,624 |
| `Taskfile.yml` | 34 | 766 |
| `README.md` | 21 | 1,512 |
| `STATUS.md` | 19 | 465 |
| `LICENSE-APACHE` | n/a | 439 |
| `LICENSE-MIT` | n/a | 1,089 |
| **Total tracked** | **22,375** | **~759 KB** |

Of the 22,112 SBOM lines, ~all are JSON pretty-printed metadata; they are
*not* code. Effective **code LOC = 0**.

### 1.3 Language breakdown

`gh repo view` reports `"languages": []` and `"primaryLanguage": null` — the
GitHub linguist cannot classify the repo. By content:

| Language / format | Approx. share |
|-------------------|---------------|
| JSON (CycloneDX)  | ~99.6 % |
| YAML (CI / Taskfile / dependabot) | ~0.3 % |
| Markdown (docs)   | ~0.1 % |

---

## 2. Build attempt — real final lines

The repo is data-only, so no language build can succeed. The three mandated
build commands were run; all fail with a manifest error (the expected
"non-buildable" outcome is captured verbatim below).

### 2.1 `cargo build`
```
error: could not find `Cargo.toml` in `E:\bc-audit-blockc\services` or any parent directory
```
Exit code: `101` (cargo usage error).

### 2.2 `go build ./...`
```
pattern ./...: directory prefix . does not contain main module or its selected dependencies
```
Exit code: `1` (go: no go.mod).

### 2.3 `npm run build`
```
npm error code ENOENT
npm error syscall open
npm error path E:\bc-audit-blockc\services\package.json
npm error errno -4058
npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open 'E:\bc-audit-blockc\services\package.json'
```
Exit code: `-4058` (npm: no package.json).

### 2.4 `task validate` / `task verify` / `task --list` — the repo's own gate
```
task: Failed to parse Taskfile.yml:
yaml: line 17: mapping values are not allowed in this context
```
Exit code: `109` (task: YAML parse failure on the `for:` loop). The repo
ships a `Taskfile.yml` whose `validate` task (the only task that would
substitute for a build) cannot be executed with `task` v3.51.1.

### 2.5 Manual SBOM validation (what the gate was *supposed* to do)
```
graphql-gateway: OK
templates-registry: OK
```
The two SBOMs do parse as valid JSON, so the underlying data is sound —
the failure is in the build/CI plumbing, not the payload.

**Verdict:** "Not buildable" in the conventional sense; the data payload is
parseable JSON; the intended task/CI gate is itself broken.

---

## 3. Dead / duplicate code

There is no application code, so traditional dead-code analysis is N/A.
Equivalent issues found in the data plane:

- **14 absolute-path leaks in `bom-ref` fields** (9 in `graphql-gateway`,
  5 in `templates-registry`). Each leak exposes the developer's macOS home
  directory and the layout of an unrelated monorepo
  (`/Users/kooshapari/CodeProjects/Phenotype/repos/FocalPoint/...`). This
  is privacy-leaking PII baked into a published SBOM. Examples:
  - `path+file:///Users/kooshapari/CodeProjects/Phenotype/repos/FocalPoint/crates/focus-audit#0.0.12`
  - `path+file:///Users/kooshapari/CodeProjects/Phenotype/repos/PhenoObservability/crates/phenotype-observably-macros#0.1.1`
- **1 component missing a license** in `graphql-gateway`:
  `phenotype-observably-macros@0.1.1` (same one whose `bom-ref` leaks the
  path).
- **No duplicate `bom-ref` values** in either SBOM (each ref is unique).
- **`metadata.component.components` is duplicated** of the first two
  entries in `components` for `focus-graphql-gateway` (the parent declares
  `bin-target-0` and `bin-target-1` as nested components and the top-level
  array restates them as `library`/`application`). Cosmetic, but it
  inflates `components` count by 2.
- **R3 spec file referenced in commit `436ca7f` and AGENTS.md is absent**
  on the default branch (no `R3_Interoperability_Spec.yaml` in working
  tree). Either the commit was reverted, force-pushed out, or the file was
  never added. This is a documentation/spec drift and a possibly missing
  deliverable from "T41–T60".

---

## 4. Dependency hygiene (CVE / outdated)

The repo has no manifest files of its own, so the dependency surface is
the SBOMs themselves. Findings on SBOM contents:

- **Generator tool is stale.** Both SBOMs declare
  `cargo-cyclonedx v0.5.9` (released 2023-04; current upstream is well
  past it). SBOM was generated on `2026-04-26` — ~7 weeks stale relative
  to the audit date.
- **Embedded target triple is non-portable.** Both SBOMs record
  `cdx:rustc:sbom:target:triple = aarch64-apple-darwin` — i.e. an SBOM
  generated on Apple Silicon macOS was committed verbatim. Consumers on
  Linux/Windows get a non-reproducible SBOM with a frozen host triple.
- **CI uses `actions/checkout@v4`** but dependabot already has an open PR
  bumping it to v6 (`#1`, opened 2026-06-10). v4 is a year-old major; v6
  is current upstream.
- **No `dependabot.yml` ecosystems can actually fire**: the config lists
  `cargo`, `pip`, `npm`, `gomod`, `github-actions` — all five ecosystems
  point at `directory: "/"`, but there is no `Cargo.toml`, no
  `requirements.txt`/pyproject, no `package.json`, no `go.mod` in the
  repo. Dependabot will scan the SBOMs and almost certainly open
  noise PRs, or it will open PRs against nothing.
- **Dependabot ignores all major version bumps** (`ignore: dependency-name: "*"` × 4 ecosystems). On a registry that is the *whole point* of the
  repo, this means security advisories that only land in major releases
  are systematically missed.
- **No CVE scanning tool is wired up.** The repo's only security step is
  TruffleHog (secret scanning) in `.github/workflows/ci.yml`. There is
  no `osv-scanner`, `cargo audit`, `trivy`, `grype`, or equivalent against
  the SBOMs.
- **TruffleHog is pinned to `@main`** (a moving ref). A supply-chain
  compromise of the upstream action would execute in CI.

---

## 5. Architecture (SOLID / hexagonal)

The repo explicitly opts out of the hexagonal refactor:

- `STATUS.md:9` and `AGENTS.md:44` mark **Stage 2 — Hexagonal Refactor**
  as "N/A (registry only)".

That is a reasonable choice for a pure SBOM registry, but it is worth
recording the structural risks of the layout:

- **No adapter/port separation.** The two SBOMs are flat files consumed
  directly. There is no schema validator (CycloneDX 1.3 / 1.5 / 1.6
  enforcement is delegated to whatever consumer parses the JSON), no
  cross-SBOM diff tool, and no shared dependency-deduplication index.
- **DRY violation across the two SBOMs.** 196 of 270/261 unique
  component names are duplicated across both files (74 unique to
  graphql-gateway, 65 unique to templates-registry). A change in
  `focus-coaching@0.0.12` requires editing the same dependency metadata
  in two files. Risk of skew.
- **Single-responsibility compromise.** `AGENTS.md` and `STATUS.md`
  claim the repo is "registry-only", yet it also carries org-level
  governance (LICENSE, dependabot, Taskfile, CI) that would normally
  live in an `org/.github` profile repo. This is consistent with
  commit `a39b5ad` ("SSOT org governance") but blurs scope.
- **No versioning policy.** Both SBOMs declare `"version": 1` in the
  CycloneDX document. There is no strategy for bumping this on
  dependency changes, no CHANGELOG, and no release tagging.

---

## 6. Spec / doc gaps

- **`AGENTS.md:10` says "CycloneDX 1.5 JSON SBOM"** but both SBOMs
  declare `specVersion: "1.3"`. **Doc vs data mismatch.**
- **`STATUS.md:18` lists "Add R3 Interoperability Spec" as backlog**, and
  the commit log shows `436ca7f feat(services): R3 cross-project
  consumption spec (T41–T60)` already merged — but the spec file is
  not present on the default branch. Either the spec was never
  committed, was lost in a force-push, or lives on a different branch
  that is not default. Either way, the headline feature "R3" is missing.
- **`STATUS.md:7` says "LICENSE pending"** but `LICENSE-APACHE` and
  `LICENSE-MIT` are present in the working tree (committed in
  `a39b5ad`). Status is stale.
- **No `CHANGELOG`, no `CONTRIBUTING`, no `SECURITY.md`, no issue
  templates** under `.github/`. Dependabot config exists but there is
  no PR template.
- **README.md is 21 lines of badges** plus a HITL-less / AI-DD
  disclaimer. It does not document: how to add a new service SBOM, how
  to regenerate existing SBOMs, where the source crates live, or which
  CycloneDX spec version is actually used.

---

## 7. Test-coverage gaps

- **Zero tests.** No `tests/`, no `*_test.rs`, no `*.test.ts`,
  no `test_*.py`. `find . -type f -name "*test*"` returns nothing.
- **CI does not run any tests** because there are none to run.
- **The only correctness gate is JSON parse** in `.github/workflows/ci.yml:24-29`. This catches malformed JSON but not:
  - schema-level CycloneDX violations (no `cyclonedx-python-lib` or
    `cyclonedx-cli` validation),
  - cross-SBOM skew (same component version, different license in
    the two files),
  - freshness (no check that SBOM is < N days old),
  - privacy leaks (the `path+file:///Users/...` `bom-ref` values).
- **No regression test** that pins the number of components,
  the timestamp format, or the tool version, so a regeneration that
  silently drops components would pass CI.

---

## 8. Debt hotspots (severity-ranked)

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 1 | **High** | `Taskfile.yml` does not parse on `task` v3.51.x — every advertised task (`validate`, `verify`, `clean`, `quality`) is unrunnable. The repo's stated quality gate is dead. | `task --list` → `yaml: line 17: mapping values are not allowed in this context` (exit 109) |
| 2 | **High** | 14 SBOM `bom-ref` fields leak developer's absolute macOS path (`/Users/kooshapari/CodeProjects/...`) — privacy PII in a published artifact. | `python` walk over `*.cdx.json`, grep for `kooshapari` |
| 3 | **High** | Doc ↔ data mismatch on CycloneDX spec version (AGENTS.md says 1.5, files say 1.3). | `AGENTS.md:10` vs `*.cdx.json` `"specVersion": "1.3"` |
| 4 | Med | R3 spec committed (`436ca7f`) but not present on default branch; `STATUS.md` still lists it as backlog. | `find . -name "R3*"` → empty |
| 5 | Med | `dependabot.yml` declares 4 ecosystems (`cargo`, `pip`, `npm`, `gomod`) that have no manifest in the repo → noise PRs. | `.github/dependabot.yml:3-77` vs `find` for manifests |
| 6 | Med | TruffleHog pinned to `@main` (mutable ref) — supply-chain risk. | `.github/workflows/ci.yml:40` |
| 7 | Med | Embedded `aarch64-apple-darwin` target triple in SBOMs — non-reproducible across hosts. | `*.cdx.json` `metadata.properties` |
| 8 | Med | No CVE/SCA tool runs in CI. Only TruffleHog. | `.github/workflows/ci.yml` |
| 9 | Med | No tests at all; CI only validates JSON parse. | `find` for test files |
| 10 | Low | Branch sprawl: 5 remote branches (1 default + 2 duplicated governance + 1 dependabot + 1 empty `main`). | `git branch -a` |
| 11 | Low | One component (`phenotype-observably-macros@0.1.1`) has no `licenses` field. | `*.cdx.json` walk |
| 12 | Low | `STATUS.md` still says "LICENSE pending" but LICENSE files are committed. | `STATUS.md:7` |
| 13 | Low | `actions/checkout@v4` in CI while dependabot PR #1 sits open bumping to v6. | `.github/workflows/ci.yml:22` |
| 14 | Low | DRY: 196 component names duplicated across the two SBOMs; no shared index. | `_audit_stats.py` |
| 15 | Low | 7-week stale SBOMs (timestamp 2026-04-26, audit 2026-06-15). | `*.cdx.json` `metadata.timestamp` |

### Top-3 issues (per task)

1. **`Taskfile.yml` is unparseable on the current `task` runtime** — the
   repo's own quality gate is dead. The `for: { var: SERVICES }` block
   on line 16-17 of `Taskfile.yml:13-17` triggers a YAML parse error in
   `task` v3.51.1, so `task validate`, `task verify`, `task --list`,
   and `task clean` all exit 109 with no useful output. CI falls back
   to an inline `for` loop in `.github/workflows/ci.yml:26-29` — which
   works, but the local developer experience promised by the Taskfile
   is broken.
2. **Privacy leak: 14 `bom-ref` entries hard-code the maintainer's
   `/Users/kooshapari/CodeProjects/...` macOS path** across both
   published SBOMs (9 in `graphql-gateway`, 5 in
   `templates-registry`). SBOMs are meant to be portable; these are
   not. `cargo-cyclonedx` should be configured with `--override-prefix`
   or the `bom-ref` rewritten in a post-processing step.
3. **CycloneDX spec-version drift between docs and data**
   (`AGENTS.md:10` claims 1.5, both SBOMs declare `"specVersion": "1.3"`)
   combined with the R3 spec file referenced in commit
   `436ca7f` and `STATUS.md:18` being absent from the default branch.
   The headline deliverables advertised in the README/governance chain
   are not actually present.

---

## 9. Open PRs / branch sprawl

Remote branches (5 total, default = `chore/dependabot-2026-06-08`):

| Branch | Commits | Notes |
|--------|--------:|-------|
| `chore/dependabot-2026-06-08` (default) | 4 | HEAD = `0d7262c` |
| `main` | 3 | Behind default by `d352613` (checkout v6) and `0d7262c` (AI-DD badge); CI workflow `push: main` and `pull_request: main` will not pick up current default's HEAD |
| `governance/2026-06-10` | 3 | Identical tip to `governance/services-2026-06-10` (`a39b5ad`) — duplicate |
| `governance/services-2026-06-10` | 3 | Identical tip to `governance/2026-06-10` — duplicate |
| `dependabot/github_actions/actions/checkout-6` | ? | Open PR #1 target; 5 days open with no reviews |

**Open PRs (1):**

| # | Title | Author | Created | State |
|---|-------|--------|---------|-------|
| 1 | `chore(ci): bump actions/checkout from 4 to 6` | `app/dependabot` (bot) | 2026-06-10 | OPEN |

**Findings:**

- 2 governance branches are byte-identical at HEAD — clear
  duplication.
- `main` is *behind* the actual default branch, but `ci.yml` only
  triggers on `main`. New commits to the default branch never run CI.
- Default branch is itself a feature branch (`chore/dependabot-2026-06-08`),
  not `main`. This breaks every consumer that uses
  `git clone --branch main` or any "PRs welcome" badge that targets
  `main`.
- Dependabot PR #1 is the only PR; no human review activity; the
  maintainer is AI-only per `README.md`, so there is no human in the
  loop to merge it.

---

## 10. Test coverage detail

(See §7.) No tests. JSON-parse is the only assertion. There is no
coverage tooling (no `tarpaulin`, no `nyc`, no `coverage.py`).

---

## 11. Recommendations (informational, not a plan)

1. Fix `Taskfile.yml:16-17` — convert the `for: { var: SERVICES }` block
   to the syntax accepted by `task` v3.x, or pin the runtime.
2. Strip the `/Users/kooshapari/...` prefix from all `bom-ref` values
   in both SBOMs; add a CI step that fails the build on
   `path+file:///Users/` in any `*.cdx.json`.
3. Reconcile `AGENTS.md:10` with the actual `specVersion` in the
   files, and either re-add the R3 spec or remove the claim from
   `STATUS.md:18`.
4. Trim `dependabot.yml` to ecosystems that have a manifest (i.e.
   `github-actions` only), or add a synthetic `package.json`/`Cargo.toml`
   so dependabot has something real to bump.
5. Pin TruffleHog to a release tag (e.g. `@v3.x`) instead of `@main`.
6. Add an SCA step (`osv-scanner` against the SBOMs, or
   `cargo audit` for the embedded purls).
7. Consolidate the two governance branches.
8. Promote `main` to the actual default, or change CI to trigger on
   whatever branch is default.
9. Add a 7-day freshness check to CI — fail if SBOM `metadata.timestamp`
   is older than N days.
10. Add a regression test that asserts the count of components, the
    absence of `Users/` strings, and the spec version.

---

## 12. Audit metadata

- Cloned with: `git clone https://github.com/KooshaPari/services.git services`
- Default branch tip: `0d7262cd605638a18cc5a000e8c42858d1bbc6fc`
- Audit commit: this document is added on branch `audit/block-c`
  (see companion commit).
- `cargo` exit: 101
- `go build` exit: 1
- `npm run build` exit: -4058
- `task` exit: 109 (Taskfile YAML parse error on line 17)
- `python` JSON-parse exit: 0 (both SBOMs valid JSON)
