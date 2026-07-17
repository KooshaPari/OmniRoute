# Archived Repositories — 2026-04-24

All repositories listed below have been moved to `.archive/` for cold storage per Section 4.1 of the organization audit plan.

## Archive Index

| Repo | LOC | Reason | Last Commit | Restore |
|------|-----|--------|-------------|---------|
| **pgai** | 54,725 | Dormant 4+ months | `3e05485` | `mv .archive/pgai .` |
| **KaskMan** | 28,273 | OpenClaw predecessor; reference only | `806eaf7` | `mv .archive/KaskMan .` |
| **phenotype-infrakit** | 3,417 | Spec without implementation | (non-git) | `mv .archive/phenotype-infrakit .` |
| **PhenoLang-actual** | 618,994 | 41 LOC stub | `9aa3e04` | `mv .archive/PhenoLang-actual .` |
| **PhenoRuntime** | 6,606 | 1 LOC placeholder | `c1a3011` | `mv .archive/PhenoRuntime .` |
| **pheno** | 9,770 | 198 LOC; unclear purpose | `22aa3d6` | `mv .archive/pheno .` |
| **colab** | 15,020 | 6 LOC + empty submodule | `37d9907` | `mv .archive/colab .` |
| **Pyron** | 16,780 | 4 LOC stub | `6a15c20` | `mv .archive/Pyron .` |
| **FixitRs** | 25,131 | 78 LOC stub | `5698fbe` | `mv .archive/FixitRs .` |
| **phenodocs** | 1,482,103 | 14 LOC; consolidate to docs-hub | `4d9eaac` | `mv .archive/phenodocs .` |
| **phenoEvaluation** | 117,066 | 348 LOC; consolidate to Conft/QuadSGM | `03cb21b` | `mv .archive/phenoEvaluation .` |

## Wave 2 (2026-04-24 LOC-Verified)

| Repo | LOC | Reason | Last Commit | Restore |
|------|-----|--------|-------------|---------|
| **canvasApp** | 18,800 | 80% overlap with FocalPoint connector-canvas | `50b9c5a` | `mv .archive/canvasApp .` |
| **DevHex** | 329 | Minimal stub; superseded | `514af05` | `mv .archive/DevHex .` |
| **go-nippon** | 0 | Docs-only; no implementation | `b069da7` | `mv .archive/go-nippon .` |
| **GDK** | 7,600 | Stub with minimal content | `fffd427` | `mv .archive/GDK .` |

## Summary

- **Total repos archived:** 15 (11 Wave 1 + 4 Wave 2)
- **Combined LOC reclaimed:** ~2,402,614 (moved, not deleted)
  - Wave 1: ~2,377,885 LOC
  - Wave 2: ~26,729 LOC
- **Archive location:** `.archive/<repo-name>/`
- **Reversible:** Yes — each repo includes `DEPRECATION.md` with restore instructions

## Restoration

To restore any archived repository:

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos
mv .archive/<repo-name> .
```

Each archived directory includes `DEPRECATION.md` with the last commit SHA and reasoning.

## Healthy Repos (Excluded)

The following repos remain active in `/repos/`:
- FocalPoint
- AgilePlus
- thegent
- Tracera
- heliosApp
- PhenoLibs
- (all other non-archived repos)
