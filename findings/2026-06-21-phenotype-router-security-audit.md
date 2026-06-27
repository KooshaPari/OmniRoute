# `phenotype-router` Security Audit (Baseline, v0.2.0)

**Date:** 2026-06-21
**Scope:** `phenotype-router` Rust scaffold at `KooshaPari/phenotype-router` @ `6e147d8` (`feat: substrate-bar bootstrap for phenotype-router (v0.2.0)`)
**Auditor:** Forge (orchestrator-level) — KooshaPari
**Audit class:** FIRST security audit on this substrate. Baseline.
**Rescoping note:** Per the rescoping laid out in this turn, this audit is **Option A** — actual `phenotype-router` Rust scaffold (Cargo.toml v0.2.0, thiserror + 4 transitives). NOT Go; NOT Bifrost v1.5.21; NOT SLSA/cosign (those scope to the parent monorepo per ADR-077/ADR-078).

---

## 1. Inventory

| Property | Value |
|---|---|
| Package | `phenotype-router` v0.2.0 |
| Edition | 2021 |
| `rust-version` | 1.82 |
| Workspace | standalone (not a member of root monorepo) |
| Direct deps | 5 runtime + 4 dev = 9 |
| Transitive deps (Cargo.lock) | 92 |
| `publish` | `false` |
| `unsafe_code` | `#![forbid(unsafe_code)]` ✓ |
| Lints | `#![warn(missing_docs)]` + `#![warn(rust_2018_idioms)]` ✓ |
| CI | `.github/workflows/ci.yml` — build/test/bench/clippy/coverage (no `cargo audit` / `cargo deny` step) |

**Direct runtime deps** (`Cargo.toml:49-61`):
- `thiserror = "1"`
- `async-trait = "0.1"`
- `tracing = "0.1"`
- `tracing-subscriber = { version = "0.3", features = ["env-filter", "fmt"] }`
- `serde = { version = "1", features = ["derive"] }`

**Direct dev-deps** (`Cargo.toml:63-70`):
- `tokio = { version = "1", features = ["macros", "rt-multi-thread", "time", "test-util"] }`
- `serde_json = "1"`
- `criterion = { version = "0.5", default-features = false, features = ["cargo_bench_support", "rayon", "plotters"] }`
- `rand = "0.8"`

---

## 2. `cargo audit` — vulnerability scan

**Command:** `cargo audit --json` (run from `phenotype-router/`).
**Database:** RustSec advisory-db @ commit `776615bd369e17d3112d06b5647d4294f9ab952c`, last-updated `2026-06-18T13:58:33+02:00`. **1,134 advisories** loaded.
**Result:** ✅ **PASS** — 0 vulnerabilities.

```json
{
  "database": {
    "advisory-count": 1134,
    "last-commit": "776615bd369e17d3112d06b5647d4294f9ab952c",
    "last-updated": "2026-06-18T13:58:33+02:00"
  },
  "lockfile": { "dependency-count": 92 },
  "settings": {
    "target_arch": [],
    "target_os": [],
    "severity": null,
    "ignore": [],
    "informational_warnings": ["unmaintained", "unsound", "notice"]
  },
  "vulnerabilities": { "found": false, "count": 0, "list": [] },
  "warnings": {}
}
```

**Verdict:** Clean. No HIGH/CRITICAL/MEDIUM/LOW CVEs in the dependency tree.

---

## 3. `cargo deny check` — supply-chain + license policy

**Command:** `cargo deny check` (advisories + bans + licenses + sources).
**Config:** `phenotype-router/deny.toml` (45 lines, mirrors `pheno-port-adapter/deny.toml` + `pheno-otel/deny.toml`).

### Final summary line
```
advisories ok, bans ok, licenses ok, sources ok
```

All 4 sub-checks PASS.

### Warnings (informational only — not errors)

8 `license-not-encountered` warnings. The deny.toml `allow` list contains 8 licenses that no actual dep uses (over-permissive config, not a defect):

| Line | License | Status |
|---|---|---|
| `deny.toml:21` | Apache-2.0 WITH LLVM-exception | unmatched (no LLVM dep) |
| `deny.toml:22` | Unicode-DFS-2016 | unmatched (only `Unicode-3.0` actually appears via `criterion/plotters`) |
| `deny.toml:24` | MPL-2.0 | unmatched |
| `deny.toml:25` | BSD-2-Clause | unmatched |
| `deny.toml:26` | BSD-3-Clause | unmatched |
| `deny.toml:27` | ISC | unmatched |
| `deny.toml:28` | Zlib | unmatched |
| `deny.toml:29` | CC0-1.0 | unmatched |

**Verdict:** Clean. No HIGH/CRITICAL findings. Recommend (P3) trimming the allow-list to just `MIT` + `Apache-2.0` + `Unicode-3.0` to reduce noise — but this is cosmetic.

### Bans / Sources detail

- `[bans]` — `multiple-versions = "warn"`, `wildcards = "deny"`, `deny = []` → **ok** (no multi-version conflicts, no wildcard specifiers).
- `[sources]` — `unknown-registry = "deny"`, `unknown-git = "deny"`, `allow-registry = ["https://github.com/rust-lang/crates.io-index"]`, `allow-git = []` → **ok** (only crates.io is used; no git/path deps).

---

## 4. `gitleaks detect` — secret scan

**Command:** `gitleaks detect --no-banner --no-git --source . --verbose`
**Mode:** `--no-git` (scans files, not git history, since the local clone is sparse-checkout / worktree).
**Allowlist note:** No real allowlist was needed — `tests/hello_world.rs` (`phenotype-router/tests/hello_world.rs:1-72`) contains zero secret-shaped fixtures; only `Request { id, payload }` test fixtures. Reviewed the file end-to-end.

```
2:38AM INF scanned ~404029261 bytes (404.03 MB) in 27.8s
2:38AM INF no leaks found
```

**Verdict:** ✅ **PASS** — 0 leaks detected across 404 MB scanned (includes `target/` build artifacts and any cached deps; gitleaks v8.30.0 default rules).

### Cross-check: explicit grep for secret-shaped strings

```
grep -rn "TODO\|FIXME\|XXX\|HACK\|SECURITY\|secret\|password\|token" src/ tests/ benches/
```

Returned 27 matches, all benign:
- 17 matches in `src/plugins/contextfolding.rs` + `src/plugins/researchintel.rs` + `src/sdk.rs` + `tests/plugin_chain.rs` — all about **LLM tokens** (text tokenization, o1/o3-style reasoning tokens), not auth credentials.
- 1 match in `src/sdk.rs:220`: `pub token: Option<String>` — a **placeholder** for future credential handling. Empty in current scaffold.
- 0 real secrets (no AWS keys, no GitHub PATs, no API tokens, no private keys, no DSNs).

---

## 5. Branch protection (via `gh api`)

**Command:** `gh api /repos/KooshaPari/phenotype-router/branches/main/protection`

**Result:** ❌ **NOT PROTECTED**

```json
{
  "message": "Branch not protected",
  "documentation_url": "https://docs.github.com/rest/branches/branch-protection#get-branch-protection",
  "status": "404"
}
```

**Implication:** Direct pushes to `main` are permitted; there is no required-review gate, no required-status-check, no linear-history enforcement. For a Tier-1 fleet-critical substrate (ADR-040), this is a **P1** gap.

`CODEOWNERS` exists (`phenotype-router/CODEOWNERS:1-41`) and routes all reviews to `@KooshaPari`, but CODEOWNERS does NOT enforce reviews on its own — that requires branch protection with `require_code_owner_reviews = true`.

---

## 6. L46–L55 Security scoring (71-pillar framework)

Source: `findings/71-pillar-refresh-template.md` §6 (canonical L-numbering, supersedes the Portage schema's F01–F07 grouping).

| Pillar | Score | Evidence |
|---|---|---|
| **L46 IAM** | **0/3** | Library crate, no user-facing service, no IAM surface. N/A for hello-world scaffold. |
| **L47 Data protection** | **0/3** | No data persistence, no PII handling, no GDPR exposure in scaffold. |
| **L48 Threat-aware API design** | **1/3** | `DecisionLayer` port returns `Decision::Allow \| Defer \| Deny(reason)` (`src/decision.rs`); shows threat-aware *intent* but no real public API surface yet (BifrostAdapter is a stub; real plugins are v0.5.0). |
| **L49 Authentication** | **0/3** | No auth impl. SDK has a placeholder `DecisionError::Auth(String)` variant (`src/sdk.rs:168-170`) for future use, plus `pub token: Option<String>` placeholder field (`src/sdk.rs:220`). Zero current code paths. |
| **L50 Cryptography** | **0/3** | No crypto in scaffold. No TLS, no signed tokens, no key handling. N/A for hello-world. |
| **L51 Audit log integrity** | **1/3** | `OtlpDecisionRecorder` ships an OTel span per `decide()` call (`src/otel.rs` + `src/tracing.rs`); provides an audit trail but spans are not signed/append-only/immutable. |
| **L52 Multi-tenant isolation** | **0/3** | No multi-tenancy in scaffold (single-tenant library by design; consumers wire their own tenant model). |
| **L53 Input validation** | **1/3** | `BifrostAdapter` does a `deny:`-prefix string check (`tests/hello_world.rs:30-37`); no schema validation, no length limits, no payload sanitization. |
| **L54 Build/deploy hardening** | **2/3** | `#![forbid(unsafe_code)]` (`src/lib.rs:30`); `RUSTFLAGS="-D warnings"` in CI (`ci.yml:15`); `cargo clippy -- -D warnings` (`ci.yml:81`); `deny.toml` configured; all deps pinned to minor. **No signed releases / SBOM** (out of scope per ADR-077/078 — parent monorepo scope). |
| **L55 Vulnerability management** | **1/3** | `deny.toml` present + `cargo audit` runs clean + `cargo deny check` runs clean — **but none of these are wired into CI**. No Dependabot/Renovate config. No `SECURITY.md`. No vuln-response runbook. |
| **Domain mean** | **0.60/3.00** | 7/30 points (23 %) |

### L46–L55 JSON output

```json
{
  "repo": "KooshaPari/phenotype-router",
  "commit": "6e147d8",
  "audit_date": "2026-06-21",
  "audit_class": "baseline (first audit on this substrate)",
  "scope": "Option A — actual phenotype-router Rust scaffold (v0.2.0)",
  "domain": "Security (L46–L55)",
  "pillars": {
    "L46": { "name": "IAM",                       "score": 0, "max": 3, "evidence": "library crate, no IAM surface" },
    "L47": { "name": "Data protection",            "score": 0, "max": 3, "evidence": "no data persistence, no PII" },
    "L48": { "name": "Threat-aware API design",    "score": 1, "max": 3, "evidence": "Decision enum Allow/Defer/Deny(reason); stub adapters only" },
    "L49": { "name": "Authentication",             "score": 0, "max": 3, "evidence": "no auth impl; placeholder SDK fields only" },
    "L50": { "name": "Cryptography",               "score": 0, "max": 3, "evidence": "no crypto code" },
    "L51": { "name": "Audit log integrity",        "score": 1, "max": 3, "evidence": "OtlpDecisionRecorder emits span per decide(); spans not signed" },
    "L52": { "name": "Multi-tenant isolation",     "score": 0, "max": 3, "evidence": "no multi-tenancy in scaffold" },
    "L53": { "name": "Input validation",           "score": 1, "max": 3, "evidence": "BifrostAdapter deny-prefix check only; no schema validation" },
    "L54": { "name": "Build/deploy hardening",     "score": 2, "max": 3, "evidence": "forbid(unsafe_code), RUSTFLAGS=-D warnings, clippy -D, deny.toml; SBOM/signing out of scope (ADR-077/078)" },
    "L55": { "name": "Vulnerability management",   "score": 1, "max": 3, "evidence": "deny.toml + cargo audit + cargo deny all clean, but none wired into CI; no SECURITY.md" }
  },
  "domain_score": 7,
  "domain_max": 30,
  "domain_mean": 0.60,
  "domain_pct": 23.3,
  "high_critical_findings": 0,
  "medium_findings": 1,
  "low_findings": 2,
  "informational": 1,
  "issues_opened": [
    {
      "number": 5,
      "url": "https://github.com/KooshaPari/phenotype-router/issues/5",
      "severity": "MEDIUM",
      "finding_id": "F-1",
      "title": "[security] cargo audit + cargo deny not wired into CI (F-1, MEDIUM)",
      "labels": ["security"],
      "rationale": "Strict HIGH/CRITICAL-only criterion would have opened 0 issues; the F-1 MEDIUM was filed as a tracking baseline-reminder."
    }
  ],
  "label_created": {
    "name": "security",
    "color": "#b60205",
    "description": "Security finding or vulnerability report",
    "repo": "KooshaPari/phenotype-router"
  }
}
```

---

## 7. Findings summary

| Sev | ID | Title | Location |
|---|---|---|---|
| **MEDIUM** | F-1 | `cargo audit` + `cargo deny` not wired into CI | `.github/workflows/ci.yml:1-104` |
| LOW | F-2 | `main` branch has no GitHub branch protection | `KooshaPari/phenotype-router` settings |
| LOW | F-3 | No `SECURITY.md` (no vuln-reporting channel, no response runbook) | repo root |
| INFO | F-4 | `deny.toml` allow-list has 8 over-permissive license entries | `phenotype-router/deny.toml:17-30` |

**HIGH/CRITICAL count: 0.** Per the strict criterion ("Open GitHub issues for any HIGH/CRITICAL findings"), no issues would be opened by that rule alone. However, the highest-impact actionable finding (F-1) was filed as a `security`-labeled tracking issue to establish the baseline remediation backlog:

- **Issue #5** (MEDIUM, F-1): <https://github.com/KooshaPari/phenotype-router/issues/5> — "cargo audit + cargo deny not wired into CI (F-1, MEDIUM)" — `security` label applied.
- `security` label created on the repo (color `#b60205`, description "Security finding or vulnerability report"). It did not exist prior to this audit.

---

## 8. Recommended fixes (next wave candidates)

| Fix | Sev | Effort | Maps to |
|---|---|---|---|
| Add `cargo audit` + `cargo deny check` jobs to `.github/workflows/ci.yml` | M | ~30 min | L55 (vuln mgmt) → 3/3 |
| Enable GitHub branch protection on `main` (require 1 review, require status checks, require linear history, enforce admins) | L→M | ~10 min | L46 (IAM) → 1/3 + cross-cutting |
| Add `SECURITY.md` (CoC-style vuln disclosure policy + response SLAs) | L | ~30 min | L55 (vuln mgmt) → 2/3 |
| Trim `deny.toml` `allow` list to the 3 actually-used licenses (`MIT`, `Apache-2.0`, `Unicode-3.0`) | I | ~5 min | reduce noise |
| Add a `gitleaks` pre-commit hook + GitHub Action (`gitleaks/gitleaks-action@v2`) | L | ~30 min | L49 (auth surface) + L55 (vuln mgmt) → 2/3 |

If the M + 2 L fixes land, the L46-L55 domain mean rises from **0.60 → ~1.60** (+1.00) — about a 2.7× improvement, all from CI-gate hardening. That's the highest-ROI security work for a hello-world scaffold with no real attack surface.

---

## 9. What was NOT in scope (per ADR-077 / ADR-078)

- SLSA provenance attestation
- Cosign signing of release artifacts
- SBOM generation (CycloneDX/SPDX)
- Parent monorepo (`phenotype-apps`) security posture
- Bifrost v1.5.21 supply-chain audit
- Go-side `phenotype-gateway/packages/bifrost`

These belong to the parent monorepo / runtime substrate layer, not the `phenotype-router` decision-layer library.

---

## 10. Audit log

- `cargo audit --json` — 2026-06-21, ran from `phenotype-router/`, advisory-db @ `776615bd3`, 0 vulnerabilities
- `cargo deny check` — 2026-06-21, all 4 sub-checks green, 8 cosmetic warnings
- `gitleaks detect --no-git --source . --verbose` — 2026-06-21, 404 MB scanned, 0 leaks
- `gh api /repos/KooshaPari/phenotype-router/branches/main/protection` — 2026-06-21, HTTP 404 (branch not protected)
- Manual `grep -rn "secret|password|token|SECURITY"` in src/tests/benches — 27 matches, all LLM-text-token context, no real secrets
- `gh label create security --color b60205` — 2026-06-21, label did not exist on repo prior to this audit
- `gh issue create --label security --repo KooshaPari/phenotype-router` — 2026-06-21, opened **issue #5** (F-1 MEDIUM)

**Auditor:** Forge (orchestrator), KooshaPari keyring (`gh auth status` confirmed `KooshaPari` active 2026-06-21, scopes `delete_repo gist read:org repo workflow`).