# QUI-AUD-009 — Quillr 3-clone audit

## Question

Are `Dev/Quillr`, `pheno/Quillr`, `pheno-absorb/Quillr` three separate
working copies of KooshaPari/Quillr, requiring reconciliation?

## Audit method

Inspect each path's git remote + HEAD reference.

## Findings

| Path | Remote | HEAD | Status |
|---|---|---|---|
| `C:\Users\koosh\Dev\Quillr` | `https://github.com/KooshaPari/Quillr.git` | `fix/ci-reds-pyproject-template` (local-only) | **Canonical clone** |
| `C:\Users\koosh\pheno\Quillr` | `https://github.com/KooshaPari/pheno.git` (NOT Quillr) | `main` | **Sub-tree of `pheno` monorepo** |
| `C:\Users\koosh\pheno-absorb\Quillr` | `https://github.com/KooshaPari/pheno.git` (NOT Quillr) | `main` | **Sub-tree of `pheno` monorepo** |

`pheno/Quillr` and `pheno-absorb/Quillr` are sparse-checkout views of
the `pheno` monorepo's `Quillr/` subdirectory. They share `.git/`
with the parent monorepo. They are NOT separate Quillr clones.

## Conclusion

No reconciliation needed. The 3 "clones" are 1 canonical Quillr clone
(`Dev/Quillr`) + 2 sub-tree views of `pheno` (which contain an
absorbed/imported snapshot of Quillr from a prior absorption phase).

## DAG impact

- QUI-AUD-009 = **closed** (no action)
- QUI-GIT-101 (reconcile clones) = **cancelled** (premise was wrong)
- Cross-repo ref: `pheno/Quillr/` should be marked as
  `quillr-mirror: deprecated, see KooshaPari/Quillr` in the
  monorepo's docs

## Action

- Add `// DEPRECATED: see https://github.com/KooshaPari/Quillr`
  header to `pheno/Quillr/README.md` (already present per audit)
- Add same header to `pheno-absorb/Quillr/README.md`
- Document the relationship in `phenotype-registry/registry/domain-roles.json`
  under Quillr's entry
