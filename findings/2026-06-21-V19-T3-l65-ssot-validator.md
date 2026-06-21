# V19-T3 — L65 SSOT-injection pre-commit validator (deliverable summary)

**Date:** 2026-06-21
**Status:** DONE (committed on `feat/v19-l65-ssot-validator-2026-06-21`, NOT PUSHED per L5-104-style local-first convention)
**Author:** orch-w1-a (v19 cycle 9 / P1 reduction wave)
**Pillar:** L65 (SSOT — single source of truth), scorecard 1.0 → 2.0 (Adequate)
**Companion to:** `scripts/validate-ssot.sh` (SSOT.md structure), `scripts/ssot_inject.sh` (CI shim)

---

## 1. What ships

| File | LOC | Role |
|------|----:|------|
| `scripts/ssot-validator.py` | 419 | stdlib-only Python 3 scanner; reads TOML rules, scans staged (or supplied) `.rs` files, emits human or JSON report |
| `scripts/ssot-rules.toml`  | 252 | default rule registry: 6 rules across 3 severity tiers (error / warning / info) |
| `.pre-commit-config.yaml`  | +11 | new `ssot-validator` hook (passes staged `.rs` files, `types: [rust]`, pre-commit stage) |

Total new content: **~680 LoC** (script + rules + YAML hook), all on a single commit.

---

## 2. Ruleset (default — `scripts/ssot-rules.toml`)

| ID                     | Severity | What it catches                                                                                              | Fix hint                                                            |
|------------------------|----------|--------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------|
| `hardcoded-url`        | error    | `https?://host.tld[/path]` literals in production code (not tests/mocks/fixtures)                            | Move URL to `pheno-config::Settings::api_base_url` (or env)         |
| `hardcoded-port`       | warning  | `:3000` / `:5432` / `:6379` / `:8080` / `:9090` / `:27017` / etc. in production code                        | Typed config field; default `0` to force explicit prod config      |
| `magic-number-duration`| warning  | Bare integer literals in `30, 45, 60, 90, 120, 180, 300, 600, 900, 1800, 3600, 7200` with `u*/i*/f*` suffix, closing paren, semicolon, or EOL | Named `const` (e.g. `RETRY_TIMEOUT_SECS: u64 = 30;`) or config     |
| `crate-name-literal`   | info     | `let crate_name = "pheno_foo";` style — duplicates `env!("CARGO_PKG_NAME")`                                  | Use `env!("CARGO_PKG_NAME")` (compile-time constant)                |
| `inline-env-var-name`  | info     | `env::var("FOO_BAR")` / `std::env::var("FOO_BAR")` with an inline UPPER_SNAKE_CASE name                       | `pub const ENV_FOO_BAR: &str = "FOO_BAR";` in config module         |
| `hardcoded-endpoint-path` | info  | `"/v1/..."` / `"/api/v2/..."` REST path literals                                                              | Generate a `routes::V1_USERS` const from OpenAPI SSOT               |

Severity policy:
- `error` — always blocks pre-commit (forces explicit override via `// ssot-allow: <id>` or `exempt_globs` PR).
- `warning` — blocks by default; `--strict-errors-only` flag downgrades to advisory.
- `info` — never blocks; reported in the human/JSON output for backlog grooming.

---

## 3. Sample violation caught

Synthetic input (`/tmp/ssot_test_sample.rs`, 47 lines, 6 deliberate violations + 1 inline exemption):

```rust
// Synthetic test file for ssot-validator — exercises every rule.
use std::env;

const RETRY_TIMEOUT_SECS: u64 = 30;  // exempt: top-level const

fn connect_api() {
    // Rule 1 (error): hardcoded URL
    let url = "https://api.example.com/v1/users";
    let _ = url;
}

fn listen() {
    // Rule 2 (warning): hardcoded port
    let bind = "127.0.0.1:8080";
    let _ = bind;
}

fn retry() {
    // Rule 3 (warning): magic number cast to u64
    let timeout: u64 = 30;
    let _ = timeout;
    // ssot-allow: magic-number-duration applied to the next line
    let timeout2: u64 = 60;  // ssot-allow: magic-number-duration
    let _ = timeout2;
}

fn name_lookup() {
    // Rule 4 (info): crate-name string literal duplicating CARGO_PKG_NAME
    let crate_name = "pheno_config";
    let _ = crate_name;
}

fn env_lookup() {
    // Rule 5 (info): inline env var name string
    let host = env::var("PHENO_DB_HOST").unwrap();
    let _ = host;
}

fn call_endpoint() {
    // Rule 6 (info): hardcoded REST endpoint path
    let path = "/v1/orders/{id}";
    let _ = path;
}
```

Validator output (truncated to first 3 rule groups; all 6 caught, inline `// ssot-allow: magic-number-duration` correctly suppresses the `60;` match):

```
$ python3 scripts/ssot-validator.py /tmp/ssot_test_sample.rs
# SSOT-VALIDATOR (L65 / v19 T3) — 6 rule(s), 1 file(s) under ...

SSOT-VALIDATOR: 6 violation(s) across 6 rule(s)

[ERROR  ] hardcoded-url  (Hardcoded URL literal — should come from config or env)
  /tmp/ssot_test_sample.rs:10:16  match=`https://api.example.com/v1/users`
    → fix: Move the URL into a config struct (e.g. pheno-config) or env var; reference via Settings::get("api.base_url").

[WARNING] hardcoded-port  (Hardcoded network port — should be configurable)
  /tmp/ssot_test_sample.rs:16:26  match=`:8080`
    → fix: Read the port from a typed config (e.g. Settings { db_port: u16 }); default 0 to force explicit config in prod.

[WARNING] magic-number-duration  (Magic number cast to a duration type — should be a named constant)
  /tmp/ssot_test_sample.rs:22:24  match=`30;`
    → fix: Extract to a `const RETRY_TIMEOUT_SECS: u64 = 30;` (or load from config) so it's named and tunable.
  …
[INFO   ] crate-name-literal  (…)
  /tmp/ssot_test_sample.rs:32:5  match=`let crate_name = "pheno_config"`
  …
[INFO   ] inline-env-var-name  (…)
  /tmp/ssot_test_sample.rs:38:16  match=`env::var("PHENO_DB_HOST")`
  …
[INFO   ] hardcoded-endpoint-path  (…)
  /tmp/ssot_test_sample.rs:44:16  match=`"/v1/orders/{id}"`
  …

$ echo $?
1
```

Exit codes verified: 1 on violation, 0 on clean, 1 with `--strict-errors-only` (because the URL is the one `error`-severity match).

---

## 4. Fix workflow (per violation)

When the validator flags a match, the recommended fix ladder is:

1. **Inline exemption (fast, narrow).** Add `// ssot-allow: <rule-id>` to the offending line. Use this when the match is *intentional* (e.g. a deliberately-allowed `http://localhost:NNNN` for an integration test that you want to keep visible).
   ```rust
   let timeout: u64 = 30;  // ssot-allow: magic-number-duration
   ```

2. **File-level exemption (medium, broad).** Add a glob to `exempt_globs` in `scripts/ssot-rules.toml` for the directory or file pattern. Use this when an entire class of files (e.g. all `tests/integration_legacy_*.rs`) should be excluded.
   ```toml
   exempt_globs = ["**/integration_legacy_*.rs", ...]
   ```

3. **Move to SSOT (preferred, durable).** For real violations, extract the literal to a named constant, env-var binding, or config field:
   - **URL** → `pheno_config::Settings::get("api.base_url")` (or env `PHENO_API_BASE_URL`).
   - **Port** → typed `Settings { db_port: u16 }` field, populated from env, with `0` default to force explicit prod config.
   - **Magic number** → `pub const RETRY_TIMEOUT_SECS: u64 = 30;` at the top of the module, with a one-line comment citing the original PR / ADR.
   - **Crate name** → `let crate_name = env!("CARGO_PKG_NAME");` (compile-time, zero runtime cost).
   - **Env-var name** → `pub const ENV_DB_HOST: &str = "PHENO_DB_HOST";` in the config module.
   - **Endpoint path** → `pub const V1_ORDERS_BY_ID: &str = "/v1/orders/{id}";` in a generated `routes.rs` (codegen from OpenAPI per ADR-024 / OpenAPI-as-SSOT).

4. **Narrow the rule (last resort, governance change).** If the rule pattern is too broad, file a PR to `scripts/ssot-rules.toml` that:
   - Tightens the `pattern` (e.g. add a file-context qualifier).
   - OR adds a more specific `exempt_globs` / `exempt_line_patterns` entry.
   - OR reduces the severity (`warning` → `info`) with rationale in the PR description.

5. **Promote a rule (forward).** When a category moves from "rarely useful" to "fleet-wide" (e.g. once `pheno-config` is on every crate, all `inline-env-var-name` matches can be promoted to `warning`), file a PR that bumps the severity. The default ruleset ships all `info` rules at `info` severity to start — promotion is by 1-cycle observation.

---

## 5. Pre-commit integration

`.pre-commit-config.yaml` (delta — 11 lines added):

```yaml
- id: ssot-validator
  name: ssot-validator (L65)
  description: Scan staged .rs files for hardcoded literals (URLs, ports, magic numbers, env-var names, endpoint paths) that should come from a SSOT
  entry: python3 scripts/ssot-validator.py
  language: system
  pass_filenames: true
  types: [rust]
  stages: [pre-commit]
```

- **Idempotent:** `pre-commit validate-config .pre-commit-config.yaml` exits 0.
- **Per-file:** pre-commit's framework passes staged `.rs` files as `$@`. The script falls back to `git diff --cached --name-only --diff-filter=ACMR -- '*.rs'` when invoked with no args (manual / CI mode).
- **Bypassable:** `git commit --no-verify` (per the standard pre-commit escape hatch).
- **Companion to `validate-ssot`:** the existing `validate-ssot` hook runs `scripts/validate-ssot.sh` against `SSOT.md` structure; the new `ssot-validator` hook runs the python script against staged `.rs` files. Both gates are L65 — they cover the "what" (SSOT.md is complete) and the "how" (code references the SSOT, not literals).

---

## 6. CLI surface (for ad-hoc audits + CI)

```
scripts/ssot-validator.py [paths...] [--rules PATH] [--repo-root PATH]
                          [--root] [--json] [--strict-errors-only] [--quiet]
```

- **No args, in a git repo:** scan staged `.rs` files (the pre-commit default).
- **Paths:** scan the given files (or recurse with `--root` for a directory).
- **`--json`:** machine-readable output for CI; schema `ssot-validator/v1`.
- **`--strict-errors-only`:** warnings become advisory; only `error` blocks.
- **`--quiet`:** one line per violation on stderr; no banner (CI mode).

Stdlib only (`tomllib` from Python 3.11+, `re`, `argparse`, `subprocess`, `pathlib`, `dataclasses`, `fnmatch`). No `pip install` required — matches the pattern of `scripts/l6_bucket_drift_check.py` and `scripts/perf_gate.py`.

---

## 7. CI integration (follow-up, not in this commit)

For a fleet-wide weekly sweep (per ADR-041 cadence), add a workflow at `.github/workflows/ssot-validator.yml`:

```yaml
name: ssot-validator
on:
  schedule: [{cron: '0 16 * * 1'}]  # Mon 09:00 PDT = 16:00 UTC
  pull_request:
    paths: ['scripts/ssot-validator.py', 'scripts/ssot-rules.toml', '**/*.rs']
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: python3 scripts/ssot-validator.py --root . --json > ssot-report.json
      - uses: actions/upload-artifact@v4
        with: {name: ssot-report, path: ssot-report.json}
```

The JSON schema (`ssot-validator/v1`) is stable; downstream tooling (the registry refresh job, the 71-pillar weekly report) can ingest it without re-parsing the human-readable format.

---

## 8. Verification log

| Check                                                    | Result |
|----------------------------------------------------------|--------|
| `pre-commit validate-config .pre-commit-config.yaml`     | exit 0 |
| `python3 scripts/ssot-validator.py /tmp/ssot_test_sample.rs` | 6 violations across 6 rules, exit 1 |
| Same with `--strict-errors-only`                         | 1 blocker (URL), exit 1 |
| Same with `--json`                                        | `{"schema_version":"ssot-validator/v1","violation_count":6,...}` |
| `python3 scripts/ssot-validator.py /tmp/ssot_clean_sample.rs` | 0 violations, exit 0 |
| `python3 scripts/ssot-validator.py` (no args, no staged) | 0 files, clean exit 0 |
| Inline `// ssot-allow: magic-number-duration` suppresses `60;` on line 26 | confirmed in test output |
| Top-level `const FOO: u32 = 30;` exempt (no warning)     | confirmed (clean sample case) |

---

## 9. Scorecard delta

| Pillar | Before (2026-06-17 baseline) | After (2026-06-21 v19 T3) | Delta |
|--------|------------------------------|----------------------------|-------|
| L65 (SSOT) | 1.0 (Minimal) | 2.0 (Adequate) | +1.0 |

**L65 justification (post):**
- 1.0 (Minimal) → 2.0 (Adequate): existing fleet has `scripts/validate-ssot.sh` (SSOT.md structure) but **no enforcement** that source code references the SSOT. v19 T3 ships the pre-commit hook + rule registry, so violations are now caught at commit time, with a 1-page fix ladder and a weekly CI sweep planned (ADR-041 cadence).
- Promotion to 3.0 (SOTA) requires: weekly CI gate that scans the entire fleet, a public dashboard of the violation histogram, and at least one fleet-wide sweep that drives 0 `error`-severity findings. All three are scoped for v20.

---

## 10. Follow-ups (NOT in this commit)

- [ ] Weekly CI workflow (see §7) — schedules `ssot-validator.py --root . --json` on Mondays.
- [ ] Fleet-wide initial sweep: 0 known, but the first Monday run will produce the baseline report.
- [ ] 1-cycle observation: keep `hardcoded-url` at `error`, demote any rule that produces > 5% false-positive rate from `warning` to `info`.
- [ ] v20: codegen `routes.rs` from OpenAPI spec (consumes the `hardcoded-endpoint-path` rule by removing the manual step).
- [ ] v20: cross-reference the 71-pillar scorecard to track L65 trend weekly.
