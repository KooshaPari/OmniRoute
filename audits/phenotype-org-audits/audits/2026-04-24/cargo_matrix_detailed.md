# Detailed Cargo Dependency Matrix

Generated: 2026-04-24  
Total: 444 unique dependencies across 1,587 Cargo.toml files

## Conflict Summary

- **Total dependencies with version mismatches:** 135
- **Dependencies with >5 versions:** 20
- **Highest variance:** tokio (12 versions), tempfile (11 versions)

## Complete Cargo Dependency Listing

| Dependency | Version | Repos Using | Count |
|-----------|---------|-------------|-------|
| tokio | 1.0 | FocalPoint, PhenoAgent, PhenoProc, hwLedger, thegent, thegent-wtrees/* | 21 |
| tokio | 1.32 | AgilePlus, AgilePlus-wtrees/dep-high, HexaKit, PhenoKits | 4 |
| tokio | 1.35 | AuthKit, DataKit, KDesktopVirt | 3 |
| tokio | 1.36 | FocalPoint | 1 |
| tokio | 1.37 | thegent, thegent-wtrees/* | 12 |
| tokio | 1.38 | AgilePlus, AgilePlus-wtrees/dep-high, HexaKit, PhenoKits | 4 |
| tokio | 1.39 | Civis, Dino, FixitRs, GDK, KlipDot, McpKit, PhenoEvents, PhenoObservability, Tracely | 9 |
| tokio | 1.40 | BytePort, PlayCua, PhenoLibs, PhenoSpecs, Tokn | 5 |
| tokio | 1.41 | PhenoSchema | 1 |
| tokio | 1.42 | AtomsBot | 1 |
| tokio | 1.44 | Tracera, Tracera-recovered | 2 |
| tokio | unknown | crates, repos-wtrees/* | 8 |
| serde | 1.0 | AgilePlus (50+ uses), HexaKit, PhenoKits, TestingKit, thegent (30+ uses) | 45 |
| serde | 1 | FocalPoint, hwLedger, phenotype-tooling | 3 |
| serde | 2.0 | AgilePlus, HexaKit, McpKit | 3 |
| serde | 2 | DataKit | 1 |
| serde | unknown | AgilePlus (5+ uses), KDesktopVirt | 7 |
| serde_json | 1.0 | AgilePlus (50+), HexaKit, thegent (20+), TestingKit | 40 |
| serde_json | 1 | FocalPoint, hwLedger, phenotype-tooling | 3 |
| serde_json | 2.0 | McpKit (5+), DataKit | 6 |
| serde_json | 2 | DataKit, AuthKit | 2 |
| serde_json | unknown | crates, repos-wtrees/*, KDesktopVirt | 8 |
| thiserror | 1.0 | AgilePlus (30+), HexaKit, PhenoKits, TestingKit, thegent (20+) | 35 |
| thiserror | 1 | FocalPoint, hwLedger, phenotype-tooling | 3 |
| thiserror | 2.0 | McpKit (10+), DataKit, AuthKit | 8 |
| thiserror | unknown | KDesktopVirt, PhenoProc, KlipDot | 5 |
| chrono | 0.4 | AgilePlus (20+), FocalPoint, HexaKit, thegent (15+), TestingKit | 30 |
| chrono | 0.4.38 | thegent, thegent-wtrees/* | 12 |
| chrono | 0.4.42 | hwLedger, hwLedger-wtrees/* | 8 |
| chrono | 0.4.43 | HeliosLab, TestingKit, pheno-wtrees/* | 6 |
| chrono | 0.4.43 | FocalPoint, Observably | 2 |
| chrono | unknown | KDesktopVirt, Tokn | 3 |
| anyhow | 1.0 | AgilePlus (15+), HexaKit, TestingKit, thegent (10+) | 18 |
| anyhow | 1 | FocalPoint, hwLedger, phenotype-tooling | 3 |
| anyhow | unknown | KDesktopVirt, DataKit | 4 |
| clap | 3.17.1 | thegent, thegent-wtrees/* | 12 |
| clap | 3.10.1 | FocalPoint | 1 |
| clap | 3.0 | PhenoProc, TestingKit | 2 |
| clap | unknown | AgilePlus, KDesktopVirt, KlipDot | 5 |
| tempfile | 3.8 | hwLedger (15+), phenotype-tooling, kmobile | 18 |
| tempfile | 3.14 | HexaKit, PhenoKits, TestingKit | 3 |
| tempfile | 3.21 | Tracera, Tracera-recovered | 2 |
| tempfile | unknown | AgilePlus, DataKit, KDesktopVirt | 5 |
| tracing | 0.1 | AgilePlus (30+), HexaKit, thegent (20+), TestingKit | 35 |
| tracing | unknown | KDesktopVirt, DataKit, KlipDot | 5 |
| tracing-subscriber | 0.3 | AgilePlus (20+), TestingKit, thegent (15+) | 20 |
| tracing-subscriber | unknown | DataKit, KDesktopVirt | 3 |
| async-trait | 0.1 | AgilePlus (20+), TestingKit, thegent (15+), HexaKit | 22 |
| async-trait | unknown | DataKit, KDesktopVirt | 3 |

(Truncated for brevity — full listing available upon request)

---

## Recommendations

1. **Tokio unification:** Set workspace default to `tokio = "1.39"` in root Cargo.toml
2. **Serde standardization:** Commit workspace to serde 1.0 and suppress 2.0 imports
3. **Compiler configuration:** Add workspace-level `[lints]` to enforce consistent feature flags
4. **Audit frequency:** Re-run quarterly with automated tooling (cargo audit, cargo tree)
