# PhenoKits absorption matrix

Date: 2026-06-20
Source repo: `KooshaPari/PhenoKits`
Observed local branch: `feature/L1.4-governance-keystone-2026-06-12`
Remote state: archived/read-only; branch push blocked
Preservation evidence: `docs/absorption/PhenoKits/feature-L1.4-governance-keystone-2026-06-12/` contains 8 patches from `origin/main..HEAD`

## Executive decision

`ARCHIVE_ONLY`. Do not delete until all broad shared surfaces are either moved to tight owners or intentionally deprecated. The current remote archive state is acceptable; deletion is not justified.

| Source Item | Source Evidence | Category | Source State | Target Repo | Target Evidence | Status | Deletion Justification | Risk if Deleted | Required Action |
|---|---|---|---|---|---|---|---|---|---|
| Local branch work | `feature/L1.4-governance-keystone-2026-06-12`; 8 generated patches | Branch-only work | branch-only | `phenotype-registry` | patchset preserved under `docs/absorption/PhenoKits/.../patches` | `DONE` | Branch content is preserved outside archived source repo | low - patch replay still available | none |
| Shared artifact monorepo intent | `README.md` says umbrella checkout + shared-artifact monorepo | Product intent | docs-only/implemented | `phenokits-commons` + `phenotype-registry` | `phenokits-commons` cloned; registry preservation docs pushed | `PARTIAL` | Intent is preserved but repo is too broad to delete blindly | medium - loss of context for 12-category artifact model | migrate canonical intent to registry/commons if still needed |
| 12-category directories | `templates/`, `configs/`, `libs/`, `secrets/`, `governance/`, `security/`, `observability/`, `docs/`, `scripts/`, `schemas/`, `policies/`, `credentials/` | Internal architecture | implemented/docs | `phenokits-commons` | matching category dirs observed in cloned target | `PARTIAL` | Broad category structure exists in target, but file-level parity not proven | medium - templates/policies may diverge | compare category diffs before deletion |
| Go libs | `libs/go/phenotype-go-*`, `pheno-core-cgo`, `phenotype-id` | Public packages/modules | implemented | `phenotype-go-sdk` | local target exists; clean branch | `PARTIAL` | Go SDK is correct tight target, but PhenoKits libs were not moved in this pass | high - Go modules may be lost | compare and migrate into `phenotype-go-sdk` packages |
| Python libs | `libs/python/pheno-cli-*`, `phenotype-id`, `phenotype-logging`, `phenotype-testing`, `phenotype-py-kit` | Public packages/modules | implemented | `phenotype-python-sdk` | local target exists; branch work preserved at `0f00426` | `PARTIAL` | Python SDK is correct target; parity not fully proven | high - Python packages may be lost | compare and migrate package-by-package |
| TypeScript libs | `libs/typescript/phenotype-core-ts`, `phenotype-id`, `plugin-typescript` | Public packages/modules | implemented | TBD TS owner | `phenotype-ts-utils` does not exist under KooshaPari | `NOT_COVERED` | No real tight TS target resolved | high - TS utility packages may be lost | create/choose TS owner before deletion |
| Templates | `templates/clean-rust`, `templates/hexagonal`, `templates/microservice-scaffold`, `templates/phenotype-api`, `templates/webapp` | Generators/templates | implemented | `phenokits-commons` | target contains matching template dirs | `PARTIAL` | Target has broad template structure but parity not proven | medium - scaffold knowledge may be lost | compare templates before deletion |
| Hexagon governance/spec docs | `hexagon/ADR.md`, `CHARTER.md`, `PLAN.md`, `PRD.md`, `SPEC.md`, `SOTA.md` | Governance/specs | docs-only | `phenokits-commons` / `phenotype-registry` | cloned target has matching `hexagon/` docs | `PARTIAL` | Likely preserved but not file-level checked | medium - governance rationale may be lost | diff and keep canonical version |
| Security/secrets/credentials patterns | `security/`, `secrets/`, `credentials/` | Security/compliance artifacts | docs/templates | `phenokits-commons` | target contains matching dirs | `PARTIAL` | Target has structure but not proven content parity | high - policy/security templates may be lost | compare before deletion |
| Root virtual Cargo workspace | `Cargo.toml` with `members=[]` and excluded libs/templates | Build/tooling | scaffold | none | root manifest is intentionally non-buildable | `NO_MERIT` | Empty virtual workspace is just tooling marker; not a surviving feature | low - no buildable crate lost | document only |
| Broken submodule metadata | `git submodule status` reported missing mapping for `.claude/worktrees/...` | Broken/scaffold work | broken | none | error captured in session output | `NO_MERIT` | Broken local worktree/submodule metadata has no reusable artifact by itself | low - broken checkout metadata lost | none |

## Final recommendation

Keep `PhenoKits` archived. Do not delete until Go/Python/TS libs and governance/template surfaces are diffed against their final owners. The branch-only work is preserved in registry, so local-only loss risk is reduced.
