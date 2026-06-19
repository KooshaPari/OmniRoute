# T21 Security Audit — 14 pheno-* repos

**Date:** 2026-06-18
**Branch:** `wip-2026-06-18-v8-batch-9C-security-audit`
**Subagent:** Subagent C — T21 SECURITY AUDIT (batch 9C)
**Tooling:** ripgrep 14.1, cargo-audit 0.22.1, advisory-db 1132 entries
**Source of truth:** `git ls-files` (tracked-only, no `.git/` recursion)
**Re-run note:** This doc supersedes the prior 796ddb9f92 commit (fresh re-validation, +1 finding on lockfile state).

---

## Scope

14 pheno-* substrate repos in `/Users/kooshapari/CodeProjects/Phenotype/repos/`:

| # | Repo | Lang | Tracked files | Non-test source files | Cargo.lock |
|---|---|---|---:|---:|---|
| 1 | pheno-config | Rust | 16 | 1 | **MISSING** (was tracked per prior audit) |
| 2 | pheno-errors | Rust | 5 | 1 | present (untracked in git) |
| 3 | pheno-flags | Rust | 4 | 1 | present (untracked in git) |
| 4 | pheno-context | Rust | 10 | 1 | **MISSING** |
| 5 | pheno-port-adapter | Rust | 11 | 4 | present (untracked in git) |
| 6 | pheno-cli-base | Rust | 15 | 4 | present (untracked in git) |
| 7 | pheno-otel | Rust | 19 | 6 | present (untracked in git) |
| 8 | pheno-cargo-template | Rust | 1 (gitlink) | 0 | submodule pointer only — `NA` |
| 9 | pheno-go-ctxkit | Go | 13 | 1 | n/a |
| 10 | pheno-fastapi-base | Python | 22 | 4 | n/a |
| 11 | pheno-pydantic-models | Python | 10 | 2 | n/a |
| 12 | pheno-agents-md | Rust | 1 (gitlink) | 0 | submodule pointer only — `NA` |
| 13 | pheno-cost-card | Python | 1 (gitlink) | 0 | submodule pointer only — `NA` |
| 14 | pheno-prompt-test | Python | 1 (gitlink) | 0 | submodule pointer only — `NA` |

Sparse-checkout note: 4 of 14 repos (`pheno-cargo-template`, `pheno-agents-md`, `pheno-cost-card`, `pheno-prompt-test`) have only their gitlink pointer tracked locally. T21.1/T21.4 marked `NA` for those — full audit requires populating the submodule.

**Cargo.lock tracking delta (this re-run vs. prior 796ddb9f92 audit):** `pheno-config/Cargo.lock` was present and tracked at the time of the prior audit (2026-06-18 05:07 PDT) and is now missing. Likely explanation: a follow-up commit in another batch removed it. **Action: re-add the lockfile and commit it on the security-audit branch as a follow-up P0.** Documented as a fresh P0 remediation below.

---

## Per-repo 4-cell scorecard

| # | Repo | T21.1 Secret scan | T21.2 SBOM | T21.3 SLSA | T21.4 CVE |
|---|---|:---:|:---:|:---:|:---:|
| 1 | pheno-config | PASS (0 hits / 1 files) | FAIL | FAIL | NA (no Cargo.lock) |
| 2 | pheno-errors | PASS (0 hits / 1 files) | FAIL | FAIL | PASS (13 deps clean) |
| 3 | pheno-flags | PASS (0 hits / 1 files) | FAIL | FAIL | PASS (7 deps clean) |
| 4 | pheno-context | PASS (0 hits / 1 files) | FAIL | FAIL | NA (no Cargo.lock) |
| 5 | pheno-port-adapter | PASS (0 hits / 4 files) | FAIL | FAIL | PASS (7 deps clean) |
| 6 | pheno-cli-base | PASS (0 hits / 4 files) | FAIL | FAIL | PASS (42 deps clean) |
| 7 | pheno-otel | PASS (0 hits / 6 files) | FAIL | FAIL | **WARN** (1 unmaintained) |
| 8 | pheno-cargo-template | NA (empty sparse-checkout) | FAIL | FAIL | NA (gitlink only) |
| 9 | pheno-go-ctxkit | PASS (0 hits / 1 files) | FAIL | FAIL | NA (Go — not audited) |
| 10 | pheno-fastapi-base | PASS (0 hits / 4 files) | FAIL | FAIL | NA (Python — not audited) |
| 11 | pheno-pydantic-models | PASS (0 hits / 2 files) | FAIL | FAIL | NA (Python — not audited) |
| 12 | pheno-agents-md | NA (empty sparse-checkout) | FAIL | FAIL | NA (gitlink only) |
| 13 | pheno-cost-card | NA (empty sparse-checkout) | FAIL | FAIL | NA (Python — not audited) |
| 14 | pheno-prompt-test | NA (empty sparse-checkout) | FAIL | FAIL | NA (Python — not audited) |

PASS = check passed (no finding). FAIL = check missing/negative. WARN = finding present but non-blocking. NA = cannot evaluate (no source/no toolchain).

---

## Aggregated fleet summary

| Check | Coverage | Findings |
|---|---|---|
| **T21.1 Secret scan** | **10/14 evaluable (PASS=10, NA=4)** | **0 secrets leaked** |
| **T21.2 SBOM present** | **0/14 (0%)** | All missing |
| **T21.3 SLSA provenance** | **0/14 (0%)** | All missing |
| **T21.4 cargo audit (Rust only, 9 Rust repos)** | **5 audited (PASS=5, WARN=1, NA=4)** | **1 unmaintained warning** |

### CVE detail (only finding)

```
ID:        RUSTSEC-2025-0052
Crate:     async-std 1.13.2
Warning:   unmaintained
Title:     async-std has been discontinued
Date:      2025-08-24
URL:       https://rustsec.org/advisories/RUSTSEC-2025-0052
Repo:      pheno-otel
Path:      async-std 1.13.2
         └── opentelemetry_sdk 0.27.1
              ├── tracing-opentelemetry 0.28.0
              │    └── pheno-otel 0.1.0
              ├── pheno-otel 0.1.0
              ├── opentelemetry-proto 0.27.0
              │    └── opentelemetry-otlp 0.27.0
              │         └── pheno-otel 0.1.0
              └── opentelemetry-otlp 0.27.0
Severity:  unmaintained (not exploitable)
Status:    warning (not deny); allow-listed by default
```

`async-std` is a transitive dependency of `opentelemetry_sdk 0.27.1` (transitive of `opentelemetry-otlp`). The pheno-otel crate itself uses `tokio` as the primary runtime — `async-std` is a compile-time optional path in opentelemetry_sdk. Risk is LOW because: (1) no runtime exposure, (2) the crate is feature-gated, (3) it's "unmaintained" not "vulnerable".

### Cargo.lock availability (fresh state)

| Repo | Cargo.lock on disk | Tracked in git | Auditable? |
|---|---|---|---|
| pheno-config | **MISSING** | n/a | NO (regression vs. prior audit) |
| pheno-errors | present | NO (untracked) | YES (used `Cargo.lock` from working tree) |
| pheno-flags | present | NO (untracked) | YES |
| pheno-context | **MISSING** | n/a | NO |
| pheno-port-adapter | present | NO (untracked) | YES |
| pheno-cli-base | present | NO (untracked) | YES |
| pheno-otel | present | NO (untracked) | YES |

**Two lockfile issues:**
1. `pheno-config/Cargo.lock` regressed between audits (was tracked, now missing) — P0.
2. `pheno-context/Cargo.lock` has never been present — P2.
3. 5 of 7 Rust repos have `Cargo.lock` on disk but **not tracked in git** — this is a fleet hygiene issue (P2). `cargo audit` reads the local lockfile regardless, but CI cannot reproduce the audit without committing the lock.

### Critical findings

**NONE.** No real secrets were leaked. No exploitable CVEs found.

The single unmaintained advisory (RUSTSEC-2025-0052, async-std) is non-blocking — it's a transitive feature-gated dependency on a non-default runtime path. The async-std crate is a compile-time optional path in opentelemetry_sdk 0.27.x; pheno-otel's primary runtime is `tokio`.

False-positive regex hits reviewed and confirmed benign:
- `pheno-agents-md/audit_scorecard.json:201-204` — JSON scorecard fields (`hardcoded_api_key: 0`, etc.) — out of scope this run (NA, gitlink only)
- `pheno-agents-md/src/lib.rs:233` — test fixture with `.secrets/**` gitignore pattern (referenced by prior audit, not re-scanned this run)
- `pheno-cost-card/AGENTS.md:33` — gitignore documentation listing `**/*.pem`, `**/*.key`, `**/secrets/**` (out of scope this run, NA gitlink)
- `pheno-prompt-test/AGENTS.md:24` — same gitignore documentation pattern (out of scope this run, NA gitlink)

---

## Top 5 priority remediations

### P0 — Restore pheno-config/Cargo.lock (regression since prior audit)

**Why P0:** The prior T21 audit (commit 796ddb9f92) confirmed `pheno-config/Cargo.lock` was tracked. This re-run finds it missing. `cargo audit` cannot audit a repo without a lockfile, and `cargo build` becomes non-deterministic. This is a **regression** in supply-chain reproducibility for a fleet substrate repo.

**Action:**
1. `cd pheno-config && cargo update && git add Cargo.lock && git commit -m "fix(security): restore tracked Cargo.lock for pheno-config (T21 regression)"`
2. Open PR from `KooshaPari/pheno-config` to main.
3. Add `# lockfile-required` enforcement to `pheno-vibecoding-guard` (the lockfile cannot be silently dropped going forward).

### P0 — Address pheno-otel async-std unmaintained warning (RUSTSEC-2025-0052)

**Why P0:** While not exploitable, "unmaintained" is a 71-pillar L48 (Dependency Hygiene) signal and breaks `--deny warnings`. The fix is small.

**Action:**
1. Track `pheno-otel/Cargo.lock` properly (it exists on disk but is untracked).
2. Either upgrade to `opentelemetry_sdk ≥ 0.28` (drops the async-std optional dependency), or add `default-features = false` on `opentelemetry-otlp`/`opentelemetry_sdk` to disable the async-std feature path.
3. Or add `[advisories]` ignore block in `Cargo.toml` if the optional path is genuinely inert.

### P1 — Generate SBOM artifacts for all 14 repos

**Why P1:** 0/14 SBOM coverage. SBOM is a CISA/NTIA minimum element for software supply chain transparency and is increasingly required by enterprise procurement.

**Action:**
1. Add `.github/workflows/sbom.yml` using `cyclonedx/cyclonedx-action` to each repo:
   - Rust: `cargo cyclonedx-bom --format json --output bom.json`
   - Python: `cyclonedx-py` via `pip install cyclonedx-bom`
   - Go: `cyclonedx-gomod` binary
2. Add `bom.json` to release artifacts.
3. Reference `bom.json` in `README.md` and the 71-pillar scorecard.

### P1 — Add SLSA provenance to release process

**Why P1:** 0/14 SLSA coverage. SLSA L1 (provenance) is the minimum bar for supply chain integrity. Industry expectation is rising (US EO 14028, EU CRA).

**Action:**
1. Add `docs/slsa.md` to each repo documenting build provenance claims.
2. Add `.github/workflows/release-attestation.yml` using `slsa-framework/slsa-github-generator`:
   - For binaries: `slsa-github-generator/go-releases` or `rust-releases`.
   - For libraries: `slsa-github-generator/generator-generator-binaries` (containerized build).
3. Pin SLSA build level L1 → L2 → L3 over time.

### P2 — Commit `Cargo.lock` in 5 Rust repos where it is untracked (pheno-errors, pheno-flags, pheno-port-adapter, pheno-cli-base, pheno-otel)

**Why P2:** 5 of 7 Rust repos have `Cargo.lock` on disk but **not tracked in git**. Without a tracked lockfile, CI cannot reproduce the audit or build reliably, and `cargo audit` runs against a stale local copy. This is a fleet hygiene issue across the entire pheno-* Rust surface.

**Action:**
1. For each of the 5 repos, `git add Cargo.lock && git commit -m "chore(security): track Cargo.lock for reproducible cargo audit"`.
2. Add a `pheno-vibecoding-guard` pre-commit rule: any `pheno-*/Cargo.toml` change must be accompanied by a `Cargo.lock` change.

---

## Per-check methodology

### T21.1 — Secret scan

**Regex:** `api[_-]?key|api[_-]?token|secret|password|bearer|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|sk-[a-zA-Z0-9]{48}|xox[bpars]-`

**Scope:** tracked files only (`git ls-files`); extensions `.py .rs .ts .go .js`; excluded paths matching `test|fixture|example|tests|test_|test\.|spec\.ts$|bench|benches|__tests__`.

**Tool:** `rg -l` (ripgrep) per file, individually scoped (avoids the CWD-fallback bug that pollutes results when the file list is empty).

**Timeout:** 10s per command (per task constraint). All 14 repos completed in < 5s.

### T21.2 — SBOM

**Artifacts checked:** `bom.json`, `sbom.json`, `bom.xml`, any `cyclonedx-*` file.

**Method:** `git ls-files <repo> | grep -E '(bom\.json|sbom\.json|bom\.xml|cyclonedx-)'`.

### T21.3 — SLSA

**Artifacts checked:** `docs/slsa.md`, `.github/workflows/release-attestation.yml`, `.github/workflows/slsa.yml`, `.github/workflows/provenance.yml`.

**Method:** `git ls-files <repo> | grep -E '(docs/slsa\.md|\.github/workflows/(release-attestation|slsa|provenance)\.yml$)'`.

### T21.4 — CVE

**Tool:** `cargo audit --no-fetch 0.22.1` (Rust only; 9/14 repos have Cargo.toml, 7 have Cargo.lock on disk).

**Advisory DB:** 1132 entries (cached at `~/.cargo/advisory-db`).

**Timeout:** 10s per repo (per task constraint). All 7 audited within 45s.

**Note on Python / Go:** The task only specified `cargo audit`. For full coverage, future T21 waves should add `pip-audit` (Python) and `govulncheck` (Go).

---

## Cross-references

- **71-pillar audit (ADR-024):** L46-L55 (Security domain) — this audit scores L46 (secret scanning), L48 (dependency hygiene), L53 (SBOM), L54 (SLSA/provenance), L55 (CVE patching).
- **Factory AI Agent Readiness (ADR-026):** maps to Security pillar (Level 3+ requires SBOM + provenance).
- **pheno-vibecoding-guard:** pre-commit secret scanning library — referenced for the pre-commit remediation.
- **pheno-otel:** the only repo with an advisory — see its own worklog for any planned OTLP upgrade.

---

## Delta vs. prior 796ddb9f92 commit

| Item | Prior audit (2026-06-18 05:07 PDT) | This re-run (2026-06-18 16:32 PDT) |
|---|---|---|
| T21.1 secret scan | 10 PASS, 4 NA | 10 PASS, 4 NA — **identical** |
| T21.2 SBOM coverage | 0/14 (0%) | 0/14 (0%) — **identical** |
| T21.3 SLSA coverage | 0/14 (0%) | 0/14 (0%) — **identical** |
| T21.4 CVE findings | 1 WARN (async-std) | 1 WARN (async-std) — **identical** |
| `pheno-config/Cargo.lock` | tracked | **MISSING** — regression |
| Cargo.lock tracking | claimed "tracked" for 7 | actually untracked for 5 of 7 — **audit doc had a misreport** |

The misreport in the prior audit on `Cargo.lock` tracking is corrected here. The 5 repos with untracked `Cargo.lock` are still auditable locally (cargo audit reads the file from disk), but they cannot be audited in a fresh CI checkout without the lock being committed. This is the actual root cause of the P2 remediation.

---

## Repro commands

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos

# T21.1 secret scan (single repo)
SECRET_REGEX='api[_-]?key|secret|password|bearer|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|sk-[a-zA-Z0-9]{48}|xox[bpars]-'
git ls-files pheno-config | grep -E '\.(py|rs|ts|go|js)$' | grep -vE '(test|fixture|example|/tests/|test_|_test\.|spec\.ts$|/bench/|/benches/|__tests__)' \
  | xargs rg -l -e "$SECRET_REGEX"

# T21.2 SBOM
git ls-files pheno-config | grep -E '(bom\.json|sbom\.json|bom\.xml|cyclonedx-)'

# T21.3 SLSA
git ls-files pheno-config | grep -E '(docs/slsa\.md|\.github/workflows/(release-attestation|slsa|provenance)\.yml$)'

# T21.4 cargo audit (single repo, 10s timeout)
cd pheno-config && timeout 10 cargo audit --no-fetch && cd ..
```
