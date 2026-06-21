# ADR-031: Configra substrate split (pheno-config + phenotype-config + Conft + settly-* all absorbed into Configra)

`KooshaPari/Configra` is the canonical home for all configuration substrate code in the fleet; eight `pheno-config*` / `phenotype-config*` / `Conft` / `settly-*` repos are absorbed into it under a two-crate split (Rust core + TypeScript edge) and deprecated.

**Status:** Accepted
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Track:** v8 T10 (Configra absorption) + T14.2 (governance backlog)
**L8-001** (T10.1 + T14.2)

## Context

Eight repos currently hold configuration substrate code in the fleet:

| Repo | Language | Status |
|---|---|---|
| `pheno-config` | Rust | active |
| `phenotype-config` | Rust | active |
| `phenotype-config-rs` | Rust | active |
| `Conft` | TypeScript | active (TS edge) |
| `settly-config` | Python | deprecated upstream |
| `settly-config-rs` | Rust | deprecated upstream |
| `settly-config-ts` | TypeScript | deprecated upstream |
| `phenotype-python-sdk/phenotype_config` | Python sub-crate | embedded |

Per AGENTS.md **Decision A**, the fleet should converge on a single canonical name and location for config. `KooshaPari/Configra` (created 2026-03-25) is the chosen canonical name. ADR-022 originally proposed a "two-crate canonical split" (Rust core + TS edge) — this ADR **preserves the split** but moves the canonical name from `phenotype-config` to `Configra`.

The 12-PR absorption wave is mid-flight per the v8 plan Track T10; this ADR ratifies the absorption as fleet policy rather than a one-off migration.

## Decision

**Configra is the canonical config substrate. All 8 source repos are absorbed into it under a 2-crate layout:**

### Layout

```
KooshaPari/Configra/
├── crates/phenotype-config-shared-config/    # Rust core (the absorbed code from
│   │                                         # pheno-config, phenotype-config,
│   │                                         # phenotype-config-rs, settly-config-rs)
│   ├── Cargo.toml
│   ├── src/
│   └── tests/
├── typescript/packages/phenotype-config/    # TS edge (the absorbed code from
│   │                                         # Conft, settly-config-ts)
│   ├── package.json
│   ├── src/
│   └── tests/
└── python/phenotype-config/                  # Python (from settly-config +
                                              # phenotype-python-sdk/phenotype_config)
```

The 8 source repos keep their existing repos as **deprecated mirrors** for the deprecation window; deletion date is **2026-07-15** (28 days from migration complete). Each deprecation mirror gets a README banner pointing at Configra and a CI lint that fails any new content commit.

### Migration matrix (T10.2–T10.7 absorb-import; T10.8–T10.12 migrate-from PRs)

| # | Source | Target | Type | PR |
|---|---|---|---|---|
| 10.2 | `pheno-config` core | `crates/phenotype-config-shared-config/pheno-config/` | Rust | `KooshaPari/Configra#1` |
| 10.3 | `phenotype-config` core | `crates/phenotype-config-shared-config/phenotype-config/` | Rust | `KooshaPari/Configra#2` |
| 10.4 | `phenotype-config-rs` | `crates/phenotype-config-shared-config/phenotype-config-rs/` | Rust | `KooshaPari/Configra#3` |
| 10.5 | `Conft` (TS edge) | `typescript/packages/phenotype-config/` | TS | `KooshaPari/Configra#4` |
| 10.6 | `settly-config` | `python/phenotype-config/settly-config/` | Python | `KooshaPari/Configra#5` |
| 10.7 | `settly-config-rs` | `crates/phenotype-config-shared-config/settly-config-rs/` | Rust | `KooshaPari/Configra#6` |
| 10.8 | `pheno-config` (downstream re-export) | `pheno-config = { package = "configra" }` | Rust | `KooshaPari/pheno-config#1` |
| 10.9 | `phenotype-config` (downstream) | re-export from Configra | Rust | `KooshaPari/phenotype-config#1` |
| 10.10 | `phenotype-config-rs` (downstream) | re-export / absorb | Rust | `KooshaPari/phenotype-config-rs#1` |
| 10.11 | `Conft` (downstream) | point at Configra TS edge | TS | `KooshaPari/Conft#1` |
| 10.12 | `settly-*` (downstream, 4 repos) | point at Configra | mixed | `KooshaPari/settly-*{1..4}` |

### Gates (per ADR-035)

Configra migration is gated by 4 pre-conditions (ADR-035): (1) Configra scores ≥ 24/30 on the 71-pillar audit (80% threshold), (2) zero secret leaks in last 30 days, (3) SLSA build provenance configured (`docs/slsa.md`), (4) `Conft` (TS edge) is reviewed and confirmed Rust-free behind the TS bindings.

## Consequences

*Positive:*
- One canonical name (Configra) eliminates 7-way naming confusion across the fleet.
- The 2-crate split (Rust core / TS edge) preserves the ADR-022 architectural boundary.
- The 8 deprecation mirrors are inert; no new content is committed to them, eliminating parallel maintenance.

*Negative / Risks:*
- 28-day deprecation window is tight; consumers that haven't migrated by 2026-07-15 will break.
- Cross-language contract tests (Configra Rust ↔ Configra TS ↔ Configra Python) do not exist yet — absorbed code may diverge across language edges.
- Conft's review (Gate 4) is a blocker; if Rust code is hidden behind the TS bindings, the split is invalidated.

## Refs

- ADR-022 (Config consolidation — split preserved, naming superseded)
- ADR-035 (Configra migration gates — 4 pre-conditions)
- AGENTS.md § "Decision A — Configra is the canonical config repo name"
- `findings/2026-06-18-L8-001-configra-absorption-plan.md`
- v8 plan § 3.2 Track T10 (12-PR absorption wave)
- `KooshaPari/Configra` repo (created 2026-03-25)
