---
repo: "KodeVibe"
role: quality
status: absorbed
absorbed_into: "phenotype-tooling"
absorbed_at: "phenotype-tooling/tools/kodevibe/"
absorbed_date: 2026-07-17
last_boundary_review: 2026-07-17
review_cadence: never (absorbed)
---

# Boundary — KodeVibe (ABSORBED)

## Disposition

**ABSORBED** into `phenotype-tooling/tools/kodevibe/` on 2026-07-17.

The KodeVibe repo was a Go quality guardian tool (26.8MB, 13 branches) providing
code quality analysis and review capabilities. It has been absorbed as a standalone
tool directory within the phenotype-tooling collection.

## Content migrated

| Item | Source path | Target path |
|------|-------------|-------------|
| Go source | `engine/*.go` (38 files) | `phenotype-tooling/tools/kodevibe/engine/` |
| Binary | `kodevibe` | `phenotype-tooling/tools/kodevibe/kodevibe` |
| Build config | `Makefile`, `.goreleaser.yaml` | `phenotype-tooling/tools/kodevibe/` |
| Installer | `install.sh` | `phenotype-tooling/tools/kodevibe/install.sh` |
| Docs | `docs/`, `README.md`, `AGENTS.md`, `CLAUDE.md` | `phenotype-tooling/tools/kodevibe/` |
| Config | `.kodevibe.yaml`, charter/intent/SOTA | `phenotype-tooling/tools/kodevibe/` |
| Governance | `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md` | `phenotype-tooling/tools/kodevibe/` |

Total: 158 files.

## Outcome

Source repo `KooshaPari/KodeVibe` archived on GitHub.
Registry disposition-index updated: disposition=ABSORB, target=phenotype-tooling.
