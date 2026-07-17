# L61..L70 — DX, QEng, Portability (the 10 developer-experience / quality-engineering / portability pillars)

**Tier:** 1 (continually extended)
**Owner:** Lane owner (Forge)
**Date:** 2026-06-23

## Scope

Developer experience, quality engineering, and portability across the 13
lane repos. The 10 pillars here capture the SOTA 2026 stack for moving
fast without breaking things — the things that *individual contributors*
notice on day 1, and that *QA/Qeng teams* notice on day 90.

## Pillars (one per bullet)

| # | Pillar | 0=missing | 1=seeded | 2=partial | 3=complete |
|---|--------|-----------|----------|-----------|------------|
| L61 | **Devcontainer / .devcontainer** (one-command setup) | absent | Dockerfile | devcontainer | devcontainer+postcreate+features |
| L62 | **Task runner** (`Taskfile.yml`/`mise.toml`/`justfile`) | absent | README "how to build" | one task | full surface (build/test/lint/format/bench) |
| L63 | **EditorConfig + format-on-save** (`.editorconfig`+`.rustfmt.toml`/`.prettierrc`) | absent | one file | one file+CI check | every lang+CI check+pre-commit |
| L64 | **Test pyramid** (unit+integration+e2e) | absent | unit only | unit+integration | unit+integration+e2e+chaos |
| L65 | **Mutation testing** (cargo-mutants/mutpy/infection) | absent | one crate | per-CI nightly | per-PR+threshold gate |
| L66 | **Property-based testing** (proptest/quickcheck/Hypothesis) | absent | one test | several tests | boundary cases+shrinking+replay |
| L67 | **Fuzz harness** (cargo-fuzz/Atheris/libFuzzer) | absent | one harness | nightly | continuous+corpus-mined |
| L68 | **Flake detection** (flake-tracker / re-run stats) | absent | manual triage | re-run on fail | flake-tracker+quarantine+root-cause |
| L69 | **Cross-platform CI** (linux+macos+windows) | linux only | linux+macos | +windows | +freebsd+wasm+musl |
| L70 | **Reproducible local dev** (single command, no docs) | absent | README one-liner | `task dev` | one command+verify+seed-data |

## SOTA 2026 reference

- **VS Code Dev Containers** + **GitHub Codespaces** — one-click dev
  environments backed by a container spec.
- **mise** (formerly rtx) — single tool that replaces asdf, nvm, pyenv,
  gvm, and adds task running. https://mise.jdx.dev
- **Task** (go-task) — modern Make alternative, cross-platform, parallel.
- **Property-based testing**: proptest (Rust), Hypothesis (Python),
  fast-check (JS), jqwik (Java).
- **Mutation testing**: cargo-mutants, PIT (Java), Stryker (JS), mutpy.
- **Fuzzing**: cargo-fuzz (Rust), Atheris (Python), libFuzzer (C/C++),
  Jazzer (JVM).
- **Flaky test detection**: feature-flaky-test in Rust, pytest-flakefinder,
  RSpec::Flaky, jest --testNamePattern.

## Per-repo state (2026-06-23 snapshot)

| Repo | L61 | L62 | L63 | L64 | L65 | L66 | L67 | L68 | L69 | L70 | avg |
|------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| Benchora | 0 | 1 | 2 | 3 | 0 | 3 | 0 | 0 | 1 | 1 | 1.1 |
| portage | 0 | 1 | 2 | 3 | 0 | 0 | 0 | 0 | 2 | 1 | 0.9 |
| pheno-harness | 0 | 1 | 1 | 2 | 0 | 0 | 0 | 0 | 1 | 1 | 0.6 |
| phenodag | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 0.5 |
| Tracera | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 0.5 |
| heliosBench | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 0.4 |
| nanovms | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 2 | 1 | 0.6 |
| PhenoCompose | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 0.5 |
| BytePort | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 0.4 |
| AgilePlus | 0 | 1 | 2 | 2 | 0 | 0 | 0 | 0 | 1 | 1 | 0.7 |
| registry | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| audits | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 0.5 |
| vibeproxy | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0 |

**Cross-repo finding:** the lane is at **~0.5/3 on DX/Qeng/Portability**
(median across 13 repos × 10 pillars). The two clear leaders are
**Benchora** (1.1 — has property-based testing on every validator) and
**portage** (0.9 — has cross-platform CI). The biggest wins:

1. **Mutation testing** (L65) is **0** across the lane — adopting
   cargo-mutants on Benchora + portage would be a 2-day win.
2. **Fuzz harness** (L67) is **0** — 1 day per Rust binary to add
   `cargo-fuzz` and a CI job.
3. **Devcontainer** (L61) is **0** — 1 day to add `.devcontainer/`
   to the top 3 repos.
4. **Cross-platform CI** (L69) is 1-2 per repo — widening to windows
   is the bottleneck (already known: libsqlite3-sys build env).

## Cross-references

- Audit L31..L40 (security), L41..L50 (observability), L51..L60
  (supply-chain) — see sibling files.
- Audit L0..L30 (the existing 25 architecture/quality pillars) —
  [`./audit-30-pillar-L0.md`](./audit-30-pillar-L0.md) (etc.).
- DAG v2 —
  [`../../../plans/2026-06-23-eval-bench-qa-dag-v2.md`](../../../plans/2026-06-23-eval-bench-qa-dag-v2.md) (DAG-T4).
- Benchora property-based testing: see
  [`../../../Benchora/src/property/strategies.rs`](../../../Benchora/src/property/strategies.rs).
