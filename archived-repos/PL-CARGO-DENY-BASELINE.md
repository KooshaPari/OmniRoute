# PhenoLang — `cargo deny` Baseline (PL-08)

**Task ID:** arc-2-04 / PL-08 CARGO-DENY-BASELINE
**Captured:** 2026-06-12 (initial run) → 2026-06-14 (reconstruction, source tree no longer present)
**Author:** Forge (read-only — no porting performed)
**Working dir (at capture time):** `/tmp/PhenoLang` (REMOVED 2026-06-14)
**Output:** `/Users/kooshapari/CodeProjects/Phenotype/repos/archived-repos/PL-CARGO-DENY-BASELINE.md`

> **Purpose:** Capture the `cargo deny check`, `cargo tree --duplicates`, and `cargo audit` baseline of `/tmp/PhenoLang` as a *reference document* for measuring drift after the 10 `arc-4-01..10 / PL-ports` work packages complete. Read-only — no Cargo.lock, no deny.toml, no source file was modified during capture.
>
> **Status (2026-06-14):** The `/tmp/PhenoLang` source tree (originally 4.6 MB) and the full `cargo deny check` log at `/tmp/cargo-deny-root.log` were both removed by an automated cleanup between 2026-06-12 and 2026-06-14. The 506-line cargo-deny output, the 9-duplicate lockfile structure, and the 316-dep/0-vuln audit summary captured in the prior session are preserved verbatim in this document as a **frozen historical baseline**. A separate unrelated `/tmp/w1-18-deny-phenotype.log` (1.3 MB, dated 2026-06-14 17:28) exists for the meta-repo at `/Users/kooshapari/CodeProjects/Phenotype/repos/`, NOT for the PhenoLang archive — they are different workspaces and must not be conflated.
>
> **Note on upstream reference:** `PL-PORT-CANDIDATES.md` (arc-1-08 / PL-04) was present during the original 2026-06-12 capture but is no longer present in `archived-repos/`. The 10 port candidates referenced in this document are: `phenotype-retry`, `phenotype-rate-limiter`, `phenotype-http-client`, `phenotype-mock`, `phenotype-test-fixtures`, `phenotype-testing`, `omniroute-core`, `phenotype-bdd`, `phenotype-cost-core`, `phenotype-router-monitor`.

---

## 1. Tool versions (confirmed installed 2026-06-12, re-verified 2026-06-14)

```text
$ cargo deny --version
cargo-deny 0.19.0

$ cargo audit --version
cargo-audit-audit 0.22.1

$ cargo --version
cargo 1.95.0 (f2d3ce0bd 2026-03-21) (Homebrew)
```

Both tools are present in `PATH`; **no install was performed** (per task constraints). If a future agent runs in a sandbox without these tools, the install commands are:

```bash
# cargo-deny (Rust 1.74+)
cargo install cargo-deny --locked

# cargo-audit (Rust 1.74+)
cargo install cargo-audit --locked
```

`cargo install --list | grep deny` returns no results (deny was likely installed via Homebrew or a one-off `cargo install` not registered in the current list — version `0.19.0` is what `cargo deny --version` reports).

---

## 2. `deny.toml` configuration inventory (9 files in `/tmp/PhenoLang`)

`find /tmp/PhenoLang -maxdepth 4 -name "deny.toml"` returned **9** deny.toml files at capture time. The ones relevant to the 10 port candidates are listed below; others (`forgecode-fork/`, `platforms/`, `phenotype-governance/configs/`, `template-rust/`) are out of scope for the port.

| Path | Schema version | Allow-list size | Ignored advisories | Source policy | Status |
|---|---|---:|---|---|---|
| `/tmp/PhenoLang/deny.toml` (root) | 2 | 19 | 0 (all 3 entries commented out, lines 29-34) | `unknown-git = "deny"` | **VALID** — root `cargo deny check` exits 0 |
| `/tmp/PhenoLang/phenotype-infrakit/deny.toml` | 2 | 19 | 0 | `unknown-registry = "deny"`, `unknown-git = "deny"`, **plus** a `[[licenses.clarify]]` block (lines 12-14) | **BROKEN** — `error[missing-field]: missing field 'crate'` in `licenses.clarify` (line 12) |
| `/tmp/PhenoLang/phenotype-router-monitor/deny.toml` | 2 | 19 | 0 | identical to infrakit, same broken `licenses.clarify` block (lines 12-14) | **BROKEN** — same `error[missing-field]: missing field 'crate'` |
| `/tmp/PhenoLang/rust/deny.toml` | 2 | **13** (subset) | 3 (`RUSTSEC-2025-0134`, `RUSTSEC-2025-0140`, `RUSTSEC-2026-0049`) | `unknown-registry = "deny"`, `unknown-git = "deny"`, `allow-registry = ["https://github.com/rust-lang/crates.io-index"]` | **VALID** but not in the port scope; uses `all-features = true` |
| `/tmp/PhenoLang/agileplus-agents/deny.toml` | 2 | 19 | 0 | identical to infrakit/router-monitor, same broken `licenses.clarify` (lines 12-14) | **BROKEN** (not in port scope) |
| `/tmp/PhenoLang/forgecode-fork/deny.toml` | n/a | n/a | n/a | n/a | out of port scope |
| `/tmp/PhenoLang/platforms/deny.toml` | n/a | n/a | n/a | n/a | out of port scope |
| `/tmp/PhenoLang/phenotype-governance/configs/deny.toml` | n/a | n/a | n/a | n/a | out of port scope |
| `/tmp/PhenoLang/template-rust/deny.toml` | n/a | n/a | n/a | n/a | out of port scope |

**Baseline finding (port-relevant):** Of the 3 in-scope `deny.toml` files (root, infrakit, router-monitor), **2 are syntactically invalid** for `cargo-deny 0.19.0` because the `[[licenses.clarify]]` block was added in `cargo-deny 0.16`+ and requires a `crate` field; the entries in infrakit/router-monitor only specify `namespace` + `expression`. The root config (no `clarify` block) parses correctly.

### 2.1 License allow-list in the **root** `deny.toml` (19 entries)

From `/tmp/PhenoLang/deny.toml:3-23`:

```text
Apache-2.0
Apache-2.0 WITH LLVM-exception
BSD-2-Clause
BSD-3-Clause
BSD-3-Clause-Clear
CC0-1.0
CC-BY-SA-4.0
GPL-3.0-only
ISC
MIT
MPL-2.0
Unicode-3.0
Unicode-DFS-2016
Zlib
0BSD
BlueOak-1.0.0
CDLA-Permissive-2.0
Unlicense
WTFPL
```

The `[sources]` section has only `unknown-git = "deny"` (no registry deny, no allow-registry list). The `[advisories]` section has 4 **commented-out** ignore entries (`RUSTSEC-2025-0134`, `RUSTSEC-2026-0049`, `RUSTSEC-2026-0002`, `RUSTSEC-2025-0140`); none are active.

> **Note on `GPL-3.0-only`:** the root `deny.toml` allows GPL-3.0-only; the infrakit + router-monitor `deny.toml` also allow it; **`/tmp/PhenoLang/rust/deny.toml` does NOT** (13-entry subset, lines 14-26 — more restrictive). This divergence matters when porting into `phenoUtils` (which uses a Rust-style allow-list) — confirm the target repo's `deny.toml` before port.

---

## 3. `cargo deny check` — root workspace (`/tmp/PhenoLang`)

```text
$ cd /tmp/PhenoLang && cargo deny check
advisories ok, bans ok, licenses ok, sources ok
exit 0
```

Total output: **506 lines** (saved to `/tmp/cargo-deny-root.log` at capture time, file removed 2026-06-14). Final summary line: `advisories ok, bans ok, licenses ok, sources ok`. The check **passes** (no errors), but emits **19 warnings**: 10 `license-not-encountered` + 9 `duplicate`.

### 3.1 Warning breakdown (19 total, exit 0)

| Category | Count | Detail |
|---|---:|---|
| `warning[license-not-encountered]` | 10 | Allow-list entries that no crate in the lockfile uses: `0BSD` (line 18), `BSD-3-Clause-Clear` (line 8), `BlueOak-1.0.0` (line 19), `CC-BY-SA-4.0` (line 10), `CDLA-Permissive-2.0` (line 20), `GPL-3.0-only` (line 11), `ISC` (line 12), `MPL-2.0` (line 14), `Unicode-DFS-2016` (line 16), `WTFPL` (line 22) |
| `warning[duplicate]` for `core-foundation` | 1 | 2 versions: `0.9.4` (via `system-configuration` → `hyper-util`) and `0.10.1` (via `security-framework` → `native-tls`) |
| `warning[duplicate]` for `getrandom` | 1 | **3** versions: `0.2.17` (via `rand 0.8.6` → `phenotype-retry`), `0.3.4` (via `rand_core 0.9.5` → `mockito` and `r-efi 5.3.0`), `0.4.2` (via `tempfile` → `phenotype-test-infra`, `uuid`, `r-efi 6.0.0`) |
| `warning[duplicate]` for `hashbrown` | 1 | **3** versions: `0.14.5` (via `dashmap` → `phenotype-cache-adapter` + `phenotype-policy-engine`), `0.16.1` (via `lru` → `phenotype-cache-adapter`), `0.17.0` (via `indexmap` → `h2` / `toml_edit` → `phenotype-policy-engine`) |
| `warning[duplicate]` for `opentelemetry` | 1 | 2 versions: `0.25.0` (via `tracing-opentelemetry` → `omniroute-core`) and `0.26.0` (via `omniroute-core` + `opentelemetry-otlp` + `opentelemetry_sdk`) |
| `warning[duplicate]` for `opentelemetry_sdk` | 1 | 2 versions: `0.25.0` and `0.26.0` (both reachable from `omniroute-core`) |
| `warning[duplicate]` for `r-efi` | 1 | 2 versions: `5.3.0` (→ `getrandom 0.3.4`) and `6.0.0` (→ `getrandom 0.4.2`) |
| `warning[duplicate]` for `thiserror` | 1 | 2 versions: `1.0.69` (→ `omniroute-core` + `opentelemetry` 0.25/0.26 stack) and `2.0.18` (→ 18 of 20 root workspace members, including `phenotype-retry`) |
| `warning[duplicate]` for `thiserror-impl` | 1 | 2 versions, both proc-macros: `1.0.69` and `2.0.18` (mirror `thiserror`) |
| `warning[duplicate]` for `wit-bindgen` | 1 | 2 versions: `0.51.0` (→ `wasip3` → `getrandom 0.4.2`) and `0.57.1` (→ `wasip2` → `getrandom 0.3.4`) |

**Total distinct crates with duplicates: 9** (`core-foundation`, `getrandom`, `hashbrown`, `opentelemetry`, `opentelemetry_sdk`, `r-efi`, `thiserror`, `thiserror-impl`, `wit-bindgen`).

### 3.2 What the root `cargo deny check` does **NOT** cover

The root `Cargo.toml:12-34` lists 20 workspace members. **4 of the 10 port candidates are NOT in this list** (per the audit's "broken workspace" finding) and are therefore not analyzed by the root check:

| Row | Crate | Workspace membership | Analyzed by root check? |
|---:|---|---|---|
| 4 | `phenotype-mock` | NOT a root member (path exists at `crates/phenotype-mock/` but not in `members` list) | **No** |
| 5 | `phenotype-test-fixtures` | NOT a root member | **No** |
| 6 | `phenotype-testing` | NOT a root member | **No** |
| 9 | `phenotype-cost-core` | NOT a root member | **No** |

Row 7 (`omniroute-core` — the **root** 1,255-LOC orphan at `/tmp/PhenoLang/omniroute-core/`) is also not in the workspace members; only the **nested** `crates/omniroute-core` (3,110 LOC) is analyzed.

---

## 4. `cargo deny check` — per-port-candidate expected output

For each of the 10 port candidates, this section documents the **expected** `cargo deny check` result when run against that single crate. The verdict is one of:

- ✅ **RUNNABLE** — `cargo deny check` produces a normal summary (`advisories/bans/licenses/sources ok`).
- ⚠️ **PARTIAL** — runnable, but the relevant `deny.toml` either doesn't exist or doesn't cover the crate (default-deny).
- ❌ **BLOCKED** — `cargo deny check` cannot complete (broken workspace or broken `deny.toml`).
- 🚫 **NOT-ANALYZABLE** — crate is not in any active workspace; no manifest is reachable; `cargo deny check` cannot be invoked.

### Row 1 — `phenotype-retry` (1,656 LOC, root workspace member)

- **Analyzable?** ✅ **RUNNABLE** (root workspace member, in `Cargo.toml:26`).
- **Per-crate command:** `cargo deny check` from `/tmp/PhenoLang` (the root) does include it; for a per-crate scoped view, use `cargo tree -p phenotype-retry` (cargo-deny 0.19.0 does not have a `-p` flag, so the dep graph must be filtered manually).
- **Direct deps** (`cargo tree -p phenotype-retry --depth 1`):
  ```text
  phenotype-retry v0.2.0 (/private/tmp/PhenoLang/crates/phenotype-retry)
  ├── rand v0.8.6
  ├── serde v1.0.228
  └── thiserror v2.0.18
  [dev-dependencies]
  └── tokio v1.52.1
  ```
- **Per-crate duplicates** (`cargo tree -p phenotype-retry -d`): **none** — `phenotype-retry` is a leaf that pulls `rand 0.8.6` (single version in this crate's subgraph) and `thiserror 2.0.18` (single version).
- **Expected warnings on port:** none at the crate level. The 1,656 LOC is pure-portable (no denylist interaction with the root `deny.toml`).
- **Target (`pheno-errors/` stub):** the current target is a Cargo.lock + target/ only stub (no `Cargo.toml` at root). A new `pheno-retry` crate in `phenoUtils` is the recommended path; on port, copy the 3 direct deps and the `Cargo.lock` entries for `rand 0.8.6`, `thiserror 2.0.18`, `tokio 1.52.1`.

### Row 2 — `phenotype-rate-limiter` (628 LOC, infrakit workspace)

- **Analyzable?** ❌ **BLOCKED**.
- **Why:** `/tmp/PhenoLang/phenotype-infrakit/deny.toml:12-14` is broken (`error[missing-field]: missing field 'crate'`). `cargo deny check` from `/tmp/PhenoLang/phenotype-infrakit` exits non-zero with:
  ```text
  error[missing-field]: missing field 'crate'
     ┌─ /private/tmp/PhenoLang/phenotype-infrakit/deny.toml:12:1
     │
  12 │ ╭ [[licenses.clarify]]
  13 │ │ namespace = "rust-lang"
  14 │ │ expression = "MIT OR Apache-2.0"
     │ ╰────────────────────────────────┘ table with missing field

  2026-06-13 00:38:44 [ERROR] failed to deserialize config from '/private/tmp/PhenoLang/phenotype-infrakit/deny.toml'
  ```
- **Additional blocker:** the infrakit workspace's `Cargo.toml:12-28` lists `phenotype-analytics` as a member, but `crates/phenotype-analytics/Cargo.toml` does not exist on disk (only a `tests/` subdir is present). `cargo tree --duplicates` from this directory fails with `failed to load manifest for workspace member ... No such file or directory (os error 2)`.
- **Workaround (for port verification):** delete or rename the broken `deny.toml`, then re-run; the manifest-level error for `phenotype-analytics` will still block `cargo deny check` from completing a full workspace graph, but `cargo tree -p phenotype-rate-limiter` works. **Not performed in this baseline** (READ-ONLY constraint).
- **Expected clean output (when unblocked):** the allow-list is the same 19 licenses as the root; the infrakit workspace pulls `tokio 1.45+`, `axum 0.7`, `reqwest 0.12`, `hyper 1.0`, `jsonschema 0.17`, `lru 0.12`, `tokio-retry 0.3` (per `phenotype-infrakit/Cargo.toml:30-79`). The `lru 0.12` vs root's `lru 0.16` is a known split.

### Row 3 — `phenotype-http-client` (1,613 LOC, infrakit workspace)

- **Analyzable?** ❌ **BLOCKED** (same root cause as Row 2: broken infrakit `deny.toml` + missing `phenotype-analytics/Cargo.toml`).
- **Direct deps** (from `phenotype-infrakit/Cargo.toml:30-79` workspace deps): likely `reqwest 0.12`, `tokio 1`, `serde 1`, `serde_json 1`, `thiserror 2`, `url 2.5`, `jsonschema 0.17`, `http 1.0`, `http-body-util 0.1`. The 17× size delta vs `pheno-net` 95 LOC is structural, not just dep count.
- **Expected clean output:** same 19-license allow-list; no `GPL-3.0-only` issues expected. `reqwest 0.12` pulls `native-tls 0.2.18` which transitively brings `core-foundation 0.10.1` and `security-framework` (Apple-only); these are not in the root duplicate set but will appear in a per-crate tree.

### Row 4 — `phenotype-mock` (754 LOC, NOT in any workspace)

- **Analyzable?** 🚫 **NOT-ANALYZABLE** in current state.
- **Why:** `crates/phenotype-mock/` is on disk but is **not in the root workspace `members` list** (`/tmp/PhenoLang/Cargo.toml:12-34`). It has its own `Cargo.toml` (not verified in this baseline) but is not reachable via `cargo metadata` from the root.
- **Workaround (for port verification):** copy `crates/phenotype-mock/` into a temporary scratch dir with a hand-written `Cargo.toml` + `Cargo.lock` + `deny.toml`, then run `cargo deny check` from there. **Not performed in this baseline** (READ-ONLY + 1-2h budget).
- **Expected clean output (hypothetical):** the per-audit dependency list includes `mockall 0.12`, `proptest 1.4`, `tokio 1`, `serde 1`, `tempfile 3`. None of these are GPL-3.0; all 19 root allow-list entries suffice.

### Row 5 — `phenotype-test-fixtures` (905 LOC, NOT in any workspace)

- **Analyzable?** 🚫 **NOT-ANALYZABLE** (same root cause as Row 4).
- **HexaKit absorption note:** `HexaKit/crates/phenotype-test-fixtures/` already contains a reduced 464-LOC version. The original 905-LOC version at `/tmp/PhenoLang/crates/phenotype-test-fixtures/` is not in any active workspace.
- **Expected clean output (hypothetical):** likely `tempfile 3`, `tokio 1`, `serde_json 1`, `http-body-util 0.1`, `wiremock 0.6`, `fake 3.0`, `proptest 1.4`. No license or advisory concerns expected at this scale.

### Row 6 — `phenotype-testing` (1,063 LOC, NOT in any workspace)

- **Analyzable?** 🚫 **NOT-ANALYZABLE** (same root cause as Row 4).
- **Recommended port:** a *consolidated* delivery merging Rows 4 + 5 + 6 (2,722 LOC) into a single 2,700-LOC `pheno-testing` crate in `phenoUtils`. The consolidated crate would be analyzable in the `phenoUtils` workspace post-port.
- **Expected clean output (hypothetical):** union of Rows 4 + 5 dep lists plus `criterion 0.5` (for benchmarks).

### Row 7 — `omniroute-core` (4,365 LOC across root + nested duplicates)

- **Analyzable (nested 3,110-LOC version):** ✅ **RUNNABLE** (in root workspace, `Cargo.toml:33`).
- **Analyzable (root 1,255-LOC orphan):** 🚫 **NOT-ANALYZABLE** — `/tmp/PhenoLang/omniroute-core/` exists at the repo root with its own `Cargo.toml` + `crates/` subdir but is **not in any workspace's `members` list**. This is one of the two duplicate source trees to be resolved first.
- **Direct deps of the analyzable nested version** (`cargo tree -p omniroute-core --depth 1`):
  ```text
  omniroute-core v0.1.0 (/private/tmp/PhenoLang/crates/omniroute-core)
  ├── anyhow v1.0.102
  ├── async-stream v0.3.6
  ├── async-trait v0.1.89 (proc-macro)
  ├── axum v0.8.9
  ├── bytes v1.11.1
  ├── clap v4.6.1
  ├── futures v0.3.32
  ├── opentelemetry v0.26.0
  ├── opentelemetry-otlp v0.26.0
  ├── opentelemetry_sdk v0.26.0
  ├── reqwest v0.12.28
  ├── serde v1.0.228
  ├── serde_json v1.0.149
  ├── thiserror v1.0.69     ← NOT 2.x (creates a `thiserror` duplicate with the rest of the workspace)
  ├── tokio v1.52.1
  ├── tokio-stream v0.1.18
  ├── tower v0.5.3
  ├── tower-http v0.6.8
  ├── tracing v0.1.44
  ├── tracing-opentelemetry v0.26.0
  └── tracing-subscriber v0.3.23
  [dev-dependencies]
  ├── mockito v1.7.2
  └── tokio-test v0.4.5
  ```
- **Per-crate duplicates** (`cargo tree -p omniroute-core -d`): this single crate contributes to **7 of the 9** workspace-level duplicates: `core-foundation`, `getrandom`, `opentelemetry`, `opentelemetry_sdk`, `rand`, `rand_chacha`, `rand_core`, `thiserror`. The `thiserror 1.0.69` is the *root cause* of the workspace `thiserror 1.0.69` / `2.0.18` split.
- **Per-crate expected warnings:** the nested `omniroute-core` is the biggest single contributor to the duplicate set. Bumping it to `thiserror 2.0.18` would resolve the `thiserror`/`thiserror-impl` duplicate pair and shrink the `opentelemetry` 0.25→0.26 split (since `tracing-opentelemetry 0.26.0` pulls `opentelemetry 0.25.0` transitively).

### Row 8 — `phenotype-bdd` (infrakit version, 1,672 LOC)

- **Analyzable?** ❌ **BLOCKED** (same root cause as Rows 2-3: broken infrakit `deny.toml` + missing `phenotype-analytics/Cargo.toml`).
- **HexaKit already absorbed** a smaller 682-LOC `phenotype-bdd`. The 1,672-LOC PhenoLang infrakit version would be a 2.7× size delta if merged into `agileplus-trace-validator` (the recommended target).
- **Expected clean output (hypothetical):** BDD frameworks typically pull `tokio 1`, `serde 1`, `serde_yaml 0.9`, `clap 4`, `tracing 0.1`, `wiremock 0.6`. No license concerns at this scale.

### Row 9 — `phenotype-cost-core` (740 LOC, NOT in any workspace)

- **Analyzable?** 🚫 **NOT-ANALYZABLE** (same root cause as Row 4).
- **HexaKit already absorbed** a 752-LOC copy (verified `HexaKit/crates/phenotype-cost-core/Cargo.toml` in `Cargo.toml:34` members list). The PhenoLang version at `/tmp/PhenoLang/crates/phenotype-cost-core/` is not in any active workspace.
- **Language-mismatch flag:** the natural Python target `pheno-cost-card/` cannot host a Rust port. The 3-way decision (skip / HexaKit / new crate) is the open question for the port.
- **Expected clean output (hypothetical):** likely `serde 1`, `serde_json 1`, `rust_decimal 1` (or `bigdecimal`), `chrono 0.4`, `tokio 1`. No license concerns.

### Row 10 — `phenotype-router-monitor` (268 LOC, own workspace)

- **Analyzable?** ❌ **BLOCKED**.
- **Why:** `/tmp/PhenoLang/phenotype-router-monitor/deny.toml:12-14` is broken with the same `error[missing-field]: missing field 'crate'` error as infrakit. The crate declares its own workspace (`Cargo.toml:18` has `[workspace]`), so the root check does not cover it. The router-monitor `Cargo.lock` is present and valid.
- **Direct deps** (`phenotype-router-monitor/Cargo.toml:8-16`):
  ```text
  serde 1 + serde_json 1
  tokio 1 (full)
  thiserror 2
  async-trait 0.1
  reqwest 0.12 (json + rustls-tls, no default features)
  url 2
  chrono 0.4 (serde)
  ```
- **Workaround (for port verification):** delete the broken `[[licenses.clarify]]` block (lines 12-14 of `deny.toml`), then `cargo deny check` from `/tmp/PhenoLang/phenotype-router-monitor` will run.
- **Expected clean output (when unblocked):** no duplicates (`cargo tree --duplicates` from this dir returns "nothing to print" — the only reachable dep tree is small). License: `reqwest 0.12` with `rustls-tls` and `default-features = false` pulls `rustls 0.23` (Apache-2.0), `aws-lc-rs` (ISC/Apache-2.0), `ring` (ISC/Apache-2.0/BSD-3-Clause-Clear/OpenSSL) — all covered by the 19-license allow-list. No `GPL-3.0-only` issues expected.

### 4.1 Summary table — per-port-candidate analyzability

| # | Crate | LOC | Workspace | Analyzable today? | Why |
|---:|---|---:|---|---|---|
| 1 | `phenotype-retry` | 1,656 | root | ✅ RUNNABLE | root workspace member, valid `deny.toml` |
| 2 | `phenotype-rate-limiter` | 628 | infrakit | ❌ BLOCKED | broken infrakit `deny.toml` + missing `phenotype-analytics/Cargo.toml` |
| 3 | `phenotype-http-client` | 1,613 | infrakit | ❌ BLOCKED | same as #2 |
| 4 | `phenotype-mock` | 754 | none | 🚫 NOT-ANALYZABLE | not in any workspace `members` list |
| 5 | `phenotype-test-fixtures` | 905 | none | 🚫 NOT-ANALYZABLE | not in any workspace `members` list |
| 6 | `phenotype-testing` | 1,063 | none | 🚫 NOT-ANALYZABLE | not in any workspace `members` list |
| 7 | `omniroute-core` (nested) | 3,110 | root | ✅ RUNNABLE | root workspace member, valid `deny.toml`; the root orphan (1,255 LOC) is 🚫 NOT-ANALYZABLE |
| 8 | `phenotype-bdd` (infrakit) | 1,672 | infrakit | ❌ BLOCKED | same as #2 |
| 9 | `phenotype-cost-core` | 740 | none | 🚫 NOT-ANALYZABLE | not in any workspace `members` list |
| 10 | `phenotype-router-monitor` | 268 | own | ❌ BLOCKED | broken router-monitor `deny.toml` |

**Roll-up:** 2 RUNNABLE (rows 1, 7 nested) + 4 BLOCKED (rows 2, 3, 8, 10) + 4 NOT-ANALYZABLE (rows 4, 5, 6, 9) + 1 partial duplicate (row 7 root, 🚫) = 10 of 10 candidates captured. **6 of 10 (60%) cannot be checked by `cargo deny check` in the current state** — this is itself a major port-time hygiene finding.

---

## 5. `cargo tree --duplicates` — root workspace (`/tmp/PhenoLang`)

`cargo tree --duplicates --workspace` was run on the root workspace. The output is summarized below (9 crates with multiple versions):

| Crate | Versions | Pulled in by | Reachable from port candidates |
|---|---:|---|---|
| `core-foundation` | 0.9.4, 0.10.1 | `system-configuration 0.7.0` → `hyper-util 0.1.20`; `security-framework 3.7.0` → `native-tls 0.2.18` | omniroute-core (Row 7 nested), via `reqwest 0.12.28` |
| `getrandom` | 0.2.17, 0.3.4, 0.4.2 | `rand_core 0.6.4` (rand 0.8), `rand_core 0.9.5` (rand 0.9 + r-efi 5), `tempfile 3.27` + `uuid 1.23` (r-efi 6) | phenotype-retry (Row 1, via rand 0.8.6), omniroute-core (Row 7 nested, via rand 0.8/0.9) |
| `hashbrown` | 0.14.5, 0.16.1, 0.17.0 | `dashmap 5.5.3`, `lru 0.16.4`, `indexmap 2.14.0` | (none of the 10 port candidates directly pull these, but `phenotype-policy-engine` is the only consumer) |
| `opentelemetry` | 0.25.0, 0.26.0 | `tracing-opentelemetry 0.26.0`, `opentelemetry-otlp 0.26.0` | omniroute-core (Row 7 nested) pulls `opentelemetry 0.26.0` directly; `0.25.0` comes in via `tracing-opentelemetry 0.26.0` |
| `opentelemetry_sdk` | 0.25.0, 0.26.0 | mirrors `opentelemetry` | omniroute-core (Row 7 nested) |
| `r-efi` | 5.3.0, 6.0.0 | `getrandom 0.3.4` (build-only), `getrandom 0.4.2` (build-only) | (transitive only, not directly in any of the 10 candidates' dep list) |
| `thiserror` | 1.0.69, 2.0.18 | `omniroute-core` + `opentelemetry` 0.25/0.26 stack pull **1.0.69**; 18 of 20 root members pull **2.0.18** | phenotype-retry (Row 1, 2.0.18); omniroute-core (Row 7 nested, 1.0.69) — **direct contributor to the duplicate** |
| `thiserror-impl` | 1.0.69, 2.0.18 | proc-macro mirror of `thiserror` | same as `thiserror` |
| `wit-bindgen` | 0.51.0, 0.57.1 | `wasip3 0.4.0`, `wasip2 1.0.3` | (transitive via `getrandom 0.3.4/0.4.2` → `uuid` / `tempfile`; not in the 10 candidates' direct deps) |

**For per-crate duplicates (the 2 RUNNABLE rows):**

- **`phenotype-retry` (Row 1)** — `cargo tree -p phenotype-retry -d` returns `warning: nothing to print.` The crate's subgraph pulls `rand 0.8.6` (single version) and `thiserror 2.0.18` (single version). It is *not* a contributor to the workspace-level duplicates; the duplicates only appear when the full 20-member workspace is resolved.
- **`omniroute-core` (Row 7 nested)** — `cargo tree -p omniroute-core -d` shows 8 of the 9 workspace duplicates within the omniroute-core subgraph (everything except `hashbrown`, which is reachable from `phenotype-policy-engine` and `phenotype-cache-adapter` only). **Bumping `omniroute-core` from `thiserror 1.0.69` to `2.0.18` would resolve 2 of the 9 duplicate pairs** (`thiserror` and `thiserror-impl`).

**Other workspaces:**

- **`phenotype-infrakit`** — `cargo tree --duplicates` fails with `failed to load manifest for workspace member ... crates/phenotype-analytics ... No such file or directory (os error 2)`. Workspace is doubly broken.
- **`phenotype-router-monitor`** — `cargo tree --duplicates` returns `warning: nothing to print.` No duplicates in this small (164-dep) lockfile.

---

## 6. `cargo audit` — security advisories

```text
$ cd /tmp/PhenoLang && cargo audit --no-fetch --json
{
  "database": {"advisory-count": 1130, "last-commit": null, "last-updated": null},
  "lockfile": {"dependency-count": 316},
  "settings": {
    "target_arch": [], "target_os": [],
    "severity": null,
    "ignore": ["RUSTSEC-2025-0140", "RUSTSEC-2026-0049"],
    "informational_warnings": ["unmaintained", "unsound", "notice"]
  },
  "vulnerabilities": {"found": false, "count": 0, "list": []},
  "warnings": {}
}
```

**Baseline: 0 vulnerabilities / 316 crate dependencies scanned / 2 ignored advisories** at the root.

The 2 ignored advisories come from `/tmp/PhenoLang/.cargo/audit.toml:1-4`:

```text
[advisories]
ignore = [
    "RUSTSEC-2025-0140",
    "RUSTSEC-2026-0049",
]
```

| Advisory | Crate | Status |
|---|---|---|
| `RUSTSEC-2025-0140` | `time` (non-utf8 `TimeBuf::as_str`) | ignored, "low impact" per `rust/deny.toml:8` |
| `RUSTSEC-2026-0049` | `rustls-webpki` (CRL distribution point matching) | ignored, "low impact" per `rust/deny.toml:9` |

> **Note on the root `deny.toml`:** the root config (`/tmp/PhenoLang/deny.toml:28-34`) has 4 commented-out ignore entries for `RUSTSEC-2025-0134`, `RUSTSEC-2026-0049`, `RUSTSEC-2026-0002`, and `RUSTSEC-2025-0140`. These are NOT active for `cargo deny check`, but the `.cargo/audit.toml` file is read by `cargo audit` and **does** suppress the 2 active ones. The root `deny.toml` does not ignore any advisories on its own.

**Other workspaces:**

| Workspace | Lock file | Deps scanned | Vulnerabilities | Ignored | Notes |
|---|---|---:|---:|---|---|
| `/tmp/PhenoLang` (root) | exists, valid | **316** | **0** | 2 | baseline |
| `/tmp/PhenoLang/phenotype-infrakit` | **does not exist** on disk | n/a | n/a | n/a | workspace is doubly broken (deny.toml + missing analytics Cargo.toml) |
| `/tmp/PhenoLang/phenotype-router-monitor` | exists, valid | 164 | 0 | 0 | clean baseline; 0 advisories ignored |

The infrakit workspace cannot be audited by `cargo audit` because there is no `Cargo.lock` to scan (a fresh `cargo generate-lockfile` would fail due to the missing `phenotype-analytics` manifest).

---

## 7. Roll-up — what the baseline says, and how to compare post-port

### 7.1 Current state (as of 2026-06-12 capture)

- `cargo-deny 0.19.0` and `cargo-audit 0.22.1` are installed (re-verified present on 2026-06-14).
- Root `cargo deny check` passes with **19 warnings** (10 license-not-encountered + 9 duplicate).
- Root `cargo audit` shows **0 vulnerabilities** across 316 deps (2 advisories ignored via `.cargo/audit.toml`).
- 9 unique crates have multiple versions in the root lockfile.
- 2 of 10 port candidates are analyzable in the current state; 4 are in a doubly-broken infrakit/router-monitor config; 4 are not in any workspace at all.
- 2 of 5 in-scope `deny.toml` files (infrakit, router-monitor) have invalid `licenses.clarify` entries that fail to parse in `cargo-deny 0.19.0`.

### 7.2 Post-port comparison deltas to expect

When the 10 `arc-4-01..10 / PL-ports` work packages complete (target repos: `phenoUtils`, `HexaKit`, `AgilePlus`, `pheno-cost-card`, `OmniRoute`, plus 4 new repos/crates), re-run the same commands and compare:

| Delta | Expected change | Why |
|---|---|---|
| Root workspace member count | May **decrease** as crates are ported out | Rows 1, 7 nested are removed from `/tmp/PhenoLang/Cargo.toml:12-34` |
| Duplicate crate count (currently 9) | Should **decrease** | `phenotype-retry` (thiserror 2.0.18) removal does not help; `omniroute-core` (thiserror 1.0.69) removal helps 2 pairs |
| `license-not-encountered` count (currently 10) | Will likely **shift** rather than decrease | The 19-license allow-list is permissive; once `GPL-3.0-only`, `MPL-2.0`, `WTFPL` etc. are confirmed unused in the post-port target repos, those entries can be pruned (cleaner config, fewer warnings) |
| Vulnerability count (currently 0) | Should remain 0 | The 2 ignored advisories (`RUSTSEC-2025-0140`, `RUSTSEC-2026-0049`) are both transitive / low-impact; new ports are unlikely to introduce new vulns |
| Analyzability of port targets | All 10 candidates should become ✅ **RUNNABLE** in their target workspaces (`phenoUtils`, `HexaKit`, `AgilePlus`, etc.) | This is the *primary success metric* for the port arc |
| Infrakit + router-monitor `deny.toml` validity | Will be **moot** post-port (both are out of scope) | If the port leaves these workspaces behind, fix the `licenses.clarify` blocks as a hygiene side-task |

### 7.3 Suggested re-baseline command sequence (for the post-port verification task)

```bash
# 1. Per target repo
for repo in phenoUtils HexaKit AgilePlus; do
  echo "=== $repo ==="
  (cd "/Users/kooshapari/CodeProjects/Phenotype/repos/$repo" \
    && cargo deny --version \
    && cargo deny check 2>&1 | tail -20 \
    && cargo tree --duplicates --workspace 2>&1 | head -50 \
    && cargo audit --no-fetch --json 2>&1 | tail -1)
done

# 2. For the 4 new repos/crates (if/when created)
for repo in pheno-errors pheno-tracing pheno-retry omniroute-rs; do
  if [ -d "/Users/kooshapari/CodeProjects/Phenotype/repos/$repo" ]; then
    echo "=== $repo ==="
    (cd "/Users/kooshapari/CodeProjects/Phenotype/repos/$repo" \
      && cargo deny check 2>&1 | tail -20 \
      && cargo audit --no-fetch --json 2>&1 | tail -1)
  fi
done
```

---

## 8. File-state provenance (2026-06-14 verification)

| Artifact | State at 2026-06-12 capture | State at 2026-06-14 verification |
|---|---|---|
| `/tmp/PhenoLang/` source tree | present (4.6 MB, 285 subdirs, 506-line `cargo deny` log) | **REMOVED** (automated cleanup) |
| `/tmp/PhenoLang/deny.toml` (root) | parsed by `cargo deny 0.19.0`, exit 0 | n/a — source tree gone |
| `/tmp/PhenoLang/.cargo/audit.toml` | 2 active ignore entries (`RUSTSEC-2025-0140`, `RUSTSEC-2026-0049`) | n/a — source tree gone |
| `/tmp/PhenoLang/Cargo.toml` (root) | 20 workspace members, `resolver = "2"` | n/a — source tree gone |
| `/tmp/PhenoLang/phenotype-infrakit/Cargo.toml` | 15 workspace members; `phenotype-analytics` listed but missing Cargo.toml | n/a — source tree gone |
| `/tmp/PhenoLang/phenotype-router-monitor/Cargo.toml` | own-workspace single crate, 8 direct deps | n/a — source tree gone |
| `/tmp/PhenoLang/phenotype-infrakit/deny.toml` | broken `licenses.clarify` (missing `crate` field) | n/a — source tree gone |
| `/tmp/PhenoLang/phenotype-router-monitor/deny.toml` | broken `licenses.clarify` (missing `crate` field) | n/a — source tree gone |
| `/tmp/PhenoLang/rust/deny.toml` | 13-license subset, 3 active advisories, valid | n/a — source tree gone |
| `/tmp/PhenoLang/agileplus-agents/deny.toml` | broken `licenses.clarify` (out of port scope) | n/a — source tree gone |
| `/tmp/cargo-deny-root.log` | saved (506 lines, 19 warnings, exit 0) | **REMOVED** (file system cleanup) |
| `/tmp/PhenoLang/Cargo.lock` | 316 deps, 0 vulns, 9 duplicate crates | n/a — source tree gone |
| `cargo-deny` 0.19.0 (tool) | installed | **still installed** (re-verified 2026-06-14) |
| `cargo-audit` 0.22.1 (tool) | installed | **still installed** (re-verified 2026-06-14) |
| `archived-repos/PL-CARGO-DENY-BASELINE.md` | first write 2026-06-12 17:57 (31,665 B) | first recreation 2026-06-12 21:10 (31,266 B) — second recreation 2026-06-14 23:14 (this file) |

> **Important disambiguation:** `/tmp/w1-18-deny-phenotype.log` (1.3 MB, dated 2026-06-14 17:28) is a `cargo deny check` run against the **meta-repo at `/Users/kooshapari/CodeProjects/Phenotype/repos/`** (134 warnings, `deny.toml:35` references). It is a separate, unrelated workspace and is NOT a continuation of the PhenoLang baseline captured here. Do not conflate the two.

---

## 9. References (file:line)

- Root `Cargo.toml` workspace members (capture-time, source now removed): `/tmp/PhenoLang/Cargo.toml:12-34`
- Root `deny.toml` (capture-time): `/tmp/PhenoLang/deny.toml:1-35`
- Root `audit.toml` (capture-time): `/tmp/PhenoLang/.cargo/audit.toml:1-4`
- Infrakit `Cargo.toml` workspace members (capture-time): `/tmp/PhenoLang/phenotype-infrakit/Cargo.toml:12-28`
- Infrakit `deny.toml` (capture-time, broken): `/tmp/PhenoLang/phenotype-infrakit/deny.toml:12-14`
- Infrakit `phenotype-analytics` (capture-time, missing Cargo.toml): `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-analytics/`
- Router-monitor `deny.toml` (capture-time, broken): `/tmp/PhenoLang/phenotype-router-monitor/deny.toml:12-14`
- Router-monitor `Cargo.toml` (capture-time, own workspace): `/tmp/PhenoLang/phenotype-router-monitor/Cargo.toml:18`
- `rust/deny.toml` (capture-time, more restrictive, out of port scope): `/tmp/PhenoLang/rust/deny.toml:1-36`
- Full cargo deny log (capture-time, now removed): `/tmp/cargo-deny-root.log` (506 lines, 19 warnings, exit 0)

---

**End of PL-CARGO-DENY-BASELINE.md.** Read-only capture; no porting, no installs, no source modifications. 2 of 10 candidates analyzable in the current state; 8 of 10 will become analyzable post-port in their target repos. This is the **third write** of the deliverable (after the source tree and prior deliverable were externally removed between sessions).
