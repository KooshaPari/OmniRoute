# ADR-040: Test coverage gates per substrate tier

**Status:** ACCEPTED
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**L8-006** (v8 track T18)
**Refs:**
- ADR-023 (substrate placement Rule 3.1)
- ADR-024 (71-pillar L20-L27 quality pillars)
- ADR-038 (Port/Adapter pattern enables mock-based coverage)

---

## Context

ADR-023 Rule 3.1 sets coverage gates per substrate tier:
- 80% lib/SDK
- 70% framework
- 60% federated service

Coverage is currently measured ad-hoc. Some repos measure, some don't. Gate enforcement is inconsistent.

## Decision

**Coverage gates are enforced by `pheno-ci-templates` workflow. The gate is per-tier (80/70/60%) and measured by `cargo-llvm-cov` (Rust), `coverage.py` (Python), `go test -cover` (Go), or `nyc` (TypeScript).**

### Per-tier matrix

| Tier | Examples | Gate | Measurement tool |
|---|---|---|---|
| `pheno-*-lib` (Rust single-crate) | pheno-config, pheno-context, pheno-otel, pheno-port-adapter, pheno-tracing, pheno-flags, pheno-errors | 80% lines | `cargo-llvm-cov` |
| `pheno-*-core` (Rust multi-crate) | pheno-cli-base, pheno-cargo-template | 80% lines | `cargo-llvm-cov --workspace` |
| `phenotype-*-sdk` (polyglot) | phenotype-go-sdk, phenotype-python-sdk, phenotype-ts-sdk | 80% lines | per-language |
| `phenotype-*-framework` (IoC) | phenotype-hub, phenotype-bus | 70% lines | per-language |
| Federated service (long-running) | phenoMCP, phenoObservability, phenoEvents | 60% lines | per-language |

### Enforcement

CI workflow (`pheno-ci-templates/coverage.yml`):
```yaml
- name: Coverage gate
  run: |
    case "$PHENO_TIER" in
      lib|sdk|core) MIN=80 ;;
      framework)    MIN=70 ;;
      service)      MIN=60 ;;
    esac
    pheno-coverage --min=$MIN --report
```

A repo's tier is declared in its `flake.nix`:
```nix
outputs = { ... }: {
  pheno.tier = "lib";  # or "core", "sdk", "framework", "service"
};
```

### Migration sequence (22 PRs, ~150 min, 4 subagents in parallel)

| # | Repo | Tier | Gate | Subagent |
|---|---|---|---|---|
| 18.1-18.6 | 6 pheno-* Rust libs | lib | 80% | forge-A |
| 18.7-18.10 | 4 phenotype-*-sdk | sdk | 80% | forge-A |
| 18.11-18.14 | 4 phenotype-*-framework | framework | 70% | forge-B |
| 18.15-18.18 | 4 federated services | service | 60% | forge-C |
| 18.19-18.22 | 4 substrate (Python, Go, TS) | varies | varies | forge-D |

## Consequence

- 22/22 pheno-* substrate repos enforce per-tier coverage gate
- 71-pillar L23 (test coverage) score improves from ~12/30 to ~24/30
- `pheno-coverage` CLI is a new tool (subagent forge-A task)
- Coverage reports uploaded to `phenotype-org-audits/audit-71-pillar-L23-*`

## Cross-references

- ADR-023 Rule 3.1 (substrate quality bar)
- ADR-024 pillar L23 (test coverage)
- ADR-038 (Port/Adapter enables mock-based coverage)
- `findings/2026-06-18-L8-006-coverage-gates.md`
