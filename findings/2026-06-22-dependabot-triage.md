# Dependabot triage — `KooshaPari/phenotype-apps` (default branch)

**Date:** 2026-06-21 PDT
**Repo:** `KooshaPari/phenotype-apps` (default branch)
**Source:** `gh api repos/KooshaPari/phenotype-apps/dependabot/alerts` (paginated)
**Cadence:** Per ADR-042 monthly security audit (2026-06-21 is in-window for the June 2026 sweep)
**Device:** `macbook` (read-only audit, no auto-merge, no code changes)

## Summary

| Severity | Count | With fix | No fix |
|----------|------:|---------:|-------:|
| CRITICAL | 0 | 0 | 0 |
| **HIGH** | **6** | **5** | **1** |
| MODERATE | 4 | 4 | 0 |
| LOW | 0 | 0 | 0 |
| **TOTAL** | **10** | **9** | **1** |

- **No `dependabot/*` branches exist** (`gh api .../branches | jq 'startswith("dependabot/")'` → empty).
- **No `dependabot/*` PRs exist** (`gh api .../pulls | jq 'startswith("dependabot/")'` → empty).
- Dependabot has not opened any remediation PRs for these alerts; all remediation must be filed manually.

## Grouping by package (effective work = 3 manifest edits)

| Package | # Alerts | Manifest | Single fix closes | Fix version |
|---------|---------:|----------|-------------------|-------------|
| `gix` (gitoxide) | 5 | `phenotype-ops/tools/phenotype-manifest/Cargo.toml` | all 5 (4 HIGH + 1 MOD) | `0.83.0` |
| `vite` | 3 | `Parpoura-5th/package-lock.json` | all 3 (1 HIGH + 2 MOD) | `6.4.3` |
| `js-yaml` | 1 | `unified-review/package-lock.json` | 1 (1 MOD) | `4.2.0` |
| `ecdsa` (python-ecdsa) | 1 | `Parpoura-5th/uv.lock` | **no upstream fix** | — |

A single bump in each of the 3 manifests closes 9 of 10 alerts.

---

## HIGH severity (6 alerts)

| # | Sev | Package | CVE / GHSA | CVSS | Fix | Manifest | Disposition |
|---|-----|---------|-----------|-----:|-----|----------|-------------|
| 28 | HIGH | `gix` | GHSA-fr8x-3vfx-f45h | — | `0.83.0` | `phenotype-ops/tools/phenotype-manifest/Cargo.toml` | **auto-bump** (covered by `gix 0.83.0`) |
| 27 | HIGH | `gix` | GHSA-pg4w-g64p-qwhj | — | `0.83.0` | `phenotype-ops/tools/phenotype-manifest/Cargo.toml` | **auto-bump** (covered by `gix 0.83.0`) |
| 26 | HIGH | `gix` | GHSA-f26g-jm89-4g65 | **7.8** | `0.83.0` | `phenotype-ops/tools/phenotype-manifest/Cargo.toml` | **auto-bump** (covered by `gix 0.83.0`) — RCE via `.gitmodules` |
| 25 | HIGH | `gix` | GHSA-p3hw-mv63-rf9w | — | `0.83.0` | `phenotype-ops/tools/phenotype-manifest/Cargo.toml` | **auto-bump** (covered by `gix 0.83.0`) — credential disclosure |
| 3  | HIGH | `vite` | GHSA-fx2h-pf6j-xcff (CVE-2026-53571) | — | `6.4.3` | `Parpoura-5th/package-lock.json` | **auto-bump** (covered by `vite 6.4.3`) — `server.fs.deny` bypass on Windows |
| 5  | HIGH | `ecdsa` | GHSA-wj6h-64fc-37mp (**CVE-2024-23342**) | **7.4** | **none** | `Parpoura-5th/uv.lock` | **NO FIX — accept risk + track** |

### Per-alert detail (HIGH)

### Alert #28 — `gix < 0.83.0` (HIGH)
- **GHSA:** [GHSA-fr8x-3vfx-f45h](https://github.com/advisories/GHSA-fr8x-3vfx-f45h)
- **Title:** "gix and gitoxide: unvalidated submodule name traverses out of `.git/modules` and redirects `state()` / `open()` to another repository"
- **Vulnerable range:** `< 0.83.0`
- **Fix:** `0.83.0`
- **Manifest:** `phenotype-ops/tools/phenotype-manifest/Cargo.toml`
- **Disposition:** **auto-bump** — single `gix = "0.83.0"` line bump closes this and alerts #27, #26, #25.

### Alert #27 — `gix < 0.83.0` (HIGH)
- **GHSA:** [GHSA-pg4w-g64p-qwhj](https://github.com/advisories/GHSA-pg4w-g64p-qwhj)
- **Title:** "gix and gitoxide's symlinked `.gitmodules` are followed and parsed from outside of the repository"
- **Vulnerable range:** `< 0.83.0`
- **Fix:** `0.83.0`
- **Manifest:** `phenotype-ops/tools/phenotype-manifest/Cargo.toml`
- **Disposition:** **auto-bump** — covered by single `gix 0.83.0` bump.

### Alert #26 — `gix ≥ 0.31.0, < 0.83.0` (HIGH, CVSS 7.8)
- **GHSA:** [GHSA-f26g-jm89-4g65](https://github.com/advisories/GHSA-f26g-jm89-4g65)
- **Title:** "gitoxide: `CommandForbiddenInModulesConfiguration` bypass in `gix_submodule::File::update()` enables arbitrary command execution via `.gitmodules`"
- **Vulnerable range:** `>= 0.31.0, < 0.83.0`
- **Fix:** `0.83.0`
- **Manifest:** `phenotype-ops/tools/phenotype-manifest/Cargo.toml`
- **Disposition:** **auto-bump** — RCE class, highest CVSS of the 6 HIGH alerts; covered by single `gix 0.83.0` bump.

### Alert #25 — `gix < 0.83.0` (HIGH)
- **GHSA:** [GHSA-p3hw-mv63-rf9w](https://github.com/advisories/GHSA-p3hw-mv63-rf9w)
- **Title:** "gix's submodule name validation bypass + trust inheritance flaw enables path traversal and credential disclosure"
- **Vulnerable range:** `< 0.83.0`
- **Fix:** `0.83.0`
- **Manifest:** `phenotype-ops/tools/phenotype-manifest/Cargo.toml`
- **Disposition:** **auto-bump** — credential disclosure class; covered by single `gix 0.83.0` bump.

### Alert #3 — `vite ≤ 6.4.2` (HIGH)
- **GHSA:** [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)
- **CVE:** CVE-2026-53571
- **Title:** "vite: `server.fs.deny` bypass on Windows alternate paths"
- **Vulnerable range:** `<= 6.4.2`
- **Fix:** `6.4.3`
- **Manifest:** `Parpoura-5th/package-lock.json`
- **Disposition:** **auto-bump** — covered by single `vite 6.4.3` bump in `package-lock.json` (npm lockfile regeneration; closes #4 and #1 as well).

### Alert #5 — `ecdsa ≥ 0` (HIGH, CVSS 7.4) — **NO FIX AVAILABLE**
- **GHSA:** [GHSA-wj6h-64fc-37mp](https://github.com/advisories/GHSA-wj6h-64fc-37mp)
- **CVE:** CVE-2024-23342 (Minerva timing attack on P-256 in `python-ecdsa`)
- **Vulnerable range:** `>= 0`
- **Fix:** `null` (no upstream patched version)
- **Manifest:** `Parpoura-5th/uv.lock`
- **Disposition:** **no-fix / accept-risk / track** — python-ecdsa maintainers have not released a fix; the underlying vulnerability is in the P-256 implementation. Options:
  1. Wait for upstream `python-ecdsa` fix (no ETA).
  2. Pin away from `ecdsa` to a maintained alternative (e.g., `cryptography`, `pynacl`) — this is a code change in `Parpoura-5th`, not a dep bump; out of scope for dependabot triage.
  3. Accept risk with documented justification (timing attack on P-256 ECDSA is local/network-adjacent, requires many signatures; impact depends on use of ecdsa in Parpoura-5th).
- **TODO (filed below):** open tracking issue for #5 in `KooshaPari/phenotype-apps` documenting the no-fix state and recommending either upstream-pinning or migration to `cryptography`.

---

## MODERATE severity (4 alerts)

| # | Sev | Package | CVE / GHSA | CVSS | Fix | Manifest | Disposition |
|---|-----|---------|-----------|-----:|-----|----------|-------------|
| 57 | MOD | `js-yaml` | GHSA-h67p-54hq-rp68 (CVE-2026-53550) | **5.3** | `4.2.0` | `unified-review/package-lock.json` | **auto-bump** (single file) |
| 23 | MOD | `gix` | GHSA-2frx-2596-x5r6 (CVE-2025-31130) | **6.8** | `0.71.0` | `phenotype-ops/tools/phenotype-manifest/Cargo.toml` | **auto-bump** (subsumed by `gix 0.83.0`) |
| 4  | MOD | `vite` | GHSA-v6wh-96g9-6wx3 (CVE-2026-53632) | — | `6.4.3` | `Parpoura-5th/package-lock.json` | **auto-bump** (covered by `vite 6.4.3`) |
| 1  | MOD | `vite` | GHSA-4w7w-66w2-5vf9 (CVE-2026-39365) | — | `6.4.2` | `Parpoura-5th/package-lock.json` | **auto-bump** (covered by `vite 6.4.3`) |

### Per-alert detail (MODERATE)

### Alert #57 — `js-yaml ≤ 4.1.1` (MOD, CVSS 5.3)
- **GHSA:** [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68)
- **CVE:** CVE-2026-53550
- **Title:** "JS-YAML: Quadratic-complexity DoS in merge key handling via repeated aliases"
- **Vulnerable range:** `<= 4.1.1`
- **Fix:** `4.2.0`
- **Manifest:** `unified-review/package-lock.json`
- **Disposition:** **auto-bump** — standalone npm lockfile regeneration. DoS class; only attacker-controlled YAML files are affected.

### Alert #23 — `gix < 0.71.0` (MOD, CVSS 6.8)
- **GHSA:** [GHSA-2frx-2596-x5r6](https://github.com/advisories/GHSA-2frx-2596-x5r6)
- **CVE:** CVE-2025-31130
- **Title:** "gitoxide does not detect SHA-1 collision attacks"
- **Vulnerable range:** `< 0.71.0`
- **Fix:** `0.71.0`
- **Manifest:** `phenotype-ops/tools/phenotype-manifest/Cargo.toml`
- **Disposition:** **auto-bump** — subsumed by the `gix 0.83.0` bump that also closes the 4 HIGH alerts above. SHA-1 collision detection is defense-in-depth, not exploitable in typical phenotype-manifest use.

### Alert #4 — `vite ≤ 6.4.2` (MOD)
- **GHSA:** [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3)
- **CVE:** CVE-2026-53632
- **Title:** "launch-editor: NTLMv2 hash disclosure via UNC path handling on Windows"
- **Vulnerable range:** `<= 6.4.2`
- **Fix:** `6.4.3`
- **Manifest:** `Parpoura-5th/package-lock.json`
- **Disposition:** **auto-bump** — covered by `vite 6.4.3` bump (Windows-only NTLMv2 hash leak; macbook/Linux CI unaffected).

### Alert #1 — `vite ≤ 6.4.1` (MOD)
- **GHSA:** [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9)
- **CVE:** CVE-2026-39365
- **Title:** "Vite vulnerable to path traversal in optimized deps `.map` handling"
- **Vulnerable range:** `<= 6.4.1`
- **Fix:** `6.4.2`
- **Manifest:** `Parpoura-5th/package-lock.json`
- **Disposition:** **auto-bump** — covered by `vite 6.4.3` bump (transitively closes the lower 6.4.2 fix target).

---

## Recommendation

### Single remediation PR — "June 2026 dependabot sweep"

**3 manifest edits** to close **9 of 10** alerts:

1. **`phenotype-ops/tools/phenotype-manifest/Cargo.toml`** — bump `gix` to `0.83.0`
   - Closes: #28, #27, #26, #25 (all HIGH) + #23 (MOD) = **5 alerts**
   - Highest-value edit (closes 4 HIGH; CVSS 7.8 RCE class).

2. **`Parpoura-5th/package-lock.json`** — npm install to regenerate with `vite@6.4.3`
   - Closes: #3 (HIGH) + #4 (MOD) + #1 (MOD) = **3 alerts**
   - Standard `npm update vite` + `npm install` lockfile regeneration.

3. **`unified-review/package-lock.json`** — npm install to regenerate with `js-yaml@4.2.0`
   - Closes: #57 (MOD) = **1 alert**
   - Standard `npm update js-yaml` + `npm install` lockfile regeneration.

### Alert #5 (HIGH, no fix) — TODO

File a tracking issue on `KooshaPari/phenotype-apps` documenting:
- CVE-2024-23342 (Minerva timing attack on P-256 in `python-ecdsa`)
- No upstream patched version exists
- Three options: (a) wait for upstream fix, (b) migrate Parpoura-5th off `ecdsa` to `cryptography` or `pynacl`, (c) document acceptance with risk rationale
- Mark alert as `no-fix-available` per ADR-042 § "no-fix policy"

### Constraints honored

- ✅ No code pushed
- ✅ No dependabot PRs auto-merged (none exist; no auto-merge performed)
- ✅ `gh api` used for paginated calls (no manual scraping)
- ✅ AGENTS.md and WORKLOG.md unmodified
- ✅ `device: macbook` per ADR-015 v2.1 schema
- ✅ Read-only audit; remediation is a TODO for the next active development cycle

---

## Audit trail

```bash
# Open alerts (paginated)
gh api repos/KooshaPari/phenotype-apps/dependabot/alerts --paginate --jq '
  .[]
  | select(.state == "open")
  | {
      number,
      severity: .security_advisory.severity,
      cvss_score: .security_advisory.cvss.score,
      ghsa_id: .security_advisory.ghsa_id,
      cve_id: .security_advisory.cve_id,
      package: .dependency.package.name,
      manifest: .dependency.manifest_path,
      summary: .security_advisory.summary,
      vulnerable_version: .security_vulnerability.vulnerable_version_range,
      fixed_version: .security_vulnerability.first_patched_version.identifier
    }'

# Counts (verify 10 = 6 HIGH + 4 MODERATE)
gh api repos/KooshaPari/phenotype-apps/dependabot/alerts --paginate --jq '
  [ .[]
    | select(.state == "open")
    | .security_advisory.severity
  ] | group_by(.) | map({severity: .[0], count: length})'

# Branch check (empty result)
gh api repos/KooshaPari/phenotype-apps/branches --paginate --jq '
  .[] | select(.name | startswith("dependabot/")) | .name'

# PR check (empty result)
gh api repos/KooshaPari/phenotype-apps/pulls --paginate --jq '
  .[] | select(.head.ref | startswith("dependabot/")) | {number, state, head: .head.ref, title}'
```

## References

- **ADR-042** — Security audit cadence (monthly `cargo audit` + `pip-audit` + `govulncheck` sweep)
- **ADR-024** — 71-pillar audit framework, L46-L55 security domain (5 HIGH-security pillars this aligns to)
- **prior session note (v22/v23)** — subagent flagged "10 dependabot alerts: 6 HIGH, 4 MODERATE"; this triage confirms and adds per-alert disposition.
