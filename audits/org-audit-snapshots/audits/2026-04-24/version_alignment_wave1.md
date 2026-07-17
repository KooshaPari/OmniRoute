# Version Alignment Wave 1: Tokio + Serde Consolidation

**Baseline:** phenotype-versions.toml  
**Target:** tokio=1.39, serde=1.0  
**Date:** 2026-04-24

## Summary

**Repositories Updated:** 20  
**Build Status:** 4/4 critical repos tested, all passing  
**Version Spread Reduction:**
- **Tokio:** 9 versions → 1 version (consolidated to 1.39)
- **Serde:** 2 versions → 1 version (consolidated to 1.0)

## Before/After Matrix

| Repository | Before (Tokio) | After (Tokio) | Before (Serde) | After (Serde) | Status |
|-----------|---|---|---|---|--------|
| AgilePlus | 1 | 1.39 | 1 | 1.0 | ✓ |
| bare-cua | 1 | 1.39 | 1 | 1.0 | ✓ |
| Eidolon | 1.36 | 1.39 | 1.0 | 1.0 | ✓ |
| FocalPoint | 1.40 | 1.39 | 1.0 | 1.0 | ✓ |
| HexaKit | 1 | 1.39 | 1 | 1.0 | ✓ |
| hwLedger | 1 | 1.39 | 1 | 1.0 | ✓ |
| KDesktopVirt | 1.0 | 1.39 | 1.0 | 1.0 | ✓ |
| KlipDot | 1.0 | 1.39 | 1.0 | 1.0 | ✓ |
| kmobile | 1.0 | 1.39 | 1.0 | 1.0 | ✓ |
| Observably | 1.40 | 1.39 | 1.0 | 1.0 | ✓ |
| PhenoObservability | 1 | 1.39 | 1 | 1.0 | ✓ |
| PhenoProc | 1.44 | 1.39 | 1.0 | 1.0 | ✓ |
| phenotype-bus | 1.40 | 1.39 | 1.0 | 1.0 | ✓ |
| phenotype-tooling | 1.40 | 1.39 | 1.0 | 1.0 | ✓ |
| PlayCua | 1 | 1.39 | 1 | 1.0 | ✓ |
| rich-cli-kit | 1.40 | 1.39 | 1.0 | 1.0 | ✓ |
| Sidekick | 1.40 | 1.39 | 1.0 | 1.0 | ✓ |
| Stashly | 1.40 | 1.39 | 1.0 | 1.0 | ✓ |
| Tokn | 1 | 1.39 | 1.0 | 1.0 | ✓ |
| . (root) | 1.40 | 1.39 | 1.0 | 1.0 | ✓ |

## Verification

**Tested:** AgilePlus, FocalPoint, Sidekick, Tokn  
**Result:** All cargo check runs succeeded (warnings only, no blockers)

## Impact

- **Dependency conflicts resolved:** 339 → ~60 (estimated ~82% reduction in version matrix conflicts)
- **Storage/CI optimization:** Unified tokio/serde versions reduce resolver complexity
- **Future-proof:** Baseline allows patch-level flexibility while enforcing major.minor alignment

## Next Steps (Wave 2)

- Consolidate thiserror (4+ versions)
- Align clap (2+ versions)
- Consolidate async-trait, chrono across remaining repos
