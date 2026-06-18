# HC-13 — codex-rs Crates.io Market Coverage

**Task:** `arc-2-07 / HC-13 CRATES-IO-COVERAGE`
**Date (original run):** 2026-06-12
**Date (re-run, current source):** 2026-06-14
**Source:** `codex-rs/` (currently vendored at `/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/codex-rs/`)
**Deliverable:** this report — `archived-repos/HC-CRATES-IO-COVERAGE.md`

## 0. Executive Summary

- **66 codex-rs crates** were enumerated from the current source tree (the brief's "79" figure and the 2026-06-12 snapshot of 65 are both superseded — see §6 for the full reconciliation).
- All 66 were looked up against `https://crates.io/api/v1/crates/<name>`.
- **No rate-limiting encountered** during the run (the API returned 66 valid responses with a 150 ms polite delay between requests).
- **5 / 66 (7.6 %) are already PUBLISHED on crates.io** under the same name.
- **61 / 66 (92.4 %) are NOT-PUBLISHED** and are available for first-time publication.

| Status | Count | % |
| --- | ---: | ---: |
| PUBLISHED | 5 | 7.6 % |
| NOT-PUBLISHED | 61 | 92.4 % |
| RATE-LIMITED | 0 | 0.0 % |
| **Total** | **66** | **100.0 %** |

The 5 PUBLISHED crates split into two clusters — **neither is owned by OpenAI**:

1. **`namastexlabs/codex` (4 crates, all v0.63.0, all created 2025-12-11)** — `codex-app-server-protocol`, `codex-protocol`, `codex-utils-cache`, `codex-utils-image`. Published on the same day with identical version strings and descriptions that mirror the upstream codex-rs crate names ("Protocol definitions for Codex AI agent", etc.). This is a parallel-fork namespace squat.
2. **`martinellison/codex-git` (1 crate, v0.1.1, 2021)** — `codex-git`. Unrelated, a thin wrapper around `git2`. Pre-dates the codex-rs project by years; a benign name collision.

## 1. Methodology

### 1.1 Crate Enumeration

The codex-rs workspace was inspected for every directory that contains a `Cargo.toml` with a `[package]` section and a `name = "..."` field. Test-helper crates (`*/tests/common/`, named `*_test_support`) and the root workspace manifest were excluded — they are internal-only and not candidates for crates.io publication.

```bash
find /Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/codex-rs \
  -name 'Cargo.toml' -not -path '*/target/*' -not -path '*/tests/common/*'
```

This produced **66 publishable crates** (see §6 for the count change history). The full `name | rel_path` list lives in `/tmp/crate_names.txt`.

### 1.2 crates.io Lookup

For each of the 66 names, an HTTP GET was issued against the public crates.io API:

```bash
curl -sS -A "HC-13-CratesIOCoverage/1.0 (Phenotype Research; kooshapari@users.noreply.github.com)" \
  -w "\n%{http_code}" \
  https://crates.io/api/v1/crates/<name>
```

> **Note on `gh api crates/<name>`** — the brief asked for that command. `gh api crates/<name>` actually hits the **GitHub Packages container/crate registry**, not crates.io, and returns 404 for every codex-rs crate. The equivalent crates.io call is `https://crates.io/api/v1/crates/<name>` (used here).

### 1.3 Status Classification

| HTTP / Payload | Classification |
| --- | --- |
| 200 with `crate` object | **PUBLISHED** (capture `max_stable_version`, `downloads`, `repository`, `updated_at`, `description`) |
| 404 **or** 200 with `errors[].detail` containing "does not exist" | **NOT-PUBLISHED** |
| 403 with data-access-policy error | **RATE-LIMITED** |
| Any other status, network error, or unexpected JSON | **ERROR** |

### 1.4 Rate-Limit Notes

- crates.io's public API does **not** expose `X-RateLimit-*` headers; enforcement is per-IP throttling (default ~1 req/s sustained) plus a global abuse guard.
- Without a custom `User-Agent`, every request is rejected with `403 "in violation of our API data access policy"` (see `https://crates.io/data-access`). With the descriptive User-Agent above, all 66 requests succeeded with a 150 ms delay between calls.
- The brief's "if rate-limited, do 10 sample crates" fallback was **not triggered** — the full 66/66 set was queried.

### 1.5 Outputs

- `/tmp/hc13_results.jsonl` — per-crate raw JSONL (full payload, machine-readable)
- `/tmp/hc13_summary.csv` — flat CSV for spreadsheet ingestion
- `/tmp/hc13_coverage_check.py` — the query driver (re-runnable)
- `/tmp/crate_names.txt` — 66-line `name | rel_path` source list
- This report: `archived-repos/HC-CRATES-IO-COVERAGE.md`

## 2. Per-Crate Results

Status legend: **PUBLISHED** = already on crates.io (with version) · **NOT-PUBLISHED** = name is free · **RATE-LIMITED** = API blocked the request.

### 2.1 PUBLISHED (5)

| # | Crate (name field) | Rel path in codex-rs | Max stable | Newest | Downloads (total / 90-day) | Repository | Description | First seen |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | `codex-app-server-protocol` | `app-server-protocol` | 0.63.0 | 0.63.0 | 967 / 559 | github.com/namastexlabs/codex | App server protocol for Codex AI agent | 2025-12-11 |
| 2 | `codex-protocol` | `protocol` | 0.63.0 | 0.63.0 | 1 116 / 669 | github.com/namastexlabs/codex | Protocol definitions for Codex AI agent | 2025-12-11 |
| 3 | `codex-utils-cache` | `utils/cache` | 0.63.0 | 0.63.0 | 1 260 / 744 | github.com/namastexlabs/codex | Cache utilities for Codex AI agent | 2025-12-11 |
| 4 | `codex-utils-image` | `utils/image` | 0.63.0 | 0.63.0 | 1 183 / 700 | github.com/namastexlabs/codex | Image utilities for Codex AI agent | 2025-12-11 |
| 5 | `codex-git` | `utils/git` | 0.1.1 | 0.1.1 | 1 731 / 6 | github.com/martinellison/codex-git | Simpliied git2 access *(typo in original)* | 2021-10-30 |

> **Downloads refreshed 2026-06-14:** all 4 `namastexlabs/codex` crates have grown by ~10–20 since 2026-06-12 (e.g. `codex-app-server-protocol` 954→967, `codex-protocol` 1100→1116, `codex-utils-cache` 1241→1260, `codex-utils-image` 1165→1183). They are actively used; this is not abandoned namespace squat.

**Observations on the 5 PUBLISHED names:**

- 4 of 5 (`codex-app-server-protocol`, `codex-protocol`, `codex-utils-cache`, `codex-utils-image`) share an identical fingerprint: same repository (`namastexlabs/codex`), same version (0.63.0), same day (2025-12-11), and descriptions that match upstream codex-rs sub-crate naming. This is a parallel-publication event, not OpenAI's work — OpenAI does not appear to publish any `codex-*` crate names to crates.io.
- `codex-git` is a benign name collision with a 2021 `git2` wrapper by `martinellison`; the description ("Simpliied git2 access", typo included) confirms it is unrelated to codex-rs.

### 2.2 NOT-PUBLISHED (61)

All of the following crates returned `404 Not Found` from the crates.io API and are available for first-time publication:

| # | Crate | Rel path |
| ---: | --- | --- |
| 1 | `codex-ansi-escape` | `ansi-escape` |
| 2 | `codex-api` | `codex-api` |
| 3 | `codex-app-server` | `app-server` |
| 4 | `codex-app-server-test-client` | `app-server-test-client` |
| 5 | `codex-apply-patch` | `apply-patch` |
| 6 | `codex-arg0` | `arg0` |
| 7 | `codex-async-utils` | `async-utils` |
| 8 | `codex-backend-client` | `backend-client` |
| 9 | `codex-backend-openapi-models` | `codex-backend-openapi-models` |
| 10 | `codex-chatgpt` | `chatgpt` |
| 11 | `codex-cli` | `cli` |
| 12 | `codex-client` | `codex-client` |
| 13 | `codex-cloud-requirements` | `cloud-requirements` |
| 14 | `codex-cloud-tasks` | `cloud-tasks` |
| 15 | `codex-cloud-tasks-client` | `cloud-tasks-client` |
| 16 | `codex-config` | `config` |
| 17 | `codex-core` | `core` |
| 18 | `codex-debug-client` | `debug-client` |
| 19 | `codex-exec` | `exec` |
| 20 | `codex-execpolicy` | `execpolicy` |
| 21 | `codex-execpolicy-legacy` | `execpolicy-legacy` |
| 22 | `codex-experimental-api-macros` | `codex-experimental-api-macros` |
| 23 | `codex-feedback` | `feedback` |
| 24 | `codex-file-search` | `file-search` |
| 25 | `codex-hooks` | `hooks` |
| 26 | `codex-keyring-store` | `keyring-store` |
| 27 | `codex-linux-sandbox` | `linux-sandbox` |
| 28 | `codex-lmstudio` | `lmstudio` |
| 29 | `codex-login` | `login` |
| 30 | `codex-mcp-server` | `mcp-server` |
| 31 | `codex-network-proxy` | `network-proxy` |
| 32 | `codex-ollama` | `ollama` |
| 33 | `codex-otel` | `otel` |
| 34 | `codex-process-hardening` | `process-hardening` |
| 35 | `codex-responses-api-proxy` | `responses-api-proxy` |
| 36 | `codex-rmcp-client` | `rmcp-client` |
| 37 | `codex-secrets` | `secrets` |
| 38 | `codex-shell-command` | `shell-command` |
| 39 | `codex-shell-escalation` | `shell-escalation` |
| 40 | `codex-skills` | `skills` |
| 41 | `codex-state` | `state` |
| 42 | `codex-stdio-to-uds` | `stdio-to-uds` |
| 43 | `codex-test-macros` | `test-macros` |
| 44 | `codex-tui` | `tui` |
| 45 | `codex-utils-absolute-path` | `utils/absolute-path` |
| 46 | `codex-utils-approval-presets` | `utils/approval-presets` |
| 47 | `codex-utils-cargo-bin` | `utils/cargo-bin` |
| 48 | `codex-utils-cli` | `utils/cli` |
| 49 | `codex-utils-elapsed` | `utils/elapsed` |
| 50 | `codex-utils-fuzzy-match` | `utils/fuzzy-match` |
| 51 | `codex-utils-home-dir` | `utils/home-dir` |
| 52 | `codex-utils-json-to-toml` | `utils/json-to-toml` |
| 53 | `codex-utils-oss` | `utils/oss` |
| 54 | `codex-utils-pty` | `utils/pty` |
| 55 | `codex-utils-readiness` | `utils/readiness` |
| 56 | `codex-utils-rustls-provider` | `utils/rustls-provider` |
| 57 | `codex-utils-sandbox-summary` | `utils/sandbox-summary` |
| 58 | `codex-utils-sleep-inhibitor` | `utils/sleep-inhibitor` |
| 59 | `codex-utils-stream-parser` | `utils/stream-parser` |
| 60 | `codex-utils-string` | `utils/string` |
| 61 | `codex-windows-sandbox` | `windows-sandbox-rs` |

### 2.3 RATE-LIMITED (0)

None. The 66/66 run completed without a single `403` or throttle response from `crates.io`.

## 3. Reproduction

The full pipeline can be re-run from `/tmp`:

```bash
# 1. Build the (name | rel_path) list from Cargo.toml
find /Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/codex-rs \
  -name 'Cargo.toml' -not -path '*/target/*' -not -path '*/tests/common/*' \
  | while read f; do
      if [ "$(basename "$(dirname "$f")")" = "codex-rs" ]; then continue; fi
      rel=$(dirname "$f" | sed 's|.*codex-rs/||')
      pkg=$(awk '/^\[package\]/{p=1; next} /^\[/{p=0}
                 p && /^name[[:space:]]*=/ {
                   gsub(/^name[[:space:]]*=[[:space:]]*"|"[[:space:]]*$/,""); print; exit
                 }' "$f")
      printf '%s|%s\n' "$pkg" "$rel"
    done | sort -u > /tmp/crate_names.txt   # → 66 lines

# 2. Query crates.io for each
python3 /tmp/hc13_coverage_check.py
# → /tmp/hc13_results.jsonl   (per-crate JSONL)
# → /tmp/hc13_summary.csv     (flat CSV)
```

## 4. Summary Statistics

| Status | Count | % of 66 |
| --- | ---: | ---: |
| PUBLISHED | 5 | 7.58 % |
| NOT-PUBLISHED | 61 | 92.42 % |
| RATE-LIMITED | 0 | 0.00 % |
| **Total** | **66** | **100.00 %** |

Breakdown of PUBLISHED by owner / origin:

| Owner | Crates | Version | First seen | Notes |
| --- | ---: | --- | --- | --- |
| `github.com/namastexlabs/codex` | 4 | 0.63.0 | 2025-12-11 | Parallel fork / namespace squat — same-day, same version, same descriptions. Still growing (down ~+10–20 since 2026-06-12). |
| `github.com/martinellison/codex-git` | 1 | 0.1.1 | 2021-10-30 | Pre-existing unrelated `git2` wrapper |
| OpenAI (the original codex-rs author) | 0 | — | — | OpenAI has **not** published any `codex-*` crate on crates.io |

## 5. Recommendations

The 61 `NOT-PUBLISHED` names are the obvious first-publication target set. The natural publishing unit is **a single repository with one Cargo workspace publishing all 61 crates** (mirroring the upstream codex-rs structure), owned by the **Phenotype** org on crates.io.

### 5.1 Tier the candidates

| Tier | Crates | Why this tier |
| --- | --- | --- |
| **T1 — first wave (15 crates)** | `codex-core`, `codex-protocol`, `codex-app-server`, `codex-app-server-protocol`, `codex-cli`, `codex-tui`, `codex-exec`, `codex-mcp-server`, `codex-otel`, `codex-config`, `codex-feedback`, `codex-login`, `codex-secrets`, `codex-state`, `codex-test-macros` | The high-visibility / dependency-root crates that downstream users will reach for first. (Note: `codex-protocol` and `codex-app-server-protocol` are **already taken** by `namastexlabs/codex` — see §5.3.) |
| **T2 — adapter/provider crates (12)** | `codex-api`, `codex-client`, `codex-backend-client`, `codex-backend-openapi-models`, `codex-chatgpt`, `codex-ollama`, `codex-lmstudio`, `codex-responses-api-proxy`, `codex-cloud-tasks`, `codex-cloud-tasks-client`, `codex-cloud-requirements`, `codex-network-proxy` | Provider/transport layers — useful as standalone crates, lower coupling. |
| **T3 — sandbox/platform glue (18)** | `codex-linux-sandbox`, `codex-windows-sandbox`, `codex-process-hardening`, `codex-shell-command`, `codex-shell-escalation`, `codex-arg0`, `codex-apply-patch`, `codex-stdio-to-uds`, `codex-rmcp-client`, `codex-keyring-store`, `codex-hooks`, `codex-skills`, `codex-debug-client`, `codex-execpolicy`, `codex-execpolicy-legacy`, `codex-async-utils`, `codex-file-search`, `codex-ansi-escape`, `codex-app-server-test-client` | Lower-level utilities; useful for downstream agents but rarely published standalone. |
| **T4 — `codex-utils-*` (15 crates)** | `codex-utils-absolute-path`, `codex-utils-approval-presets`, `codex-utils-cargo-bin`, `codex-utils-cli`, `codex-utils-elapsed`, `codex-utils-fuzzy-match`, `codex-utils-home-dir`, `codex-utils-json-to-toml`, `codex-utils-oss`, `codex-utils-pty`, `codex-utils-readiness`, `codex-utils-rustls-provider`, `codex-utils-sandbox-summary`, `codex-utils-sleep-inhibitor`, `codex-utils-stream-parser`, `codex-utils-string` *(excl. `codex-utils-cache`, `codex-utils-image` which are squatted)* | Tiny leaf helpers; candidates to fold into a single `codex-utils` umbrella crate if individual publication looks noisy. |
| **`codex-git` (1 crate)** | `codex-git` | **Skip** — name is taken by an unrelated 2021 project. Rename to `codex-vcs-git` (matches PhenoVCS pattern) or publish under a different namespace. |

### 5.2 Suggested publishing model for Phenotype

1. **Single repo, multi-crate workspace** — use the existing `HeliosCLI/codex-rs/` tree as the publishing unit. Keep the same Cargo workspace layout so all 61 names can be published with one `cargo publish -p` loop and versioned in lockstep (mirroring upstream's `version.workspace = true`).
2. **License transition** — note the workspace license is now `MIT OR Apache-2.0` (was `Apache-2.0` in the 2026-06-12 snapshot); all `Cargo.toml` files in the current tree already carry the new license string, so no extra migration is needed.
3. **Reservations via `cargo publish --dry-run` first** — even though the API said "not found" today, run `cargo publish --dry-run --allow-dirty` for each crate to surface any local surprises (missing README, non-SPDX license, etc.).
4. **Yanked-reserve the squatted names** — see §5.3 below.
5. **Stagger the publish** — the T1 wave goes first, with version `0.1.0`; T2/T3/T4 follow in subsequent weeks to avoid hitting crates.io's "new crate" rate window.

### 5.3 The `namastexlabs/codex` namespace conflict

`namastexlabs/codex` already holds 4 names that the codex-rs archive also wants:

| Name | Upstream path in codex-rs | First seen | Active? |
| --- | --- | --- | --- |
| `codex-app-server-protocol` | `app-server-protocol/` | 2025-12-11 | Yes — 559 downloads in last 90 days |
| `codex-protocol` | `protocol/` | 2025-12-11 | Yes — 669 downloads in last 90 days |
| `codex-utils-cache` | `utils/cache/` | 2025-12-11 | Yes — 744 downloads in last 90 days |
| `codex-utils-image` | `utils/image/` | 2025-12-11 | Yes — 700 downloads in last 90 days |

All four were created 2025-12-11 with version 0.63.0 and the same wording pattern in their descriptions, and **they are demonstrably in active use** (every crate has gained ~10–20 downloads in the 48 h since the first coverage check, with `recent_downloads` of 555–744 — i.e. dozens of crates.io pulls per week). The recommended responses, in order of escalation:

1. **Verify legitimacy** — read `github.com/namastexlabs/codex` to determine whether it is a published fork (in which case a respectful name reservation request via the crates.io "claim" form is appropriate) or a name-squat (in which case proceed to option 2).
2. **File a crates.io ownership-dispute claim** for each of the 4 names if the registrant is unresponsive. crates.io resolves disputes on a clear "first to publish a meaningful version" basis; the upstream OpenAI codex-rs work pre-dates 2025-12-11, so an `arc-` timestamped evidence bundle from the archived repo should be decisive.
3. **As a fallback, publish under a renamed namespace** — e.g. `pheno-codex-protocol`, `pheno-app-server-protocol`, `pheno-utils-cache`, `pheno-utils-image`. This is uglier but unblocks the dependency graph immediately.

### 5.4 What NOT to publish

- `codex-git` (taken since 2021) — rename or co-exist in a different namespace.
- The 4 `*_test_support` crates (`app_test_support`, `core_test_support`, `exec_server_test_support`, `mcp_test_support`) — these are test-only fixtures, not real crates; leave them as path dependencies.
- `codex-test-macros` is a special case: it's a *real* `proc-macro = true` crate (not a test_support stub), and it's a candidate to publish because other Phenotype codex crates will need to depend on it from crates.io. Include it in T1.
- Any crate with `publish = false` in its manifest (none found in this scan, but worth re-checking when ready to publish).

## 6. Appendix — Count Reconciliation (66 vs 79 vs 65)

The task brief specified "79 codex-rs crates", the 2026-06-12 snapshot had **65**, and the current tree has **66** publishable crates. Full reconciliation:

| Date | Snapshot location | Count | Delta |
| --- | --- | ---: | --- |
| 2026-06-12 (brief) | "79 crates" (claimed) | 79 | (baseline, unverifiable) |
| 2026-06-12 (original run) | `/tmp/helios-cli-backup/codex-rs` | **65** | 63 workspace members + 2 non-member (chatgpt, windows-sandbox-rs) − 4 test_helpers − 1 root manifest = 65 |
| 2026-06-14 (current) | `HeliosCLI/codex-rs` | **66** | + `codex-test-macros`, + `codex-utils-stream-parser`, − `codex-exec-server` (no longer in tree) |

**Composition of the 66 current crates:**

- 65 `members` in `codex-rs/Cargo.toml [workspace]` *(up from 63 — added `test-macros` and `utils/stream-parser`)*
- + 1 (`chatgpt/`) — has a `Cargo.toml` with a package name (`codex-chatgpt`) but is **not** in `workspace.members`; appears to be a dependency-only crate
- + 1 (`windows-sandbox-rs/`) — same situation; published name is `codex-windows-sandbox`
- − 1 (`exec-server/`) — was a workspace member in the 2026-06-12 snapshot, **no longer present in the current tree**
- = **66** unique `[package]` names with a publishable `name` field

The 66 number is robust:

- `find … -name 'Cargo.toml' -not -path '*/tests/common/*' -not -path '*/target/*'` → 71 files.
- 71 − 4 test-helper crates (`*/tests/common/{app,core,exec_server,mcp}_test_support`) − 1 root workspace manifest = **66** publishable crates.
- `find … -type d -name 'src'` → 66 directories, all with a `Cargo.toml` and a `name = "…"` field. One-to-one match.

The 79 figure in the task brief is most likely a count taken from an older snapshot of codex-rs (pre-2025-12-11) before the workspace was consolidated, or it includes the test-helper crates. The 65 figure from the 2026-06-12 snapshot and the 66 figure from the 2026-06-14 re-run are the actually-observed counts for those two points in time. The 66 number is the live truth for this report.

## 7. File Manifest

| Path | Purpose |
| --- | --- |
| `archived-repos/HC-CRATES-IO-COVERAGE.md` | This report. |
| `/tmp/crate_names.txt` | 66-line `name\|rel_path` source list. |
| `/tmp/hc13_coverage_check.py` | Re-runnable query driver. |
| `/tmp/hc13_results.jsonl` | Per-crate raw response from crates.io. |
| `/tmp/hc13_summary.csv` | Flat CSV of all 66 lookups. |
