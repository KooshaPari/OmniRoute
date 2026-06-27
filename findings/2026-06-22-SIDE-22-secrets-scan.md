# SIDE-22 — PII / Secrets Scan (pheno-* crates)

**Date:** 2026-06-22 (scan executed on `docs/v20-l1-adr-index-2026-06-22` @ `9cf52be5c4`)
**Scope:** 17 `pheno-*` crates visible in the current sparse-checkout cone (228 files, ~835 KB)
**Method:** `ripgrep 15.1.0`, 6 patterns, content-based + line-number output, manual classification
**Status:** **CLEAN — 0 true positives, 22 false positives**

---

## TL;DR

All 22 matches across 6 patterns are **false positives** (test fixtures, doc-comment method
names, `pyproject.toml` author metadata, and template placeholders). No literal API key,
password, AWS access key, SSN, or PII email was found. Gate 2 (zero secret leaks) for the
`pheno-*` substrate family remains **PASS** and is consistent with the T21 / T21.1 audit
findings (2026-06-18, 2026-06-20).

| Metric | Value |
|---|---|
| Crates scanned | 17 |
| Files scanned | 228 |
| Bytes scanned | ~835 KB |
| Total matches | 22 |
| True positives | **0** |
| False positives | 22 |
| AWS key hits | 0 |
| SSN hits | 0 |
| Highest-risk match | `pheno-config/src/secrets.rs:215` — test fixture `"sk-live-abc123"` |

---

## Patterns searched

| # | Pattern | Regex | Severity | Notes |
|---|---|---|---|---|
| 1 | AWS access key | `AKIA[0-9A-Z]{16}` | HIGH | exact 20-char format |
| 2 | Email (RFC-ish) | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` | PII | catches `user@host.tld` |
| 3 | US SSN | `\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b` | HIGH PII | exact format |
| 4 | Generic `password` | `(?i)password\s*[=:]` | HIGH | matches `password = …`, `password: …` |
| 5 | Generic `secret` | `(?i)secret\s*[=:]` | HIGH | matches `secret = …`, `secret: …` |
| 6 | Generic `apiKey` | `(?i)api[_-]?key\s*[=:]` | HIGH | matches `apiKey`, `api_key`, `apikey` |

---

## Per-crate count

Counts are **line-based** (sum of `rg -c` per pattern). One line can have multiple
matches in the case of `pheno-port-adapter/SECURITY.md:18` (2 occurrences of
`koosha@phenotype.local` on the same line — mailto link + plain text).

| Crate | Files | Bytes | Email | SSN | AWS | Pwd | Sec | Key | **Total** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `pheno-config` | 11 | 32,090 | 0 | 0 | 0 | 3 | 1 | 5 | **9** |
| `pheno-context` | 3 | 11,629 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `pheno-drift-detector` | 2 | 26,373 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `pheno-errors` | 11 | 37,195 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `pheno-flags` | 4 | 10,864 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `pheno-framework-lint` | 3 | 31,898 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `pheno-llms-txt` | 19 | 25,306 | 1 | 0 | 0 | 0 | 0 | 0 | **1** |
| `pheno-mcp-router` | 6 | 19,158 | 0 | 0 | 0 | 0 | 1 | 0 | **1** |
| `pheno-otel` | 27 | 156,205 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `pheno-port-adapter` | 38 | 145,702 | 1¹ | 0 | 0 | 0 | 0 | 0 | **1** |
| `pheno-predict` | 2 | 25,530 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `pheno-scaffold-kit` | 20 | 27,335 | 8 | 0 | 0 | 0 | 0 | 0 | **8** |
| `pheno-secret-scan` | 4 | 14,915 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `pheno-ssot-template` | 14 | 55,442 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `pheno-tracing` | 25 | 113,430 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| `pheno-vibecoding-guard` | 19 | 27,738 | 1 | 0 | 0 | 0 | 0 | 0 | **1** |
| `pheno-worklog-schema` | 20 | 31,210 | 1 | 0 | 0 | 0 | 0 | 0 | **1** |
| **TOTAL (17 crates)** | **228** | **~835 KB** | **12** | **0** | **0** | **3** | **2** | **5** | **22** |

¹ `pheno-port-adapter/SECURITY.md:18` contains 2 occurrences of `koosha@phenotype.local` on a single line
(plain text + markdown mailto link), counted as 1 line / 2 matches.

---

## 10 worst locations (file:line, ranked)

Ranked by **pattern severity** (literal `password = X` / `apiKey = X` in code > doc-comment
method names > placeholder emails > template docs). The first 6 entries are the only ones
that *look like* a hardcoded secret in actual code — and all 6 are confirmed test fixtures
using textbook example values.

| # | Location | Pattern | Match text | Verdict |
|---|---|---|---|---|
| 1 | `pheno-config/src/secrets.rs:215` | apiKey | `let mut key = ApiKey::new("sk-live-abc123");` | **FP** — unit test for `ZeroizeOnDrop` (`test_drop_zeros_memory`); example value |
| 2 | `pheno-config/src/secrets.rs:175` | password | `let pw = DbPassword::new("hunter2");` | **FP** — unit test for `expose()` (`test_expose_returns_inner_string`); classic xkcd #538 "correct horse battery staple" reference value |
| 3 | `pheno-config/src/secrets.rs:195` | password | `let pw = DbPassword::new("hunter2");` | **FP** — unit test for `Debug` redaction (`test_debug_redacts_secret`); same `hunter2` fixture |
| 4 | `pheno-config/src/secrets.rs:163` | apiKey | `let _ = ApiKey::new("");` | **FP** — unit test for empty-input panic (`test_new_rejects_empty`); empty string by design |
| 5 | `pheno-config/src/secrets.rs:169` | apiKey | `let key = ApiKey::new(raw);` | **FP** — continuation of #2; `raw` is bound on line 168 to `"sk-live-abc123"` |
| 6 | `pheno-config/src/secrets.rs:182` | apiKey | `let key = ApiKey::new(raw);` | **FP** — continuation of #3; `raw` is bound on line 181 to `"sk-live-abc123"` |
| 7 | `pheno-port-adapter/SECURITY.md:18` | email (×2) | `koosha@phenotype.local` | **FP** — SECURITY.md org contact (RFC 6762 `.local` TLD = non-routable placeholder) |
| 8 | `pheno-config/src/secrets.rs:26-27` | apiKey + password | doc comment: `ApiKey::expose` / `DbPassword::expose` | **FP** — module-level `//!` doc comment explaining the newtype API; method names only |
| 9 | `pheno-config/docs/architecture/pheno-config.md:99` | secret | `` `secret://…` reference in TOML is resolved at `find_value` time `` | **FP** — architecture doc explaining the `secret://` URI scheme (placeholder for Vault/secret-store indirection) |
| 10 | `pheno-mcp-router/docs/architecture/pheno-mcp-router.md:114` | secret | `` `secret://…` references from prompts before they `` | **FP** — architecture doc explaining the `secret://` URI scheme (same scheme, sibling crate) |

### Honorable mentions (ranked below 10 — all FP)

These are the email matches that round out the count but are less concerning because they
contain only template placeholders, `pyproject.toml` author metadata, or test fixtures:

| Location | Pattern | Match text | Verdict |
|---|---|---|---|
| `pheno-scaffold-kit/tests/test_integration.py:23` | email | `test@example.com` | **FP** — pytest fixture |
| `pheno-scaffold-kit/tests/test_integration.py:54` | email | `test@example.com` | **FP** — pytest fixture |
| `pheno-scaffold-kit/tests/test_render.py:21` | email | `test@example.com` | **FP** — pytest fixture |
| `pheno-scaffold-kit/tests/test_render.py:31` | email | `test@example.com` | **FP** — assertion in pytest fixture |
| `pheno-scaffold-kit/SPEC.md:38` | email | `me@example.com` | **FP** — spec example |
| `pheno-scaffold-kit/README.md:35` | email | `me@example.com` | **FP** — README quickstart example |
| `pheno-scaffold-kit/examples/quickstart.py:10` | email | `me@example.com` | **FP** — example code |
| `pheno-scaffold-kit/pyproject.toml:13` | email | `koosha@phenotype.local` | **FP** — PEP 621 `authors` field (`.local` TLD) |
| `pheno-llms-txt/pyproject.toml:13` | email | `koosha@phenotype.local` | **FP** — PEP 621 `authors` field |
| `pheno-vibecoding-guard/pyproject.toml:13` | email | `koosha@phenotype.local` | **FP** — PEP 621 `authors` field |
| `pheno-worklog-schema/pyproject.toml:13` | email | `koosha@phenotype.local` | **FP** — PEP 621 `authors` field |

---

## Classification methodology

Each match was classified by reading the surrounding context (`rg -B 2 -A 2`) and answering:

1. **Is the value used as an actual credential?** No — all `"hunter2"` and `"sk-live-abc123"`
   values are inputs to the `pheno-config` `secrets::ApiKey` / `secrets::DbPassword`
   newtypes, which are designed to hold real secrets. The values themselves are textbook
   example strings (`hunter2` is a 1990s-era reference; `sk-live-abc123` follows the Stripe
   key shape but is obviously truncated).
2. **Is the value reachable from a runtime path that touches a real secret store?** No —
   the values are only used in `#[test]` functions (the file has `#[cfg(test)]` gating on
   the impl block; the test module is `mod tests { ... }` at the bottom of `secrets.rs`).
3. **Could the value be confused with a real secret by a downstream scanner?** Yes — and
   this is the only concern. A scanner that does not understand `#[test]` gating will
   flag these. The standard mitigation (`.trufflehog-allowlist.txt` allowlisting the test
   block) is already in place at `pheno-secret-scan/.trufflehog-allowlist.txt` (per
   `pheno-secret-scan/README.md` §3).
4. **Is the email a real person's address?** No — `koosha@phenotype.local` uses the
   RFC 6762 `.local` mDNS TLD (non-routable, single-LAN-only). `me@example.com` and
   `test@example.com` are reserved by RFC 2606 §2 as example domains.

---

## Why `pheno-secret-scan` itself has 0 matches

`pheno-secret-scan` is the canonical TruffleHog-based scanner (per ADR-??? / L52 secret
substrate). It is the **scanner**, not the **scanned** — its own pattern definitions live
in TruffleHog's vendored rulesets and its `deny.toml` contains a `secret-detection`
allowlist, not literal secrets. The `0` count confirms there is no in-tree rule definition
for any of the 6 patterns that could leak via the scanner's own code.

---

## Cross-references

- `findings/2026-06-18-T21-security-audit-14-repos.md` — original T21 security audit
- `findings/2026-06-19-T21-1-secret-scan-rescan.md` — T21.1 rescan (14 repos, also clean)
- `findings/2026-06-20-cargo-audit.md` — companion dependency audit
- `pheno-secret-scan/README.md` — secret-scan substrate documentation
- `pheno-secret-scan/.trufflehog-allowlist.txt` — current allowlist (covers the test
  fixtures in `pheno-config/src/secrets.rs`)
- `pheno-config/src/secrets.rs` — `ApiKey`, `BearerToken`, `DbPassword` newtypes
  (ADR-078 / L52 mandate)
- ADR-042 — Security audit cadence (monthly)
- ADR-078 — Encryption-at-rest mandate (L52)
- ADR-080 — Pen-test + bug-bounty roadmap (L53)

---

## Recommendations

1. **No remediation required.** All 22 matches are accounted for as false positives.
2. **Keep the test fixtures.** Replacing `"hunter2"` / `"sk-live-abc123"` with
   syntactically-valid-but-clearly-fake values (e.g. `"<TEST-NOT-A-REAL-KEY>"`) would
   reduce scanner false-positive load but would also reduce test clarity. Current values
   are the canonical Rust community example strings. **Recommendation: leave as-is.**
3. **Consider `.trufflehog-allowlist.txt` extension** to formally allowlist the `#[test]`
   block in `pheno-config/src/secrets.rs` if future CI runs add stricter scanner rules
   (e.g. `gitleaks` with `allowlist` regexes). Verify the allowlist is already referenced
   by the `pheno-secret-scan` GitHub Actions workflow before adding entries.
4. **Add `pheno-port-adapter/SECURITY.md:18` to the allowlist** as a single-line entry
   (`SECURITY\.md:koosha@phenotype\.local`) — it currently generates 2 false-positive
   matches per scan.
5. **Cadence.** Per ADR-042 (security audit cadence), the full secret scan + dependency
   audit + supply-chain check runs **monthly**. Next sweep: 2026-07-20. This SIDE-22
   scan is a **focused single-pattern re-check** of the 17 `pheno-*` crates only and does
   not replace the monthly sweep.

---

## Reproduce this scan

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos

CRATES="pheno-config pheno-context pheno-drift-detector pheno-errors \
        pheno-flags pheno-framework-lint pheno-llms-txt pheno-mcp-router \
        pheno-otel pheno-port-adapter pheno-predict pheno-scaffold-kit \
        pheno-secret-scan pheno-ssot-template pheno-tracing \
        pheno-vibecoding-guard pheno-worklog-schema"

for c in $CRATES; do
  printf '%-25s ' "$c"
  E=$(rg -c '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' "$c" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')
  S=$(rg -c '\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b' "$c" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')
  A=$(rg -c 'AKIA[0-9A-Z]{16}' "$c" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')
  P=$(rg -c -i 'password\s*[=:]' "$c" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')
  SC=$(rg -c -i 'secret\s*[=:]' "$c" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')
  K=$(rg -c -i 'api[_-]?key\s*[=:]' "$c" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')
  echo "E=$E SSN=$S AWS=$A Pwd=$P Sec=$SC Key=$K  total=$((E+S+A+P+SC+K))"
done
```

Tool: `ripgrep 15.1.0` (features: `+pcre2`, simd NEON).
Branch: `docs/v20-l1-adr-index-2026-06-22` @ `9cf52be5c483204bcb821d9087531fe2824c77c1`.

---

## Related

- ADR-024 — 71-pillar audit framework
- ADR-042 — Security audit cadence
- ADR-046 — Federation mTLS + OIDC
- ADR-077 — L50 Vault migration roadmap
- ADR-078 — L52 Encryption-at-rest mandate
- ADR-079 — L54 OIDC federation reference
- ADR-080 — L53 Pen-test + bug-bounty roadmap
- `trufflehog.yml` — monorepo-level scan config
- `pheno-secret-scan/Justfile` — local `just scan` runner
