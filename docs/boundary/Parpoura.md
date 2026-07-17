---
repo: "Parpoura"
role: absorbed
status: archived
last_boundary_review: 2026-07-17
review_cadence: never (archived)
archive_reason: absorbed-into-phenodocs
canonical_source: phenodocs/docs/specs/parpoura/
absorbing_repo: KooshaPari/phenodocs
---

# Boundary — Parpoura (ABSORBED → phenodocs)

## Disposition

**ABSORB** on 2026-07-17. Source repo `KooshaPari/Parpoura` subsequently
**archived** on GitHub via `gh repo archive KooshaPari/Parpoura -y` and verified
`isArchived=true` via `gh repo view`.

Parpoura is a **spec-first planning/architecture** repository that served as a
documentation hub for the Phenotype control-plane design. Per its README:

> "Specification-First Planning & Architecture — A comprehensive documentation
> repository for deterministic venture management and control-plane system
> design, following spec-driven development practices."
>
> "**Work state:** DORMANT · **Progress:** `███░░░░░░░ 30%`"

The repo was listed in `phenotype-registry/catalog/registry.yaml` under
"Ownership Program. EXCLUDED" — meaning it cannot become its own catalog
entry; its content must fold into an existing canonical spine. The chosen
spine is `phenodocs`, the canonical documentation hub.

## Audit summary

| Aspect | Finding |
|--------|---------|
| Domain | Spec-first planning/architecture / venture control-plane design |
| Languages | Markdown (primary) + Python stubs (skipped) |
| Remote size | 84KB (main only) |
| Local clone size | 27MB (15MB is rendered HTML mirrors) |
| Last push | 2026-02-23T11:17:23Z |
| Branches | 1 remote branch (`main`) |
| Phenotype substrate alignment | None at the code level (pure spec); complements PhenoSpecs at the doc-plane level |
| Pillar | None directly; provides planning/architecture documentation |
| Reuse potential | The 80-file / 2.7MB spec bundle (PRD, FR, ADR, PLAN, USER_JOURNEYS, TECHNICAL_SPEC + 3 track specs + DATA_MODEL_DB/API_EVENTS/ARTIFACT_COMPILER/OPS_COMPLIANCE/SCHEMA_PACK/ROLE_TOOL/USER_SPEC) is valuable as canonical planning reference material |
| Decision | ABSORB into phenodocs/docs/specs/parpoura/; archive source |

## What was absorbed

80 files / 2.7MB selective-copied into `phenodocs/docs/specs/parpoura/`:

- 29 root markdown files (PRD, FR, ADR, PLAN, USER_JOURNEYS, TECHNICAL_SPEC,
  USER_SPEC, ARCHITECTURE, PRODUCT_MODEL, IMPLEMENTATION_ROADMAP, COMPARISON,
  NEXT_STEPS, QUICK_START, SPECS_INDEX, SPECS_DELIVERY_INDEX, SCHEMA_PACK,
  DATA_MODEL_DB_SPEC, API_EVENTS_SPEC, ARTIFACT_COMPILER_SPEC, TRACK_A/B/C,
  INFRASTRUCTURE_AND_TEST_SPECS, OPS_COMPLIANCE_SPEC,
  ROLE_TOOL_ALLOWLIST_MATRIX, GOVERNANCE_SCAFFOLD_SUMMARY, CLAUDE.md, ADR.md,
  README.md)
- `adr-markdown/` (7 individual ADR markdown files)
- `traceability/` (CROSS_PROJECT_TRACEABILITY, EVENT_TAXONOMY,
  VENTURE_TRACEABILITY_MATRIX)
- `research/` (6 RND notes + RESEARCH_INDEX + CONVERSATION_DUMP provenance)
- `reference/` (ECOSYSTEM_MAP, INTERFACE_CONTRACTS, INFRASTRUCTURE_SPEC,
  LIBRARY_MANIFEST, SERVICE_CATALOG, SECURITY_THREAT_MODEL, CIVLAB_GAME_DESIGN,
  VENTURE_SELF_FUNDING_MECHANICS, WORK_STREAM + status trackers)
- `docs/` (deep tree: BACKLOG, IMPLEMENTATION_PLAN, STATUS_REPORT, traceability,
  RELEASE_CHECKLIST, SPEC, index, journey-traceability)
- `docs/guides/` (7 guide docs)
- `ABSORPTION.md` provenance note

## What was deliberately NOT absorbed

| Category | Reason |
|----------|--------|
| Rendered HTML mirrors (`index.html`, `404.html`, every `.html` sibling) | Markdown sources are canonical |
| ChatGPT provenance dumps (550KB root conversation + 88 `docs/context/conv2/chunk_*.md` files) | LLM-conversation provenance, not spec content |
| Governance boilerplate (`AGENTS.md`, `CODE_OF_CONDUCT.md`, `CODEOWNERS`, `CONTRIBUTING.md`, `CHANGELOG.md`, `FUNDING.yml`, `SECURITY.md`, `SUPPORT.md`, `LICENSE*`, `CITATION.cff`) | Canonical governance lives in `phenotype-registry/` and `phenodocs/` |
| Build/tooling/lockfiles (`package*.json`, `bun.lock`, `uv.lock`, `Taskfile.yml`, `justfile`, etc.) | Build artifacts, not docs |
| CI/IDE/dotfiles (`.github/`, `.airlock/`, `.devcontainer/`, `.gemini/`, etc.) | Repo configuration |
| Localization stubs (`fa/`, `fa-Latn/`, `zh-CN/`, `zh-TW/`) | Empty placeholders |
| Scripts/hooks/checks (`scripts/`, `hooks/`, `worklogs/`, `tests/`) | Governance/build helpers |
| Duplicates (`docs/fragemented/` — typo for "fragmented") | Stale snapshots already preserved elsewhere |
| Assets (`assets/`, `Joule-based Technocratic Economy_files/`) | Binary artifacts tied to excluded rendered HTML |
| **Runtime code (`venture/` and `tests/`)** | Dormant Python/pytest stubs tied to a venture concept that never reached implementation. If revived, these belong in `phenotype-apps` or a dedicated repo, not in a docs site |

## What lives where now

| Capability | Lives in |
|------------|----------|
| Spec-first planning/architecture documentation | `phenodocs/docs/specs/parpoura/` (canonical) |
| Parpoura runtime Python stubs (auth, database, eventbus, ledger, api) | `KooshaPari/Parpoura` (archived) — recoverable for forensic reference |
| Parpoura pytest stubs | `KooshaPari/Parpoura` (archived) — recoverable for forensic reference |
| Shared spec library (canonical specs across Phenotype) | `KooshaPari/PhenoSpecs` (separate spine member) |
| Doc hub / pattern handbook / research | `KooshaPari/phenodocs` (other subtrees) |

## Outcome

- 80 files / 2.7MB absorbed into `phenodocs/docs/specs/parpoura/`.
- Source repo `KooshaPari/Parpoura` archived on GitHub (read-only tombstone).
- Registry row `repo-Parpoura`: disposition `AFFIRM` → `ABSORB`,
  fsm `active` → `absorbed`, target `phenodocs (docs/specs/parpoura/)`.
- Audit artifact: `phenotype-registry/audits/absorption-justifications/Parpoura-2026-07-17.md`.
- Provenance: `phenodocs/docs/specs/parpoura/ABSORPTION.md`.
- Branch: `absorb/parpoura-2026-07-17` at commit `8901287` on
  `KooshaPari/phenodocs`.

**Next review:** never (archived; tombstone state).
