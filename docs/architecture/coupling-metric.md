# L3 Coupling Metric — Phenotype fleet standard

**Pillar:** L3 (Architecture > Coupling), 71-pillar framework (ADR-024)
**Date:** 2026-06-21
**Owner:** worklog-schema circle
**Source-of-truth:** `.rust-audit.toml` at monorepo root
**Gate:** `.github/workflows/coupling.yml`
**Enforcer:** `scripts/check-coupling.sh` (wraps `cargo-modules`)

## What is L3?

The L3 pillar of the 71-pillar framework measures **efferent coupling
(Ca)** — the number of *outgoing* module-level dependencies per module.
A module with high Ca is the canonical "god module" smell: it knows too
many siblings, breaks for the wrong reasons, and resists refactoring.

L3 sits at level 3 of the Architecture domain (AX) of the 71-pillar
framework, alongside L1 (architecture overview) and L2 (module
boundary). It is the leading static indicator of substrate drift per
ADR-049 (3-pass drift detector).

## Thresholds (from `.rust-audit.toml`)

| Metric                       | Value | Rationale |
|------------------------------|-------|-----------|
| `max_coupling` (Ca)          | 5     | Highest-coupling substrate crate (pheno-config) sits at 4 in steady state. Threshold 5 admits existing code; bumping to 6 requires an ADR. |
| `max_cyclomatic_complexity`  | 15    | NIST SSDF PW.4.4 / Microsoft SDL. Functions above this have disproportionately high defect density. |
| `max_function_lines`         | 80    | Single-screen scanability. Discourages copy-paste proliferation. |
| `fail_on_warning`            | true  | Codifies ADR-023 Rule 3.1 substrate quality bar (warnings fail). |

## What "coupling" actually counts

`cargo-modules structure` measures **module-level** outgoing `use` and
extern crate dependencies within a single Rust crate. It does **not**
count:

- intra-module references (same file, sibling items)
- `pub` re-exports that the module does not itself import
- `dev-dependencies` or build-script imports
- macro-generated code paths

So a `lib.rs` that re-exports 20 submodules will report `Ca = 0` from
`lib.rs` itself but each child module will report its own Ca. The
metric is the *out-degree* in the module dependency graph, not the
in-degree.

## How to interpret a violation

When CI reports a violation, the JSON artifact at
`findings/coupling-report.json` contains:

```json
{
  "tool": "check-coupling.sh",
  "results": [
    {
      "crate": "pheno-config",
      "verdict": "fail",
      "output": "...cargo-modules output naming the offending module..."
    }
  ]
}
```

The first three steps in triaging a violation are:

1. **Read the offending module's `use` block.** A `use` storm usually
   signals a missing abstraction (a port + adapter pair) or a leaked
   detail. Per ADR-038 (hexagonal L4 policy), a coupling violation is
   also a port-discovery signal.
2. **Split by responsibility, not by line count.** Do not just extract
   functions — extract a *boundary*. The new module should have a
   single, named concern (e.g. `validation`, `serialization`).
3. **Re-run locally:** `just check-coupling` (or
   `./scripts/check-coupling.sh`). The verdict should flip from `fail`
   to `pass` without changing any other module.

## Why Ca = 5 (and not 7, 10, or 4)?

The fleet's substrate tier is a polyglot (Rust, Python, Go, TypeScript).
A Rust module at `Ca = 5` is roughly the cognitive-load equivalent of a
Python package with 5 sibling imports — the human can hold 5 names in
working memory without paging. 7 is where the defect rate starts to
climb noticeably (Microsoft's internal "righteous code" study); 10 is
the empirical break point at which automated refactoring tools stop
producing useful results.

## References

- ADR-023 — Agent-effort governance (substrate quality bar)
- ADR-024 — 71-pillar industry-standard audit framework
- ADR-038 — Hexagonal port-adapter L4 policy (port-discovery companion to L3)
- ADR-040 — Test coverage gates per tier (80% lib / 70% framework)
- ADR-049 — App-substrate drift detector (L3 is the leading indicator)
- `cargo-modules` (crates.io v0.9) — the underlying tooling
