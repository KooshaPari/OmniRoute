# ADR-039: Pheno-flake refresh template for substrate repos

**Status:** ACCEPTED
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**L8-005** (v8 track T15)
**Refs:**
- ADR-023 (substrate placement Rule 3.1)
- ADR-024 (71-pillar audit)
- ADR-025 (worklog v2.1)
- ADR-027 (git LFS 3-tier)

---

## Context

22 pheno-* substrate repos + 13 phenotype-*-sdk repos = 35 substrate repos. Each has unique CI, test matrix, coverage gate, and meta-bundle (AGENTS.md + llms.txt + WORKLOG.md + CHANGELOG.md + LICENSE-MIT). Manual refresh of each is O(repo) work, not O(fleet).

A "pheno-flake" (Nix flake template) provides uniform structure for new substrate.

## Decision

**All new pheno-* substrate repos MUST use the pheno-flake template. Existing substrate repos are refactored to the template in v8 track T15 (22 PRs, ~150 min).**

### Pheno-flake template structure

```
pheno-flake/
├── flake.nix                   # Nix flake entry (CI matrix)
├── flake.lock                  # Pinned deps
├── AGENTS.md                   # AI-agent context
├── llms.txt                    # LLM context (per ADR-024)
├── WORKLOG.md                  # v2.1 schema (per ADR-025)
├── CHANGELOG.md                # Conventional commits
├── LICENSE-MIT                 # MIT license
├── .gitattributes              # LFS 3-tier (per ADR-027)
├── README.md
├── docs/
│   ├── SPEC.md                 # 1-page spec
│   ├── SSOT.md                 # 1-page SSOT
│   └── architecture.md
├── src/
│   ├── lib.rs                  # or main.py, main.go, etc.
│   ├── port.rs                 # Hexagonal Port (per ADR-038)
│   └── adapters/
│       ├── default.rs
│       └── mock.rs
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── coverage.md             # 80% lib / 70% framework / 60% service gate
│   └── observability.md        # OTLP export (per ADR-036)
└── .github/
    └── workflows/
        ├── ci.yml              # cargo test + clippy + rustfmt
        ├── coverage.yml        # cargo-llvm-cov with gate
        └── otlp-smoke.yml      # pheno-otel smoke test
```

### Adoption matrix (35 substrate repos)

| Type | Count | Repos |
|---|---|---|
| Rust libs | 11 | pheno-config, pheno-context, pheno-otel, pheno-port-adapter, pheno-tracing, pheno-flags, pheno-errors, pheno-cli-base, pheno-cargo-template, pheno-agents-md, pheno-go-ctxkit* |
| Python packages | 10 | pheno-cost-card, pheno-fastapi-base, pheno-llms-txt, pheno-mcp-router, pheno-prompt-test, pheno-pydantic-models, pheno-scaffold-kit, pheno-vibecoding-guard, pheno-worklog-schema, pheno-secret-scan |
| Go modules | 1 | pheno-go-ctxkit |
| TypeScript | 1 | pheno-zod-schemas |
| Container | 1 | pheno-wtrees (not buildable) |
| phenotype-*-sdk | 13 | (varies, see phenotype-* repos) |

*pheno-go-ctxkit is Go, not Rust*

## Migration sequence (22 PRs, ~150 min, 4 subagents in parallel)

| # | Repo | Subagent |
|---|---|---|
| 15.1-15.6 | 6 Rust libs | forge-A |
| 15.7-15.12 | 6 Rust libs | forge-B |
| 15.13-15.18 | 6 Python packages | forge-C |
| 15.19-15.22 | 4 other (TS, Go, container) | forge-D |

## Consequence

- 22/22 pheno-* substrate repos use pheno-flake template
- 35/35 total substrate repos uniformly structured
- 71-pillar L29 (project structure), L30 (build system) scores improve from ~14/30 to ~28/30
- New substrate creation is O(1) (copy template) instead of O(repo)

## Cross-references

- ADR-023 Rule 3.1 (substrate quality bar)
- ADR-024 (71-pillar framework)
- ADR-025 (worklog v2.1)
- ADR-027 (git LFS)
- ADR-036 (pheno-tracing)
- ADR-038 (Port/Adapter)
- `findings/2026-06-18-L8-005-pheno-flake-rollout.md`
