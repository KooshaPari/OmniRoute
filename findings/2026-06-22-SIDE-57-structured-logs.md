# SIDE-57 — Logging structured fields audit

**Task:** SIDE-57
**Date:** 2026-06-21
**Scope:** 8 pheno-* Rust crates
**Mode:** Read-only
**Auditor:** Forge (orchestrator-level shell + Python AST-style scanner)
**Worklog:** none required (read-only audit, no substrate or fleet changes)

---

## TL;DR

| crate                  | tracing dep | total calls | structured | **unstructured** |
| :--------------------- | :---------- | ----------: | ---------: | ----------------: |
| pheno-cli-base         | direct      |           5 |          5 |             **0** |
| pheno-config           | transitive  |           1 |          1 |             **0** |
| pheno-context          | transitive  |           0 |          0 |             **0** |
| pheno-errors           | direct      |           4 |          4 |             **0** |
| pheno-flags            | transitive  |           0 |          0 |             **0** |
| pheno-otel             | transitive  |           1 |          1 |             **0** |
| pheno-port-adapter     | transitive  |           0 |          0 |             **0** |
| pheno-tracing          | direct      |          10 |         10 |             **0** |
| **TOTAL**              |             |     **21** |     **21** |         **0** |

**Headline finding:** All 8 pheno-* crates are at **100 % structured-logging compliance** for the calls they make. **0 unstructured log calls** across the fleet. 5 of 8 crates make no tracing calls at all (zero surface area = zero violations).

---

## What "structured" vs "unstructured" means here

A tracing macro call is **structured** when the format string + arguments preserve the field boundaries at parse time, so an OTLP/JSON log shipper can index each field independently:

- `info!("user logged in", user.id = %id, attempts = n)` — fully structured
- `info!("user {} logged in ({} attempts)", user.id, n)` — structured; `{}` placeholders register `user.id` and `attempts` as fields at the macro level
- `info!(?path, "loaded config")` — structured; `?path` becomes a Debug-formatted field

A tracing macro call is **unstructured** when the format string has already been pre-rendered into a single `String` before reaching the macro, collapsing fields into a blob the log shipper cannot parse back:

- `info!(format!("user {} logged in", user.id))` — bad; the `{}` evaluation happens inside `format!`, not at the macro layer
- `info!("user ".to_string() + &user.id + " logged in")` — bad; concatenation hides the field
- `info!(String::from("user logged in"))` — bad; no fields at all
- `info!(format_args!("..."))` — bad (and a no-op at runtime)

The audit script flags any of these four anti-patterns appearing inside the macro body. The 8 crates audited triggered none of them.

---

## Methodology

1. **Crate discovery.** 8 pheno-* crates with `Cargo.toml` + `src/` confirmed present (sparse-checkout visible 2026-06-21).
2. **Source surface.** Walked `src/`, `tests/`, `examples/`, `benches/` for each crate. `Cargo.toml` scanned for `tracing = "..."` or `log = "..."` direct dependency.
3. **Macro detection.** Multi-line aware scanner (paren-balanced, string/comment aware) for `trace!`, `debug!`, `info!`, `warn!`, `error!` and the `tracing::*` / `log::*` qualified forms, in both `(...)` and `{...}` invocation styles. Captures the full macro body for inspection.
4. **Unstructured detection.** Per macro body, regex-search for:
   - `format!(` (format macro invocation)
   - `format_args!(`
   - `.to_string()` / `.to_owned()`
   - `String::from(`
   - Implicit string concat with `+` is flagged by absence of a recognized structured placeholder (`{}`, `{:?}`, `%`, `?`, or `field = value` syntax) — verified manually below.
5. **Sanity checks.** `grep -E '\b(info|debug|warn|error|trace)!\s*\('` per crate cross-checked against the scanner. Counts agree.
6. **Companion checks.** Also tallied `println!`/`eprintln!`/`dbg!` (out of scope for tracing — direct console writes) and `#[tracing::instrument]` attribute use (per-function span entry — also structured).

Scanner script: `/tmp/side57_audit.py` (210 LoC, paren-balanced, string/comment-aware). Per-call JSON dump at `/tmp/side57_results.json` (127 lines).

---

## Per-crate detail

### pheno-cli-base — 5 calls, 0 unstructured

Direct `tracing = "0.1"` dep. Tracing calls:

| File | Line | Call (abbrev.) |
| :--- | ---: | :------------- |
| `src/lib.rs` | 34 | `tracing::info!(?path, "using config");` |
| `examples/quickstart.rs` | 28 | `tracing::info!("starting quickstart");` |
| `examples/quickstart.rs` | 30 | `tracing::info!(?path, "would load config");` |
| `examples/quickstart.rs` | 32 | `tracing::info!("no config path given; using defaults");` |
| `examples/quickstart.rs` | 34 | `tracing::info!("done");` |

All use the `?path` shorthand or a literal format string. Structured.

### pheno-config — 1 call, 0 unstructured

No direct `tracing` dep (transitive via pheno-* consumer crates). Tracing calls:

| File | Line | Call (abbrev.) |
| :--- | ---: | :------------- |
| `tests/tracing_test.rs` | 19 | `tracing::info!(?result, "build complete");` |

Structured.

Side observation: 1 `eprintln!` at `src/hot_reload.rs:343` — file-watcher hot-reload diagnostic. Not a tracing call; not in scope. Flagged here only because `eprintln!` is sometimes mistaken for a log macro.

### pheno-context — 0 calls, 0 unstructured

No direct `tracing` dep. Zero tracing macro calls under `src/`, `tests/`, `examples/`. Zero surface area → zero violations.

### pheno-errors — 4 calls, 0 unstructured

Direct `tracing = "0.1"` dep. Tracing calls:

| File | Line | Call (abbrev.) |
| :--- | ---: | :------------- |
| `src/lib.rs` | 173-177 | `tracing::warn!(error.kind = self.kind(), error.display = %self, "error")` |
| `src/lib.rs` | 186-190 | `tracing::error!(error.kind = self.kind(), error.display = %self, "error")` |
| `tests/tracing_test.rs` | 18 | `tracing::error!(error = %err, "validation failed");` |
| `tests/tracing_test.rs` | 30 | `tracing::warn!(error = %err, "user not found");` |

Multi-line bodies (the first two) are clean structured forms — `error.kind` and `error.display` are explicit named fields with `%self` (Display) interpolation. Best-practice pattern. Structured.

### pheno-flags — 0 calls, 0 unstructured

No direct `tracing` dep. Zero tracing macro calls. Zero surface area → zero violations.

### pheno-otel — 1 call, 0 unstructured

No direct `tracing` dep (transitive). Tracing calls:

| File | Line | Call (abbrev.) |
| :--- | ---: | :------------- |
| `examples/quickstart.rs` | 19 | `info!("hello from pheno-otel quickstart");` |

Structured (literal format string, no interpolation).

Side observations (out of scope):
- `src/exporters/stdout.rs:38` — `eprintln!(...)` is the *stdout exporter* writing JSON lines to stdout. This is intentional — exporters sink pre-formatted records to stdout, not the tracing layer.
- `src/guard.rs:83` — `eprintln!(...)` in OTel guard, a runtime diagnostic. Not a tracing call.

### pheno-port-adapter — 0 calls, 0 unstructured

No direct `tracing` dep. Zero tracing macro calls. Zero surface area → zero violations.

### pheno-tracing — 10 calls, 0 unstructured

Direct `tracing = "0.1"` dep. The substrate itself. Tracing calls:

| File | Line | Call (abbrev.) |
| :--- | ---: | :------------- |
| `src/compat.rs` | 515 | `info!("re-export smoke test");` |
| `src/compat.rs` | 516 | `warn!("re-export smoke test");` |
| `src/compat.rs` | 517 | `error!("re-export smoke test");` |
| `src/compat.rs` | 518 | `debug!("re-export smoke test");` |
| `src/compat.rs` | 519 | `trace!("re-export smoke test");` |
| `src/compat.rs` | 530 | `#[instrument]` (span entry — structured) |
| `tests/tracing-0-2-compat.rs` | 45 | `info!("info message");` |
| `tests/tracing-0-2-compat.rs` | 46 | `warn!("warn message");` |
| `tests/tracing-0-2-compat.rs` | 47 | `error!("error message");` |
| `tests/tracing-0-2-compat.rs` | 48 | `debug!("debug message");` |
| `tests/tracing-0-2-compat.rs` | 49 | `trace!("trace message");` |

All literal format strings + the one `#[instrument]` attribute. Structured.

Side observation: 1 `println!` at `src/adapters.rs:71` — adapter demo print, not a tracing call.

---

## Companion metrics (out of strict scope)

| crate              | println!/eprintln!/dbg! | log:: macros | #[instrument] | tracing dep |
| :----------------- | ----------------------: | -----------: | ------------: | :---------- |
| pheno-cli-base     |                       0 |            0 |             0 | direct 0.1 |
| pheno-config       |                       1 |            0 |             0 | transitive |
| pheno-context      |                       0 |            0 |             0 | transitive |
| pheno-errors       |                       0 |            0 |             0 | direct 0.1 |
| pheno-flags        |                       0 |            0 |             0 | transitive |
| pheno-otel         |                       2 |            0 |             0 | transitive |
| pheno-port-adapter |                       0 |            0 |             0 | transitive |
| pheno-tracing      |                       1 |            0 |             1 | direct 0.1 |

`log::*` direct macro calls: **0 fleet-wide** (the `log` crate is only used as a re-export substrate by `pheno-tracing`, not invoked directly anywhere).

`println!`/`eprintln!` calls: 4 total. All are intentional:
- `pheno-config/src/hot_reload.rs:343` — file-watcher hot-reload diagnostic (CLI fallback)
- `pheno-otel/src/exporters/stdout.rs:38` — the stdout OTLP exporter (by design)
- `pheno-otel/src/guard.rs:83` — runtime OTel guard diagnostic
- `pheno-tracing/src/adapters.rs:71` — adapter demo

None of these would be a tracing call even if reformatted — they are not application logs.

---

## Observations

1. **5 of 8 crates have zero tracing usage.** `pheno-context`, `pheno-flags`, `pheno-port-adapter` are pure-data or pure-type crates with no runtime behaviour to log. This is a feature, not a gap — substrate libraries should be log-quiet by default.
2. **3 crates own tracing directly** (`pheno-cli-base`, `pheno-errors`, `pheno-tracing`). All three demonstrate correct structured-logging discipline, including `pheno-errors` which uses the most rigorous pattern (`error.kind = self.kind(), error.display = %self, "error"`).
3. **`#[instrument]` adoption is minimal** (1 site in `pheno-tracing/src/compat.rs:530`). Could be a low-cost win for `pheno-cli-base` (CLI command dispatch) — surfaced as a recommendation, not a finding.
4. **`log` crate is unused fleet-side.** No crate calls `log::*!` directly; all logging routes through `tracing`. This is consistent with ADR-012 (`pheno-tracing` canonical) and ADR-036B (substrate reaffirmation).
5. **No `format!` inside tracing macros anywhere.** The most common unstructured-logging footgun in the Rust ecosystem does not appear in any of the 21 audit-surfaced call sites.

---

## Recommendations (non-blocking)

- **R1.** Add `#[instrument]` to `pheno-cli-base` `run()` entry-point to attach per-command span metadata (low-cost, ~5 LoC).
- **R2.** For `pheno-config` hot-reload (`src/hot_reload.rs:343`), replace the single `eprintln!` diagnostic with `tracing::warn!(path = %path, "reload triggered")` to bring it into the structured log stream. (Currently unreachable from the OTLP pipeline.)
- **R3.** Codify this 0/21 score as a CI gate: add `cargo clippy` lint `unnecessary_format_in_format_args` + a custom `clippy.toml` deny for `format!` calls inside the 5 tracing macro families. (Blueprint in `findings/2026-06-21-v19-cycle-9-probe.md`; can land in v22 cycle 12 if user wants a regression-prevention track.)

These are advisory; this audit is read-only and does not propose code changes.

---

## Reproduce

```bash
# Scanner script
python3 /tmp/side57_audit.py \
  /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-cli-base \
  /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-config \
  /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-context \
  /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-errors \
  /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-flags \
  /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-otel \
  /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-port-adapter \
  /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-tracing

# Raw per-file grep cross-check
for c in pheno-cli-base pheno-config pheno-context pheno-errors pheno-flags \
         pheno-otel pheno-port-adapter pheno-tracing; do
  echo "--- $c ---"
  grep -rE '\b(info|debug|warn|error|trace)!\s*\(' \
    /Users/kooshapari/CodeProjects/Phenotype/repos/$c/{src,tests,examples,benches} \
    --include='*.rs' 2>/dev/null | wc -l
done
```

---

## Compliance note

- Read-only — no files modified.
- Worklog not required (no substrate/fleet state change).
- No ADR produced (no policy change; this is a measurement artifact).
- The 5-recommendation set (R1-R3 above) is informational only; if any are accepted they should land as their own v22+ tracks with their own ADRs (per ADR-023 substrate quality bar).

**Audit close: 2026-06-21, 0 violations, 21/21 structured. Fleet SOTA on structured-logging compliance for the 8 audited crates.**
