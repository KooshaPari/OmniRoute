# SIDE-42: Feature-flag documentation audit (pheno-* family)

**Date:** 2026-06-22
**Scope:** All 24 pheno-* family members per AGENTS.md (11 Rust + 13 non-Rust/meta).
**Method:** For each crate, extract `[features]` from `Cargo.toml` and grep `README.md` for the feature name, `--features`, or any "Features" / "feature-flag" section. Flag any gap.

---

## TL;DR

- **1 of 11 Rust pheno-* crates has a `[features]` section: `pheno-tracing`** (1 feature: `tracing-0-2`).
- **`pheno-tracing`'s `tracing-0-2` feature is NOT documented in `README.md`** — the README has no "Features" section at all.
- 10 other Rust pheno-* crates (pheno-chaos, pheno-cli-base, pheno-config, pheno-context, pheno-errors, pheno-events, pheno-flags, pheno-otel, pheno-port-adapter, pheno-tracing sub-crates) have **zero `[features]` flags** → no doc gap to close (vacuously compliant).
- 13 non-Rust pheno-* packages are **N/A** — no `Cargo.toml` exists (Python/Go/TS/template/meta-bundle).
- One out-of-scope crate (`phenoData/crates/pheno-query`) has 1 undocumented feature flag (`proptest`).

**Net action item:** 1 PR adding a "Features" section to `pheno-tracing/README.md` (3-line addition documenting the `tracing-0-2` forward-compat shim).

---

## Per-crate matrix

### Rust crates (11, canonical pheno-* family)

| Crate | Cargo.toml `[features]` | Features defined | README "Features" section? | Doc-gap |
|---|---|---|---|---|
| **pheno-tracing** | yes | `tracing-0-2` (1) | **No** | **YES — undocumented** |
| pheno-chaos (workspace) | no | 0 | n/a | none |
| pheno-chaos/crates/pheno-chaos | no | 0 | no README exists | none |
| pheno-chaos/crates/pheno-chaos-macros | no | 0 | no README exists | none |
| pheno-cli-base | no | 0 | no (README exists, no Features section) | none |
| pheno-config | no | 0 | no (README exists, no Features section) | none |
| pheno-context | no | 0 | no README exists | none |
| pheno-errors | no | 0 | no README exists | none |
| pheno-events | no | 0 | no README exists | none |
| pheno-flags | no | 0 | no README exists | none |
| pheno-otel | no | 0 | yes (narrative "Features" section, but it documents upstream `opentelemetry-otlp` features, not crate `[features]`) | none |
| pheno-port-adapter | no | 0 | no README exists | none |

#### pheno-tracing — detailed

`Cargo.toml` [features] section (`pheno-tracing/Cargo.toml:47-54`):

```toml
[features]
# Forward-compat shim for `tracing 0.2`. The `tracing = "0.1"` dep above is
# the current default; when 0.2 ships GA, flip the dep and enable this feature
# in CI to exercise the shim against the real 0.2 API. The feature is a no-op
# today (empty) — its purpose is to gate the forward-compat test suite at
# `tests/tracing-0-2-compat.rs` so downstream consumers aren't forced to pull
# in pre-release deps.
tracing-0-2 = []
```

`pheno-tracing/README.md` (90 lines): **No "Features" section. No mention of `tracing-0-2`, `--features`, "cargo feature", or any related keyword.**

**Gap:** consumers have no way to discover the `tracing-0-2` shim from the README. The flag exists solely to gate `tests/tracing-0-2-compat.rs` (a forward-compat test suite) and is a no-op for runtime — but a reader of the README cannot tell.

**Suggested doc addition** (3-line block to append to README.md, after "When NOT to use" and before "Architecture"):

```markdown
## Features

| Feature | Purpose |
|---|---|
| `tracing-0-2` | Forward-compat shim. No-op at runtime; gates the `tests/tracing-0-2-compat.rs` test suite so downstream consumers can opt into pre-`tracing 0.2` validation without pulling pre-release deps. Default off.
```

#### pheno-otel — note on narrative "Features" section

`pheno-otel/README.md:51-56` lists a "Features" section, but it does **not** document any crate-level `[features]` flags. It is a marketing-style description of capabilities enabled by upstream `opentelemetry-otlp` features (already declared in `[dependencies]` of `FocalPoint/pheno-otel/Cargo.toml:34-39`). Per the task's scope (crate-level `[features]` ↔ README), this is **not a doc-gap**.

### Non-Rust / meta-bundle pheno-* packages (13)

| Crate | Packaging | Cargo.toml? | N/A reason |
|---|---|---|---|
| pheno-ci-templates | README-only template | no | CI templates only |
| pheno-drift-detector | single `.py` + README | no | Python — `Cargo.toml` doesn't apply |
| pheno-fastapi-base | `pyproject.toml` | no | Python |
| pheno-framework-lint | single `.py` + README | no | Python |
| pheno-go-ctxkit | `go.mod` | no | Go |
| pheno-llms-txt | `pyproject.toml` | no | Python |
| pheno-mcp-router | meta-bundle (docs/, i18n/, pact/, PROMOTION.md) | no | Substrate lives elsewhere (see ADR-013) |
| pheno-predict | single `.py` + README | no | Python |
| pheno-pydantic-models | `pyproject.toml` | no | Python |
| pheno-scaffold-kit | `pyproject.toml` | no | Python |
| pheno-secret-scan | deny.toml + Justfile + README | no | CI/lint config (Rust-tooling-adjacent but no Rust source) |
| pheno-ssot-template | `Cargo.toml.template` + scripts | no | Template (un-instantiated `.toml.template`) |
| pheno-vibecoding-guard | `pyproject.toml` | no | Python |
| pheno-worklog-schema | `pyproject.toml` | no | Python (ADR-032 — primitive lib, not a duplicate of AgilePlus) |
| pheno-zod-schemas | `package.json` | no | TypeScript |

**All N/A.** No `[features]` to document.

---

## Out-of-scope observation (broader monorepo, FYI only)

A wider `find` across the monorepo surfaced additional `pheno-*`-prefixed Cargo.toml files outside the canonical family. The only one with an undocumented `[features]` flag is:

### `phenoData/crates/pheno-query` — out of scope

`Cargo.toml:18-19`:

```toml
[features]
proptest = ["dep:proptest"]
```

No `README.md` in `phenoData/crates/pheno-query/`. The crate is a sub-crate of the `phenoData` data-plane workspace (not part of the AGENTS.md `pheno-*` family of 24), so it is **out of SIDE-42 scope**. Flagging here for the next SIDE wave if `phenoData` is ever brought under the substrate quality bar (ADR-040).

Other phenoData sub-crates (`pheno-net`, `pheno-shell`, `pheno-testing`, `pheno-schema-port`, `pheno-fs`, `pheno-crypto`) have no `[features]`.

---

## Action plan

| # | Action | Crate | Effort | Severity |
|---|---|---|---|---|
| 1 | Add "Features" section to README documenting `tracing-0-2` (3 lines) | pheno-tracing | XS (~5 min) | P2 — discovery gap, not runtime bug |

No code changes required. The `tracing-0-2` feature is correctly declared in `pheno-tracing/Cargo.toml:54` and correctly gates `tests/tracing-0-2-compat.rs` per the in-source comment. Only the README is missing.

---

## Methodology

```bash
# For each of the 11 Rust pheno-* crates:
for c in pheno-chaos pheno-cli-base pheno-config pheno-context pheno-errors \
         pheno-events pheno-flags pheno-otel pheno-port-adapter pheno-tracing; do
  echo "=== $c ==="
  grep "^\[" "$c/Cargo.toml"
  awk '/^\[features\]/,/^\[/' "$c/Cargo.toml"   # the [features] block
  grep -i -E "feature[ -]?flag|cargo feature|--features|tracing-0-2" "$c/README.md"
done
```

Sweep scope for `[features]` sections across the broader monorepo:

```bash
find . -maxdepth 5 -name "Cargo.toml" -not -path "*/target/*" \
  | xargs grep -l "^\[features\]" 2>/dev/null
```

49 Cargo.toml files in the monorepo carry a `[features]` block; only `pheno-tracing` and the out-of-scope `phenoData/crates/pheno-query` carry the `pheno-*` prefix.

---

## Verdict

- **Compliance:** 23 / 24 crates (96 %) are vacuously compliant (no `[features]` to document OR N/A non-Rust).
- **Gap:** 1 crate (`pheno-tracing`) has an undocumented `[features]` flag.
- **Out-of-scope flag:** 1 crate (`phenoData/crates/pheno-query`) — separate audit recommended if `phenoData` joins the substrate fleet.

**Overall score:** SIDE-42 score = 1 / 24 = **4.2 % documentation gap** (1 undocumented flag out of 1 documented-or-needed).

**Recommended PR title:**

```
docs(pheno-tracing): document tracing-0-2 feature flag in README
```

Affects `pheno-tracing/README.md:43` (insert "Features" section after the "When NOT to use" block, before "Architecture").

---

**Generated:** 2026-06-22 (system date) — SIDE-42 audit, single-source-of-truth check, `device: macbook`.
**Source-of-truth references:** `findings/71-pillar-2026-06-17-schema.md` (L25/L26 doc-quality pillars), `docs/adr/2026-06-18/ADR-042-substrate-quality-bar.md` (substrate quality bar).
