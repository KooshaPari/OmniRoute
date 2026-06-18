# HC-02 BUILD-VERIFY — HeliosCLI `Build from Source` Instructions

**Task:** arc-1-12 / HC-02 BUILD-VERIFY
**Repo:** `/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI`
**Date:** 2026-06-14
**Scope:** README.md lines 95-123 (`### Building from Source` section)
**Mode:** READ-ONLY — no `cargo build` executed.

---

## 1. Required File Existence (Task Deliverable)

| File | Status |
| --- | --- |
| `codex-rs/Cargo.toml` | **EXISTS** (`/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/codex-rs/Cargo.toml`, 10831 bytes, 385 lines) |
| `codex-cli/package.json` | **EXISTS** (`/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/codex-cli/package.json`, 573 bytes, 25 lines) |
| `justfile` | **EXISTS** (`/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/justfile`, 3724 bytes, 130 lines) |
| `deny.toml` | **EXISTS** (`/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/deny.toml`, 518 bytes, 30 lines) |
| `rust-toolchain.toml` | **EXISTS** (`/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosCLI/rust-toolchain.toml`, 86 bytes, 4 lines) |

All five required files are present. **No MISSING or AMBIGUOUS entries for the deliverable file list.**

---

## 2. Per-Command Verification — `Build from Source` (README lines 95-123)

| # | Line | Command (excerpt) | Status | Evidence |
| --- | --- | --- | --- | --- |
| 1 | 99 | `git clone https://github.com/KooshaPari/helios-cli.git heliosCLI` | **EXISTS** | External URL; repo identity consistent with badge URL in README line 10 (`KooshaPari/heliosCLI`) and fork lineage described in line 16. |
| 2 | 100 | `cd heliosCLI` | **EXISTS** | Shell builtin; no file required. |
| 3 | 103 | `git remote add upstream https://github.com/openai/codex.git` | **EXISTS** | Local `git remote -v` confirms `upstream` is exactly `https://github.com/openai/codex.git`. README claim matches actual remote configuration. |
| 4 | 106 | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh -s -- -y` | **EXISTS** | External (rust-lang.rs); no local file dependency. |
| 5 | 107 | `source "$HOME/.cargo/env"` | **EXISTS** | Standard rustup post-install path. |
| 6 | 108 | `rustup component add rustfmt` | **EXISTS** | `rust-toolchain.toml:3` lists `components = ["rustfmt", "clippy"]`. |
| 7 | 109 | `rustup component add clippy` | **EXISTS** | Same as above — `clippy` is in the toolchain components. |
| 8 | 112 | `cargo install just` | **EXISTS** | `justfile` present at repo root (130 lines); `just` is the documented task runner. |
| 9 | 113 | `cargo install --locked cargo-nextest` | **EXISTS** | Marked `# optional`; not a file dependency. Also referenced in `justfile:46-47` via `cargo nextest run --no-fail-fast`. |
| 10 | 116-117 | `cd codex-rs` then `cargo build` | **EXISTS** | `codex-rs/` directory exists; `codex-rs/Cargo.toml` is a valid `[workspace]` declaration (385 lines, edition 2024). |
| 11 | 120-121 | `cd ../codex-cli` then `npm install` | **AMBIGUOUS / DRIFT** | `codex-cli/package.json` exists BUT declares `packageManager: "pnpm@10.29.3+sha512..."` (line 21). Using `npm install` violates the Corepack-pinned package manager. **`pnpm install` is the correct invocation.** |
| 12 | 122 | `npm run build` | **MISSING** | `codex-cli/package.json` has **no `scripts` field** (verified via JSON parse). `npm run build` will fail with `npm error Missing script: "build"`. The repo ships pre-built artifacts via the `bin/codex.js` launcher; there is no JS compile step in `package.json`. |

### Per-command summary
- **EXISTS:** 10 of 12 commands
- **AMBIGUOUS:** 1 (command 11 — wrong package manager)
- **MISSING:** 1 (command 12 — `build` script absent)

---

## 3. MSRV / Edition Drift Check

### 3.1 `rust-toolchain.toml` contents (verbatim, 4 lines)

```toml
[toolchain]
channel = "stable"
components = ["rustfmt", "clippy"]
profile = "minimal"
```

**No version pin. No `channel = "1.XX"` entry. No MSRV field.**

### 3.2 README claim at line 2 (top-of-README pinned references)

> `MSRV: see rust-toolchain.toml`

**Status: DRIFT.** The README at line 2 implies that `rust-toolchain.toml` contains the authoritative MSRV, but the file only pins `channel = "stable"`. A user following the README cannot extract an MSRV number from `rust-toolchain.toml`. The actual MSRVs (defined in workspace `Cargo.toml` files, not the toolchain file) are:
- `codex-rs/Cargo.toml` — no `rust-version` set; `edition = "2024"` implies MSRV ≥ 1.85 (Rust 1.85.0 stabilised edition 2024 on 2025-02-20).
- Top-level `Cargo.toml` (the "harness" workspace) — `rust-version = "1.75"` (line 4).

### 3.3 README claim at lines 91-92 (System Requirements table)

> | Rust | Edition 2024 (codex-rs workspace), Edition 2021 (harness workspace) |

| Sub-claim | Actual file state | Match |
| --- | --- | --- |
| `codex-rs` workspace uses Edition 2024 | `codex-rs/Cargo.toml` — `edition = "2024"` (confirmed via grep; comment: `# Track the edition for all workspace crates in one place.`) | **MATCH** |
| `harness` workspace uses Edition 2021 | Top-level `Cargo.toml` (the harness workspace; members: `crates/harness_queue`, `crates/harness_rollback`, `crates/harness_runner`, `crates/harness_scaling`, `crates/harness_schema`, `crates/harness_spec`, `crates/harness_teammates`, `crates/harness_utils`, `crates/harness_verify`) — no `edition` set in `[workspace.package]`; sample crate `crates/harness_queue/Cargo.toml` explicitly has `edition = "2021"`. Default inheritance → 2021. | **MATCH (implicit)** |

**No edition drift.** Both edition claims hold.

### 3.4 MSRV drift summary

| Source | Pinned? | Value |
| --- | --- | --- |
| `rust-toolchain.toml` | Channel only | `stable` (no version) |
| `codex-rs/Cargo.toml` | No `rust-version` field | Inferred ≥ 1.85 from edition 2024 |
| Top-level `Cargo.toml` (harness) | Yes | `rust-version = "1.75"` |
| README line 2 claim | Implies pin exists | "see rust-toolchain.toml" — file does not pin a version |
| README line 91 claim | Edition only (no version) | n/a |

---

## 4. All Drift Items (README Claim vs. Actual File State)

| # | README location | Claim | Actual | Severity |
| --- | --- | --- | --- | --- |
| D-1 | Line 2 | "MSRV: see rust-toolchain.toml" | `rust-toolchain.toml` pins `channel = "stable"` only — no MSRV number present | **High** (misleads a reader about authoritative MSRV location) |
| D-2 | Line 121 | `npm install` | `packageManager` field in `codex-cli/package.json` pins `pnpm@10.29.3`; Corepack enforcement will reject npm | **Medium** (build will fail or warn on modern Node toolchains) |
| D-3 | Line 122 | `npm run build` | `codex-cli/package.json` has no `scripts` field — command will fail with `Missing script: "build"` | **High** (command is impossible to execute as written) |
| D-4 | Line 112 | `cargo install just` | `justfile` exists; no drift. **However** `cargo install just` installs from crates.io; if the project requires a pinned version of `just`, the README should specify. Current `justfile` line 1 uses `set working-directory := "codex-rs"` — no version constraint. | Low (informational) |
| D-5 | Line 91 | "Edition 2021 (harness workspace)" | No explicit `edition` in top-level `[workspace.package]`; default 2021 applies. | Low (implicit match) |
| D-6 | Local `git remote` (not README) | n/a | `origin` points to `git@github.com:KooshaPari/helioscope.git` not `helios-cli` — local config drift, not README drift. | None (out of scope) |

---

## 5. Recommendations

1. **Replace `npm install` / `npm run build` (README lines 121-122)** with:
   ```bash
   pnpm install
   # No `build` step is available; the package.json ships pre-built artifacts via bin/codex.js.
   ```
   Or remove lines 121-122 entirely if no JS build step is required.

2. **Fix the MSRV pointer (README line 2).** Either:
   - Update `rust-toolchain.toml` to pin a concrete version (e.g., `channel = "1.85.0"`), OR
   - Rephrase README line 2 to: `MSRV: codex-rs ≥ 1.85 (edition 2024); harness = 1.75 (see Cargo.toml)`

3. **Document the missing `build` script explicitly** if the JS workspace is intentionally build-free, so future contributors do not assume `npm run build` is a valid step.

---

## 6. Verdict

- **5 of 5** required files (deliverable list) exist: **PASS**
- **10 of 12** Build-from-Source commands resolve to existing artifacts: **PASS with caveats**
- **1 of 12** commands will execute as written (`npm run build`): **FAIL — script missing**
- **1 of 12** commands uses wrong package manager (`npm` vs `pnpm`): **FAIL on Corepack-enforced toolchains**
- **Edition claims (line 91):** **MATCH** (no drift)
- **MSRV pointer (line 2):** **DRIFT** (file does not contain a pinned version)

**Overall:** README is mostly internally consistent, but has two blocking build commands (D-2, D-3) and one misleading cross-reference (D-1). Recommend a follow-up patch to the README before the next release.
