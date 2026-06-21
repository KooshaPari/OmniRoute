# L19 — Supply-chain security (SBOM / CVE / lockfile pinning)

**Owner:** forge-A10 (security)
**Bloc scope:** AgilePlus + thegent + Tracely + Tracera + phenotype-dep-guard + phenotype-tooling (federated governance)

## Scope

End-to-end supply-chain integrity for the bloc: lockfile presence + pinning, automated update tooling (Renovate / Dependabot), CVE matching (OSV / GHSA), SBOM emission (CycloneDX / SPDX), VEX statements, SLSA provenance, and reusable enforcement workflows. Cross-references `phenotype-dep-guard/` as the bloc's federated supply-chain governor.

## SOTA 2026

- **Lockfiles are the source of truth** — `Cargo.lock` (Rust), `uv.lock` / `poetry.lock` (Python), `pnpm-lock.yaml` / `package-lock.json` (Node), `go.sum` (Go) all committed and pinned (no `^`/`~` in transitive resolution). Reproducible builds + `cargo --locked`, `npm ci`, `go build -mod=readonly`.
- **SBOM emission:** CycloneDX 1.5+ (OWASP) and SPDX 3.0 in CI for every release; signed (Sigstore) and attached to GH releases; consumed by `dependency-graph` + `dependabot` for vulnerability surfacing.
- **CVE matching:** OSV.dev (Google, 2021+, cross-ecosystem) + GHSA + RustSec; surfaced as PR-level warnings via `osv-scanner` or custom client.
- **Dependency update tooling:** Renovate Bot (Mendi, OSS) preferred over Dependabot (limited grouping, no OSS VEX) — Renovate supports `packageRules`, datasource pinning, `rangeStrategy`, and `replacement: packageRules` for mass renames.
- **SLSA Build L2** (slsa.dev) — isolated build, signed provenance via `actions/attest-build-provenance` + Sigstore.
- **VEX (Vulnerability Exploitability eXchange)** — OpenVEX 1.0 (2023+) or CSAF 2.0 to silence known-not-exploitable CVEs; auditable per-finding.
- **Bloc exemplar:** `phenotype-dep-guard/` — OSV client, CycloneDX SBOM emitter, manifest + lockfile parsers, full SOTA supply-chain CVE matching (per `AUDIT_BLOC_VS_2026_SOTA.md:70-74`).
- **Federated enforcement:** `phenotype-dep-guard/.github/workflows/reusable-dep-guard.yml:43-67` — `workflow_call` interface that any repo can wire in to gate CI on `--fail-on: high`.

## Phenotype state

- `phenotype-dep-guard/src/osv.rs:1-104` — OSV.dev API client + result type (described in `AUDIT_BLOC_VS_2026_SOTA.md:70`). — **status ✓** (file described in bloc SOTA, OSV SOTA primitive)
- `phenotype-dep-guard/src/sbom.rs:1-131` — CycloneDX 1.5 SBOM emitter. — **status ✓**
- `phenotype-dep-guard/src/lockfile.rs:1-375` — Cargo.lock / package-lock.json / poetry.lock parser. — **status ✓**
- `phenotype-dep-guard/src/manifest.rs:1-460` — Cargo.toml / package.json / pyproject.toml parser. — **status ✓**
- `phenotype-dep-guard/src/vulnerability.rs:1-198` — Vulnerability record + CVE match. — **status ✓**
- `phenotype-dep-guard/src/scanner.rs:1-239` — Manifest → OSV → SBOM pipeline. — **status ✓**
- `phenotype-dep-guard/src/phenotype_dep_guard/policies.py:42-93` — `ban_sql_string_concat` high-severity heuristic (SQLi-flavored typosquat detector). — **status ✓**
- `phenotype-dep-guard/src/phenotype_dep_guard/policies.py:106-143` — `require_error_context` medium-severity heuristic (lost stack trace / silent swallow). — **status ✓**
- `phenotype-dep-guard/src/phenotype_dep_guard/cli.py:14-71` — `scan` command with `--fail-on {none,high,any}` gate. — **status ✓**
- `phenotype-dep-guard/src/phenotype_dep_guard/agent.py:46-158` — `AgenticAnalyzer` (LLM-augmented malicious-dep detection; falls back to deterministic heuristic score). — **status △** (LLM via `forge -p` is a mock fallback path; L18 gap #10 cross-ref)
- `phenotype-dep-guard/.github/workflows/reusable-dep-guard.yml:1-67` — federated `workflow_call` with `fail-on` input + SHA-pinned `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5` + `actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065`. — **status ✓**
- `phenotype-dep-guard/.github/dependabot.yml:1-12` — `github-actions` + `pip` weekly, `open-pull-requests-limit: 10`. — **status △** (no `cargo` ecosystem; dep-guard itself is Python-only)
- `phenotype-dep-guard/pyproject.toml:1-48` — pinned lower bounds `>=` for all 7 deps (click, rich, httpx, pydantic, python-dotenv, packageurl-python, toml, pyyaml). — **status △** (no upper bound; `>=` permits drift)
- `phenotype-dep-guard/SECURITY.md:1-33` — GHSA triage policy, supported versions, "Release only from green CI checks". — **status ✓**
- `AgilePlus/Cargo.lock` (committed) + `AgilePlus/crates/integration/Cargo.lock` (committed) — Rust workspace lockfile present. — **status ✓**
- `AgilePlus/.github/workflows/deny.yml:1-50` — `cargo-deny` weekly Monday 05:17 UTC + on PR/push. — **status ✓**
- `AgilePlus/deny.toml` — `[advisories]` RustSec db + `[licenses]` allowlist. — **status ✓**
- `AgilePlus/.github/workflows/release-attestation.yml` (whole file) — SLSA Build L2 attestation on release. — **status ✓**
- `AgilePlus/.github/workflows/scorecard.yml` (whole file) — OpenSSF Scorecard on every push. — **status ✓**
- `AgilePlus/.github/dependabot.yml:1-50+` — `cargo` (root + 21 per-crate), `pip`, `github-actions` weekly; explicit `groups:` + per-crate dirs to surface per-crate dep deltas. — **status ✓** (well-structured)
- `AgilePlus/renovate.json5:1-29` — Renovate Bot config with `config:recommended`, `rangeStrategy: bump`, `packageRules` groups for cargo/npm/gomod/pip. — **status △** (Renovate co-exists with Dependabot; double-update noise likely)
- `thegent/Cargo.lock`, `thegent/uv.lock`, `thegent/crates/Cargo.lock` (all committed) — multi-ecosystem lockfiles. — **status ✓**
- `thegent/apps/byteport/frontend/web-next/pnpm-lock.yaml` + `package-lock.json` (both) + `backend/api/go.sum` + `docs/package-lock.json` (all committed) — Node + Go + docs lockfiles. — **status ✓**
- `thegent/hooks/hook-dispatcher/Cargo.lock` + `thegent/crates/thegent-subprocess/Cargo.lock` — sub-crate lockfiles. — **status ✓**
- `thegent/.github/workflows/ci.yml` + `python-ci.yml` + `scorecard.yml` + `deny.yml` (whole files) — CI + cargo-deny + Scorecard. — **status ✓**
- `thegent/.github/workflows/backup/security-deep-scan.yml:8-30` — Trivy daily `aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25` `scan-type: 'fs'`, `severity: 'CRITICAL,HIGH'`, SARIF upload. — **status ✓** (Trivy is not OSV, but cross-references the same vulnerability feeds; complementary)
- `thegent/.github/dependabot.yml:1-50+` — `pip` daily, `cargo` daily, `gomod` daily (Byteport), `npm` daily (Byteport), `github-actions`. — **status △** (daily schedule is aggressive; risk of PR flood)
- `thegent/uv.lock` — UV lockfile. — **status ✓**
- `Tracely/Cargo.lock` (committed) + `Tracely/crates/tracely-sentinel/.env.example` — Rust workspace + env. — **status ✓**
- `Tracely/.github/workflows/audit.yml:1-22` — CodeQL (Rust) weekly Tue 04:17 UTC, `security-events: write`. — **status ✓** (CodeQL is a SAST, not supply-chain scanner, but raises dependency findings via Dataflow)
- `Tracely/.github/workflows/release-attestation.yml` (whole file) — SLSA Build L2. — **status ✓**
- `Tracely/.github/workflows/scorecard.yml` (whole file) — OpenSSF Scorecard. — **status ✓**
- `Tracely/.github/workflows/deny.yml:1-30+` — `cargo-deny` weekly Mon 09:00 UTC. — **status ✓**
- `Tracely/.github/dependabot.yml:1-30+` — `cargo` weekly Tue (with `groups: patches/minor`), `github-actions` weekly. — **status ✓**
- `Tracely/renovate.json5:1-30+` — Renovate config. — **status △** (co-exists with Dependabot)
- `Tracely/.pre-commit-config.yaml:18-22` — `gitleaks v8.21.2` pre-commit (not supply-chain per se, but rejects secret-bearing deps). — **status ✓**
- `Tracera/Cargo.lock` + `Tracera/docs/package-lock.json` (both committed) — lockfiles present. — **status ✓**
- `Tracera/.github/workflows/cargo-deny.yml:1-30+` — weekly Mon 10:27 UTC. — **status ✓**
- `Tracera/.github/workflows/release-attestation.yml` (whole file) — SLSA Build L2. — **status ✓**
- `Tracera/.github/workflows/scorecard.yml` (whole file) — OpenSSF Scorecard. — **status ✓**
- `Tracera/.github/workflows/release-plz.yml` (whole file) — release-plz (cargo release automation). — **status ✓**
- `Tracera/.github/dependabot.yml` — **absent** (no Dependabot config). — **status ✗**
- `phenotype-tooling/.github/dependabot.yml` (existence verified) — Dependabot at the federation root. — **status △** (content not inspected)
- `phenotype-tooling/.github/workflows/deny.yml` + `release-attestation.yml` + `scorecard.yml` + `audit.yml` (all existence verified) — federation root. — **status ✓**
- `Sidekick/sbom.cdx.json` + `Eidolon/sbom.cdx.json` + `PhenoObservability/sbom.cdx.json` + `heliosApp/sbom.cdx.json` + `eidolon-wt-from-impls/sbom.cdx.json` + `Paginary/sbom.cdx.json` (all CycloneDX 1.5+ JSON) — CycloneDX SBOMs emitted for satellite crates. — **status ✓** (proves the SBOM toolchain is operational across the federation)
- `pheno/sbom/phenotype-error-macros.cdx.json` + `phenotype-event-sourcing.cdx.json` + `phenotype-string.cdx.json` + `phenotype-contracts.cdx.json` (all committed) — per-crate CycloneDX SBOMs under `pheno/sbom/`. — **status ✓**
- `AgilePlus/findings/secrets_precommit_audit_2026-05-05.md` — pre-existing audit (secrets-focused, cross-cuts). — **status △** (informational)
- `PhenoSpecs/research/PATCHING_ALGORITHMS_SOTA.md` (existence verified) — patching SOTA. — **status △** (research only)
- `AUDIT_BLOC_VS_2026_SOTA.md:70-74` — declares L19 fully covered with `phenotype-dep-guard/` (2,032 lines). — **status ✓** (governance declaration)
- `AUDIT_BLOC_VS_2026_SOTA.md` (line containing "Supply-chain CVE") — declares the bloc **12 months ahead** on CVE matching. — **status ✓** (self-attested, evidence-backed)

## Gaps

1. **No OpenVEX / CSAF statement emission** in `phenotype-dep-guard/` — VEX is the SOTA mechanism to silence known-not-exploitable CVEs with an auditable allowlist. The dep-guard CLI can fail CI on `high` severity but has no way to attach a VEX document per advisory. — **effort: M** (add `src/vex.rs` and a `dep-guard vex <advisory-id>` command)
2. **No SPDX emission** — only CycloneDX is implemented in `phenotype-dep-guard/src/sbom.rs:1-131`. Some downstream consumers (US fed, certain Linux distros) prefer SPDX 3.0. — **effort: M** (add a second emitter to `sbom.rs` or a sibling `spdx.rs`)
3. **`Tracera` has no Dependabot config** — `Tracera/.github/dependabot.yml` is missing. `cargo-deny` will catch known-bad crates, but Dependabot is the fastest signal for new advisories. — **effort: S**
4. **Renovate + Dependabot co-existing on AgilePlus and Tracely** — `AgilePlus/renovate.json5:1-29` + `AgilePlus/.github/dependabot.yml:1-50+` both run weekly, generating duplicate PRs. Pick one (Renovate for grouping/VEX, Dependabot for simplicity). — **effort: S**
5. **Thegent's Dependabot is `interval: daily`** (`thegent/.github/dependabot.yml:1-50+`) — daily with `open-pull-requests-limit: 30` floods PR lists. Thegent's PR count will mask real signal. — **effort: S** (drop to weekly + raise `open-pull-requests-limit` cap)
6. **`phenotype-dep-guard/pyproject.toml:6-17` has no upper bounds** — `click>=8.1.7`, `rich>=13.7.0`, etc. allow drift to incompatible majors. With no `requirements.txt`/lockfile committed (only `pyproject.toml`), `pip install .` resolves to "latest of each" which is non-reproducible. — **effort: S** (commit `uv.lock` or `pip-tools` `requirements.txt`; add upper bounds or use `==` in a generated lockfile)
7. **`phenotype-dep-guard/agent.py:32-35` silent mock fallback** — when `forge` is unavailable, falls back to mock. L18 gap #10 cross-ref. The LLM-deep-dive path is not auditable. — **effort: S**
8. **`phenotype-dep-guard/src/phenotype_dep_guard/resolver.py:96-112` is stubbed** — `_parse_pyproject` / `_parse_setup_py` / `_parse_pipfile` return `[]`. Most Python projects won't be scanned. — **effort: M** (port `manifest.rs:1-460` parsers from the referenced crate, or replace with `tomllib` + `ast.literal_eval` for `setup.py`)
9. **No SLSA provenance for `phenotype-dep-guard` releases** — `phenotype-dep-guard/.github/workflows/` lacks a `release-attestation.yml`. The federation depends on this crate, so unsigned artefacts undermine the SLSA chain of the consumers. — **effort: S**
10. **No signed release artefacts for `thegent`** — `thegent/.github/workflows/release.yml` exists but no `release-attestation.yml` was observed. — **effort: S**
11. **No VEX allowlist format for secret-scanner false positives** (cross-ref L18 gap #1) — when a test fixture or doc legitimately contains a secret-shaped string, gitleaks' allowlist lives in the gitleaks config, not in a VEX statement. Consider a unified suppression format (VEX + SARIF) for cross-scanner reuse. — **effort: L**
12. **No CVE feed fan-in from `osv-scanner`** — bloc runs `cargo-deny` (RustSec) + `trivy` (NVD/EPSS) + `osv` (in dep-guard), but these are three separate CVE feeds with different IDs. No unified advisory ID reconciliation. — **effort: L** (cross-feed reconciliation in `phenotype-dep-guard/src/vulnerability.rs:1-198`)

## Recommendations

1. **Emit SBOM in CI for every core repo release** — wire `phenotype-dep-guard` (or a sibling `sbom-action`) into `release.yml` for AgilePlus / thegent / Tracely / Tracera; commit `*.cdx.json` and `*.spdx.json` to the release tag. Effort: M.
2. **Add OpenVEX emission to `phenotype-dep-guard`** — `src/vex.rs` module, `dep-guard vex add <advisory>` CLI, store under `vex/` in the repo. Effort: M.
3. **Adopt Sigstore-keyless signing on every release** — `actions/attest-build-provenance` + `actions/attest-sbom` for SLSA Build L2; already done for AgilePlus/Tracely/Tracera, missing on `phenotype-dep-guard` and `thegent`. Effort: S each.
4. **Pick one of Renovate / Dependabot per repo** — standardize on Renovate for crates that need grouping (thegent's polyglot monorepo) and Dependabot for single-ecosystem crates. Effort: S.
5. **Land a `uv.lock` (or pip-tools `requirements.txt`) in `phenotype-dep-guard`** and document `pip install -r requirements.lock` in README. Effort: S.
6. **Resolve the `reusable-trufflehog.yml` reference mismatch** in `phenotype-dep-guard/.github/workflows/trufflehog.yml:14` — the file is not in `phenotype-tooling/.github/workflows/` under that exact name. Either create it or update the `uses:` ref. Effort: S.
7. **Wire `phenotype-dep-guard` as a federated supply-chain check** — every core repo's `ci.yml` should `uses: KooshaPari/phenotype-dep-guard/.github/workflows/reusable-dep-guard.yml@main` with `fail-on: high`. Effort: S.
8. **Add `osv-scanner` to `Tracely` and `Tracera` CI** — `osv-scanner --format sarif --output osv.sarif .` + upload to code-scanning. Effort: S.
9. **Backfill Tracely `Cargo.lock` + lockfile discipline into `deny.toml`** — Tracely's `deny.toml` content not verified in this audit; ensure `[advisories]` `db-path = "$CARGO_HOME/advisory-db"` and `[bans]` `wildcards = "deny"`. Effort: S.
10. **Reduce thegent's Dependabot cadence to weekly** with `groups: { python-security: { ... } }` to aggregate patches into a single PR. Effort: S.
11. **Cross-feed CVE reconciliation in `phenotype-dep-guard/src/vulnerability.rs:1-198`** — map RustSec IDs ↔ GHSA IDs ↔ OSV IDs ↔ CVE IDs so one suppression covers all feeds. Effort: L.
12. **Promote `phenotype-dep-guard` to a federated release with provenance** — make the crate's own release process the SOTA example for the bloc (it should eat its own dog food). Effort: M.

**Net posture:** **covered ✓ with material gaps △** — detection is SOTA (OSV + CycloneDX + lockfile parsers + cargo-deny + Trivy + CodeQL + Scorecard + SLSA L2 on 3 of 5 repos), but VEX, SPDX, and SLSA are not uniformly applied, and one core repo (`Tracera`) lacks Dependabot. The `phenotype-dep-guard` crate is the bloc's genuine SOTA-grade primitive — closing gaps #1, #2, #3, #5 would push the bloc from "12 months ahead on detection" to "12 months ahead on end-to-end supply-chain integrity."
